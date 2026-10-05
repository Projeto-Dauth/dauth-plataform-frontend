import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { demoSalon, apiPost } from './support/demo.js'
import { openTabForNewClient, fillPayment, creditBalance } from './support/caixa.js'
import prisma from './support/db.js'

// Crédito do cliente: caminhos válidos e casos de borda. Cada teste tem cliente e comanda próprios
// (Corte Masculino = R$ 45, salvo indicação).
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso
const brl = (n) => `R\\$\\s?${n}` // "R$ 10,00" como padrão de busca ($ escapado)

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

const addCredit = (page, client, amount) =>
  apiPost(page, salon.id, `/users/${client}/credit-adjustment`, { amount })
const creditSlices = (tabId) =>
  prisma.transaction.findMany({ where: { tabId, assistantId: null }, select: { method: true, grossAmount: true } })
const total = (txs, method) => Number(txs.filter(t => t.method === method).reduce((s, t) => s + t.grossAmount, 0).toFixed(2))

async function openClientCard(page, clientName) {
  await page.goto(`/${SEED_SALON_SLUG}/admin/usuarios`)
  await page.getByPlaceholder('Buscar por nome ou telefone…').fill(clientName)
  await page.getByRole('row', { name: new RegExp(clientName) }).click()
}
async function selectTabInCaixa(page, clientName) {
  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(clientName) }).filter({ hasText: 'Em aberto' }).first().click()
}

test('válido: crédito adicionado pela ficha paga a comanda inteira', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(40) })

  await openClientCard(page, tab.clientName)
  await page.getByRole('button', { name: 'Ajustar crédito' }).click()
  await page.getByPlaceholder('0,00').fill('100')
  await page.getByRole('button', { name: 'Adicionar crédito' }).click()
  await expect(page.getByText('Crédito adicionado com sucesso')).toBeVisible()
  expect(await creditBalance(page, salon.id, tab.client)).toBe(100)

  await selectTabInCaixa(page, tab.clientName)
  await page.getByRole('checkbox', { name: /Crédito \(/ }).check()
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()

  expect((await prisma.tab.findUnique({ where: { id: tab.tabId } })).status).toBe('Paga')
  const txs = await creditSlices(tab.tabId)
  expect({ credito: total(txs, 'credito'), outros: txs.filter(t => t.method !== 'credito' && t.grossAmount > 0).length })
    .toEqual({ credito: 45, outros: 0 })
  expect(await creditBalance(page, salon.id, tab.client)).toBe(55)
})

test('válido: usar só parte do crédito no Fechar conta e o resto no Pix', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(41) })
  await addCredit(page, tab.client, 100)

  await page.goto(`/${SEED_SALON_SLUG}/agendamento/${tab.appointmentId}`)
  await page.getByRole('button', { name: 'Fechar comanda' }).click()
  await page.getByRole('checkbox', { name: /Crédito \(/ }).check()
  await page.getByRole('textbox', { name: /Crédito \(/ }).fill('10')
  await fillPayment(page, [{ method: 'pix' }])
  await expect(page.getByRole('button', { name: /^Fechar conta ·/ })).toContainText('35,00')
  await page.getByRole('button', { name: /^Fechar conta ·/ }).click()
  await expect(page.getByText(/^Conta fechada com sucesso/)).toBeVisible()

  const txs = await creditSlices(tab.tabId)
  expect({ credito: total(txs, 'credito'), pix: total(txs, 'pix') }).toEqual({ credito: 10, pix: 35 })
  expect(await creditBalance(page, salon.id, tab.client)).toBe(90)
})

test('válido: crédito adicionado a mensalista abate o fiado primeiro', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(42) })
  // A comanda de R$ 45 foi fechada como mensalista (fiado em aberto)
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'fiado', Amount: 45 }],
  })

  await openClientCard(page, tab.clientName)
  await page.getByRole('button', { name: 'Ajustar crédito' }).click()
  await page.getByPlaceholder('0,00').fill('100')
  await page.getByRole('button', { name: 'Adicionar crédito' }).click()
  await expect(page.getByText(new RegExp(`${brl('45,00')} abateram o fiado em aberto`))).toBeVisible()

  expect(await creditBalance(page, salon.id, tab.client)).toBe(55) // só a sobra vira crédito
})

test('borda: crédito insuficiente — o restante precisa ser pago e o dinheiro precisa cobrir', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(43) })
  await addCredit(page, tab.client, 10)

  await selectTabInCaixa(page, tab.clientName)
  await page.getByRole('checkbox', { name: /Crédito \(/ }).check() // usa os R$ 10; faltam R$ 35
  await fillPayment(page, [{ method: 'dinheiro', tendered: '20' }])
  await expect(page.getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled() // R$ 20 não cobre R$ 35

  await fillPayment(page, [{ method: 'dinheiro', tendered: '35' }])
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()
  const txs = await creditSlices(tab.tabId)
  expect({ credito: total(txs, 'credito'), dinheiro: total(txs, 'dinheiro') }).toEqual({ credito: 10, dinheiro: 35 })
  expect(await creditBalance(page, salon.id, tab.client)).toBe(0)
})

test('borda: pagar pedindo mais crédito do que o saldo é recusado e nada muda', async ({ page }) => {
  // Ex: duas telas abertas — o saldo foi usado na outra e esta ainda acha que tem
  const tab = await openTabForNewClient(page, salon, { day: testDay(44) })
  await addCredit(page, tab.client, 10)

  const res = await page.request.post(`${E2E_API_URL}/api/tab/batch-pay`, {
    headers: { 'x-salon-id': salon.id },
    data: { tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Credit_amount: 45, Payments: [{ Method: 'pix', Amount: 0 }] },
  })
  expect(res.status()).toBeGreaterThanOrEqual(400)
  expect((await res.json()).error).toMatch(/Crédito insuficiente/)
  expect((await prisma.tab.findUnique({ where: { id: tab.tabId } })).status).toBe('Em aberto')
  expect(await creditBalance(page, salon.id, tab.client)).toBe(10)
})

test('borda: remover mais crédito do que o saldo é recusado na tela e na API', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(45) })
  await addCredit(page, tab.client, 10)

  await openClientCard(page, tab.clientName)
  await page.getByRole('button', { name: 'Ajustar crédito' }).click()
  await page.getByRole('button', { name: 'Remover', exact: true }).click()
  await page.getByPlaceholder('0,00').fill('50')
  await page.getByRole('button', { name: 'Remover crédito' }).click()
  await expect(page.getByText(new RegExp(`O cliente só tem ${brl('10,00')} de crédito`))).toBeVisible()

  const res = await page.request.post(`${E2E_API_URL}/api/users/${tab.client}/credit-adjustment`, {
    headers: { 'x-salon-id': salon.id }, data: { amount: -50 },
  })
  expect(res.status(), 'API também recusa saldo negativo').toBe(422)
  expect(await creditBalance(page, salon.id, tab.client)).toBe(10)
})
