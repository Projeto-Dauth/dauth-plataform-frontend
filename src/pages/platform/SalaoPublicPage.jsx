import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import useAuthStore from '@/store/authStore'
import Icon from '@/components/ui/Icons'
import { formatDuration } from '@/lib/format'

const ROLE_PATH = { Admin: 'admin', Profissional: 'profissional', Usuario: 'cliente', Servico: 'admin' }

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const fmtPrice = (p) => p != null ? `R$ ${Number(p).toFixed(2).replace('.', ',')}` : null

export default function SalaoPublicPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [salon, setSalon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [membership, setMembership] = useState(null) // { role, salonId }

  useEffect(() => {
    platformApi.get(`/platform/salons/${slug}`)
      .then(({ data }) => setSalon(data))
      .catch(() => setError('Salão não encontrado.'))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!isAuthenticated || !salon) return
    platformApi.get('/salon/my')
      .then(({ data }) => {
        const match = (Array.isArray(data) ? data : []).find(m => m.salon?.slug === slug)
        if (match) {
          setMembership({ role: match.role, salonId: match.salonId })
        } else {
          // Usuário autenticado mas não membro — entra como Usuario automaticamente
          platformApi.post('/salon/join', {}, { headers: { 'x-salon-id': salon.id } })
            .then(({ data: m }) => setMembership({ role: m.role, salonId: salon.id }))
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [slug, salon])

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
    </div>
  )

  if (error || !salon) return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
      <div className="text-4xl opacity-30">✂️</div>
      <h2 className="font-serif text-[26px] font-light text-ink">Salão não encontrado</h2>
      <Link to="/marketplace" className="text-sm text-brand hover:underline">← Ver todos os salões</Link>
    </div>
  )

  const byCategory = salon.services?.reduce((acc, svc) => {
    const cat = svc.category?.name || 'Serviços'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {}) ?? {}

  const serviceCount = salon._count?.services ?? salon.services?.length ?? 0
  // Agendamento online desligado (Configurações → Agendamento): não-membro não vê botão de agendar
  const canBook = salon.bookingEnabled !== false
  const hours = salon.businessHours ?? []

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header / Hero ── */}
      <div className="bg-brand grain">
        {/* Navbar */}
        <div className="px-6 pt-6">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link to="/marketplace"
              className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-display">
              <Icon name="chevronLeft" size={14} />
              Marketplace
            </Link>
            <div className="flex items-center gap-2">
              {isAuthenticated && (membership || canBook) && (
                <button
                  onClick={() => navigate(membership ? `/${slug}/${ROLE_PATH[membership.role] ?? 'cliente'}` : `/${slug}/agendar`)}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-display border border-white/20 rounded-lg px-3 py-1.5 hover:border-white/40"
                >
                  {membership ? 'Meu painel' : 'Agendar'}
                  <Icon name="arrowRight" size={12} />
                </button>
              )}
              <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                <span className="font-serif text-white text-xs">D</span>
              </div>
              <span className="text-white/40 text-[12px] font-display">Dauth</span>
            </div>
          </div>
        </div>

        {/* Conteúdo do hero */}
        <div className="px-6 pt-10 pb-12">
          <div className="max-w-3xl mx-auto">
            <p className="eyebrow text-white/40 mb-3">Salão · {slug}</p>
            <h1 className="font-serif text-[44px] sm:text-[52px] font-light text-white leading-tight tracking-wide mb-4">
              {salon.name}
            </h1>

            {salon.description && (
              <p className="text-white/70 text-[15px] leading-relaxed mb-5 max-w-xl">
                {salon.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-5 text-white/50 text-sm mb-8">
              {salon.address && (
                <span className="flex items-center gap-1.5">
                  <Icon name="home" size={13} />
                  {salon.address}
                </span>
              )}
              {salon.phone && (
                <span className="flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"/>
                  </svg>
                  {salon.phone}
                </span>
              )}
              {salon.instagram && (
                <a href={`https://instagram.com/${salon.instagram}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                  </svg>
                  @{salon.instagram}
                </a>
              )}
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
                </svg>
                {serviceCount} serviços
              </span>
            </div>

            {membership ? (
              <button onClick={() => navigate(`/${slug}/${ROLE_PATH[membership.role] ?? 'cliente'}`)}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-white text-brand font-display font-semibold text-sm hover:bg-surface-2 transition-colors active:scale-[0.97]">
                Ir para o salão
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            ) : canBook && (
              <button onClick={() => navigate(`/${slug}/agendar`)}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-white text-brand font-display font-semibold text-sm hover:bg-surface-2 transition-colors active:scale-[0.97]">
                Agendar agora
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Serviços ── */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-serif text-[28px] font-light text-ink tracking-tight">Serviços</h2>
          {(membership || canBook) && <button onClick={() => navigate(membership ? `/${slug}/${ROLE_PATH[membership.role] ?? 'cliente'}` : `/${slug}/agendar`)}
            className="h-9 px-4 rounded-lg bg-brand-soft text-brand text-sm font-display font-medium hover:bg-brand hover:text-white transition-colors">
            {membership ? 'Meus agendamentos' : 'Agendar agora'}
          </button>}
        </div>

        {Object.keys(byCategory).length === 0 && (
          <p className="text-ink-3 text-sm">Nenhum serviço disponível no momento.</p>
        )}

        <div className="flex flex-col gap-8">
          {Object.entries(byCategory).map(([cat, services]) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-3">
                <span className="eyebrow">{cat}</span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <div className="bg-surface border border-line rounded-xl overflow-hidden">
                {services.map((svc, i) => (
                  <div key={svc.id}
                    className={`flex items-center justify-between px-5 py-4 ${i < services.length - 1 ? 'border-b border-line' : ''}`}>
                    <div>
                      <p className="text-md font-display font-medium text-ink">{svc.name}</p>
                      {formatDuration(svc.duration) && (
                        <p className="text-xs font-mono text-ink-3 mt-0.5">{formatDuration(svc.duration)}</p>
                      )}
                    </div>
                    {fmtPrice(svc.price) && (
                      <p className="text-md font-display font-semibold text-brand shrink-0 ml-4">
                        {fmtPrice(svc.price)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Horário de funcionamento ── */}
        {hours.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Horário de funcionamento</span>
              <div className="flex-1 h-px bg-line" />
            </div>
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              {WEEKDAYS.map((day, weekday) => {
                const h = hours.find(x => x.weekday === weekday)
                return (
                  <div key={day} className={`flex items-center justify-between px-5 py-3 text-sm ${weekday < 6 ? 'border-b border-line' : ''}`}>
                    <span className="font-display text-ink">{day}</span>
                    <span className={`font-mono ${h ? 'text-ink-2' : 'text-ink-4'}`}>{h ? `${h.open} – ${h.close}` : 'Fechado'}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Equipe ── */}
        {salon.team?.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Equipe</span>
              <div className="flex-1 h-px bg-line" />
            </div>
            <div className="flex flex-wrap gap-2">
              {salon.team.map(p => (
                <span key={p.id} className="flex items-center gap-2 bg-surface border border-line rounded-full pl-1 pr-3 py-1">
                  <span className="w-7 h-7 rounded-full bg-brand-soft text-brand-soft-ink flex items-center justify-center text-xs font-display font-semibold">
                    {p.name?.[0]?.toUpperCase()}
                  </span>
                  <span className="text-sm text-ink">{p.name}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA final ── */}
        {(membership || canBook) && <div className="mt-12 p-8 rounded-xl border-2 border-dashed border-line text-center">
          <p className="eyebrow mb-2">Pronto para agendar?</p>
          <h3 className="font-serif text-[26px] font-light text-ink mb-2">
            Reserve seu horário em {salon.name}
          </h3>
          <p className="text-sm text-ink-3 mb-6 max-w-xs mx-auto">
            Agende com qualquer profissional do salão em poucos cliques.
          </p>
          <button onClick={() => navigate(membership ? `/${slug}/${ROLE_PATH[membership.role] ?? 'cliente'}` : `/${slug}/agendar`)}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-brand text-white font-display font-medium text-sm hover:bg-brand/90 transition-colors">
            {membership ? 'Meus agendamentos' : 'Agendar agora'}
          </button>
        </div>}
      </main>
    </div>
  )
}
