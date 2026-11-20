import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import Icon from '@/components/ui/Icons'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/format'
import { planLabel, durationLabel, Card, Panel, StatCard, TONES, LoadError } from './shared'

// Uma pendência: ícone colorido + texto + quantidade. Com `onClick` leva para a aba certa.
function AttentionRow({ icon, tone, label, count, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left ${onClick ? 'cursor-pointer hover:bg-surface-2 transition-colors' : ''}`}>
      <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${TONES[tone].soft}`}><Icon name={icon} size={17} /></span>
      <span className="flex-1 text-[13.5px] text-ink">{label}</span>
      <span className="font-display text-[18px] font-semibold text-ink tabular-nums">{count}</span>
      {onClick && <Icon name="chevronRight" size={14} className="text-ink-4" />}
    </Tag>
  )
}

function ErrorSide({ label, occurrences, groups }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[12.5px] text-ink-3 mb-2">{label}</p>
      <p className={`font-display text-[30px] font-semibold tracking-tight leading-none tabular-nums ${occurrences ? 'text-danger' : 'text-ink'}`}>{occurrences}</p>
      <p className="text-[11.5px] text-ink-3 mt-2">{groups} erro(s) diferente(s)</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="h-[200px] rounded-xl bg-surface-3" />
        <div className="h-[200px] rounded-xl bg-surface-2 lg:col-span-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[112px] rounded-xl bg-surface-2" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-[170px] rounded-xl bg-surface-2" />
        <div className="h-[170px] rounded-xl bg-surface-2" />
      </div>
    </div>
  )
}

