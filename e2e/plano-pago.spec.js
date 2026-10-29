import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from './support/session.js'
import crypto from 'node:crypto'
import prisma from './support/db.js'
import { E2E_API_URL, E2E_WEBHOOK_SECRET } from '../../backend/e2e/testEnv.js'
import { ABACATEPAY_PUBLIC_KEY } from '../../backend/src/config/abacatepay.js'
import { createCharge, sendPaidWebhook } from './support/billing.js'

// Fluxo: dono cria salão escolhendo um plano pago → o pagamento PIX abre na hora (sem trial) →
// pagamento confirmado → salão ativo no plano e o dono entra no painel.
// A AbacatePay é a falsa do servidor de teste (backend/e2e/fakeAbacatePay.js).
test('criar salão com plano pago abre o PIX e, pago, ativa o salão', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const name = `Salão Pago E2E ${Date.now()}`

  await page.goto('/criar-salao')
  await page.getByPlaceholder('Ex: Salão Bela Arte').fill(name)
  await page.getByRole('button', { name: /^Essencial/ }).click()
  await page.getByRole('button', { name: 'Criar salão e pagar' }).click()

  await expect(page.getByAltText('QR Code PIX')).toBeVisible()
  const salon = await prisma.salon.findFirst({ where: { name } })
  expect(salon.status, 'antes de pagar o salão não entra em trial').toBe('pending_payment')

  await page.getByRole('button', { name: '[dev] Simular pagamento' }).click()
  await expect(page).toHaveURL(new RegExp(`/${salon.slug}/admin$`))
  await expect(page.getByText('Pagamento confirmado! Salão ativado.')).toBeVisible()

  const paid = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect({ status: paid.status, plan: paid.plan }).toEqual({ status: 'active', plan: 'essencial' })
})

// Criar o salão escolhendo o plano semestral: o PIX sai com o total do semestral e libera 180 dias.
test('criar salão no plano semestral cobra o total com desconto e libera 180 dias', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const name = `Salão Semestral E2E ${Date.now()}`

  await page.goto('/criar-salao')
  await page.getByPlaceholder('Ex: Salão Bela Arte').fill(name)
  await page.getByRole('button', { name: /^Essencial/ }).click()
  await page.getByRole('radio', { name: /Semestral/ }).click()
  await expect(page.getByText(/R\$ 407,40/)).toBeVisible()
  await page.getByRole('button', { name: 'Criar salão e pagar' }).click()
  await expect(page.getByAltText('QR Code PIX')).toBeVisible()
  await expect(page.getByText(/Não há reembolso/).first()).toBeVisible()
  await page.getByRole('button', { name: '[dev] Simular pagamento' }).click()
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible()

  const salon = await prisma.salon.findFirst({ where: { name } })
  expect({ status: salon.status, plan: salon.plan, billingMonths: salon.billingMonths }).toEqual({ status: 'active', plan: 'essencial', billingMonths: 6 })
  const days = (salon.planEndsAt.getTime() - Date.now()) / 86_400_000
  expect(days).toBeGreaterThan(179.9)
  expect(days).toBeLessThanOrEqual(180)
  const payment = await prisma.payment.findFirst({ where: { salonId: salon.id, status: 'paid' } })
  expect({ amountCents: payment.amountCents, months: payment.months }).toEqual({ amountCents: 40740, months: 6 })
})

