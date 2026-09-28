import { createContext, useContext, useState, useCallback } from 'react'
import Icon from '@/components/ui/Icons'

const ToastContext = createContext(null)

const typeConfig = {
  success: { icon: 'check', bg: 'bg-success-soft', text: 'text-success', border: 'border-success/20' },
  error:   { icon: 'alertCircle', bg: 'bg-danger-soft', text: 'text-danger', border: 'border-danger/20' },
  warning: { icon: 'alertCircle', bg: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/20' },
}

function ToastItem({ toast, onRemove }) {
  const cfg = typeConfig[toast.type] ?? typeConfig.success
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md
        ${cfg.bg} ${cfg.text} ${cfg.border} animate-[fadeIn_0.15s_ease]`}
    >
      <Icon name={cfg.icon} size={14} className="mt-0.5 flex-shrink-0" />
      <span className="text-[13px] font-medium flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
