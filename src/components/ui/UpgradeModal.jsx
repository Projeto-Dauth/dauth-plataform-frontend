import { useState, useEffect, useRef } from 'react'
import platformApi from '@/lib/platformApi'
import { PLANS, FEATURE_LABEL, formatPlanPrice, planRequiredFor } from '@/config/plans'

// `lockPlan`: pula a etapa de escolha e já dispara o checkout com `defaultPlan` — usado
// logo após criar o salão, quando o plano já foi decidido no formulário de criação.
// `feature`: id da feature travada que abriu o modal (ex: 'produtos') — mostra qual plano a libera
// e destaca o item na lista de cada plano.
// `inline`: mesmo conteúdo como tela (sem fundo escuro e sem fechar) — usado na tela de trial encerrado.
// `title`/`subtitle`: substituem o título da escolha de plano.
export default function UpgradeModal({ salonId, defaultPlan, feature, lockPlan = false, inline = false, title, subtitle, onClose, onActivated }) {
  const featureLabel = feature ? FEATURE_LABEL[feature] : null
  const requiredPlan = feature ? planRequiredFor(feature) : null
  const [step, setStep] = useState(lockPlan ? 'pay' : 'pick')
  const [selectedPlan, setSelectedPlan] = useState(requiredPlan?.id || defaultPlan || 'essencial')
  const [loading, setLoading] = useState(false)
  const [charge, setCharge] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const pollRef = useRef(null)
  const timerRef = useRef(null)
  const startedRef = useRef(false)
  const payingPlanRef = useRef(null) // plano da cobrança em andamento — o polling só confirma quando ele passa a valer

  const planInfo = PLANS.find(p => p.id === selectedPlan)

  function startCheckout(plan) {
    setStep('pay')
    payingPlanRef.current = plan
    setError(null)
    setLoading(true)
    platformApi.post('/salon/checkout', { plan }, { headers: { 'x-salon-id': salonId } })
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
    if (lockPlan && !startedRef.current) {
      startedRef.current = true
      startCheckout(selectedPlan)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Polling: verifica se o pagamento foi confirmado a cada 4s (independente do passo atual)
    pollRef.current = setInterval(async () => {
      try {
        const r = await platformApi.get('/salon', { headers: { 'x-salon-id': salonId } })
        if (payingPlanRef.current && r.data?.status === 'active' && r.data?.plan === payingPlanRef.current) {
          clearInterval(pollRef.current)
          onActivated(payingPlanRef.current)
        }
      } catch {}
    }, 4000)

    return () => {
      clearInterval(pollRef.current)
      clearTimeout(timerRef.current)
    }
  }, [])

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
    payingPlanRef.current = null
    setCharge(null)
    setError(null)
    setStep('pick')
  }

  const card = (
      <div style={{
        background: 'rgb(var(--surface))', borderRadius: 20, padding: '32px 28px',
        maxWidth: 460, width: '100%', boxShadow: '0 24px 64px rgb(var(--ink) / 0.18)',
        position: 'relative', ...(inline ? {} : { maxHeight: '92vh', overflowY: 'auto' }),
      }} onClick={e => e.stopPropagation()}>

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
              {title ?? (featureLabel ? `${featureLabel} não está no seu plano` : 'Escolha seu plano')}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PLANS.map(p => (
                <button key={p.id} onClick={() => setSelectedPlan(p.id)} style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: selectedPlan === p.id ? '2px solid rgb(var(--brand))' : '1.5px solid rgb(var(--line))',
                  background: selectedPlan === p.id ? 'rgb(var(--brand) / 0.06)' : 'transparent',
                  transition: 'all .15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'Inter, Georgia, serif', fontSize: 16, fontWeight: 600, color: 'rgb(var(--ink))' }}>{p.label}</span>
                    <span style={{ fontFamily: 'Inter, monospace', fontSize: 15, fontWeight: 700, color: 'rgb(var(--ink))' }}>
                      {formatPlanPrice(p.priceCents)}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgb(var(--ink-3))' }}>/mês</span>
                    </span>
                  </div>
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
              ))}
            </div>
            <button onClick={() => startCheckout(selectedPlan)} style={{
              width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none',
              background: 'rgb(var(--brand))', color: '#fff',
            }}>
              Continuar com {planInfo?.label}
            </button>
          </>
        ) : (
        <>
        <h2 style={{ fontFamily: 'Inter, Georgia, serif', fontSize: 28, fontWeight: 600, color: 'rgb(var(--ink))', margin: '0 0 4px' }}>
          Plano {planInfo?.label}
        </h2>
        <p style={{ fontSize: 24, fontWeight: 700, color: 'rgb(var(--ink))', marginBottom: 20, fontFamily: 'Inter, monospace' }}>
          {formatPlanPrice(planInfo?.priceCents ?? 0)}<span style={{ fontSize: 14, fontWeight: 400, color: 'rgb(var(--ink-3))' }}>/mês</span>
        </p>

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

            {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_SIMULATE === 'true') && (
              <button onClick={async () => {
                const r = await platformApi.post('/salon/checkout/simulate', { chargeId: charge.id, plan: selectedPlan }, { headers: { 'x-salon-id': salonId } })
                if (r.data?.ok) onActivated(selectedPlan)
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
        {/* Na tela não há "fechar": volta para a lista para trocar de plano */}
        {inline && !lockPlan && (
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
