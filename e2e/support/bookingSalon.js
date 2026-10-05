import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'
import { SEED_USERS } from '../../../backend/prisma/seedUsers.js'
import { createSalon } from './salon.js'
import { createProfessional } from './team.js'
import prisma from './db.js'

// Salão próprio do teste (configuração não pode mudar no Salão Demo), já pronto para agendar:
// - profissional com expediente todos os dias, 08:00–18:00, intervalo 12:00–13:00;
// - "Corte E2E" (30 min, R$ 50), que ela faz; "Coloração E2E" (60 min, R$ 120), que ela NÃO faz;
// - João (cliente do seed) como cliente do salão.
// `page` precisa estar logado como o dono (SalonOwner).
export async function createBookingSalon(page, settings = {}) {
  const salon = await createSalon(page)
  const pro = await createProfessional(salon.id, `Profissional Agenda ${Date.now()}`)
  await prisma.workingHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ salonId: salon.id, memberId: pro.id, weekday, startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' })),
  })
  const category = await prisma.category.create({ data: { salonId: salon.id, name: 'Cabelo' } })
  const corte = await prisma.service.create({ data: { salonId: salon.id, name: 'Corte E2E', duration: 30, price: 50, commission: 40, categoryId: category.id } })
  const coloracao = await prisma.service.create({ data: { salonId: salon.id, name: 'Coloração E2E', duration: 60, price: 120, commission: 40, categoryId: category.id } })
  await prisma.serviceProfessional.create({ data: { serviceId: corte.id, memberId: pro.id } })

  const joaoUser = await prisma.user.findFirst({ where: { phone: SEED_USERS.cliente.phone } })
  const joao = await prisma.salonMember.create({ data: { salonId: salon.id, userId: joaoUser.id, role: 'Usuario', active: true } })

  if (Object.keys(settings).length) await setSettings(page, salon.id, settings)
  return { salon, pro, corte: corte.id, coloracao: coloracao.id, joao: joao.id }
}

// Configurações do salão (mesmo endpoint da tela de Configurações).
export async function setSettings(page, salonId, settings) {
  const res = await page.request.patch(`${E2E_API_URL}/api/v1/salon/config`, { headers: { 'x-salon-id': salonId }, data: settings })
  expect(res.ok(), `salvar configurações: ${await res.text()}`).toBeTruthy()
}

// Horários livres do link público para o dia.
export async function availability(page, { pro, service, date }) {
  const res = await page.request.get(`${E2E_API_URL}/api/public/availability/${pro}`, { params: { date, service_id: service } })
  expect(res.ok(), `disponibilidade: ${await res.text()}`).toBeTruthy()
  return res.json() // { data: [{ start_time, end_time }], message? }
}

// Hoje + N dias, no fuso do salão (America/Sao_Paulo), AAAA-MM-DD.
export function daysFromToday(n) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
