import { useEffect } from 'react'
import Icon from '@/components/ui/Icons'
import Avatar from '@/components/ui/Avatar'
import { PLANS, billingLabel } from '@/config/plans'

// Peças comuns do painel /sistema. Só tokens do design system (nada de cor fixa): bg-brand-*, success/warning/danger, gold.

export const planLabel = (plan) => PLANS.find(p => p.id === plan)?.label ?? 'Sem plano'
export const durationLabel = (months) => billingLabel(months).toLowerCase()

// ─── Cores por "tom" ────────────────────────────────────────────────────────
export const TONES = {
  brand:   { soft: 'bg-brand-soft text-brand-soft-ink', dot: 'bg-brand' },
  success: { soft: 'bg-success-soft text-success', dot: 'bg-success' },
  warning: { soft: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  danger:  { soft: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  gold:    { soft: 'bg-gold-soft text-brand-soft-ink', dot: 'bg-gold' },
  neutral: { soft: 'bg-surface-3 text-ink-2', dot: 'bg-ink-4' },
}

// Selo com ponto de status. O texto fica direto no <span> (os testes procuram por ele).
export function Badge({ tone = 'neutral', dot = true, children }) {
  const t = TONES[tone] ?? TONES.neutral
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium whitespace-nowrap ${t.soft}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
      {children}
    </span>
  )
}

const SITUATIONS = {
  active:          { label: 'Ativo',                tone: 'success' },
  trial:           { label: 'Trial',                tone: 'warning' },
  suspended:       { label: 'Suspenso',             tone: 'danger' },
  pending_payment: { label: 'Aguardando pagamento', tone: 'gold' },
  archived:        { label: 'Arquivado',            tone: 'neutral' },
  deleting:        { label: 'Exclusão agendada',    tone: 'danger' },
}
export const SITUATION_OPTIONS = Object.entries(SITUATIONS).map(([id, s]) => ({ id, label: s.label }))

export function SituationBadge({ situation }) {
  const s = SITUATIONS[situation] ?? { label: situation, tone: 'neutral' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function OriginBadge({ origin }) {
  const front = origin === 'frontend'
  return <Badge tone={front ? 'brand' : 'neutral'}>{front ? 'Frontend' : 'Backend'}</Badge>
}

// "vence em 5 dias" / "venceu há 2 dias"
export function daysLeftLabel(days) {
  if (days == null) return '—'
  if (days < 0) return `venceu há ${-days} ${-days === 1 ? 'dia' : 'dias'}`
  if (days === 0) return 'vence hoje'
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

// ─── Cartões ────────────────────────────────────────────────────────────────
export const Card = ({ className = '', children, ...props }) => (
  <div className={`rounded-xl border border-line bg-surface shadow-xs ${className}`} {...props}>{children}</div>
)

// Cartão com título (e ação opcional) no topo. `flush` tira o espaçamento interno (listas e tabelas encostam nas bordas).
export function Panel({ title, action, flush = false, className = '', children }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <h3 className="text-[13.5px] font-semibold text-ink tracking-tight">{title}</h3>
          {action}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </Card>
  )
}

// Indicador: rótulo + ícone colorido + número grande. Com onClick vira botão.
export function StatCard({ icon, tone = 'brand', label, value, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`text-left rounded-xl border border-line bg-surface p-4 shadow-xs transition-all
        ${onClick ? 'cursor-pointer hover:border-line-3 hover:shadow-sm hover:-translate-y-px' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-ink-3 font-medium">{label}</span>
        <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${(TONES[tone] ?? TONES.brand).soft}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className="font-display text-[28px] font-semibold tracking-tight leading-none text-ink mt-3.5">{value}</p>
      {hint && <p className="text-[11.5px] text-ink-3 mt-2">{hint}</p>}
    </Tag>
  )
}

// Rótulo + valor (listas de detalhe nos painéis laterais)
export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-ink-3 mb-0.5">{label}</dt>
      <dd className="text-[13px] text-ink break-words">{children ?? '—'}</dd>
    </div>
  )
}

// Número pequeno com legenda (painel lateral)
export function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-surface-2 border border-line-2 px-3.5 py-3">
      <p className="font-display text-[20px] font-semibold tracking-tight leading-none text-ink">{value}</p>
      <p className="text-[11.5px] text-ink-3 mt-1.5">{label}</p>
    </div>
  )
}

// Iniciais coloridas (reaproveita o Avatar do sistema)
export const InitialAvatar = ({ name, size = 'md' }) => <Avatar name={name || '?'} size={size} />

// ─── Campos e tabelas ───────────────────────────────────────────────────────
export const fieldCls = 'h-10 px-3 rounded-md border border-line bg-surface text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition'
export const selectCls = `${fieldCls} cursor-pointer`
export const textareaCls = 'w-full px-3.5 py-2.5 rounded-md border border-line bg-surface text-ink-2 text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition resize-none'

// Barra de filtros no topo do cartão da lista
export const Toolbar = ({ children }) => (
  <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">{children}</div>
)

export function SearchField({ value, onChange, placeholder, label }) {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
      <input type="search" value={value} onChange={onChange} placeholder={placeholder} aria-label={label} className={`${fieldCls} w-full pl-9`} />
    </div>
  )
}

export const thCls = 'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-3 bg-surface-2 whitespace-nowrap'
export const tdCls = 'px-4 py-3 align-middle'

export function SkeletonRows({ rows = 6 }) {
  return (
    <div className="divide-y divide-line animate-pulse" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 rounded-full bg-surface-3 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-surface-3" />
            <div className="h-2.5 w-1/2 rounded bg-surface-2" />
          </div>
          <div className="h-5 w-16 rounded-full bg-surface-3" />
        </div>
      ))}
    </div>
  )
}

// Mensagem de erro de carregamento, no lugar da lista
export const LoadError = ({ children }) => (
  <div className="flex items-center gap-2.5 px-5 py-8 justify-center text-sm text-danger">
    <Icon name="alertCircle" size={16} />{children}
  </div>
)

// ─── Diálogo padrão ─────────────────────────────────────────────────────────
// Ícone colorido + título + descrição no topo, conteúdo, rodapé com os botões. No celular sobe de baixo (sheet).
// Dentro de um painel lateral usa z-[55]; o de confirmação por código (z-[60]) passa por cima.
export function DialogShell({ title, description, icon = 'shield', tone = 'brand', onClose, onSubmit, busy = false, footer, z = 'z-[55]', children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const Tag = onSubmit ? 'form' : 'div'
  return (
    <div className={`fixed inset-0 ${z} flex items-end sm:items-center justify-center sm:p-4`}>
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in" onClick={busy ? undefined : onClose} />
      <Tag role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}
        className="relative w-full sm:max-w-md bg-surface rounded-t-xl sm:rounded-xl border border-line shadow-md max-h-[92vh] flex flex-col animate-scale-in">
        <div className="flex items-start gap-3.5 px-6 pt-6 pb-4">
          <span className={`w-10 h-10 shrink-0 rounded-lg grid place-items-center ${(TONES[tone] ?? TONES.brand).soft}`}>
            <Icon name={icon} size={18} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-display text-[16px] font-semibold tracking-tight text-ink">{title}</h3>
            {description && <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">{description}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar"
            className="p-1 -mr-1 text-ink-3 hover:text-ink rounded-md hover:bg-surface-2 cursor-pointer transition-colors">
            <Icon name="x" size={16} />
          </button>
        </div>
        {/* [&>.mb-4]: os <Input> do app trazem margem própria; aqui o espaçamento vem do space-y */}
        {children && <div className="px-6 pb-1 overflow-y-auto space-y-3.5 [&>.mb-4]:mb-0">{children}</div>}
        <div className="mt-4 px-6 py-4 bg-surface-2 border-t border-line rounded-b-xl flex justify-end gap-2.5">{footer}</div>
      </Tag>
    </div>
  )
}

// ─── Painel lateral (no celular ocupa a tela toda) ──────────────────────────
// `leading` = avatar/ícone à esquerda; `meta` = selos abaixo do título.
export function SidePanel({ title, subtitle, leading, meta, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <aside role="dialog" aria-label={title} className="relative w-full max-w-xl h-full bg-bg border-l border-line shadow-md flex flex-col animate-slide-in-right">
        <div className="shrink-0 bg-surface border-b border-line px-5 py-4 flex items-start gap-3.5">
          {leading}
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-semibold text-[16px] tracking-tight text-ink truncate">{title}</h2>
            {subtitle && <p className="font-mono text-[11.5px] text-ink-3 mt-0.5 truncate">{subtitle}</p>}
            {meta && <div className="flex flex-wrap items-center gap-2 mt-2">{meta}</div>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 -mr-1.5 text-ink-3 hover:text-ink rounded-md hover:bg-surface-2 cursor-pointer transition-colors">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </aside>
    </div>
  )
}
