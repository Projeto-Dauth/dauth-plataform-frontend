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

// Por que o produto do salão está bloqueado até pagar (PaywallScreen) — null = liberado.
// 'pending_payment': plano pago escolhido na criação e ainda não pago (nunca teve trial).
export const paywallReason = (salon) =>
  salon?.status === 'pending_payment' ? 'pending_payment' : isTrialOver(salon) ? 'trial_over' : null
