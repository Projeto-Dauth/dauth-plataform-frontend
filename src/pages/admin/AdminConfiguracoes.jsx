import { useState, useEffect, useRef, useCallback, isValidElement, cloneElement } from 'react'
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
import { refreshStoreSalon } from '@/lib/salonAccess'
import { reloadStoreSalon } from '@/lib/subscription'
import SubscriptionPanel from '@/components/billing/SubscriptionPanel'
import Section, { sectionStyle } from '@/components/ui/SettingsSection'
import { navItemsByRole } from '@/config/navItems'
import { salonHasFeature, planRequiredFor } from '@/config/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { formatPhoneOrLandline } from '@/lib/phone'
import { PAYMENT_METHODS } from '@/config/paymentMethods'

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

// Fusos: os do Brasil no topo com nome amigável; depois todos os fusos IANA que o navegador conhece,
// agrupados por região. O backend aceita qualquer fuso válido (isValidTimezone em salonSettings.js).
const BRAZIL_TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'Brasília (maior parte do Brasil)' },
  { id: 'America/Noronha', label: 'Fernando de Noronha' },
  { id: 'America/Manaus', label: 'Amazonas, Rondônia e Roraima' },
  { id: 'America/Cuiaba', label: 'Mato Grosso e Mato Grosso do Sul' },
  { id: 'America/Rio_Branco', label: 'Acre' },
]
const REGION_LABEL = {
  Africa: 'África', America: 'América', Antarctica: 'Antártida', Arctic: 'Ártico', Asia: 'Ásia',
  Atlantic: 'Atlântico', Australia: 'Austrália', Europe: 'Europa', Indian: 'Oceano Índico', Pacific: 'Pacífico',
}

function utcOffset(tz) {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ''
    return name.replace('GMT', 'UTC')
  } catch {
    return ''
  }
}

const TIMEZONE_GROUPS = (() => {
  const brazil = new Set(BRAZIL_TIMEZONES.map(t => t.id))
  const groups = {}
  for (const tz of Intl.supportedValuesOf?.('timeZone') ?? []) {
    if (brazil.has(tz)) continue
    const [region, ...rest] = tz.split('/')
    const key = rest.length ? region : 'Outros'
    const city = (rest.length ? rest.join(' / ') : tz).replace(/_/g, ' ')
    ;(groups[key] ??= []).push({ id: tz, label: `${city} (${utcOffset(tz)})` })
  }
  return Object.entries(groups).sort(([a], [b]) => (REGION_LABEL[a] ?? a).localeCompare(REGION_LABEL[b] ?? b))
})()
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60]
const MIN_ADVANCE_OPTIONS = [
  [0, 'Sem mínimo'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'],
  [360, '6 horas'], [720, '12 horas'], [1440, '1 dia'], [2880, '2 dias'],
]
const MAX_DAYS_OPTIONS = [[null, 'Sem limite'], [7, '7 dias à frente'], [15, '15 dias à frente'], [30, '30 dias à frente'], [60, '60 dias à frente'], [90, '90 dias à frente']]
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TABS = [
  { id: 'geral', label: 'Geral' },
  { id: 'agendamento', label: 'Agendamento' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'publica', label: 'Página pública', soon: true },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'plano', label: 'Plano' },
]
const TABS_WITHOUT_SAVE = ['publica', 'whatsapp', 'plano']

// businessHours (API: [{ weekday, open, close }] | null) <-> 7 linhas editáveis
const toHourRows = (hours) => WEEKDAYS.map((_, weekday) => {
  const h = (hours ?? []).find(x => x.weekday === weekday)
  return { weekday, isOpen: Boolean(h), open: h?.open ?? '09:00', close: h?.close ?? '18:00' }
})
const fromHourRows = (rows) => {
  const open = rows.filter(r => r.isOpen).map(({ weekday, open, close }) => ({ weekday, open, close }))
  return open.length ? open : null
}

