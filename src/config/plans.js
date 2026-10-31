// Espelho de exibição das regras de plano — fonte da verdade é src/config/plans.js no backend.
// `featureIds` precisa ficar em sincronia com `PLANS[plan].features` de lá (usado pro cadeado
// no Sidebar — ver `salonHasFeature` abaixo).
export const PLANS = [
  {
    id: 'essencial',
    label: 'Essencial',
    priceCents: 7990,
    prices: { 1: 7990, 3: 21570, 6: 40740 },
    discountMonthCents: 6790,
    maxProfessionals: 3,
    tagline: 'Para quem está começando',
    features: ['Agenda', 'Clientes', 'Serviços/Categorias', 'Caixa', 'Comissões', 'Até 3 profissionais'],
    featureIds: [],
  },
  {
    id: 'profissional',
    label: 'Profissional',
    priceCents: 11990,
    prices: { 1: 11990, 3: 32370, 6: 61140 },
    discountMonthCents: 10190,
    maxProfessionals: 8,
    tagline: 'Para operações em crescimento',
    features: ['Tudo do Essencial', 'Pacotes', 'Produtos', 'WhatsApp do salão', 'Suporte prioritário', 'Até 8 profissionais'],
    featureIds: ['pacotes', 'produtos', 'whatsapp'],
  },
  {
    id: 'business',
    label: 'Business',
    priceCents: 19990,
    prices: { 1: 19990, 3: 53970, 6: 101940 },
    discountMonthCents: 16990,
    maxProfessionals: null,
    tagline: 'Para operações maiores',
    features: ['Tudo do Profissional', 'Dashboard personalizável', 'BI direcionado ao negócio', 'Sem limite de profissionais'],
    featureIds: ['pacotes', 'produtos', 'whatsapp', 'dashboard_custom'],
  },
]

// Durações de contratação (mesmos valores de BILLING_MONTHS no backend). `prices` de cada plano = total por duração.
export const BILLING_OPTIONS = [
  { months: 1, label: 'Mensal' },
  { months: 3, label: 'Trimestral', discount: 10 },
  { months: 6, label: 'Semestral', discount: 15 },
]
export const billingLabel = (months) => BILLING_OPTIONS.find(o => o.months === months)?.label ?? 'Mensal'

// Desconto da lista de espera (mesma regra de WAITLIST_DISCOUNT/discountedPrice em backend/src/config/billing.js):
// `discountMonthCents` nas próximas mensalidades, sem somar com o desconto do trimestral/semestral (vale o menor preço).
export const WAITLIST_DISCOUNT = { percent: 15, months: 3 }

// Preço de um plano numa duração: total, equivalente mensal e quanto economiza em relação ao mensal.
// `discountMonthsLeft` = mensalidades que o salão ainda tem com o desconto da lista de espera.
export function planPrice(planId, months = 1, discountMonthsLeft = 0) {
  const plan = PLANS.find(p => p.id === planId) ?? PLANS[0]
  const full = plan.prices[months] ?? plan.prices[1]
  const perMonthFull = full / months
  const discountMonths = plan.discountMonthCents < perMonthFull ? Math.min(months, discountMonthsLeft) : 0
  const discountCents = discountMonths * (perMonthFull - plan.discountMonthCents)
  const total = full - discountCents
  return { total, perMonth: Math.round(total / months), savings: plan.priceCents * months - total, discountCents }
}

// Aviso de que não há reembolso — o mesmo texto em todo lugar onde se paga
export const NO_REFUND_NOTICE = 'Pagamento único via PIX, sem renovação automática. Não há reembolso do período pago, nem em caso de cancelamento.'

// Nome exibido de cada feature travável — bate com o texto em `features` (usado pra destacar no modal).
export const FEATURE_LABEL = {
  pacotes: 'Pacotes',
  produtos: 'Produtos',
  whatsapp: 'WhatsApp do salão',
  dashboard_custom: 'Dashboard personalizável',
}

// Path (sem leading /, igual navItems.js) → feature exigida. Espelha PATH_TO_MODULE/modules.js.
export const NAV_ITEM_FEATURE = {
  'admin/combos': 'pacotes',
  'profissional/combos': 'pacotes',
  'admin/produtos': 'produtos',
  'profissional/produtos': 'produtos',
  'admin/pedidos-produtos': 'produtos',
  'profissional/pedidos-produtos': 'produtos',
}

// Qual o plano mais barato que já libera essa feature — usado pro texto do cadeado ("Disponível no plano X").
export function planRequiredFor(feature) {
  return PLANS.find(p => p.featureIds.includes(feature))
}

// O trial tem as mesmas permissões do plano Essencial (mesma regra do backend, salonAllowsFeature em src/config/plans.js)
export const TRIAL_PLAN = 'essencial'

export function salonHasFeature(salon, feature) {
  if (!salon) return true
  const plan = PLANS.find(p => p.id === (salon.status === 'trial' ? TRIAL_PLAN : salon.plan))
  return Boolean(plan?.featureIds.includes(feature))
}

export function formatPlanPrice(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}
