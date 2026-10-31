import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { PLANS } from '@/config/plans'
import PaginationControls from '@/components/ui/PaginationControls'
import EmptyState from '@/components/ui/EmptyState'
import {
  planLabel, durationLabel, daysLeftLabel, SituationBadge, OriginBadge, SITUATION_OPTIONS, selectCls, SkeletonRows, SidePanel,
} from './shared'

const LIMIT = 25
const SORTS = [
  { id: 'created', label: 'Mais recentes' },
  { id: 'expires', label: 'Vencimento mais próximo' },
  { id: 'name', label: 'Nome (A–Z)' },
]
const PAYMENT_STATUS = { pending: 'Pendente', paid: 'Pago', expired: 'Expirado', duplicate: 'Duplicado (reembolsar)' }
const PAYMENT_KIND = { first: 'Primeiro pagamento', renewal: 'Renovação', upgrade: 'Upgrade' }

const professionalsLabel = (s) => `${s.professionals}${s.professionalLimit != null ? `/${s.professionalLimit}` : ''}`
const daysTone = (days) => (days == null ? 'text-ink-3' : days <= 0 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-ink-2')

function PlanCell({ s }) {
  return (
    <>
      <span className="text-ink">{s.plan ? planLabel(s.plan) : '—'}</span>
      {s.plan && <span className="text-ink-3"> · {durationLabel(s.billingMonths)}</span>}
    </>
  )
}

function ExpiresCell({ s }) {
  return (
    <>
      <span className="text-ink-2">{s.endsAt ? formatDate(s.endsAt) : '—'}</span>
      {s.endsAt && <span className={`block text-[11px] ${daysTone(s.daysLeft)}`}>{daysLeftLabel(s.daysLeft)}{s.cancelAtPeriodEnd ? ' · cancelando' : ''}</span>}
    </>
  )
}

export default function SistemaSaloes({ onOpenErrors }) {
  const [filters, setFilters] = useState({ search: '', situation: '', plan: '', sort: 'created' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)
  const [openId, setOpenId] = useState(null)

  // Busca com pequena espera para não chamar a API a cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setFilters(f => ({ ...f, search })); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let alive = true
    setResult(null)
    setFailed(false)
    const params = { page, limit: LIMIT, sort: filters.sort }
    if (filters.search) params.search = filters.search
    if (filters.situation) params.situation = filters.situation
    if (filters.plan) params.plan = filters.plan
    platformApi.get('/system/salons', { params })
      .then(r => { if (alive) setResult(r.data) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [filters, page])

  const setFilter = (key) => (e) => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1) }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar salão, slug ou dono"
          aria-label="Buscar salão" className={`${selectCls} flex-1 min-w-[200px]`} />
        <select value={filters.situation} onChange={setFilter('situation')} aria-label="Situação" className={selectCls}>
          <option value="">Todas as situações</option>
          {SITUATION_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={filters.plan} onChange={setFilter('plan')} aria-label="Plano" className={selectCls}>
          <option value="">Todos os planos</option>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value="none">Sem plano</option>
        </select>
        <select value={filters.sort} onChange={setFilter('sort')} aria-label="Ordenar" className={selectCls}>
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {failed ? <p className="text-sm text-danger">Não foi possível carregar os salões.</p>
        : !result ? <SkeletonRows />
        : result.data.length === 0 ? <EmptyState icon="search" title="Nenhum salão encontrado" />
        : (
          <>
            <p className="text-[11.5px] text-ink-3 mb-2">{result.total} salão(ões)</p>

            {/* Desktop: tabela */}
            <div className="hidden md:block rounded-lg border border-line bg-surface overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-ink-3 border-b border-line">
                    <th className="font-medium px-3 py-2.5">Salão</th>
                    <th className="font-medium px-3 py-2.5">Situação</th>
                    <th className="font-medium px-3 py-2.5">Plano</th>
                    <th className="font-medium px-3 py-2.5">Vencimento</th>
                    <th className="font-medium px-3 py-2.5 text-right">Clientes</th>
                    <th className="font-medium px-3 py-2.5 text-right">Profissionais</th>
                    <th className="font-medium px-3 py-2.5 text-right">Agend. 30d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.data.map(s => (
                    <tr key={s.id} onClick={() => setOpenId(s.id)} className="hover:bg-surface-2 cursor-pointer">
                      <td className="px-3 py-2.5">
                        <button className="text-left cursor-pointer" aria-label={`Ver ${s.name}`}>
                          <span className="block text-ink font-medium">{s.name}</span>
                          <span className="block text-[11px] text-ink-3">{s.owner?.name ?? 'Sem dono'}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5"><SituationBadge situation={s.situation} /></td>
                      <td className="px-3 py-2.5"><PlanCell s={s} /></td>
                      <td className="px-3 py-2.5"><ExpiresCell s={s} /></td>
                      <td className="px-3 py-2.5 text-right text-ink-2">{s.clients}</td>
                      <td className="px-3 py-2.5 text-right text-ink-2">{professionalsLabel(s)}</td>
                      <td className="px-3 py-2.5 text-right text-ink-2">{s.appointments30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <div className="md:hidden space-y-2">
              {result.data.map(s => (
                <button key={s.id} onClick={() => setOpenId(s.id)} aria-label={`Ver ${s.name}`}
                  className="w-full text-left rounded-lg border border-line bg-surface p-3.5 cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-sm text-ink font-medium">{s.name}</span>
                    <SituationBadge situation={s.situation} />
                  </div>
                  <p className="text-[12px]"><PlanCell s={s} /></p>
                  <p className="text-[12px] text-ink-3 mt-1">
                    {s.clients} clientes · {professionalsLabel(s)} profissionais · {s.appointments30d} agend. 30d
                  </p>
                  {s.endsAt && <p className={`text-[12px] mt-1 ${daysTone(s.daysLeft)}`}>Vence {formatDate(s.endsAt)} ({daysLeftLabel(s.daysLeft)})</p>}
                </button>
              ))}
            </div>

            <PaginationControls page={page} totalPages={Math.ceil(result.total / LIMIT)} onChange={setPage} />
          </>
        )}

      {openId && <SalonDetail id={openId} onClose={() => setOpenId(null)} onOpenErrors={onOpenErrors} />}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-ink-3 mb-0.5">{label}</p>
      <div className="text-[13px] text-ink">{children ?? '—'}</div>
    </div>
  )
}

function SalonDetail({ id, onClose, onOpenErrors }) {
  const [s, setS] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    platformApi.get(`/system/salons/${id}`).then(r => setS(r.data)).catch(() => setFailed(true))
  }, [id])

  return (
    <SidePanel title={s?.name ?? 'Salão'} onClose={onClose}>
      {failed ? <p className="text-sm text-danger">Não foi possível carregar o salão.</p>
        : !s ? <SkeletonRows rows={5} />
        : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <SituationBadge situation={s.situation} />
              <span className="font-mono text-[11.5px] text-ink-3">/{s.slug}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Dono">{s.owner?.name}</Field>
              <Field label="Email do dono">{s.owner?.email}</Field>
              <Field label="Telefone do dono">{s.owner?.phone}</Field>
              <Field label="Telefone do salão">{s.phone}</Field>
              <Field label="Criado em">{formatDate(s.createdAt)}</Field>
              <Field label="Fuso">{s.timezone}</Field>
              <Field label="Plano">{s.plan ? `${planLabel(s.plan)} · ${durationLabel(s.billingMonths)}` : null}</Field>
              <Field label="Mensalidade (equivalente)">{s.monthlyCents ? formatCurrency(s.monthlyCents / 100) : null}</Field>
              <Field label={s.status === 'trial' ? 'Fim do trial' : 'Vencimento'}>
                {s.endsAt ? `${formatDate(s.endsAt)} (${daysLeftLabel(s.daysLeft)})` : null}
              </Field>
              <Field label="Cancelamento">{s.cancelAtPeriodEnd ? 'Cancela no fim do período' : 'Não'}</Field>
              <Field label="Clientes">{s.clients}</Field>
              <Field label="Profissionais ativos">{professionalsLabel(s)}</Field>
              <Field label="Contas de serviço">{s.serviceAccounts}</Field>
              <Field label="Agendamentos criados (30 dias)">{s.appointments30d}</Field>
              <Field label="Último agendamento criado">{s.lastAppointmentAt ? formatDateTime(s.lastAppointmentAt) : null}</Field>
              <Field label="WhatsApp do salão">{s.whatsapp ? 'Instância criada' : 'Não conectado'}</Field>
              {s.archivedAt && <Field label="Arquivado em">{formatDate(s.archivedAt)}</Field>}
              {s.scheduledDeletionAt && <Field label="Exclusão em">{formatDate(s.scheduledDeletionAt)}</Field>}
            </div>

            <section>
              <p className="eyebrow mb-2">Pagamentos</p>
              {s.payments.length === 0 ? <p className="text-sm text-ink-3">Nenhum pagamento.</p> : (
                <div className="rounded-lg border border-line divide-y divide-line">
                  {s.payments.map(p => (
                    <div key={p.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                      <div className="min-w-0">
                        <p className="text-ink">{PAYMENT_KIND[p.kind] ?? p.kind} · {planLabel(p.plan)} · {durationLabel(p.months)}</p>
                        <p className="text-[11px] text-ink-3">
                          {formatDate(p.paidAt ?? p.createdAt)} · {PAYMENT_STATUS[p.status] ?? p.status}
                          {p.periodEnd ? ` · cobre até ${formatDate(p.periodEnd)}` : ''}
                        </p>
                      </div>
                      <span className={p.status === 'duplicate' ? 'text-danger' : 'text-ink-2'}>{formatCurrency(p.amountCents / 100)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="eyebrow">Erros recentes</p>
                {s.errors.length > 0 && (
                  <button onClick={() => { onClose(); onOpenErrors(s.id) }} className="text-[12px] text-brand underline cursor-pointer">Ver todos</button>
                )}
              </div>
              {s.errors.length === 0 ? <p className="text-sm text-ink-3">Nenhum erro nos últimos 14 dias.</p> : (
                <div className="rounded-lg border border-line divide-y divide-line">
                  {s.errors.map(e => (
                    <div key={e.id} className="px-3 py-2.5 text-[12.5px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <OriginBadge origin={e.origin} />
                        <span className="text-[11px] text-ink-3">{formatDateTime(e.lastSeenAt)} · {e.occurrences}x</span>
                      </div>
                      <p className="text-ink truncate">{e.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
    </SidePanel>
  )
}
