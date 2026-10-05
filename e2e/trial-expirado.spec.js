import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import { apiPost } from './support/demo.js'
import prisma from './support/db.js'

// Caso comum: o trial venceu sem o dono usar o sistema (o status no banco ainda é 'trial') e ele
// abre o endereço do salão direto — a tela tem que aparecer do mesmo jeito.
test('trial vencido sem uso: abrir o salão pela URL já mostra a tela de planos', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  await prisma.salon.update({ where: { id: salon.id }, data: { trialEndsAt: new Date(Date.now() - 60_000) } })

  await page.goto(`/${salon.slug}/admin`)
  await expect(page.getByRole('heading', { name: 'Seu período de teste acabou' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('trial-encerrado.png'), fullPage: true })
})

// Fluxo: o trial acaba → ao entrar no salão o dono vê UMA tela só: "seu período de teste acabou" com
// todos os planos (mesmo seletor do upgrade) → paga → o painel volta, com os dados de antes.
test('trial expirado mostra só a tela de planos e, pago, o salão volta com os dados', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  await apiPost(page, salon.id, '/category', { Name: 'Categoria do trial' })

  // O trial terminou ontem
  await prisma.salon.update({ where: { id: salon.id }, data: { trialEndsAt: new Date(Date.now() - 86_400_000) } })
  const listCategories = () => page.request.get(`${E2E_API_URL}/api/category`, { headers: { 'x-salon-id': salon.id } })

  // Backend bloqueia (402) e suspende o salão
  const blocked = await listCategories()
  expect(blocked.status()).toBe(402)
  expect((await blocked.json()).code).toBe('TRIAL_EXPIRED')

  // Entrando pelo Meus salões: no lugar do painel, só a tela do trial encerrado com todos os planos
  await page.goto('/meus-saloes')
  await page.getByRole('button', { name: `Entrar em ${salon.name}` }).click()
  await expect(page.getByRole('heading', { name: 'Seu período de teste acabou' })).toBeVisible()
  for (const plan of ['Essencial', 'Profissional', 'Business']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${plan}`) })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toHaveCount(0) // nada do painel

  // Qualquer página do salão mostra a mesma tela
  await page.goto(`/${salon.slug}/admin/configuracoes`)
  await expect(page.getByRole('heading', { name: 'Seu período de teste acabou' })).toBeVisible()

  // Escolhe o plano e paga
  await page.getByRole('button', { name: /^Profissional/ }).click()
  await page.getByRole('button', { name: 'Continuar com Profissional' }).click()
  await page.getByRole('button', { name: '[dev] Simular pagamento' }).click()

  // O painel volta, com os dados de antes
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible()
  const paid = await prisma.salon.findUnique({ where: { id: salon.id } })
  expect({ status: paid.status, plan: paid.plan }).toEqual({ status: 'active', plan: 'profissional' })
  const unblocked = await listCategories()
  expect(unblocked.status()).toBe(200)
  expect(JSON.stringify(await unblocked.json())).toContain('Categoria do trial')
})
