import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, glide, tap, typeQuick, pickQuick, field, drawer, goTo, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Apresentação do Dauth (sem legenda, ritmo ágil): categoria → serviço → profissional → agendamento →
// confirmar e concluir pela agenda → Caixa (pagar) → comissão.
test('apresentação · dauth', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  const { days } = await ensureDemoData(page)
  const rec = new Recorder(browser, 'apresentacao-dauth')
  const base = `/${SEED_SALON_SLUG}/admin`

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`${base}/servicos?tab=categorias`)
    await expect(p.getByText('Categoria 1').first()).toBeVisible()
    ready()
    await pause(p, 800)

    // 1. Categoria
    await tap(p, p.getByRole('button', { name: 'Nova categoria' }), 700)
    let d = drawer(p)
    await typeQuick(p, field(d, 'Nome da categoria'), 'Categoria 5')
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 500)
    await p.getByRole('heading', { name: 'Nova categoria' }).waitFor({ state: 'hidden' })
    await glide(p, p.getByText('Categoria 5').first())
    await pause(p, 800)

    // 2. Serviço
    await tap(p, p.getByRole('button', { name: 'Serviços', exact: true }).last(), 800) // aba Serviços
    await expect(p.getByText('Serviço 1').first()).toBeVisible()
    await tap(p, p.getByRole('button', { name: 'Novo serviço' }), 700)
    d = drawer(p)
    await typeQuick(p, field(d, 'Nome do serviço'), 'Serviço 9')
    await pickQuick(p, field(d, 'Categoria').getByRole('button', { name: 'Selecione...' }), 'Categoria 5')
    await glide(p, field(d, 'Duração (HH:MM)'))
    await field(d, 'Duração (HH:MM)').fill('01:00')
    await pause(p, 400)
    await typeQuick(p, field(d, 'Preço (R$)'), '100')
    await typeQuick(p, field(d, 'Comissão (%)'), '40')
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 500)
    await p.getByRole('heading', { name: 'Novo serviço' }).waitFor({ state: 'hidden' })

    // 3. Atribui a profissional
    const linha = p.getByRole('row').filter({ hasText: 'Serviço 9' })
    await tap(p, linha.getByRole('button', { name: 'Gerenciar' }), 900)
    d = drawer(p)
    await pickQuick(p, field(d, 'Profissional').getByRole('button', { name: 'Selecione...' }), 'Profissional 2')
    await tap(p, d.getByRole('button', { name: 'Vincular' }), 700)
    await expect(d.getByText('Profissional 2').first()).toBeVisible()
    await pause(p, 900)
    await p.mouse.click(60, 400) // fecha o painel
    await pause(p, 500)

    // 4. Agendamento
    await p.goto(base)
    await p.getByLabel('Ir para a data').fill(days.agenda)
    await expect(p.getByRole('button', { name: /Cliente 2/ })).toBeVisible()
    await pause(p, 600)
    await tap(p, p.getByRole('button', { name: 'Agendar 11:00 com Profissional 2' }), 900)
    d = p.locator('div')
      .filter({ has: p.getByRole('heading', { name: 'Novo agendamento' }) })
      .filter({ has: p.getByRole('button', { name: 'Confirmar agendamento' }) })
      .last()
    await pickQuick(p, d.getByRole('button', { name: 'Selecionar cliente…' }), 'Cliente 12')
    await pickQuick(p, d.getByRole('button', { name: 'Selecionar serviço…' }).first(), 'Serviço 9')
    await pause(p, 600)
    await tap(p, d.getByRole('button', { name: 'Confirmar agendamento' }), 500)
    await p.getByText('Agendamento criado!').waitFor()
    await pause(p, 900)

    // 5. Confirmar e concluir pelo menu do agendamento na própria agenda (botão direito)
    const agendamento = () => p.getByRole('button', { name: /Cliente 12/ }).first()
    for (const status of ['Confirmado', 'Concluído']) {
      await glide(p, agendamento())
      await agendamento().click({ button: 'right' })
      await pause(p, 600)
      await tap(p, p.getByRole('button', { name: `Marcar como ${status}` }), 1100)
    }
    await pause(p, 500)

    // 6. Caixa: marcar a comanda como paga
    await goTo(p, 'Caixa', `${base}/caixa`)
    await expect(p.getByRole('button', { name: /Cliente 12/ }).first()).toBeVisible()
    await tap(p, p.getByRole('button', { name: /Cliente 12/ }).first(), 1000)
    const sel = p.getByRole('group', { name: 'Formas de pagamento' }).getByLabel('Forma de pagamento 1', { exact: true })
    await glide(p, sel)
    await sel.selectOption('pix')
    await pause(p, 700)
    await tap(p, p.locator('[data-tour="comanda-painel"]').getByRole('button', { name: 'Registrar pagamento' }), 600)
    await expect(p.getByText(/^Pagamento registrado/)).toBeVisible()
    await pause(p, 1200)

    // 7. Comissão gerada
    await goTo(p, 'Comissões', `${base}/comissoes`)
    await tap(p, p.getByRole('button', { name: 'Todas', exact: true }), 1000)
    const prof = p.locator('div').filter({ hasText: 'Profissional 2' })
      .filter({ has: p.getByRole('button', { name: 'Pagar todas' }) }).last()
    await glide(p, prof)
    await pause(p, 3000)
  })

  rec.build()
})
