import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import { canEnterSalon } from '@/lib/salonAccess'
import { enterSalon } from '@/lib/enterSalon'
import useAuthStore from '@/store/authStore'
import { useToast } from '@/context/ToastContext'
import Icon from '@/components/ui/Icons'
import logo from '@/logo-dauth-agendamentos.png'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import PendingInvitations from '@/components/ui/PendingInvitations'
import SalonCard from '@/components/salon/SalonCard'
import JoinByCodeModal, { JoinByCodeForm } from '@/components/salon/JoinByCodeModal'
import { signOut } from '@/lib/signOut'

function trialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt) - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// Situação do plano — só o Admin do salão vê
function StatusBadge({ salon }) {
  if (salon.scheduledDeletionAt) {
    const days = trialDaysLeft(salon.scheduledDeletionAt)
    return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-danger-soft text-danger">Exclui em {days}d</span>
  }
  if (salon.archivedAt) {
    return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-surface-3 text-ink-3">Arquivado</span>
  }
  if (salon.status === 'suspended') {
    return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-danger-soft text-danger">Suspenso</span>
  }
  if (salon.status === 'pending_payment') {
    return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-warning-soft text-warning">Aguardando pagamento</span>
  }
  if (salon.status === 'trial') {
    const days = trialDaysLeft(salon.trialEndsAt)
    if (days === 0) return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-danger-soft text-danger">Trial expirado</span>
    return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-warning-soft text-warning">Trial · {days}d</span>
  }
  return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-success-soft text-success">Ativo</span>
}

const TABS = [
  { id: 'ativos',     label: 'Ativos' },
  { id: 'arquivados', label: 'Arquivados' },
  { id: 'excluidos',  label: 'Excluídos' },
]

// Exclusão agendada tem prioridade sobre arquivado
function salonTab(salon) {
  if (salon.scheduledDeletionAt) return 'excluidos'
  if (salon.archivedAt) return 'arquivados'
  return 'ativos'
}

function DeleteModal({ salon, onClose, onConfirm, loading }) {
  const [input, setInput] = useState('')
  const match = input === salon.name

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-line w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-xl bg-danger-soft flex items-center justify-center mb-4">
          <Icon name="trash" size={20} className="text-danger" />
        </div>
        <h3 className="font-display font-semibold text-[18px] text-ink mb-1">Excluir salão</h3>
        <p className="text-[13px] text-ink-3 mb-4 leading-relaxed">
          Isso agenda a exclusão de <strong className="text-ink">{salon.name}</strong> em <strong className="text-ink">30 dias</strong>. Todos os dados serão removidos permanentemente.
        </p>
        <label className="block text-[12px] text-ink-3 mb-1.5">Digite <strong className="text-ink font-mono">{salon.name}</strong> para confirmar:</label>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-line bg-bg text-[13px] focus:outline-none focus:border-danger transition-colors mb-4"
          placeholder={salon.name}
        />
        <div className="flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-surface-2 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={!match || loading}
            className={`flex-1 h-9 rounded-lg text-[13px] font-medium text-white transition-colors
              ${match && !loading ? 'bg-danger hover:bg-danger/90' : 'bg-danger/30 cursor-not-allowed'}`}>
            {loading ? 'Agendando…' : 'Confirmar exclusão'}
          </button>
        </div>
      </div>
    </div>
  )
}

const footerButton = 'text-[11.5px] text-ink-3 hover:text-ink transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-2'

