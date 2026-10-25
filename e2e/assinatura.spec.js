import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import { createCharge, sendPaidWebhook } from './support/billing.js'
import prisma from './support/db.js'

const DAY = 86_400_000
const inDays = (n) => new Date(Date.now() + n * DAY)

// Salão do teste, já pago no plano e com o vencimento em `days` dias (preparado direto no banco).
async function paidSalon(page, { plan = 'essencial', days = 20 } = {}) {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', plan, planEndsAt: inDays(days), trialEndsAt: null } })
  return salon
}
const salonOf = (id) => prisma.salon.findUnique({ where: { id } })

test('dá para pagar a próxima mensalidade a qualquer momento; pedir de novo devolve o mesmo PIX', async ({ page }) => {
  const salon = await paidSalon(page, { days: 20 })
  const { status, body } = await createCharge(page, salon.id, 'essencial')
  expect(status, 'antes dos 7 dias também vale').toBe(200)
  expect(body.kind).toBe('renewal')
  expect(body.amount).toBe(7990)

  const again = await createCharge(page, salon.id, 'essencial')
  expect(again.body.paymentId, 'pedir de novo devolve o mesmo PIX').toBe(body.paymentId)
  expect(again.body.reused).toBe(true)
})

test('mensalidades sucessivas: cada pagamento soma 30 dias e o limite de adiantamento vale', async ({ page }) => {
  const salon = await paidSalon(page, { days: 20 })
  const start = (await salonOf(salon.id)).planEndsAt.getTime()
  for (let i = 1; i <= 3; i++) {
    const { status, body } = await createCharge(page, salon.id, 'essencial')
    expect(status, `mensalidade ${i}`).toBe(200)
    expect((await sendPaidWebhook(page, body)).ok()).toBe(true)
    expect((await salonOf(salon.id)).planEndsAt.getTime()).toBe(start + i * 30 * DAY)
  }
  expect(await prisma.payment.count({ where: { salonId: salon.id, status: 'paid' } })).toBe(3)

  await prisma.salon.update({ where: { id: salon.id }, data: { planEndsAt: inDays(340) } })
  expect((await createCharge(page, salon.id, 'essencial')).status, 'passou do limite de adiantamento').toBe(400)
})

test('com mensalidades adiantadas (mais de 30 dias sobrando) o upgrade espera', async ({ page }) => {
  const salon = await paidSalon(page, { days: 60 })
  const up = await createCharge(page, salon.id, 'profissional')
  expect(up.status).toBe(400)
  expect(up.body.error).toMatch(/adiantadas/)
})

