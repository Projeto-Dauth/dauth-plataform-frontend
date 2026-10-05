import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'
import { apiPost, serviceId } from './demo.js'
import prisma from './db.js'

// Modelo de pacote pela API. items: [{ service: 'Hidratação', quantity, price?, commission? }]
// (price/commission omitidos = item incompleto, como quando o pacote ainda está sendo montado).
export async function createPackage(page, salon, { name = `Pacote E2E ${Date.now()}`, price, items }) {
  const pkg = await apiPost(page, salon.id, '/package', { Name: name, Price: price })
  for (const it of items) {
    await apiPost(page, salon.id, `/package/${pkg.UUID}/items`, {
      Service_id: await serviceId(salon.id, it.service), Quantity: it.quantity,
      ...(it.price !== undefined ? { Unit_price: it.price } : {}),
      ...(it.commission !== undefined ? { Commission_override: it.commission } : {}),
    })
  }
  return { id: pkg.UUID, name }
}

export const sellPackage = (page, salon, pkgId, client) =>
  page.request.post(`${E2E_API_URL}/api/package/${pkgId}/sell`, { headers: { 'x-salon-id': salon.id }, data: { Client_id: client } })

// Vende e paga a comanda da compra (Pix): o pacote fica 'ativo'.
export async function sellAndPay(page, salon, pkgId, client) {
  const res = await sellPackage(page, salon, pkgId, client)
  expect(res.ok(), `vender pacote: ${await res.text()}`).toBeTruthy()
  const { tab, client_package } = await res.json()
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.UUID], client_id: client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: tab.Value }],
  })
  return client_package.UUID
}

export const clientPackageStatus = async (id) => (await prisma.clientPackage.findUnique({ where: { id } })).status
