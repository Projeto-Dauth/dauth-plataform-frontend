import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createBookingSalon } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Ficha do cliente (Admin): o telefone é o login da pessoa em todos os salões, então o Admin só vê.
// "Redefinir senha" manda o link de nova senha no WhatsApp da cliente (o do teste é desligado: o token fica no banco);
// o Admin não define nem conhece a senha.
test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

async function openJoaoSheet(page, s) {
  await page.goto(`/${s.salon.slug}/admin/usuarios`)
  await page.getByPlaceholder('Buscar por nome ou telefone…').fill('João')
  await page.getByRole('row', { name: /João/ }).first().click()
}

test('telefone do cliente é só leitura na ficha e a API ignora a troca', async ({ page }) => {
  const s = await createBookingSalon(page)
  await openJoaoSheet(page, s)
  await page.getByRole('button', { name: /Editar cliente/ }).first().click()

  const phone = page.getByLabel('Telefone')
  await expect(phone).toHaveValue(SEED_USERS.cliente.phone)
  await expect(phone).toHaveAttribute('readonly', '')

  // Direto pela API a troca é recusada e o telefone não muda (o nome continua editável)
  const edit = (data) => page.request.patch(`${E2E_API_URL}/api/users/${s.joao}`, { headers: { 'x-salon-id': s.salon.id }, data })
  const refused = await edit({ Name: 'João Cliente', Phone: '(11) 9 0000-0000' })
  expect(refused.status()).toBe(422)
  expect((await refused.json()).error).toMatch(/só ela pode trocar/)
  expect((await edit({ Name: 'João Cliente' })).ok(), 'editar só o nome').toBe(true)
  const user = await prisma.user.findFirst({ where: { salonMembers: { some: { id: s.joao } } } })
  expect(user.phone).toBe(SEED_USERS.cliente.phone)
})

test('Redefinir senha manda o link para a cliente e não mexe na senha atual', async ({ page }) => {
  const s = await createBookingSalon(page)
  const joao = await prisma.user.findFirst({ where: { salonMembers: { some: { id: s.joao } } } })
  expect(joao.resetToken).toBeNull()

  await openJoaoSheet(page, s)
  await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click()
  await expect(page.getByText(/receberá um link no WhatsApp/)).toBeVisible()
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByText(/Enviamos o link de nova senha para o WhatsApp de/)).toBeVisible()

  const after = await prisma.user.findUnique({ where: { id: joao.id } })
  expect(after.resetToken, 'link gerado').toBeTruthy()

  // A senha de antes continua valendo até a própria cliente trocar
  const login = await page.request.post(`${E2E_API_URL}/api/v1/auth/login`, { data: { phone: SEED_USERS.cliente.phone, password: SEED_USERS.cliente.password } })
  expect(login.ok(), 'senha atual segue valendo').toBe(true)

  await prisma.user.update({ where: { id: joao.id }, data: { resetToken: null, resetExpiresAt: null } })
})
