import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'
import { SEED_USERS } from '../../../backend/prisma/seedUsers.js'
import { memberId, serviceId, apiPost, createClient } from './demo.js'
import prisma from './db.js'

// Comanda em aberto de um cliente novo (só deste teste): agendamento com a Ana → confirmado →
// concluído, pela API (o caminho da tela já é testado em outros arquivos).
export async function openTabForNewClient(page, salon, { service = 'Corte Masculino', day, start = '09:00', end = '09:30', clientName, client }) {
  clientName ??= `Cliente Caixa ${Date.now()}`
  client ??= await createClient(salon.id, clientName)
  const appt = await apiPost(page, salon.id, '/appointment', {
    Client: client, Professional: await memberId(salon.id, SEED_USERS.profissional),
    Service: await serviceId(salon.id, service), Date: day, Start_time: start, End_time: end,
  })
  for (const Status of ['confirmado', 'concluido']) await apiPost(page, salon.id, `/appointment/${appt.UUID}`, { Status }, 'patch')
  const tab = await prisma.tab.findFirst({ where: { appointmentId: appt.UUID } })
  return { clientName, client, appointmentId: appt.UUID, tabId: tab.id }
}

// Preenche as formas de pagamento (PaymentMethodSplit, grupo "Formas de pagamento") — vale no
// Caixa e no "Fechar conta". legs: [{ method: 'pix'|'dinheiro'|'cartao_debito'|'cartao_credito'|'fiado', amount?, tendered? }]
export async function fillPayment(page, legs) {
  const group = page.getByRole('group', { name: 'Formas de pagamento' })
  for (let i = 1; i < legs.length; i++) await group.getByRole('button', { name: '+ Adicionar forma de pagamento' }).click()
  for (const [i, leg] of legs.entries()) {
    await group.getByLabel(`Forma de pagamento ${i + 1}`, { exact: true }).selectOption(leg.method)
    if (legs.length > 1) await group.getByLabel(`Valor da forma de pagamento ${i + 1}`).fill(leg.amount)
  }
  const cash = legs.find(l => l.method === 'dinheiro')
  if (cash?.tendered) await group.getByLabel('Valor recebido').fill(cash.tendered)
}

export const paymentsOf = (tabId) =>
  prisma.transaction.findMany({ where: { tabId, assistantId: null }, select: { method: true, grossAmount: true } })

export async function creditBalance(page, salonId, client) {
  const res = await page.request.get(`${E2E_API_URL}/api/users/${client}/credit-balance`, { headers: { 'x-salon-id': salonId } })
  expect(res.ok()).toBeTruthy()
  return Number((await res.json()).balance)
}
