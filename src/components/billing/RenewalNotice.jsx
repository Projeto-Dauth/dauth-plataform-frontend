import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import UpgradeModal from '@/components/ui/UpgradeModal'
import useSalonStore from '@/store/salonStore'
import { useRole } from '@/hooks/useRole'
import { isRenewalDue, subscriptionDaysLeft } from '@/lib/salonAccess'
import { reloadStoreSalon } from '@/lib/subscription'
import { formatDate } from '@/lib/format'

// Aviso de renovação para o Admin quando faltam 7 dias ou menos: faixa no topo de toda página do painel
// (fica até renovar) e um popup ao abrir o app, uma vez por sessão. Vermelho nos últimos 2 dias.
export default function RenewalNotice() {
  const role = useRole()
  const salon = useSalonStore((s) => s.salon)
  const [paying, setPaying] = useState(false)
  const [popup, setPopup] = useState(false)

  const due = role === 'Admin' && isRenewalDue(salon)
  const days = subscriptionDaysLeft(salon)
  const urgent = days !== null && days <= 2
  const popupKey = `dauth-renewal-popup:${salon?.id}:${salon?.planEndsAt}`

  useEffect(() => {
    if (!due) return
    try {
      if (!sessionStorage.getItem(popupKey)) setPopup(true)
    } catch {
      setPopup(true)
    }
  }, [due, popupKey])

  function closePopup() {
    try { sessionStorage.setItem(popupKey, '1') } catch { /* sem storage: o popup volta na próxima abertura */ }
    setPopup(false)
  }

  if (!due) return null

  const dueDate = formatDate(salon.planEndsAt)
  const whenText = days <= 1 ? 'amanhã' : `em ${days} dias`
  const tone = urgent ? 'bg-danger text-white' : 'bg-brand text-white'

  return (
    <>
      <div
        role="alert"
        className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3.5 md:px-5 ${urgent ? 'bg-danger-soft border-danger/30' : 'bg-brand-soft border-brand/25'}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon name="alertCircle" size={20} />
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="font-display text-[15px] font-semibold text-ink">Sua assinatura vence {whenText}</p>
          <p className="text-[13px] text-ink-2">Renove até {dueDate} para não perder o acesso ao salão.</p>
        </div>
        <Button onClick={() => setPaying(true)} className={urgent ? '!border-danger !bg-danger hover:!opacity-90' : ''}>
          Renovar agora
        </Button>
      </div>

      {popup && !paying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={closePopup} />
          <div role="dialog" aria-label="Assinatura perto de vencer" className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-7 text-center shadow-md">
            <button onClick={closePopup} aria-label="Fechar aviso" className="absolute right-4 top-4 cursor-pointer text-ink-3 transition-colors hover:text-ink">
              <Icon name="x" size={16} />
            </button>
            <div className={`mx-auto mb-4 flex h-24 w-24 flex-col items-center justify-center rounded-full ${tone}`}>
              <span className="text-[34px] font-semibold leading-none">{Math.max(days, 1)}</span>
              <span className="mt-1 text-[11px] uppercase tracking-wider">{days <= 1 ? 'dia' : 'dias'}</span>
            </div>
            <h2 className="mb-2 font-display text-[20px] font-semibold text-ink">Sua assinatura está perto de vencer</h2>
            <p className="mb-6 text-[13.5px] leading-relaxed text-ink-2">
              Ela vence em {dueDate}. Renove agora para o salão continuar funcionando sem interrupção.
            </p>
            <div className="flex flex-col gap-2">
              <Button className="justify-center" onClick={() => { closePopup(); setPaying(true) }}>Renovar agora</Button>
              <Button variant="ghost" className="justify-center" onClick={closePopup}>Lembrar depois</Button>
            </div>
          </div>
        </div>
      )}

      {paying && (
        <UpgradeModal
          salonId={salon.id}
          defaultPlan={salon.plan}
          lockPlan
          onClose={() => setPaying(false)}
          onActivated={() => {
            setPaying(false)
            reloadStoreSalon().catch(() => window.location.reload())
          }}
        />
      )}
    </>
  )
}
