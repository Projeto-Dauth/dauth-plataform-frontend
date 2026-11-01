import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { uniquePhone } from './support/session.js'
import prisma from './support/db.js'

// Fluxo: quem já é cliente tenta se cadastrar como dono de salão com o mesmo telefone. A tela oferece
// usar a conta existente (pede a senha dela); nada muda até o email ser confirmado. No clique do link,
// o email real substitui o interno, a conta vira de dono e já entra logada.
test('cliente já cadastrado vira dono de salão com a mesma conta', async ({ page }) => {
  const phone = uniquePhone()
  const password = 'Cliente@1234'
  const email = `dono-${Date.now()}@e2e.test`

  // Conta de cliente já ativa (cadastro + confirmação do telefone pela API)
  const reg = await page.request.post(`${E2E_API_URL}/api/v1/auth/register`, { data: { name: 'Cliente Vira Dono', phone, password } })
  expect(reg.ok(), 'cadastro do cliente').toBeTruthy()
  const pending = await prisma.user.findFirst({ where: { phone }, select: { verificationToken: true } })
  const ver = await page.request.post(`${E2E_API_URL}/api/v1/auth/verify-phone`, { data: { token: pending.verificationToken } })
  expect(ver.ok(), 'confirmação do telefone').toBeTruthy()
  await page.context().clearCookies()

  // Cadastro de dono (aba padrão) com o mesmo telefone
  await page.goto('/register')
  await page.getByPlaceholder('Seu nome').fill('Cliente Vira Dono')
  await page.getByPlaceholder('voce@email.com').fill(email)
  await page.getByPlaceholder('(11) 9 8765-4321').fill(phone)
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('Outra@1234')
  await page.getByPlaceholder('Repita a senha').fill('Outra@1234')
  await page.getByRole('button', { name: 'Criar como Dono de Salão' }).click()
  await expect(page.getByRole('heading', { name: 'Você já tem uma conta' })).toBeVisible()

  // Senha errada é recusada
  await page.getByPlaceholder('A senha que você usa para entrar').fill('Errada@1234')
  await page.getByRole('button', { name: 'Criar salão com esta conta' }).click()
  await expect(page.getByText('Telefone ou senha inválidos.')).toBeVisible()

  await page.getByPlaceholder('A senha que você usa para entrar').fill(password)
  await page.getByRole('button', { name: 'Criar salão com esta conta' }).click()
  await expect(page.getByRole('heading', { name: 'Confirme seu email' })).toBeVisible()

  // Antes de confirmar, nada muda na conta
  const before = await prisma.user.findFirst({ where: { phone }, select: { email: true, platformRole: true, pendingEmail: true, emailChangeToken: true } })
  expect(before.platformRole).toBe('Cliente')
  expect(before.email).not.toBe(email)
  expect(before.pendingEmail).toBe(email)

  // Link do email: vira dono e já entra logado
  await page.goto(`/verificar-email?token=${before.emailChangeToken}`)
  await expect(page).toHaveURL(/\/meus-saloes$/)
  await expect(page.getByRole('button', { name: 'Criar meu salão' })).toBeVisible()

  const after = await prisma.user.findFirst({ where: { phone }, select: { email: true, platformRole: true, pendingEmail: true, emailChangeToken: true } })
  expect(after).toEqual({ email, platformRole: 'SalonOwner', pendingEmail: null, emailChangeToken: null })
})
