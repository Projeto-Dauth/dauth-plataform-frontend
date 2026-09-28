import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Icon from '@/components/ui/Icons'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import platformApi from '@/lib/platformApi'
import useSalonStore from '@/store/salonStore'
import { navItemsByRole } from '@/config/navItems'
import { PLANS } from '@/config/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'

const navItems = navItemsByRole['Admin']

const STATUS_CHIP = {
  ativo: { label: 'Ativo', cls: 'bg-success-soft text-success' },
  pendente: { label: 'Pendente', cls: 'bg-[#dbeafe] text-[#1d4ed8]' },
  expirado: { label: 'Convite expirado', cls: 'bg-danger-soft text-danger' },
}

// "Plano Essencial · 1/3 profissionais" + barra de vagas. `limit: null` = sem limite (Business ou trial).
function PlanCard({ usage, onUpgrade }) {
  if (!usage) return <div className="h-[92px] rounded-xl bg-surface-2 animate-pulse mb-5" />
  const { used, pending, limit, plan, status } = usage
  const unlimited = limit === null
  const left = unlimited ? null : Math.max(0, limit - used)
  const full = !unlimited && left === 0
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100)
  const planLabel = status === 'trial' ? 'Trial' : `Plano ${PLANS.find(p => p.id === plan)?.label ?? ''}`.trim()
  return (
    <div className={`rounded-xl border p-4 mb-5 ${full ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface'}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[13px] font-medium text-ink">
          {planLabel} · {unlimited ? `${used} ${used === 1 ? 'profissional' : 'profissionais'}` : `${used}/${limit} profissionais`}
        </span>
        {unlimited && <span className="font-mono text-[11px] text-ink-3 uppercase tracking-wider">sem limite</span>}
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all ${full ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-3">
          {unlimited
            ? 'Você pode convidar quantos profissionais quiser.'
            : full
              ? 'Limite atingido. Faça upgrade para convidar mais.'
              : `${left} ${left === 1 ? 'vaga restante' : 'vagas restantes'}`}
          {pending > 0 && ` · ${pending} ${pending === 1 ? 'convite pendente ocupa' : 'convites pendentes ocupam'} vaga`}
        </p>
        {full && <Button size="sm" onClick={onUpgrade}>Fazer upgrade</Button>}
      </div>
    </div>
  )
}

function MemberRow({ m, onResend, onCancel, busy }) {
  const [confirming, setConfirming] = useState(false)
  const chip = STATUS_CHIP[m.status]
  const invited = new Date(m.invitedAt).toLocaleDateString('pt-BR')
  const isInvite = m.status !== 'ativo'
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-line-3 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-ink truncate">{m.name}</div>
        <div className="font-mono text-[11.5px] text-ink-3 truncate">{m.email}</div>
        {isInvite && <div className="text-[11px] text-ink-4 mt-0.5">Convidado em {invited}</div>}
      </div>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${chip.cls}`}>{chip.label}</span>
      {isInvite && (
        confirming ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Voltar</Button>
            <Button size="sm" loading={busy} className="!bg-danger !border-danger hover:!bg-danger" onClick={() => onCancel(m.id)}>Cancelar convite</Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" loading={busy} onClick={() => onResend(m.id)}>Reenviar</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>Cancelar</Button>
          </div>
        )
      )}
    </div>
  )
}

