import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import LoadMoreButton from '@/components/ui/LoadMoreButton'
import ModalFecharConta from '@/components/ui/ModalFecharConta'
import ModalPagarMensalidade from '@/components/ui/ModalPagarMensalidade'
import ComboCard from '@/components/ui/ComboCard'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import api from '@/lib/api'
import platformApi from '@/lib/platformApi'
import useSalonStore from '@/store/salonStore'
import { navItemsByRole } from '@/config/navItems'
import { useTour } from '@/hooks/useTour'
import { adminUsuariosSteps } from '@/tours/adminUsuariosTour'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { batchPayExtraMessage } from '@/lib/creditToast'
import { MODULES, SERVICE_ACCOUNT_MODULES } from '@/config/modules'
import { excludeMonitorAdmins } from '@/config/monitorAdmins'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate } from '@/lib/format'
import { formatPhone } from '@/lib/phone'

const navItems = navItemsByRole['Admin']

const ROLE_FILTERS = ['Todos', 'Admin', 'Profissional', 'Cliente']
const ROLE_FILTER_API = { Cliente: 'Usuario' }

const ROLE_CHIP = {
  Admin: 'brand',
  Profissional: 'warning',
  Usuario: 'default',
  Servico: 'default',
}

const ROLE_LABEL = {
  Admin: 'Admin',
  Profissional: 'Profissional',
  Usuario: 'Cliente',
  Servico: 'Conta de serviço',
}

// Quem tem permissões por módulo (Admin é sempre acesso total) e quais módulos cada papel tem.
const PERMISSION_MODULES = { Profissional: MODULES, Servico: SERVICE_ACCOUNT_MODULES }

const CLIENT_EXTRA_FILTERS = [
  { key: 'mensalista', label: 'Mensalistas' },
  { key: 'comanda_aberta', label: 'Comanda aberta' },
  { key: 'aniversariante', label: 'Aniversariante do mês' },
  { key: 'ativo', label: 'Ativos' },
  { key: 'inativo', label: 'Inativos' },
]

