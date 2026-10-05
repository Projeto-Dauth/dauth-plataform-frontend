import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import platformApi from '@/lib/platformApi'
import api from '@/lib/api'
import { authClient } from '@/lib/authClient'
import Icon from '@/components/ui/Icons'
import Chip from '@/components/ui/Chip'
import LoadMoreButton from '@/components/ui/LoadMoreButton'
import PhoneChangeField from '@/components/ui/PhoneChangeField'
import { usePaginatedList } from '@/hooks/usePaginatedList'

const STATUS_LABELS = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }
const STATUS_OPTIONS = ['', 'pendente', 'confirmado', 'concluido', 'cancelado']
const ROLE_PATH = { Admin: 'admin', Profissional: 'profissional', Usuario: 'cliente', Servico: 'admin' }
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const TABS = ['agendamentos', 'perfil', 'seguranca']
const TAB_LABELS = { agendamentos: 'Agendamentos', perfil: 'Perfil', seguranca: 'Segurança' }

function fmtDateParts(str) {
  if (!str) return { day: '—', month: '', year: '' }
  const [y, m, d] = str.split('-')
  return { day: d, month: MONTH_SHORT[parseInt(m, 10) - 1], year: y }
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function fmtDeviceLine(session) {
  const ua = session.userAgent ?? ''
  if (!ua) return 'Dispositivo desconhecido'
  if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'Navegador'
}

function fmtSessionDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Shared input style ──────────────────────────────────────────────────────
const inputStyle = {
  height: 40, width: '100%', padding: '0 12px',
  borderRadius: 8, border: '1px solid rgba(139,74,43,0.18)',
  background: '#fff', fontSize: 13, color: '#2a1e18',
  fontFamily: "'Inter', sans-serif",
  outline: 'none', transition: 'border-color 0.15s',
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
      <label style={{ fontSize: 11.5, fontWeight: 500, color: '#8b7267', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  )
}

function SaveBtn({ loading, children = 'Salvar alterações' }) {
  return (
    <button type="submit" disabled={loading}
      style={{
        height: 38, padding: '0 20px', borderRadius: 8,
        background: loading ? 'rgba(139,74,43,0.5)' : '#8b4a2b',
        color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer',
        fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif",
        transition: 'background 0.15s',
      }}>
      {loading ? 'Salvando…' : children}
    </button>
  )
}

// ── Tab: Agendamentos ───────────────────────────────────────────────────────
function TabAgendamentos({ appointments, members, hasMore, loadingMore, onLoadMore }) {
  const [salonFilter, setSalonFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const uniqueSalons = members.map(m => m.salon).filter(Boolean).filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)
  const filtered = appointments.filter(a => {
    if (salonFilter && a.salon?.id !== salonFilter) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11.5,
              fontFamily: "'Inter', sans-serif", fontWeight: 500,
              border: statusFilter === s ? '1px solid #8b4a2b' : '1px solid rgba(139,74,43,0.15)',
              background: statusFilter === s ? '#8b4a2b' : 'transparent',
              color: statusFilter === s ? '#fff' : '#8b7267', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {s === '' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {uniqueSalons.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setSalonFilter('')} style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 11,
              fontFamily: "'Inter', monospace",
              border: !salonFilter ? '1px solid rgba(139,74,43,0.4)' : '1px solid rgba(139,74,43,0.12)',
              background: !salonFilter ? 'rgba(139,74,43,0.06)' : 'transparent',
              color: !salonFilter ? '#8b4a2b' : '#b09080', cursor: 'pointer',
            }}>todos os salões</button>
            {uniqueSalons.map(s => (
              <button key={s.id} onClick={() => setSalonFilter(s.id)} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11,
                fontFamily: "'Inter', monospace",
                border: salonFilter === s.id ? '1px solid rgba(139,74,43,0.4)' : '1px solid rgba(139,74,43,0.12)',
                background: salonFilter === s.id ? 'rgba(139,74,43,0.06)' : 'transparent',
                color: salonFilter === s.id ? '#8b4a2b' : '#b09080', cursor: 'pointer',
              }}>{s.name}</button>
            ))}
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: '64px 32px', textAlign: 'center', border: '1px dashed rgba(139,74,43,0.15)', borderRadius: 14 }}>
          <div style={{ fontFamily: "'Inter', serif", fontSize: 42, color: 'rgba(139,74,43,0.15)', marginBottom: 16 }}>✦</div>
          <p style={{ fontSize: 14, color: '#b09080', marginBottom: 12 }}>Nenhum agendamento encontrado.</p>
          <Link to="/marketplace" style={{ fontSize: 12.5, color: '#8b4a2b', textDecoration: 'underline', textUnderlineOffset: 3 }}>Explorar salões</Link>
        </div>
      ) : (
        <div>
          {filtered.map((appt, i) => {
            const { day, month, year } = fmtDateParts(appt.date)
            return (
              <div key={appt.id} style={{
                display: 'grid', gridTemplateColumns: '56px 1fr auto',
                alignItems: 'center', gap: 16, padding: '14px 0',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(139,74,43,0.08)' : 'none',
                animation: 'fadeUp 0.3s ease both', animationDelay: `${i * 0.04}s`,
              }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontFamily: "'Inter', serif", color: '#2a1e18', lineHeight: 1 }}>{day}</div>
                  <div style={{ fontSize: 10, fontFamily: "'Inter', monospace", color: '#8b4a2b', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{month} {year?.slice(2)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#2a1e18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.service ?? 'Serviço'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    {appt.startTime && <span style={{ fontSize: 11, fontFamily: "'Inter', monospace", color: '#b09080' }}>{appt.startTime.slice(0, 5)}</span>}
                    {appt.professional && <span style={{ fontSize: 11.5, color: '#8b7267' }}>{appt.professional}</span>}
                    {appt.salon && uniqueSalons.length > 1 && (
                      <span style={{ fontSize: 10.5, fontFamily: "'Inter', monospace", color: '#c9a57b', padding: '1px 6px', background: 'rgba(201,165,123,0.12)', borderRadius: 3 }}>{appt.salon.name}</span>
                    )}
                  </div>
                </div>
                <Chip status={appt.status} dot style={{ flexShrink: 0 }}>{STATUS_LABELS[appt.status] ?? appt.status}</Chip>
              </div>
            )
          })}
          {hasMore && <LoadMoreButton onClick={onLoadMore} loading={loadingMore} />}
        </div>
      )}
    </div>
  )
}

