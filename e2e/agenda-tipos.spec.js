import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday, addDays } from './support/dates.js'
import { openAgendaOn, openNewAppointment, pick, setItemTimes } from './support/agenda.js'
import { demoSalon, memberId, serviceId, apiPost, createClient, confirmAndConclude } from './support/demo.js'
import prisma from './support/db.js'

// Tipos de agendamento criados pela Agenda do Admin (gaveta "Novo agendamento").
// Cada teste usa um dia só seu (N semanas à frente) e marca o agendamento com uma observação
// única, para achá-lo no banco sem depender da ordem dos testes.
const ANA = 'Ana Profissional'

// Dia só do teste (`base` semanas à frente); repetições/novas tentativas pulam para outro bloco de
// semanas, senão o horário já estaria ocupado pela execução anterior no mesmo banco.
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso

async function fillClientAndService(drawer, service, index = 0) {
  if (index === 0) await pick(drawer.getByRole('button', { name: 'Selecionar cliente…' }), 'João Cliente', 'João')
  await pick(drawer.getByRole('button', { name: 'Selecionar serviço…' }).first(), service)
}
const tagNotes = async (drawer, tag) => drawer.getByPlaceholder(/cliente prefere/).fill(tag)
const byTag = (tag) => prisma.appointment.findMany({ where: { notes: tag }, include: { services: true }, orderBy: { date: 'asc' } })

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

test('simples: um serviço com uma profissional', async ({ page }) => {
  const day = testDay(10)
  const tag = `simples-${Date.now()}`
  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '09:00', ANA)
  await fillClientAndService(drawer, 'Corte Feminino')
  await tagNotes(drawer, tag)
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Agendamento criado!')).toBeVisible()

  const [appt] = await byTag(tag)
  expect({ date: appt.date, start: appt.startTime, end: appt.endTime, services: appt.services.length })
    .toEqual({ date: day, start: '09:00', end: '10:00', services: 1 })
  await expect(page.getByRole('button', { name: /João Cliente/ }).filter({ hasText: 'Corte Feminino' })).toBeVisible()
})

test('vários serviços: um atendimento com dois serviços em sequência', async ({ page }) => {
  const day = testDay(11)
  const tag = `multi-${Date.now()}`
  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '09:00', ANA)
  await fillClientAndService(drawer, 'Corte Feminino')
  await drawer.getByRole('button', { name: 'Adicionar serviço' }).click()
  await fillClientAndService(drawer, 'Escova', 1)
  await tagNotes(drawer, tag)
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('2 serviços agendados!')).toBeVisible()

  // Mesma profissional → um bloco só, com os dois serviços encadeados
  const appts = await byTag(tag)
  expect(appts).toHaveLength(1)
  const services = appts[0].services.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => `${s.startTime}-${s.endTime}`)
  expect({ block: `${appts[0].startTime}-${appts[0].endTime}`, services }).toEqual({ block: '09:00-11:00', services: ['09:00-10:00', '10:00-11:00'] })
})

test('recorrente: cria a série com a próxima ocorrência e cancelar a série cancela esta e as seguintes', async ({ page }) => {
  const day = testDay(12)
  const tag = `recorrente-${Date.now()}`
  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '14:00', ANA)
  await fillClientAndService(drawer, 'Corte Masculino')
  await drawer.getByRole('button', { name: /Agendamento recorrente/ }).click()
  await expect(drawer.getByRole('combobox')).toHaveValue('semanal')
  await tagNotes(drawer, tag)
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Agendamento recorrente criado!')).toBeVisible()

  // A 2ª ocorrência já nasce, uma semana depois, na mesma série (sem a observação — não é copiada)
  const [first] = await byTag(tag)
  expect(first.recurringAppointmentId, 'agendamento ligado a uma série').toBeTruthy()
  const occurrences = () => prisma.appointment.findMany({ where: { recurringAppointmentId: first.recurringAppointmentId }, orderBy: { date: 'asc' } })
  const [, second] = await occurrences()
  expect({ nextDate: second?.date, start: second?.startTime }).toEqual({ nextDate: addDays(day, 7), start: '14:00' })

  // Cancelar a série pela tela de detalhes do 1º atendimento
  await page.goto(`/${SEED_SALON_SLUG}/agendamento/${first.id}`)
  await page.getByRole('button', { name: 'Cancelar recorrência' }).click()
  await expect(page.getByText(/inclusive este/)).toBeVisible() // o aviso diz que este também é cancelado
  await page.getByRole('button', { name: 'Cancelar recorrência' }).last().click() // confirmação do modal
  await expect(page.getByText('Recorrência cancelada')).toBeVisible()

  const series = await prisma.recurringAppointment.findUnique({ where: { id: first.recurringAppointmentId } })
  const [firstAfter, secondAfter] = await occurrences()
  expect({ serieAtiva: series.active, este: firstAfter.status, proxima: secondAfter.status })
    .toEqual({ serieAtiva: false, este: 'cancelado', proxima: 'cancelado' }) // regra do dono: cancela este e os próximos
})

