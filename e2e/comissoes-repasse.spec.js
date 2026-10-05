import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { demoSalon } from './support/demo.js'
import { createProfessional, paidAttendance } from './support/team.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Repasse de comissões (Admin → Comissões). Cada teste tem uma profissional só sua, para o
// "Pagar todas" não pegar comissões criadas por outros testes.
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

const bulkPay = (page, salonId, pro, txs) => page.request.post(`${E2E_API_URL}/api/transaction/commissions/bulk-pay`, {
  headers: { 'x-salon-id': salonId },
  data: { transaction_ids: txs.map(t => t.id), method: 'pix', professional_id: pro.id, professional_name: pro.name, total_amount: 0 },
})
const payoutsOf = (pro) => prisma.commissionPayout.findMany({ where: { professionalId: pro.id } })
const isPaid = async (tx) => (await prisma.transaction.findUnique({ where: { id: tx.id } })).commissionPaid

function professionalCard(page, name) {
  return page.locator('div').filter({ hasText: name }).filter({ has: page.getByRole('button', { name: 'Pagar todas' }) }).last()
}

test('pagar todas: repassa as comissões da profissional e o repasse aparece no histórico', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const a = await paidAttendance(page, salon, { professional: pro.id, day: testDay(60), start: '09:00', end: '09:30' })
  const b = await paidAttendance(page, salon, { professional: pro.id, day: testDay(60), start: '10:00', end: '10:30' })
  const total = Number((a.tx.commissionAmount + b.tx.commissionAmount).toFixed(2))
  expect(total).toBeGreaterThan(0)

  await page.goto(`/${SEED_SALON_SLUG}/admin/comissoes`)
  await professionalCard(page, pro.name).getByRole('button', { name: 'Pagar todas' }).click()
  await page.getByRole('button', { name: 'Pix', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar repasse' }).click()
  await expect(page.getByText('2 comissões marcadas como repassadas')).toBeVisible()

  expect([await isPaid(a.tx), await isPaid(b.tx)]).toEqual([true, true])
  const payouts = await payoutsOf(pro)
  expect(payouts.map(p => ({ method: p.method, total: p.totalAmount, count: p.transactionCount })))
    .toEqual([{ method: 'pix', total, count: 2 }])

  await page.getByRole('button', { name: 'Histórico de repasses' }).click()
  const entry = page.getByRole('button').filter({ hasText: pro.name })
  await expect(entry).toContainText('Pix')
  await expect(entry).toContainText('por Admin Demo')
})

test('marcar repassado: só aquela comissão é repassada, com forma de pagamento no histórico', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const a = await paidAttendance(page, salon, { professional: pro.id, day: testDay(61), start: '09:00', end: '09:30' })
  const b = await paidAttendance(page, salon, { professional: pro.id, day: testDay(61), start: '10:00', end: '10:30' })

  await page.goto(`/${SEED_SALON_SLUG}/admin/comissoes`)
  await page.getByRole('row').filter({ hasText: a.clientName }).getByRole('button', { name: 'Marcar repassado' }).click()
  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar repasse' }).click()
  await expect(page.getByText('1 comissão marcada como repassada')).toBeVisible()

  expect({ a: await isPaid(a.tx), b: await isPaid(b.tx) }).toEqual({ a: true, b: false })
  expect((await payoutsOf(pro)).map(p => p.method)).toEqual(['dinheiro'])

  await page.getByRole('button', { name: 'Histórico de repasses' }).click()
  await expect(page.getByRole('button').filter({ hasText: pro.name })).toContainText('Dinheiro')
})

test('borda: repassar a mesma comissão duas vezes (ao mesmo tempo ou depois) gera um repasse só', async ({ page }) => {
  // Ex: duplo clique em "Confirmar repasse", ou duas abas abertas
  const pro = await createProfessional(salon.id)
  const a = await paidAttendance(page, salon, { professional: pro.id, day: testDay(62) })

  const results = await Promise.all([bulkPay(page, salon.id, pro, [a.tx]), bulkPay(page, salon.id, pro, [a.tx])])
  expect(results.filter(r => r.ok()).length, 'só um dos dois pedidos simultâneos passa').toBe(1)

  const again = await bulkPay(page, salon.id, pro, [a.tx])
  expect(again.status(), 'repassar de novo depois também é recusado').toBe(409)
  expect((await again.json()).error).toMatch(/já foram repassadas/)
  expect((await payoutsOf(pro)).length).toBe(1)
})

test('borda: comissão de outro salão no repasse é recusada e nada muda', async ({ page }) => {
  // Admin do Salão Demo tenta marcar como repassada uma comissão que é de outro salão
  const other = await createSalon(page)
  const otherPro = await createProfessional(other.id)
  const foreign = await prisma.transaction.create({
    data: { salonId: other.id, method: 'pix', grossAmount: 100, netAmount: 100, commissionAmount: 40, payment: true, paymentDate: new Date(), professionalId: otherPro.id },
  })

  const res = await bulkPay(page, salon.id, otherPro, [foreign])
  expect(res.ok()).toBe(false)
  expect(await isPaid(foreign)).toBe(false)
  expect((await payoutsOf(otherPro)).length).toBe(0)
})

test('marcar como repassada direto na transação (PATCH) também vai para o histórico, com quem e como pagou', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const a = await paidAttendance(page, salon, { professional: pro.id, day: testDay(63) })
  const patch = (data) => page.request.patch(`${E2E_API_URL}/api/transaction/${a.tx.id}`, { headers: { 'x-salon-id': salon.id }, data })

  expect((await patch({ Commission_paid: true })).status(), 'sem a forma de pagamento do repasse').toBe(422)
  expect((await patch({ Commission_paid: true, Commission_method: 'cartao_debito' })).ok()).toBe(true)
  expect(await isPaid(a.tx)).toBe(true)
  expect((await payoutsOf(pro)).map(p => ({ method: p.method, count: p.transactionCount }))).toEqual([{ method: 'cartao_debito', count: 1 }])

  const undo = await patch({ Commission_paid: false })
  expect(undo.status(), 'repasse registrado não pode ser desfeito').toBe(409)
  expect(await isPaid(a.tx)).toBe(true)

  await page.goto(`/${SEED_SALON_SLUG}/admin/comissoes`)
  await page.getByRole('button', { name: 'Histórico de repasses' }).click()
  const entry = page.getByRole('button').filter({ hasText: pro.name })
  await expect(entry).toContainText('Débito')
  await expect(entry).toContainText('por Admin Demo')
})
