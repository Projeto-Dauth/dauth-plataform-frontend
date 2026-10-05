import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from './support/session.js'

// Fluxo: dono cria um salão em trial e entra direto na área de Admin dele.
test('dono cria salão em trial e entra no painel do salão', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const name = `Salão E2E ${Date.now()}`

  await page.goto('/criar-salao')
  await page.getByPlaceholder('Ex: Salão Bela Arte').fill(name)
  await page.getByRole('button', { name: 'Criar salão e entrar' }).click() // Trial é o plano padrão

  // A URL do salão é gerada a partir do nome (ver "URL do salão gerada automaticamente")
  await expect(page).toHaveURL(/\/salao-e2e-\d+\/admin$/)

  // O salão novo aparece em Meus salões como trial
  await page.goto('/meus-saloes')
  await expect(page.getByText(name)).toBeVisible()
})
