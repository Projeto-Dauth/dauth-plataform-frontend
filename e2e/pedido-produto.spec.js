import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { pick } from './support/agenda.js'
import { demoSalon, apiPost, createClient } from './support/demo.js'
import prisma from './support/db.js'

// Venda de produto fora de comanda (Pedidos de Produtos / aba Produtos do Caixa): pago baixa o estoque e grava o
// lançamento financeiro; cancelado, não; Mensalista fica em aberto em Mensalistas.
test('pedido de produto avulso: pagar baixa o estoque, cancelar não', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const product = await apiPost(page, salon.id, '/product', { Name: `Máscara E2E ${Date.now()}`, Price: 25, Stock: 10 })
  const clientName = `Cliente Pedido ${Date.now()}`
  await createClient(salon.id, clientName)

  const newOrder = async (quantity) => {
    await page.getByRole('button', { name: 'Novo pedido' }).click()
    const drawer = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Novo pedido' }) })
      .filter({ has: page.getByRole('button', { name: 'Criar pedido' }) }).last()
    await drawer.getByRole('combobox').first().selectOption(product.UUID)
    await pick(drawer.getByRole('button', { name: 'Selecione…' }), clientName, 'Cliente Pedido')
    await drawer.locator('input[type="number"]').fill(String(quantity))
    await drawer.getByRole('combobox').nth(1).selectOption('pix')
    await drawer.getByRole('button', { name: 'Criar pedido' }).click()
    await expect(page.getByText('Pedido criado com sucesso')).toBeVisible()
  }
  const openOrder = async (quantity) => {
    await page.getByRole('row').filter({ hasText: product.Name }).filter({ has: page.getByRole('cell', { name: String(quantity), exact: true }) })
      .getByRole('button', { name: 'Ver detalhes' }).click()
  }

  await page.goto(`/${SEED_SALON_SLUG}/admin/pedidos-produtos`)
  await newOrder(2)
  await newOrder(3)

  // Paga o de 2 unidades
  await openOrder(2)
  await page.getByRole('button', { name: 'Marcar como pago' }).click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByText('Pedido marcado como pago')).toBeVisible()

  // Cancela o de 3 unidades
  await openOrder(3)
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  await page.getByRole('button', { name: 'Cancelar pedido' }).last().click() // confirmação do modal
  await expect(page.getByText('Pedido cancelado')).toBeVisible()

  const orders = await prisma.productOrder.findMany({ where: { productId: product.UUID }, orderBy: { quantity: 'asc' } })
  expect(orders.map(o => [o.quantity, o.status, o.paymentMethod])).toEqual([[2, 'pago', 'pix'], [3, 'cancelado', 'pix']])
  expect((await prisma.product.findUnique({ where: { id: product.UUID } })).stock).toBe(8) // só as 2 pagas saíram
  // A venda entra no financeiro (antes o "Marcar como pago" não gravava lançamento nenhum)
  const sale = await prisma.transaction.findMany({ where: { clientId: orders[0].clientId, tabId: null }, select: { method: true, grossAmount: true, payment: true } })
  expect(sale).toEqual([{ method: 'pix', grossAmount: 50, payment: true }])
})

async function newProductAndOrder(page, salon, { quantity = 2, method } = {}) {
  const product = await apiPost(page, salon.id, '/product', { Name: `Óleo E2E ${Date.now()}`, Price: 30, Stock: 10 })
  const clientName = `Cliente Pedido ${Date.now()}`
  const client = await createClient(salon.id, clientName)
  const order = await apiPost(page, salon.id, '/product-order', { Product_id: product.UUID, Client_id: client, Quantity: quantity, ...(method ? { Payment_method: method } : {}) })
  return { product, client, clientName, order }
}

test('pedido pago como Mensalista no Caixa: baixa o estoque e o valor fica em aberto até quitar', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const { product, client, clientName, order } = await newProductAndOrder(page, salon)

  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa?tab=produtos`)
  await page.getByRole('button', { name: new RegExp(clientName) }).first().click()
  await page.getByRole('button', { name: /Mensalista — cobrar depois/ }).click()
  await page.getByRole('button', { name: 'Registrar mensalidade' }).click()
  await expect(page.getByText('Registrado como mensalidade')).toBeVisible()

  expect((await prisma.productOrder.findUnique({ where: { id: order.UUID } })).status).toBe('pago')
  expect((await prisma.product.findUnique({ where: { id: product.UUID } })).stock).toBe(8)
  const [fiado] = await prisma.transaction.findMany({ where: { clientId: client, method: 'fiado' } })
  expect({ gross: fiado.grossAmount, payment: fiado.payment }).toEqual({ gross: 60, payment: false })

  await page.goto(`/${SEED_SALON_SLUG}/admin/mensalistas`)
  const card = page.locator('div').filter({ hasText: clientName }).filter({ has: page.getByRole('button', { name: 'Quitar' }) }).last()
  await card.getByRole('button', { name: 'Quitar' }).click()
  await page.getByRole('button', { name: 'Pix', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(page.getByText(`Mensalidade de ${clientName} paga com sucesso!`)).toBeVisible()
  expect((await prisma.transaction.findUnique({ where: { id: fiado.id } })).payment).toBe(true)
})

test('valor do pedido: muda enquanto encomendado e vale no pagamento; pago não muda mais; sem forma de pagamento não paga', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const { client, order } = await newProductAndOrder(page, salon)
  const patch = (data) => page.request.patch(`${E2E_API_URL}/api/product-order/${order.UUID}`, { headers: { 'x-salon-id': salon.id }, data })

  expect((await patch({ Status: 'pago' })).status(), 'pedido sem forma de pagamento').toBe(422)
  const edited = await patch({ Unit_price: 25 })
  expect(edited.ok()).toBe(true)
  expect(await edited.json()).toMatchObject({ Unit_price: 25, Total_price: 50 })

  expect((await patch({ Status: 'pago', Payment_method: 'dinheiro' })).ok()).toBe(true)
  const sale = await prisma.transaction.findMany({ where: { clientId: client, tabId: null }, select: { method: true, grossAmount: true } })
  expect(sale).toEqual([{ method: 'dinheiro', grossAmount: 50 }])

  expect((await patch({ Unit_price: 10 })).status(), 'pedido já pago').toBe(409)
  expect((await patch({ Status: 'pago', Payment_method: 'pix' })).ok(), 'pagar de novo').toBe(false)
  expect(await prisma.transaction.count({ where: { clientId: client, tabId: null } })).toBe(1)
})