// ── Tab: Perfil ─────────────────────────────────────────────────────────────
function TabPerfil({ profile, onSaved }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const { data } = await platformApi.patch('/platform/me', { name: name.trim() })
      onSaved(data)
      setMsg({ type: 'ok', text: 'Perfil atualizado.' })
    } catch {
      setMsg({ type: 'err', text: 'Erro ao salvar. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <Field label="Nome completo">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required
          onFocus={e => e.target.style.borderColor = '#8b4a2b'}
          onBlur={e => e.target.style.borderColor = 'rgba(139,74,43,0.18)'} />
      </Field>
      <Field label="E-mail">
        <input style={{ ...inputStyle, background: 'rgba(139,74,43,0.04)', color: '#b09080', cursor: 'not-allowed' }}
          value={profile?.email ?? ''} readOnly />
        <span style={{ fontSize: 11, color: '#b09080' }}>O e-mail não pode ser alterado aqui.</span>
      </Field>
      <PhoneChangeField />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <SaveBtn loading={saving} />
        {msg && <span style={{ fontSize: 12.5, color: msg.type === 'ok' ? '#4a6b3e' : '#8b3a32' }}>{msg.text}</span>}
      </div>
    </form>
  )
}

// ── Tab: Segurança ──────────────────────────────────────────────────────────
function TabSeguranca() {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [revoking, setRevoking] = useState(null)

  useEffect(() => {
    authClient.listSessions()
      .then(({ data }) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false))
  }, [])

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPass.length < 8) return setMsg({ type: 'err', text: 'Nova senha deve ter no mínimo 8 caracteres.' })
    if (newPass !== confirm) return setMsg({ type: 'err', text: 'As senhas não coincidem.' })
    setSaving(true)
    setMsg(null)
    try {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: newPass, revokeOtherSessions: false })
      if (error) throw new Error(error.message ?? 'Erro')
      setCurrent(''); setNewPass(''); setConfirm('')
      setMsg({ type: 'ok', text: 'Senha atualizada com sucesso.' })
    } catch (err) {
      setMsg({ type: 'err', text: err.message ?? 'Senha atual incorreta ou erro desconhecido.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(token) {
    setRevoking(token)
    try {
      await authClient.revokeSession({ token })
      setSessions(s => s.filter(x => x.token !== token))
    } catch {} finally {
      setRevoking(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* Trocar senha */}
      <div>
        <h3 style={{ fontFamily: "'Inter', serif", fontSize: 22, fontWeight: 400, color: '#2a1e18', margin: '0 0 16px' }}>Trocar senha</h3>
        <form onSubmit={handleChangePassword} style={{ maxWidth: 400 }}>
          <Field label="Senha atual">
            <input type="password" style={inputStyle} value={current} onChange={e => setCurrent(e.target.value)} required
              onFocus={e => e.target.style.borderColor = '#8b4a2b'} onBlur={e => e.target.style.borderColor = 'rgba(139,74,43,0.18)'} />
          </Field>
          <Field label="Nova senha">
            <input type="password" style={inputStyle} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" required
              onFocus={e => e.target.style.borderColor = '#8b4a2b'} onBlur={e => e.target.style.borderColor = 'rgba(139,74,43,0.18)'} />
          </Field>
          <Field label="Confirmar nova senha">
            <input type="password" style={inputStyle} value={confirm} onChange={e => setConfirm(e.target.value)} required
              onFocus={e => e.target.style.borderColor = '#8b4a2b'} onBlur={e => e.target.style.borderColor = 'rgba(139,74,43,0.18)'} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <SaveBtn loading={saving}>Atualizar senha</SaveBtn>
            {msg && <span style={{ fontSize: 12.5, color: msg.type === 'ok' ? '#4a6b3e' : '#8b3a32' }}>{msg.text}</span>}
          </div>
        </form>
      </div>

      {/* Sessões ativas */}
      <div>
        <h3 style={{ fontFamily: "'Inter', serif", fontSize: 22, fontWeight: 400, color: '#2a1e18', margin: '0 0 4px' }}>Sessões ativas</h3>
        <p style={{ fontSize: 12.5, color: '#b09080', margin: '0 0 16px' }}>Revogue sessões em dispositivos que você não reconhece.</p>
        {loadingSessions ? (
          <div style={{ color: '#b09080', fontSize: 13 }}>Carregando…</div>
        ) : sessions.length === 0 ? (
          <div style={{ color: '#b09080', fontSize: 13 }}>Nenhuma sessão encontrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
            {sessions.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(139,74,43,0.10)', background: '#fff',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2a1e18' }}>{fmtDeviceLine(s)}</div>
                  <div style={{ fontSize: 11, fontFamily: "'Inter', monospace", color: '#b09080', marginTop: 2 }}>
                    {s.ipAddress ? `${s.ipAddress} · ` : ''}{fmtSessionDate(s.createdAt)}
                  </div>
                </div>
                <button onClick={() => handleRevoke(s.token)} disabled={revoking === s.token}
                  style={{
                    fontSize: 11.5, color: revoking === s.token ? '#b09080' : '#8b3a32',
                    background: 'none', border: 'none', cursor: revoking === s.token ? 'default' : 'pointer',
                    fontFamily: "'Inter', sans-serif", padding: '4px 8px', borderRadius: 6,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (revoking !== s.token) e.currentTarget.style.background = 'rgba(139,58,50,0.07)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {revoking === s.token ? 'Revogando…' : 'Revogar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function MinhaContaPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const setSalon = useSalonStore((s) => s.setSalon)

  const [profile, setProfile] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('agendamentos')

  const {
    items: appointments, hasMore: hasMoreAppointments,
    loadingMore: loadingMoreAppointments, loadMore: loadMoreAppointments,
  } = usePaginatedList(
    (page, limit) => platformApi.get('/platform/me/appointments', { params: { page, limit } }).then(r => r.data),
    []
  )

  useEffect(() => {
    Promise.all([
      platformApi.get('/platform/me'),
      platformApi.get('/salon/my'),
    ])
      .then(([profileRes, membersRes]) => {
        setProfile(profileRes.data)
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleEnterSalon(member) {
    setSalon(
      { id: member.salonId, name: member.salon.name, slug: member.salon.slug, plan: member.salon.plan, colorPalette: member.salon.colorPalette ?? null },
      member.role, member.id
    )
    try {
      const { data: perfil } = await api.get('/users/perfil/me', { headers: { 'x-salon-id': member.salonId } })
      useAuthStore.getState().updateUser({ id: perfil.UUID, publicId: perfil.UUID, role: perfil.Role })
    } catch {}
    navigate(`/${member.salon.slug}/${ROLE_PATH[member.role] ?? 'cliente'}`)
  }

  const name = profile?.name ?? user?.name ?? ''
  const roleLabel = profile?.platformRole === 'SalonOwner' ? 'Dono de salão' : 'Cliente'

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #8b4a2b', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#fdf4f5', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(253,244,245,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(139,74,43,0.10)',
        height: 52, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 32px',
      }}>
        <Link to="/marketplace" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#8b4a2b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Inter', serif", color: '#fff', fontSize: 14, lineHeight: 1 }}>D</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2a1e18', letterSpacing: '-0.01em' }}>Dauth</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/marketplace" style={{ fontSize: 13, color: '#8b7267', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = '#2a1e18'} onMouseLeave={e => e.target.style.color = '#8b7267'}>
            Marketplace
          </Link>
          {profile?.platformRole === 'SalonOwner' && (
            <Link to="/meus-saloes" style={{ fontSize: 13, color: '#8b7267', textDecoration: 'none' }}
              onMouseEnter={e => e.target.style.color = '#2a1e18'} onMouseLeave={e => e.target.style.color = '#8b7267'}>
              Meus salões
            </Link>
          )}
          <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#b09080', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#8b3a32'} onMouseLeave={e => e.currentTarget.style.color = '#b09080'}>
            <Icon name="logout" size={13} />
          </button>
        </nav>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 32px 80px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 40, alignItems: 'start' }} className="minha-conta-grid">

        {/* ── LEFT: Identity panel ─────────────────────────────────── */}
        <aside style={{ position: 'sticky', top: 72 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(139,74,43,0.12)', borderRadius: 16, padding: '32px 24px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -12, right: -8, fontFamily: "'Inter', serif", fontSize: 120, fontWeight: 300, color: 'rgba(139,74,43,0.05)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none', letterSpacing: '-0.05em' }}>{name.charAt(0)}</div>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #8b4a2b 0%, #c9a57b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: "'Inter', serif", color: '#fff', fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{initials(name)}</span>
            </div>
            <h1 style={{ fontFamily: "'Inter', serif", fontSize: 28, fontWeight: 400, color: '#2a1e18', lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 4px' }}>{name}</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontFamily: "'Inter', monospace", color: '#8b4a2b', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(139,74,43,0.07)', borderRadius: 4, padding: '2px 7px', marginBottom: 20 }}>
              {roleLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profile?.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, color: '#b09080', flexShrink: 0 }}><Icon name="users" size={13} /></div>
                  <span style={{ fontSize: 12, color: '#5a4035', fontFamily: "'Inter', monospace", wordBreak: 'break-all' }}>{profile.email}</span>
                </div>
              )}
              {profile?.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, color: '#b09080', flexShrink: 0 }}><Icon name="phone" size={13} /></div>
                  <span style={{ fontSize: 12, color: '#5a4035', fontFamily: "'Inter', monospace" }}>{profile.phone}</span>
                </div>
              )}
            </div>

            {members.length > 0 && <div style={{ height: 1, background: 'rgba(139,74,43,0.08)', margin: '20px 0 16px' }} />}
            {members.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'Inter', monospace", color: '#b09080', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Salões</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {members.map(member => (
                    <button key={member.id} onClick={() => handleEnterSalon(member)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s', width: '100%' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,74,43,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'rgba(139,74,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontFamily: "'Inter', serif", color: '#8b4a2b', fontSize: 15 }}>{member.salon?.name?.charAt(0)}</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#2a1e18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.salon?.name}</div>
                          <div style={{ fontSize: 10.5, color: '#b09080', fontFamily: "'Inter', monospace" }}>{member.role}</div>
                        </div>
                      </div>
                      <Icon name="arrowRight" size={12} style={{ color: '#c9a57b', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link to="/marketplace" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 16, fontSize: 12, color: '#b09080', textDecoration: 'none', paddingLeft: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = '#8b4a2b'} onMouseLeave={e => e.currentTarget.style.color = '#b09080'}>
            <Icon name="arrowLeft" size={12} />Voltar ao marketplace
          </Link>
        </aside>

        {/* ── RIGHT: Tabbed content ────────────────────────────────── */}
        <main>
          {/* Tabs header */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(139,74,43,0.12)', marginBottom: 32 }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? '#8b4a2b' : '#8b7267',
                  borderBottom: activeTab === tab ? '2px solid #8b4a2b' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                  fontFamily: "'Inter', sans-serif",
                }}>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab title */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Inter', serif", fontSize: 34, fontWeight: 400, color: '#2a1e18', letterSpacing: '-0.01em', margin: 0 }}>
              {TAB_LABELS[activeTab]}
            </h2>
            {activeTab === 'agendamentos' && (
              <div style={{ height: 1, background: 'rgba(139,74,43,0.12)', marginTop: 14 }} />
            )}
          </div>

          {activeTab === 'agendamentos' && (
            <TabAgendamentos
              appointments={appointments}
              members={members}
              hasMore={hasMoreAppointments}
              loadingMore={loadingMoreAppointments}
              onLoadMore={loadMoreAppointments}
            />
          )}
          {activeTab === 'perfil'        && <TabPerfil profile={profile} onSaved={data => setProfile(p => ({ ...p, ...data }))} />}
          {activeTab === 'seguranca'     && <TabSeguranca />}
        </main>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 700px) {
          .minha-conta-grid { grid-template-columns: 1fr !important; padding: 24px 20px 60px !important; gap: 28px !important; }
          .minha-conta-grid aside { position: static !important; }
        }
      `}</style>
    </div>
  )
}
