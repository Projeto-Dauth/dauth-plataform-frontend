import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, glide, tap, typeSlow, pickSlow, field, drawer, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 2 — Cadastrar categoria e serviço.
test('02 · serviços e categorias', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  await ensureDemoData(page)
  const rec = new Recorder(browser, '02-servicos-categorias')

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`/${SEED_SALON_SLUG}/admin/servicos?tab=categorias`)
    await expect(p.getByText('Categoria 1').first()).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'Primeiro, as categorias: elas organizam os serviços', 3600)
    await tap(p, p.getByRole('button', { name: 'Nova categoria' }), 1200)
    let d = drawer(p)
    await say(p, 'Dê um nome à categoria', 2200)
    await typeSlow(p, field(d, 'Nome da categoria'), 'Categoria 5')
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 800)
    await p.getByRole('heading', { name: 'Nova categoria' }).waitFor({ state: 'hidden' })
    await say(p, 'Categoria criada', 2600)
    await glide(p, p.getByText('Categoria 5').first())
    await pause(p, 1200)

    await p.goto(`/${SEED_SALON_SLUG}/admin/servicos`)
    await expect(p.getByText('Serviço 1').first()).toBeVisible()
    await say(p, 'Agora os serviços, com duração, preço e comissão', 3600)
    await tap(p, p.getByRole('button', { name: 'Novo serviço' }), 1200)
    d = drawer(p)
    await say(p, 'Nome do serviço', 2000)
    await typeSlow(p, field(d, 'Nome do serviço'), 'Serviço 9')
    await say(p, 'Escolha a categoria', 2000)
    await pickSlow(p, field(d, 'Categoria').getByRole('button', { name: 'Selecione...' }), 'Categoria 5')
    await say(p, 'Duração do atendimento', 2000)
    await glide(p, field(d, 'Duração (HH:MM)'))
    await field(d, 'Duração (HH:MM)').fill('01:00')
    await pause(p, 1200)
    await say(p, 'Preço e comissão da profissional', 2400)
    await typeSlow(p, field(d, 'Preço (R$)'), '100')
    await typeSlow(p, field(d, 'Comissão (%)'), '40')
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 800)
    await p.getByRole('heading', { name: 'Novo serviço' }).waitFor({ state: 'hidden' })

    await say(p, 'Pronto! O serviço já pode ser agendado', 3400)
    await glide(p, p.getByRole('row').filter({ hasText: 'Serviço 9' }))
    await pause(p, 1800)
    await say(p, '', 400)
  })

  rec.build()
})