test('Configurações → Plano mostra a próxima mensalidade e o histórico, e paga pela tela', async ({ page }) => {
  const salon = await paidSalon(page, { days: 20 })
  await page.goto(`/${salon.slug}/admin/configuracoes?tab=plano`)
  await expect(page.getByText(/Próxima mensalidade:/)).toBeVisible()
  await page.getByRole('button', { name: 'Pagar próxima mensalidade' }).click()
  await expect(page.getByAltText('QR Code PIX')).toBeVisible()
  await page.getByRole('button', { name: '[dev] Simular pagamento' }).click()
  await expect(page.getByText(/Próxima mensalidade:/)).toBeVisible()

  // O histórico fica na própria aba, separado das informações do plano
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page.getByText(/Renovação · Essencial/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar plano' })).toHaveCount(0)
})

test('cancelar plano avisa que o acesso acaba no fim do período e que voltar exige pagar outro plano', async ({ page }) => {
  const salon = await paidSalon(page, { days: 12 })
  await page.goto(`/${salon.slug}/admin/configuracoes?tab=plano`)
  await page.getByRole('button', { name: 'Cancelar plano' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Confirmar cancelamento do plano' })
  await expect(dialog).toContainText('acesso será encerrado ao final do plano ativo')
  await expect(dialog).toContainText('pagar outro plano')
})

test('renovar soma 30 dias ao vencimento e o mesmo evento reenviado não soma de novo', async ({ page }) => {
  const salon = await paidSalon(page, { days: 5 })
  const before = (await salonOf(salon.id)).planEndsAt
  const { body: charge } = await createCharge(page, salon.id, 'essencial')

  expect((await sendPaidWebhook(page, charge)).ok()).toBe(true)
  const after = (await salonOf(salon.id)).planEndsAt
  expect(after.getTime() - before.getTime(), 'ninguém perde dia pago').toBe(30 * DAY)

  expect((await sendPaidWebhook(page, charge)).ok()).toBe(true)
  expect((await salonOf(salon.id)).planEndsAt.getTime(), 'reenvio não soma').toBe(after.getTime())
  expect(await prisma.payment.count({ where: { salonId: salon.id, status: 'paid' } })).toBe(1)
})

test('duas cobranças da mesma mensalidade: a segunda paga vira duplicidade e não estende', async ({ page }) => {
  const salon = await paidSalon(page, { days: 5 })
  const { body: first } = await createCharge(page, salon.id, 'essencial')
  // O 1º PIX vence sem o cliente pagar e ele gera outro; depois paga os dois QR codes.
  await prisma.payment.update({ where: { id: first.paymentId }, data: { status: 'expired', expiresAt: new Date(Date.now() - 60 * 60_000) } })
  const { body: second } = await createCharge(page, salon.id, 'essencial')
  expect(second.paymentId).not.toBe(first.paymentId)

  expect((await sendPaidWebhook(page, second)).ok()).toBe(true)
  const paidEnd = (await salonOf(salon.id)).planEndsAt

  expect((await sendPaidWebhook(page, first)).ok()).toBe(true)
  const dup = await prisma.payment.findUnique({ where: { id: first.paymentId } })
  expect(dup.status).toBe('duplicate')
  expect((await salonOf(salon.id)).planEndsAt.getTime(), 'a duplicada não estende').toBe(paidEnd.getTime())
})

test('upgrade no meio do período desconta os dias não usados e abre novo ciclo de 30 dias', async ({ page }) => {
  const salon = await paidSalon(page, { plan: 'essencial', days: 15 })
  const { status, body } = await createCharge(page, salon.id, 'profissional')
  expect(status).toBe(200)
  expect(body.kind).toBe('upgrade')
  expect(body.creditCents).toBeGreaterThan(3000)
  expect(body.amount + body.creditCents).toBe(11990)

  expect((await sendPaidWebhook(page, body)).ok()).toBe(true)
  const s = await salonOf(salon.id)
  expect(s.plan).toBe('profissional')
  const days = (s.planEndsAt.getTime() - Date.now()) / DAY
  expect(days).toBeGreaterThan(29.9)
  expect(days).toBeLessThanOrEqual(30)

  const down = await createCharge(page, salon.id, 'essencial')
  expect(down.status, 'plano menor só depois de vencer').toBe(400)
})

test('cancelar plano mantém o acesso até o vencimento e dá para desfazer', async ({ page }) => {
  const salon = await paidSalon(page, { days: 12 })
  await page.goto(`/${salon.slug}/admin/configuracoes?tab=plano`)
  await expect(page.getByText(/Ativo · vence em/)).toBeVisible()

  await page.getByRole('button', { name: 'Cancelar plano' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText(/Cancelado · acesso até/)).toBeVisible()
  const cancelled = await salonOf(salon.id)
  expect(cancelled.cancelAtPeriodEnd).toBe(true)
  expect(cancelled.status, 'segue ativo até o fim do período').toBe('active')

  await page.getByRole('button', { name: 'Desfazer cancelamento' }).click()
  await expect(page.getByText(/Ativo · vence em/)).toBeVisible()
  expect((await salonOf(salon.id)).cancelAtPeriodEnd).toBe(false)
})

test('assinatura vencida bloqueia na API (402) e na tela, e pagar libera de novo', async ({ page }) => {
  const salon = await paidSalon(page, { days: -1 })
  const blocked = await page.request.get(`${E2E_API_URL}/api/category`, { headers: { 'x-salon-id': salon.id } })
  expect(blocked.status()).toBe(402)
  expect((await blocked.json()).code).toBe('SUBSCRIPTION_EXPIRED')
  expect((await salonOf(salon.id)).status).toBe('suspended')

  await page.goto(`/${salon.slug}/admin`)
  await expect(page.getByRole('heading', { name: 'Sua assinatura venceu' })).toBeVisible()

  const { body: charge } = await createCharge(page, salon.id, 'essencial')
  expect(charge.kind).toBe('renewal')
  expect((await sendPaidWebhook(page, charge)).ok()).toBe(true)
  const ok = await page.request.get(`${E2E_API_URL}/api/category`, { headers: { 'x-salon-id': salon.id } })
  expect(ok.status()).toBe(200)
})

test('faltando 7 dias ou menos o Admin vê a faixa de renovação ao abrir o app', async ({ page }) => {
  const salon = await paidSalon(page, { days: 3 })
  await page.goto(`/${salon.slug}/admin`)
  await expect(page.getByRole('alert').filter({ hasText: 'Sua assinatura vence' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Assinatura perto de vencer' })).toBeVisible()
  await page.getByRole('button', { name: 'Lembrar depois' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Sua assinatura vence' })).toBeVisible() // a faixa fica até renovar
})

test('histórico de pagamentos lista as cobranças do salão', async ({ page }) => {
  const salon = await paidSalon(page, { days: 4 })
  const { body: charge } = await createCharge(page, salon.id, 'essencial')
  await sendPaidWebhook(page, charge)
  const res = await page.request.get(`${E2E_API_URL}/api/v1/salon/billing`, { headers: { 'x-salon-id': salon.id } })
  const billing = await res.json()
  expect(billing.payments.map((p) => [p.kind, p.status])).toEqual([['renewal', 'paid']])})
