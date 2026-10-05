import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'
import { uniquePhone, loginAs } from './session.js'
import prisma from './db.js'

// Nova conta de cliente pelo fluxo real (cadastro + confirmação do telefone com o token lido do banco),
// SEM logar. Para testes que mexem na senha/telefone de alguém sem afetar os usuários do seed.
export async function createClientAccount(page, name = `Cliente Conta ${Date.now()}`) {
  const account = { name, phone: uniquePhone(), password: 'Teste@1234' }
  const api = `${E2E_API_URL}/api/v1/auth`
  const reg = await page.request.post(`${api}/register`, { data: { ...account, platformRole: 'Cliente' } })
  expect(reg.ok(), `cadastro do cliente: ${await reg.text()}`).toBeTruthy()
  const { verificationToken } = await prisma.user.findFirst({ where: { phone: account.phone } })
  const ver = await page.request.post(`${api}/verify-phone`, { data: { token: verificationToken } })
  expect(ver.ok(), 'confirmação do telefone do cliente').toBeTruthy()
  return account
}

// Novo dono de salão pelo fluxo real (cadastro + confirmação do email, com o token lido do banco),
// já logado no `page`. Para testes que precisam de um dono que não seja o do seed.
export async function createOwner(page, name = `Dono E2E ${Date.now()}`) {
  const owner = { name, email: `dono.${Date.now()}@e2e.test`, phone: uniquePhone(), password: 'Teste@1234' }
  const api = `${E2E_API_URL}/api/v1/auth`

  const reg = await page.request.post(`${api}/register`, { data: { ...owner, platformRole: 'SalonOwner' } })
  expect(reg.ok(), `cadastro do dono: ${await reg.text()}`).toBeTruthy()
  const { verificationToken } = await prisma.user.findFirst({ where: { email: owner.email } })
  const ver = await page.request.post(`${api}/verify-email`, { data: { token: verificationToken } })
  expect(ver.ok(), 'confirmação do email do dono').toBeTruthy()

  await loginAs(page, owner)
  return owner
}
