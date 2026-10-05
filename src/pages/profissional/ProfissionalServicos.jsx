import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Icon from '@/components/ui/Icons'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'
import { formatDuration } from '@/lib/format'

export default function ProfissionalServicos() {
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    load()
  }, [user?.id])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/service', { params: { professional: user.id, limit: 100 } })
      setServices(data.data ?? [])
    } catch {
      addToast('Erro ao carregar serviços', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sidebar = (
    <Sidebar navItems={navItemsByRole[user?.role] ?? navItemsByRole.Profissional} footerUser={user?.name} footerRole={user?.role}>{user?.role}</Sidebar>
  )

  if (loading) return (
    <AppLayout sidebar={sidebar}>
      <div className="flex flex-col gap-2 mb-7">
        <div className="h-7 w-40 bg-surface-2 rounded-lg animate-pulse" />
        <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 bg-surface border border-line rounded-xl">
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-4 w-36 bg-surface-2 rounded animate-pulse" />
              <div className="h-3 w-24 bg-surface-2 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="mb-7">
        <h3 className="font-display font-medium text-[26px] tracking-tight">Meus serviços</h3>
        <p className="text-[13px] text-ink-3 mt-1">
          {services.length} serviço{services.length !== 1 ? 's' : ''} vinculado{services.length !== 1 ? 's' : ''} · gerenciado pelo administrador
        </p>
      </div>

      {services.length === 0 ? (
        <div className="text-[13px] text-ink-3 py-10 text-center bg-surface border border-line border-dashed rounded-xl">
          Você ainda não está vinculado a nenhum serviço.<br />
          <span className="text-ink-4">Entre em contato com o administrador do salão.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {services.map((s) => (
            <div key={s.UUID} className="flex items-center gap-4 px-5 py-4 bg-surface border border-line rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-[14px] truncate">{s.Name}</span>
                  {s.Category && (
                    <span className="font-mono text-[10.5px] text-ink-4 uppercase tracking-widest">{s.Category}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {s.Duration && (
                    <span className="font-mono text-[11.5px] text-ink-3">
                      <Icon name="clock" size={11} className="inline mr-1" />
                      {formatDuration(s.Duration)}
                    </span>
                  )}
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {Number(s.Price) > 0
                      ? `R$ ${Number(s.Price).toFixed(0)}`
                      : 'Consultar'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
