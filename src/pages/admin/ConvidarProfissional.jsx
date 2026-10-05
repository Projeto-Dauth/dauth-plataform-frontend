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
import { formatPhone } from '@/lib/phone'

const navItems = navItemsByRole['Admin']

const STATUS_CHIP = {
  ativo: { label: 'Ativo', cls: 'bg-success-soft text-success' },
  pendente: { label: 'Pendente', cls: 'bg-[#dbeafe] text-[#1d4ed8]' },
  expirado: { label: 'Convite expirado', cls: 'bg-danger-soft text-danger' },
}

// "Plano Essencial · 1/3 profissionais" + barra de vagas. `limit: null` = sem limite (Business).
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

// Contas de serviço: o notebook que fica aberto no salão. Login = telefone (00), senha definida aqui.
// O que a conta acessa (Agenda, Caixa, Clientes, Serviços) é ajustado na ficha dela em Clientes.
function ServiceAccounts({ accounts, salonId, onChange }) {
  const { addToast } = useToast()
  const headers = { 'x-salon-id': salonId }
  const [form, setForm] = useState({ name: '', phone: '(00) ', password: '' })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null) // { id, mode: 'password' | 'remove', password }
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await platformApi.post('/salon/service-accounts', form, { headers })
      addToast(`Conta de serviço criada. Login: ${form.phone}`, 'success')
      setForm({ name: '', phone: '(00) ', password: '' })
      onChange()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao criar conta de serviço', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm(acc) {
    setBusy(true)
    try {
      if (editing.mode === 'password') {
        await platformApi.patch(`/salon/service-accounts/${acc.id}/password`, { password: editing.password }, { headers })
        addToast('Senha da conta de serviço alterada', 'success')
      } else {
        await platformApi.delete(`/salon/members/${acc.id}`, { headers })
        addToast('Conta de serviço removida', 'success')
        onChange()
      }
      setEditing(null)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao salvar', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h4 className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2 mt-8">
        Contas de serviço{accounts ? ` (${accounts.length})` : ''}
      </h4>
      <form onSubmit={handleCreate} className="bg-surface border border-line rounded-xl p-5 mb-3">
        <p className="text-[12px] text-ink-3 leading-relaxed mb-3">
          Para o computador que fica aberto no salão. Entra com um telefone de DDD (00) — que não é de nenhuma pessoa — e a senha que você definir. Acessa Agenda, Caixa, Clientes e Serviços; ajuste o que ela vê na ficha da conta em Clientes. Nunca vê comissões, relatórios nem configurações.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Input label="Nome" aria-label="Nome da conta de serviço" value={form.name} placeholder="Ex: Recepção"
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Telefone (login)" aria-label="Telefone da conta de serviço" value={form.phone} placeholder="(00) 9 0000-0001"
            onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} />
          <Input label="Senha" aria-label="Senha da conta de serviço" type="password" value={form.password} placeholder="Mínimo 8 caracteres"
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        <Button type="submit" loading={saving} disabled={!form.name.trim() || form.password.length < 8 || !form.phone.startsWith('(00)')} className="w-full justify-center">
          Criar conta de serviço
        </Button>
      </form>
      <div className="bg-surface border border-line rounded-xl">
        {!accounts ? (
          <div className="h-16 animate-pulse bg-surface-2 rounded-xl" />
        ) : accounts.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-ink-3">Nenhuma conta de serviço.</p>
        ) : accounts.map(acc => (
          <div key={acc.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line-3 last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium text-ink truncate">{acc.name}</div>
              <div className="font-mono text-[11.5px] text-ink-3">{acc.phone}</div>
            </div>
            {editing?.id === acc.id ? (
              <div className="flex items-center gap-1.5">
                {editing.mode === 'password' && (
                  <input type="password" aria-label={`Nova senha de ${acc.name}`} placeholder="Nova senha (mín. 8)" value={editing.password}
                    onChange={e => setEditing(ed => ({ ...ed, password: e.target.value }))}
                    className="h-8 px-2 rounded border border-line bg-surface text-ink text-[13px] focus:outline-none focus:border-brand" />
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Voltar</Button>
                {editing.mode === 'password'
                  ? <Button size="sm" loading={busy} disabled={editing.password.length < 8} onClick={() => handleConfirm(acc)}>Salvar senha</Button>
                  : <Button size="sm" loading={busy} className="!bg-danger !border-danger hover:!bg-danger" onClick={() => handleConfirm(acc)}>Remover conta</Button>}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: acc.id, mode: 'password', password: '' })}>Trocar senha</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: acc.id, mode: 'remove' })}>Remover</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
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
        <div className="font-mono text-[11.5px] text-ink-3 truncate">{m.email ?? m.phone}</div>
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
  const pendingList = data?.invitations ?? []
  const activeList = (data?.members ?? []).map(m => ({ ...m, status: 'ativo' }))

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
      const { data: r } = await platformApi.post('/salon/invite-professional', { name: name.trim(), email: email.trim() }, { headers })
      addToast(r.message ?? `Convite enviado para ${email.trim()}`, 'success')
      setName('')
      setEmail('')
      setErrors({})
    } catch (err) {
      addToast(err.response ? (err.response.data?.error ?? 'Erro ao enviar convite') : 'Sem resposta do servidor. O convite pode ter sido salvo — tente de novo que ele é reenviado.', 'error')
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
            A pessoa recebe um link por email: quem já tem conta no Dauth só entra e aceita; quem não tem cria a conta pelo próprio link. Para chamar alguém que já é cliente do salão, use “Convidar para a equipe” na ficha do cliente. O link vale 7 dias — depois, use “Reenviar”.
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

        <ServiceAccounts accounts={data ? (data.serviceAccounts ?? []) : null} salonId={salon?.id} onChange={load} />
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
