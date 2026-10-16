import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, glide, tap, typeSlow, pickSlow, chooseSlow, field, drawer, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 3 — Criar um pacote e vendê-lo a um cliente.
test('03 · pacotes', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  await ensureDemoData(page)
  const rec = new Recorder(browser, '03-pacotes')

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`/${SEED_SALON_SLUG}/admin/combos`)
    await expect(p.getByRole('heading', { name: 'Pacote 1' })).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'Um pacote reúne várias sessões por um preço fechado', 3800)
    await glide(p, p.getByRole('heading', { name: 'Pacote 1' }))
    await pause(p, 1500)
    await tap(p, p.getByRole('button', { name: 'Novo pacote' }).first(), 1300)
    let d = drawer(p)

    await say(p, 'Nome e preço do pacote', 2400)
    await typeSlow(p, field(d, 'Nome do pacote'), 'Pacote 2')
    await typeSlow(p, field(d, 'Preço (R$)'), '400')

    await say(p, 'Adicione os serviços que fazem parte', 2800)
    await chooseSlow(p, field(d, 'Serviço'), 'Serviço 1')
    const qtd = field(d, 'Quantidade')
    await glide(p, qtd)
    await qtd.fill('')
    await qtd.pressSequentially('4', { delay: 150 })
    await pause(p, 900)
    await say(p, 'Valor de cada sessão e a comissão da profissional', 3200)
    await typeSlow(p, field(d, 'Valor/sessão (R$)'), '100')
    await typeSlow(p, field(d, 'Comissão (%)'), '40')
    await tap(p, d.getByRole('button', { name: 'Adicionar serviço' }), 1400)
    await say(p, 'A soma das sessões precisa bater com o preço do pacote', 3600)
    await pause(p, 800)
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 900)
    await p.getByRole('heading', { name: 'Novo pacote' }).waitFor({ state: 'hidden' })
    await expect(p.getByRole('heading', { name: 'Pacote 2' })).toBeVisible()
    await say(p, 'Pacote criado', 2800)

    const cardPkg = p.locator('div').filter({ has: p.getByRole('heading', { name: 'Pacote 2' }) })
      .filter({ has: p.getByRole('button', { name: 'Vender' }) }).last()
    await say(p, 'Agora é só vender para um cliente', 2800)
    await tap(p, cardPkg.getByRole('button', { name: 'Vender' }), 1300)
    await pickSlow(p, p.getByRole('button', { name: 'Selecionar cliente…' }), 'Cliente 2')
    await tap(p, p.getByRole('button', { name: 'Confirmar venda' }), 600)
    await expect(p.getByText(/vendido! Registre o pagamento na Caixa/)).toBeVisible()
    await say(p, 'Venda registrada: o pagamento é feito no Caixa', 3800)

    await tap(p, p.getByRole('button', { name: 'Pacotes vendidos' }), 1400)
    await say(p, 'Em "Pacotes vendidos" você acompanha cada cliente', 3600)
    await glide(p, p.getByText('Cliente 2').first())
    await pause(p, 1800)
    await say(p, '', 400)
  })

  rec.build()
})
