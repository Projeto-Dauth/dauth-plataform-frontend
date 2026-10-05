import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { apiPost, createClient } from './support/demo.js'
import { createBookingSalon, daysFromToday } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Editar os serviços de um agendamento já criado (mesma profissional): Add_services /
// Update_services / Remove_services no PATCH /appointment/:id. Salão próprio por teste.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

const edit = (page, s, id, data) =>
  page.request.patch(`${E2E_API_URL}/api/appointment/${id}`, { headers: { 'x-salon-id': s.salon.id }, data })
const book = (page, s, { client = s.joao, date, start = '09:00', end = '09:30' }) =>
  apiPost(page, s.salon.id, '/appointment', { Client: client, Professional: s.pro.id, Service: s.corte, Date: date, Start_time: start, End_time: end })
async function snapshot(id) {
  const appt = await prisma.appointment.findUnique({ where: { id } })
  const services = await prisma.appointmentService.findMany({ where: { appointmentId: id }, orderBy: { order: 'asc' } })
  return { start: appt.startTime, end: appt.endTime, services: services.map(x => `${x.startTime}-${x.endTime}`), ids: services.map(x => x.id) }
}

test('adicionar, alterar e remover serviço recalcula o horário; o último serviço não sai', async ({ page }) => {
  const s = await createBookingSalon(page)
  const appt = await book(page, s, { date: daysFromToday(3) })

  expect((await edit(page, s, appt.UUID, { Add_services: [{ Service: s.coloracao, Start_time: '09:30', End_time: '10:30' }] })).ok()).toBe(true)
  let now = await snapshot(appt.UUID)
  expect({ start: now.start, end: now.end, services: now.services }).toEqual({ start: '09:00', end: '10:30', services: ['09:00-09:30', '09:30-10:30'] })

  expect((await edit(page, s, appt.UUID, { Update_services: [{ Id: now.ids[1], Service: s.coloracao, Start_time: '10:00', End_time: '11:00' }] })).ok()).toBe(true)
  expect((await snapshot(appt.UUID)).end).toBe('11:00')

  expect((await edit(page, s, appt.UUID, { Remove_services: [now.ids[1]] })).ok()).toBe(true)
  now = await snapshot(appt.UUID)
  expect({ end: now.end, services: now.services }).toEqual({ end: '09:30', services: ['09:00-09:30'] })

  const last = await edit(page, s, appt.UUID, { Remove_services: [now.ids[0]] })
  expect(last.status(), 'o último serviço não pode ser removido').toBe(422)
  expect((await snapshot(appt.UUID)).services).toEqual(['09:00-09:30'])
})

test('adicionar dois serviços, um em conflito com outro agendamento: recusado e nada muda', async ({ page }) => {
  const s = await createBookingSalon(page)
  const date = daysFromToday(4)
  const appt = await book(page, s, { date })
  await book(page, s, { client: await createClient(s.salon.id, `Outro Cliente ${Date.now()}`), date, start: '10:00', end: '10:30' })

  const res = await edit(page, s, appt.UUID, {
    Add_services: [
      { Service: s.corte, Start_time: '09:30', End_time: '10:00' },
      { Service: s.coloracao, Start_time: '10:00', End_time: '11:00' }, // ocupa o horário do outro cliente
    ],
  })
  expect(res.status()).toBe(409)
  const now = await snapshot(appt.UUID)
  expect({ end: now.end, services: now.services }, 'nem o primeiro serviço entra').toEqual({ end: '09:30', services: ['09:00-09:30'] })
})

test('agendamento concluído não tem mais os serviços editados', async ({ page }) => {
  const s = await createBookingSalon(page)
  const appt = await book(page, s, { date: daysFromToday(5) })
  for (const Status of ['confirmado', 'concluido']) await apiPost(page, s.salon.id, `/appointment/${appt.UUID}`, { Status }, 'patch')

  const res = await edit(page, s, appt.UUID, { Add_services: [{ Service: s.coloracao, Start_time: '09:30', End_time: '10:30' }] })
  expect(res.status()).toBe(409)
  expect((await snapshot(appt.UUID)).services).toEqual(['09:00-09:30'])
})

test('cliente não adiciona nem altera serviços do próprio agendamento', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const appt = await book(page, s, { date: daysFromToday(6) })
  const [itemId] = (await snapshot(appt.UUID)).ids

  const joao = await newUserPage(browser)
  await loginAs(joao, SEED_USERS.cliente)
  const asJoao = (data) => joao.request.patch(`${E2E_API_URL}/api/appointment/${appt.UUID}`, { headers: { 'x-salon-id': s.salon.id }, data })

  expect((await asJoao({ Add_services: [{ Service: s.coloracao, Start_time: '09:30', End_time: '10:30' }] })).status(), 'adicionar').toBe(403)
  expect((await asJoao({ Update_services: [{ Id: itemId, Service: s.corte, Start_time: '09:00', End_time: '11:00' }] })).status(), 'alterar').toBe(403)
  expect((await snapshot(appt.UUID)).services).toEqual(['09:00-09:30'])
})
