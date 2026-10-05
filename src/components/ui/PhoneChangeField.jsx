import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import platformApi from '@/lib/platformApi'
import { formatPhone } from '@/lib/phone'

// Campo "Telefone" com troca confirmada por WhatsApp — usado em Minha conta e em /:salonSlug/perfil.
// O telefone é o login em todos os salões: o número novo só vale depois que o link enviado
// para ele é aberto (POST /platform/me/phone → /confirmar-telefone).
// Fica dentro de <form> nas duas telas: todo botão é type="button" e Enter não envia o form de fora.
export default function PhoneChangeField() {
  const [phone, setPhone] = useState(null)
  const [pendingPhone, setPendingPhone] = useState(null)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(null) // 'send' | 'cancel'
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    platformApi.get('/platform/me')
      .then(({ data }) => { setPhone(data.phone); setPendingPhone(data.pendingPhone) })
      .catch(() => {})
  }, [])

  async function requestChange(number) {
    setBusy('send')
    setMsg(null)
    try {
      const { data } = await platformApi.post('/platform/me/phone', { phone: number })
      setPendingPhone(data.pendingPhone)
      setEditing(false)
      setMsg({ type: 'ok', text: data.message })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error ?? 'Erro ao pedir a troca. Tente novamente.' })
    } finally {
      setBusy(null)
    }
  }

  async function cancelChange() {
    setBusy('cancel')
    setMsg(null)
    try {
      await platformApi.delete('/platform/me/phone')
      setPendingPhone(null)
    } catch {
      setMsg({ type: 'err', text: 'Erro ao cancelar a troca.' })
    } finally {
      setBusy(null)
    }
  }

  function startEdit() {
    setValue('')
    setMsg(null)
    setEditing(true)
  }

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-xs text-ink-3 font-medium">Telefone</label>

      {editing ? (
        <div className="flex flex-wrap gap-2">
          <input
            autoFocus
            type="tel"
            value={value}
            onChange={e => setValue(formatPhone(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); requestChange(value) } }}
            placeholder="(11) 9 9999-0000"
            className="h-[42px] flex-1 min-w-[180px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
          />
          <Button type="button" onClick={() => requestChange(value)} loading={busy === 'send'}>Enviar confirmação</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={busy === 'send'}>Cancelar</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="h-[42px] flex-1 flex items-center px-[14px] rounded-md border border-line bg-surface-2 text-ink-2 font-body text-md">
            {phone ?? '—'}
          </div>
          {!pendingPhone && (
            <Button type="button" variant="outline" onClick={startEdit}>Alterar</Button>
          )}
        </div>
      )}

      {pendingPhone && !editing && (
        <div className="mt-1 rounded-md bg-brand-soft px-3.5 py-3 text-[12.5px] text-brand-soft-ink">
          <p>
            Aguardando confirmação de <strong>{pendingPhone}</strong>. Enviamos um link para o WhatsApp desse número;
            até ele ser aberto, seu login continua com {phone}.
          </p>
          <div className="flex flex-wrap gap-2 mt-2.5">
            <Button type="button" size="sm" variant="outline" onClick={() => requestChange(pendingPhone)} loading={busy === 'send'} disabled={!!busy}>
              Reenviar link
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelChange} loading={busy === 'cancel'} disabled={!!busy}>
              Cancelar troca
            </Button>
          </div>
        </div>
      )}

      {msg && <span className={`text-xs ${msg.type === 'ok' ? 'text-success' : 'text-danger'}`}>{msg.text}</span>}
      {!pendingPhone && !msg && (
        <span className="text-xs text-ink-4">É o seu login em todos os salões. O número novo precisa ser confirmado pelo WhatsApp.</span>
      )}
    </div>
  )
}
