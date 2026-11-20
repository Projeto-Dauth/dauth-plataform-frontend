import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import Icon from '@/components/ui/Icons'
import logo from '@/logo-dauth-agendamentos.png'
import NotFound from '@/pages/NotFound'
import SistemaResumo from './SistemaResumo'
import SistemaSaloes from './SistemaSaloes'
import SistemaErros from './SistemaErros'
import SistemaUsuarios from './SistemaUsuarios'
import SistemaAuditoria from './SistemaAuditoria'
import SistemaMfa from './SistemaMfa'
import { SystemProvider } from './systemContext'

// Painel do sistema — só para SUPERADMIN_USER_IDS (o backend decide; para os outros é 404 e aqui vira "não encontrado").
// Quem está na lista ainda passa pelo 2º fator (app autenticador): `setup` = primeiro acesso, `locked` = pedir o código.
const NAV = [
  {
    group: 'Gestão',
    items: [
      { id: 'resumo', label: 'Visão geral', icon: 'grid', description: 'Receita, situação dos salões e o que precisa de atenção.' },
      { id: 'saloes', label: 'Salões', icon: 'store', description: 'Planos, vencimentos e ações sobre cada salão.' },
      { id: 'usuarios', label: 'Usuários', icon: 'users', description: 'Donos, profissionais e clientes: sessões, bloqueio e anonimização.' },
    ],
  },
  {
    group: 'Monitoramento',
    items: [
      { id: 'erros', label: 'Erros', icon: 'alertTriangle', description: 'Falhas do backend e do frontend, guardadas por 14 dias.' },
      { id: 'auditoria', label: 'Auditoria', icon: 'shield', description: 'Registro de tudo que foi alterado por este painel. Não pode ser editado.' },
    ],
  },
]
const TABS = NAV.flatMap(g => g.items)

const navItemCls = (active) => `group relative w-full flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-lg text-[13.5px] text-left cursor-pointer transition-colors
  ${active ? 'bg-brand-ink/[0.13] text-brand-ink font-medium' : 'text-brand-ink/70 hover:bg-brand-ink/[0.08] hover:text-brand-ink'}`

