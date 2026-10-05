import { Link } from 'react-router-dom'
import UpgradeModal from '@/components/ui/UpgradeModal'
import useSalonStore from '@/store/salonStore'
import useAuthStore from '@/store/authStore'

// Textos por motivo do bloqueio (lib/salonAccess.js#paywallReason)
const COPY = {
  trial_over: {
    title: 'Seu período de teste acabou',
    subtitle: (name) => `Para continuar usando o Dauth em ${name}, escolha um plano. Seus dados estão guardados e voltam assim que o pagamento for confirmado.`,
  },
  pending_payment: {
    title: 'Conclua o pagamento para ativar seu salão',
    subtitle: (name) => `${name} será liberado assim que o pagamento for confirmado. Você pode manter o plano escolhido ou trocar por outro.`,
  },
}

// Tela única no lugar de todo o produto enquanto o salão não pode ser usado sem pagar (SalonLayout):
// trial encerrado ou plano pago ainda não pago. Admin escolhe o plano e paga aqui mesmo (mesmo
// seletor do upgrade); os demais só são avisados.
export default function PaywallScreen({ reason }) {
  const { salon, role, memberId, setSalon } = useSalonStore()
  const platformRole = useAuthStore((s) => s.user?.platformRole)
  const copy = COPY[reason]
  const backTo = platformRole === 'SalonOwner'
    ? { to: '/meus-saloes', label: 'Voltar para Meus salões' }
    : { to: '/meus-empregos', label: 'Voltar para Meus empregos' }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {role === 'Admin' ? (
        <UpgradeModal
          inline
          salonId={salon.id}
          defaultPlan={salon.plan ?? 'essencial'}
          title={copy.title}
          subtitle={copy.subtitle(salon.name)}
          onActivated={(plan) => setSalon({ ...salon, status: 'active', plan: plan ?? salon.plan }, role, memberId)}
        />
      ) : (
        <div className="bg-surface border border-line rounded-[20px] p-8 max-w-[460px] w-full text-center">
          <h2 className="font-display font-semibold text-[22px] text-ink mb-2">Salão indisponível no momento</h2>
          <p className="text-[13.5px] text-ink-2 leading-relaxed">
            O acesso a {salon.name} está pausado. Fale com o responsável pelo salão.
          </p>
        </div>
      )}
      <Link to={backTo.to} className="mt-6 text-[13px] text-ink-3 hover:text-ink transition-colors">
        {backTo.label}
      </Link>
    </div>
  )
}
