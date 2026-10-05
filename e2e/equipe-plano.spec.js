import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { apiPost } from './support/demo.js'
import { createProfessional } from './support/team.js'
import { createClientAccount } from './support/accounts.js'
import { createBookingSalon, daysFromToday } from './support/bookingSalon.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Plano e equipe: limite de profissionais (ativos + convites pendentes), reenviar convite,
// convite pela ficha do cliente e WhatsApp travado no trial. (Conta de serviço: conta-servico.spec.js)
// Salão próprio por teste.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const invite = (page, salonId, name = `Convidada ${stamp()}`) => page.request.post(`${E2E_API_URL}/api/v1/salon/invite-professional`, {
  headers: { 'x-salon-id': salonId }, data: { name, email: `convite.${stamp()}@e2e.test` },
})
const pendingInvites = (salonId) => prisma.salonInvitation.count({ where: { salonId, status: 'pending' } })

test('trial: 3 vagas contando convites pendentes; cancelar um convite libera a vaga', async ({ page }) => {
  const salon = await createSalon(page)
  await createProfessional(salon.id)
  await createProfessional(salon.id)
  const name = `Convidada ${stamp()}`
  expect((await invite(page, salon.id, name)).ok()).toBe(true) // 3ª vaga: convite pendente

  await page.goto(`/${salon.slug}/admin/convidar-profissional`)
  await expect(page.getByText('Trial · 3/3 profissionais')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Limite de profissionais atingido' })).toBeDisabled()
  const blocked = await invite(page, salon.id)
  expect(blocked.status(), '4ª pessoa').toBe(403)
  expect((await blocked.json()).error).toMatch(/Limite de profissionais do trial atingido \(3\)/)

  const row = page.locator('div').filter({ hasText: name }).filter({ has: page.getByRole('button', { name: 'Reenviar' }) }).last()
  await row.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar convite' }).click() // confirmação (a linha troca os botões)
  await expect(page.getByText('Convite cancelado')).toBeVisible()
  await expect(page.getByText('Trial · 2/3 profissionais')).toBeVisible()
  expect((await invite(page, salon.id)).ok(), 'vaga liberada').toBe(true)
})

test('plano Essencial também tem 3 vagas; Profissional tem mais', async ({ page }) => {
  const salon = await createSalon(page)
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', plan: 'essencial', trialEndsAt: null } })
  for (let i = 0; i < 3; i++) await createProfessional(salon.id)

  const blocked = await invite(page, salon.id)
  expect(blocked.status()).toBe(403)
  expect((await blocked.json()).error).toMatch(/Limite de profissionais do plano atingido \(3\)/)

  await prisma.salon.update({ where: { id: salon.id }, data: { plan: 'profissional' } })
  expect((await invite(page, salon.id)).ok(), 'Profissional: até 8').toBe(true)
})

test('dois convites ao mesmo tempo com uma vaga só: só um entra', async ({ page }) => {
  const salon = await createSalon(page)
  await createProfessional(salon.id)
  await createProfessional(salon.id) // sobra 1 vaga

  const results = await Promise.all([invite(page, salon.id), invite(page, salon.id)])
  expect(results.filter(r => r.ok()).length).toBe(1)
  expect(await pendingInvites(salon.id)).toBe(1)
})

test('reenviar gera link novo e o antigo deixa de valer; convidar de novo a mesma pessoa reenvia', async ({ page }) => {
  const salon = await createSalon(page)
  const email = `convite.${stamp()}@e2e.test`
  const send = () => page.request.post(`${E2E_API_URL}/api/v1/salon/invite-professional`, { headers: { 'x-salon-id': salon.id }, data: { name: 'Bruna E2E', email } })
  const byToken = (token) => page.request.get(`${E2E_API_URL}/api/v1/invitations/${token}`)

  expect((await send()).ok()).toBe(true)
  const first = await prisma.salonInvitation.findFirst({ where: { email } })

  await page.goto(`/${salon.slug}/admin/convidar-profissional`)
  await page.locator('div').filter({ hasText: 'Bruna E2E' }).filter({ has: page.getByRole('button', { name: 'Reenviar' }) }).last()
    .getByRole('button', { name: 'Reenviar' }).click()
  await expect(page.getByText('Convite reenviado')).toBeVisible()

  const second = await prisma.salonInvitation.findFirst({ where: { email } })
  expect(second.token).not.toBe(first.token)
  expect((await byToken(first.token)).status(), 'link antigo').toBe(404)
  expect((await byToken(second.token)).ok()).toBe(true)

  const again = await send()
  expect(again.status()).toBe(200)
  expect((await again.json()).resent).toBe(true)
  expect(await pendingInvites(salon.id), 'continua um convite só').toBe(1)
})

test('convite pela ficha do cliente: ao aceitar, o mesmo cadastro vira profissional e o histórico fica', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const account = await createClientAccount(page)
  const user = await prisma.user.findFirst({ where: { phone: account.phone } })
  const member = await prisma.salonMember.create({ data: { salonId: s.salon.id, userId: user.id, role: 'Usuario', active: true } })
  const appt = await apiPost(page, s.salon.id, '/appointment', {
    Client: member.id, Professional: s.pro.id, Service: s.corte, Date: daysFromToday(2), Start_time: '09:00', End_time: '09:30',
  })

  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon/members/${member.id}/invite`, { headers: { 'x-salon-id': s.salon.id } })
  expect(res.ok(), await res.text()).toBe(true)

  const client = await newUserPage(browser)
  await loginAs(client, account)
  await client.goto('/marketplace')
  await client.getByRole('button', { name: 'Aceitar' }).click()
  await expect(client).toHaveURL(/\/meus-empregos$/) // agora é da equipe: vai para Meus empregos
  await expect(client.getByText(s.salon.name)).toBeVisible()

  const after = await prisma.salonMember.findUnique({ where: { id: member.id } })
  expect({ role: after.role, active: after.active }).toEqual({ role: 'Profissional', active: true })
  expect(await prisma.salonMember.count({ where: { salonId: s.salon.id, userId: user.id } }), 'nenhum cadastro novo').toBe(1)
  expect((await prisma.appointment.findUnique({ where: { id: appt.UUID } })).clientId, 'o atendimento continua dela').toBe(member.id)
})

test('trial: WhatsApp do salão fica travado na tela e na API', async ({ page }) => {
  const salon = await createSalon(page)

  await page.goto(`/${salon.slug}/admin/configuracoes`)
  await page.getByRole('tab', { name: 'WhatsApp' }).click()
  await expect(page.getByText('Disponível a partir do plano Profissional')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conectar WhatsApp' })).toHaveCount(0)

  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon/whatsapp-instance`, { headers: { 'x-salon-id': salon.id } })
  expect(res.status()).toBe(403)
  expect((await prisma.salon.findUnique({ where: { id: salon.id } })).evolutionInstanceName).toBeNull()
})