export default function SistemaPage() {
  const [access, setAccess] = useState('loading') // loading | denied | setup | locked | ok
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'resumo'
  const [errorsSalonId, setErrorsSalonId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false) // gaveta do menu no celular

  useEffect(() => {
    platformApi.get('/system/me')
      .then(() => platformApi.get('/system/mfa/status'))
      .then(r => setAccess(r.data.unlocked ? 'ok' : r.data.enrolled ? 'locked' : 'setup'))
      .catch(() => setAccess('denied'))
  }, [])

  // O desbloqueio vence por inatividade (15 min): qualquer chamada recusada volta para a tela do código
  useEffect(() => {
    const id = platformApi.interceptors.response.use(r => r, (error) => {
      const code = error.response?.data?.code
      if (code === 'MFA_REQUIRED') setAccess('locked')
      if (code === 'MFA_SETUP_REQUIRED') setAccess('setup')
      return Promise.reject(error)
    })
    return () => platformApi.interceptors.response.eject(id)
  }, [])

  if (access === 'loading') return <div className="min-h-screen bg-bg" />
  if (access === 'denied') return <NotFound />
  if (access === 'setup' || access === 'locked') return <SistemaMfa mode={access} onUnlocked={() => setAccess('ok')} />

  const current = TABS.find(t => t.id === tab)
  const goTab = (id) => { setParams(id === 'resumo' ? {} : { tab: id }, { replace: true }); setMenuOpen(false) }
  const openSalonErrors = (salonId) => { setErrorsSalonId(salonId); goTab('erros') }
  const lock = () => platformApi.post('/system/mfa/lock').finally(() => setAccess('locked'))

  return (
    <SystemProvider>
      <div className="min-h-screen bg-bg">
        {menuOpen && <div className="fixed inset-0 z-30 bg-ink/50 md:hidden animate-fade-in" onClick={() => setMenuOpen(false)} />}

        {/* Menu lateral: fixo no computador, gaveta no celular */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-[264px] flex flex-col bg-brand-dark text-brand-ink transition-transform duration-200 md:translate-x-0
          ${menuOpen ? 'translate-x-0' : '-translate-x-full invisible md:visible'}`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-brand-ink/[0.07] to-transparent" />

          <div className="relative h-16 px-5 flex items-center gap-3 border-b border-brand-ink/10 shrink-0">
            <img src={logo} alt="Dauth" className="w-9 h-9 rounded-lg object-cover ring-1 ring-brand-ink/20" />
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-[15px] leading-none">Dauth</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-ink/55 mt-1.5">Sistema</p>
            </div>
            <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="md:hidden p-1.5 rounded-md text-brand-ink/70 hover:bg-brand-ink/10 cursor-pointer">
              <Icon name="x" size={16} />
            </button>
          </div>

          <nav className="relative flex-1 overflow-y-auto px-3 py-5 space-y-6" aria-label="Seções do painel">
            {NAV.map(g => (
              <div key={g.group}>
                <p className="px-3.5 mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-brand-ink/45">{g.group}</p>
                <div role="tablist" aria-orientation="vertical" className="space-y-0.5">
                  {g.items.map(t => {
                    const active = tab === t.id
                    return (
                      <button key={t.id} role="tab" aria-selected={active} onClick={() => goTab(t.id)} className={navItemCls(active)}>
                        {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-gold" />}
                        <Icon name={t.icon} size={17} className={active ? 'text-gold' : 'text-brand-ink/60 group-hover:text-brand-ink/90'} />
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="relative p-3 border-t border-brand-ink/10 space-y-1 shrink-0">
            <div className="flex items-center gap-3 rounded-lg bg-brand-ink/[0.08] px-3 py-2.5 mb-2">
              <span className="w-8 h-8 rounded-md bg-brand-ink/10 grid place-items-center text-gold shrink-0"><Icon name="shield" size={16} /></span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium leading-tight">Acesso protegido</p>
                <p className="text-[11px] text-brand-ink/60 mt-0.5">Painel destravado com MFA</p>
              </div>
            </div>
            <button onClick={lock} className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] text-brand-ink/75 hover:bg-brand-ink/10 hover:text-brand-ink cursor-pointer transition-colors">
              <Icon name="lock" size={15} />Travar painel
            </button>
            <Link to="/meus-saloes" className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] text-brand-ink/75 hover:bg-brand-ink/10 hover:text-brand-ink transition-colors">
              <Icon name="arrowLeft" size={15} />Meus salões
            </Link>
          </div>
        </aside>

        <div className="md:pl-[264px]">
          <header className="sticky top-0 z-20 h-16 bg-bg/85 backdrop-blur-md border-b border-line px-4 sm:px-8 flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} aria-label="Abrir menu" className="md:hidden p-2 -ml-2 rounded-lg text-ink-2 hover:bg-surface-2 cursor-pointer">
              <Icon name="menu" size={20} />
            </button>
            <nav aria-label="Você está em" className="flex items-center gap-2 text-[13px] min-w-0">
              <span className="text-ink-3">Sistema</span>
              <Icon name="chevronRight" size={12} className="text-ink-4" />
              <span className="text-ink font-medium truncate">{current.label}</span>
            </nav>
            <span className="ml-auto hidden sm:inline-flex items-center gap-2 text-[12px] text-ink-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-50 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Sessão protegida
            </span>
          </header>

          <main className="max-w-[1180px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
            <div className="mb-6">
              <h1 className="font-display text-[26px] sm:text-[30px] font-semibold tracking-tight text-ink leading-tight">{current.label}</h1>
              <p className="text-[13.5px] text-ink-3 mt-1.5 max-w-2xl">{current.description}</p>
            </div>

            <div key={tab} className="animate-rise">
              {tab === 'resumo' && <SistemaResumo onGo={goTab} />}
              {tab === 'saloes' && <SistemaSaloes onOpenErrors={openSalonErrors} />}
              {tab === 'usuarios' && <SistemaUsuarios />}
              {tab === 'erros' && <SistemaErros salonId={errorsSalonId} onClearSalon={() => setErrorsSalonId(null)} />}
              {tab === 'auditoria' && <SistemaAuditoria />}
            </div>
          </main>
        </div>
      </div>
    </SystemProvider>
  )
}
