import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, memberId, apiPost } from './support/demo.js'
import prisma from './support/db.js'

// Data (AAAA-MM-DD) e hora (HH:MM) de um instante, no fuso do salão
function inSalonTz(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// Fluxo: o cliente cancela pelo app um agendamento que começa daqui a 1 hora. Não existe multa por
// cancelamento (decisão do dono, 2026-10-04): nada é cobrado, nenhuma comanda é criada, e a tela não
// fala em cobrança. Serviço próprio do teste, para achar o agendamento no painel do cliente.
test('cliente cancela em cima da hora sem nenhuma cobrança', async ({ page, browser }) => {
  const salon = await demoSalon()
  const ana = await memberId(salon.id, SEED_USERS.profissional)
  await loginAs(page, SEED_USERS.owner)

  const category = (await prisma.category.findFirst({ where: { salonId: salon.id, name: 'Cabelo' } })).id
  const service = await apiPost(page, salon.id, '/service', { Name: 'Serviço Cancelamento E2E', Duration: '00:15:00', Commission: 40, Price: 80, Category: category })
  await prisma.serviceProfessional.create({ data: { serviceId: service.UUID, memberId: ana } })

  const start = inSalonTz(new Date(Date.now() + 60 * 60_000)) // daqui a 1 hora (< 3h)
  const end = inSalonTz(new Date(Date.now() + 75 * 60_000))
  const appointment = await apiPost(page, salon.id, '/appointment', {
    Client: await memberId(salon.id, SEED_USERS.cliente), Professional: ana, Service: service.UUID,
    Date: start.date, Start_time: start.time, End_time: end.date === start.date ? end.time : '23:59', Status: 'confirmado',
  })

  // O cliente cancela pelo painel dele
  const joao = await newUserPage(browser)
  await loginAs(joao, SEED_USERS.cliente)
  await joao.goto(`/${SEED_SALON_SLUG}/cliente`)
  await expect(joao.getByText('Serviço Cancelamento E2E').first()).toBeVisible() // é o próximo atendimento
  await joao.getByRole('button', { name: 'Ver detalhes' }).click()
  await joao.getByRole('button', { name: 'Cancelar agendamento' }).click()
  await expect(joao.getByText(/cobrança/i)).toHaveCount(0) // nenhum aviso de cobrança
  await joao.getByRole('button', { name: 'Confirmar cancelamento' }).click()

  await expect.poll(async () => (await prisma.appointment.findUnique({ where: { id: appointment.UUID } })).status).toBe('cancelado')
  expect(await prisma.tab.count({ where: { appointmentId: appointment.UUID } }), 'nenhuma comanda de cobrança').toBe(0)
})
