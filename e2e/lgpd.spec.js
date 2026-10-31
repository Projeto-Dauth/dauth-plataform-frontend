import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'

test('cadastro e criação de salão avisam que seguir é aceitar os Termos e a Política', async ({ page }) => {
  await page.goto('/register')
  const notice = page.getByText('Ao continuar, você concorda com os')
  await expect(notice).toBeVisible()
  await expect(page.getByRole('link', { name: 'Termos de Uso' }).first()).toHaveAttribute('href', '/termos')
  await expect(page.getByRole('link', { name: 'Política de Privacidade' }).first()).toHaveAttribute('href', '/privacidade')

  await loginAs(page, SEED_USERS.owner)
  await page.goto('/criar-salao')
  await expect(page.getByText('Ao continuar, você concorda com os')).toBeVisible()
})

test('exportar meus dados: a API devolve conta e salões, e o botão do Perfil baixa o arquivo', async ({ page }) => {
  await loginAs(page, SEED_USERS.cliente)
  const res = await page.request.get(`${E2E_API_URL}/api/v1/platform/me/export`)
  expect(res.status()).toBe(200)
  const data = await res.json()
  expect(data.account.name).toBe(SEED_USERS.cliente.name)
  expect(data.account.email).toBe(SEED_USERS.cliente.email)
  expect(Array.isArray(data.salons)).toBe(true)
  expect(data.salons.length).toBeGreaterThan(0)
  expect(data.salons[0]).toHaveProperty('appointments')

  await page.goto('/minha-conta')
  await page.getByRole('button', { name: 'Perfil' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar meus dados' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('meus-dados-dauth.json')
})

test('exportar sem estar logado é recusado', async ({ request }) => {
  const res = await request.get(`${E2E_API_URL}/api/v1/platform/me/export`)
  expect(res.status()).toBe(401)
})
