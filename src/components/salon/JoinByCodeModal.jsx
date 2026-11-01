import { useState } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import platformApi from '@/lib/platformApi'
import { formatJoinCodeInput, isCompleteJoinCode } from '@/lib/joinCode'

// Vincular-se a um salão pelo código de acesso, em dois passos: digitar o código → ver o nome do
// salão e confirmar. `onJoined(member)` recebe o vínculo (item de GET /salon/my) para entrar no salão.
export function JoinByCodeForm({ onJoined, onCancel, autoFocus = true, showHint = true }) {
  const [code, setCode] = useState('')
  const [found, setFound] = useState(null) // { name, address, alreadyMember }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function lookup(e) {
    e.preventDefault()
    if (!isCompleteJoinCode(code)) return setError('O código tem 8 caracteres (XXXX-XXXX).')
    setBusy(true)
    setError('')
    try {
      const { data } = await platformApi.get(`/salon/by-code/${code}`)
      setFound(data)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Não foi possível verificar o código.')
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    setError('')
    try {
      const { data } = await platformApi.post('/salon/join-by-code', { code })
      const { data: mine } = await platformApi.get('/salon/my')
      const member = (Array.isArray(mine) ? mine : []).find(m => m.salonId === data.salonId)
      if (!member) throw new Error()
      onJoined(member)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Não foi possível entrar no salão.')
      setBusy(false)
    }
  }

  if (found) {
    return (
      <div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-line bg-surface-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-base text-brand">{found.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-md text-ink truncate">{found.name}</div>
            {found.address && <div className="text-[12px] text-ink-3 truncate">{found.address}</div>}
          </div>
        </div>
        <p className="text-[13.5px] text-ink-2 mb-4">
          {found.alreadyMember ? 'Você já faz parte deste salão. Quer entrar agora?' : <>Este é o salão que você procura? Ao confirmar, você passa a ser cliente de <strong>{found.name}</strong>.</>}
        </p>
        {error && <p className="text-[12px] text-danger mb-3">{error}</p>}
        <div className="flex gap-2.5 justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setFound(null); setError('') }} disabled={busy}>Não é esse</Button>
          <Button size="sm" onClick={join} loading={busy}>Sim, entrar</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={lookup} autoComplete="off">
      <label htmlFor="join-code" className="block text-[11px] text-ink-3 font-medium uppercase tracking-wider mb-1.5">Código do salão</label>
      <input
        id="join-code"
        autoFocus={autoFocus}
        autoComplete="off"
        inputMode="text"
        value={code}
        onChange={e => { setCode(formatJoinCodeInput(e.target.value)); setError('') }}
        placeholder="XXXX-XXXX"
        className="w-full h-[46px] px-[14px] rounded-md border border-line bg-surface text-ink font-mono text-[18px] tracking-[0.2em] text-center
          placeholder:text-ink-4 placeholder:tracking-[0.2em] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
      />
      {showHint ? <p className="text-[12px] text-ink-3 mt-1.5 mb-4">Peça o código ao salão. Ele vem do administrador.</p> : <div className="mb-4" />}
      {error && <p className="text-[12px] text-danger mb-3">{error}</p>}
      <div className="flex gap-2.5 justify-end">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancelar</Button>}
        <Button type="submit" size="sm" loading={busy} disabled={!isCompleteJoinCode(code)}>Continuar</Button>
      </div>
    </form>
  )
}

export default function JoinByCodeModal({ onClose, onJoined }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="Entrar com código" className="relative bg-surface rounded-xl p-6 w-full max-w-sm shadow-md border border-line mx-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-display font-medium text-lg tracking-tight">Entrar em um salão</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <JoinByCodeForm onJoined={onJoined} onCancel={onClose} />
      </div>
    </div>
  )
}
