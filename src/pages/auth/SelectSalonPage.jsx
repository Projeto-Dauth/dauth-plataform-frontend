import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import useSalonStore from '@/store/salonStore'
import useAuthStore from '@/store/authStore'
import Icon from '@/components/ui/Icons'
import Avatar from '@/components/ui/Avatar'

const ROLE_REDIRECT = { Admin: '/admin', Profissional: '/profissional', Usuario: '/cliente' }

const PLAN_CHIP = {
  free:  'bg-surface-3 text-ink-3',
  basic: 'bg-gold-soft text-warning',
  pro:   'bg-brand-soft text-brand',
}

const ROLE_CHIP = {
  Admin:        'bg-brand-soft text-brand',
  Profissional: 'bg-success-soft text-success',
  Usuario:      'bg-surface-3 text-ink-3',
}

export default function SelectSalonPage() {
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const setSalon = useSalonStore((s) => s.setSalon)
  const { logout } = useAuthStore()
  const user = useAuthStore((s) => s.user)
  const isDemo = user?.id === 'demo'

  useEffect(() => {
    if (isDemo) {
      setSalons([
        { id: 'dm1', salonId: 'demo-1', role: 'Admin',        salon: { name: 'Salão Bela Arte', slug: 'bela-arte',  plan: 'pro'   } },
        { id: 'dm2', salonId: 'demo-2', role: 'Profissional', salon: { name: 'Studio Hair',     slug: 'studio-hair', plan: 'basic' } },
        { id: 'dm3', salonId: 'demo-3', role: 'Usuario',      salon: { name: 'Espaço Zen',      slug: 'espaco-zen',  plan: 'free'  } },
      ])
      setLoading(false)
      return
    }
    platformApi.get('/salon/my', { headers: { 'x-skip-salon': '1' } })
      .then(({ data }) => { setSalons(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function select(member) {
    setSalon(
      { id: member.salonId, name: member.salon.name, slug: member.salon.slug, plan: member.salon.plan },
      member.role,
      member.id
    )
    navigate(ROLE_REDIRECT[member.role] ?? '/admin', { replace: true })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg">

      {/* Top navbar */}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm border-b border-line px-6 py-0 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">
            <span className="font-serif text-white text-sm">D</span>
          </div>
          <span className="font-display font-semibold text-[13.5px] text-ink">Dauth Platform</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2.5">
              <Avatar name={user.name} index={0} size="sm" />
              <span className="text-sm text-ink-2 hidden sm:block">{user.name}</span>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-danger transition-colors px-2 py-1.5 rounded-md hover:bg-danger-soft">
            <Icon name="logout" size={14} />
            <span className="hidden sm:block">Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-10">
          <p className="font-mono text-xs text-ink-4 uppercase tracking-widest mb-2">Plataforma</p>
          <h1 className="font-display font-semibold text-3xl text-ink tracking-tight">
            Olá, {user?.name?.split(' ')[0] ?? 'bem-vindo'}
          </h1>
          <p className="text-ink-3 mt-1.5 text-md">Selecione um salão para acessar ou crie um novo.</p>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-medium text-lg text-ink">Seus salões</h2>
          <button
            onClick={() => navigate('/criar-salao')}
            className="flex items-center gap-1.5 bg-brand text-white text-sm font-display font-medium px-3.5 py-2 rounded-lg hover:bg-brand/90 transition-colors"
          >
            <Icon name="plus" size={14} />
            Novo salão
          </button>
        </div>

        {/* Grid de salões */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-xl border border-line bg-surface animate-pulse" />
            ))}
          </div>
        ) : salons.length === 0 ? (
          <div className="border-2 border-dashed border-line rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">✂️</div>
            <h3 className="font-display font-medium text-lg text-ink mb-1">Nenhum salão ainda</h3>
            <p className="text-sm text-ink-3 mb-6">Crie seu primeiro salão e comece a gerenciar agendamentos.</p>
            <button
              onClick={() => navigate('/criar-salao')}
              className="inline-flex items-center gap-2 bg-brand text-white text-sm font-display font-medium px-4 py-2.5 rounded-lg hover:bg-brand/90 transition-colors"
            >
              <Icon name="plus" size={14} />
              Criar primeiro salão
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {salons.map((member, idx) => (
              <button
                key={member.id}
                onClick={() => select(member)}
                className="group relative flex flex-col p-5 bg-surface border border-line rounded-xl hover:border-brand/40 hover:shadow-md transition-all text-left"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-base text-brand">
                      {member.salon.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <Icon name="chevronRight" size={15} className="text-ink-4 group-hover:text-brand transition-colors mt-0.5" />
                </div>

                {/* Name */}
                <div className="font-display font-semibold text-md text-ink truncate mb-1">
                  {member.salon.name}
                </div>
                <div className="font-mono text-[10.5px] text-ink-4 mb-4">
                  {member.salon.slug}
                </div>

                {/* Chips */}
                <div className="flex items-center gap-2 mt-auto flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium uppercase tracking-wide ${PLAN_CHIP[member.salon.plan] ?? 'bg-surface-3 text-ink-3'}`}>
                    {member.salon.plan}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium ${ROLE_CHIP[member.role] ?? 'bg-surface-3 text-ink-3'}`}>
                    {member.role}
                  </span>
                </div>
              </button>
            ))}

            {/* "New salon" card */}
            <button
              onClick={() => navigate('/criar-salao')}
              className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-line rounded-xl hover:border-brand/40 hover:bg-brand-soft/20 transition-all min-h-[144px] text-ink-3 hover:text-brand"
            >
              <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center mb-2">
                <Icon name="plus" size={16} />
              </div>
              <span className="text-sm font-display font-medium">Novo salão</span>
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
