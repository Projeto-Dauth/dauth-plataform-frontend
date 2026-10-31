import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import logo from '@/logo-dauth-agendamentos.png'
import NotFound from '@/pages/NotFound'
import SistemaResumo from './SistemaResumo'
import SistemaSaloes from './SistemaSaloes'
import SistemaErros from './SistemaErros'

// Painel do sistema — só para SUPERADMIN_USER_IDS (o backend decide; para os outros é 404 e aqui vira "não encontrado").
const TABS = [
  { id: 'resumo', label: 'Visão geral' },
  { id: 'saloes', label: 'Salões' },
  { id: 'erros', label: 'Erros' },
]

export default function SistemaPage() {
  const [access, setAccess] = useState('loading') // loading | ok | denied
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'resumo'
  const [errorsSalonId, setErrorsSalonId] = useState(null)

  useEffect(() => {
    platformApi.get('/system/me').then(() => setAccess('ok')).catch(() => setAccess('denied'))
  }, [])

  if (access === 'loading') return <div className="min-h-screen bg-bg" />
  if (access === 'denied') return <NotFound />

  const goTab = (id) => setParams(id === 'resumo' ? {} : { tab: id }, { replace: true })
  const openSalonErrors = (salonId) => { setErrorsSalonId(salonId); goTab('erros') }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm border-b border-line h-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Dauth" className="w-8 h-8 rounded-md object-cover" />
          <span className="font-display font-semibold text-[13.5px] text-ink">Dauth · Sistema</span>
        </div>
        <Link to="/meus-saloes" className="text-xs text-ink-3 hover:text-ink transition-colors">Meus salões</Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <p className="eyebrow mb-2">Administração da plataforma</p>
          <h1 className="font-serif text-[32px] sm:text-[40px] font-light text-ink tracking-tight leading-tight">Sistema</h1>
        </div>

        <div role="tablist" className="flex gap-6 border-b border-line mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => goTab(t.id)}
              className={`pb-2.5 -mb-px border-b-2 text-sm whitespace-nowrap cursor-pointer transition-colors
                ${tab === t.id ? 'border-brand text-ink font-medium' : 'border-transparent text-ink-3 hover:text-ink-2'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'resumo' && <SistemaResumo onGo={goTab} />}
        {tab === 'saloes' && <SistemaSaloes onOpenErrors={openSalonErrors} />}
        {tab === 'erros' && <SistemaErros salonId={errorsSalonId} onClearSalon={() => setErrorsSalonId(null)} />}
      </main>
    </div>
  )
}
