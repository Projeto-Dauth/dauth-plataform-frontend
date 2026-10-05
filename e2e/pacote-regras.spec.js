import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { demoSalon, apiPost, createClient } from './support/demo.js'
import { openTabForNewClient } from './support/caixa.js'
import { createPackage, sellPackage, sellAndPay, clientPackageStatus } from './support/package.js'
import prisma from './support/db.js'

// Regras de pacote: venda, uma por cliente, preço congelado, consumo de sessões e conclusão manual.
// Cada teste tem cliente e pacote próprios. Serviços da Ana: Escova (R$ 70, 60min) no pacote e
// Corte Masculino (R$ 45, 30min) como serviço fora do pacote.
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso
const newClient = (salon) => createClient(salon.id, `Cliente Pacote ${Date.now()}`)

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

const conclude = (page, cpId, data) =>
  page.request.patch(`${E2E_API_URL}/api/package/client/${cpId}/conclude`, { headers: { 'x-salon-id': salon.id }, data })
// Atendimento concluído da cliente (gera a comanda; se o pacote cobre, a sessão é consumida)
const attend = (page, client, day, { service = 'Escova', start = '09:00', end = '10:00' } = {}) =>
  openTabForNewClient(page, salon, { client, clientName: 'Cliente Pacote', service, day, start, end })
const tabOf = async (tabId) => prisma.tab.findUnique({ where: { id: tabId } })

test('venda bloqueada na tela: serviço do pacote sem preço ou comissão', async ({ page }) => {
  const clientName = `Cliente Pacote ${Date.now()}`
  await createClient(salon.id, clientName)
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2 }] })

  await page.goto(`/${SEED_SALON_SLUG}/admin/combos`)
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name: pkg.name }) })
    .filter({ has: page.getByRole('button', { name: 'Vender' }) }).last()
  await card.getByRole('button', { name: 'Vender' }).click()
  await page.getByRole('button', { name: 'Selecionar cliente…' }).click()
  await page.getByPlaceholder('Buscar…').fill(clientName)
  await page.getByText(clientName, { exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar venda' }).click()
  await expect(page.getByText(/Defina preço e comissão de todos os serviços do pacote antes de vender: Escova/)).toBeVisible()
  expect(await prisma.clientPackage.count({ where: { packageId: pkg.id } })).toBe(0)
})

test('venda bloqueada: soma dos itens diferente do preço do pacote', async ({ page }) => {
  const pkg = await createPackage(page, salon, { price: 200, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })
  const res = await sellPackage(page, salon, pkg.id, await newClient(salon))
  expect(res.status()).toBe(422)
  expect((await res.json()).error).toMatch(/não bate com o preço do pacote/)
})

test('pacote desativado não pode ser vendido, nem pela API', async ({ page }) => {
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })
  await apiPost(page, salon.id, `/package/${pkg.id}`, { Active: false }, 'patch')
  const res = await sellPackage(page, salon, pkg.id, await newClient(salon))
  expect(res.status()).toBe(422)
  expect(await prisma.clientPackage.count({ where: { packageId: pkg.id } })).toBe(0)
})

test('um pacote por vez: com pacote pendente ou ativo, a cliente não compra outro', async ({ page }) => {
  const client = await newClient(salon)
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })

  expect((await sellPackage(page, salon, pkg.id, client)).ok()).toBe(true) // pendente (comanda não paga)
  const whilePending = await sellPackage(page, salon, pkg.id, client)
  expect(whilePending.status(), 'com pacote pendente').toBe(409)

  const other = await newClient(salon)
  await sellAndPay(page, salon, pkg.id, other) // ativo
  const whileActive = await sellPackage(page, salon, pkg.id, other)
  expect(whileActive.status(), 'com pacote ativo').toBe(409)
  expect((await whileActive.json()).error).toMatch(/já possui um pacote ativo ou pendente/)
})

test('preço congelado: mudar o pacote depois da venda não muda o que a cliente comprou', async ({ page }) => {
  const client = await newClient(salon)
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })
  await sellAndPay(page, salon, pkg.id, client)

  // Depois da venda o salão muda a comissão do modelo
  const [item] = await prisma.servicePackageItem.findMany({ where: { servicePackageId: pkg.id } })
  await apiPost(page, salon.id, `/package/${pkg.id}/items/${item.id}`, { Commission_override: 10 }, 'patch')

  const tab = await attend(page, client, testDay(90))
  const tx = await prisma.transaction.findFirst({ where: { tabId: tab.tabId, assistantId: null } })
  expect({ gross: tx.grossAmount, commission: tx.commissionAmount }, 'comissão de 35% sobre R$ 70 da venda').toEqual({ gross: 0, commission: 24.5 })
})

