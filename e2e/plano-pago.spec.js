import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from './support/session.js'
import crypto from 'node:crypto'
import prisma from './support/db.js'
import { E2E_API_URL, E2E_WEBHOOK_SECRET } from '../../backend/e2e/testEnv.js'
import { ABACATEPAY_PUBLIC_KEY } from '../../backend/src/config/abacatepay.js'

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

  const body = JSON.stringify({ id: `evt_${Date.now()}`, event: 'pixQrCode.paid', data: { metadata: { salonId: salon.id, plan: 'business' } } })
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
  expect({ status: after.status, plan: after.plan }).toEqual({ status: 'active', plan: 'business' })
})
