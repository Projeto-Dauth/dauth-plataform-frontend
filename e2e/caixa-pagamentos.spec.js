import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { demoSalon, apiPost } from './support/demo.js'
import { openTabForNewClient, fillPayment, paymentsOf, creditBalance } from './support/caixa.js'
import prisma from './support/db.js'

// Formas de pagamento no Caixa. Cada teste tem cliente e comanda próprios; o dia muda por teste e
// por repetição para os horários da Ana não colidirem.
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso
const sum = (txs) => Number(txs.reduce((s, t) => s + t.grossAmount, 0).toFixed(2))

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

async function selectTabInCaixa(page, clientName) {
  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(clientName) }).first().click()
  return page.locator('[data-tour="comanda-painel"]') // painel da comanda selecionada
}

test('dinheiro: exige o valor recebido e o troco vira crédito do cliente', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(30) }) // Corte Masculino, R$ 45
  const panel = await selectTabInCaixa(page, tab.clientName)

  await fillPayment(page, [{ method: 'dinheiro' }])
  await expect(panel.getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled() // falta o valor recebido
  await fillPayment(page, [{ method: 'dinheiro', tendered: '50' }])
  await expect(page.getByText(/Troco de R\$\s?5,00 vira crédito/)).toBeVisible()
  await panel.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()

  expect((await prisma.tab.findUnique({ where: { id: tab.tabId } })).status).toBe('Paga')
  const txs = await paymentsOf(tab.tabId)
  expect({ metodos: [...new Set(txs.map(t => t.method))], total: sum(txs) }).toEqual({ metodos: ['dinheiro'], total: 45 })
  expect(await creditBalance(page, salon.id, tab.client)).toBe(5)
})

for (const [method, label] of [['cartao_debito', 'débito'], ['cartao_credito', 'crédito']]) {
  test(`cartão de ${label}`, async ({ page }) => {
    const tab = await openTabForNewClient(page, salon, { day: testDay(method === 'cartao_debito' ? 31 : 32) })
    const panel = await selectTabInCaixa(page, tab.clientName)
    await fillPayment(page, [{ method }])
    await panel.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()

    const txs = await paymentsOf(tab.tabId)
    expect({ metodos: [...new Set(txs.map(t => t.method))], total: sum(txs) }).toEqual({ metodos: [method], total: 45 })
  })
}

test('dividido: parte no Pix e parte em dinheiro, cada parte com a sua forma', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(33), service: 'Escova', end: '10:00' }) // R$ 70
  const panel = await selectTabInCaixa(page, tab.clientName)

  await fillPayment(page, [{ method: 'pix', amount: '40' }, { method: 'dinheiro', amount: '30', tendered: '30' }])
  await expect(page.getByText('Soma confere')).toBeVisible()
  await panel.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()

  const txs = await paymentsOf(tab.tabId)
  const byMethod = Object.fromEntries(['pix', 'dinheiro'].map(m => [m, sum(txs.filter(t => t.method === m))]))
  expect(byMethod).toEqual({ pix: 40, dinheiro: 30 })
  expect(await creditBalance(page, salon.id, tab.client)).toBe(0) // sem troco
})

test('valor dividido que não fecha a conta bloqueia o pagamento', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(34) }) // R$ 45
  const panel = await selectTabInCaixa(page, tab.clientName)
  await fillPayment(page, [{ method: 'pix', amount: '20' }, { method: 'cartao_debito', amount: '10' }])
  await expect(page.getByText('Falta alocar')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled()
  expect((await prisma.tab.findUnique({ where: { id: tab.tabId } })).status).toBe('Em aberto')
})

test('crédito do troco é usado na próxima comanda, o resto no Pix', async ({ page }) => {
  // 1ª comanda (R$ 45) paga com R$ 50 em dinheiro → R$ 5 de crédito
  const first = await openTabForNewClient(page, salon, { day: testDay(35) })
  await selectTabInCaixa(page, first.clientName)
  await fillPayment(page, [{ method: 'dinheiro', tendered: '50' }])
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()
  expect(await creditBalance(page, salon.id, first.client)).toBe(5)

  // 2ª comanda do mesmo cliente (R$ 45): usa os R$ 5 de crédito + R$ 40 no Pix
  const second = await openTabForNewClient(page, salon, { day: testDay(35), start: '10:00', end: '10:30', clientName: first.clientName, client: first.client })
  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(first.clientName) }).filter({ hasText: 'Em aberto' }).click()
  await page.getByLabel(/Crédito \(/).check()
  await fillPayment(page, [{ method: 'pix' }])
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()

  expect((await prisma.tab.findUnique({ where: { id: second.tabId } })).status).toBe('Paga')
  expect(await creditBalance(page, salon.id, first.client)).toBe(0)
  const txs = await paymentsOf(second.tabId)
  expect(sum(txs.filter(t => t.method === 'pix'))).toBe(40)
})