function editableFromConfig(d) {
  return {
    form: {
      name: d.name ?? '', phone: d.phone ?? '', address: d.address ?? '',
      description: d.description ?? '', colorPalette: d.colorPalette ?? 'terracota',
    },
    settings: {
      timezone: d.timezone, instagram: d.instagram ?? '', showPrices: d.showPrices, showTeam: d.showTeam,
      bookingEnabled: d.bookingEnabled, bookingSlotMinutes: d.bookingSlotMinutes, bookingMinAdvanceMinutes: d.bookingMinAdvanceMinutes,
      bookingMaxDaysAhead: d.bookingMaxDaysAhead, bookingAutoConfirm: d.bookingAutoConfirm, paymentMethods: d.paymentMethods,
      professionalsSellPackages: d.professionalsSellPackages,
    },
    hourRows: toHourRows(d.businessHours),
  }
}

function Switch({ checked, onChange, 'aria-label': ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 40, height: 24, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
        border: 'none', padding: 0, transition: 'background .18s',
        background: checked ? 'rgb(var(--brand))' : 'rgb(var(--line-2))',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgb(0 0 0 / 0.2)', transition: 'transform .18s',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
      }} />
    </button>
  )
}

// Linha "título + explicação ........ controle"
function SettingRow({ title, hint, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--ink))', margin: 0 }}>{title}</p>
        {hint && <p style={{ fontSize: 12, color: 'rgb(var(--ink-3))', marginTop: 2 }}>{hint}</p>}
      </div>
      {/* O título da linha vira o nome acessível do controle (leitor de tela e testes E2E) */}
      {isValidElement(children) ? cloneElement(children, { 'aria-label': title }) : children}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 14, width: 100, borderRadius: 6, background: 'rgb(var(--ink) / 0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 44, borderRadius: 10, background: 'rgb(var(--ink) / 0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

// Código que o cliente digita em "Meus salões" para se vincular ao salão. Só o Admin vê.
// Gerar um novo invalida o antigo, mas ninguém que já entrou é desvinculado.
function JoinCodeSection({ config, salonId, onChange }) {
  const { addToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const trialOver = config.status === 'trial' && config.trialEndsAt && new Date(config.trialEndsAt) <= new Date()
  const active = config.status === 'active' || (config.status === 'trial' && !trialOver)

  async function copy() {
    try {
      await navigator.clipboard.writeText(config.joinCode)
      addToast('Código copiado!', 'success')
    } catch {
      addToast('Não foi possível copiar. Selecione o código e copie manualmente.', 'error')
    }
  }

  async function regenerate() {
    setBusy(true)
    try {
      const { data } = await platformApi.post('/salon/join-code/regenerate', {}, { headers: { 'x-salon-id': salonId } })
      onChange(data.joinCode)
      setConfirming(false)
      addToast('Novo código gerado. O anterior deixou de valer.', 'success')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao gerar novo código', 'error')
    } finally {
      setBusy(false)
    }
  }

  const btn = { padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', borderRadius: 8, cursor: 'pointer', border: '1px solid rgb(var(--line))', background: 'rgb(var(--surface))', color: 'rgb(var(--ink-2))' }

  return (
    <Section title="Código de acesso" description="Passe este código para seus clientes e sua equipe. Quem digitar em Meus salões entra direto no seu salão.">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span aria-label="Código de acesso do salão" style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, letterSpacing: '.18em', color: active ? 'rgb(var(--ink))' : 'rgb(var(--ink-4))' }}>
            {config.joinCode ?? '—'}
          </span>
          <button type="button" style={btn} onClick={copy} disabled={!config.joinCode}>Copiar</button>
          {!confirming && <button type="button" style={btn} onClick={() => setConfirming(true)}>Gerar novo código</button>}
        </div>
        {!active && (
          <p style={{ fontSize: 12, color: 'rgb(var(--danger))', marginTop: 8 }}>
            O código só funciona com o salão ativo ou em período de teste. Enquanto o plano não estiver em dia, ninguém consegue entrar com ele.
          </p>
        )}
        {confirming && (
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgb(var(--surface-2))', border: '1px solid rgb(var(--line))' }}>
            <p style={{ fontSize: 13, color: 'rgb(var(--ink-2))', margin: '0 0 10px', lineHeight: 1.55 }}>
              O código atual deixa de funcionar. Quem já está no salão continua vinculado, só não consegue mais usar o código antigo para entrar.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn} onClick={() => setConfirming(false)} disabled={busy}>Cancelar</button>
              <button type="button" style={{ ...btn, background: 'rgb(var(--brand))', borderColor: 'rgb(var(--brand))', color: '#fff' }} onClick={regenerate} disabled={busy}>
                {busy ? 'Gerando…' : 'Gerar novo código'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
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
  const [settings, setSettings] = useState(null) // configs de agendamento, pagamento e página pública
  const [hourRows, setHourRows] = useState(() => toHourRows(null))
  // ?tab=plano abre direto na aba (link dos avisos de renovação)
  const [tab, setTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab')
    return TABS.some(t => t.id === wanted) ? wanted : 'geral'
  })
  const setSetting = (key, value) => setSettings(s => ({ ...s, [key]: value }))
  // Alterações não salvas = estado da tela diferente do último estado salvo
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const isDirty = savedSnapshot !== null && JSON.stringify({ form, settings, hourRows }) !== savedSnapshot

  function applyConfig(d) {
    const e = editableFromConfig(d)
    setConfig(d)
    setForm(e.form)
    setSettings(e.settings)
    setHourRows(e.hourRows)
    setSavedSnapshot(JSON.stringify(e))
  }
  const savedPaletteRef = useRef(salon?.colorPalette ?? 'terracota')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState(null)
  const [renewing, setRenewing] = useState(false) // renovação: plano fixo no atual, só escolhe a duração
  const [billingVersion, setBillingVersion] = useState(0) // muda depois de um pagamento: o painel do plano busca de novo
  const [waCreating, setWaCreating] = useState(false)
  const [waModalOpen, setWaModalOpen] = useState(false)
  const waStatus = useWhatsappStatusStore(s => s.status)
  const fetchWaStatus = useWhatsappStatusStore(s => s.fetchStatus)

  useEffect(() => {
    if (config?.evolutionInstanceName) fetchWaStatus(true)
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

  // Pagamento confirmado: o painel do plano busca de novo e devolve o estado fresco por handleBilling
  const handleActivated = useCallback(() => {
    setShowUpgrade(false)
    setBillingVersion(v => v + 1)
    reloadStoreSalon().catch(() => {})
    addToast('Pagamento confirmado! Sua assinatura está em dia.', 'success')
  }, [])

  // Mantém plano/status/vencimento da página (recursos liberados, código de acesso…) iguais aos da assinatura
  const handleBilling = useCallback((b) => {
    setConfig(c => c ? { ...c, status: b.status, plan: b.plan, planEndsAt: b.planEndsAt, cancelAtPeriodEnd: b.cancelAtPeriodEnd } : c)
  }, [])

  const openPayment = ({ renew }) => {
    setUpgradeFeature(null)
    setRenewing(renew)
    setShowUpgrade(true)
  }

  useEffect(() => {
    if (!salonId) return
    platformApi.get('/salon/config', { headers: { 'x-salon-id': salonId } })
      .then(r => applyConfig(r.data))
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
      const payload = { ...form, ...settings, businessHours: fromHourRows(hourRows) }
      const r = await platformApi.patch('/salon/config', payload, { headers: { 'x-salon-id': salonId } })
      applyConfig(r.data) // valores normalizados pelo servidor (ex: @ do Instagram) viram o novo "salvo"
      if (salon) setSalon({ ...refreshStoreSalon(salon, r.data), colorPalette: form.colorPalette }, role, memberId)
      addToast('Configurações salvas com sucesso!', 'success')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao salvar configurações', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    applyConfig(config)
    applyPaletteVars(config.colorPalette ?? 'terracota')
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

  const hasWhatsapp = salonHasFeature(config, 'whatsapp')

  return (
    <>
    {showUpgrade && (
      <UpgradeModal
        salonId={salonId}
        defaultPlan={config?.plan}
        feature={upgradeFeature}
        lockPlan={renewing}
        onClose={() => setShowUpgrade(false)}
        onActivated={handleActivated}
      />
    )}
    <AppLayout sidebar={sidebar}>
    <div style={{ padding: '32px 28px', maxWidth: 1040, fontFamily: 'Inter, sans-serif' }}>
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

      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgb(var(--line))', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              background: 'none', border: 'none', cursor: 'pointer',
              // sublinhado via sombra interna: não ocupa espaço (com margem negativa o overflowX criava barra de rolagem)
              boxShadow: tab === t.id ? 'inset 0 -2px 0 rgb(var(--brand))' : 'none',
              color: tab === t.id ? 'rgb(var(--ink))' : 'rgb(var(--ink-3))',
            }}
          >
            {t.label}
            {t.soon && (
              <span style={{ marginLeft: 6, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', background: 'rgb(var(--brand-soft))', color: 'rgb(var(--brand-soft-ink))' }}>
                Em breve
              </span>
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Código de acesso ── */}
        {tab === 'geral' && !loading && config && (
          <JoinCodeSection config={config} salonId={salonId} onChange={joinCode => setConfig(c => ({ ...c, joinCode }))} />
        )}

        {/* ── Informações básicas ── */}
        {tab === 'geral' && <section style={sectionStyle}>
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
                    onChange={e => setForm(f => ({ ...f, phone: formatPhoneOrLandline(e.target.value) }))}
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
                <div>
                  <label style={labelStyle}>Fuso horário</label>
                  <select
                    className="cfg-input"
                    style={inputStyle}
                    value={settings?.timezone ?? 'America/Sao_Paulo'}
                    onChange={e => setSetting('timezone', e.target.value)}
                  >
                    <optgroup label="Brasil">
                      {BRAZIL_TIMEZONES.map(t => <option key={t.id} value={t.id}>{t.label} ({utcOffset(t.id)})</option>)}
                    </optgroup>
                    {TIMEZONE_GROUPS.map(([region, zones]) => (
                      <optgroup key={region} label={REGION_LABEL[region] ?? region}>
                        {zones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </section>}

        {/* ── Agendamento online ── */}
        {tab === 'agendamento' && (loading || !settings ? <section style={sectionStyle}><SkeletonRow /></section> : (
          <Section title="Agendamento online" description="Como os clientes agendam sozinhos pelo link de agendamento do salão. Admin e profissionais continuam agendando livremente pela agenda.">
            <SettingRow title="Permitir agendamento online">
              <Switch checked={settings.bookingEnabled} onChange={v => setSetting('bookingEnabled', v)} />
            </SettingRow>
            {settings.bookingEnabled && (
                <SettingRow title="Mostrar preços">
                  <Switch checked={settings.showPrices} onChange={v => setSetting('showPrices', v)} />
                </SettingRow>
            )}
            {settings.bookingEnabled && (
                <SettingRow title="Confirmar automaticamente" hint="Desligado, o agendamento entra como pendente até alguém do salão confirmar.">
                  <Switch checked={settings.bookingAutoConfirm} onChange={v => setSetting('bookingAutoConfirm', v)} />
                </SettingRow>
            )}
            {settings.bookingEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Intervalo entre horários</label>
                    <select className="cfg-input" style={inputStyle} value={settings.bookingSlotMinutes} onChange={e => setSetting('bookingSlotMinutes', Number(e.target.value))}>
                      {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} minutos</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Antecedência mínima</label>
                    <select className="cfg-input" style={inputStyle} value={settings.bookingMinAdvanceMinutes} onChange={e => setSetting('bookingMinAdvanceMinutes', Number(e.target.value))}>
                      {MIN_ADVANCE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Agendar até</label>
                    <select className="cfg-input" style={inputStyle} value={settings.bookingMaxDaysAhead ?? ''} onChange={e => setSetting('bookingMaxDaysAhead', e.target.value === '' ? null : Number(e.target.value))}>
                      {MAX_DAYS_OPTIONS.map(([v, l]) => <option key={l} value={v ?? ''}>{l}</option>)}
                    </select>
                  </div>
                </div>
            )}
          </Section>
        ))}

        {/* ── Formas de pagamento ── */}
        {tab === 'pagamentos' && (loading || !settings ? <section style={sectionStyle}><SkeletonRow /></section> : (
          <>
          <Section title="Formas de pagamento" description="Só as formas ligadas aparecem na hora de fechar comandas, pedidos e mensalidades.">
            {PAYMENT_METHODS.map(m => {
              const checked = settings.paymentMethods.includes(m.id)
              const isLast = checked && settings.paymentMethods.length === 1
              return (
                <SettingRow key={m.id} title={m.label} hint={m.id === 'fiado' ? 'O cliente leva e paga depois — o valor fica em aberto na tela de Mensalistas.' : null}>
                  <Switch
                    checked={checked}
                    onChange={v => {
                      if (isLast) return addToast('Mantenha pelo menos uma forma de pagamento.', 'error')
                      setSetting('paymentMethods', v ? [...settings.paymentMethods, m.id] : settings.paymentMethods.filter(x => x !== m.id))
                    }}
                  />
                </SettingRow>
              )
            })}
          </Section>
          <Section title="Venda de pacotes" description="Quem pode vender pacotes aos clientes.">
            <SettingRow title="Profissionais vendem pacotes" hint="Criar e editar pacotes continua só com o Admin.">
              <Switch checked={!!settings.professionalsSellPackages} onChange={v => setSetting('professionalsSellPackages', v)} />
            </SettingRow>
          </Section>
          <section style={sectionStyle}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: '0 0 18px' }}>
            Preferências
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--ink))', margin: 0 }}>
                Ocultar valores financeiros
              </p>
              <p style={{ fontSize: 12, color: 'rgb(var(--ink-3))', marginTop: 2 }}>
                Troca comissões, receitas e outros valores por •••• na tela, para mostrar o sistema sem expor números.
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
          </>
        ))}

        {/* ── Página pública (desativada na versão beta) ── */}
        {tab === 'publica' && (
          <Section title="Página pública" description="Uma página com a cara do seu salão para os clientes conhecerem.">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: 'rgb(var(--brand))', marginTop: 1 }}><Icon name="lock" size={18} /></span>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--ink))', margin: 0 }}>Em breve</p>
                <p style={{ fontSize: 12.5, color: 'rgb(var(--ink-3))', marginTop: 4, lineHeight: 1.6 }}>
                  Estamos preparando a página pública do salão, com Instagram, equipe e horário de funcionamento. Por enquanto, seus clientes agendam pelo link de agendamento online e entram no salão pelo código de acesso.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* ── WhatsApp do salão ── */}
        {tab === 'whatsapp' && <section style={sectionStyle}>
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
                onClick={() => { setUpgradeFeature("whatsapp"); setRenewing(false); setShowUpgrade(true) }}
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
        </section>}

        {waModalOpen && <WhatsAppLinkModal onClose={() => setWaModalOpen(false)} />}

        {/* ── Paleta de cores ── */}
        {tab === 'geral' && <section style={sectionStyle}>
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
        </section>}

        {/* ── Plano ── */}
        {tab === 'plano' && <SubscriptionPanel salonId={salonId} config={config} refreshKey={billingVersion} onPay={openPayment} onBilling={handleBilling} />}

        {/* ── Salvar ── */}
        {/* Barra fixa no rodapé: deixa claro que as alterações só valem depois de salvar */}
        {!TABS_WITHOUT_SAVE.includes(tab) && <div style={{
          position: 'sticky', bottom: 12, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          padding: '12px 14px 12px 18px', borderRadius: 14,
          background: 'rgb(var(--surface))',
          border: `1px solid ${isDirty ? 'rgb(var(--brand) / 0.45)' : 'rgb(var(--line))'}`,
          boxShadow: '0 8px 28px rgb(var(--ink) / 0.12)', transition: 'border-color .18s',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: isDirty ? 'rgb(var(--ink))' : 'rgb(var(--ink-3))' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isDirty ? 'rgb(var(--brand))' : '#4a6b3e' }} />
            {isDirty ? 'Você tem alterações não salvas' : 'Todas as alterações estão salvas'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDirty && !saving && (
            <button
              type="button"
              onClick={handleDiscard}
              style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                cursor: 'pointer', border: '1.5px solid rgb(var(--line))', background: 'rgb(var(--surface))', color: 'rgb(var(--ink-2))',
              }}
            >
              Descartar
            </button>
          )}
          <button
            type="submit"
            disabled={saving || loading || !isDirty}
            style={{
              padding: '11px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: saving || loading || !isDirty ? 'not-allowed' : 'pointer',
              border: 'none', background: saving || loading || !isDirty ? 'rgb(var(--brand) / 0.4)' : 'rgb(var(--brand))',
              color: '#fff', transition: 'background .18s, transform .12s', letterSpacing: '.02em',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (!saving && !loading && isDirty) e.currentTarget.style.background = 'rgb(var(--brand) / 0.85)' }}
            onMouseLeave={e => { if (!saving && !loading && isDirty) e.currentTarget.style.background = 'rgb(var(--brand))' }}
          >
            {saving ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                Salvando…
              </>
            ) : 'Salvar alterações'}
          </button>
          </span>
        </div>}
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
    </AppLayout>
    </>
  )
}
