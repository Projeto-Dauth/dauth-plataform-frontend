import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'

// Fluxo: quem já está logado e estava dentro de um salão, ao abrir a tela de login de novo
// (ex: reabriu o navegador no endereço principal), volta direto para o painel daquele salão.
test('reabrir o sistema com a sessão ativa volta para o painel do salão', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  await page.goto(`/${SEED_SALON_SLUG}/admin`)
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible() // painel carregado: salão guardado no navegador

  await page.goto('/login')
  await expect(page).toHaveURL(new RegExp(`/${SEED_SALON_SLUG}/admin$`))
})
