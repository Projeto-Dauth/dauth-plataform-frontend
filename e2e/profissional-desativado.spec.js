import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { apiPost } from './support/demo.js'
import { paidAttendance } from './support/team.js'
import { createBookingSalon, availability, daysFromToday } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Remover profissional (Admin): ele fica desativado — some da agenda, das listas, dos serviços e do
// agendamento online; os agendamentos futuros dele são cancelados. O histórico (atendimento concluído,
// comissão) continua. Salão próprio por teste.
test('remover profissional desativa tudo dele e preserva o histórico', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const s = await createBookingSalon(page)
  const headers = { 'x-salon-id': s.salon.id }
  const get = (path, params) => page.request.get(`${E2E_API_URL}/api${path}`, { headers, params })
  const professionalIds = async () => (await (await get('/users', { Role: 'Profissional' })).json()).data.map(u => u.UUID)
  const serviceProfessionalIds = async () => (await (await get(`/public/services/${s.corte}/professionals`)).json()).data.map(p => p.professional_id)
  const bookableServices = async () => (await (await get('/public/services', { has_professionals: true })).json()).data.map(x => x.Name)
  const day = daysFromToday(3)

  // Histórico: um atendimento já concluído e pago, e um agendamento futuro ainda em aberto
  const done = await paidAttendance(page, s.salon, { professional: s.pro.id, service: 'Corte E2E', day: daysFromToday(1) })
  const future = await apiPost(page, s.salon.id, '/appointment', {
    Client: s.joao, Professional: s.pro.id, Service: s.corte, Date: daysFromToday(2), Start_time: '09:00', End_time: '09:30',
  })

  // Antes: aparece em todo lugar
  expect(await professionalIds()).toContain(s.pro.id)
  expect(await serviceProfessionalIds()).toContain(s.pro.id)
  expect(await bookableServices()).toContain('Corte E2E')
  expect((await availability(page, { pro: s.pro.id, service: s.corte, date: day })).data.length).toBeGreaterThan(0)
  await page.goto(`/${s.salon.slug}/admin`)
  await expect(page.getByText(s.pro.name).first(), 'coluna da profissional na agenda').toBeVisible()

  // Admin remove a profissional
  const removed = await page.request.delete(`${E2E_API_URL}/api/v1/salon/members/${s.pro.id}`, { headers })
  expect(removed.ok(), await removed.text()).toBeTruthy()
  expect((await removed.json()).cancelledAppointments, 'só o agendamento futuro em aberto é cancelado').toBe(1)

  // Depois: desativada
  expect(await professionalIds()).not.toContain(s.pro.id)
  expect(await serviceProfessionalIds()).not.toContain(s.pro.id)
  expect(await bookableServices(), 'sem profissional ativa, o serviço sai do agendamento online').not.toContain('Corte E2E')
  const slots = await availability(page, { pro: s.pro.id, service: s.corte, date: day })
  expect(slots.data).toEqual([])
  expect(slots.message).toBe('Profissional indisponível.')
  await page.reload()
  await expect(page.getByText(s.pro.name)).toHaveCount(0)

  // Não dá mais para agendar com ela nem ligá-la a um serviço
  const booking = await page.request.post(`${E2E_API_URL}/api/appointment`, { headers, data: {
    Client: s.joao, Professional: s.pro.id, Service: s.corte, Date: day, Start_time: '09:00', End_time: '09:30',
  } })
  expect(booking.status()).toBe(422)
  expect(JSON.stringify(await booking.json())).toContain('desativado')
  const link = await page.request.post(`${E2E_API_URL}/api/service/${s.coloracao}/professionals`, { headers, data: { Professional_id: s.pro.id } })
  expect(link.status()).toBe(422)

  // O agendamento futuro foi cancelado; o histórico continua
  expect((await prisma.appointment.findUnique({ where: { id: future.UUID } })).status).toBe('cancelado')
  expect((await prisma.appointment.findUnique({ where: { id: done.appointmentId } })).status).toBe('concluido')
  const commissions = await (await get('/transaction/all-commissions', { professional_id: s.pro.id })).json()
  expect(commissions.data.map(r => r.uuid), 'a comissão do que ela já fez continua para o Admin').toContain(done.tx.id)
  const member = await prisma.salonMember.findUnique({ where: { id: s.pro.id } })
  expect(member.active).toBe(false)
})

test('remover cliente não cancela nada e só profissional tem agendamentos cancelados', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const s = await createBookingSalon(page)
  const headers = { 'x-salon-id': s.salon.id }
  const future = await apiPost(page, s.salon.id, '/appointment', {
    Client: s.joao, Professional: s.pro.id, Service: s.corte, Date: daysFromToday(2), Start_time: '09:00', End_time: '09:30',
  })

  const removed = await page.request.delete(`${E2E_API_URL}/api/v1/salon/members/${s.joao}`, { headers })
  expect(removed.ok(), await removed.text()).toBeTruthy()
  expect((await removed.json()).cancelledAppointments).toBe(0)
  expect((await prisma.appointment.findUnique({ where: { id: future.UUID } })).status, 'o cliente some, o agendamento fica').not.toBe('cancelado')
})
