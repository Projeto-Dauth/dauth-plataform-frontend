import { useState } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate } from '@/lib/format'

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

function ProgressBar({ used, total }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  return (
    <div className="h-1.5 bg-line rounded-full overflow-hidden">
      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

// Diálogo de conclusão manual: o motivo é obrigatório (fica registrado no pacote).
function ConcludeDialog({ combo, remaining, loading, onCancel, onConfirm }) {
  const [note, setNote] = useState('')
  const valid = note.trim().length >= 3
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <div role="dialog" aria-modal="true" aria-labelledby={`conclude-${combo.UUID}`}
        className="relative bg-surface rounded-xl p-6 w-full max-w-md shadow-md border border-line mx-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 id={`conclude-${combo.UUID}`} className="font-display font-medium text-lg tracking-tight">Concluir pacote manualmente</h3>
          <button onClick={onCancel} disabled={loading} aria-label="Fechar" className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <p className="text-[13.5px] text-ink-2 mb-4 leading-relaxed">
          {remaining > 0
            ? `${remaining} ${remaining === 1 ? 'sessão restante deixa' : 'sessões restantes deixam'} de valer. `
            : ''}
          O pacote fica como concluído e o cliente pode comprar um novo.
        </p>
        <label className="flex flex-col gap-1.5 mb-5">
          <span className="text-[12px] font-medium text-ink-2">Motivo da conclusão</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex: cliente usou 2 de 5 sessões e não voltou"
            rows={3}
            maxLength={500}
            autoFocus
            className="w-full px-[14px] py-[10px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors resize-none"
          />
        </label>
        <div className="flex gap-2.5 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button size="sm" onClick={() => onConfirm(note.trim())} disabled={!valid} loading={loading}>Concluir pacote</Button>
        </div>
      </div>
    </div>
  )
}

// Card de pacote adquirido por um cliente — usado tanto na área do cliente (MeusCombos, sem
// clientName) quanto na visão do Admin (AdminCombos "Pacotes vendidos", com clientName).
// `onConclude(combo, note)` (telas do salão) mostra "Concluir manualmente" em pacote ativo.
// `onCancelSale(combo)` (telas do salão) mostra "Cancelar venda" em pacote pendente (vendido e nunca pago).
export default function ComboCard({ combo, clientName, onConclude, concluding = false, onCancelSale, cancelling = false }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
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
        {combo.Manual_conclusion_note && (
          <div className="text-[12px] text-ink-3 leading-relaxed">
            <span className="font-medium text-ink-2">Concluído manualmente{combo.Manual_concluded_at ? ` em ${formatDate(combo.Manual_concluded_at)}` : ''}:</span>{' '}
            {combo.Manual_conclusion_note}
          </div>
        )}
      </div>

      {onConclude && combo.Status === 'ativo' && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>Concluir manualmente</Button>
        </div>
      )}
      {onCancelSale && combo.Status === 'pendente' && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>Cancelar venda</Button>
        </div>
      )}
      <Modal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => { if ((await onCancelSale(combo)) !== false) setConfirmCancel(false) }}
        title="Cancelar venda do pacote"
        message="O pacote ainda não foi pago. A venda é cancelada e a comanda da compra sai do Caixa — o cliente pode comprar outro pacote depois."
        confirmLabel="Cancelar venda"
        cancelLabel="Voltar"
        loading={cancelling}
      />
      {confirming && (
        <ConcludeDialog
          combo={combo}
          remaining={remaining}
          loading={concluding}
          onCancel={() => setConfirming(false)}
          onConfirm={async (note) => { if ((await onConclude(combo, note)) !== false) setConfirming(false) }} // erro: fica aberto com o motivo digitado
        />
      )}
    </div>
  )
}