// Tela única de entrada no produto para todo mundo (cliente, profissional, conta de serviço, Admin e
// dono): lista os salões em que a pessoa tem vínculo, mostra convites da equipe e permite entrar em
// outro salão pelo código de acesso. Só o dono tem "Novo salão"; só o Admin tem arquivar/excluir.
export default function MeusSaloesPage() {
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ativos')
  const [entering, setEntering] = useState(null)
  const [archiving, setArchiving] = useState(null)
  const [restoring, setRestoring] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuthStore()
  const isOwner = user?.platformRole === 'SalonOwner'

  function load() {
    return platformApi.get('/salon/my?includeArchived=true')
      .then(({ data }) => setSalons(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function enter(member) {
    setEntering(member.id)
    await enterSalon(member, navigate)
  }

  async function handleToggleArchive(member) {
    setArchiving(member.salonId)
    try {
      await platformApi.patch(`/salon/${member.salonId}/archive`)
      await load()
    } catch {} finally {
      setArchiving(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await platformApi.delete(`/salon/${deleteTarget.salonId}`)
      setDeleteTarget(null)
      await load()
    } catch {} finally {
      setDeleting(false)
    }
  }

  async function handleRestore(member) {
    setRestoring(member.salonId)
    try {
      await platformApi.patch(`/salon/${member.salonId}/restore`)
      await load()
    } catch {} finally {
      setRestoring(null)
    }
  }

  async function handleLeave() {
    if (!leaveTarget) return
    setLeaving(true)
    try {
      await platformApi.post(`/salon/${leaveTarget.salonId}/leave`)
      setLeaveTarget(null)
      await load()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Não foi possível sair do salão.', 'error')
      setLeaveTarget(null)
    } finally {
      setLeaving(false)
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? 'bem-vindo'
  // Salão arquivado/excluído só aparece para o Admin (que pode desarquivar/cancelar a exclusão)
  const members = salons.filter(m => m.role === 'Admin' || canEnterSalon(m))
  const counts = { ativos: 0, arquivados: 0, excluidos: 0 }
  members.forEach(m => { counts[salonTab(m.salon)]++ })
  // Aba esvaziou (ex.: cancelou a última exclusão) → volta para Ativos
  const currentTab = tab !== 'ativos' && counts[tab] === 0 ? 'ativos' : tab
  const visible = members.filter(m => salonTab(m.salon) === currentTab)
  const showTabs = counts.arquivados > 0 || counts.excluidos > 0

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm border-b border-line h-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Dauth" className="w-8 h-8 rounded-md object-cover" />
          <span className="font-display font-semibold text-[13.5px] text-ink">Dauth</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <Link to="/minha-conta" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <Avatar name={user.name} index={0} size="sm" />
              <span className="text-sm text-ink-2 hidden sm:block">{user.name}</span>
            </Link>
          )}
          <button onClick={async () => { await signOut(); navigate('/login', { replace: true }) }} aria-label="Sair da conta"
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-danger transition-colors px-2 py-1.5 rounded-md hover:bg-danger-soft">
            <Icon name="logout" size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* ── Hero ── */}
        <div className="mb-10">
          <p className="eyebrow mb-2">Meus salões</p>
          <h1 className="font-serif text-[40px] font-light text-ink tracking-tight leading-tight">
            Olá, {firstName}.
          </h1>
          <p className="text-ink-3 mt-1.5 text-md">Escolha um salão para entrar.</p>
        </div>

        <PendingInvitations onAccepted={load} />

        {/* ── Cabeçalho seção ── */}
        {!loading && members.length > 0 && (
          <div className="flex items-center justify-between mb-5 gap-3">
            <div className="flex items-center gap-6">
              {showTabs ? TABS.filter(t => t.id === 'ativos' || counts[t.id] > 0).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`eyebrow transition-colors ${currentTab === t.id ? 'text-ink' : 'text-ink-4 hover:text-ink-2'}`}>
                  {t.label} · {counts[t.id]}
                </button>
              )) : (
                <h2 className="eyebrow">Seus salões</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setJoinOpen(true)}
                className="flex items-center gap-1.5 border border-line bg-surface text-ink-2 text-sm font-display font-medium px-3.5 py-2 rounded-lg hover:border-ink-3 transition-colors">
                <Icon name="lock" size={14} />
                Tenho um código
              </button>
              {isOwner && (
                <button onClick={() => navigate('/criar-salao')}
                  className="flex items-center gap-1.5 bg-brand text-white text-sm font-display font-medium px-3.5 py-2 rounded-lg hover:bg-brand-dark transition-colors">
                  <Icon name="plus" size={14} />
                  Novo salão
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-xl border border-line bg-surface animate-pulse" />)}
          </div>
        ) : members.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((member) => {
              const isAdmin = member.role === 'Admin'
              const isArchived = !!member.salon.archivedAt
              const isScheduledDeletion = !!member.salon.scheduledDeletionAt
              const unavailable = isArchived || isScheduledDeletion

              let footer = null
              if (isAdmin && isScheduledDeletion) {
                footer = (
                  <button onClick={() => handleRestore(member)} disabled={restoring === member.salonId} className={footerButton}>
                    <Icon name="repeat" size={12} />
                    {restoring === member.salonId ? '…' : 'Cancelar exclusão'}
                  </button>
                )
              } else if (isAdmin) {
                footer = (
                  <>
                    <button onClick={() => handleToggleArchive(member)} disabled={archiving === member.salonId} className={footerButton}>
                      <Icon name={isArchived ? 'eye' : 'archive'} size={12} />
                      {archiving === member.salonId ? '…' : isArchived ? 'Desarquivar' : 'Arquivar'}
                    </button>
                    {!isArchived && (
                      <button onClick={() => setDeleteTarget(member)}
                        className="text-[11.5px] text-danger/60 hover:text-danger transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-danger-soft">
                        <Icon name="trash" size={12} />
                        Excluir
                      </button>
                    )}
                  </>
                )
              } else if (member.role === 'Usuario') {
                // Só o cliente sai sozinho; profissional e conta de serviço dependem do Admin
                footer = (
                  <button onClick={() => setLeaveTarget(member)} className={footerButton}>
                    <Icon name="logout" size={12} />
                    Sair do salão
                  </button>
                )
              }

              return (
                <SalonCard key={member.id} member={member} unavailable={unavailable}
                  entering={entering === member.id} onEnter={enter}
                  badge={isAdmin ? <StatusBadge salon={member.salon} /> : null}
                  footer={footer} />
              )
            })}

            {/* Card novo salão */}
            {isOwner && currentTab === 'ativos' && <button onClick={() => navigate('/criar-salao')}
              className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-line rounded-xl hover:border-brand/40 hover:bg-brand-soft/20 transition-all min-h-[176px] text-ink-3 hover:text-brand">
              <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center mb-2">
                <Icon name="plus" size={16} />
              </div>
              <span className="text-sm font-display font-medium">Novo salão</span>
            </button>}
          </div>
        )}

        {/* ── Sem nenhum vínculo ── */}
        {!loading && members.length === 0 && (
          <div className="border-2 border-dashed border-line rounded-xl p-8 sm:p-12 text-center mt-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
              <Icon name="scissors" size={24} className="text-ink-3" />
            </div>
            <h3 className="font-serif text-[26px] font-light text-ink mb-1">Você ainda não tem vínculo com nenhum salão</h3>
            <p className="text-sm text-ink-3 mb-6">Digite o código que o salão passou para você e entre.</p>
            <div className="max-w-xs mx-auto text-left">
              <JoinByCodeForm onJoined={enter} />
            </div>
            {isOwner && (
              <div className="mt-8 pt-6 border-t border-line">
                <p className="text-sm text-ink-3 mb-3">Tem um salão para administrar?</p>
                <button onClick={() => navigate('/criar-salao')}
                  className="inline-flex items-center gap-2 bg-brand text-white text-sm font-display font-medium px-4 py-2.5 rounded-lg hover:bg-brand-dark transition-colors">
                  <Icon name="plus" size={14} />
                  Criar meu salão
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {joinOpen && <JoinByCodeModal onClose={() => setJoinOpen(false)} onJoined={enter} />}

      {deleteTarget && (
        <DeleteModal
          salon={deleteTarget.salon}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      <Modal
        isOpen={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onConfirm={handleLeave}
        loading={leaving}
        title="Sair do salão"
        message={leaveTarget && `Você deixa de ser cliente de ${leaveTarget.salon.name}. Seu histórico fica guardado, e dá para voltar a qualquer momento com o código do salão.`}
        confirmLabel="Sair do salão"
        confirmVariant="primary"
      />
    </div>
  )
}
