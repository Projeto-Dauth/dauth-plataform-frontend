import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/format'
import { planLabel, durationLabel } from './shared'

function Card({ label, value, hint, tone, onClick }) {
  const toneCls = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`text-left rounded-lg border border-line bg-surface p-4 ${onClick ? 'hover:border-ink-3 cursor-pointer transition-colors' : ''}`}>
      <p className="text-[11.5px] text-ink-3 mb-1.5">{label}</p>
      <p className={`font-display text-[24px] font-medium leading-none ${toneCls}`}>{value}</p>
      {hint && <p className="text-[11.5px] text-ink-3 mt-1.5">{hint}</p>}
    </Tag>
  )
}

export default function SistemaResumo({ onGo }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    platformApi.get('/system/summary').then(r => setData(r.data)).catch(() => setFailed(true))
  }, [])

  if (failed) return <p className="text-sm text-danger">Não foi possível carregar o resumo.</p>
  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[92px] rounded-lg bg-surface-2 animate-pulse" />)}
      </div>
    )
  }

  const { salons, errors24h } = data
  const errorTotal = errors24h.backend.occurrences + errors24h.frontend.occurrences

  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow mb-3">Salões</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="Ativos (pagando)" value={salons.active} onClick={() => onGo('saloes')}
            hint={data.cancelingAtPeriodEnd ? `${data.cancelingAtPeriodEnd} cancelando no fim do período` : undefined} />
          <Card label="Em trial" value={salons.trial} />
          <Card label="Suspensos" value={salons.suspended} tone={salons.suspended ? 'danger' : undefined} />
          <Card label="Aguardando pagamento" value={salons.pendingPayment} />
          <Card label="Receita mensal (MRR)" value={formatCurrency(data.mrrCents / 100)} hint="Equivalente mensal dos planos ativos" />
          <Card label="Novos no mês" value={salons.newThisMonth} />
          <Card label="Trials vencendo em 7 dias" value={data.trialsEnding7d} tone={data.trialsEnding7d ? 'warning' : undefined} />
          <Card label="Assinaturas vencendo em 7 dias" value={data.plansEnding7d} tone={data.plansEnding7d ? 'warning' : undefined} />
        </div>
        <p className="text-[11.5px] text-ink-3 mt-2">Fora da contagem: {salons.archived} arquivado(s) e {salons.deleting} com exclusão agendada.</p>
      </section>

      <section>
        <p className="eyebrow mb-3">Erros nas últimas 24h</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="Backend" value={errors24h.backend.occurrences} hint={`${errors24h.backend.groups} erro(s) diferente(s)`}
            tone={errors24h.backend.occurrences ? 'danger' : undefined} onClick={() => onGo('erros')} />
          <Card label="Frontend" value={errors24h.frontend.occurrences} hint={`${errors24h.frontend.groups} erro(s) diferente(s)`}
            tone={errors24h.frontend.occurrences ? 'danger' : undefined} onClick={() => onGo('erros')} />
        </div>
        {errorTotal === 0 && <p className="text-[11.5px] text-ink-3 mt-2">Nenhum erro registrado.</p>}
      </section>

      <section>
        <p className="eyebrow mb-3">PIX pago em duplicidade (reembolsar manualmente)</p>
        {data.duplicatePayments.length === 0 ? (
          <p className="text-sm text-ink-3">Nenhum.</p>
        ) : (
          <div className="rounded-lg border border-line bg-surface divide-y divide-line">
            {data.duplicatePayments.map(p => (
              <div key={p.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink font-medium truncate">{p.salon?.name ?? 'Salão excluído'}</p>
                  <p className="text-[11.5px] text-ink-3">
                    {planLabel(p.plan)} · {durationLabel(p.months)} · pago em {p.paidAt ? formatDate(p.paidAt) : '—'}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span className="text-sm text-danger font-medium">{formatCurrency(p.amountCents / 100)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="eyebrow mb-3">Últimos acessos a este painel</p>
        {data.recentAccesses.length === 0 ? <p className="text-sm text-ink-3">Nenhum.</p> : (
          <div className="rounded-lg border border-line bg-surface divide-y divide-line">
            {data.recentAccesses.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-ink-2">{formatDateTime(a.createdAt)}</span>
                <span className="font-mono text-ink-3">{a.ip ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
