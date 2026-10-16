import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'

const ROLE_LABEL = { Admin: 'Admin', Profissional: 'Profissional', Usuario: 'Cliente', Servico: 'Conta de serviço' }
const ROLE_COLOR = {
  Admin: 'bg-warning-soft text-warning',
  Profissional: 'bg-brand-soft text-brand',
  Usuario: 'bg-surface-3 text-ink-2',
  Servico: 'bg-surface-3 text-ink-2',
}

// Cartão de um salão em "Meus salões" — o mesmo para cliente, profissional, conta de serviço e Admin:
// só o básico (nome, endereço, papel) e o botão de entrar. Extras entram por slot:
// `badge` (ex.: situação do plano, só para Admin) e `footer` (ações da pessoa nesse salão).
// O código de acesso nunca aparece aqui.
export default function SalonCard({ member, onEnter, entering = false, enterLabel = 'Entrar', unavailable = false, badge, footer }) {
  const { salon } = member
  return (
    <div className={`flex flex-col p-5 bg-surface border border-line rounded-xl transition-all ${unavailable ? 'opacity-60' : 'hover:border-brand/40 hover:shadow-md'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
          <span className="font-display font-bold text-base text-brand">{salon.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <div className="font-display font-semibold text-md text-ink truncate">{salon.name}</div>
          {salon.address && <div className="text-[12px] text-ink-3 truncate">{salon.address}</div>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium ${ROLE_COLOR[member.role] ?? 'bg-surface-3 text-ink-3'}`}>
          {ROLE_LABEL[member.role] ?? member.role}
        </span>
        {badge}
      </div>

      <div className="mt-auto">
        {!unavailable && (
          <Button size="sm" className="w-full justify-center" onClick={() => onEnter(member)} loading={entering} aria-label={`${enterLabel} em ${salon.name}`}>
            {enterLabel}
            <Icon name="arrowRight" size={14} />
          </Button>
        )}
        {footer && <div className={`flex items-center gap-2 flex-wrap ${unavailable ? '' : 'mt-3 pt-3 border-t border-line'}`}>{footer}</div>}
      </div>
    </div>
  )
}
