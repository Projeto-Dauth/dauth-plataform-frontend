import { useState } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'

// Confirmação com motivo obrigatório (mín. 3 letras) — concluir pacote, desfazer repasse, reabrir comanda paga.
// `onConfirm(reason)` recebe o motivo já sem espaços nas pontas.
export default function ReasonDialog({ title, message, label = 'Motivo', placeholder, confirmLabel, confirmVariant = 'primary', loading, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 3
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative bg-surface rounded-xl p-6 w-full max-w-md shadow-md border border-line mx-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display font-medium text-lg tracking-tight">{title}</h3>
          <button onClick={onCancel} disabled={loading} aria-label="Fechar" className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>
        {message && <p className="text-[13.5px] text-ink-2 mb-4 leading-relaxed whitespace-pre-line">{message}</p>}
        <label className="flex flex-col gap-1.5 mb-5">
          <span className="text-[12px] font-medium text-ink-2">{label}</span>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={placeholder}
            rows={3}
            maxLength={500}
            autoFocus
            className="w-full px-[14px] py-[10px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors resize-none"
          />
        </label>
        <div className="flex gap-2.5 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button variant={confirmVariant} size="sm" onClick={() => onConfirm(reason.trim())} disabled={!valid} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
