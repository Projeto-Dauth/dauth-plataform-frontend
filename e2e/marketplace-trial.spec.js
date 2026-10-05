import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import { newUserPage } from './support/browser.js'
import prisma from './support/db.js'

// Regra: salão em trial nunca aparece no marketplace (nem para o próprio dono, que é membro dele).
// Só depois de pago (status 'active') ele passa a ser listado.
test('salão em trial não aparece no marketplace; ativo, aparece', async ({ page, browser }) => {
  await loginAs(page, SEED_USERS.owner)
  const name = `Salão Vitrine E2E ${Date.now()}`
  const salon = await createSalon(page, name)

  const search = async (who) => {
    await who.goto('/marketplace')
    await who.getByPlaceholder(/Buscar/).fill(name)
    await who.getByPlaceholder(/Buscar/).press('Enter')
  }

  // Em trial: nem o dono (membro) nem um cliente encontram
  const cliente = await newUserPage(browser)
  await loginAs(cliente, SEED_USERS.cliente)
  for (const who of [page, cliente]) {
    await search(who)
    await expect(who.getByText('Nenhum salão encontrado')).toBeVisible()
    await expect(who.getByText(name, { exact: true })).toHaveCount(0) // o título '0 resultados para "…"' repete o termo
  }

  // Pago (ativo): passa a aparecer
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', plan: 'essencial' } })
  await search(cliente)
  await expect(cliente.getByText(name, { exact: true })).toBeVisible()
})