test('urgente (outro cliente): horário ocupado é recusado; marcado como urgente, encaixa por cima', async ({ page }) => {
  const salon = await demoSalon()
  const day = testDay(13)
  const tag = `urgente-${Date.now()}`
  // Já existe um atendimento da Ana às 16:00, de OUTRO cliente
  await apiPost(page, salon.id, '/appointment', {
    Client: await createClient(salon.id, 'Maria Ocupando'), Professional: await memberId(salon.id, SEED_USERS.profissional),
    Service: await serviceId(salon.id, 'Escova'), Date: day, Start_time: '16:00', End_time: '17:00',
  })

  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '15:30', ANA)
  await fillClientAndService(drawer, 'Corte Masculino')
  await setItemTimes(drawer, 0, '16:00', '16:30')
  await tagNotes(drawer, tag)

  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText(/Conflito de horário/)).toBeVisible()
  expect(await byTag(tag)).toHaveLength(0)

  await drawer.getByRole('button', { name: /Agendamento urgente/ }).click()
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Agendamento criado!')).toBeVisible()
  const [appt] = await byTag(tag)
  expect({ urgente: appt.isUrgent, start: appt.startTime }).toEqual({ urgente: true, start: '16:00' })
  await expect(page.getByRole('button', { name: /Urgente/ }).filter({ hasText: 'Corte Masculino' })).toBeVisible()
})

// Segunda profissional para os casos com duas pessoas: o Admin Demo, com um serviço próprio e
// expediente no dia do teste (sem expediente a agenda pede "Agendar mesmo assim").
async function prepareAdminAsProfessional(page, salon, day) {
  const admin = await memberId(salon.id, SEED_USERS.owner)
  let service = await prisma.service.findFirst({ where: { salonId: salon.id, name: 'Serviço Admin E2E' } })
  if (!service) {
    const category = (await prisma.category.findFirst({ where: { salonId: salon.id, name: 'Cabelo' } })).id
    const created = await apiPost(page, salon.id, '/service', { Name: 'Serviço Admin E2E', Duration: '00:30:00', Commission: 30, Price: 50, Category: category })
    await prisma.serviceProfessional.create({ data: { serviceId: created.UUID, memberId: admin } })
  }
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  await prisma.workingHours.upsert({
    where: { memberId_weekday: { memberId: admin, weekday } },
    create: { salonId: salon.id, memberId: admin, weekday, startTime: '08:00', endTime: '18:00' },
    update: {},
  })
  return admin
}

