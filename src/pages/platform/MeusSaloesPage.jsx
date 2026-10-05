import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import api from '@/lib/api'
import useSalonStore from '@/store/salonStore'
import useAuthStore from '@/store/authStore'
import Icon from '@/components/ui/Icons'
import Avatar from '@/components/ui/Avatar'

const ROLE_PATH = { Admin: 'admin', Profissional: 'profissional', Usuario: 'cliente', Servico: 'admin' }

const PLAN_CHIP = {
  free:  'bg-surface-3 text-ink-3',
  basic: 'bg-gold-soft text-warning',
  pro:   'bg-brand-soft text-brand',
}

function trialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt) - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

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

export default function MeusSaloesPage() {
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ativos')
  const [archiving, setArchiving] = useState(null)
  const [restoring, setRestoring] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const setSalon = useSalonStore((s) => s.setSalon)
  const { user, logout, updateUser } = useAuthStore()

  function load() {
    platformApi.get('/salon/my?includeArchived=true')
      .then(({ data }) => { setSalons(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function enter(member) {
    setSalon(
      { id: member.salonId, name: member.salon.name, slug: member.salon.slug, plan: member.salon.plan, status: member.salon.status, colorPalette: member.salon.colorPalette ?? null },
      member.role, member.id
    )
    try {
      const { data: perfil } = await api.get('/users/perfil/me', { headers: { 'x-salon-id': member.salonId } })
      updateUser({ id: perfil.UUID, publicId: perfil.UUID, role: perfil.Role, must_change_password: perfil.Must_change_password })
    } catch {}
    navigate(`/${member.salon.slug}/${ROLE_PATH[member.role] ?? 'admin'}`, { replace: true })
  }

  async function handleToggleArchive(e, member) {
    e.stopPropagation()
    setArchiving(member.salonId)
    try {
      await platformApi.patch(`/salon/${member.salonId}/archive`)
      load()
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
      load()
    } catch {} finally {
      setDeleting(false)
    }
  }

  async function handleRestore(e, member) {
    e.stopPropagation()
    setRestoring(member.salonId)
    try {
      await platformApi.patch(`/salon/${member.salonId}/restore`)
      load()
    } catch {} finally {
      setRestoring(null)
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? 'bem-vindo'
  const counts = { ativos: 0, arquivados: 0, excluidos: 0 }
  salons.forEach(m => { counts[salonTab(m.salon)]++ })
  // Aba esvaziou (ex.: cancelou a última exclusão) → volta para Ativos
  const currentTab = tab !== 'ativos' && counts[tab] === 0 ? 'ativos' : tab
  const visible = salons.filter(m => salonTab(m.salon) === currentTab)
  const showTabs = counts.arquivados > 0 || counts.excluidos > 0

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm border-b border-line h-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">
            <span className="font-serif text-white text-sm">D</span>
          </div>
          <span className="font-display font-semibold text-[13.5px] text-ink">Dauth</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <Link to="/minha-conta" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <Avatar name={user.name} index={0} size="sm" />
              <span className="text-sm text-ink-2 hidden sm:block">{user.name}</span>
            </Link>
          )}
          <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-danger transition-colors px-2 py-1.5 rounded-md hover:bg-danger-soft">
            <Icon name="logout" size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* ── Hero ── */}
        <div className="mb-10">
          <p className="eyebrow mb-2">Plataforma</p>
          <h1 className="font-serif text-[40px] font-light text-ink tracking-tight leading-tight">
            Olá, {firstName}.
          </h1>
          <p className="text-ink-3 mt-1.5 text-md">Selecione um salão para gerenciar ou crie um novo.</p>
        </div>

        {/* ── Cabeçalho seção ── */}
        {(loading || salons.length > 0) && (
          <div className="flex items-center justify-between mb-5">
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
            <button onClick={() => navigate('/criar-salao')}
              className="flex items-center gap-1.5 bg-brand text-white text-sm font-display font-medium px-3.5 py-2 rounded-lg hover:bg-brand/90 transition-colors">
              <Icon name="plus" size={14} />
              Novo salão
            </button>
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-xl border border-line bg-surface animate-pulse" />)}
          </div>
        ) : salons.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((member) => {
              const isArchived = !!member.salon.archivedAt
              const isScheduledDeletion = !!member.salon.scheduledDeletionAt
              const isAdmin = member.role === 'Admin'
              return (
                <div key={member.id}
                  className={`group relative flex flex-col p-5 bg-surface border border-line rounded-xl transition-all text-left
                    ${isArchived || isScheduledDeletion ? 'opacity-60' : 'hover:border-brand/40 hover:shadow-md'}`}>

                  {/* Clicável para entrar (exceto arquivado) */}
                  {!isArchived && !isScheduledDeletion && (
                    <button onClick={() => enter(member)} className="absolute inset-0 rounded-xl" aria-label={`Entrar em ${member.salon.name}`} />
                  )}

                  <div className="flex items-start justify-between mb-4 relative">
                    <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                      <span className="font-display font-bold text-base text-brand">
                        {member.salon.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {!isArchived && !isScheduledDeletion && (
                      <Icon name="chevronRight" size={15} className="text-ink-4 group-hover:text-brand transition-colors mt-0.5" />
                    )}
                  </div>

                  <div className="font-display font-semibold text-md text-ink truncate mb-0.5">{member.salon.name}</div>
                  <div className="font-mono text-[10.5px] text-ink-4 mb-4">/{member.salon.slug}</div>

                  <div className="flex items-center gap-2 mt-auto flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium uppercase tracking-wide ${PLAN_CHIP[member.salon.plan] ?? 'bg-surface-3 text-ink-3'}`}>
                      {member.salon.plan}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-brand-soft text-brand">
                      {member.role}
                    </span>
                    <StatusBadge salon={member.salon} />
                  </div>

                  {isAdmin && isScheduledDeletion && (
                    <div className="relative flex items-center gap-2 mt-3 pt-3 border-t border-line">
                      <button
                        onClick={e => handleRestore(e, member)}
                        disabled={restoring === member.salonId}
                        className="text-[11.5px] text-ink-3 hover:text-ink transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-2">
                        <Icon name="repeat" size={12} />
                        {restoring === member.salonId ? '…' : 'Cancelar exclusão'}
                      </button>
                    </div>
                  )}

                  {/* Ações admin (z acima do botão overlay) */}
                  {isAdmin && !isScheduledDeletion && (
                    <div className="relative flex items-center gap-2 mt-3 pt-3 border-t border-line">
                      <button
                        onClick={e => handleToggleArchive(e, member)}
                        disabled={archiving === member.salonId}
                        className="text-[11.5px] text-ink-3 hover:text-ink transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-2">
                        <Icon name={isArchived ? 'eye' : 'archive'} size={12} />
                        {archiving === member.salonId ? '…' : isArchived ? 'Desarquivar' : 'Arquivar'}
                      </button>
                      {!isArchived && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(member) }}
                          className="text-[11.5px] text-danger/60 hover:text-danger transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-danger-soft">
                          <Icon name="trash" size={12} />
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Card novo salão */}
            {currentTab === 'ativos' && <button onClick={() => navigate('/criar-salao')}
              className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-line rounded-xl hover:border-brand/40 hover:bg-brand-soft/20 transition-all min-h-[176px] text-ink-3 hover:text-brand">
              <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center mb-2">
                <Icon name="plus" size={16} />
              </div>
              <span className="text-sm font-display font-medium">Novo salão</span>
            </button>}
          </div>
        )}

        {!loading && salons.length === 0 && (
          <div className="border-2 border-dashed border-line rounded-xl p-12 text-center mt-4">
            <div className="text-4xl mb-4">✂️</div>
            <h3 className="font-serif text-[26px] font-light text-ink mb-1">Nenhum salão criado ainda</h3>
            <p className="text-sm text-ink-3 mb-6">Crie seu primeiro salão e comece a gerenciar agendamentos.</p>
            <button onClick={() => navigate('/criar-salao')}
              className="inline-flex items-center gap-2 bg-brand text-white text-sm font-display font-medium px-4 py-2.5 rounded-lg hover:bg-brand/90 transition-colors">
              <Icon name="plus" size={14} />
              Criar primeiro salão
            </button>
          </div>
        )}
      </main>

      {deleteTarget && (
        <DeleteModal
          salon={deleteTarget.salon}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  )
}
