import { useState, useEffect, useRef, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Icon from '@/components/ui/Icons'
import platformApi from '@/lib/platformApi'
import WhatsAppLinkModal from '@/components/ui/WhatsAppLinkModal'
import useWhatsappStatusStore from '@/store/whatsappStatusStore'
import usePrivacyStore from '@/store/privacyStore'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import { navItemsByRole } from '@/config/navItems'
import { PLANS, salonHasFeature, planRequiredFor } from '@/config/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'

const PALETTE_VARS = {
  terracota: {
    bg: '253 244 245', surface: '255 255 255', surface2: '250 240 241', surface3: '244 228 230',
    ink: '42 30 24',   ink2: '91 70 60',       ink3: '141 123 111',     ink4: '180 165 152',
    line: '236 213 216', line2: '243 228 230', line3: '223 196 200',
    brand: '139 74 43', soft: '241 227 214',   softInk: '122 63 35',
  },
  sage: {
    bg: '244 248 241', surface: '255 255 255', surface2: '238 245 234', surface3: '224 237 218',
    ink: '24 38 20',   ink2: '58 84 50',       ink3: '98 130 88',       ink4: '152 178 142',
    line: '208 228 200', line2: '226 240 220', line3: '192 218 182',
    brand: '74 107 62', soft: '224 237 218',   softInk: '58 84 50',
  },
  ocean: {
    bg: '241 246 252', surface: '255 255 255', surface2: '234 242 250', surface3: '218 232 246',
    ink: '18 32 52',   ink2: '48 72 106',      ink3: '88 118 154',      ink4: '144 170 198',
    line: '200 220 242', line2: '220 234 248', line3: '178 208 234',
    brand: '43 74 107', soft: '214 228 244',   softInk: '35 62 92',
  },
  midnight: {
    bg: '19 19 31',    surface: '30 30 46',    surface2: '37 37 56',    surface3: '48 48 72',
    ink: '232 228 244', ink2: '184 180 208',   ink3: '128 124 152',     ink4: '84 80 108',
    line: '48 48 72',  line2: '37 37 56',      line3: '60 60 88',
    brand: '155 143 201', soft: '48 44 72',    softInk: '200 194 230',
  },
}

const ALL_VARS = ['bg','surface','surface2','surface3','ink','ink2','ink3','ink4','line','line2','line3','brand','soft','softInk']
const VAR_MAP  = { surface2: 'surface-2', surface3: 'surface-3', ink2: 'ink-2', ink3: 'ink-3', ink4: 'ink-4', line2: 'line-2', line3: 'line-3', soft: 'brand-soft', softInk: 'brand-soft-ink' }

function applyPaletteVars(id) {
  const p = PALETTE_VARS[id] ?? PALETTE_VARS.terracota
  const root = document.documentElement
  ALL_VARS.forEach(k => root.style.setProperty(`--${VAR_MAP[k] ?? k}`, p[k]))
  root.setAttribute('data-palette', id)
}

const navItems = navItemsByRole['Admin']

const PALETTES = [
  { id: 'terracota', label: 'Terracota', color: '#8b4a2b', accent: '#c9a57b' },
  { id: 'sage',      label: 'Sage',      color: '#4a6b3e', accent: '#8bad7e' },
  { id: 'ocean',     label: 'Ocean',     color: '#2b4a6b', accent: '#7badc9' },
  { id: 'midnight',  label: 'Midnight',  color: '#9b8fc9', accent: '#3a3a5a' },
]

const PLAN_LABELS = Object.fromEntries(PLANS.map(p => [p.id, p.label]))

function maskPhone(value) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length > 10) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`
  if (d.length > 6)  return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  if (d.length > 2)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  return d
}

function daysRemaining(trialEndsAt) {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 14, width: 100, borderRadius: 6, background: 'rgb(var(--ink) / 0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 44, borderRadius: 10, background: 'rgb(var(--ink) / 0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

export default function AdminConfiguracoes() {
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const { hidden: valuesHidden, toggle: toggleValuesHidden } = usePrivacyStore()
  const { salon, setSalon, role, memberId } = useSalonStore()
  const salonId = salon?.id
  const sidebar = <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin" />
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', description: '', colorPalette: 'terracota' })
  const savedPaletteRef = useRef(salon?.colorPalette ?? 'terracota')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState(null)
  const [waCreating, setWaCreating] = useState(false)
  const [waModalOpen, setWaModalOpen] = useState(false)
  const waStatus = useWhatsappStatusStore(s => s.status)
  const fetchWaStatus = useWhatsappStatusStore(s => s.fetchStatus)

  useEffect(() => {
    if (config?.evolutionInstanceName) fetchWaStatus()
  }, [config?.evolutionInstanceName, fetchWaStatus])

  const handleCreateWhatsappInstance = async () => {
    setWaCreating(true)
    try {
      const { data } = await platformApi.post('/salon/whatsapp-instance', {}, { headers: { 'x-salon-id': salonId } })
      setConfig(c => c ? { ...c, evolutionInstanceName: data.evolutionInstanceName } : c)
      setWaModalOpen(true)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Não foi possível conectar o WhatsApp agora. Tente novamente.', 'error')
    } finally {
      setWaCreating(false)
    }
  }

  const handleActivated = useCallback(() => {
    setShowUpgrade(false)
    setConfig(c => c ? { ...c, status: 'active' } : c)
    if (salon) setSalon({ ...salon, status: 'active' }, role, memberId)
    addToast('Plano ativado com sucesso! Bem-vindo ao Pro 🎉', 'success')
  }, [salon, role, memberId])

  useEffect(() => {
    if (!salonId) return
    platformApi.get('/salon/config', { headers: { 'x-salon-id': salonId } })
      .then(r => {
        const d = r.data
        setConfig(d)
        setForm({
          name:         d.name         ?? '',
          phone:        d.phone        ?? '',
          address:      d.address      ?? '',
          description:  d.description  ?? '',
          colorPalette: d.colorPalette ?? 'terracota',
        })
      })
      .catch(() => addToast('Erro ao carregar configurações', 'error'))
      .finally(() => setLoading(false))
  }, [salonId])

  useEffect(() => {
    if (config?.colorPalette) savedPaletteRef.current = config.colorPalette
  }, [config?.colorPalette])

  useEffect(() => {
    return () => applyPaletteVars(savedPaletteRef.current)
  }, [])

  function handlePaletteChange(id) {
    setForm(f => ({ ...f, colorPalette: id }))
    applyPaletteVars(id)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await platformApi.patch('/salon/config', form, { headers: { 'x-salon-id': salonId } })
      setConfig(r.data)
      if (salon) setSalon({ ...salon, colorPalette: form.colorPalette }, role, memberId)
      addToast('Configurações salvas com sucesso!', 'success')
    } catch {
      addToast('Erro ao salvar configurações', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif',
    border: '1.5px solid rgb(var(--line))', borderRadius: 10,
    background: 'rgb(var(--surface))', color: 'rgb(var(--ink))', outline: 'none',
    transition: 'border-color .18s',
  }
  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
    textTransform: 'uppercase', color: 'rgb(var(--ink-3))', marginBottom: 6,
  }

  const days = config ? daysRemaining(config.trialEndsAt) : null
  const isTrial = config?.status === 'trial'
  const isSuspended = config?.status === 'suspended'
  const isPendingPayment = config?.status === 'pending_payment'
  const hasWhatsapp = salonHasFeature(config, 'whatsapp')

  return (
    <>
    {showUpgrade && (
      <UpgradeModal
        salonId={salonId}
        defaultPlan={config?.plan}
        feature={upgradeFeature}
        onClose={() => setShowUpgrade(false)}
        onActivated={handleActivated}
      />
    )}
    <AppLayout sidebar={sidebar}>
    <div style={{ padding: '32px 28px', maxWidth: 720, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .cfg-input:focus { border-color: rgb(var(--brand)) !important; box-shadow: 0 0 0 3px rgb(var(--brand) / 0.12) }
        .palette-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgb(var(--ink) / 0.12) }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgb(var(--brand))', marginBottom: 6 }}>
          Administração
        </p>
        <h1 style={{ fontFamily: 'Inter, Georgia, serif', fontSize: 34, fontWeight: 600, color: 'rgb(var(--ink))', margin: 0, lineHeight: 1.1 }}>
          Configurações do Salão
        </h1>
        <p style={{ fontSize: 14, color: 'rgb(var(--ink-3))', marginTop: 8 }}>
          Gerencie as informações e preferências do seu salão.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Informações básicas ── */}
        <section style={{ background: 'rgb(var(--surface))', borderRadius: 14, border: '1px solid rgb(var(--line))', padding: '24px 24px 20px', boxShadow: '0 2px 12px rgb(var(--ink) / 0.05)' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: '0 0 20px' }}>
            Informações do Salão
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Nome do Salão</label>
                  <input
                    className="cfg-input"
                    style={inputStyle}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do seu salão"
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input
                    className="cfg-input"
                    style={inputStyle}
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                    placeholder="(11) 9 0000-0000"
                    type="tel"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Endereço</label>
                  <input
                    className="cfg-input"
                    style={inputStyle}
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Descrição</label>
                  <textarea
                    className="cfg-input"
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 100, lineHeight: 1.6 }}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Conte um pouco sobre o salão — especialidades, diferenciais, ambiente..."
                    maxLength={500}
                  />
                  <p style={{ fontSize: 11, color: 'rgb(var(--ink-4))', marginTop: 4, textAlign: 'right' }}>
                    {form.description.length}/500
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Preferências ── */}
        <section style={{ background: 'rgb(var(--surface))', borderRadius: 14, border: '1px solid rgb(var(--line))', padding: '24px 24px 20px', boxShadow: '0 2px 12px rgb(var(--ink) / 0.05)' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: '0 0 18px' }}>
            Preferências
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--ink))', margin: 0 }}>
                Ocultar valores financeiros
              </p>
              <p style={{ fontSize: 12, color: 'rgb(var(--ink-3))', marginTop: 2 }}>
                Substitui comissões, receitas e outros valores por •••• na tela — útil para mostrar o sistema com alguém por perto sem expor números reais.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={valuesHidden}
              onClick={toggleValuesHidden}
              style={{
                position: 'relative', width: 40, height: 24, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                border: 'none', padding: 0, transition: 'background .18s',
                background: valuesHidden ? 'rgb(var(--brand))' : 'rgb(var(--line-2))',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 3px rgb(0 0 0 / 0.2)', transition: 'transform .18s',
                transform: valuesHidden ? 'translateX(16px)' : 'translateX(0)',
              }} />
            </button>
          </div>
        </section>

        {/* ── WhatsApp do salão ── */}
        <section style={{ background: 'rgb(var(--surface))', borderRadius: 14, border: '1px solid rgb(var(--line))', padding: '24px 24px 20px', boxShadow: '0 2px 12px rgb(var(--ink) / 0.05)' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: '0 0 6px' }}>
            WhatsApp do salão
          </h2>
          {loading ? <SkeletonRow /> : config?.evolutionInstanceName ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: waStatus === 'connected' ? '#4a6b3e' : '#8b3a32',
                  boxShadow: `0 0 0 3px ${waStatus === 'connected' ? 'rgba(74,107,62,.2)' : 'rgba(139,58,50,.2)'}`,
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: waStatus === 'connected' ? '#4a6b3e' : 'rgb(var(--ink-3))' }}>
                  {waStatus === 'connected' ? 'WhatsApp conectado' : 'WhatsApp não conectado'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'rgb(var(--ink-3))', marginBottom: 14 }}>
                {waStatus === 'connected'
                  ? 'Os avisos e lembretes automáticos são enviados por este número.'
                  : 'O número foi cadastrado, mas ainda não foi conectado. Escaneie o QR Code para ativar.'}
              </p>
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                style={{
                  padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: '1.5px solid rgb(var(--line))',
                  background: 'rgb(var(--surface-2))', color: 'rgb(var(--ink))',
                }}
              >
                {waStatus === 'connected' ? 'Ver conexão' : 'Conectar agora'}
              </button>
            </div>
          ) : !hasWhatsapp ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="lock" size={14} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(var(--ink-3))' }}>
                  Disponível a partir do plano {planRequiredFor('whatsapp')?.label}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'rgb(var(--ink-3))', marginBottom: 18 }}>
                Conecte o WhatsApp do salão para enviar avisos e lembretes de agendamento automaticamente aos clientes. Esse recurso faz parte do plano {planRequiredFor('whatsapp')?.label} ou superior.
              </p>
              <button
                type="button"
                onClick={() => { setUpgradeFeature("whatsapp"); setShowUpgrade(true) }}
                style={{
                  padding: '11px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                  border: 'none', color: '#fff', background: 'rgb(var(--brand))',
                }}
              >
                Fazer upgrade
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'rgb(var(--ink-3))', marginBottom: 18 }}>
                Conecte o WhatsApp do salão para enviar avisos e lembretes de agendamento automaticamente aos clientes. É só clicar no botão abaixo e escanear o código com o celular do salão, do mesmo jeito que você faz no WhatsApp Web.
              </p>
              <button
                type="button"
                onClick={handleCreateWhatsappInstance}
                disabled={waCreating}
                style={{
                  padding: '11px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif', cursor: waCreating ? 'not-allowed' : 'pointer',
                  border: 'none', color: '#fff',
                  background: waCreating ? 'rgb(var(--brand) / 0.4)' : 'rgb(var(--brand))',
                }}
              >
                {waCreating ? 'Conectando...' : 'Conectar WhatsApp'}
              </button>
              <p style={{ fontSize: 11, color: 'rgb(var(--ink-4))', marginTop: 10 }}>
                Depois de conectado pela primeira vez, o número fica vinculado a este salão — se precisar trocar, é só falar com o suporte.
              </p>
            </div>
          )}
        </section>

        {waModalOpen && <WhatsAppLinkModal onClose={() => setWaModalOpen(false)} />}

        {/* ── Paleta de cores ── */}
        <section style={{ background: 'rgb(var(--surface))', borderRadius: 14, border: '1px solid rgb(var(--line))', padding: '24px 24px 20px', boxShadow: '0 2px 12px rgb(var(--ink) / 0.05)' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: '0 0 6px' }}>
            Paleta de Cores
          </h2>
          <p style={{ fontSize: 13, color: 'rgb(var(--ink-3))', marginBottom: 18 }}>
            Define a cor principal do produto — sidebar, botões e destaques.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {PALETTES.map(p => {
              const selected = form.colorPalette === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  className="palette-card"
                  onClick={() => handlePaletteChange(p.id)}
                  style={{
                    position: 'relative', overflow: 'hidden', cursor: 'pointer',
                    borderRadius: 12, padding: 0, border: selected ? `2px solid ${p.color}` : '2px solid transparent',
                    background: 'none', outline: 'none', transition: 'transform .2s, box-shadow .2s',
                    boxShadow: selected ? `0 0 0 3px ${p.color}33` : 'none',
                  }}
                >
                  <div style={{ height: 60, background: `linear-gradient(135deg, ${p.color} 0%, ${p.accent} 100%)` }} />
                  <div style={{ padding: '8px 10px', background: 'rgb(var(--surface-2))' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--ink))' }}>{p.label}</span>
                  </div>
                  {selected && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6, width: 18, height: 18,
                      borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Plano ── */}
        <section style={{ background: 'rgb(var(--surface))', borderRadius: 14, border: '1px solid rgb(var(--line))', padding: '24px 24px 20px', boxShadow: '0 2px 12px rgb(var(--ink) / 0.05)' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: '0 0 18px' }}>
            Informações do Plano
          </h2>
          {loading ? (
            <div style={{ height: 60, borderRadius: 10, background: 'rgb(var(--ink) / 0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase',
                  background: config?.status === 'active' ? 'linear-gradient(135deg, #c9a57b, #8b4a2b)' : 'rgb(var(--ink) / 0.07)',
                  color: config?.status === 'active' ? '#fff' : 'rgb(var(--ink))',
                }}>
                  {config?.plan === 'business' && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                      <path d="M5.5 0l1.3 3.9h4.1l-3.3 2.4 1.3 3.9L5.5 8 2.1 10.2l1.3-3.9L.1 3.9h4.1z" />
                    </svg>
                  )}
                  {config?.plan ? (PLAN_LABELS[config.plan] ?? config.plan) : 'Trial'}
                </div>

                {isTrial && days !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: days > 2 ? '#4a6b3e' : '#8b3a32',
                      boxShadow: days > 2 ? '0 0 0 3px rgba(74,107,62,.2)' : '0 0 0 3px rgba(139,58,50,.2)',
                    }} />
                    <span style={{ fontSize: 13, color: days > 2 ? '#4a6b3e' : '#8b3a32', fontWeight: 600 }}>
                      {days > 0 ? `${days} dia${days !== 1 ? 's' : ''} de trial restante${days !== 1 ? 's' : ''}` : 'Trial encerrado hoje'}
                    </span>
                  </div>
                )}
                {isSuspended && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b3a32', boxShadow: '0 0 0 3px rgba(139,58,50,.2)' }} />
                    <span style={{ fontSize: 13, color: '#8b3a32', fontWeight: 600 }}>Acesso suspenso</span>
                  </div>
                )}
                {isPendingPayment && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b3a32', boxShadow: '0 0 0 3px rgba(139,58,50,.2)' }} />
                    <span style={{ fontSize: 13, color: '#8b3a32', fontWeight: 600 }}>Aguardando pagamento</span>
                  </div>
                )}
                {config?.status === 'active' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a6b3e', boxShadow: '0 0 0 3px rgba(74,107,62,.2)' }} />
                    <span style={{ fontSize: 13, color: '#4a6b3e', fontWeight: 600 }}>Ativo</span>
                  </div>
                )}
              </div>

              {config?.status !== 'active' && (
                <button
                  type="button"
                  onClick={() => { setUpgradeFeature(null); setShowUpgrade(true) }}
                  style={{
                    padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    border: 'none', background: 'rgb(var(--brand))',
                    color: '#fff', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background .18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgb(var(--brand) / 0.85)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgb(var(--brand))'}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M6.5 1l1.5 4h4l-3 2.5 1.2 4L6.5 9l-3.7 2.5L4 7.5 1 5h4z" />
                  </svg>
                  Fazer upgrade
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── Salvar ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving || loading}
            style={{
              padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: saving || loading ? 'not-allowed' : 'pointer',
              border: 'none', background: saving || loading ? 'rgb(var(--brand) / 0.4)' : 'rgb(var(--brand))',
              color: '#fff', transition: 'background .18s, transform .12s', letterSpacing: '.02em',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (!saving && !loading) e.currentTarget.style.background = 'rgb(var(--brand) / 0.85)' }}
            onMouseLeave={e => { if (!saving && !loading) e.currentTarget.style.background = 'rgb(var(--brand))' }}
          >
            {saving ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                Salvando…
              </>
            ) : 'Salvar configurações'}
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
    </AppLayout>
    </>
  )
}
