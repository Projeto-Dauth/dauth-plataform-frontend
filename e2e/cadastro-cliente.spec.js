import { test, expect } from '@playwright/test'
import { loginByUi, uniquePhone } from './support/session.js'
import prisma from './support/db.js'

// Fluxo: cliente se cadastra, não consegue entrar antes de confirmar o telefone, abre o link que
// iria pelo WhatsApp (lido do banco — o envio está desligado nos testes) e aí entra.
test('cliente se cadastra, confirma o telefone pelo link e entra', async ({ page }) => {
  const phone = uniquePhone()
  const password = 'Teste@1234'

  await page.goto('/register')
  await page.getByRole('button', { name: /^Cliente/ }).click()
  await page.getByPlaceholder('Seu nome').fill('Cliente E2E')
  await page.getByPlaceholder('(11) 9 8765-4321').fill(phone)
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(password)
  await page.getByRole('button', { name: 'Criar como Cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Confirme seu WhatsApp' })).toBeVisible()

  // Antes de confirmar, o login é recusado
  await loginByUi(page, phone, password)
  await expect(page.getByText('Conta aguardando ativação.')).toBeVisible()

  const user = await prisma.user.findFirst({ where: { phone }, select: { verificationToken: true } })
  expect(user?.verificationToken, 'token de confirmação gravado').toBeTruthy()

  await page.goto(`/verificar-telefone?token=${user.verificationToken}`)
  await expect(page.getByRole('heading', { name: 'Telefone confirmado!' })).toBeVisible()

  await loginByUi(page, phone, password)
  await expect(page).toHaveURL(/\/marketplace$/)
})