test('fechar conta: várias comandas do mesmo cliente pagas de uma vez', async ({ page }) => {
  const a = await openTabForNewClient(page, salon, { day: testDay(36) }) // R$ 45
  const b = await openTabForNewClient(page, salon, { day: testDay(36), service: 'Escova', start: '10:00', end: '11:00', clientName: a.clientName, client: a.client }) // R$ 70

  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  const account = page.locator('div').filter({ hasText: a.clientName }).filter({ has: page.getByRole('button', { name: 'Fechar conta', exact: true }) }).last()
  await expect(account).toContainText('2 itens')
  await account.getByRole('button', { name: 'Fechar conta', exact: true }).click()
  await page.getByRole('button', { name: /^Fechar conta ·/ }).click()
  await expect(page.getByText(`Conta de ${a.clientName} fechada com sucesso`)).toBeVisible()

  for (const t of [a, b]) expect((await prisma.tab.findUnique({ where: { id: t.tabId } })).status).toBe('Paga')
  expect(sum([...(await paymentsOf(a.tabId)), ...(await paymentsOf(b.tabId))])).toBe(115)
})

test('fechar conta com produto e serviço avulso: tudo pago junto e o estoque baixa', async ({ page }) => {
  const product = await apiPost(page, salon.id, '/product', { Name: `Shampoo E2E ${Date.now()}`, Price: 30, Stock: 5 })
  const tab = await openTabForNewClient(page, salon, { day: testDay(37) }) // R$ 45

  // Uma comanda só não entra em "Contas em aberto" (mínimo de itens): abre pelo agendamento
  await page.goto(`/${SEED_SALON_SLUG}/agendamento/${tab.appointmentId}`)
  await page.getByRole('button', { name: 'Fechar comanda' }).click()

  // Produto
  await page.getByPlaceholder('Buscar produto...').fill(product.Name)
  await page.locator('div').filter({ hasText: product.Name }).filter({ has: page.getByRole('button', { name: 'Adicionar à conta' }) }).last()
    .getByRole('button', { name: 'Adicionar à conta' }).click()
  await expect(page.getByText(`${product.Name} adicionado à conta`)).toBeVisible()

  // Serviço avulso (Escova com a Ana) na mesma conta
  const addToggle = page.locator('div') // seletor Produtos/Serviços do modal (o menu lateral também tem "Serviços")
    .filter({ has: page.getByRole('button', { name: 'Produtos', exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Serviços', exact: true }) }).last()
  await addToggle.getByRole('button', { name: 'Serviços', exact: true }).click()
  await page.getByLabel('Profissional do serviço').selectOption({ label: 'Ana Profissional' })
  await page.getByPlaceholder('Buscar serviço...').fill('Escova')
  await page.locator('div').filter({ hasText: /^Escova/ }).filter({ has: page.getByRole('button', { name: 'Adicionar à conta' }) }).last()
    .getByRole('button', { name: 'Adicionar à conta' }).click()
  const conflict = page.getByRole('button', { name: 'Lançar mesmo assim' })
  await expect(page.getByText(/Escova adicionado à conta|Deseja lançar mesmo assim/)).toBeVisible()
  if (await conflict.isVisible()) await conflict.click()
  await expect(page.getByText(/Escova adicionado à conta/)).toBeVisible()

  // Total = 45 (comanda) + 70 (Escova) + 30 (produto), pago no cartão de crédito
  await fillPayment(page, [{ method: 'cartao_credito' }])
  await expect(page.getByRole('button', { name: /^Fechar conta ·/ })).toContainText('145,00')
  await page.getByRole('button', { name: /^Fechar conta ·/ }).click()
  await expect(page.getByText(/^Conta fechada com sucesso/)).toBeVisible()

  const tabAfter = await prisma.tab.findUnique({ where: { id: tab.tabId }, include: { items: true } })
  expect({ status: tabAfter.status, servicos: tabAfter.items.filter(i => i.itemType === 'service').length }).toEqual({ status: 'Paga', servicos: 2 })
  const order = await prisma.productOrder.findFirst({ where: { productId: product.UUID } })
  expect(order.status).toBe('pago')
  expect((await prisma.product.findUnique({ where: { id: product.UUID } })).stock).toBe(4)
})

test('excluir comanda em aberto', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(38) })
  const panel = await selectTabInCaixa(page, tab.clientName)
  await panel.getByRole('button', { name: 'Excluir comanda' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect.poll(() => prisma.tab.findUnique({ where: { id: tab.tabId } })).toBeNull()
})
