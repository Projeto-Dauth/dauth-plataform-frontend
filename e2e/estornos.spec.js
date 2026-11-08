import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, apiPost, createClient } from './support/demo.js'
import { openTabForNewClient, creditBalance } from './support/caixa.js'
import { createProfessional, paidAttendance } from './support/team.js'
import { createPackage, sellPackage, sellAndPay, clientPackageStatus } from './support/package.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Estornos (docs/claude/estornos.md): desfazer repasse de comissão, reabrir comanda paga e a prevenção de
// lançamento em dobro. Só o Admin desfaz, sempre com motivo, e de trás para frente (repasse antes da comanda).
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

const post = (page, path, data, salonId = salon.id) =>
  page.request.post(`${E2E_API_URL}/api${path}`, { headers: { 'x-salon-id': salonId }, data })
const reopen = (page, tabId, reason = 'comanda lançada em dobro', salonId) => post(page, `/tab/${tabId}/reopen`, { reason }, salonId)
const reversePayout = (page, payoutId, reason = 'repasse na profissional errada', salonId) =>
  post(page, `/transaction/commissions/payouts/${payoutId}/reverse`, { reason }, salonId)
async function payCommission(page, pro, att) {
  await apiPost(page, salon.id, '/transaction/commissions/bulk-pay', {
    transaction_ids: [att.tx.id], method: 'pix', professional_id: pro.id, professional_name: pro.name, total_amount: att.tx.commissionAmount,
  })
  return prisma.commissionPayout.findFirst({ where: { professionalId: pro.id }, orderBy: { paidAt: 'desc' } })
}
const isPaid = async (txId) => (await prisma.transaction.findUnique({ where: { id: txId } })).commissionPaid
const tabStatus = async (tabId) => (await prisma.tab.findUnique({ where: { id: tabId } }))?.status

test('desfazer repasse pela tela: as comissões voltam para "a repassar" e o repasse fica no histórico como desfeito', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const att = await paidAttendance(page, salon, { professional: pro.id, day: testDay(120) })
  const payout = await payCommission(page, pro, att)

  await page.goto(`/${SEED_SALON_SLUG}/admin/comissoes`)
  await page.getByRole('button', { name: 'Histórico de repasses' }).click()
  const entry = page.getByRole('button').filter({ hasText: pro.name })
  await entry.click()
  await page.getByRole('button', { name: 'Desfazer repasse' }).click()

  const dialog = page.getByRole('dialog', { name: 'Desfazer repasse' })
  const confirm = dialog.getByRole('button', { name: 'Desfazer repasse' })
  await expect(confirm, 'sem motivo não confirma').toBeDisabled()
  await dialog.getByRole('textbox').fill('repasse na profissional errada')
  await confirm.click()
  await expect(page.getByText(/Repasse desfeito/)).toBeVisible()

  expect(await isPaid(att.tx.id)).toBe(false)
  expect((await prisma.commissionPayout.findUnique({ where: { id: payout.id } })).reversedAt).not.toBeNull()
  await expect(entry).toContainText('Desfeito')
  await expect(page.getByText('repasse na profissional errada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Desfazer repasse' }), 'repasse desfeito não oferece desfazer de novo').toHaveCount(0)
})

test('reabrir comanda paga pela tela e excluir a duplicada', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const att = await paidAttendance(page, salon, { professional: pro.id, day: testDay(121) })

  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(att.clientName) }).filter({ hasText: 'Paga' }).first().click()
  await page.getByRole('button', { name: 'Reabrir comanda' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reabrir comanda paga' })
  await dialog.getByRole('textbox').fill('comanda lançada em dobro')
  await dialog.getByRole('button', { name: 'Reabrir comanda' }).click()
  await expect(page.getByText(/^Comanda reaberta/)).toBeVisible()

  expect(await tabStatus(att.tabId)).toBe('Em aberto')
  expect(await prisma.transaction.count({ where: { tabId: att.tabId } })).toBe(0)
  const reversal = await prisma.reversal.findFirst({ where: { entityId: att.tabId, kind: 'tab_reopen' } })
  expect(reversal?.reason).toBe('comanda lançada em dobro')

  // Em aberto de novo: o fluxo normal de excluir já resolve a comanda duplicada
  await page.getByTitle('Excluir comanda').click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Comanda excluída')).toBeVisible()
  expect(await tabStatus(att.tabId)).toBeUndefined()
})

