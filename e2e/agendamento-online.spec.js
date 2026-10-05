import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { createBookingSalon, setSettings, availability, daysFromToday } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Regras do agendamento online (Configurações → Agendamento) e o que o cliente pode marcar.
// Cada teste tem um salão próprio: profissional 08:00–18:00 todos os dias, intervalo 12:00–13:00.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

// João (cliente) marca pela API do produto, como faz a página /agendar
async function clientBooking(browser, s, { date, start, end, service = s.corte, Status }) {
  const joao = await newUserPage(browser)
  await loginAs(joao, SEED_USERS.cliente)
  return joao.request.post(`${E2E_API_URL}/api/appointment`, {
    headers: { 'x-salon-id': s.salon.id },
    data: { Client: s.joao, Professional: s.pro.id, Service: service, Date: date, Start_time: start, End_time: end, ...(Status ? { Status } : {}) },
  })
}

test('intervalo entre horários e antecedência mínima definem os horários oferecidos', async ({ page }) => {
  const s = await createBookingSalon(page, { bookingSlotMinutes: 60 })
  const date = daysFromToday(3)

  const { data } = await availability(page, { pro: s.pro.id, service: s.corte, date })
  expect(data.map(x => x.start_time.slice(0, 5)), 'de hora em hora, pulando o intervalo')
    .toEqual(['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'])

  await setSettings(page, s.salon.id, { bookingMinAdvanceMinutes: 7 * 1440 }) // 7 dias de antecedência
  expect((await availability(page, { pro: s.pro.id, service: s.corte, date })).data, 'daqui a 3 dias: cedo demais').toEqual([])
  expect((await availability(page, { pro: s.pro.id, service: s.corte, date: daysFromToday(8) })).data.length).toBeGreaterThan(0)
})

test('limite de dias à frente vale no link público e na hora de marcar', async ({ page, browser }) => {
  const s = await createBookingSalon(page, { bookingMaxDaysAhead: 10 })

  const far = await availability(page, { pro: s.pro.id, service: s.corte, date: daysFromToday(12) })
  expect(far).toEqual({ data: [], message: 'Agendamentos só podem ser feitos com até 10 dias de antecedência.' })

  expect((await clientBooking(browser, s, { date: daysFromToday(12), start: '09:00', end: '09:30' })).status()).toBe(422)
  expect((await clientBooking(browser, s, { date: daysFromToday(5), start: '09:00', end: '09:30' })).status()).toBe(201)
})

test('confirmação automática: quem decide o status é o salão, não o cliente', async ({ page, browser }) => {
  const s = await createBookingSalon(page, { bookingAutoConfirm: false })
  const statusOf = async (res) => (await prisma.appointment.findUnique({ where: { id: (await res.json()).UUID } })).status

  const sneaky = await clientBooking(browser, s, { date: daysFromToday(4), start: '09:00', end: '09:30', Status: 'confirmado' })
  expect(sneaky.status()).toBe(201)
  expect(await statusOf(sneaky), 'cliente mandou "confirmado", mas o salão confirma à mão').toBe('pendente')

  await setSettings(page, s.salon.id, { bookingAutoConfirm: true })
  const auto = await clientBooking(browser, s, { date: daysFromToday(4), start: '10:00', end: '10:30', Status: 'pendente' })
  expect(await statusOf(auto)).toBe('confirmado')
})

test('folga e dia sem expediente não aparecem no link público', async ({ page }) => {
  const s = await createBookingSalon(page)
  const [allDay, partial, off] = [daysFromToday(3), daysFromToday(4), daysFromToday(5)]
  await prisma.professionalLeave.createMany({
    data: [
      { salonId: s.salon.id, memberId: s.pro.id, startDate: allDay, endDate: allDay, allDay: true },
      { salonId: s.salon.id, memberId: s.pro.id, startDate: partial, endDate: partial, allDay: false, leaveStartTime: '14:00', leaveEndTime: '16:00' },
    ],
  })
  await prisma.workingHours.deleteMany({ where: { memberId: s.pro.id, weekday: new Date(`${off}T12:00:00Z`).getUTCDay() } })

  expect(await availability(page, { pro: s.pro.id, service: s.corte, date: allDay })).toEqual({ data: [], message: 'Profissional está de folga neste dia.' })
  const starts = (await availability(page, { pro: s.pro.id, service: s.corte, date: partial })).data.map(x => x.start_time.slice(0, 5))
  expect(starts).toContain('13:30')
  expect(starts.filter(t => t >= '14:00' && t < '16:00'), 'nada durante a folga parcial').toEqual([])
  expect(starts).toContain('16:00')
  expect(await availability(page, { pro: s.pro.id, service: s.corte, date: off })).toEqual({ data: [], message: 'Profissional não trabalha neste dia.' })
})

test('cliente não marca fora das regras: expediente, intervalo, folga, serviço que a profissional não faz, duração errada', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const date = daysFromToday(6)
  await prisma.professionalLeave.create({
    data: { salonId: s.salon.id, memberId: s.pro.id, startDate: date, endDate: date, allDay: false, leaveStartTime: '15:00', leaveEndTime: '16:00' },
  })

  const cases = [
    ['fora do expediente', { start: '18:30', end: '19:00' }, 422],
    ['no intervalo', { start: '12:00', end: '12:30' }, 422],
    ['na folga', { start: '15:00', end: '15:30' }, 409],
    ['serviço que a profissional não faz', { start: '09:00', end: '10:00', service: s.coloracao }, 422],
    ['duração menor que a do serviço (Corte = 30 min)', { start: '09:00', end: '09:10' }, 422],
  ]
  for (const [name, booking, status] of cases) {
    expect((await clientBooking(browser, s, { date, ...booking })).status(), name).toBe(status)
  }
  expect(await prisma.appointment.count({ where: { salonId: s.salon.id } }), 'nenhum agendamento criado').toBe(0)
})
