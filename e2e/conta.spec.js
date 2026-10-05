import { test, expect } from '@playwright/test'
import { loginAs, loginByUi, uniquePhone } from './support/session.js'
import { createClientAccount } from './support/accounts.js'
import { newUserPage } from './support/browser.js'
import prisma from './support/db.js'

// Fluxos da própria conta. Cada teste usa uma conta nova (não mexe nos usuários do seed); os links
// que iriam por WhatsApp são lidos do banco.

test('esqueci a senha: o link cria a senha nova e a antiga deixa de valer', async ({ page, browser }) => {
  const account = await createClientAccount(page)
  const newPassword = 'NovaSenha@123'

  await page.goto('/esqueci-senha')
  await page.getByPlaceholder('(11) 9 8765-4321').fill(account.phone)
  await page.getByRole('button', { name: 'Enviar link pelo WhatsApp' }).click()
  await expect(page.getByRole('heading', { name: 'Verifique seu WhatsApp' })).toBeVisible()

  const { resetToken } = await prisma.user.findFirst({ where: { phone: account.phone } })
  expect(resetToken, 'token de redefinição gravado').toBeTruthy()
  await page.goto(`/redefinir-senha?token=${resetToken}`)
  await page.getByPlaceholder('••••••••').nth(0).fill(newPassword)
  await page.getByPlaceholder('••••••••').nth(1).fill(newPassword)
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await loginByUi(page, account.phone, newPassword)
  await expect(page).toHaveURL(/\/marketplace$/)

  const other = await newUserPage(browser)
  await loginByUi(other, account.phone, account.password) // senha antiga
  await expect(other.getByText('Telefone ou senha inválidos.')).toBeVisible()

  // O link é de uso único
  await other.goto(`/redefinir-senha?token=${resetToken}`)
  await other.getByPlaceholder('••••••••').nth(0).fill('OutraSenha@123')
  await other.getByPlaceholder('••••••••').nth(1).fill('OutraSenha@123')
  await other.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(other.getByText('Link inválido ou expirado.')).toBeVisible()
})

test('troca de telefone: só vale depois de confirmar o número novo', async ({ page, browser }) => {
  const account = await createClientAccount(page)
  const newPhone = uniquePhone()
  await loginAs(page, account)

  await page.goto('/minha-conta')
  await page.getByRole('button', { name: 'Perfil', exact: true }).click()
  await page.getByRole('button', { name: 'Alterar' }).click()
  await page.getByPlaceholder('(11) 9 9999-0000').fill(newPhone)
  await page.getByRole('button', { name: 'Enviar confirmação' }).click()

  // Pendente: o login continua sendo o número antigo
  const pending = await prisma.user.findFirst({ where: { phone: account.phone } })
  await expect.poll(async () => (await prisma.user.findUnique({ where: { id: pending.id } })).pendingPhone).toBe(newPhone)
  const { phoneChangeToken } = await prisma.user.findUnique({ where: { id: pending.id } })

  // Confirma pelo link (que iria por WhatsApp para o número novo)
  await page.goto(`/confirmar-telefone?token=${phoneChangeToken}`)
  await expect(page.getByRole('heading', { name: 'Telefone alterado!' })).toBeVisible()

  const other = await newUserPage(browser)
  await loginByUi(other, newPhone, account.password)
  await expect(other).toHaveURL(/\/marketplace$/)
  const third = await newUserPage(browser)
  await loginByUi(third, account.phone, account.password) // número antigo
  await expect(third.getByText('Telefone ou senha inválidos.')).toBeVisible()
})