test('combinado: duas profissionais no mesmo atendimento viram uma comanda só', async ({ page }) => {
  const salon = await demoSalon()
  const day = testDay(15)
  const tag = `combinado-${Date.now()}`
  await prepareAdminAsProfessional(page, salon, day)

  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '10:00', ANA)
  await fillClientAndService(drawer, 'Corte Feminino')
  await drawer.getByRole('button', { name: 'Adicionar serviço' }).click()
  await pick(drawer.getByRole('button', { name: ANA }).last(), 'Admin Demo', 'Admin')
  await fillClientAndService(drawer, 'Serviço Admin E2E', 1)
  await tagNotes(drawer, tag)
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('2 serviços agendados!')).toBeVisible()

  // Um agendamento por profissional, ligados pelo mesmo grupo
  const appts = await byTag(tag)
  expect(appts).toHaveLength(2)
  expect(appts[0].bookingGroup).toBeTruthy()
  expect(appts[1].bookingGroup).toBe(appts[0].bookingGroup)

  // Concluir um conclui o grupo todo, e os dois caem na MESMA comanda
  await confirmAndConclude(page, appts[0].id)
  await expect.poll(async () => (await byTag(tag)).map(a => a.status)).toEqual(['concluido', 'concluido'])
  const tabs = await prisma.tab.findMany({ where: { bookingGroup: appts[0].bookingGroup }, include: { items: true } })
  expect(tabs).toHaveLength(1)
  expect(tabs[0].items.filter(i => i.itemType === 'service')).toHaveLength(2)
})

test('assistente: comissão dividida entre a profissional e a assistente', async ({ page }) => {
  const salon = await demoSalon()
  const day = testDay(16)
  const tag = `assistente-${Date.now()}`
  const admin = await prepareAdminAsProfessional(page, salon, day)

  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '14:00', ANA)
  await fillClientAndService(drawer, 'Corte Feminino')
  await pick(drawer.getByRole('button', { name: 'Sem assistente' }), 'Admin Demo', 'Admin')
  await drawer.locator('input[type="number"]').fill('20')
  await tagNotes(drawer, tag)
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Agendamento criado!')).toBeVisible()

  const [appt] = await byTag(tag)
  expect(appt.services[0].assistantId).toBe(admin)

  // Conclui e cobra: cada uma recebe a sua comissão
  await confirmAndConclude(page, appt.id)
  await page.getByRole('button', { name: 'Fechar comanda' }).click()
  await page.getByRole('button', { name: /^Fechar conta/ }).click()
  await expect(page.getByText(/^Conta fechada com sucesso/)).toBeVisible()

  const tab = await prisma.tab.findFirst({ where: { appointmentId: appt.id } })
  const txs = await prisma.transaction.findMany({ where: { tabId: tab.id } })
  const ana = await memberId(salon.id, SEED_USERS.profissional)
  expect(txs.some(t => t.professionalId === ana && t.commissionAmount > 0), 'comissão da profissional').toBe(true)
  expect(txs.some(t => t.assistantId === admin && t.commissionAmount > 0), 'comissão da assistente').toBe(true)
})

// Ex. real: coloração 07h-11h + manicure 08h-09h enquanto o produto age — é o mesmo atendimento.
test('urgente (mesmo cliente): o serviço entra no atendimento que já existe', async ({ page }) => {
  const salon = await demoSalon()
  const day = testDay(14)
  const existing = await apiPost(page, salon.id, '/appointment', {
    Client: await memberId(salon.id, SEED_USERS.cliente), Professional: await memberId(salon.id, SEED_USERS.profissional),
    Service: await serviceId(salon.id, 'Escova'), Date: day, Start_time: '16:00', End_time: '17:00',
  })

  await openAgendaOn(page, day)
  const drawer = await openNewAppointment(page, '15:30', ANA)
  await fillClientAndService(drawer, 'Corte Masculino')
  await setItemTimes(drawer, 0, '16:00', '16:30')
  await drawer.getByRole('button', { name: /Agendamento urgente/ }).click()
  await drawer.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Agendamento criado!')).toBeVisible()

  // Nenhum agendamento novo: o atendimento existente virou urgente, com os dois serviços
  const sameDay = await prisma.appointment.findMany({ where: { date: day, salonId: salon.id }, include: { services: true } })
  expect(sameDay).toHaveLength(1)
  expect({ id: sameDay[0].id, urgente: sameDay[0].isUrgent, servicos: sameDay[0].services.length })
    .toEqual({ id: existing.UUID, urgente: true, servicos: 2 })
})
