import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import platformApi from '@/lib/platformApi'
import { canEnterSalon } from '@/lib/salonAccess'
import PendingInvitations from '@/components/ui/PendingInvitations'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/format'

const ROLE_PATH = { Admin: 'admin', Profissional: 'profissional', Usuario: 'cliente', Servico: 'admin' }
const MAX_SERVICES = 3

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function SalonCard({ salon, isMember, onClick }) {
  const total = salon._count?.services ?? salon.services?.length ?? 0
  const shown = (salon.services ?? []).slice(0, MAX_SERVICES)
  const extra = total - shown.length

  return (
    <article
      onClick={onClick}
      className="group flex flex-col bg-surface border border-line rounded-xl p-5 cursor-pointer hover:border-brand/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0 font-display font-semibold text-lg">
          {salon.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-md text-ink group-hover:text-brand transition-colors truncate">{salon.name}</h3>
            {isMember && (
              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-brand-soft text-brand">Membro</span>
            )}
          </div>
          <p className="text-xs text-ink-3 mt-0.5 flex items-center gap-1 min-h-[16px]">
            {salon.address ? (<><PinIcon /><span className="truncate">{salon.address}</span></>) : <span className="text-ink-4">Endereço não informado</span>}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-line-3 flex-1">
        {shown.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {shown.map(s => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-ink-2 truncate">{s.name}</span>
                {s.price != null && <span className="font-mono text-xs text-ink-3 shrink-0">{formatCurrency(s.price)}</span>}
              </li>
            ))}
            {extra > 0 && <li className="text-xs text-ink-3 mt-0.5">+{extra} {extra === 1 ? 'serviço' : 'serviços'}</li>}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-4">Serviços em breve</p>
        )}
      </div>

      <button
        type="button"
        className={`mt-4 w-full h-9 rounded-lg text-[13px] font-display font-medium transition-colors ${
          isMember
            ? 'bg-brand text-white hover:bg-brand-dark'
            : 'border border-line text-ink-2 group-hover:border-brand group-hover:text-brand'
        }`}
      >
        {isMember ? 'Entrar no salão' : 'Ver salão e agendar'}
      </button>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-line rounded-xl p-5 animate-pulse">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-lg bg-surface-3" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-2/3 rounded bg-surface-3" />
          <div className="h-3 w-1/2 rounded bg-surface-2" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-line-3 space-y-2">
        <div className="h-3 rounded bg-surface-2" />
        <div className="h-3 rounded bg-surface-2" />
        <div className="h-3 w-3/4 rounded bg-surface-2" />
      </div>
      <div className="mt-4 h-9 rounded-lg bg-surface-3" />
    </div>
  )
}

export default function MarketplacePage() {
  const [salons, setSalons] = useState([])
  const [myMembers, setMyMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { user, logout, updateUser } = useAuthStore()
  const setSalon = useSalonStore((s) => s.setSalon)

  useEffect(() => {
    platformApi.get('/salon/my')
      .then(({ data }) => setMyMembers((Array.isArray(data) ? data : []).filter(canEnterSalon)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    platformApi.get(`/platform/salons?${params}`)
      .then(({ data }) => {
        const list = data.data ?? []
        setSalons(list)
      })
      .catch(() => setSalons([]))
      .finally(() => setLoading(false))
  }, [query])

  const isMember = (salon) => myMembers.some(m => m.salonId === salon.id || m.salon?.slug === salon.slug)

  // Salões dos quais a pessoa já é membro aparecem primeiro
  const ordered = useMemo(
    () => [...salons].sort((a, b) => Number(isMember(b)) - Number(isMember(a))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salons, myMembers]
  )

  function runSearch(term) {
    setSearch(term)
    setQuery(term)
  }

  async function handleSalonClick(salon) {
    const member = myMembers.find(m => m.salonId === salon.id || m.salon?.slug === salon.slug)
    if (!member) { navigate(`/salao/${salon.slug}`); return }
    setSalon(
      { id: member.salonId, name: member.salon.name, slug: member.salon.slug, plan: member.salon.plan, status: member.salon.status, colorPalette: member.salon.colorPalette ?? null },
      member.role, member.id
    )
    try {
      const { data: perfil } = await api.get('/users/perfil/me', { headers: { 'x-salon-id': member.salonId } })
      updateUser({ id: perfil.UUID, publicId: perfil.UUID, role: perfil.Role, must_change_password: perfil.Must_change_password })
    } catch {}
    navigate(`/${member.salon.slug}/${ROLE_PATH[member.role] ?? 'cliente'}`, { replace: true })
  }

  const isOwner = user?.platformRole === 'SalonOwner'

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
        <div className="flex items-center gap-2">
          {isOwner && (
            <Link to="/meus-saloes" className="text-[13px] text-ink-2 hover:text-brand transition-colors px-3 py-1.5 rounded-md hover:bg-surface-2">
              Meus salões
            </Link>
          )}
          {user && (
            <Link to="/minha-conta" className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-2 transition-colors">
              <Avatar name={user.name} index={1} size="sm" />
              <span className="text-sm text-ink-2 hidden sm:block">{user.name}</span>
            </Link>
          )}
          <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
            title="Sair"
            className="flex items-center text-ink-3 hover:text-danger transition-colors p-2 rounded-md hover:bg-danger-soft">
            <Icon name="logout" size={15} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* ── Cabeçalho (mesmo padrão de /meus-saloes) ── */}
        <div className="mb-8">
          <p className="eyebrow mb-2">Marketplace</p>
          <h1 className="font-serif text-[40px] font-light text-ink tracking-tight leading-tight">Encontre seu salão.</h1>
          <p className="text-ink-3 mt-1.5 text-md">Veja serviços e valores antes de agendar.</p>
        </div>

        <PendingInvitations onAccepted={() => navigate(user?.platformRole === 'SalonOwner' ? '/meus-saloes' : '/meus-empregos')} />

        {/* ── Busca ── */}
        <form onSubmit={e => { e.preventDefault(); setQuery(search.trim()) }} className="flex gap-2 max-w-xl mb-8">
          <div className="relative flex-1">
            <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por salão ou serviço"
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-line bg-surface text-ink-2 text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
            />
          </div>
          <Button type="submit">Buscar</Button>
        </form>

        {/* ── Resultados ── */}
        <div className="flex items-center justify-between mb-5 min-h-[20px]">
          {loading ? (
            <div className="h-3.5 w-36 rounded bg-surface-3 animate-pulse" />
          ) : (
            <h2 className="eyebrow">
              {query
                ? `${salons.length} ${salons.length === 1 ? 'resultado' : 'resultados'} para “${query}”`
                : `${salons.length} ${salons.length === 1 ? 'salão disponível' : 'salões disponíveis'}`}
            </h2>
          )}
          {query && (
            <button onClick={() => runSearch('')} className="text-sm text-brand hover:underline">Limpar busca</button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : ordered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-surface-2 text-ink-3 flex items-center justify-center mx-auto mb-4">
              <Icon name="search" size={22} />
            </div>
            <h3 className="font-display text-[20px] font-semibold text-ink mb-1">Nenhum salão encontrado</h3>
            <p className="text-sm text-ink-3 mb-4">Tente buscar por outro nome ou serviço.</p>
            {query && (
              <button onClick={() => runSearch('')}
                className="h-9 px-4 rounded-lg border border-line text-[13px] text-ink-2 hover:border-brand hover:text-brand transition-colors">
                Ver todos os salões
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ordered.map(salon => (
              <SalonCard key={salon.id} salon={salon}
                isMember={isMember(salon)}
                onClick={() => handleSalonClick(salon)} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