export default function ConvidarProfissional() {
  const { salonSlug } = useParams()
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const salon = useSalonStore(s => s.salon)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const headers = { 'x-salon-id': salon?.id }

  const load = useCallback(() => {
    if (!salon?.id) return
    platformApi.get('/salon/professionals', { headers: { 'x-salon-id': salon.id } })
      .then(r => setData(r.data))
      .catch(() => {})
  }, [salon?.id])

  useEffect(() => { load() }, [load])

  const usage = data?.usage ?? null
  const limitReached = usage?.limit != null && usage.used >= usage.limit
  // Sugere o menor plano que comporte mais profissionais que o limite atual.
  const upgradeTarget = PLANS.find(p => p.maxProfessionals === null || p.maxProfessionals > (usage?.limit ?? 0))?.id
  const pendingList = (data?.members ?? []).filter(m => m.status !== 'ativo')
  const activeList = (data?.members ?? []).filter(m => m.status === 'ativo')

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Nome obrigatório'
    if (!email.trim()) e.email = 'Email obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await platformApi.post('/salon/invite-professional', { name: name.trim(), email: email.trim() }, { headers })
      addToast(`Convite enviado para ${email.trim()}`, 'success')
      setName('')
      setEmail('')
      setErrors({})
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao enviar convite', 'error')
    } finally {
      setLoading(false)
      load()
    }
  }

  async function handleResend(memberId) {
    setBusyId(memberId)
    try {
      const { data: r } = await platformApi.post(`/salon/invitations/${memberId}/resend`, {}, { headers })
      addToast(r.message ?? 'Convite reenviado', 'success')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao reenviar convite', 'error')
    } finally {
      setBusyId(null)
      load()
    }
  }

  async function handleCancel(memberId) {
    setBusyId(memberId)
    try {
      await platformApi.delete(`/salon/invitations/${memberId}`, { headers })
      addToast('Convite cancelado', 'success')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao cancelar convite', 'error')
    } finally {
      setBusyId(null)
      load()
    }
  }

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate(`/${salonSlug}/admin/usuarios`)} className="text-ink-3 hover:text-ink transition-colors cursor-pointer">
            <Icon name="arrowLeft" size={18} />
          </button>
          <div>
            <h3 className="font-display font-medium text-[26px] tracking-tight">Profissionais</h3>
            <p className="text-[13px] text-ink-3 mt-1">
              Convide por email e acompanhe os convites. O link expira em 7 dias.
            </p>
          </div>
        </div>

        <PlanCard usage={usage} onUpgrade={() => setShowUpgrade(true)} />

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-5 mb-6">
          <h4 className="font-display font-medium text-[15px] mb-3">Novo convite</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input
              label="Nome completo"
              value={name}
              onChange={e => setName(e.target.value)}
              error={errors.name}
              placeholder="Ex: Maria Oliveira"
            />
            <Input
              label="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={errors.email}
              placeholder="maria@exemplo.com"
              type="email"
            />
          </div>
          <p className="text-[12px] text-ink-3 leading-relaxed mb-4">
            A pessoa recebe um link para completar o cadastro (telefone e senha). Depois de 7 dias sem aceitar, o link fica inválido — use “Reenviar” na lista.
          </p>
          <Button type="submit" loading={loading} disabled={limitReached} className="w-full justify-center">
            {limitReached ? 'Limite de profissionais atingido' : 'Enviar convite'}
          </Button>
        </form>

        {/* Pendentes */}
        <h4 className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">
          Convites pendentes{data ? ` (${pendingList.length})` : ''}
        </h4>
        <div className="bg-surface border border-line rounded-xl mb-6">
          {!data ? (
            <div className="h-16 animate-pulse bg-surface-2 rounded-xl" />
          ) : pendingList.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-3">Nenhum convite pendente.</p>
          ) : (
            pendingList.map(m => (
              <MemberRow key={m.id} m={m} busy={busyId === m.id} onResend={handleResend} onCancel={handleCancel} />
            ))
          )}
        </div>

        {/* Ativos */}
        <h4 className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">
          Profissionais ativos{data ? ` (${activeList.length})` : ''}
        </h4>
        <div className="bg-surface border border-line rounded-xl">
          {!data ? (
            <div className="h-16 animate-pulse bg-surface-2 rounded-xl" />
          ) : activeList.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-3">Nenhum profissional ativo ainda.</p>
          ) : (
            activeList.map(m => <MemberRow key={m.id} m={m} />)
          )}
        </div>
      </div>

      {showUpgrade && (
        <UpgradeModal
          salonId={salon?.id}
          defaultPlan={upgradeTarget}
          onClose={() => setShowUpgrade(false)}
          onActivated={() => { setShowUpgrade(false); window.location.reload() }}
        />
      )}
    </AppLayout>
  )
}
