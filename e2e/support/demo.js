import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'
import { SEED_SALON_SLUG } from '../../../backend/prisma/seedUsers.js'
import prisma from './db.js'

// Atalhos sobre o Salão Demo do seed. Preparação pela API; o que o teste valida vai pela tela.

export async function demoSalon() {
  return prisma.salon.findUnique({ where: { slug: SEED_SALON_SLUG } })
}

export async function memberId(salonId, user) {
  return (await prisma.salonMember.findFirst({ where: { salonId, user: { phone: user.phone } } })).id
}

export async function serviceId(salonId, name) {
  return (await prisma.service.findFirst({ where: { salonId, name, deletedAt: null } })).id
}

// Cliente novo no salão (conta + vínculo 'Usuario'), direto no banco — para testes que precisam
// de outro cliente além do João. Devolve o id do vínculo (SalonMember), que é o "Client" da API.
export async function createClient(salonId, name) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const user = await prisma.user.create({
    data: {
      id: `e2e-${stamp}`, name, email: `cliente.${stamp}@e2e.test`, emailVerified: true,
      platformRole: 'Cliente', active: true, createdAt: new Date(), updatedAt: new Date(),
    },
  })
  return (await prisma.salonMember.create({ data: { salonId, userId: user.id, role: 'Usuario', active: true } })).id
}

// POST pela API do produto como o usuário logado no `page` (precisa ser Admin do salão).
export async function apiPost(page, salonId, path, data, method = 'post') {
  const res = await page.request[method](`${E2E_API_URL}/api${path}`, { headers: { 'x-salon-id': salonId }, data })
  expect(res.ok(), `${method.toUpperCase()} /api${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

// Na tela de detalhes do agendamento: pendente → confirmado → concluído (gera a comanda).
export async function confirmAndConclude(page, appointmentId) {
  await page.goto(`/${SEED_SALON_SLUG}/agendamento/${appointmentId}`)
  for (const status of ['Confirmado', 'Concluído']) {
    await page.getByRole('button', { name: `Marcar como ${status}` }).click()
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  }
}
