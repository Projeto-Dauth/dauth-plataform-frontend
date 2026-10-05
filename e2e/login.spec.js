import { test, expect } from '@playwright/test'
import { SEED_USERS, loginByUi } from './support/session.js'

// Fluxo: login pela tela. Cada perfil cai na sua página inicial (ver "Fluxo de login" no CLAUDE.md).
test.describe('Login', () => {
  test('dono do salão entra por email e vai para Meus salões', async ({ page }) => {
    const { email, password } = SEED_USERS.owner
    await loginByUi(page, email, password)
    await expect(page).toHaveURL(/\/meus-saloes$/)
    await expect(page.getByText('Salão Demo')).toBeVisible()
  })

  test('profissional entra por telefone e vai para Meus empregos', async ({ page }) => {
    const { phone, password } = SEED_USERS.profissional
    await loginByUi(page, phone, password)
    await expect(page).toHaveURL(/\/meus-empregos$/)
    await expect(page.getByText('Salão Demo')).toBeVisible()
  })

  test('cliente entra por telefone e vai para o Marketplace', async ({ page }) => {
    const { phone, password } = SEED_USERS.cliente
    await loginByUi(page, phone, password)
    await expect(page).toHaveURL(/\/marketplace$/)
  })

  test('senha errada mostra erro e continua no login', async ({ page }) => {
    await loginByUi(page, SEED_USERS.cliente.phone, 'SenhaErrada@1')
    await expect(page.getByText('Telefone ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})
