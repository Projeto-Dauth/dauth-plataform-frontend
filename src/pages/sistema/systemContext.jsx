import { createContext, useCallback, useContext, useState } from 'react'
import platformApi from '@/lib/platformApi'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { DialogShell } from './shared'

// Escritas do painel /sistema. O servidor só aceita alteração com um código do app autenticador digitado há até 5 min
// (resposta 403 `MFA_STEP_UP`): aqui o código é pedido num diálogo e a chamada é refeita sozinha.
// Quem cancela o diálogo recebe um erro com `cancelled: true` (não é falha: não mostrar mensagem).
const WriteCtx = createContext(null)
export const useSystemWrite = () => useContext(WriteCtx)

export const errorOf = (e, fallback) => e.response?.data?.error ?? fallback

export function SystemProvider({ children }) {
  const [asking, setAsking] = useState(null) // { resolve, reject }

  const write = useCallback(async (method, url, data) => {
    const call = () => platformApi.request({ method, url, data })
    try {
      return await call()
    } catch (e) {
      if (e.response?.data?.code !== 'MFA_STEP_UP') throw e
      await new Promise((resolve, reject) => setAsking({ resolve, reject }))
      return call()
    }
  }, [])

  const close = (fn) => { fn(); setAsking(null) }

  return (
    <WriteCtx.Provider value={write}>
      {children}
      {asking && (
        <StepUpDialog
          onDone={() => close(asking.resolve)}
          onCancel={() => close(() => asking.reject(Object.assign(new Error('cancelado'), { cancelled: true })))}
        />
      )}
    </WriteCtx.Provider>
  )
}

function StepUpDialog({ onDone, onCancel }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await platformApi.post('/system/mfa/verify', { code })
      onDone()
    } catch (err) {
      setError(errorOf(err, 'Não foi possível confirmar o código.'))
      setLoading(false)
    }
  }

  return (
    <DialogShell z="z-[60]" title="Confirmar com o código" icon="lock" onClose={onCancel} onSubmit={submit} busy={loading}
      description="Esta ação altera dados. Digite o código de 6 dígitos do app autenticador."
      footer={(
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button type="submit" size="sm" loading={loading} disabled={code.replace(/\D/g, '').length < 6}>Confirmar</Button>
        </>
      )}>
      <Input label="Código" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
        autoFocus maxLength={7} placeholder="000000" error={error} className="!mb-0 text-center font-mono tracking-[0.3em] text-lg" />
    </DialogShell>
  )
}
