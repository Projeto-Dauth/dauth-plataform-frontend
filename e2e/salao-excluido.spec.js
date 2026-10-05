import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import { apiPost } from './support/demo.js'
import { createBookingSalon, daysFromToday } from './support/bookingSalon.js'
import { paidAttendance } from './support/team.js'
import prisma from './support/db.js'
import { purgeScheduledSalons } from '../../backend/src/platform/jobs/purgeScheduledSalons.js'

// Fluxo: o dono agenda a exclusão do salão → ele vai para "Excluídos", some do trocador de salão,
// a URL e a API recusam → "Cancelar exclusão" devolve tudo, com os dados.
test('excluir salão bloqueia o acesso e cancelar a exclusão devolve', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page, `Salão Excluir E2E ${Date.now()}`)
  await apiPost(page, salon.id, '/category', { Name: 'Categoria guardada' })
  const listCategories = () => page.request.get(`${E2E_API_URL}/api/category`, { headers: { 'x-salon-id': salon.id } })

  await page.goto('/meus-saloes')
  const card = page.locator('div').filter({ hasText: salon.name }).filter({ has: page.getByRole('button', { name: 'Excluir', exact: true }) }).last()
  await card.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Confirmar exclusão' })).toBeDisabled() // precisa digitar o nome
  await page.getByPlaceholder(salon.name).fill(salon.name)
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()

  // Sai da lista de ativos e vai para "Excluídos"
  await expect(page.getByRole('button', { name: `Entrar em ${salon.name}` })).toHaveCount(0)
  await page.getByRole('button', { name: /^Excluídos/ }).click()
  await expect(page.getByText(salon.name)).toBeVisible()

  // Bloqueado: API, URL e trocador de salão
  const blocked = await listCategories()
  expect(blocked.status()).toBe(403)
  await page.goto(`/${salon.slug}/admin`)
  await expect(page).toHaveURL(/\/meus-saloes$/)
  await page.goto(`/${SEED_SALON_SLUG}/admin`)
  await page.getByRole('button', { name: 'Trocar salão' }).click()
  await expect(page.getByText('Trocar salão', { exact: true })).toBeVisible() // lista aberta (só "outros" salões)
  await expect(page.getByText(salon.name)).toHaveCount(0)

  // Cancelar a exclusão devolve o salão, com os dados
  await page.goto('/meus-saloes')
  await page.getByRole('button', { name: /^Excluídos/ }).click()
  await page.getByRole('button', { name: 'Cancelar exclusão' }).click()
  await expect(page.getByRole('button', { name: `Entrar em ${salon.name}` })).toBeVisible()
  const back = await listCategories()
  expect(back.status()).toBe(200)
  expect(JSON.stringify(await back.json())).toContain('Categoria guardada')
})

// Passados os 30 dias, a rotina apaga o salão de vez, com todos os dados dele; as contas das pessoas ficam.
test('exclusão vencida: a rotina apaga o salão e os dados dele, sem mexer em outros salões nem nas contas', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const s = await createBookingSalon(page)
  const att = await paidAttendance(page, s.salon, { professional: s.pro.id, service: 'Corte E2E', day: daysFromToday(2) })
  await apiPost(page, s.salon.id, `/users/${att.client}/credit-adjustment`, { amount: 20 })
  const product = await apiPost(page, s.salon.id, '/product', { Name: 'Produto Excluir', Price: 10, Stock: 5 })
  await apiPost(page, s.salon.id, '/product-order', { Product_id: product.UUID, Client_id: att.client, Quantity: 1 })
  const notYet = await createSalon(page, `Salão Ainda Não ${Date.now()}`)

  for (const id of [s.salon.id, notYet.id]) {
    const res = await page.request.delete(`${E2E_API_URL}/api/v1/salon/${id}`)
    expect(res.ok(), await res.text()).toBe(true)
  }
  await prisma.salon.update({ where: { id: s.salon.id }, data: { scheduledDeletionAt: new Date(Date.now() - 60_000) } }) // venceu

  const purged = await purgeScheduledSalons(prisma)
  expect(purged).toContain(s.salon.id)
  expect(purged).not.toContain(notYet.id)

  expect(await prisma.salon.findUnique({ where: { id: s.salon.id } })).toBeNull()
  const left = {
    membros: await prisma.salonMember.count({ where: { salonId: s.salon.id } }),
    agendamentos: await prisma.appointment.count({ where: { salonId: s.salon.id } }),
    comandas: await prisma.tab.count({ where: { salonId: s.salon.id } }),
    transacoes: await prisma.transaction.count({ where: { salonId: s.salon.id } }),
    servicos: await prisma.service.count({ where: { salonId: s.salon.id } }),
  }
  expect(left).toEqual({ membros: 0, agendamentos: 0, comandas: 0, transacoes: 0, servicos: 0 })
  expect(await prisma.salon.findUnique({ where: { id: notYet.id } }), 'exclusão ainda não vencida').not.toBeNull()
  expect(await prisma.user.findFirst({ where: { phone: SEED_USERS.owner.phone } }), 'conta do dono continua').not.toBeNull()
})
