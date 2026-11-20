import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { useSystemWrite, errorOf } from './systemContext'
import { DialogShell, textareaCls } from './shared'

// Diálogo comum das ações do painel /sistema (salões e usuários): campos da ação (children) + motivo + enviar.
// O motivo é obrigatório e vai para a aba Auditoria; o servidor pede o código do app autenticador se o último foi há
// mais de 5 min (ver systemContext.jsx). `getBody` monta o corpo da requisição, sem o motivo.
export const REASON_MIN = 5
const REASON_MAX = 300
export { textareaCls }

export function Labeled({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-3 font-medium">{label}</span>
      {children}
    </label>
  )
}

export default function ActionDialog({ url, title, description, confirmLabel, success, danger, icon, method = 'post', valid = true, getBody = () => ({}), onClose, onDone, children }) {
  const write = useSystemWrite()
  const { addToast } = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await write(method, url, { ...getBody(), reason: reason.trim() })
      addToast(success ?? 'Ação concluída com sucesso.', 'success')
      onDone()
    } catch (err) {
      if (!err.cancelled) {
        const message = errorOf(err, 'Não foi possível concluir a ação.')
        setError(message)
        addToast(`Falha: ${message}`, 'error')
      }
      setLoading(false)
    }
  }

  return (
    <DialogShell title={title} description={description} tone={danger ? 'danger' : 'brand'} icon={icon ?? (danger ? 'alertTriangle' : 'shield')}
      onClose={onClose} onSubmit={submit} busy={loading}
      footer={(
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" size="sm" loading={loading} disabled={!valid || reason.trim().length < REASON_MIN}
            className={danger ? '!bg-danger !border-danger hover:!bg-danger/90' : ''}>{confirmLabel}</Button>
        </>
      )}>
      {children}
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-xs font-medium text-ink-3">
          Motivo (fica registrado na auditoria)
          <span className="font-normal text-ink-4">{reason.length}/{REASON_MAX}</span>
        </span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={REASON_MAX} className={textareaCls}
          placeholder="Ex.: pedido do dono por WhatsApp" />
      </label>
      {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
    </DialogShell>
  )
}
