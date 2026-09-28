import Icon from '@/components/ui/Icons'
import MoneyValue from '@/components/ui/MoneyValue'

const statusStyle = {
  ativo:     'bg-success-soft text-success',
  pendente:  'bg-warning-soft text-warning',
  concluido: 'bg-surface-2 text-ink-3',
  cancelado: 'bg-danger-soft text-danger',
}
const statusLabel = {
  ativo:     'Ativo',
  pendente:  'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

function formatDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function ProgressBar({ used, total }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  return (
    <div className="h-1.5 bg-line rounded-full overflow-hidden">
      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

// Card de pacote adquirido por um cliente — usado tanto na área do cliente (MeusCombos, sem
// clientName) quanto na visão do Admin (AdminCombos "Pacotes vendidos", com clientName).
export default function ComboCard({ combo, clientName }) {
  const pkg = combo.Service_package
  const items = combo.Client_package_items ?? []
  const totalSessions = items.reduce((s, i) => s + i.Total_quantity, 0)
  const usedSessions = items.reduce((s, i) => s + i.Used_quantity, 0)
  const remaining = totalSessions - usedSessions

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-1.5">
            <Icon name="package" size={11} />Pacote
          </div>
          {clientName && (
            <div className="text-[13px] font-medium text-ink mb-0.5 truncate">{clientName}</div>
          )}
          <h4 className="font-display font-medium text-[17px] md:text-[18px] tracking-tight">{pkg?.Name ?? '—'}</h4>
          <div className="text-[12px] md:text-[13px] text-ink-3 mt-0.5">
            {pkg?.Price != null ? <MoneyValue>{formatCurrency(pkg.Price)}</MoneyValue> : '—'}
            {pkg?.Available_until && (
              <span className="ml-2">· válido até {formatDate(pkg.Available_until)}</span>
            )}
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium ${statusStyle[combo.Status] ?? 'bg-surface-2 text-ink-3'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {statusLabel[combo.Status] ?? combo.Status}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Sessões</span>
          <span className="font-mono text-[11px] md:text-[12px] text-ink-2">
            {usedSessions} / {totalSessions} usadas · <span className="text-brand">{remaining} restantes</span>
          </span>
        </div>
        <ProgressBar used={usedSessions} total={totalSessions} />
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {items.map((item) => {
          const rest = item.Total_quantity - item.Used_quantity
          return (
            <div key={item.UUID} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[13px] min-w-0">
                <Icon name="scissors" size={12} className="text-ink-4 shrink-0" />
                <span className="truncate">{item.Service?.Name ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] text-ink-3">
                  {item.Used_quantity}/{item.Total_quantity}
                </span>
                <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${rest > 0 ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-4'}`}>
                  {rest > 0 ? `${rest} rest.` : 'esgotado'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-line pt-3 mt-4 flex flex-col gap-1.5">
        <div className="font-mono text-[10.5px] text-ink-4">
          Adquirido em {combo.Acquired_at ? formatDate(combo.Acquired_at) : formatDate(combo.Created_at)}
        </div>
        {combo.Status === 'ativo' && (
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink-4">
            <Icon name="alertCircle" size={11} className="shrink-0" />
            Sessões são descontadas após a conclusão do atendimento
          </div>
        )}
      </div>
    </div>
  )
}
