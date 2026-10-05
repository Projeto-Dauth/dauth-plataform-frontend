import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import platformApi from '@/lib/platformApi'

// Aviso "O Salão X convidou você para a equipe" com Aceitar/Recusar (Marketplace e Meus empregos).
// Some sozinho quando não há convite pendente.
export default function PendingInvitations({ onAccepted }) {
  const [invitations, setInvitations] = useState([])
  const [busy, setBusy] = useState(null) // `${token}:accept|decline`
  const [error, setError] = useState(null)

  useEffect(() => {
    platformApi.get('/platform/me/invitations')
      .then(({ data }) => setInvitations(data))
      .catch(() => {})
  }, [])

  async function respond(token, action) {
    setBusy(`${token}:${action}`)
    setError(null)
    try {
      const { data } = await platformApi.post(`/invitations/${token}/${action}`)
      setInvitations(list => list.filter(i => i.token !== token))
      if (action === 'accept') onAccepted?.(data)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Não foi possível responder ao convite.')
    } finally {
      setBusy(null)
    }
  }

  if (invitations.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-6">
      {invitations.map(inv => (
        <div key={inv.token} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft px-4 py-3.5">
          <p className="flex-1 text-[13.5px] text-brand-soft-ink">
            <strong>{inv.salonName}</strong> convidou você para fazer parte da equipe como profissional.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => respond(inv.token, 'decline')} loading={busy === `${inv.token}:decline`} disabled={!!busy}>
              Recusar
            </Button>
            <Button size="sm" onClick={() => respond(inv.token, 'accept')} loading={busy === `${inv.token}:accept`} disabled={!!busy}>
              Aceitar
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}
