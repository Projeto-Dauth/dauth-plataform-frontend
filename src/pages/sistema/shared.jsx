import { useEffect } from 'react'
import Icon from '@/components/ui/Icons'
import { PLANS, billingLabel } from '@/config/plans'

// Peças comuns das abas do painel /sistema

export const planLabel = (plan) => PLANS.find(p => p.id === plan)?.label ?? 'Sem plano'
export const durationLabel = (months) => billingLabel(months).toLowerCase()

const SITUATIONS = {
  active:          { label: 'Ativo',               cls: 'bg-success-soft text-success' },
  trial:           { label: 'Trial',               cls: 'bg-warning-soft text-warning' },
  suspended:       { label: 'Suspenso',            cls: 'bg-danger-soft text-danger' },
  pending_payment: { label: 'Aguardando pagamento', cls: 'bg-warning-soft text-warning' },
  archived:        { label: 'Arquivado',           cls: 'bg-surface-3 text-ink-3' },
  deleting:        { label: 'Exclusão agendada',   cls: 'bg-danger-soft text-danger' },
}
export const SITUATION_OPTIONS = Object.entries(SITUATIONS).map(([id, s]) => ({ id, label: s.label }))

export function SituationBadge({ situation }) {
  const s = SITUATIONS[situation] ?? { label: situation, cls: 'bg-surface-3 text-ink-3' }
  return <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

export function OriginBadge({ origin }) {
  const front = origin === 'frontend'
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium whitespace-nowrap ${front ? 'bg-brand-soft text-brand-soft-ink' : 'bg-surface-3 text-ink-2'}`}>
      {front ? 'Frontend' : 'Backend'}
    </span>
  )
}

// "vence em 5 dias" / "venceu há 2 dias"
export function daysLeftLabel(days) {
  if (days == null) return '—'
  if (days < 0) return `venceu há ${-days} ${-days === 1 ? 'dia' : 'dias'}`
  if (days === 0) return 'vence hoje'
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

export const selectCls = 'h-9 px-3 rounded-md border border-line bg-surface text-sm text-ink focus:outline-none focus:border-ink-3'

export function SkeletonRows({ rows = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-surface-2 animate-pulse" />)}
    </div>
  )
}

// Painel lateral (no celular ocupa a tela toda)
export function SidePanel({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <aside role="dialog" aria-label={title} className="relative w-full max-w-2xl h-full bg-surface border-l border-line overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface border-b border-line px-5 h-14 flex items-center justify-between gap-3">
          <h2 className="font-display font-medium text-[15px] text-ink truncate">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-ink-3 hover:text-ink cursor-pointer p-1">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </div>
  )
}
