import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { createOwner } from './support/accounts.js'
import { createSalon } from './support/salon.js'
import { newUserPage } from './support/browser.js'
import { nextWeekday } from './support/dates.js'
import { demoSalon, memberId, serviceId, apiPost } from './support/demo.js'
import prisma from './support/db.js'

// Segurança multi-salão: o dono de OUTRO salão (B) não lê nem altera nada do Salão Demo (A) —
// nem informando o salão A no cabeçalho, nem usando o próprio salão e pedindo um registro de A pelo ID.
// Os registros atacados são criados só para este teste (se houver brecha, nada dos outros testes é afetado).
// Se um teste do bloco falha, o Playwright refaz o beforeAll: cada preparação usa uma semana à frente
// diferente (mesmo dia da semana) para o agendamento-alvo não colidir com o da preparação anterior.
let setups = 0
const setupDate = () => nextWeekday(++setups).iso

test.describe('Isolamento entre salões', () => {
  let salonA, salonB, attacker, target

  test.beforeAll(async ({ browser }) => {
    salonA = await demoSalon()

    // Dono A cria os alvos no Salão Demo
    const ownerA = await newUserPage(browser)
    await loginAs(ownerA, SEED_USERS.owner)
    const category = await apiPost(ownerA, salonA.id, '/category', { Name: 'Categoria Alvo E2E' })
    const service = await apiPost(ownerA, salonA.id, '/service', {
      Name: 'Serviço Alvo E2E', Duration: '00:30:00', Commission: 10, Price: 50, Category: category.UUID,
    })
    const pkg = await apiPost(ownerA, salonA.id, '/package', { Name: 'Pacote Alvo E2E', Price: 100 })
    const appointment = await apiPost(ownerA, salonA.id, '/appointment', {
      Client: await memberId(salonA.id, SEED_USERS.cliente),
      Professional: await memberId(salonA.id, SEED_USERS.profissional),
      Service: await serviceId(salonA.id, 'Corte Masculino'),
      Date: setupDate(), Start_time: '17:00', End_time: '17:30',
    })
    // Concluir o agendamento gera uma comanda em aberto no salão A
    for (const Status of ['confirmado', 'concluido']) await apiPost(ownerA, salonA.id, `/appointment/${appointment.UUID}`, { Status }, 'patch')
    const tabA = await prisma.tab.findFirst({ where: { appointmentId: appointment.UUID } })
    const product = await apiPost(ownerA, salonA.id, '/product', { Name: 'Produto Alvo E2E', Price: 30 })
    const professional = await memberId(salonA.id, SEED_USERS.profissional)
    target = {
      category: category.UUID, service: service.UUID, package: pkg.UUID, appointment: appointment.UUID,
      product: product.UUID, client: await memberId(salonA.id, SEED_USERS.cliente), professional, tab: tabA.id,
      workingHours: (await prisma.workingHours.findFirst({ where: { memberId: professional } })).id,
    }

    // Dono B: conta e salão próprios
    attacker = await newUserPage(browser)
    await createOwner(attacker)
    salonB = await createSalon(attacker)
  })

  const call = (method, path, salonId, data) =>
    attacker.request[method](`${E2E_API_URL}/api${path}`, { headers: { 'x-salon-id': salonId }, data })

  test('informar o salão A no cabeçalho é recusado', async () => {
    expect((await call('get', '/appointment', salonA.id)).status()).toBe(403)
    expect((await call('get', '/users', salonA.id)).status()).toBe(403)
    const config = await attacker.request.get(`${E2E_API_URL}/api/v1/salon/config`, { headers: { 'x-salon-id': salonA.id } })
    expect(config.status()).toBe(403)
  })

  test('IDs do salão A no corpo da requisição são recusados', async () => {
    // Recursos do próprio salão B usados como "ponte"
    const catB = await apiPost(attacker, salonB.id, '/category', { Name: 'Categoria B' })
    const svcB = await apiPost(attacker, salonB.id, '/service', { Name: 'Serviço B', Duration: '00:30:00', Commission: 10, Price: 50, Category: catB.UUID })
    const pkgB = await apiPost(attacker, salonB.id, '/package', { Name: 'Pacote B', Price: 50 })

    const attempts = [
      ['post', '/appointment', { Client: target.client, Professional: target.professional, Service: target.service,
        Date: nextWeekday().iso, Start_time: '18:00', End_time: '18:30' }, 'agendamento com cliente/profissional/serviço de A'],
      ['put', `/package/${pkgB.UUID}/items`, { items: [{ Service_id: target.service, Quantity: 1, Unit_price: 50, Commission_override: 10 }] }, 'pacote de B com serviço de A'],
      ['post', `/package/${pkgB.UUID}/sell`, { Client_id: target.client }, 'vender pacote de B para cliente de A'],
      ['post', `/service/${svcB.UUID}/professionals`, { Professional_id: target.professional, Member_id: target.professional }, 'vincular profissional de A a serviço de B'],
      ['post', '/product-order', { Product_id: target.product, Client_id: target.client, Quantity: 1 }, 'pedido com produto e cliente de A'],
      ['post', '/working-hours', { professional_id: target.professional, weekday: 6, start_time: '08:00', end_time: '09:00' }, 'horário para profissional de A'],
      ['post', '/professional-leave', { professional_id: target.professional, date: nextWeekday().iso, all_day: true }, 'folga para profissional de A'],
      ['post', '/transaction', { Tab: target.tab, Method: 'pix', Net_amount: 1, Gross_amount: 1 }, 'transação na comanda de A'],
    ]
    for (const [method, path, data, name] of attempts) {
      const res = await call(method, path, salonB.id, data)
      expect.soft(res.status(), `${method.toUpperCase()} ${path} — ${name} → ${(await res.text()).slice(0, 160)}`).toBeGreaterThanOrEqual(400)
    }
    // Pagamento em lote ignora comanda de outro salão (responde "0 pagas") — confere o efeito, não o status
    await call('post', '/tab/batch-pay', salonB.id, { tab_ids: [target.tab], Payments: [{ Method: 'pix', Amount: 45 }], Payment_date: new Date().toISOString() })
    expect.soft((await prisma.tab.findUnique({ where: { id: target.tab } }))?.status, 'comanda de A continua em aberto').toBe('Em aberto')
    expect.soft(await prisma.transaction.count({ where: { tabId: target.tab } }), 'nenhuma transação na comanda de A').toBe(0)
  })

  test('abrir o painel do salão A pela URL manda para Meus salões', async () => {
    await attacker.goto(`/${SEED_SALON_SLUG}/admin`)
    await expect(attacker).toHaveURL(/\/meus-saloes$/)
  })

  // Com o PRÓPRIO salão no cabeçalho, pedir um registro de A pelo ID
  const resources = [
    { name: 'agendamento', path: 'appointment', patch: { Notes: 'invadido' } },
    { name: 'serviço', path: 'service', patch: { Name: 'Invadido' } },
    { name: 'categoria', path: 'category', patch: { Name: 'Invadido' } },
    { name: 'pacote', path: 'package', patch: { Name: 'Invadido' } },
    { name: 'cliente', path: 'users', key: 'client', patch: { Name: SEED_USERS.cliente.name } }, // PATCH inofensivo
    { name: 'produto', path: 'product', patch: { Name: 'Invadido' } },
    { name: 'horário de trabalho', path: 'working-hours', key: 'workingHours', patch: { Start_time: '09:00' } },
  ]
  // Listagens/sub-recursos de A acessados pelo ID de um cliente, profissional ou serviço de A
  const readOnly = [
    ['/appointment/client/:client', 'agendamentos do cliente'],
    ['/appointment/professional/:professional', 'agendamentos da profissional'],
    ['/tab/client/:client', 'comandas do cliente'],
    ['/tab/client/:client/account-summary', 'resumo de conta do cliente'],
    ['/users/:client/credit-balance', 'saldo de crédito do cliente'],
    ['/package/client/:client', 'pacotes do cliente'],
    ['/professional/:professional/permissions', 'permissões da profissional'],
    ['/working-hours/professional/:professional', 'horários da profissional'],
    ['/professional-leave/professional/:professional', 'folgas da profissional'],
    ['/service/:service/professionals', 'profissionais do serviço'],
    ['/package/:package/items', 'itens do pacote'],
  ]
  // Um teste só (preparação única); expect.soft tenta todos os ataques e lista cada brecha
  test('registros do salão A: ler, listar, alterar e apagar pelo ID é recusado e nada muda', async () => {
    for (const [path, name] of readOnly) {
      const url = path.replace(/:(\w+)/g, (_, key) => target[key])
      const res = await call('get', url, salonB.id)
      expect.soft(res.status(), `GET ${path} (${name}) de outro salão`).toBeGreaterThanOrEqual(400)
    }

    for (const r of resources) {
      const id = target[r.key ?? r.path]
      for (const [method, data] of [['get'], ['patch', r.patch], ['delete']]) {
        const res = await call(method, `/${r.path}/${id}`, salonB.id, data)
        expect.soft(res.status(), `${method.toUpperCase()} /${r.path}/:id (${r.name}) de outro salão`).toBeGreaterThanOrEqual(400)
      }
    }

    // Plataforma (/api/v1): arquivar/excluir o salão A, mexer nos membros dele
    const platform = (method, path) =>
      attacker.request[method](`${E2E_API_URL}/api/v1${path}`, { headers: { 'x-salon-id': salonB.id } })
    for (const [method, path] of [
      ['patch', `/salon/${salonA.id}/archive`], ['delete', `/salon/${salonA.id}`], ['patch', `/salon/${salonA.id}/restore`],
      ['delete', `/salon/members/${target.professional}`], ['post', `/salon/members/${target.client}/invite`],
    ]) {
      expect.soft((await platform(method, path)).status(), `${method.toUpperCase()} /api/v1${path} de outro salão`).toBeGreaterThanOrEqual(400)
    }
    const a = await prisma.salon.findUnique({ where: { id: salonA.id } })
    expect.soft({ active: a.active, archived: a.archivedAt != null }, 'salão A intacto').toEqual({ active: true, archived: false })
    expect.soft((await prisma.salonMember.findUnique({ where: { id: target.professional } }))?.active, 'profissional intacta').toBe(true)

    // Nenhum registro do salão A foi alterado ou apagado
    expect.soft((await prisma.category.findUnique({ where: { id: target.category } }))?.name, 'categoria intacta').toBe('Categoria Alvo E2E')
    const service = await prisma.service.findUnique({ where: { id: target.service } })
    expect.soft({ name: service?.name, deleted: service?.deletedAt != null }, 'serviço intacto').toEqual({ name: 'Serviço Alvo E2E', deleted: false })
    expect.soft((await prisma.servicePackage.findUnique({ where: { id: target.package } }))?.name, 'pacote intacto').toBe('Pacote Alvo E2E')
    const appt = await prisma.appointment.findUnique({ where: { id: target.appointment } })
    expect.soft({ exists: appt != null, notes: appt?.notes ?? null }, 'agendamento intacto').toEqual({ exists: true, notes: null })
    expect.soft((await prisma.salonMember.findUnique({ where: { id: target.client } }))?.active, 'cliente intacto').toBe(true)
    const product = await prisma.product.findUnique({ where: { id: target.product } })
    expect.soft({ name: product?.name, deleted: product?.deletedAt != null }, 'produto intacto').toEqual({ name: 'Produto Alvo E2E', deleted: false })
    expect.soft((await prisma.workingHours.findUnique({ where: { id: target.workingHours } }))?.startTime, 'horário intacto').toBe('08:00')
  })
})
