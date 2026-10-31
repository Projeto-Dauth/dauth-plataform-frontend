import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Section from '@/components/ui/SettingsSection'
import platformApi from '@/lib/platformApi'
import { useToast } from '@/context/ToastContext'
import { PLANS, NO_REFUND_NOTICE, WAITLIST_DISCOUNT, billingLabel, formatPlanPrice } from '@/config/plans'
import { formatDate } from '@/lib/format'

const PLAN_LABELS = Object.fromEntries(PLANS.map((p) => [p.id, p.label]))
const KIND_LABELS = { first: 'Ativação', renewal: 'Renovação', upgrade: 'Upgrade' }
const PAYMENT_STATUS = {
  paid: { label: 'Pago', tone: 'text-success' },
  pending: { label: 'Aguardando pagamento', tone: 'text-ink-3' },
  duplicate: { label: 'Pago em duplicidade — reembolso em análise', tone: 'text-danger' },
}
const daysText = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`

// Configurações → Plano. Uma tela só, de cima para baixo: como está o plano, o que dá para fazer (cada ação com
// uma frase explicando) e os pagamentos feitos. Pensada para quem não é acostumado com sistemas: letra maior,
// frases completas, um botão por ação. A fonte é GET /salon/billing (liberado mesmo com o salão bloqueado).
// `onPay({ renew })` abre o PIX (o modal vive na página e já deixa escolher 1, 3 ou 6 meses); `onBilling`
// devolve o estado fresco para a página; `refreshKey` pede nova busca.
export default function SubscriptionPanel({ salonId, config, refreshKey, onPay, onBilling }) {
  const { addToast } = useToast()
  const [billing, setBilling] = useState(null)
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

  if (!billing) return <div className="h-[180px] animate-pulse rounded-[14px] bg-ink/5" />

  const { status, plan, planEndsAt, cancelAtPeriodEnd, daysLeft, expired, renewalOpen, nextCharge } = billing
  const isActive = status === 'active' && !expired
  const isTrial = status === 'trial'
  const endDate = formatDate(planEndsAt)
  const trialDays = isTrial && config?.trialEndsAt ? Math.max(0, Math.ceil((new Date(config.trialEndsAt) - Date.now()) / 86_400_000)) : null
  const planIndex = PLANS.findIndex((p) => p.id === plan)
  const biggerPlan = isActive && planIndex >= 0 ? PLANS[planIndex + 1] : null

  // Situação do plano em linguagem simples: título, detalhe e cor do Chip (verde = tudo certo, laranja = atenção, vermelho = agir)
  let state
  if (isActive && cancelAtPeriodEnd) state = { tone: 'danger', title: 'Seu plano foi cancelado', detail: `Você ainda pode usar o sistema até ${endDate}. Depois disso o acesso é bloqueado, mas seus dados ficam guardados.` }
  else if (isActive) state = { tone: daysLeft <= 2 ? 'danger' : daysLeft <= 7 ? 'warning' : 'success', title: 'Seu plano está ativo', detail: `Vence em ${endDate} — faltam ${daysText(daysLeft)}.` }
  else if (expired) state = { tone: 'danger', title: 'Seu plano venceu', detail: `Venceu em ${endDate}. Seus dados estão guardados: é só pagar para voltar a usar o sistema.` }
  else if (status === 'pending_payment') state = { tone: 'danger', title: 'Aguardando o pagamento', detail: 'Assim que o PIX for pago, o sistema é liberado.' }
  else if (isTrial) state = { tone: trialDays > 2 ? 'success' : 'danger', title: 'Você está no período de teste grátis', detail: `${trialDays > 0 ? `Faltam ${daysText(trialDays)}.` : 'O teste termina hoje.'} Para continuar usando depois disso, escolha um plano.` }
  else state = { tone: 'danger', title: 'Acesso bloqueado', detail: 'Escolha um plano para voltar a usar o sistema. Seus dados estão guardados.' }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Como está o plano */}
      <Section title="Seu plano">
        <div>
          <p className="text-[24px] font-bold leading-tight text-ink">
            {plan && !isTrial ? (PLAN_LABELS[plan] ?? plan) : 'Teste grátis'}
            {isActive && <span className="text-[16px] font-medium text-ink-3"> · pagamento {billingLabel(billing.billingMonths).toLowerCase()}</span>}
          </p>
          <Chip variant={state.tone} dot className="mt-4 !text-[15px] !font-semibold">{state.title}</Chip>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{state.detail}</p>
          {billing.discountMonthsLeft > 0 && (
            <p className="mt-3 rounded-[10px] bg-brand-soft px-4 py-3 text-[15px] leading-relaxed text-brand-soft-ink">
              Você tem o desconto da lista de espera: {WAITLIST_DISCOUNT.percent}% em {billing.discountMonthsLeft === 1 ? 'mais 1 mensalidade' : `mais ${billing.discountMonthsLeft} mensalidades`}. Ele já entra no valor do PIX.
            </p>
          )}
          {isActive && cancelAtPeriodEnd && (
            <div className="mt-4">
              <Button variant="outline" loading={busy} onClick={() => changeSubscription('resume', 'Cancelamento desfeito. Seu plano continua ativo.')}>
                Desfazer cancelamento
              </Button>
            </div>
          )}
        </div>
      </Section>

      {/* 2. O que dá para fazer — cada ação com uma explicação curta e um botão */}
      <Section title="O que você pode fazer">
          {isActive && nextCharge && (
            <Action
              title={renewalOpen ? 'Renovar o plano' : 'Pagar adiantado'}
              text={
                <>
                  Próximo pagamento ({billingLabel(nextCharge.months).toLowerCase()}): <strong className="text-ink">{formatPlanPrice(nextCharge.amountCents)}</strong>, garante o acesso até {formatDate(nextCharge.coversUntil)}.
                  {' '}Na próxima tela você pode escolher pagar 1, 3 ou 6 meses — quanto mais meses, maior o desconto.
                </>
              }
              button={<Button onClick={() => onPay({ renew: true })}>{renewalOpen ? 'Renovar agora' : 'Pagar adiantado'}</Button>}
            />
          )}
          {biggerPlan && (
            <Action
              title="Mudar para um plano maior"
              text={<>O plano {biggerPlan.label} libera: {biggerPlan.features.filter((f) => !f.startsWith('Tudo do')).join(', ')}. Você paga só a diferença pelos dias que faltam, e o vencimento continua o mesmo.</>}
              button={<Button variant="outline" onClick={() => onPay({ renew: false })}>Ver planos</Button>}
            />
          )}
          {!isActive && (
            <Action
              title={expired ? 'Voltar a usar o sistema' : 'Escolher um plano'}
              text="Veja os planos, escolha por quanto tempo quer pagar (1, 3 ou 6 meses) e pague com PIX. O sistema é liberado assim que o pagamento cair."
              button={<Button onClick={() => onPay({ renew: false })}>{expired ? 'Renovar assinatura' : 'Escolher um plano'}</Button>}
            />
          )}
        <p className="rounded-[10px] bg-surface-2 px-4 py-3 text-[14px] leading-relaxed text-ink-2">{NO_REFUND_NOTICE}</p>
      </Section>

      {/* 3. Pagamentos feitos */}
      <Section title="Pagamentos feitos">
        <PaymentHistory payments={billing.payments} />
      </Section>

      {/* 4. Cancelar — por último, separado do resto */}
      {isActive && !cancelAtPeriodEnd && (
        confirmingCancel ? (
          <div role="alertdialog" aria-label="Confirmar cancelamento do plano" className="rounded-[14px] border border-danger/40 bg-danger-soft p-5">
            <p className="mb-1 text-[16px] font-semibold text-ink">Cancelar o plano {PLAN_LABELS[plan] ?? ''}?</p>
            <p className="mb-4 text-[15px] leading-relaxed text-ink-2">
              Ao cancelar, o acesso será encerrado ao final do plano ativo, em {endDate}. Para voltar a acessar, será preciso pagar outro plano. Seus dados ficam guardados e o período já pago não é reembolsado.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setConfirmingCancel(false)}>Manter plano</Button>
              <Button className="!border-danger !bg-danger" loading={busy} onClick={() => changeSubscription('cancel', `Plano cancelado. Você pode usar até ${endDate}.`)}>
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-[14px] text-ink-3">Não quer mais usar o sistema? Você pode cancelar e usar até {endDate}.</p>
            <Button variant="outline" className="!border-danger/50 !text-danger" onClick={() => setConfirmingCancel(true)}>Cancelar plano</Button>
          </div>
        )
      )}
    </div>
  )
}

function Action({ title, text, button }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="max-w-[680px]">
        <p className="text-[16px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[15px] leading-relaxed text-ink-2">{text}</p>
      </div>
      <div className="shrink-0">{button}</div>
    </div>
  )
}

// Lista de pagamentos do salão. "Data" = quando foi pago; cobrança ainda não paga mostra o dia em que o PIX foi gerado.
const HISTORY_GRID = 'md:grid md:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto] md:items-center md:gap-x-4'
function PaymentHistory({ payments }) {
  if (!payments.length) return <p className="text-[15px] text-ink-3">Nenhum pagamento até agora.</p>
  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div className={`hidden bg-surface-2 px-4 py-2 text-[12px] font-bold uppercase tracking-[.08em] text-ink-3 ${HISTORY_GRID}`}>
        <span>Pagamento</span><span>Data</span><span>Cobre até</span><span>Situação</span><span className="text-right">Valor</span>
      </div>
      <ul className="divide-y divide-line-3">
        {payments.map((p) => {
          const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: 'text-ink-3' }
          const paid = p.status === 'paid'
          return (
            <li key={p.id} className={`flex flex-col gap-1 px-4 py-3 text-[14px] ${HISTORY_GRID}`}>
              <span className="font-medium text-ink">
                {KIND_LABELS[p.kind] ?? p.kind} · {PLAN_LABELS[p.plan] ?? p.plan}
                {p.kind !== 'upgrade' && p.months > 1 && ` · ${p.months} meses`}
              </span>
              <span className="text-ink-2">
                <span className="text-ink-3 md:hidden">{paid ? 'Pago em ' : 'Gerado em '}</span>
                {formatDate(p.paidAt ?? p.createdAt)}
                {!paid && <span className="hidden text-ink-3 md:inline"> (gerado)</span>}
              </span>
              <span className="text-ink-2">
                <span className="text-ink-3 md:hidden">Cobre até </span>
                {p.periodEnd ? formatDate(p.periodEnd) : '—'}
              </span>
              <span className={`text-[13px] font-semibold ${st.tone}`}>{st.label}</span>
              <span className="font-semibold tabular-nums text-ink md:text-right">{formatPlanPrice(p.amountCents)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
