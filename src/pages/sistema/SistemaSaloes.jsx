import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { PLANS, WAITLIST_DISCOUNT } from '@/config/plans'
import PaginationControls from '@/components/ui/PaginationControls'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import {
  planLabel, durationLabel, daysLeftLabel, SituationBadge, OriginBadge, SITUATION_OPTIONS, selectCls, SkeletonRows, SidePanel,
  Card, Panel, Badge, Field, MiniStat, InitialAvatar, SearchField, Toolbar, LoadError, thCls, tdCls,
} from './shared'
import SalonActions from './SalonActions'
import { useSystemWrite, errorOf } from './systemContext'
import { useToast } from '@/context/ToastContext'

const LIMIT = 25
const SORTS = [
  { id: 'created', label: 'Mais recentes' },
  { id: 'expires', label: 'Vencimento mais próximo' },
  { id: 'name', label: 'Nome (A–Z)' },
]
const PAYMENT_STATUS = { pending: 'Pendente', paid: 'Pago', expired: 'Expirado', duplicate: 'Duplicado (reembolsar)' }
const PAYMENT_TONE = { pending: 'warning', paid: 'success', expired: 'neutral', duplicate: 'danger' }
const PAYMENT_KIND = { first: 'Primeiro pagamento', renewal: 'Renovação', upgrade: 'Upgrade' }

