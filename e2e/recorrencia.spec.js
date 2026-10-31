import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createBookingSalon, daysFromToday } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Próxima ocorrência de uma série recorrente (2026-10-31, opção A do dono): se a data cai num dia em que a profissional
// não atende, está de folga ou o horário está ocupado, vai para o próximo dia possível no mesmo horário e os Admins
// são avisados. A data-base da série não anda junto, e cancelar uma ocorrência não interrompe a série.
// Salão de teste: profissional atende todos os dias, 08:00–18:00.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay()

// O Admin cria (pode agendar fora do expediente). Devolve o id do 1º agendamento.
async function book(page, s, date, extra = {}) {
  const res = await page.request.post(`${E2E_API_URL}/api/appointment`, {
    headers: { 'x-salon-id': s.salon.id },
    data: { Client: s.joao, Professional: s.pro.id, Service: s.corte, Date: date, Start_time: '09:00', End_time: '09:30', ...extra },
  })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).UUID
}

async function seriesOf(firstId) {
  const { recurringAppointmentId } = await prisma.appointment.findUnique({ where: { id: firstId } })
  const rows = await prisma.appointment.findMany({ where: { recurringAppointmentId }, orderBy: { date: 'asc' } })
  return rows.map(a => `${a.date} ${a.status}`)
}

const adminNotices = (s, action) => prisma.notification.findMany({ where: { salonId: s.salon.id, action } })

const cancel = (page, s, id) => page.request.patch(`${E2E_API_URL}/api/appointment/${id}`, { headers: { 'x-salon-id': s.salon.id }, data: { Status: 'cancelado' } })

test('dia em que a profissional não atende: a ocorrência vai para o próximo dia em que ela atende', async ({ page }) => {
  const s = await createBookingSalon(page, { bookingAutoConfirm: false })
  const first = daysFromToday(3)
  await prisma.workingHours.deleteMany({ where: { memberId: s.pro.id, weekday: weekdayOf(first) } })

  const id = await book(page, s, first, { Recurring: true, Frequency: 'semanal' })
  expect(await seriesOf(id)).toEqual([`${first} pendente`, `${daysFromToday(11)} pendente`]) // +7 não atende → +8
  expect(await adminNotices(s, 'recurring_moved')).toHaveLength(1)
})

test('folga: a ocorrência é remarcada, e a seguinte volta para a data da série (não anda junto)', async ({ page }) => {
  const s = await createBookingSalon(page, { bookingAutoConfirm: false })
  const first = daysFromToday(3)
  await prisma.professionalLeave.create({ data: { salonId: s.salon.id, memberId: s.pro.id, startDate: daysFromToday(10), endDate: daysFromToday(10), allDay: true } })

  const id = await book(page, s, first, { Recurring: true, Frequency: 'semanal' })
  expect(await seriesOf(id)).toEqual([`${first} pendente`, `${daysFromToday(11)} pendente`])

  // Fechar a 1ª gera a próxima: +14 (data-base da série), não +15 (a remarcada + 7)
  expect((await cancel(page, s, id)).ok()).toBe(true)
  await expect.poll(() => seriesOf(id)).toEqual([`${first} cancelado`, `${daysFromToday(11)} pendente`, `${daysFromToday(17)} pendente`])
})

test('horário já ocupado: a ocorrência vai para o próximo dia livre', async ({ page }) => {
  const s = await createBookingSalon(page, { bookingAutoConfirm: false })
  await book(page, s, daysFromToday(10)) // avulso, mesmo horário, na data da 2ª ocorrência

  const id = await book(page, s, daysFromToday(3), { Recurring: true, Frequency: 'semanal' })
  expect(await seriesOf(id)).toEqual([`${daysFromToday(3)} pendente`, `${daysFromToday(11)} pendente`])
})

test('sem nenhum dia possível até a data seguinte: pula o período, avisa os Admins e a série continua', async ({ page }) => {
  const s = await createBookingSalon(page, { bookingAutoConfirm: false })
  await prisma.professionalLeave.create({ data: { salonId: s.salon.id, memberId: s.pro.id, startDate: daysFromToday(10), endDate: daysFromToday(16), allDay: true } })

  const id = await book(page, s, daysFromToday(3), { Recurring: true, Frequency: 'semanal' })
  expect(await seriesOf(id)).toEqual([`${daysFromToday(3)} pendente`, `${daysFromToday(17)} pendente`])
  expect(await adminNotices(s, 'recurring_skipped')).toHaveLength(1)
})

test('cancelar só a próxima ocorrência não interrompe a série', async ({ page }) => {
  const s = await createBookingSalon(page, { bookingAutoConfirm: false })
  const id = await book(page, s, daysFromToday(3), { Recurring: true, Frequency: 'semanal' })
  const { recurringAppointmentId } = await prisma.appointment.findUnique({ where: { id } })
  const next = await prisma.appointment.findFirst({ where: { recurringAppointmentId, date: daysFromToday(10) } })

  expect((await cancel(page, s, next.id)).ok()).toBe(true)
  await expect.poll(() => seriesOf(id)).toEqual([`${daysFromToday(3)} pendente`, `${daysFromToday(10)} cancelado`, `${daysFromToday(17)} pendente`])
})
