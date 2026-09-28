import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import { canEnterSalon } from '@/lib/salonAccess'
import useSalonStore from '@/store/salonStore'
import useAuthStore from '@/store/authStore'
import Icon from '@/components/ui/Icons'
import Avatar from '@/components/ui/Avatar'
import { PageSpinner } from '@/components/ui/Spinner'

const ROLE_LABEL = { Profissional: 'Profissional', Admin: 'Admin' }
const ROLE_COLOR = {
  Profissional: 'bg-brand-soft text-brand',
  Admin: 'bg-warning-soft text-warning',
}

function StatusDot({ status }) {
  if (status === 'active') return <span className="w-2 h-2 rounded-full bg-success inline-block" title="Ativo" />
  if (status === 'trial')  return <span className="w-2 h-2 rounded-full bg-warning inline-block" title="Trial" />
  return <span className="w-2 h-2 rounded-full bg-danger inline-block" title="Suspenso" />
}

export default function MeusEmpregosPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const setSalon = useSalonStore(s => s.setSalon)
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    platformApi.get('/salon/my')
      .then(({ data }) => {
        // Filtra só memberships de Profissional ou Admin (não Usuario)
        const filtered = (data.salons ?? data).filter(m =>
          (m.role === 'Profissional' || m.role === 'Admin') && canEnterSalon(m)
        )
        setMemberships(filtered)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleEnter(membership) {
    setSalon({
      salon: membership.salon ?? membership,
      role: membership.role,
      memberId: membership.memberId ?? membership.id,
    })
    const slug = membership.salon?.slug ?? membership.slug
    const path = membership.role === 'Admin' ? 'admin' : 'profissional'
    navigate(`/${slug}/${path}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <PageSpinner />
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="border-b border-line bg-surface">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-1">Dauth</p>
            <h1 className="font-display font-medium text-[24px] tracking-tight text-ink">Meus empregos</h1>
            <p className="text-[13px] text-ink-3 mt-0.5">Olá, {user?.name}. Escolha o salão para entrar.</p>
          </div>
          <button
            onClick={() => navigate('/marketplace')}
            className="text-[13px] text-ink-3 hover:text-ink transition-colors flex items-center gap-1.5"
          >
            <Icon name="arrowLeft" size={14} />
            Marketplace
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {memberships.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
              <Icon name="scissors" size={24} className="text-ink-3" />
            </div>
            <p className="font-display font-medium text-[18px] text-ink mb-1">Nenhum salão encontrado</p>
            <p className="text-[13px] text-ink-3">Você ainda não foi adicionado a nenhum salão como profissional.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {memberships.map((m, i) => {
              const salon = m.salon ?? m
              return (
                <button
                  key={m.id ?? i}
                  onClick={() => handleEnter(m)}
                  className="w-full text-left bg-surface border border-line rounded-xl p-5 hover:border-brand/40 hover:bg-brand-soft/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <Avatar name={salon.name} index={i} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-display font-medium text-[16px] text-ink truncate">{salon.name}</span>
                        <StatusDot status={salon.status} />
                      </div>
                      {salon.address && (
                        <p className="text-[12px] text-ink-3 truncate">{salon.address}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${ROLE_COLOR[m.role] ?? 'bg-surface-2 text-ink-3'}`}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                      <Icon name="arrowRight" size={16} className="text-ink-4 group-hover:text-brand transition-colors" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