// Fechar o PIX sem pagar: o salão fica aguardando pagamento e qualquer página dele vira a tela única
// de planos (mesma do trial encerrado), com o plano escolhido na criação já selecionado.
test('fechar o PIX sem pagar leva à tela de concluir pagamento; pago, o painel abre', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const name = `Salão Pendente E2E ${Date.now()}`

  await page.goto('/criar-salao')
  await page.getByPlaceholder('Ex: Salão Bela Arte').fill(name)
  await page.getByRole('button', { name: /^Profissional/ }).click()
  await page.getByRole('button', { name: 'Criar salão e pagar' }).click()
  await expect(page.getByAltText('QR Code PIX')).toBeVisible()
  await page.getByRole('button', { name: 'Fechar' }).click()

  const salon = await prisma.salon.findFirst({ where: { name } })
  await expect(page.getByRole('heading', { name: 'Conclua o pagamento para ativar seu salão' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar com Profissional' })).toBeVisible() // plano da criação
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toHaveCount(0)

  // Voltando depois pelo endereço do salão, a mesma tela
  await page.goto(`/${salon.slug}/admin`)
  await expect(page.getByRole('heading', { name: 'Conclua o pagamento para ativar seu salão' })).toBeVisible()

  await page.getByRole('button', { name: 'Continuar com Profissional' }).click()
  await page.getByRole('button', { name: '[dev] Simular pagamento' }).click()
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible()
  const paid = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect({ status: paid.status, plan: paid.plan }).toEqual({ status: 'active', plan: 'profissional' })
})

// Webhook do AbacatePay ativa salão: só vale com o segredo da URL E a assinatura HMAC do AbacatePay.
// Antes, qualquer POST com { event: 'pixQrCode.paid', metadata.salonId } ativava qualquer salão de graça.
test('webhook do AbacatePay: falsificado é recusado; com segredo e assinatura certos ativa o salão', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon`, { data: { name: `Salão Webhook ${Date.now()}`, plan: 'profissional' } })
  const salon = await res.json()
  expect(salon.status).toBe('pending_payment')

  const { body: charge } = await createCharge(page, salon.id, 'profissional')
  const body = JSON.stringify({ id: `evt_${Date.now()}`, event: 'transparent.completed', data: { id: charge.id, metadata: { paymentId: charge.paymentId } } })
  const signature = crypto.createHmac('sha256', ABACATEPAY_PUBLIC_KEY).update(body).digest('base64')
  const send = (query, headers = {}) => page.request.post(`${E2E_API_URL}/api/v1/webhooks/abacatepay${query}`, {
    headers: { 'content-type': 'application/json', ...headers }, data: body,
  })
  const statusOf = async () => (await prisma.salon.findUnique({ where: { id: salon.id } })).status

  expect((await send('')).status(), 'sem segredo').toBe(401)
  expect((await send('?webhookSecret=chute')).status(), 'segredo errado').toBe(401)
  expect((await send(`?webhookSecret=${E2E_WEBHOOK_SECRET}`, { 'x-webhook-signature': 'falsa' })).status(), 'assinatura falsa').toBe(401)
  expect(await statusOf(), 'nada ativou').toBe('pending_payment')

  expect((await send(`?webhookSecret=${E2E_WEBHOOK_SECRET}`, { 'x-webhook-signature': signature })).ok()).toBe(true)
  const after = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect({ status: after.status, plan: after.plan }).toEqual({ status: 'active', plan: 'profissional' })
  expect(after.planEndsAt, 'primeiro pagamento libera 30 dias').not.toBeNull()
})

// Reenvio do mesmo evento (o AbacatePay reenvia) não paga nem estende nada duas vezes.
test('webhook do AbacatePay: o mesmo evento reenviado não estende a assinatura', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon`, { data: { name: `Salão Replay ${Date.now()}`, plan: 'essencial' } })
  const salon = await res.json()
  const { body: charge } = await createCharge(page, salon.id, 'essencial')

  expect((await sendPaidWebhook(page, charge)).ok()).toBe(true)
  const first = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect(first.status).toBe('active')

  expect((await sendPaidWebhook(page, charge)).ok(), 'reenvio é aceito sem erro').toBe(true)
  const second = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect(second.planEndsAt.getTime(), 'vencimento não muda').toBe(first.planEndsAt.getTime())
  expect(await prisma.payment.count({ where: { salonId: salon.id, status: 'paid' } })).toBe(1)
})
