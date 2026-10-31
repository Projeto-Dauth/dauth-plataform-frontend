import { useState, useEffect, useRef } from 'react'
import platformApi from '@/lib/platformApi'
import { PLANS, FEATURE_LABEL, BILLING_OPTIONS, NO_REFUND_NOTICE, billingLabel, formatPlanPrice, planPrice, planRequiredFor } from '@/config/plans'
import { formatDate } from '@/lib/format'

const monthsText = (months) => (months === 1 ? '1 mês' : `${months} meses`)

// O servidor decide o que está sendo cobrado (config/billing.js#planCharge); a tela só explica
function chargeNote(charge) {
  if (charge.kind === 'upgrade') {
    return `Muda para este plano agora. Você paga só a diferença pelos dias que faltam; o vencimento continua em ${formatDate(charge.coversUntil)}.`
  }
  const { savings } = planPrice(charge.plan, charge.months)
  return `${billingLabel(charge.months)}: ${monthsText(charge.months)} de acesso, até ${formatDate(charge.coversUntil)}.`
    + (savings > 0 ? ` Você economiza ${formatPlanPrice(savings)} em relação ao mensal.` : '')
}

// `lockPlan`: plano fixo em `defaultPlan` (renovação, ou logo após criar o salão) — a escolha mostra só a duração.
// `months`: com `lockPlan`, duração já decidida — pula a escolha e já gera o PIX (criação do salão).
// `defaultMonths`: duração pré-selecionada (a que o salão contratou por último).
// `feature`: id da feature travada que abriu o modal (ex: 'produtos') — mostra qual plano a libera
// e destaca o item na lista de cada plano.
// `inline`: mesmo conteúdo como tela (sem fundo escuro e sem fechar) — usado na tela de trial encerrado.
// `title`/`subtitle`: substituem o título da escolha de plano.
export default function UpgradeModal({ salonId, defaultPlan, defaultMonths, months: fixedMonths, feature, lockPlan = false, inline = false, title, subtitle, onClose, onActivated }) {
  const featureLabel = feature ? FEATURE_LABEL[feature] : null
  const requiredPlan = feature ? planRequiredFor(feature) : null
  const autoStart = lockPlan && Boolean(fixedMonths)
  const [step, setStep] = useState(autoStart ? 'pay' : 'pick')
  const [selectedPlan, setSelectedPlan] = useState((!lockPlan && requiredPlan?.id) || defaultPlan || 'essencial')
  const [months, setMonths] = useState(fixedMonths || defaultMonths || 1)
  const monthsTouchedRef = useRef(false) // a pessoa já escolheu: a duração contratada (que chega depois) não sobrescreve
  const [billing, setBilling] = useState(null) // assinatura atual: decide se o plano escolhido é upgrade
  const [loading, setLoading] = useState(false)
  const [charge, setCharge] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  const startedRef = useRef(false)
  const onActivatedRef = useRef(onActivated) // o polling vive mais que um render: sempre chama a versão atual
  onActivatedRef.current = onActivated

  const planInfo = PLANS.find(p => p.id === selectedPlan)

  // Com o período pago em curso, um plano mais caro é upgrade: não escolhe duração (mantém o vencimento).
  // Sem `defaultMonths`, a duração pré-selecionada é a que o salão contratou por último.
  useEffect(() => {
    if (autoStart) return
    platformApi.get('/salon/billing', { headers: { 'x-salon-id': salonId } })
      .then(r => {
        setBilling(r.data)
        if (!defaultMonths && !monthsTouchedRef.current && r.data.billingMonths) setMonths(r.data.billingMonths)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const inPeriod = billing?.status === 'active' && !billing.expired && new Date(billing.planEndsAt) > new Date()
  const currentPlan = PLANS.find(p => p.id === billing?.plan)
  const isUpgrade = inPeriod && Boolean(currentPlan) && (planInfo?.priceCents ?? 0) > currentPlan.priceCents

  function startCheckout(plan, months) {
    setStep('pay')
    setError(null)
    setLoading(true)
    platformApi.post('/salon/checkout', { plan, months }, { headers: { 'x-salon-id': salonId } })
      .then(r => {
        setCharge(r.data)
        const expiresAt = new Date(r.data.expiresAt)
        const tick = () => {
          const secs = Math.max(0, Math.floor((expiresAt - new Date()) / 1000))
          setTimeLeft(secs)
          if (secs > 0) timerRef.current = setTimeout(tick, 1000)
        }
        tick()
      })
      .catch(e => setError(e.response?.data?.error || 'Erro ao gerar cobrança. Tente novamente.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true
      startCheckout(selectedPlan, months)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling: pergunta a cada 4s se ESTA cobrança foi paga. (Olhar o status do salão não serve: numa renovação
  // ou upgrade o salão já está 'active' antes do pagamento.)
  useEffect(() => {
    if (!charge?.paymentId) return
    const poll = setInterval(async () => {
      try {
        const r = await platformApi.get(`/salon/checkout/${charge.paymentId}`, { headers: { 'x-salon-id': salonId } })
        if (r.data?.status === 'paid') {
          clearInterval(poll)
          onActivatedRef.current(charge.plan)
        }
      } catch {}
    }, 4000)
    return () => clearInterval(poll)
  }, [charge?.paymentId])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function handleCopy() {
    if (!charge?.brCode) return
    navigator.clipboard.writeText(charge.brCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function formatTime(secs) {
    if (secs === null) return '--:--'
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function backToPlans() {
    clearTimeout(timerRef.current)
    setCharge(null)
    setError(null)
    setStep('pick')
  }

  const card = (
      <div style={{
        background: 'rgb(var(--surface))', borderRadius: 20, padding: '32px 28px',
        maxWidth: 540, width: '100%', boxShadow: '0 24px 64px rgb(var(--ink) / 0.18)',
        position: 'relative', ...(inline ? {} : { maxHeight: '92vh', overflowY: 'auto' }),
      }} className="scrollbar-hidden" onClick={e => e.stopPropagation()}>

        {/* Fechar */}
        {onClose && <button onClick={onClose} aria-label="Fechar" style={{
          position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
          cursor: 'pointer', color: 'rgb(var(--ink-3))', padding: 4, borderRadius: 6,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l12 12M14 2L2 14" />
          </svg>
        </button>}

        {/* Header */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgb(var(--brand))', marginBottom: 4 }}>
          Ativação do Plano
        </p>

        {step === 'pick' ? (
          <>
            <h2 style={{ fontFamily: 'Inter, Georgia, serif', fontSize: 24, fontWeight: 600, color: 'rgb(var(--ink))', margin: '0 0 16px' }}>
              {title ?? (featureLabel ? `${featureLabel} não está no seu plano` : lockPlan ? `Plano ${planInfo?.label}` : 'Escolha seu plano')}
            </h2>
            {subtitle && (
              <p style={{ fontSize: 13, color: 'rgb(var(--ink-2))', margin: '-8px 0 16px', lineHeight: 1.5 }}>{subtitle}</p>
            )}
            {featureLabel && requiredPlan && (
              <p style={{ fontSize: 13, color: 'rgb(var(--ink-2))', margin: '-8px 0 16px', lineHeight: 1.5 }}>
                <strong>{featureLabel}</strong> está disponível a partir do plano <strong>{requiredPlan.label}</strong>.
                Veja o que cada plano inclui:
              </p>
            )}
            {isUpgrade ? (
              <p style={{ fontSize: 12.5, color: 'rgb(var(--ink-2))', margin: '0 0 14px', lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, background: 'rgb(var(--surface-2))' }}>
                Upgrade: você paga só a diferença entre os planos pelos dias que faltam, e o vencimento continua em {formatDate(billing.planEndsAt)}.
              </p>
            ) : (
              <>
              {inPeriod && currentPlan?.id === selectedPlan && (
                <p style={{ fontSize: 12.5, color: 'rgb(var(--ink-2))', margin: '0 0 12px', lineHeight: 1.5 }}>
                  O novo período começa quando o atual termina, em {formatDate(billing.planEndsAt)}.
                </p>
              )}
              <div role="radiogroup" aria-label="Duração do plano" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                {BILLING_OPTIONS.map(o => {
                  const on = months === o.months
                  return (
                    <button key={o.months} type="button" role="radio" aria-checked={on} onClick={() => { monthsTouchedRef.current = true; setMonths(o.months) }} style={{
                      padding: '8px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                      border: on ? '2px solid rgb(var(--brand))' : '1.5px solid rgb(var(--line))',
                      background: on ? 'rgb(var(--brand) / 0.06)' : 'transparent',
                    }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgb(var(--ink))' }}>{o.label}</span>
                      <span style={{ display: 'block', fontSize: 11, color: o.discount ? 'rgb(var(--brand))' : 'rgb(var(--ink-3))', fontWeight: o.discount ? 600 : 400 }}>
                        {o.discount ? `${o.discount}% de desconto` : 'sem desconto'}
                      </span>
                    </button>
                  )
                })}
              </div>
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PLANS.filter(p => !lockPlan || p.id === selectedPlan).map(p => {
                const price = planPrice(p.id, months)
                return (
                <button key={p.id} onClick={() => setSelectedPlan(p.id)} style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: selectedPlan === p.id ? '2px solid rgb(var(--brand))' : '1.5px solid rgb(var(--line))',
                  background: selectedPlan === p.id ? 'rgb(var(--brand) / 0.06)' : 'transparent',
                  transition: 'all .15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'Inter, Georgia, serif', fontSize: 16, fontWeight: 600, color: 'rgb(var(--ink))' }}>
                      {p.label}
                      {inPeriod && currentPlan?.id === p.id && (
                        <span style={{
                          marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, verticalAlign: 'middle',
                          background: 'rgb(var(--brand) / 0.12)', color: 'rgb(var(--brand))',
                        }}>
                          Plano atual
                        </span>
                      )}
                    </span>
                    <span style={{ fontFamily: 'Inter, monospace', fontSize: 15, fontWeight: 700, color: 'rgb(var(--ink))' }}>
                      {formatPlanPrice(price.perMonth)}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgb(var(--ink-3))' }}>/mês</span>
                    </span>
                  </div>
                  {months > 1 && !isUpgrade && (
                    <p style={{ fontSize: 11.5, color: 'rgb(var(--ink-3))', marginTop: 2, textAlign: 'right' }}>
                      {formatPlanPrice(price.total)} a cada {months} meses · economize {formatPlanPrice(price.savings)}
                    </p>
                  )}
                  {feature && (
                    <span style={{
                      display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      ...(p.featureIds.includes(feature)
                        ? { background: 'rgb(var(--brand) / 0.12)', color: 'rgb(var(--brand))' }
                        : { background: 'rgb(var(--surface-3))', color: 'rgb(var(--ink-3))' }),
                    }}>
                      {p.featureIds.includes(feature) ? `✓ Inclui ${featureLabel}` : `Não inclui ${featureLabel}`}
                    </span>
                  )}
                  {selectedPlan === p.id ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {p.features.map(f => {
                        const hl = f === featureLabel
                        return (
                          <li key={f} style={{
                            fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center',
                            color: hl ? 'rgb(var(--brand))' : 'rgb(var(--ink-2))', fontWeight: hl ? 700 : 400,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M2 7l3.5 3.5L12 3" /></svg>
                            {f}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 12, color: 'rgb(var(--ink-3))', marginTop: 4 }}>{p.tagline}</p>
                  )}
                </button>
                )
              })}
            </div>
            <button onClick={() => startCheckout(selectedPlan, months)} style={{
              width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none',
              background: 'rgb(var(--brand))', color: '#fff',
            }}>
              {lockPlan ? 'Gerar PIX' : `Continuar com ${planInfo?.label}`}
            </button>
            <p style={{ fontSize: 11.5, color: 'rgb(var(--ink-3))', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>{NO_REFUND_NOTICE}</p>
          </>
        ) : (
        <>
        <h2 style={{ fontFamily: 'Inter, Georgia, serif', fontSize: 28, fontWeight: 600, color: 'rgb(var(--ink))', margin: '0 0 4px' }}>
          Plano {planInfo?.label}
        </h2>
        <p style={{ fontSize: 24, fontWeight: 700, color: 'rgb(var(--ink))', marginBottom: charge ? 6 : 20, fontFamily: 'Inter, monospace' }}>
          {formatPlanPrice(charge?.amount ?? planPrice(selectedPlan, months).total)}
          {charge?.kind !== 'upgrade' && (
            <span style={{ fontSize: 14, fontWeight: 400, color: 'rgb(var(--ink-3))' }}> · {monthsText(charge?.months ?? months)}</span>
          )}
        </p>
        {charge && (
          <p style={{ fontSize: 12.5, color: 'rgb(var(--ink-3))', margin: '0 0 20px', lineHeight: 1.5 }}>{chargeNote(charge)}</p>
        )}

        {loading ? (
          <div style={{ height: 220, borderRadius: 12, background: 'rgb(var(--ink) / 0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : charge ? (
          <>
            {/* QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: '#fff', borderRadius: 12, border: '1px solid rgb(var(--line))' }}>
                <img src={charge.brCodeBase64} alt="QR Code PIX" style={{ width: 180, height: 180, display: 'block' }} />
              </div>
              {timeLeft !== null && (
                <span style={{ fontSize: 12, fontFamily: 'Inter, monospace', color: timeLeft < 60 ? '#8b3a32' : 'rgb(var(--ink-3))' }}>
                  Expira em {formatTime(timeLeft)}
                </span>
              )}
            </div>

            {/* Copia e cola */}
            <button onClick={handleCopy} style={{
              width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: '1.5px solid rgb(var(--line))',
              background: copied ? 'rgb(var(--brand) / 0.08)' : 'rgb(var(--surface-2))',
              color: copied ? 'rgb(var(--brand))' : 'rgb(var(--ink-2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all .18s',
            }}>
              {copied ? (
                <><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 7l3.5 3.5L12 3" /></svg> Código copiado!</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="8" height="8" rx="2" /><path d="M3 9H2a1 1 0 01-1-1V2a1 1 0 011-1h6a1 1 0 011 1v1" /></svg> Copiar código PIX</>
              )}
            </button>

            <p style={{ fontSize: 12, color: 'rgb(var(--ink-4))', textAlign: 'center', marginTop: 12 }}>
              Após o pagamento, a ativação é automática.
            </p>
            <p style={{ fontSize: 11.5, color: 'rgb(var(--ink-3))', textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>{NO_REFUND_NOTICE}</p>
            {error && <p role="alert" style={{ fontSize: 12, color: '#8b3a32', textAlign: 'center', marginTop: 8 }}>{error}</p>}

            {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_SIMULATE === 'true') && (
              <button onClick={async () => {
                try {
                  const r = await platformApi.post('/salon/checkout/simulate', { paymentId: charge.paymentId }, { headers: { 'x-salon-id': salonId } })
                  if (r.data?.ok) onActivated(charge.plan)
                } catch (e) {
                  setError(e.response?.data?.error || 'Erro ao simular o pagamento.')
                }
              }} style={{
                width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, fontSize: 12,
                fontFamily: 'Inter, monospace', cursor: 'pointer',
                border: '1px dashed rgb(var(--line-3))', background: 'transparent',
                color: 'rgb(var(--ink-4))',
              }}>
                [dev] Simular pagamento
              </button>
            )}
          </>
        ) : (
          <p style={{ textAlign: 'center', color: 'rgb(var(--ink-3))', fontSize: 14 }}>
            {error || 'Erro ao gerar cobrança. Tente novamente.'}
          </p>
        )}
        {/* Na tela não há "fechar": volta para a lista para trocar de plano (no modal, só quando deu erro) */}
        {!lockPlan && (inline || (error && !charge)) && (
          <button onClick={backToPlans} style={{
            width: '100%', marginTop: 12, padding: '8px', background: 'none', border: 'none',
            fontSize: 13, color: 'rgb(var(--ink-3))', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            Escolher outro plano
          </button>
        )}
        </>
        )}
      </div>
  )

  if (inline) return card
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      {card}
    </div>
  )
}