test('reabrir devolve estoque e crédito; com comissão repassada trava até desfazer o repasse', async ({ page }) => {
  const product = await apiPost(page, salon.id, '/product', { Name: `Shampoo Estorno ${Date.now()}`, Price: 30, Stock: 5 })
  const tab = await openTabForNewClient(page, salon, { day: testDay(122) })
  await apiPost(page, salon.id, `/tab/${tab.tabId}/items`, { Item_type: 'product', Product_id: product.UUID, Quantity: 2 })
  await apiPost(page, salon.id, `/users/${tab.client}/credit-adjustment`, { amount: 20 })
  const { value } = await prisma.tab.findUnique({ where: { id: tab.tabId } })
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(),
    Credit_amount: 20, Payments: [{ Method: 'pix', Amount: Number((value - 20).toFixed(2)) }],
  })
  const stock = async () => (await prisma.product.findUnique({ where: { id: product.UUID } })).stock
  expect({ estoque: await stock(), credito: await creditBalance(page, salon.id, tab.client) }).toEqual({ estoque: 3, credito: 0 })

  // Comissão da Ana repassada: reabrir é recusado e nada muda
  const ana = (await prisma.tabItem.findFirst({ where: { tabId: tab.tabId, itemType: 'service' } })).professionalId
  const commissionTx = await prisma.transaction.findFirst({ where: { tabId: tab.tabId, professionalId: ana, commissionAmount: { gt: 0 } } })
  await apiPost(page, salon.id, '/transaction/commissions/bulk-pay', {
    transaction_ids: [commissionTx.id], method: 'pix', professional_id: ana, professional_name: 'Ana Profissional', total_amount: 0,
  })
  const blocked = await reopen(page, tab.tabId)
  expect(blocked.status()).toBe(409)
  expect((await blocked.json()).error).toMatch(/Desfaça o repasse/)
  expect(await tabStatus(tab.tabId)).toBe('Paga')

  // Desfaz o repasse (só dele) e aí reabre
  const payout = await prisma.commissionPayout.findFirst({ where: { professionalId: ana }, orderBy: { paidAt: 'desc' } })
  expect((await reversePayout(page, payout.id)).ok()).toBe(true)
  const res = await reopen(page, tab.tabId)
  expect(res.ok(), await res.text()).toBe(true)
  expect((await res.json()).credit_refunded).toBe(20)

  const items = await prisma.tabItem.findMany({ where: { tabId: tab.tabId } })
  expect({
    status: await tabStatus(tab.tabId),
    itens: [...new Set(items.map(i => i.status))],
    lancamentos: await prisma.transaction.count({ where: { tabId: tab.tabId } }),
    estoque: await stock(),
    credito: await creditBalance(page, salon.id, tab.client),
  }).toEqual({ status: 'Em aberto', itens: ['pendente'], lancamentos: 0, estoque: 5, credito: 20 })

  // Reaberta, é paga de novo normalmente
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'dinheiro', Amount: value }],
  })
  expect(await tabStatus(tab.tabId)).toBe('Paga')
})

test('borda: desfazer o mesmo repasse duas vezes é recusado', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const att = await paidAttendance(page, salon, { professional: pro.id, day: testDay(123) })
  const payout = await payCommission(page, pro, att)

  const results = await Promise.all([reversePayout(page, payout.id), reversePayout(page, payout.id)])
  expect(results.filter(r => r.ok()).length, 'só um dos dois pedidos simultâneos passa').toBe(1)
  expect((await reversePayout(page, payout.id)).status()).toBe(409)
  expect(await prisma.reversal.count({ where: { entityId: payout.id } })).toBe(1)
})

test('borda: comanda paga na mensalidade já quitada não pode ser reaberta; ainda em aberto, reabre e a dívida some', async ({ page }) => {
  const payFiado = async (base) => {
    const tab = await openTabForNewClient(page, salon, { day: testDay(base), start: '17:00', end: '17:30' })
    await apiPost(page, salon.id, '/tab/batch-pay', {
      tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'fiado', Amount: 45 }],
    })
    return { ...tab, txs: await prisma.transaction.findMany({ where: { tabId: tab.tabId, method: 'fiado' } }) }
  }

  const settled = await payFiado(124)
  await apiPost(page, salon.id, '/transaction/fiado-settle', {
    client_id: settled.client, client_name: settled.clientName, transaction_ids: settled.txs.map(t => t.id), settlement_method: 'pix', total_amount: 0,
  })
  const blocked = await reopen(page, settled.tabId)
  expect(blocked.status()).toBe(409)
  expect((await blocked.json()).error).toMatch(/mensalidade/)
  const del = await page.request.delete(`${E2E_API_URL}/api/transaction/${settled.txs[0].id}`, { headers: { 'x-salon-id': salon.id } })
  expect(del.status(), 'lançamento quitado também não pode ser apagado').toBe(409)

  const open = await payFiado(125)
  expect((await reopen(page, open.tabId)).ok()).toBe(true)
  expect(await prisma.transaction.count({ where: { tabId: open.tabId, method: 'fiado' } })).toBe(0)
})

