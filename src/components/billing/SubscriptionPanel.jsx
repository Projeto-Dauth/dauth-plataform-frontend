import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import platformApi from '@/lib/platformApi'
import { useToast } from '@/context/ToastContext'
import { PLANS, formatPlanPrice } from '@/config/plans'
import { formatDate } from '@/lib/format'

const PLAN_LABELS = Object.fromEntries(PLANS.map((p) => [p.id, p.label]))
const KIND_LABELS = { first: 'Ativação', renewal: 'Renovação', upgrade: 'Upgrade' }
const PAYMENT_STATUS = {
  paid: { label: 'Pago', tone: 'text-success' },
  pending: { label: 'Aguardando pagamento', tone: 'text-ink-3' },
  duplicate: { label: 'Pago em duplicidade — reembolso em análise', tone: 'text-danger' },
}

// Conteúdo de Configurações → Plano, com duas subseções: Informações (plano atual, vencimento, renovar/upgrade,
// cancelar) e Histórico (só os pagamentos). A fonte é GET /salon/billing (liberado mesmo com o salão bloqueado).
// `onPay({ renew })` abre o PIX (o modal vive na página); `onBilling` devolve o estado fresco para a página manter
// plano/status em dia; `refreshKey` pede nova busca.
export default function SubscriptionPanel({ salonId, config, refreshKey, onPay, onBilling }) {
  const { addToast } = useToast()
  const [billing, setBilling] = useState(null)
  const [sub, setSub] = useState('info')
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const headers = { headers: { 'x-salon-id': salonId } }

  useEffect(() => {
    platformApi.get('/salon/billing', headers)
      .then((r) => { setBilling(r.data); onBilling?.(r.data) })
      .catch(() => addToast('Erro ao carregar os dados da assinatura', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId, refreshKey])

  async function changeSubscription(action, success) {
    setBusy(true)
    try {
      const r = await platformApi.post(`/salon/subscription/${action}`, {}, headers)
      setBilling(r.data)
      onBilling?.(r.data)
      setConfirmingCancel(false)
      addToast(success, 'success')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Não foi possível concluir. Tente novamente.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!billing) return <div className="h-[60px] animate-pulse rounded-[10px] bg-ink/5" />

  const { status, plan, planEndsAt, cancelAtPeriodEnd, daysLeft, expired, renewalOpen, nextCharge } = billing
  const isActive = status === 'active' && !expired
  const isTrial = status === 'trial'
  const endDate = formatDate(planEndsAt)
  const trialDays = isTrial && config?.trialEndsAt ? Math.max(0, Math.ceil((new Date(config.trialEndsAt) - Date.now()) / 86_400_000)) : null

  let statusLine
  if (isActive && cancelAtPeriodEnd) statusLine = { tone: 'text-danger', text: `Cancelado · acesso até ${endDate}` }
  else if (isActive) statusLine = { tone: daysLeft <= 2 ? 'text-danger' : daysLeft <= 7 ? 'text-brand' : 'text-success', text: `Ativo · vence em ${endDate} (${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'})` }
  else if (expired) statusLine = { tone: 'text-danger', text: `Assinatura vencida em ${endDate}` }
  else if (status === 'pending_payment') statusLine = { tone: 'text-danger', text: 'Aguardando pagamento' }
  else if (isTrial) statusLine = { tone: trialDays > 2 ? 'text-success' : 'text-danger', text: trialDays > 0 ? `${trialDays} dia${trialDays !== 1 ? 's' : ''} de trial restante${trialDays !== 1 ? 's' : ''}` : 'Trial encerrado hoje' }
  else statusLine = { tone: 'text-danger', text: 'Acesso suspenso' }

  const subTabs = (
    <div className="flex gap-1 border-b border-line-3" role="tablist" aria-label="Seções do plano">
      {[['info', 'Informações'], ['historico', 'Histórico']].map(([id, label]) => (
        <button
          key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
          className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${sub === id ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (sub === 'historico') {
    return <div className="flex flex-col gap-5">{subTabs}<PaymentHistory payments={billing.payments} /></div>
  }

  return (
    <div className="flex flex-col gap-5">
      {subTabs}
      <div className="flex flex-wrap items-center gap-3.5">
        <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide ${isActive ? 'bg-gradient-to-br from-[#c9a57b] to-[#8b4a2b] text-white' : 'bg-ink/[0.07] text-ink'}`}>
          {plan ? (PLAN_LABELS[plan] ?? plan) : 'Trial'}
        </span>
        <span className={`text-[13px] font-semibold ${statusLine.tone}`}>{statusLine.text}</span>
      </div>

      <div className="flex flex-col gap-3 border-t border-line-3 pt-5">
        {isActive && nextCharge && (
          <p className="text-[13px] text-ink-2">
            Próxima mensalidade: <span className="font-semibold text-ink">{formatPlanPrice(nextCharge.amountCents)}</span>, cobre até {formatDate(nextCharge.coversUntil)}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {isActive && nextCharge && <Button size="sm" onClick={() => onPay({ renew: true })}>{renewalOpen ? 'Renovar agora' : 'Pagar próxima mensalidade'}</Button>}
          {isActive && plan !== 'business' && <Button size="sm" variant="outline" onClick={() => onPay({ renew: false })}>Fazer upgrade</Button>}
          {!isActive && <Button size="sm" onClick={() => onPay({ renew: false })}>{expired ? 'Renovar assinatura' : 'Assinar'}</Button>}
        </div>
      </div>

      {isActive && cancelAtPeriodEnd && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-surface-2 px-4 py-3">
          <p className="max-w-[460px] text-[13px] leading-relaxed text-ink-2">
            Plano cancelado: o acesso será encerrado em {endDate}. Seus dados ficam guardados.
          </p>
          <Button size="sm" variant="outline" loading={busy} onClick={() => changeSubscription('resume', 'Cancelamento desfeito. Seu plano continua ativo.')}>
            Desfazer cancelamento
          </Button>
        </div>
      )}

      {isActive && !cancelAtPeriodEnd && !confirmingCancel && (
        <div className="border-t border-line-3 pt-5">
          <Button size="sm" className="!border-danger !bg-danger hover:!opacity-90" onClick={() => setConfirmingCancel(true)}>
            Cancelar plano
          </Button>
        </div>
      )}

      {confirmingCancel && (
        <div role="alertdialog" aria-label="Confirmar cancelamento do plano" className="rounded-[10px] border border-danger/40 bg-danger-soft px-4 py-4">
          <p className="mb-1 text-[14px] font-semibold text-ink">Cancelar o plano {PLAN_LABELS[plan] ?? ''}?</p>
          <p className="mb-3.5 text-[13px] leading-relaxed text-ink-2">
            Ao cancelar, o acesso será encerrado ao final do plano ativo, em {endDate}. Para voltar a acessar, será preciso pagar outro plano. Seus dados ficam guardados e o período já pago não é reembolsado.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingCancel(false)}>Manter plano</Button>
            <Button size="sm" className="!border-danger !bg-danger" loading={busy} onClick={() => changeSubscription('cancel', `Plano cancelado. Você pode usar até ${endDate}.`)}>
              Confirmar cancelamento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Aba Histórico: só a lista de pagamentos do salão. "Data" = quando foi pago; cobrança ainda não paga mostra o dia em que o PIX foi gerado.
const HISTORY_GRID = 'md:grid md:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto] md:items-center md:gap-x-4'
function PaymentHistory({ payments }) {
  if (!payments.length) return <p className="text-[13px] text-ink-3">Nenhum pagamento até agora.</p>
  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div className={`hidden bg-surface-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[.08em] text-ink-3 ${HISTORY_GRID}`}>
        <span>Pagamento</span><span>Data</span><span>Cobre até</span><span>Status</span><span className="text-right">Valor</span>
      </div>
      <ul className="divide-y divide-line-3">
        {payments.map((p) => {
          const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: 'text-ink-3' }
          const paid = p.status === 'paid'
          return (
            <li key={p.id} className={`flex flex-col gap-1 px-4 py-3 text-[13px] ${HISTORY_GRID}`}>
              <span className="font-medium text-ink">{KIND_LABELS[p.kind] ?? p.kind} · {PLAN_LABELS[p.plan] ?? p.plan}</span>
              <span className="text-ink-2">
                <span className="text-ink-3 md:hidden">{paid ? 'Pago em ' : 'Gerado em '}</span>
                {formatDate(p.paidAt ?? p.createdAt)}
                {!paid && <span className="hidden text-ink-3 md:inline"> (gerado)</span>}
              </span>
              <span className="text-ink-2">
                <span className="text-ink-3 md:hidden">Cobre até </span>
                {p.periodEnd ? formatDate(p.periodEnd) : '—'}
              </span>
              <span className={`text-xs font-semibold ${st.tone}`}>{st.label}</span>
              <span className="font-semibold tabular-nums text-ink md:text-right">{formatPlanPrice(p.amountCents)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