const professionalsLabel = (s) => `${s.professionals}${s.professionalLimit != null ? `/${s.professionalLimit}` : ''}`
const daysTone = (days) => (days == null ? 'text-ink-3' : days <= 0 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-ink-3')

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
      {s.endsAt && <span className={`block text-[11px] font-medium ${daysTone(s.daysLeft)}`}>{daysLeftLabel(s.daysLeft)}{s.cancelAtPeriodEnd ? ' · cancelando' : ''}</span>}
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
  const [reloadKey, setReloadKey] = useState(0) // sobe depois de uma ação no detalhe, para a lista refletir a mudança

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
  }, [filters, page, reloadKey])

  const setFilter = (key) => (e) => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1) }
  const selectFull = `${selectCls} flex-1 sm:flex-none`

  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchField value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar salão, slug ou dono" label="Buscar salão" />
        <select value={filters.situation} onChange={setFilter('situation')} aria-label="Situação" className={selectFull}>
          <option value="">Todas as situações</option>
          {SITUATION_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={filters.plan} onChange={setFilter('plan')} aria-label="Plano" className={selectFull}>
          <option value="">Todos os planos</option>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value="none">Sem plano</option>
        </select>
        <select value={filters.sort} onChange={setFilter('sort')} aria-label="Ordenar" className={selectFull}>
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Toolbar>

      {failed ? <LoadError>Não foi possível carregar os salões.</LoadError>
        : !result ? <SkeletonRows />
        : result.data.length === 0 ? <EmptyState icon="search" title="Nenhum salão encontrado" />
        : (
          <>
            {/* Computador: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className={thCls}>Salão</th>
                    <th className={thCls}>Situação</th>
                    <th className={thCls}>Plano</th>
                    <th className={thCls}>Vencimento</th>
                    <th className={`${thCls} text-right`}>Clientes</th>
                    <th className={`${thCls} text-right`}>Profissionais</th>
                    <th className={`${thCls} text-right`}>Agend. 30d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.data.map(s => (
                    <tr key={s.id} onClick={() => setOpenId(s.id)} className="hover:bg-surface-2/70 cursor-pointer transition-colors">
                      <td className={tdCls}>
                        <button className="flex items-center gap-3 text-left cursor-pointer" aria-label={`Ver ${s.name}`}>
                          <InitialAvatar name={s.name} />
                          <span className="min-w-0">
                            <span className="block text-ink font-medium truncate max-w-[220px]">{s.name}</span>
                            <span className="block text-[11.5px] text-ink-3 truncate max-w-[220px]">{s.owner?.name ?? 'Sem dono'}</span>
                          </span>
                        </button>
                      </td>
                      <td className={tdCls}><SituationBadge situation={s.situation} /></td>
                      <td className={tdCls}><PlanCell s={s} /></td>
                      <td className={tdCls}><ExpiresCell s={s} /></td>
                      <td className={`${tdCls} text-right text-ink-2 tabular-nums`}>{s.clients}</td>
                      <td className={`${tdCls} text-right text-ink-2 tabular-nums`}>{professionalsLabel(s)}</td>
                      <td className={`${tdCls} text-right text-ink-2 tabular-nums`}>{s.appointments30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <div className="md:hidden divide-y divide-line">
              {result.data.map(s => (
                <button key={s.id} onClick={() => setOpenId(s.id)} aria-label={`Ver ${s.name}`} className="w-full text-left p-4 cursor-pointer active:bg-surface-2">
                  <div className="flex items-start gap-3">
                    <InitialAvatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-ink font-medium">{s.name}</span>
                        <SituationBadge situation={s.situation} />
                      </div>
                      <p className="text-[12px] mt-0.5"><PlanCell s={s} /></p>
                      <p className="text-[12px] text-ink-3 mt-1">
                        {s.clients} clientes · {professionalsLabel(s)} profissionais · {s.appointments30d} agend. 30d
                      </p>
                      {s.endsAt && <p className={`text-[12px] mt-1 font-medium ${daysTone(s.daysLeft)}`}>Vence {formatDate(s.endsAt)} ({daysLeftLabel(s.daysLeft)})</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-line bg-surface-2/50">
              <div className="flex items-center justify-between gap-3 text-[12px] text-ink-3">
                <span>{result.total} salão(ões)</span>
                <span className="hidden sm:inline">Clique em uma linha para ver o detalhe e as ações</span>
              </div>
              <PaginationControls page={page} totalPages={Math.ceil(result.total / LIMIT)} onChange={setPage} />
            </div>
          </>
        )}

      {openId && <SalonDetail id={openId} onClose={() => setOpenId(null)} onOpenErrors={onOpenErrors} onChanged={() => setReloadKey(k => k + 1)} />}
    </Card>
  )
}

function SalonDetail({ id, onClose, onOpenErrors, onChanged }) {
  const write = useSystemWrite()
  const { addToast } = useToast()
  const [s, setS] = useState(null)
  const [failed, setFailed] = useState(false)
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState(null)

  const load = () => platformApi.get(`/system/salons/${id}`).then(r => setS(r.data)).catch(() => setFailed(true))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const changed = () => { load(); onChanged() }

  async function grantDiscount() {
    setGranting(true)
    setGrantError(null)
    try {
      await write('post', `/system/salons/${id}/waitlist-discount`)
      await load()
      addToast('Desconto da lista de espera aplicado com sucesso.', 'success')
    } catch (e) {
      if (!e.cancelled) {
        const message = errorOf(e, 'Não foi possível aplicar o desconto.')
        setGrantError(message)
        addToast(`Falha: ${message}`, 'error')
      }
    } finally {
      setGranting(false)
    }
  }

  return (
    <SidePanel title={s?.name ?? 'Salão'} subtitle={s ? `/${s.slug}` : undefined} onClose={onClose}
      leading={s && <InitialAvatar name={s.name} size="lg" />}
      meta={s && <SituationBadge situation={s.situation} />}>
      {failed ? <LoadError>Não foi possível carregar o salão.</LoadError>
        : !s ? <SkeletonRows rows={5} />
        : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Clientes" value={s.clients} />
              <MiniStat label="Profissionais" value={professionalsLabel(s)} />
              <MiniStat label="Agend. em 30 dias" value={s.appointments30d} />
            </div>

            <SalonActions salon={s} onChanged={changed} />

            <Panel title="Assinatura">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Plano">{s.plan ? `${planLabel(s.plan)} · ${durationLabel(s.billingMonths)}` : null}</Field>
                <Field label="Mensalidade (equivalente)">{s.monthlyCents ? formatCurrency(s.monthlyCents / 100) : null}</Field>
                <Field label={s.status === 'trial' ? 'Fim do trial' : 'Vencimento'}>
                  {s.endsAt ? `${formatDate(s.endsAt)} (${daysLeftLabel(s.daysLeft)})` : null}
                </Field>
                <Field label="Cancelamento">{s.cancelAtPeriodEnd ? 'Cancela no fim do período' : 'Não'}</Field>
              </dl>
            </Panel>

            <Panel title="Responsável">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Dono">{s.owner?.name}</Field>
                <Field label="Email do dono">{s.owner?.email}</Field>
                <Field label="Telefone do dono">{s.owner?.phone}</Field>
                <Field label="Telefone do salão">{s.phone}</Field>
              </dl>
            </Panel>

            <Panel title="Detalhes">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Criado em">{formatDate(s.createdAt)}</Field>
                <Field label="Fuso">{s.timezone}</Field>
                <Field label="Contas de serviço">{s.serviceAccounts}</Field>
                <Field label="WhatsApp do salão">{s.whatsapp ? 'Instância criada' : 'Não conectado'}</Field>
                <Field label="Último agendamento criado">{s.lastAppointmentAt ? formatDateTime(s.lastAppointmentAt) : null}</Field>
                {s.archivedAt && <Field label="Arquivado em">{formatDate(s.archivedAt)}</Field>}
                {s.scheduledDeletionAt && <Field label="Exclusão em">{formatDate(s.scheduledDeletionAt)}</Field>}
              </dl>
            </Panel>

            <Panel title="Lista de espera">
              {s.discount.source ? (
                <p className="text-[13px] text-ink">
                  {s.discount.source === 'manual' ? 'Desconto dado à mão' : 'Inscrito na lista (telefone bateu)'} ·{' '}
                  {s.discount.monthsLeft > 0 ? `${s.discount.monthsLeft} de ${WAITLIST_DISCOUNT.months} mensalidades com desconto restantes` : 'desconto já usado'}
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-ink-3 flex-1 min-w-[200px]">Sem desconto. Use se o dono se inscreveu com outro telefone.</p>
                  <Button variant="outline" size="sm" loading={granting} onClick={grantDiscount}>
                    Aplicar desconto da lista de espera
                  </Button>
                </div>
              )}
              {grantError && <p role="alert" className="mt-2 text-[12.5px] text-danger">{grantError}</p>}
            </Panel>

            <Panel title="Pagamentos" flush>
              {s.payments.length === 0 ? <p className="px-5 py-5 text-sm text-ink-3">Nenhum pagamento.</p> : (
                <div className="divide-y divide-line">
                  {s.payments.map(p => (
                    <div key={p.id} className="px-5 py-3.5 flex items-start justify-between gap-3 text-[12.5px]">
                      <div className="min-w-0">
                        <p className="text-ink font-medium">{PAYMENT_KIND[p.kind] ?? p.kind} · {planLabel(p.plan)} · {durationLabel(p.months)}</p>
                        <p className="text-[11.5px] text-ink-3 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge tone={PAYMENT_TONE[p.status] ?? 'neutral'}>{PAYMENT_STATUS[p.status] ?? p.status}</Badge>
                          <span>{formatDate(p.paidAt ?? p.createdAt)}{p.periodEnd ? ` · cobre até ${formatDate(p.periodEnd)}` : ''}</span>
                        </p>
                      </div>
                      <span className={`text-right font-medium tabular-nums ${p.status === 'duplicate' ? 'text-danger' : 'text-ink'}`}>
                        {formatCurrency(p.amountCents / 100)}
                        {p.discountCents > 0 && <span className="block text-[11px] font-normal text-ink-3">desconto lista: {formatCurrency(p.discountCents / 100)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Erros recentes" flush
              action={s.errors.length > 0 && (
                <button onClick={() => { onClose(); onOpenErrors(s.id) }} className="text-[12px] text-brand font-medium hover:underline cursor-pointer">Ver todos</button>
              )}>
              {s.errors.length === 0 ? <p className="px-5 py-5 text-sm text-ink-3">Nenhum erro nos últimos 14 dias.</p> : (
                <div className="divide-y divide-line">
                  {s.errors.map(e => (
                    <div key={e.id} className="px-5 py-3 text-[12.5px]">
                      <div className="flex items-center gap-2 mb-1">
                        <OriginBadge origin={e.origin} />
                        <span className="text-[11px] text-ink-3">{formatDateTime(e.lastSeenAt)} · {e.occurrences}x</span>
                      </div>
                      <p className="text-ink truncate">{e.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
    </SidePanel>
  )
}
