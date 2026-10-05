import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'

// Usuários do seed — mesma fonte que o backend usa para criá-los.
export { SEED_USERS, SEED_SALON_SLUG } from '../../../backend/prisma/seedUsers.js'

// Login pela tela (/login). identifier = telefone ou email.
export async function loginByUi(page, identifier, password) {
  await page.goto('/login')
  await page.getByPlaceholder('(11) 9 9999-9999 ou voce@email.com').fill(identifier)
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

// Login pela API (rápido), para testes cujo assunto não é o login. O cookie de sessão fica no
// contexto do navegador e o front restaura a sessão no próximo carregamento (main.jsx → bootstrap).
export async function loginAs(page, user) {
  const res = await page.request.post(`${E2E_API_URL}/api/v1/auth/login`, {
    data: { phone: user.phone, password: user.password },
  })
  expect(res.ok(), `login de ${user.name} pela API`).toBeTruthy()
}

// Telefone único no formato do sistema, (XX) X XXXX-XXXX — para contas criadas pelo teste.
export function uniquePhone() {
  const d = String(Date.now()).slice(-8)
  return `(11) 9 ${d.slice(0, 4)}-${d.slice(4)}`
}