test('pacote: reabrir a comanda da compra volta o pacote a pendente; pacote já usado trava', async ({ page }) => {
  const client = await createClient(salon.id, `Cliente Pacote Estorno ${Date.now()}`)
  const pkg = await createPackage(page, salon, { price: 300, items: [{ service: 'Hidratação', quantity: 3, price: 100, commission: 10 }] })
  const clientPackageId = await sellAndPay(page, salon, pkg.id, client)
  const { tabId } = await prisma.clientPackage.findUnique({ where: { id: clientPackageId } })
  expect(await clientPackageStatus(clientPackageId)).toBe('ativo')

  expect((await reopen(page, tabId)).ok()).toBe(true)
  expect({ pacote: await clientPackageStatus(clientPackageId), comanda: await tabStatus(tabId) }).toEqual({ pacote: 'pendente', comanda: 'Em aberto' })

  // Paga de novo e a cliente usa uma sessão: aí não volta mais
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tabId], client_id: client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: 300 }],
  })
  await prisma.clientPackageItem.updateMany({ where: { clientPackageId }, data: { usedQuantity: 1 } })
  const blocked = await reopen(page, tabId)
  expect(blocked.status()).toBe(409)
  expect((await blocked.json()).error).toMatch(/sessões usadas/)
  expect(await clientPackageStatus(clientPackageId)).toBe('ativo')
})

test('borda: só o Admin desfaz, e sempre com motivo', async ({ page, browser }) => {
  const pro = await createProfessional(salon.id)
  const att = await paidAttendance(page, salon, { professional: pro.id, day: testDay(127) })
  const payout = await payCommission(page, pro, att)

  expect((await reversePayout(page, payout.id, '')).status(), 'sem motivo').toBe(422)
  expect((await reopen(page, att.tabId, '  ')).status(), 'motivo em branco').toBe(422)

  const ana = await newUserPage(browser)
  await loginAs(ana, SEED_USERS.profissional)
  expect((await reversePayout(ana, payout.id)).status()).toBe(403)
  expect((await reopen(ana, att.tabId)).status()).toBe(403)
  await ana.context().close()

  expect(await isPaid(att.tx.id)).toBe(true)
  expect(await prisma.reversal.count({ where: { entityId: { in: [payout.id, att.tabId] } } })).toBe(0)
})

test('borda: repasse e comanda de outro salão não são encontrados', async ({ page }) => {
  const other = await createSalon(page)
  const otherPro = await createProfessional(other.id)
  const foreignTab = await prisma.tab.create({ data: { salonId: other.id, status: 'Paga', value: 100 } })
  const foreignPayout = await prisma.commissionPayout.create({
    data: { salonId: other.id, professionalId: otherPro.id, professionalName: otherPro.name, paidById: otherPro.id, paidByName: 'x', method: 'pix', totalAmount: 0, transactionCount: 0, transactionIds: [] },
  })

  // Admin do Salão Demo, com o próprio salão no cabeçalho
  expect((await reopen(page, foreignTab.id)).status()).toBe(404)
  expect((await reversePayout(page, foreignPayout.id)).status()).toBe(404)
  expect(await tabStatus(foreignTab.id)).toBe('Paga')
  expect((await prisma.commissionPayout.findUnique({ where: { id: foreignPayout.id } })).reversedAt).toBeNull()
})

test('prevenção: lançar no Caixa o mesmo serviço com a mesma profissional pede confirmação', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(128) }) // Corte Masculino com a Ana
  const services = () => prisma.tabItem.count({ where: { tabId: tab.tabId, itemType: 'service' } })

  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(tab.clientName) }).first().click()
  const addService = async () => {
    await page.locator('select').filter({ has: page.getByRole('option', { name: 'Profissional...' }) }).selectOption({ label: 'Ana Profissional' })
    await page.locator('select').filter({ has: page.getByRole('option', { name: 'Corte Masculino' }) }).selectOption({ label: 'Corte Masculino' })
    await page.getByTitle('Adicionar à comanda').click()
  }

  await addService()
  await expect(page.getByText(/Corte Masculino com Ana Profissional já está nesta comanda/)).toBeVisible()
  await page.locator('div.fixed').filter({ hasText: 'Confira antes de lançar' }).getByRole('button', { name: 'Cancelar' }).click()
  expect(await services(), 'cancelado: nada lançado').toBe(1)

  await addService()
  await page.getByRole('button', { name: 'Lançar mesmo assim' }).click()
  await expect.poll(services, { message: 'confirmado: lançado' }).toBe(2)
})

test('prevenção: comanda de compra de pacote não aceita outros itens', async ({ page }) => {
  const client = await createClient(salon.id, `Cliente Pacote Itens ${Date.now()}`)
  const pkg = await createPackage(page, salon, { price: 200, items: [{ service: 'Hidratação', quantity: 2, price: 100, commission: 10 }] })
  const sold = await sellPackage(page, salon, pkg.id, client) // comanda da compra, em aberto
  expect(sold.ok(), await sold.text()).toBe(true)
  const tabId = (await sold.json()).tab.UUID
  const product = await apiPost(page, salon.id, '/product', { Name: `Produto Pacote ${Date.now()}`, Price: 30, Stock: 5 })

  const res = await post(page, `/tab/${tabId}/items`, { Item_type: 'product', Product_id: product.UUID, Quantity: 1 })
  expect(res.status()).toBe(422)
  expect((await res.json()).error).toMatch(/compra de um pacote/)
  expect((await prisma.tab.findUnique({ where: { id: tabId } })).value).toBe(200)
})
