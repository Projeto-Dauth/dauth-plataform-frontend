import crypto from 'node:crypto'
import { E2E_API_URL, E2E_WEBHOOK_SECRET } from '../../../backend/e2e/testEnv.js'
import { ABACATEPAY_PUBLIC_KEY } from '../../../backend/src/config/abacatepay.js'

// Gera a cobrança PIX do salão pela API (o servidor decide valor e tipo). Devolve o JSON da cobrança.
export async function createCharge(page, salonId, plan) {
  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon/checkout`, { headers: { 'x-salon-id': salonId }, data: { plan } })
  return { status: res.status(), body: await res.json() }
}

// Entrega ao servidor o evento "PIX pago" do AbacatePay, assinado como o de verdade (segredo na URL + HMAC).
export function sendPaidWebhook(page, charge, { event = 'transparent.completed' } = {}) {
  const body = JSON.stringify({ id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`, event, data: { id: charge.id, metadata: { paymentId: charge.paymentId } } })
  const signature = crypto.createHmac('sha256', ABACATEPAY_PUBLIC_KEY).update(body).digest('base64')
  return page.request.post(`${E2E_API_URL}/api/v1/webhooks/abacatepay?webhookSecret=${E2E_WEBHOOK_SECRET}`, {
    headers: { 'content-type': 'application/json', 'x-webhook-signature': signature }, data: body,
  })
}