function formatBirthday(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`
}

function isBirthdayThisMonth(iso) {
  if (!iso) return false
  const d = new Date(iso)
  return d.getUTCMonth() === new Date().getMonth()
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3.5 py-3 border-b border-line-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-line-2 shrink-0" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-28 rounded bg-line-2" />
            <div className="h-2.5 w-20 rounded bg-line-2" />
          </div>
        </div>
      </td>
      <td className="px-3.5 py-3 border-b border-line-2"><div className="h-5 w-16 rounded-full bg-line-2" /></td>
      <td className="px-3.5 py-3 border-b border-line-2"><div className="h-3 w-28 rounded bg-line-2" /></td>
      <td className="px-3.5 py-3 border-b border-line-2"><div className="h-3 w-20 rounded bg-line-2" /></td>
      <td className="px-3.5 py-3 border-b border-line-2"><div className="h-5 w-12 rounded-full bg-line-2" /></td>
      <td className="px-3.5 py-3 border-b border-line-2" />
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-line-2 shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3 w-32 rounded bg-line-2" />
          <div className="h-2.5 w-24 rounded bg-line-2" />
        </div>
        <div className="h-5 w-12 rounded-full bg-line-2" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 rounded-full bg-line-2" />
        <div className="h-7 w-20 rounded bg-line-2" />
      </div>
    </div>
  )
}

const EMPTY_FORM = { name: '', phone: '', birthday: '' }

const STATUS_LABELS = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }

const CREDIT_TYPE_LABEL = {
  overpayment: 'Troco convertido em crédito',
  usage: 'Usado em pagamento',
  manual_adjust: 'Ajuste manual',
  refund: 'Estorno',
}

function toDateInputValue(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function ClientePanel({ client, onClose, onReload, mensalistaData }) {
  const { addToast } = useToast()
  // A conta de serviço também abre esta ficha, mas sem as ações só de Admin (permissões, convite, remover, crédito manual…)
  const viewerIsAdmin = useSalonStore(s => s.role) === 'Admin'
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState([])
  const [tabs, setTabs] = useState([])
  const [combos, setCombos] = useState([])
  const [concludingPackageId, setConcludingPackageId] = useState(null)
  const [mensalistaModal, setMensalistaModal] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: client.Name, phone: client.Phone ?? '', birthday: toDateInputValue(client.Birthday) })
  const [editErrors, setEditErrors] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  function validateEdit() {
    const errs = {}
    if (!editForm.name.trim()) errs.name = 'Nome é obrigatório'
    if (!/^\(\d{2}\) \d \d{4}-\d{4}$/.test(editForm.phone)) errs.phone = 'Telefone inválido. Ex: (11) 9 9999-9999'
    return errs
  }

  async function handleSaveEdit() {
    const errs = validateEdit()
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return }
    setSavingEdit(true)
    try {
      await api.patch(`/users/${client.UUID}`, {
        Name: editForm.name.trim(),
        Phone: editForm.phone,
        Birthday: editForm.birthday || null,
      })
      addToast('Cliente atualizado com sucesso', 'success')
      setEditing(false)
      onReload()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar cliente', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const [fecharConta, setFecharConta] = useState(null)
  const [fecharPaying, setFecharPaying] = useState(false)

  const [permissions, setPermissions] = useState(null)
  const [savingPermissions, setSavingPermissions] = useState(false)

  const [credit, setCredit] = useState(null)
  const [creditModal, setCreditModal] = useState(false)
  const [creditHistoryModal, setCreditHistoryModal] = useState(false)

  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const salonId = useSalonStore(s => s.salon?.id)
  const [confirmInvite, setConfirmInvite] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Convida o cliente para a equipe: ele recebe no app e no WhatsApp (e no email, se tiver) e vira Profissional ao aceitar
  async function handleInviteToTeam() {
    setInviting(true)
    try {
      const { data } = await platformApi.post(`/salon/members/${client.UUID}/invite`, {}, { headers: { 'x-salon-id': salonId } })
      addToast(data.message ?? 'Convite enviado', 'success')
      setConfirmInvite(false)
    } catch (err) {
      addToast(err.response ? (err.response.data?.error || 'Erro ao enviar convite') : 'Sem resposta do servidor. O convite pode ter sido salvo — tente de novo que ele é reenviado.', 'error')
    } finally {
      setInviting(false)
    }
  }

  async function handleResetPassword() {
    setResetting(true)
    try {
      await api.patch(`/users/${client.UUID}/reset-password`)
      addToast(`Senha de ${client.Name} redefinida para 12345678`, 'success')
      setConfirmReset(false)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao redefinir senha', 'error')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/appointment/client/${client.UUID}`, { params: { limit: 100 } }),
      api.get(`/tab/client/${client.UUID}`),
    ])
      .then(([apptRes, tabRes]) => {
        setAppointments(apptRes.data.data ?? [])
        setTabs(tabRes.data.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    if (PERMISSION_MODULES[client.Role] && viewerIsAdmin) {
      api.get(`/professional/${client.UUID}/permissions`)
        .then(res => setPermissions(res.data.data))
        .catch(() => setPermissions(null))
    } else {
      setPermissions(null)
    }

    if (client.Role === 'Usuario') {
      loadCredit()
      api.get(`/package/client/${client.UUID}`)
        .then(res => setCombos(res.data.data ?? []))
        .catch(() => setCombos([]))
    } else {
      setCredit(null)
      setCombos([])
    }
  }, [client.UUID, client.Role])

  async function handleConcludePackage(combo, note) {
    setConcludingPackageId(combo.UUID)
    try {
      await api.patch(`/package/client/${combo.UUID}/conclude`, { Note: note })
      addToast('Pacote marcado como concluído', 'success')
      const res = await api.get(`/package/client/${client.UUID}`)
      setCombos(res.data.data ?? [])
      return true
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao concluir pacote', 'error')
      return false
    } finally {
      setConcludingPackageId(null)
    }
  }

  function loadCredit() {
    api.get(`/users/${client.UUID}/credit-balance`)
      .then(res => setCredit(res.data))
      .catch(() => setCredit(null))
  }

  function togglePermission(module, field) {
    setPermissions(prev => prev.map(p => {
      if (p.module !== module) return p
      const next = { ...p, [field]: !p[field] }
      if (field === 'canView' && !next.canView) next.canManage = false
      return next
    }))
  }

  async function handleSavePermissions() {
    setSavingPermissions(true)
    try {
      const { data } = await api.put(`/professional/${client.UUID}/permissions`, { permissions })
      setPermissions(data.data)
      addToast('Permissões atualizadas com sucesso', 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar permissões', 'error')
    } finally {
      setSavingPermissions(false)
    }
  }

  const openTabs = tabs.filter(t => t.Status === 'Em aberto')
  const paidTabs = tabs.filter(t => (t.Status === 'Paga' || t.Status === 'Pago') && t.Value > 0)
  const totalGasto = paidTabs.reduce((s, t) => s + t.Value, 0)
  const concludedCount = appointments.filter(a => a.Status === 'concluido').length
  const ticketMedio = concludedCount > 0 ? totalGasto / concludedCount : 0

  async function handleOpenFecharConta() {
    try {
      const { data } = await api.get(`/tab/client/${client.UUID}/account-summary`)
      setFecharConta(data)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao carregar conta do cliente', 'error')
    }
  }

  async function handleFecharConta(tabIds, orderPayments, excludedItemIds, paymentBody) {
    setFecharPaying(true)
    try {
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: tabIds,
        Payment_date: new Date().toISOString(),
        order_payments: orderPayments,
        excluded_item_ids: excludedItemIds,
        client_id: client.UUID,
        ...paymentBody,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Conta fechada com sucesso. ${extraMsg}` : 'Conta fechada com sucesso', 'success')
      setFecharConta(null)
      onReload()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao fechar conta', 'error')
    } finally {
      setFecharPaying(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex flex-col justify-end md:flex-row md:justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative z-10 w-full rounded-t-2xl md:rounded-none md:w-[460px] bg-bg md:border-l border-line flex flex-col max-h-[90vh] md:max-h-full md:h-full overflow-y-auto shadow-xl">

          {/* Alça mobile */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-line-2" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line sticky top-0 bg-bg z-10">
            <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer">
              <Icon name="x" size={18} />
            </button>
            <Avatar name={client.Name} index={0} size="sm" />
            <div className="flex-1 min-w-0">
              <h4 className="font-display font-medium text-[15px] tracking-tight truncate">{client.Name}</h4>
              <p className="font-mono text-[11px] text-ink-3">{client.Phone ?? '—'}</p>
            </div>
            <Chip variant={client.active ? 'success' : 'danger'}>{client.active ? 'Ativo' : 'Inativo'}</Chip>
            <button
              onClick={() => setEditing((v) => !v)}
              className="md:hidden p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              title={client.Role === 'Profissional' ? 'Editar profissional' : 'Editar cliente'}
            >
              <Icon name="edit" size={16} />
            </button>
          </div>

          {editing ? (
            <div className="px-5 py-5 flex flex-col gap-4">
              <Input
                label="Nome completo"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                error={editErrors.name}
              />
              <Input
                label="Telefone"
                placeholder="(11) 9 9999-9999"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                error={editErrors.phone}
              />
              <Input
                label="Data de nascimento"
                type="date"
                value={editForm.birthday}
                onChange={(e) => setEditForm((f) => ({ ...f, birthday: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="md" onClick={() => setEditing(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button variant="primary" size="md" onClick={handleSaveEdit} loading={savingEdit} className="flex-1">
                  Salvar
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="px-5 py-5 flex flex-col gap-6 animate-pulse">
              {/* KPI skeleton */}
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-surface border border-line rounded-xl p-3 flex flex-col items-center gap-2">
                    <div className="h-6 w-14 bg-line-2 rounded" />
                    <div className="h-2.5 w-16 bg-line-2 rounded" />
                  </div>
                ))}
              </div>
              {/* Rows skeleton */}
              <div className="space-y-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-line-2">
                    <div className="flex flex-col gap-1.5">
                      <div className="h-3 w-32 bg-line-2 rounded" />
                      <div className="h-2.5 w-24 bg-line-2 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-line-2 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 flex flex-col gap-6">

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface border border-line rounded-xl p-3 text-center">
                  <div className="font-serif text-[24px] font-light leading-none text-ink">{concludedCount}</div>
                  <div className="text-[11px] text-ink-3 mt-1.5">Atendimentos</div>
                </div>
                <div className="bg-surface border border-line rounded-xl p-3 text-center">
                  <div className="font-serif text-[20px] font-light leading-none text-brand truncate px-1"><MoneyValue>{formatCurrency(totalGasto)}</MoneyValue></div>
                  <div className="text-[11px] text-ink-3 mt-1.5">Total gasto</div>
                </div>
                <div className="bg-surface border border-line rounded-xl p-3 text-center">
                  <div className="font-serif text-[20px] font-light leading-none text-ink truncate px-1"><MoneyValue>{formatCurrency(ticketMedio)}</MoneyValue></div>
                  <div className="text-[11px] text-ink-3 mt-1.5">Ticket médio</div>
                </div>
              </div>

              {/* Mensalidade pendente */}
              {mensalistaData && mensalistaData.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-[13.5px]">Mensalidade pendente</h5>
                    <span className="font-mono text-[11px] text-warning"><MoneyValue>{formatCurrency(mensalistaData.total)}</MoneyValue></span>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {mensalistaData.items.map(item => (
                      <div key={item.uuid} className="flex items-center justify-between bg-warning-soft border border-warning/20 rounded-lg px-3 py-2 text-[13px]">
                        <span className="text-ink-2 truncate">{item.servico}</span>
                        <span className="font-mono font-medium text-ink shrink-0 ml-2"><MoneyValue>{formatCurrency(item.gross_amount)}</MoneyValue></span>
                      </div>
                    ))}
                  </div>
                  <Button variant="primary" size="sm" className="w-full justify-center" onClick={() => setMensalistaModal(true)}>
                    <Icon name="cash" size={13} />Pagar mensalidade
                  </Button>
                </div>
              )}

              {/* Crédito do cliente */}
              {client.Role === 'Usuario' && credit && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-[13.5px]">Crédito do cliente</h5>
                    <span className={`font-serif text-[18px] font-light leading-none ${credit.balance > 0 ? 'text-brand' : 'text-ink-3'}`}>
                      <MoneyValue>{formatCurrency(credit.balance)}</MoneyValue>
                    </span>
                  </div>
                  {credit.data.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {credit.data.slice(0, 3).map(t => (
                        <CreditRow key={t.UUID} t={t} />
                      ))}
                    </div>
                  )}
                  {credit.data.length > 3 && (
                    <button
                      onClick={() => setCreditHistoryModal(true)}
                      className="text-[12px] text-ink-3 hover:text-brand transition-colors mb-3 cursor-pointer"
                    >
                      Ver histórico completo ({credit.data.length})
                    </button>
                  )}
                  {viewerIsAdmin && (
                    <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => setCreditModal(true)}>
                      <Icon name="cash" size={13} />Ajustar crédito
                    </Button>
                  )}
                </div>
              )}

              {/* Comandas em aberto */}
              {openTabs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-[13.5px]">Comandas em aberto</h5>
                    <span className="text-[11px] font-mono text-warning">{openTabs.length} aberta{openTabs.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    {openTabs.map(t => (
                      <div key={t.UUID} className="flex items-center justify-between bg-warning-soft border border-warning/20 rounded-lg px-3 py-2.5 text-[13px]">
                        <span className="text-ink-2">
                          {t.Appointment
                            ? t.Appointment.Service
                              ? `${t.Appointment.Service} · ${t.Appointment.Start_time?.slice(0, 5) ?? '—'}`
                              : `Atendimento combinado · ${t.Appointment.Start_time?.slice(0, 5) ?? '—'}`
                            : `Pacote${t.Package?.Name ? `: ${t.Package.Name}` : ''}`}
                        </span>
                        <span className="font-mono font-medium text-ink"><MoneyValue>{formatCurrency(t.Value)}</MoneyValue></span>
                      </div>
                    ))}
                  </div>
                  <Button variant="primary" size="sm" className="w-full justify-center" onClick={handleOpenFecharConta}>
                    <Icon name="cash" size={13} />Fechar conta
                  </Button>
                </div>
              )}

              {/* Pacotes */}
              {combos.length > 0 && (
                <div>
                  <h5 className="font-medium text-[13.5px] mb-3">Pacotes</h5>
                  <div className="flex flex-col gap-3 mb-1">
                    {combos.map(c => (
                      <ComboCard
                        key={c.UUID}
                        combo={c}
                        compact
                        onConclude={handleConcludePackage}
                        concluding={concludingPackageId === c.UUID}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Últimos agendamentos */}
              <div>
                <h5 className="font-medium text-[13.5px] mb-3">Últimos agendamentos</h5>
                {appointments.length === 0 ? (
                  <p className="text-[13px] text-ink-3">Nenhum agendamento registrado.</p>
                ) : (
                  <div>
                    {appointments.slice(0, 5).map(row => (
                      <div key={row.UUID} className="flex items-center justify-between py-2.5 border-b border-line-2 last:border-0">
                        <div>
                          <div className="text-[13px] font-medium">{row.Service ?? '—'}</div>
                          <div className="text-[11.5px] text-ink-3">{formatDate(row.Date)} · {row.Professional ?? '—'}</div>
                        </div>
                        <Chip status={row.Status} dot>{STATUS_LABELS[row.Status] ?? row.Status}</Chip>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Permissões por módulo */}
              {PERMISSION_MODULES[client.Role] && viewerIsAdmin && permissions && (
                <div>
                  <h5 className="font-medium text-[13.5px] mb-3">Permissões</h5>
                  <div className="space-y-2 mb-3">
                    {PERMISSION_MODULES[client.Role].map(({ key, label }) => {
                      const perm = permissions.find(p => p.module === key)
                      return (
                        <div key={key} className="flex items-center justify-between bg-surface border border-line rounded-lg px-3 py-2 text-[13px]">
                          <span className="text-ink-2">{label}</span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[12px] text-ink-3 cursor-pointer">
                              <input type="checkbox" aria-label={`${label}: visualizar`} checked={perm?.canView ?? true} onChange={() => togglePermission(key, 'canView')} />
                              Visualizar
                            </label>
                            <label className="flex items-center gap-1.5 text-[12px] text-ink-3 cursor-pointer">
                              <input
                                type="checkbox"
                                aria-label={`${label}: gerenciar`}
                                checked={perm?.canManage ?? true}
                                disabled={!(perm?.canView ?? true)}
                                onChange={() => togglePermission(key, 'canManage')}
                              />
                              Gerenciar
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <Button variant="outline" size="sm" className="w-full justify-center" onClick={handleSavePermissions} loading={savingPermissions}>
                    Salvar permissões
                  </Button>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="hidden md:flex justify-center">
                <Icon name="edit" size={13} />
                {client.Role === 'Profissional' ? 'Editar profissional' : 'Editar cliente'}
              </Button>

              {viewerIsAdmin && (
                <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} className="justify-center">
                  <Icon name="lock" size={13} />
                  Redefinir senha
                </Button>
              )}

              {client.Role === 'Usuario' && viewerIsAdmin && (
                <Button variant="outline" size="sm" onClick={() => setConfirmInvite(true)} className="justify-center">
                  <Icon name="plus" size={13} />
                  Convidar para a equipe
                </Button>
              )}

            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleResetPassword}
        title="Redefinir senha"
        message={`A senha de ${client.Name} será redefinida para 12345678. No próximo login, será exigida a troca de senha.`}
        confirmLabel="Redefinir"
        loading={resetting}
      />

      <Modal
        isOpen={confirmInvite}
        onClose={() => setConfirmInvite(false)}
        onConfirm={handleInviteToTeam}
        title="Convidar para a equipe"
        message={`${client.Name} vai receber o convite no app e no WhatsApp. Ao aceitar, passa a ser profissional do salão — o histórico como cliente continua.`}
        confirmLabel="Enviar convite"
        loading={inviting}
      />

      {fecharConta && (
        <ModalFecharConta
          client={fecharConta}
          paying={fecharPaying}
          onClose={() => setFecharConta(null)}
          onConfirm={handleFecharConta}
        />
      )}

      {mensalistaModal && mensalistaData && (
        <ModalPagarMensalidade
          client={{ client_id: client.UUID, client_name: client.Name }}
          items={mensalistaData.items}
          total={mensalistaData.total}
          onClose={() => setMensalistaModal(false)}
          onSuccess={() => { setMensalistaModal(false); onReload() }}
        />
      )}

      {creditModal && (
        <ModalAjustarCredito
          client={client}
          balance={credit?.balance ?? 0}
          onClose={() => setCreditModal(false)}
          onSuccess={() => { setCreditModal(false); loadCredit(); onReload() }}
        />
      )}

      {creditHistoryModal && credit && (
        <ModalHistoricoCredito
          client={client}
          credit={credit}
          onClose={() => setCreditHistoryModal(false)}
        />
      )}
    </>
  )
}

function CreditRow({ t }) {
  return (
    <div className="flex items-center justify-between bg-surface border border-line rounded-lg px-3 py-2 text-[13px]">
      <div className="min-w-0">
        <div className="text-ink-2 truncate">{CREDIT_TYPE_LABEL[t.Type] ?? t.Type}</div>
        <div className="text-[11px] text-ink-3 truncate">
          {formatDate(t.Created_at)}{t.Note ? ` · ${t.Note}` : ''}
        </div>
      </div>
      <span className={`font-mono font-medium shrink-0 ml-2 ${t.Amount >= 0 ? 'text-success' : 'text-danger'}`}>
        {t.Amount >= 0 ? '+' : ''}<MoneyValue>{formatCurrency(t.Amount)}</MoneyValue>
      </span>
    </div>
  )
}

function ModalHistoricoCredito({ client, credit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-xl w-full max-w-md shadow-md border border-line mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3">
          <div>
            <h3 className="font-display font-medium text-lg tracking-tight">Histórico de crédito</h3>
            <p className="text-[12px] text-ink-3 mt-0.5">{client.Name}</p>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto space-y-1.5">
          {credit.data.map(t => (
            <CreditRow key={t.UUID} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModalAjustarCredito({ client, balance, onClose, onSuccess }) {
  const { addToast } = useToast()
  const [type, setType] = useState('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const parsed = Number(amount.replace(',', '.'))
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError('Informe um valor maior que zero')
      return
    }
    if (type === 'remove' && parsed > balance) {
      setError(`O cliente só tem ${formatCurrency(balance)} de crédito`)
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post(`/users/${client.UUID}/credit-adjustment`, {
        amount: type === 'add' ? parsed : -parsed,
        note: note.trim() || undefined,
      })

      if (data.fiado_offset) {
        const { amount: offset, fiado_before, fiado_after } = data.fiado_offset
        const sobra = parsed - offset
        addToast(
          `${formatCurrency(offset)} abateram o fiado em aberto (${formatCurrency(fiado_before)} → ${formatCurrency(fiado_after)})`
          + (sobra > 0 ? `. Os ${formatCurrency(sobra)} restantes viraram crédito.` : '. Nenhum crédito foi gerado — tudo foi usado para quitar o fiado.'),
          'success'
        )
      } else {
        addToast(type === 'add' ? 'Crédito adicionado com sucesso' : 'Crédito removido com sucesso', 'success')
      }
      onSuccess()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao ajustar crédito', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-xl p-6 w-full max-w-sm shadow-md border border-line mx-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-display font-medium text-lg tracking-tight">Ajustar crédito</h3>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <p className="text-[12px] text-ink-3 mb-4">
          Saldo atual de {client.Name}: <span className="font-mono text-ink-2"><MoneyValue>{formatCurrency(balance)}</MoneyValue></span>
        </p>

        <div className="flex gap-1.5 mb-4">
          {[
            { key: 'add', label: 'Adicionar' },
            { key: 'remove', label: 'Remover' },
          ].map(o => (
            <button
              key={o.key}
              onClick={() => { setType(o.key); setError('') }}
              className={`flex-1 px-3 py-1.5 rounded-full text-[12.5px] font-medium border cursor-pointer transition-colors
                ${type === o.key ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Valor (R$)"
            placeholder="0,00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError('') }}
            error={error}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Observação (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ex: cortesia por atraso no atendimento"
              className="w-full px-[14px] py-[10px] rounded-md border border-line bg-surface text-ink-2 font-body text-[13px]
                         placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2.5 justify-end mt-5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            {type === 'add' ? 'Adicionar crédito' : 'Remover crédito'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsuarios() {
  const { user } = useAuthStore()
  // Ativar/desativar é só do Admin (a conta de serviço também usa esta tela)
  const isAdmin = useSalonStore(s => s.role) === 'Admin'
  const { can } = usePermission()
  const { addToast } = useToast()

  const [roleFilter, setRoleFilter] = useState('Todos')
  const [extraFilter, setExtraFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [openTabClientIds, setOpenTabClientIds] = useState(new Set())
  const [toggleTarget, setToggleTarget] = useState(null)
  const [toggling, setToggling] = useState(false)

  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedMensalistaData, setSelectedMensalistaData] = useState(null)
  const [mensalistaClients, setMensalistaClients] = useState([])
  const [, setMensalistaLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const mensalistaClientIds = new Set(mensalistaClients.map(c => c.client_id))

  // stable dep keys for id-based filters (only computed when relevant)
  const mensalistaIdsKey = extraFilter === 'mensalista' ? [...mensalistaClientIds].sort().join(',') : ''
  const openTabIdsKey = extraFilter === 'comanda_aberta' ? [...openTabClientIds].sort().join(',') : ''

  const { items: filtered, loading, loadingMore, hasMore, reload, loadMore } = usePaginatedList(
    (page, limit) => {
      const params = { page, limit }
      if (roleFilter !== 'Todos') params.Role = ROLE_FILTER_API[roleFilter] ?? roleFilter
      if (debouncedSearch) params.search = debouncedSearch
      if (extraFilter === 'ativo') params.active = true
      if (extraFilter === 'inativo') params.active = false
      if (extraFilter === 'aniversariante') params.birthday_month = new Date().getMonth() + 1
      if (extraFilter === 'mensalista') params.ids = mensalistaIdsKey
      if (extraFilter === 'comanda_aberta') params.ids = openTabIdsKey
      return api.get('/users', { params }).then((r) => ({ ...r.data, data: excludeMonitorAdmins(r.data.data ?? []) }))
    },
    [roleFilter, debouncedSearch, extraFilter, mensalistaIdsKey, openTabIdsKey]
  )

  const { restartTour } = useTour('admin_usuarios', adminUsuariosSteps, !loading)

  // tabs: busca única, independente da paginação de usuários
  useEffect(() => {
    if (!can('Caixa', 'view')) return
    api.get('/tab', { params: { limit: 1000 } })
      .then(({ data }) => {
        const tabs = data.data ?? []
        setOpenTabClientIds(new Set(
          tabs
            .filter((t) => t.Status === 'Em aberto' && t.Appointment?.ClientId)
            .map((t) => t.Appointment.ClientId)
        ))
      })
      .catch(() => {})
  }, [])

  // mensalistas: busca única no mount
  function loadMensalistas() {
    setMensalistaLoading(true)
    api.get('/transaction/fiado-pending')
      .then(({ data }) => setMensalistaClients(data.data ?? []))
      .catch(() => setMensalistaClients([]))
      .finally(() => setMensalistaLoading(false))
  }
  useEffect(() => {
    if (can('Mensalistas', 'view')) loadMensalistas()
    else setMensalistaLoading(false)
  }, [])

  // limpa filtros ao mudar aba de role
  useEffect(() => { setExtraFilter(null); setSearch('') }, [roleFilter])

  function openClient(u) {
    setSelectedClient(u)
    const m = mensalistaClients.find(c => c.client_id === u.UUID)
    setSelectedMensalistaData(m ?? null)
  }

  async function handleToggleActive() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      await api.patch(`/users/${toggleTarget.UUID}`, { active: !toggleTarget.active })
      addToast(
        toggleTarget.active ? `${toggleTarget.Name} desativado` : `${toggleTarget.Name} ativado`,
        'success'
      )
      setToggleTarget(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar cliente', 'error')
    } finally {
      setToggling(false)
    }
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'
    if (!/^\(\d{2}\) \d \d{4}-\d{4}$/.test(form.phone)) errs.phone = 'Telefone inválido. Ex: (11) 9 9999-9999'
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), phone: form.phone }
      if (form.birthday) body.birthday = form.birthday
      await api.post('/auth/register-admin', body)
      addToast(`${form.name} cadastrado com sucesso`, 'success')
      setDrawerOpen(false)
      setForm(EMPTY_FORM)
      setFormErrors({})
      reload()
    } catch (err) {
      const msg = err.response?.data?.error
      if (msg?.includes('Telefone')) {
        setFormErrors({ phone: 'Telefone já cadastrado' })
      } else {
        addToast(msg || 'Erro ao cadastrar cliente', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  function handlePhoneChange(e) {
    setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))
  }

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex justify-between items-end mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Clientes</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Gerencie clientes, profissionais e administradores</p>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
        <Button data-tour="usuarios-novo" variant="primary" size="sm" onClick={() => { setForm(EMPTY_FORM); setFormErrors({}); setDrawerOpen(true) }}>
          <Icon name="plus" size={14} />
          Novo cliente
        </Button>
      </div>

      {/* Filtro de role */}
      <div data-tour="usuarios-filtro" className="flex gap-1.5 mb-3 flex-wrap">
        {ROLE_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${roleFilter === r ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Busca — sempre visível */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          placeholder="Buscar por nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-[38px] pl-8 pr-3 rounded-md border border-line bg-surface text-ink-2 font-body text-[13px]
                     placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
        />
      </div>

      {/* Filtros extras */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {CLIENT_EXTRA_FILTERS
          .filter((f) => f.key !== 'mensalista' || can('Mensalistas', 'view'))
          .filter((f) => f.key !== 'comanda_aberta' || can('Caixa', 'view'))
          .map((f) => (
          <button
            key={f.key}
            onClick={() => setExtraFilter((prev) => (prev === f.key ? null : f.key))}
            className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${extraFilter === f.key ? 'bg-brand text-bg border-brand' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}
          >
            {f.label}
            {f.key === 'mensalista' && mensalistaClients.length > 0 && (
              <span className={`ml-1.5 text-[10px] font-mono ${extraFilter === f.key ? 'text-bg/70' : 'text-ink-4'}`}>
                {mensalistaClients.length}
              </span>
            )}
            {f.key === 'comanda_aberta' && openTabClientIds.size > 0 && (
              <span className={`ml-1.5 text-[10px] font-mono ${extraFilter === f.key ? 'text-bg/70' : 'text-ink-4'}`}>
                {openTabClientIds.size}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          {/* Desktop skeleton */}
          <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Cliente', 'Função', 'Telefone', 'Nascimento', 'Status', ''].map((h) => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
          {/* Mobile skeleton */}
          <div className="flex flex-col gap-2 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
      ) : filtered.length === 0 ? (
        <EmptyState icon="users" title="Nenhum resultado" description="Nenhum usuário encontrado com os filtros selecionados." />
      ) : (
        <>
          {/* Desktop table */}
          <div data-tour="usuarios-lista" className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Cliente', 'Função', 'Telefone', 'Nascimento', 'Status', ''].map((h) => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr
                    key={u.UUID}
                    onClick={() => openClient(u)}
                    className="hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.Name} index={idx} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium">{u.Name}</span>
                            {isBirthdayThisMonth(u.Birthday) && (
                              <span className="text-[12px]" title="Aniversariante do mês">🎂</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-ink-3">{u.Phone ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <Chip variant={ROLE_CHIP[u.Role] ?? 'default'}>{ROLE_LABEL[u.Role] ?? u.Role}</Chip>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[12px] text-ink-2 border-b border-line-2">{u.Phone ?? '—'}</td>
                    <td className="px-3.5 py-3 font-mono text-[12px] text-ink-2 border-b border-line-2">{formatBirthday(u.Birthday)}</td>
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <Chip variant={u.active ? 'success' : 'danger'}>{u.active ? 'Ativo' : 'Inativo'}</Chip>
                    </td>
                    <td className="px-3.5 py-3 text-right border-b border-line-2">
                      {isAdmin && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setToggleTarget(u) }}>
                        <Icon name={u.active ? 'lock' : 'check'} size={13} />
                        {u.active ? 'Desativar' : 'Ativar'}
                      </Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((u, idx) => (
              <div
                key={u.UUID}
                onClick={() => openClient(u)}
                className="bg-surface border border-line rounded-xl p-4 cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={u.Name} index={idx} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-[14px] truncate">{u.Name}</span>
                      {isBirthdayThisMonth(u.Birthday) && (
                        <span className="text-[12px] shrink-0" title="Aniversariante do mês">🎂</span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-ink-3 truncate">{u.Phone ?? '—'}</div>
                  </div>
                  <Chip variant={u.active ? 'success' : 'danger'}>{u.active ? 'Ativo' : 'Inativo'}</Chip>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Chip variant={ROLE_CHIP[u.Role] ?? 'default'}>{ROLE_LABEL[u.Role] ?? u.Role}</Chip>
                    {u.Phone && <span className="font-mono text-[11px] text-ink-3">{u.Phone}</span>}
                  </div>
                  {isAdmin && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setToggleTarget(u) }}>
                    <Icon name={u.active ? 'lock' : 'check'} size={13} />
                    {u.active ? 'Desativar' : 'Ativar'}
                  </Button>}
                </div>
              </div>
            ))}
          </div>

          {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
        </>
      )}

      {/* Painel de detalhes do cliente */}
      {selectedClient && (
        <ClientePanel
          client={selectedClient}
          onClose={() => { setSelectedClient(null); setSelectedMensalistaData(null) }}
          onReload={() => { reload(); loadMensalistas() }}
          mensalistaData={selectedMensalistaData}
        />
      )}

      {/* Modal ativar/desativar */}
      <Modal
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleTarget?.active ? 'Desativar cliente' : 'Ativar cliente'}
        message={
          toggleTarget?.active
            ? `${toggleTarget?.Name} não conseguirá mais fazer login após ser desativado.`
            : `${toggleTarget?.Name} voltará a ter acesso ao sistema.`
        }
        confirmLabel={toggleTarget?.active ? 'Desativar' : 'Ativar'}
        loading={toggling}
      />

      {/* Drawer — cadastro manual */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface shadow-xl
                          md:inset-y-0 md:right-0 md:left-auto md:w-[400px] md:rounded-none md:border-l md:border-line">

            {/* alça mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-line-2" />
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <span className="font-display font-medium text-[15px]">Novo cliente</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-md text-ink-3 hover:bg-surface-2 transition-colors">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="p-5 md:p-7 flex flex-col gap-4">
              <Input
                label="Nome completo"
                placeholder="Maria da Silva"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={formErrors.name}
              />
              <Input
                label="Telefone"
                placeholder="(11) 9 9999-9999"
                value={form.phone}
                onChange={handlePhoneChange}
                error={formErrors.phone}
              />
              <Input
                label="Data de nascimento (opcional)"
                type="date"
                value={form.birthday}
                onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
              />

              <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
                <p className="text-[12px] text-ink-3 font-body">
                  A senha inicial será <span className="font-mono font-medium text-ink-2">12345678</span>. O usuário poderá alterá-la após o primeiro acesso.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="md" onClick={() => setDrawerOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button variant="primary" size="md" onClick={handleSave} loading={saving} className="flex-1">
                  Cadastrar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}
