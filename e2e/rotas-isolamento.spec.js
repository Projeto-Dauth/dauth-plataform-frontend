import { test, expect } from '@playwright/test'
import { applyTestEnv } from '../../backend/e2e/testEnv.js'

// Guarda estrutural do isolamento entre salões: toda rota do produto com ID na URL precisa passar
// pelo tenantScope e ter regra em SCOPES. Quem criar uma rota nova com ID e esquecer a regra vê
// este teste falhar (e a rota já nasce recusando acesso, pela falha segura do tenantScope).
const PUBLIC_ROUTES = [ // agendamento público, sem login: dados públicos do salão
  '/public/services/:id/professionals',
  '/public/availability/:professionalId',
]

test('toda rota do produto com ID verifica se o registro é do salão', async () => {
  applyTestEnv() // o roteador importa auth/prisma, que leem as variáveis do ambiente de teste
  const { default: router } = await import('../../backend/src/produto/routes/routes.js')
  const { SCOPES, tenantScope } = await import('../../backend/src/produto/middleware/tenantScope.js')

  const routesWithId = router.stack
    .filter(layer => layer.route?.path.includes(':'))
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).join(',').toUpperCase(),
      scoped: layer.route.stack.some(s => s.handle === tenantScope),
    }))
  expect(routesWithId.length).toBeGreaterThan(40) // sanidade: achou as rotas

  const problems = routesWithId
    .filter(r => !PUBLIC_ROUTES.includes(r.path))
    .filter(r => !r.scoped || !SCOPES[r.path])
    .map(r => `${r.methods} ${r.path}${r.scoped ? ' (sem regra em SCOPES)' : ' (sem tenantScope)'}`)
  expect(problems, 'rotas com ID sem verificação de salão').toEqual([])
})