export default function SistemaResumo({ onGo }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    platformApi.get('/system/summary').then(r => setData(r.data)).catch(() => setFailed(true))
  }, [])

  if (failed) return <Card><LoadError>Não foi possível carregar o resumo.</LoadError></Card>
  if (!data) return <Skeleton />

  const { salons, errors24h } = data
  const errorTotal = errors24h.backend.occurrences + errors24h.frontend.occurrences
  const duplicates = data.duplicatePayments.length

  const attention = [
    { icon: 'clock', tone: 'warning', label: 'Trials vencendo em 7 dias', count: data.trialsEnding7d, go: 'saloes' },
    { icon: 'cash', tone: 'warning', label: 'Assinaturas vencendo em 7 dias', count: data.plansEnding7d, go: 'saloes' },
    { icon: 'ban', tone: 'danger', label: 'Salões suspensos', count: salons.suspended, go: 'saloes' },
    { icon: 'card', tone: 'danger', label: 'Pagamentos PIX duplicados para reembolsar', count: duplicates },
    { icon: 'alertTriangle', tone: 'danger', label: 'Erros registrados nas últimas 24h', count: errorTotal, go: 'erros' },
    { icon: 'repeat', tone: 'neutral', label: 'Cancelando no fim do período', count: data.cancelingAtPeriodEnd, go: 'saloes' },
  ].filter(a => a.count > 0)

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Receita em destaque */}
        <div className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-brand to-brand-dark text-brand-ink shadow-sm flex flex-col">
          <div className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 rounded-full bg-brand-ink/[0.08]" />
          <div className="pointer-events-none absolute -right-4 -bottom-14 w-40 h-40 rounded-full bg-gold/20" />
          <div className="relative flex-1">
            <div className="flex items-center gap-2 text-[12.5px] text-brand-ink/80 font-medium">
              <span className="w-7 h-7 rounded-md bg-brand-ink/15 grid place-items-center"><Icon name="trendingUp" size={15} /></span>
              Receita mensal (MRR)
            </div>
            <p className="font-display text-[40px] font-semibold tracking-tight leading-none mt-5">{formatCurrency(data.mrrCents / 100)}</p>
            <p className="text-[12px] text-brand-ink/70 mt-2.5">Equivalente mensal dos planos ativos</p>
          </div>
          <div className="relative mt-6 pt-4 border-t border-brand-ink/15 flex items-center justify-between text-[13px]">
            <span className="text-brand-ink/80">Novos salões no mês</span>
            <span className="font-display text-[18px] font-semibold tabular-nums">+{salons.newThisMonth}</span>
          </div>
        </div>

        {/* O que precisa de atenção */}
        <Panel title="Precisa de atenção" flush className="lg:col-span-2"
          action={attention.length > 0 && <span className="text-[11.5px] text-ink-3">{attention.length} {attention.length === 1 ? 'item' : 'itens'}</span>}>
          {attention.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-10">
              <span className={`w-11 h-11 rounded-full grid place-items-center mb-3 ${TONES.success.soft}`}><Icon name="check" size={20} /></span>
              <p className="text-[14px] font-medium text-ink">Tudo em dia</p>
              <p className="text-[12.5px] text-ink-3 mt-1">Nenhum vencimento próximo, suspensão ou erro nas últimas 24h.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {attention.map(a => <AttentionRow key={a.label} {...a} onClick={a.go ? () => onGo(a.go) : undefined} />)}
            </div>
          )}
        </Panel>
      </div>

      {/* Situação dos salões */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="store" tone="success" label="Ativos (pagando)" value={salons.active} onClick={() => onGo('saloes')}
          hint={data.cancelingAtPeriodEnd ? `${data.cancelingAtPeriodEnd} cancelando no fim do período` : undefined} />
        <StatCard icon="clock" tone="warning" label="Em trial" value={salons.trial} onClick={() => onGo('saloes')} />
        <StatCard icon="ban" tone="danger" label="Suspensos" value={salons.suspended} onClick={() => onGo('saloes')} />
        <StatCard icon="card" tone="gold" label="Aguardando pagamento" value={salons.pendingPayment} onClick={() => onGo('saloes')} />
      </div>
      <p className="text-[11.5px] text-ink-3 -mt-1 px-1">Fora da contagem: {salons.archived} arquivado(s) e {salons.deleting} com exclusão agendada.</p>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Erros nas últimas 24h"
          action={<button onClick={() => onGo('erros')} className="text-[12px] text-brand font-medium hover:underline cursor-pointer">Ver erros</button>}>
          <div className="flex gap-6">
            <ErrorSide label="Backend" occurrences={errors24h.backend.occurrences} groups={errors24h.backend.groups} />
            <div className="w-px bg-line" />
            <ErrorSide label="Frontend" occurrences={errors24h.frontend.occurrences} groups={errors24h.frontend.groups} />
          </div>
          {errorTotal === 0 && <p className="text-[12px] text-ink-3 mt-4 flex items-center gap-1.5"><Icon name="check" size={13} className="text-success" />Nenhum erro registrado.</p>}
        </Panel>

        <Panel title="Últimos acessos a este painel" flush>
          {data.recentAccesses.length === 0 ? <p className="px-5 py-6 text-sm text-ink-3">Nenhum.</p> : (
            <div className="divide-y divide-line">
              {data.recentAccesses.map((a, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-[12.5px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-4 shrink-0" />
                  <span className="flex-1 text-ink-2">{formatDateTime(a.createdAt)}</span>
                  <span className="font-mono text-[11.5px] text-ink-3">{a.ip ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="PIX pago em duplicidade (reembolsar manualmente)" flush>
        {duplicates === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3">Nenhum.</p>
        ) : (
          <div className="divide-y divide-line">
            {data.duplicatePayments.map(p => (
              <div key={p.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink font-medium truncate">{p.salon?.name ?? 'Salão excluído'}</p>
                  <p className="text-[11.5px] text-ink-3 mt-0.5">
                    {planLabel(p.plan)} · {durationLabel(p.months)} · pago em {p.paidAt ? formatDate(p.paidAt) : '—'}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span className="text-sm text-danger font-semibold">{formatCurrency(p.amountCents / 100)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
