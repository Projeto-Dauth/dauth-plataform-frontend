const variants = {
  default: 'bg-surface-2 text-ink-2 border-line',
  brand:   'bg-brand-soft text-brand-soft-ink border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger:  'bg-danger-soft text-danger border-transparent',
  ghost:   'bg-transparent text-ink-2 border-line',
  gold:    'bg-[#faecd6] text-[#7a5c2e] border-gold/50',
  blue:    'bg-[#dbeafe] text-[#1d4ed8] border-[#93c5fd]',
}

// Status específicos para agendamentos
const statusMap = {
  pendente:   'blue',
  confirmado: 'success',
  concluido:  'gold',
  cancelado:  'danger',
  'Em aberto': 'warning',
  Paga:        'success',
  Expirada:    'default',
}

export default function Chip({ children, variant, status, dot, className = '' }) {
  const resolvedVariant = variant ?? (status ? statusMap[status] : 'default') ?? 'default'
  const showDot = dot ?? (status != null)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-[10px] py-[3px] rounded-full
        text-xs font-medium border
        ${variants[resolvedVariant]} ${className}`}
    >
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {children ?? status}
    </span>
  )
}
