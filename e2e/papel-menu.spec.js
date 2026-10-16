import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'

// Cada papel (Admin / Profissional / Cliente) tem o seu menu, em TODAS as telas — inclusive as compartilhadas
// (Perfil, Trocar senha) e as do Admin que reaproveitam telas do Profissional (Meus serviços / Meus horários).
// Bug de produção: o Admin clicava em um item da seção "Conta" e o menu virava o de Profissional, porque a tela
// lia o papel de authStore.user.role (global, de outro salão) em vez do papel no salão atual (salonStore).

const ADMIN_ONLY = ['Dashboard', 'Configurações', 'Comissões']
const PROFISSIONAL_ONLY = ['Minhas comissões', 'Comandas']

async function menuHas(page, names) {
  for (const name of names) {
    await expect(page.getByRole('link', { name, exact: true }).first(), `menu: "${name}"`).toBeVisible()
  }
}
async function menuLacks(page, names) {
  for (const name of names) {
    await expect(page.getByRole('link', { name, exact: true }), `menu não deve ter "${name}"`).toHaveCount(0)
  }
}

test('Admin mantém o menu de Admin em todos os itens da seção Conta', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const base = `/${SEED_SALON_SLUG}`
  for (const rota of ['admin/meus-servicos', 'admin/meus-horarios', 'perfil', 'trocar-senha', 'admin/configuracoes']) {
    await page.goto(`${base}/${rota}`)
    await menuHas(page, ADMIN_ONLY)
    await menuLacks(page, PROFISSIONAL_ONLY)
  }
  // pelo próprio menu, sem recarregar a página (como o usuário faz)
  await page.goto(`${base}/admin`)
  for (const item of ['Meus serviços', 'Meus horários', 'Meu perfil']) {
    await page.getByRole('link', { name: item, exact: true }).click()
    await menuHas(page, ADMIN_ONLY)
    await menuLacks(page, PROFISSIONAL_ONLY)
  }
})

test('Profissional mantém o menu de Profissional nas telas compartilhadas', async ({ page }) => {
  await loginAs(page, SEED_USERS.profissional)
  for (const rota of ['profissional/servicos', 'profissional/horarios', 'perfil', 'trocar-senha']) {
    await page.goto(`/${SEED_SALON_SLUG}/${rota}`)
    await menuHas(page, ['Minhas comissões'])
    await menuLacks(page, ['Dashboard', 'Configurações'])
  }
})

test('Cliente mantém o menu de Cliente no perfil', async ({ page }) => {
  await loginAs(page, SEED_USERS.cliente)
  await page.goto(`/${SEED_SALON_SLUG}/perfil`)
  await menuHas(page, ['Meus agendamentos'])
  await menuLacks(page, [...ADMIN_ONLY, ...PROFISSIONAL_ONLY])
})

// Trava contra a causa raiz: o papel só pode vir do salão atual (hooks/useRole). Ler `user.role` do authStore
// em qualquer tela recria o bug. Falha aqui = trocar por `useRole()`.
test('nenhuma tela lê o papel de authStore.user.role', () => {
  const offenders = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.jsx?$/.test(e.name) && !p.endsWith('useRole.js')) {
        fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((l, i) => {
          if (/\b(user|authUser)\??\.role\b/.test(l)) offenders.push(`${path.relative('src', p)}:${i + 1}`)
        })
      }
    }
  }
  walk('src')
  expect(offenders, 'use useRole() de @/hooks/useRole em vez de user.role').toEqual([])
})
