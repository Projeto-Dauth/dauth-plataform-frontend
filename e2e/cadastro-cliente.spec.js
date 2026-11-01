import { test, expect } from '@playwright/test'
import { loginByUi, uniquePhone } from './support/session.js'
import prisma from './support/db.js'

// Fluxo: cliente se cadastra, não consegue entrar antes de confirmar o telefone, abre o link que
// iria pelo WhatsApp (lido do banco — o envio está desligado nos testes) e já entra logado.
test('cliente se cadastra, confirma o telefone pelo link e já entra logado', async ({ page }) => {
  const phone = uniquePhone()
  const password = 'Teste@1234'

  await page.goto('/register')
  await page.getByRole('button', { name: /^Cliente/ }).click()
  await page.getByPlaceholder('Seu nome').fill('Cliente E2E')
  await page.getByPlaceholder('(11) 9 8765-4321').fill(phone)
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(password)
  await page.getByPlaceholder('Repita a senha').fill(password)
  await page.getByRole('button', { name: 'Criar como Cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Confirme seu WhatsApp' })).toBeVisible()

  // Antes de confirmar, o login é recusado
  await loginByUi(page, phone, password)
  await expect(page.getByText('Conta aguardando ativação.')).toBeVisible()

  const user = await prisma.user.findFirst({ where: { phone }, select: { verificationToken: true } })
  expect(user?.verificationToken, 'token de confirmação gravado').toBeTruthy()

  await page.goto(`/verificar-telefone?token=${user.verificationToken}`)
  // O link já abre a sessão (sem digitar a senha). Conta nova, sem vínculo: cai em Meus salões pedindo o código do salão
  await expect(page).toHaveURL(/\/meus-saloes$/)
  await expect(page.getByRole('heading', { name: 'Você ainda não tem vínculo com nenhum salão' })).toBeVisible()
})
