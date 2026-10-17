import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'

// Fluxo: a documentação de uso abre pelo menu "Docs" (Admin e Profissional), cada um com os seus tópicos.
test('Admin abre a documentação pelo menu e navega entre os tópicos', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  await page.goto(`/${SEED_SALON_SLUG}/admin`)
  await page.getByRole('link', { name: 'Docs', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/${SEED_SALON_SLUG}/docs$`))
  await expect(page.getByText('Documentação', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Caixa', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Caixa', level: 1 })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar ao app' }).click()
  await expect(page).toHaveURL(new RegExp(`/${SEED_SALON_SLUG}/admin$`))
})

test('Profissional vê só os tópicos dele', async ({ page }) => {
  await loginAs(page, SEED_USERS.profissional)
  await page.goto(`/${SEED_SALON_SLUG}/docs`)
  await expect(page.getByRole('button', { name: 'Comandas', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toHaveCount(0)
})

test('cliente do salão não acessa a documentação', async ({ page }) => {
  await loginAs(page, SEED_USERS.cliente)
  await page.goto(`/${SEED_SALON_SLUG}/docs`)
  await expect(page).not.toHaveURL(/\/docs$/)
})
