import { test, expect } from '@playwright/test'
import { createOwner } from './support/accounts.js'
import { createSalon } from './support/salon.js'
import { createCharge, sendPaidWebhook } from './support/billing.js'
import { newUserPage } from './support/browser.js'
import { SYSTEM_API, loginAsSystem } from './support/system.js'
import prisma from './support/db.js'

// Desconto da lista de espera (backend/src/config/billing.js#WAITLIST_DISCOUNT, platform/services/waitlist.js):
// telefone inscrito na lista → o salão criado ganha 15% nas 3 primeiras mensalidades; sem somar com o desconto do
// trimestral/semestral; só gasta quando o PIX é pago; uma inscrição vale para um salão só; o /sistema dá à mão.

// A landing grava o WhatsApp só com dígitos e com 55; o sistema grava "(11) 9 XXXX-XXXX"
const listPhone = (phone) => `55${phone.replace(/\D/g, '')}`
const enroll = (phone, name = 'Inscrita E2E') => prisma.waitlistEntry.create({ data: { phone, name, city: 'Caxias do Sul' } })

test('telefone na lista de espera: salão ganha 15% nas 3 primeiras mensalidades, gastas só quando o PIX é pago', async ({ page }) => {
  const owner = await createOwner(page)
  await enroll(listPhone(owner.phone))

  const salon = await createSalon(page)
  expect(salon.waitlistDiscount).toBe(true)
  expect(await prisma.salon.findUnique({ where: { id: salon.id }, select: { discountMonthsLeft: true, discountSource: true } }))
    .toEqual({ discountMonthsLeft: 3, discountSource: 'lista_espera' })

  // Mensal: R$ 79,90 → R$ 67,90. Gerar o PIX não gasta; pagar gasta 1.
  const first = await createCharge(page, salon.id, 'essencial', 1)
  expect(first.status).toBe(200)
  expect({ amount: first.body.amount, discountCents: first.body.discountCents }).toEqual({ amount: 6790, discountCents: 1200 })
  expect((await prisma.salon.findUnique({ where: { id: salon.id } })).discountMonthsLeft).toBe(3)
  expect((await sendPaidWebhook(page, first.body)).status()).toBe(200)
  expect((await prisma.salon.findUnique({ where: { id: salon.id } })).discountMonthsLeft).toBe(2)

  // Tela do plano avisa o desconto que sobra
  await page.goto(`/${salon.slug}/admin/configuracoes?tab=plano`)
  await expect(page.getByText(/desconto da lista de espera: 15% em mais 2 mensalidades/)).toBeVisible()

  // Trimestral com 2 meses de desconto: 2 × 67,90 + 1 × 71,90 (não soma com os 10% do trimestral)
  const quarter = await createCharge(page, salon.id, 'essencial', 3)
  expect({ amount: quarter.body.amount, discountCents: quarter.body.discountCents }).toEqual({ amount: 20770, discountCents: 800 })
  await sendPaidWebhook(page, quarter.body)
  const after = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect(after.discountMonthsLeft).toBe(0)

  // Acabou o desconto: preço cheio
  const full = await createCharge(page, salon.id, 'essencial', 1)
  expect({ amount: full.body.amount, discountCents: full.body.discountCents }).toEqual({ amount: 7990, discountCents: 0 })
})

test('semestral não gasta o desconto (já tem 15%) e a inscrição vale para um salão só', async ({ page }) => {
  const owner = await createOwner(page)
  // Inscrita sem o 9 do celular: o sistema tenta com e sem
  const digits = listPhone(owner.phone)
  await enroll(digits.slice(0, 4) + digits.slice(5))

  const salon = await createSalon(page)
  expect(salon.waitlistDiscount).toBe(true)
  const semester = await createCharge(page, salon.id, 'essencial', 6)
  expect({ amount: semester.body.amount, discountCents: semester.body.discountCents }).toEqual({ amount: 40740, discountCents: 0 })
  await sendPaidWebhook(page, semester.body)
  expect((await prisma.salon.findUnique({ where: { id: salon.id } })).discountMonthsLeft).toBe(3)

  // Segundo salão do mesmo dono: a inscrição já foi usada
  const second = await createSalon(page)
  expect(second.waitlistDiscount).toBe(false)
  expect((await prisma.salon.findUnique({ where: { id: second.id } })).discountMonthsLeft).toBe(0)
})

test('telefone fora da lista não ganha nada; o /sistema dá o desconto à mão, uma vez só', async ({ page, browser }) => {
  const ownerPage = await newUserPage(browser)
  await createOwner(ownerPage)
  const salon = await createSalon(ownerPage, `Salão Sem Lista ${Date.now()}`)
  expect(salon.waitlistDiscount).toBe(false)
  const before = await createCharge(ownerPage, salon.id, 'essencial', 1)
  expect(before.body.amount).toBe(7990)
  await ownerPage.context().close()

  await loginAsSystem(page)
  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill(salon.name)
  await page.getByRole('button', { name: `Ver ${salon.name}` }).click()
  const panel = page.getByRole('dialog', { name: salon.name })
  await panel.getByRole('button', { name: 'Aplicar desconto da lista de espera' }).click()
  await expect(panel.getByText(/Desconto dado à mão · 3 de 3 mensalidades com desconto restantes/)).toBeVisible()
  expect(await prisma.salon.findUnique({ where: { id: salon.id }, select: { discountMonthsLeft: true, discountSource: true } }))
    .toEqual({ discountMonthsLeft: 3, discountSource: 'manual' })

  const again = await page.request.post(`${SYSTEM_API}/system/salons/${salon.id}/waitlist-discount`)
  expect(again.status()).toBe(409)
})
