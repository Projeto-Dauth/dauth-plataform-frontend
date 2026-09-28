// Só entra no produto de um salão ativo: não pode estar inativo (exclusão agendada seta active:false),
// nem arquivado, nem com exclusão agendada. Recebe um membership de GET /salon/my ({ salon: {...} }).
// Salões nesse estado continuam listados em /meus-saloes (com o badge) pra dar pra desarquivar/acompanhar.
export const canEnterSalon = (member) => {
  const s = member?.salon
  return Boolean(s) && s.active !== false && !s.archivedAt && !s.scheduledDeletionAt
}
