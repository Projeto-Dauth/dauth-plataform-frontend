// Espelho de exibição das regras de plano — fonte da verdade é src/config/plans.js no backend.
// `featureIds` precisa ficar em sincronia com `PLANS[plan].features` de lá (usado pro cadeado
// no Sidebar — ver `salonHasFeature` abaixo).
export const PLANS = [
  {
    id: 'essencial',
    label: 'Essencial',
    priceCents: 7990,
    maxProfessionals: 3,
    tagline: 'Para quem está começando',
    features: ['Agenda', 'Clientes', 'Serviços/Categorias', 'Caixa', 'Comissões', 'Até 3 profissionais'],
    featureIds: [],
  },
  {
    id: 'profissional',
    label: 'Profissional',
    priceCents: 11990,
    maxProfessionals: 8,
    tagline: 'Para operações em crescimento',
    features: ['Tudo do Essencial', 'Pacotes', 'Produtos', 'WhatsApp do salão', 'Suporte prioritário', 'Até 8 profissionais'],
    featureIds: ['pacotes', 'produtos', 'whatsapp'],
  },
  {
    id: 'business',
    label: 'Business',
    priceCents: 19990,
    maxProfessionals: null,
    tagline: 'Para operações maiores',
    features: ['Tudo do Profissional', 'BI direcionado ao negócio', 'Sem limite de profissionais'],
    featureIds: ['pacotes', 'produtos', 'whatsapp'],
  },
]

// Nome exibido de cada feature travável — bate com o texto em `features` (usado pra destacar no modal).
export const FEATURE_LABEL = {
  pacotes: 'Pacotes',
  produtos: 'Produtos',
  whatsapp: 'WhatsApp do salão',
}

// Path (sem leading /, igual navItems.js) → feature exigida. Espelha PATH_TO_MODULE/modules.js.
export const NAV_ITEM_FEATURE = {
  'admin/combos': 'pacotes',
  'admin/produtos': 'produtos',
  'profissional/produtos': 'produtos',
  'admin/pedidos-produtos': 'produtos',
  'profissional/pedidos-produtos': 'produtos',
}

// Qual o plano mais barato que já libera essa feature — usado pro texto do cadeado ("Disponível no plano X").
export function planRequiredFor(feature) {
  return PLANS.find(p => p.featureIds.includes(feature))
}

// Durante o trial libera tudo, exceto TRIAL_BLOCKED_FEATURES (mesma regra do backend, salonAllowsFeature em src/config/plans.js).
const TRIAL_BLOCKED_FEATURES = ['whatsapp']
export const TRIAL_MAX_PROFESSIONALS = 3 // mesmo valor do backend (salonProfessionalLimit)

export function salonHasFeature(salon, feature) {
  if (!salon) return true
  if (salon.status === 'trial') return !TRIAL_BLOCKED_FEATURES.includes(feature)
  const plan = PLANS.find(p => p.id === salon.plan)
  return Boolean(plan?.featureIds.includes(feature))
}

export function formatPlanPrice(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}
