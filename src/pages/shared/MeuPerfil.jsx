import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import ClienteSidebar from '@/components/layout/ClienteSidebar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icons'
import WhatsAppLinkModal from '@/components/ui/WhatsAppLinkModal'
import UpgradeModal from '@/components/ui/UpgradeModal'
import PhoneChangeField from '@/components/ui/PhoneChangeField'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import api from '@/lib/api'

import { navItemsByRole } from '@/config/navItems'
import { salonHasFeature, planRequiredFor } from '@/config/plans'
import { formatDate } from '@/lib/format'

const STATUS_LABELS = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 py-3 md:py-3.5 border-b border-line-2 last:border-0">
      <div className="text-[11px] sm:text-[12px] text-ink-3 font-medium sm:w-40 sm:shrink-0">{label}</div>
      <div className="text-[13px] md:text-[13.5px] text-ink-2">{value || '—'}</div>
    </div>
  )
}

export default function MeuPerfil() {
  const { salonSlug } = useParams()
  const { user, restoreSession } = useAuthStore()
  const { salon } = useSalonStore()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const hasWhatsapp = salonHasFeature(salon, 'whatsapp')

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [errors, setErrors] = useState({})
  const [exporting, setExporting] = useState(false)
  const [appointments, setAppointments] = useState([])
  const [apptLoading, setApptLoading] = useState(false)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [upsellOpen, setUpsellOpen] = useState(false)

  useEffect(() => {
    api.get('/users/perfil/me')
      .then(({ data }) => {
        const normalized = {
          id: data.UUID,
          name: data.Name,
          email: data.Email,
          role: data.Role,
          phone: data.Phone,
          birthday: data.Birthday,
          active: data.active,
        }
        setProfile(normalized)
        setName(normalized.name ?? '')
        setBirthday(normalized.birthday ? normalized.birthday.slice(0, 10) : '')
      })
      .catch((err) => {
        const msg = err.response?.data?.error ?? `Erro ${err.response?.status ?? 'de conexão'} ao carregar perfil`
        setLoadError(msg)
        console.error('[MeuPerfil] GET /users/perfil/me falhou:', err.response?.status, err.response?.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user?.role !== 'Usuario' || !user?.id) return
    setApptLoading(true)
    api.get(`/appointment/client/${user.id}`, { params: { limit: 20 } })
      .then(({ data }) => setAppointments(data.data ?? []))
      .catch(() => setAppointments([]))
      .finally(() => setApptLoading(false))
  }, [user?.id, user?.role])

  function startEdit() {
    setName(profile.name ?? '')
    setBirthday(profile.birthday ? profile.birthday.slice(0, 10) : '')
    setErrors({})
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setErrors({})
  }

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Nome obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleExport() {
    setExporting(true)
    try {
      const { data } = await api.get('/users/perfil/me/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'meus-dados-dauth.json'
      a.click()
      URL.revokeObjectURL(url)
      addToast('Dados exportados com sucesso')
    } catch {
      addToast('Erro ao exportar dados', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = { Name: name.trim() }
      if (birthday) payload.Birthday = birthday
      await api.patch('/users/perfil/me', payload)
      const updated = { ...profile, name: name.trim(), birthday }
      setProfile(updated)
      restoreSession({ ...user, name: name.trim() })
      setEditing(false)
      addToast('Perfil atualizado com sucesso')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const navItems = navItemsByRole[user?.role] ?? []
  const sidebar = user?.role === 'Usuario'
    ? <ClienteSidebar user={user} />
    : <Sidebar navItems={navItems} footerUser={user?.name} footerRole={user?.role}>{user?.role}</Sidebar>

  if (loading) {
    return (
      <AppLayout sidebar={sidebar}>
        <div className="max-w-2xl">
          <div className="flex justify-between items-start mb-7">
            <div className="flex flex-col gap-2">
              <div className="h-7 w-32 bg-surface-2 rounded-lg animate-pulse" />
              <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-surface-2 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-4 mb-5 p-5 bg-surface border border-line rounded-xl">
            <div className="w-12 h-12 rounded-full bg-surface-2 animate-pulse shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="h-4 w-36 bg-surface-2 rounded animate-pulse" />
              <div className="h-3.5 w-44 bg-surface-2 rounded animate-pulse" />
              <div className="h-3 w-16 bg-surface-2 rounded animate-pulse" />
            </div>
          </div>
          <div className="bg-surface border border-line rounded-xl px-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3.5 border-b border-line-2 last:border-0">
                <div className="w-40 h-3.5 bg-surface-2 rounded animate-pulse shrink-0" />
                <div className="h-3.5 bg-surface-2 rounded animate-pulse" style={{ width: `${[120, 160, 100, 90][i]}px` }} />
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  if (loadError) {
    return (
      <AppLayout sidebar={sidebar}>
        <div className="max-w-2xl">
          <h3 className="font-display font-medium text-[26px] tracking-tight mb-7">Meu perfil</h3>
          <div className="bg-danger-soft border border-danger/20 rounded-xl p-5">
            <p className="text-[13.5px] text-danger font-medium mb-1">Não foi possível carregar o perfil</p>
            <p className="text-[12.5px] text-danger/80">{loadError}</p>
            <p className="text-[12px] text-ink-3 mt-3">Verifique o console do navegador (F12) para mais detalhes.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-2xl">
        <div className="flex justify-between items-start mb-5 md:mb-7">
          <div>
            <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Meu perfil</h3>
            <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Seus dados pessoais</p>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Icon name="edit" size={13} />Editar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 mb-5 p-5 bg-surface border border-line rounded-xl">
          <Avatar name={profile?.name ?? ''} index={0} size="lg" />
          <div>
            <div className="font-display font-medium text-[18px]">{profile?.name}</div>
            {profile?.phone && <div className="text-[13px] text-ink-3 mt-0.5">{profile.phone}</div>}
            <div className="font-mono text-[10.5px] text-ink-4 mt-1.5 uppercase tracking-widest">{profile?.role}</div>
          </div>
        </div>

        {!editing && (
          <>
            <div className="bg-surface border border-line rounded-xl px-5 mb-4">
              <InfoRow label="Nome completo" value={profile?.name} />
              <InfoRow label="Telefone" value={profile?.phone} />
              <InfoRow label="Data de nascimento" value={formatDate(profile?.birthday)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/${salonSlug}/trocar-senha`)}>
                <Icon name="lock" size={13} />Trocar senha
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExport} loading={exporting}>
                <Icon name="receipt" size={13} />Exportar meus dados
              </Button>
              {user?.role === 'Admin' && (
                hasWhatsapp ? (
                  <Button variant="whatsapp" size="sm" onClick={() => setWhatsappModalOpen(true)}>
                    <Icon name="qr" size={13} />Linkar com WhatsApp
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setUpsellOpen(true)} title={`Disponível a partir do plano ${planRequiredFor('whatsapp')?.label}`}>
                    <Icon name="lock" size={13} />Linkar com WhatsApp
                  </Button>
                )
              )}
            </div>
          </>
        )}

        {whatsappModalOpen && <WhatsAppLinkModal onClose={() => setWhatsappModalOpen(false)} />}
        {upsellOpen && (
          <UpgradeModal
            salonId={salon?.id}
            defaultPlan="profissional"
            feature="whatsapp"
            onClose={() => setUpsellOpen(false)}
            onActivated={() => { setUpsellOpen(false); window.location.reload() }}
          />
        )}

        {!editing && user?.role === 'Usuario' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-medium text-[17px] tracking-tight">Histórico de agendamentos</h4>
              <button
                onClick={() => navigate(`/${salonSlug}/cliente/agendamentos`)}
                className="text-[12px] text-brand hover:underline flex items-center gap-1"
              >
                Ver todos <Icon name="chevronRight" size={12} />
              </button>
            </div>

            {apptLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
                    <div className="h-3.5 w-20 bg-surface-2 rounded animate-pulse shrink-0" />
                    <div className="h-3.5 flex-1 bg-surface-2 rounded animate-pulse" />
                    <div className="h-5 w-20 bg-surface-2 rounded-full animate-pulse shrink-0" />
                  </div>
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="bg-surface border border-line rounded-xl p-6 text-center">
                <p className="text-[13px] text-ink-3">Nenhum agendamento encontrado.</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block bg-surface border border-line rounded-xl overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['Data', 'Serviço', 'Profissional', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map(row => (
                        <tr
                          key={row.UUID}
                          className="hover:bg-surface-2 transition-colors cursor-pointer"
                          onClick={() => navigate(`/${salonSlug}/agendamento/${row.UUID}`)}
                        >
                          <td className="px-4 py-3 font-mono text-[12px] text-ink-3 border-b border-line-2 whitespace-nowrap">{formatDate(row.Date)}</td>
                          <td className="px-4 py-3 text-[13px] border-b border-line-2">{row.Service ?? '—'}</td>
                          <td className="px-4 py-3 text-[13px] text-ink-3 border-b border-line-2">{row.Professional ?? '—'}</td>
                          <td className="px-4 py-3 border-b border-line-2">
                            <Chip status={row.Status} dot>{STATUS_LABELS[row.Status] ?? row.Status}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 md:hidden">
                  {appointments.map(row => (
                    <div
                      key={row.UUID}
                      className="bg-surface border border-line rounded-xl p-4 cursor-pointer"
                      onClick={() => navigate(`/${salonSlug}/agendamento/${row.UUID}`)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-medium text-[13.5px] flex-1 min-w-0 truncate">{row.Service ?? '—'}</div>
                        <Chip status={row.Status} dot className="shrink-0">{STATUS_LABELS[row.Status] ?? row.Status}</Chip>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-ink-3">
                        <span>{formatDate(row.Date)}</span>
                        {row.Professional && <><span>·</span><span>com {row.Professional}</span></>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {editing && (
          <form onSubmit={handleSave} className="bg-surface border border-line rounded-xl p-5">
            <Input
              label="Nome completo"
              value={name}
              onChange={e => setName(e.target.value)}
              error={errors.name}
            />
            <PhoneChangeField />
            <Input
              label="Data de nascimento"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              type="date"
            />
            <div className="flex gap-2.5">
              <Button type="submit" loading={saving}>
                Salvar alterações
              </Button>
              <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  )
}