test('sessões: pacote não pago não cobre; outro serviço é cobrado; a última sessão conclui o pacote', async ({ page }) => {
  const client = await newClient(salon)
  const day = testDay(91)
  const pkg = await createPackage(page, salon, { price: 70, items: [{ service: 'Escova', quantity: 1, price: 70, commission: 35 }] })

  // Vendido mas não pago: o atendimento é cobrado normalmente
  const res = await sellPackage(page, salon, pkg.id, client)
  const { client_package, tab: purchase } = await res.json()
  const unpaid = await attend(page, client, day, { start: '08:00', end: '09:00' })
  expect({ value: (await tabOf(unpaid.tabId)).value, status: (await tabOf(unpaid.tabId)).status }).toEqual({ value: 70, status: 'Em aberto' })

  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [purchase.UUID], client_id: client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: purchase.Value }],
  })
  expect(await clientPackageStatus(client_package.UUID)).toBe('ativo')

  // Serviço que não está no pacote: cobrado
  const outside = await attend(page, client, day, { service: 'Corte Masculino', start: '10:00', end: '10:30' })
  expect((await tabOf(outside.tabId)).value).toBe(45)

  // A sessão do pacote: coberta, e era a última — o pacote conclui
  const covered = await attend(page, client, day, { start: '11:00', end: '12:00' })
  expect((await tabOf(covered.tabId)).status).toBe('Paga')
  expect(await clientPackageStatus(client_package.UUID)).toBe('concluido')

  // Acabaram as sessões: o próximo atendimento é cobrado
  const after = await attend(page, client, day, { start: '14:00', end: '15:00' })
  expect({ value: (await tabOf(after.tabId)).value, status: (await tabOf(after.tabId)).status }).toEqual({ value: 70, status: 'Em aberto' })
})

test('conclusão manual: exige motivo, só vale para pacote ativo e libera a venda de um novo', async ({ page }) => {
  const client = await newClient(salon)
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })

  // Pendente (não pago) não pode ser concluído manualmente
  const pendingRes = await sellPackage(page, salon, pkg.id, client)
  const pending = (await pendingRes.json()).client_package.UUID
  expect((await conclude(page, pending, { Note: 'cliente sumiu' })).status()).toBe(409)

  const other = await newClient(salon)
  const active = await sellAndPay(page, salon, pkg.id, other)
  expect((await conclude(page, active, {})).status(), 'sem motivo').toBe(422)
  expect((await conclude(page, active, { Note: 'Cliente usou 1 de 2 sessões e não voltou' })).ok()).toBe(true)

  const cp = await prisma.clientPackage.findUnique({ where: { id: active } })
  expect({ status: cp.status, note: cp.manualConclusionNote }).toEqual({ status: 'concluido', note: 'Cliente usou 1 de 2 sessões e não voltou' })
  expect((await sellPackage(page, salon, pkg.id, other)).ok(), 'pode comprar um pacote novo').toBe(true)
})

test('concluir manualmente pela tela de Pacotes vendidos, com o motivo registrado', async ({ page }) => {
  const clientName = `Cliente Pacote ${Date.now()}`
  const client = await createClient(salon.id, clientName)
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })
  const cpId = await sellAndPay(page, salon, pkg.id, client)

  await page.goto(`/${SEED_SALON_SLUG}/admin/combos?view=vendidos`)
  await page.getByPlaceholder('Buscar por cliente...').fill(clientName)
  await page.getByRole('button', { name: 'Concluir manualmente' }).click()

  const dialog = page.getByRole('dialog', { name: 'Concluir pacote manualmente' })
  await expect(dialog).toContainText('2 sessões restantes deixam de valer')
  await expect(dialog.getByRole('button', { name: 'Concluir pacote' }), 'sem motivo não conclui').toBeDisabled()
  await dialog.getByLabel('Motivo da conclusão').fill('Cliente mudou de cidade')
  await dialog.getByRole('button', { name: 'Concluir pacote' }).click()
  await expect(page.getByText('Pacote marcado como concluído')).toBeVisible()
  await expect(dialog).toBeHidden()

  await expect(page.getByText('Cliente mudou de cidade')).toBeVisible()
  const cp = await prisma.clientPackage.findUnique({ where: { id: cpId } })
  expect({ status: cp.status, note: cp.manualConclusionNote }).toEqual({ status: 'concluido', note: 'Cliente mudou de cidade' })
})

test('pacote vendido e nunca pago: cancelar a venda pela tela libera a cliente para outro pacote', async ({ page }) => {
  const clientName = `Cliente Pacote ${Date.now()}`
  const client = await createClient(salon.id, clientName)
  const pkg = await createPackage(page, salon, { price: 140, items: [{ service: 'Escova', quantity: 2, price: 70, commission: 35 }] })
  const { client_package, tab } = await (await sellPackage(page, salon, pkg.id, client)).json()
  expect((await sellPackage(page, salon, pkg.id, client)).status(), 'travada com o pendente').toBe(409)

  await page.goto(`/${SEED_SALON_SLUG}/admin/combos?view=vendidos`)
  await page.getByPlaceholder('Buscar por cliente...').fill(clientName)
  await page.getByRole('button', { name: 'Cancelar venda' }).click()
  await page.getByRole('button', { name: 'Cancelar venda' }).last().click() // confirmação
  await expect(page.getByText('Venda do pacote cancelada')).toBeVisible()

  expect(await clientPackageStatus(client_package.UUID)).toBe('cancelado')
  expect(await prisma.tab.findUnique({ where: { id: tab.UUID } }), 'comanda da compra saiu do Caixa').toBeNull()
  expect((await sellPackage(page, salon, pkg.id, client)).ok(), 'pode comprar de novo').toBe(true)

  // Pacote já pago (ativo) não tem venda para cancelar
  const other = await newClient(salon)
  const active = await sellAndPay(page, salon, pkg.id, other)
  const res = await page.request.patch(`${E2E_API_URL}/api/package/client/${active}/cancel`, { headers: { 'x-salon-id': salon.id } })
  expect(res.status()).toBe(409)
  expect(await clientPackageStatus(active)).toBe('ativo')
})
