import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs, loginByUi, uniquePhone } from './support/session.js'
import { createSalon } from './support/salon.js'
import { newUserPage } from './support/browser.js'
import prisma from './support/db.js'

// Fluxo: Admin convida uma pessoa nova por email; ela cria a conta pelo link do convite, confirma
// o telefone (links lidos do banco — email/WhatsApp desligados) e já entra como profissional do salão.
// Salão e pessoa próprios do teste: não mexe no papel dos usuários do seed.
test('pessoa convidada cria a conta pelo link e entra na equipe', async ({ page, browser }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  const email = `convite.${Date.now()}@e2e.test`
  const phone = uniquePhone()
  const password = 'Teste@1234'

  // Admin envia o convite
  await page.goto(`/${salon.slug}/admin/convidar-profissional`)
  await page.getByPlaceholder('Ex: Maria Oliveira').fill('Maria E2E')
  await page.getByPlaceholder('maria@exemplo.com').fill(email)
  await page.getByRole('button', { name: 'Enviar convite' }).click()
  await expect(page.getByText(`Convite enviado para ${email}`)).toBeVisible()

  // A pessoa abre o link (que iria por email) e cria a conta
  const invitation = await prisma.salonInvitation.findFirst({ where: { email } })
  const maria = await newUserPage(browser)
  await maria.goto(`/auth/accept-invite?token=${invitation.token}`)
  await maria.getByRole('button', { name: 'Criar minha conta' }).click()
  await maria.getByLabel('Telefone (será seu login)').fill(phone)
  await maria.getByLabel('Senha', { exact: true }).fill(password)
  await maria.getByLabel('Confirmar senha').fill(password)
  await maria.getByRole('button', { name: 'Criar conta' }).click()
  await expect(maria.getByRole('heading', { name: 'Confirme seu WhatsApp' })).toBeVisible()

  // Confirma o telefone pelo link (que iria por WhatsApp) e já está na equipe
  const user = await prisma.user.findFirst({ where: { phone } })
  await maria.goto(`/verificar-telefone?token=${user.verificationToken}`)
  await expect(maria.getByText(`Você já faz parte da equipe de ${salon.name}`)).toBeVisible()

  await loginByUi(maria, phone, password)
  await expect(maria).toHaveURL(/\/meus-empregos$/)
  await expect(maria.getByText(salon.name)).toBeVisible()
})
