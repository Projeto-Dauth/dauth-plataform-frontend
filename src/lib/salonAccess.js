// Só entra no produto de um salão ativo: não pode estar inativo (exclusão agendada seta active:false),
// nem arquivado, nem com exclusão agendada. Recebe um membership de GET /salon/my ({ salon: {...} }).
// Salões nesse estado continuam listados em /meus-saloes (com o badge) pra dar pra desarquivar/acompanhar.
export const canEnterSalon = (member) => {
  const s = member?.salon
  return Boolean(s) && s.active !== false && !s.archivedAt && !s.scheduledDeletionAt
}

// Trial encerrado: 'suspended' (o backend já bloqueou) ou ainda 'trial' com a data vencida — o status
// só vira 'suspended' no banco quando alguma chamada passa pelo bloqueio. Mesma regra do checkTrial.
export const isTrialOver = (salon) =>
  salon?.status === 'suspended' ||
  (salon?.status === 'trial' && Boolean(salon.trialEndsAt) && new Date(salon.trialEndsAt) <= new Date())

// ── Assinatura (espelho de config/billing.js no backend) ──
export const RENEWAL_WINDOW_DAYS = 7 // renovar abre 7 dias antes de vencer; é também quando o aviso aparece

// Dias que faltam para o fim do período pago (≤ 0 = venceu; null = salão sem período pago)
export const subscriptionDaysLeft = (salon) =>
  salon?.planEndsAt ? Math.ceil((new Date(salon.planEndsAt) - Date.now()) / 86_400_000) : null

// Assinatura vencida: o status só vira 'suspended' no banco quando alguma chamada passa pelo bloqueio,
// por isso um 'active' com o fim do período no passado também conta.
export const isSubscriptionExpired = (salon) =>
  Boolean(salon?.planEndsAt) &&
  (salon.status === 'suspended' || (salon.status === 'active' && new Date(salon.planEndsAt) <= new Date()))

// Pede renovação: ativo, vence em até 7 dias e o dono não cancelou
export const isRenewalDue = (salon) => {
  const days = subscriptionDaysLeft(salon)
  return salon?.status === 'active' && !salon.cancelAtPeriodEnd && days !== null && days > 0 && days <= RENEWAL_WINDOW_DAYS
}

// Por que o produto do salão está bloqueado até pagar (PaywallScreen) — null = liberado.
// 'pending_payment': plano pago escolhido na criação e ainda não pago (nunca teve trial).
// 'subscription_expired': tinha assinatura paga e o período acabou. 'trial_over': o trial acabou.
export const paywallReason = (salon) =>
  salon?.status === 'pending_payment' ? 'pending_payment'
    : isSubscriptionExpired(salon) ? 'subscription_expired'
      : isTrialOver(salon) ? 'trial_over' : null

// ── Cache do salão no salonStore ──
// O store (persistido no localStorage) é só cache: a fonte é GET /salon/my. Estes são os campos da API que o
// front guarda e que mudam o que a tela mostra (plano, trava, formas de pagamento, opções do salão).
// Campo novo que a tela precise ler do store entra SÓ aqui — todos os pontos que gravam o salão usam estas funções.
const CACHED_FIELDS = ['plan', 'status', 'trialEndsAt', 'planEndsAt', 'cancelAtPeriodEnd', 'paymentMethods', 'professionalsSellPackages']

const cachedFields = (salon) => Object.fromEntries(CACHED_FIELDS.filter((f) => salon?.[f] !== undefined).map((f) => [f, salon[f]]))

// Salão da API (membership de /salon/my, resposta de POST /salon ou de /platform/salons/:slug) → objeto do store
export const toStoreSalon = (salon, id = salon.id) => ({
  id, name: salon.name, slug: salon.slug, colorPalette: salon.colorPalette ?? null, ...cachedFields(salon),
})

// O que está no store ficou diferente do que o servidor devolveu agora?
export const isSalonCacheStale = (cur, fresh) =>
  CACHED_FIELDS.some((f) => JSON.stringify(cur?.[f]) !== JSON.stringify(fresh?.[f]))

// Salão do store com os campos de cache atualizados pelo servidor (o resto — id, slug, paleta — fica como está)
export const refreshStoreSalon = (cur, fresh) => ({ ...cur, ...cachedFields(fresh) })
