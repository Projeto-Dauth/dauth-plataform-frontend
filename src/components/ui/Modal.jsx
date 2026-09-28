import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  loading = false,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-xl p-6 w-full max-w-sm shadow-md border border-line mx-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display font-medium text-lg tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {message && (
          <p className="text-[13.5px] text-ink-2 mb-5 leading-relaxed whitespace-pre-line">{message}</p>
        )}
        <div className="flex gap-2.5 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Aguarde...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
