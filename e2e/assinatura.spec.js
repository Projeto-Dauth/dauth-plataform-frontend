import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import { createCharge, sendPaidWebhook } from './support/billing.js'
import prisma from './support/db.js'

const DAY = 86_400_000
const inDays = (n) => new Date(Date.now() + n * DAY)

// Salão do teste, já pago no plano e com o vencimento em `days` dias (preparado direto no banco).
async function paidSalon(page, { plan = 'essencial', days = 20, billingMonths = 1 } = {}) {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', plan, billingMonths, planEndsAt: inDays(days), trialEndsAt: null } })
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

test('trimestral e semestral: valor com desconto, soma 90/180 dias e a renovação sugere a mesma duração', async ({ page }) => {
  const salon = await paidSalon(page, { days: 5 })
  const start = (await salonOf(salon.id)).planEndsAt.getTime()

  const { status, body } = await createCharge(page, salon.id, 'essencial', 3)
  expect(status).toBe(200)
  expect({ kind: body.kind, months: body.months, amount: body.amount }).toEqual({ kind: 'renewal', months: 3, amount: 21570 })
  expect((await sendPaidWebhook(page, body)).ok()).toBe(true)
  const after3 = await salonOf(salon.id)
  expect(after3.planEndsAt.getTime(), '3 meses = 90 dias').toBe(start + 90 * DAY)
  expect(after3.billingMonths).toBe(3)

  const billing = await (await page.request.get(`${E2E_API_URL}/api/v1/salon/billing`, { headers: { 'x-salon-id': salon.id } })).json()
  expect(billing.nextCharge, 'próximo pagamento na duração contratada').toMatchObject({ months: 3, amountCents: 21570 })

  const six = await createCharge(page, salon.id, 'essencial', 6)
  expect(six.body.amount).toBe(40740)
  expect((await sendPaidWebhook(page, six.body)).ok()).toBe(true)
  expect((await salonOf(salon.id)).planEndsAt.getTime(), '6 meses = 180 dias').toBe(start + 270 * DAY)

  // 275 dias pagos + mais 180 passaria de 12 meses à frente
  expect((await createCharge(page, salon.id, 'essencial', 6)).status, 'limite de 12 meses à frente').toBe(400)
  expect((await createCharge(page, salon.id, 'essencial', 12)).status, 'só 1, 3 ou 6 meses').toBe(400)
})

test('upgrade no plano semestral cobra só a diferença pelos dias que faltam e mantém o vencimento', async ({ page }) => {
  const salon = await paidSalon(page, { plan: 'essencial', days: 120, billingMonths: 6 })
  const end = (await salonOf(salon.id)).planEndsAt.getTime()
  const { status, body } = await createCharge(page, salon.id, 'profissional')
  expect(status).toBe(200)
  expect(body.kind).toBe('upgrade')
  // (R$ 101,90 - R$ 67,90) por mês do semestral x 4 meses = R$ 136,00
  expect(body.amount).toBeGreaterThanOrEqual(13599)
  expect(body.amount).toBeLessThanOrEqual(13600)

  expect((await sendPaidWebhook(page, body)).ok()).toBe(true)
  const s = await salonOf(salon.id)
  expect({ plan: s.plan, billingMonths: s.billingMonths }).toEqual({ plan: 'profissional', billingMonths: 6 })
  expect(s.planEndsAt.getTime(), 'vencimento não muda').toBe(end)

  // A renovação depois do upgrade não é confundida com ele (não vira duplicidade)
  const renew = await createCharge(page, salon.id, 'profissional', 3)
  expect(renew.body.amount).toBe(32370)
  expect((await sendPaidWebhook(page, renew.body)).ok()).toBe(true)
  expect((await salonOf(salon.id)).planEndsAt.getTime()).toBe(end + 90 * DAY)
  expect(await prisma.payment.count({ where: { salonId: salon.id, status: 'duplicate' } })).toBe(0)
})

test('Configurações → Plano mostra o próximo pagamento e o histórico, e paga pela tela escolhendo a duração', async ({ page }) => {
  const salon = await paidSalon(page, { days: 20 })
  await page.goto(`/${salon.slug}/admin/configuracoes?tab=plano`)
  await expect(page.getByText(/Próximo pagamento \(mensal\):/)).toBeVisible()
  await expect(page.getByText(/Não há reembolso/)).toBeVisible()
  await page.getByRole('button', { name: 'Pagar adiantado' }).click()
  await page.getByRole('radio', { name: /Trimestral/ }).click()
  await page.getByRole('button', { name: 'Gerar PIX' }).click()
  await expect(page.getByAltText('QR Code PIX')).toBeVisible()
  await expect(page.getByText('R$ 215,70')).toBeVisible()
  await page.getByRole('button', { name: '[dev] Simular pagamento' }).click()
  await expect(page.getByText(/Próximo pagamento \(trimestral\):/)).toBeVisible()

  // Os pagamentos feitos aparecem na mesma tela, numa seção própria
  await expect(page.getByText(/Renovação · Essencial · 3 meses/)).toBeVisible()
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

test('upgrade no meio do período mensal cobra a diferença pelos dias que faltam e mantém o vencimento', async ({ page }) => {
  const salon = await paidSalon(page, { plan: 'essencial', days: 15 })
  const end = (await salonOf(salon.id)).planEndsAt.getTime()
  const { status, body } = await createCharge(page, salon.id, 'profissional')
  expect(status).toBe(200)
  expect(body.kind).toBe('upgrade')
  // (R$ 119,90 - R$ 79,90) x 15/30 = R$ 20,00
  expect(body.amount).toBeGreaterThanOrEqual(1999)
  expect(body.amount).toBeLessThanOrEqual(2000)

  expect((await sendPaidWebhook(page, body)).ok()).toBe(true)
  const s = await salonOf(salon.id)
  expect(s.plan).toBe('profissional')
  expect(s.planEndsAt.getTime(), 'vencimento não muda').toBe(end)

  const down = await createCharge(page, salon.id, 'essencial')
  expect(down.status, 'plano menor só depois de vencer').toBe(400)
})

test('cancelar plano mantém o acesso até o vencimento e dá para desfazer', async ({ page }) => {
  const salon = await paidSalon(page, { days: 12 })
  await page.goto(`/${salon.slug}/admin/configuracoes?tab=plano`)
  await expect(page.getByText('Seu plano está ativo')).toBeVisible()

  await page.getByRole('button', { name: 'Cancelar plano' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText('Seu plano foi cancelado')).toBeVisible()
  const cancelled = await salonOf(salon.id)
  expect(cancelled.cancelAtPeriodEnd).toBe(true)
  expect(cancelled.status, 'segue ativo até o fim do período').toBe('active')

  await page.getByRole('button', { name: 'Desfazer cancelamento' }).click()
  await expect(page.getByText('Seu plano está ativo')).toBeVisible()
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
