import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, glide, tap, typeSlow, goTo, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 7 — Caixa (cobrar uma comanda, inclusive dividida) e repasse de comissões.
test('07 · caixa e comissões', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  await ensureDemoData(page)
  const rec = new Recorder(browser, '07-caixa-comissoes')
  const base = `/${SEED_SALON_SLUG}/admin`

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`${base}/caixa`)
    await expect(p.getByRole('button', { name: /Cliente 9/ }).first()).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    const painel = p.locator('[data-tour="comanda-painel"]')
    const grupo = () => p.getByRole('group', { name: 'Formas de pagamento' })
    const forma = async (n, valor) => {
      const sel = grupo().getByLabel(`Forma de pagamento ${n}`, { exact: true })
      await glide(p, sel)
      await pause(p, 400)
      await sel.selectOption(valor)
      await pause(p, 1000)
    }

    await say(p, 'No Caixa ficam as comandas em aberto de cada atendimento', 3800)
    await tap(p, p.getByRole('button', { name: /Cliente 9/ }).first(), 1500)
    await say(p, 'Escolha a forma de pagamento', 2800)
    await forma(1, 'pix')
    await tap(p, painel.getByRole('button', { name: 'Registrar pagamento' }), 700)
    await expect(p.getByText(/^Pagamento registrado/)).toBeVisible()
    await say(p, 'Pagamento registrado em um clique', 3200)

    await say(p, 'O pagamento também pode ser dividido entre formas', 3800)
    await tap(p, p.getByRole('button', { name: /Cliente 10/ }).first(), 1500)
    await tap(p, grupo().getByRole('button', { name: '+ Adicionar forma de pagamento' }), 1000)
    await forma(1, 'pix')
    await typeSlow(p, grupo().getByLabel('Valor da forma de pagamento 1'), '50')
    await forma(2, 'dinheiro')
    await typeSlow(p, grupo().getByLabel('Valor da forma de pagamento 2'), '30')
    await typeSlow(p, grupo().getByLabel('Valor recebido'), '30')
    await say(p, 'O sistema confere se a soma fecha com o valor da comanda', 3800)
    await tap(p, painel.getByRole('button', { name: 'Registrar pagamento' }), 700)
    await expect(p.getByText(/^Pagamento registrado/)).toBeVisible()
    await say(p, '', 1200)

    await goTo(p, 'Comissões', `${base}/comissoes`)
    await say(p, 'Cada pagamento já gera a comissão da profissional', 3800)
    await tap(p, p.getByRole('button', { name: 'Todas', exact: true }), 1500) // sem filtro de período
    const prof = p.locator('div').filter({ hasText: 'Profissional 1' })
      .filter({ has: p.getByRole('button', { name: 'Pagar todas' }) }).last()
    await glide(p, prof)
    await pause(p, 1500)
    await say(p, 'Para repassar, clique em "Pagar todas"', 3000)
    await tap(p, prof.getByRole('button', { name: 'Pagar todas' }), 1300)
    await say(p, 'Escolha como o repasse foi feito', 3000)
    await tap(p, p.getByRole('button', { name: 'Pix', exact: true }), 1200)
    await tap(p, p.getByRole('button', { name: 'Confirmar repasse' }), 700)
    await expect(p.getByText(/marcadas? como repassadas?/)).toBeVisible()
    await say(p, 'Repasse feito!', 2800)

    await tap(p, p.getByRole('button', { name: 'Histórico de repasses' }), 1400)
    await say(p, 'Tudo fica registrado no histórico, com data e forma de pagamento', 4200)
    await pause(p, 1800)
    await say(p, '', 400)
  })

  rec.build()
})
