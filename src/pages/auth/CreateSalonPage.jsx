import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Button from '@/components/ui/Button'
import platformApi from '@/lib/platformApi'
import useSalonStore from '@/store/salonStore'
import { useToast } from '@/context/ToastContext'
import { PLANS, formatPlanPrice, TRIAL_MAX_PROFESSIONALS } from '@/config/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import Icon from '@/components/ui/Icons'
import { formatPhone } from '@/lib/phone'

const PLAN_OPTIONS = [
  { id: null, label: 'Trial', tagline: '7 dias grátis, decidir depois' },
  ...PLANS.map(p => ({ id: p.id, label: p.label, tagline: formatPlanPrice(p.priceCents) + '/mês' })),
]

// Lista completa (não relativa) do que cada opção inclui. As listas de `features` dos planos são
// incrementais ("Tudo do Essencial"), então acumula os itens de cada plano com os dos anteriores.
// Linhas de limite ("Até N profissionais") viram uma linha própria a partir de `maxProfessionals`.
const isMetaItem = (f) => f.startsWith('Tudo do') || f.startsWith('Até ') || f.startsWith('Sem limite')
const ALL_ITEMS = [...new Set(PLANS.flatMap(p => p.features.filter(f => !isMetaItem(f))))]

function planDetails(planId) {
  if (!planId) {
    // Trial: tudo, exceto WhatsApp (TRIAL_BLOCKED_FEATURES) e suporte prioritário (exclusivo de plano pago)
    const excluded = ['WhatsApp do salão', 'Suporte prioritário']
    return { included: ALL_ITEMS.filter(f => !excluded.includes(f)), professionals: `Até ${TRIAL_MAX_PROFESSIONALS} profissionais` }
  }
  const idx = PLANS.findIndex(p => p.id === planId)
  const included = PLANS.slice(0, idx + 1).flatMap(p => p.features.filter(f => !isMetaItem(f)))
  const max = PLANS[idx].maxProfessionals
  return { included, professionals: max ? `Até ${max} profissionais` : 'Profissionais sem limite' }
}

export default function CreateSalonPage() {
  const [apiError, setApiError] = useState('')
  const [plan, setPlan] = useState(null)
  const [createdSalon, setCreatedSalon] = useState(null)
  const navigate = useNavigate()
  const setSalon = useSalonStore((s) => s.setSalon)
  const { addToast } = useToast()

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async ({ name, phone, address }) => {
    setApiError('')
    try {
      const { data: salon } = await platformApi.post('/salon', { name, phone, address, plan })
      setSalon({ id: salon.id, name: salon.name, slug: salon.slug, plan: salon.plan, status: salon.status }, 'Admin', null)

      // Plano pago escolhido: nunca entra em trial — precisa pagar antes de acessar o salão.
      // Abre o modal de pagamento aqui mesmo, sem navegar pra dentro do produto ainda.
      if (plan) {
        setCreatedSalon(salon)
        return
      }

      addToast('Salão criado com sucesso!', 'success')
      navigate(`/${salon.slug}/admin`, { replace: true })
    } catch (err) {
      setApiError(err.response?.data?.error ?? 'Erro ao criar salão.')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md lg:max-w-[784px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-brand flex items-center justify-center mb-4">
            <span className="font-serif text-white text-2xl">D</span>
          </div>
          <h1 className="font-display font-medium text-[28px] tracking-tight">Configure seu salão</h1>
          <p className="text-sm text-ink-3 mt-1">Vamos criar o seu espaço na plataforma</p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="bg-surface border border-line rounded-lg p-8 w-full lg:max-w-md">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-ink-3 font-medium uppercase tracking-wider">Nome do salão</label>
              <input
                type="text"
                placeholder="Ex: Salão Bela Arte"
                className={`h-[42px] px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors ${errors.name ? 'border-danger' : 'border-line'}`}
                {...register('name', { required: 'Nome obrigatório' })}
              />
              {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-ink-3 font-medium uppercase tracking-wider">Telefone <span className="normal-case font-normal text-ink-4">(opcional)</span></label>
              <input
                type="tel"
                placeholder="(11) 9 8765-4321"
                className="h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
                {...register('phone', {
                  onChange: e => setValue('phone', formatPhone(e.target.value)),
                })}
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-xs text-ink-3 font-medium uppercase tracking-wider">Endereço <span className="normal-case font-normal text-ink-4">(opcional)</span></label>
              <input
                type="text"
                placeholder="Rua, número, bairro"
                className="h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
                {...register('address')}
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-xs text-ink-3 font-medium uppercase tracking-wider">Plano</label>
              <div className="grid grid-cols-2 gap-2">
                {PLAN_OPTIONS.map(opt => (
                  <button
                    key={opt.id ?? 'trial'}
                    type="button"
                    onClick={() => setPlan(opt.id)}
                    className={`text-left px-3.5 py-2.5 rounded-md border transition-colors ${
                      plan === opt.id ? 'border-brand bg-brand/5' : 'border-line hover:border-ink-3'
                    }`}
                  >
                    <p className="text-sm font-display font-medium text-ink">{opt.label}</p>
                    <p className="text-xs text-ink-3 mt-0.5">{opt.tagline}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-4 mt-1">
                {plan
                  ? 'Escolher um plano pago pula o trial — o pagamento é feito na hora, logo depois de criar o salão.'
                  : 'Trial dá 7 dias de acesso completo (exceto WhatsApp) pra decidir o plano com calma.'}
              </p>
            </div>

            {apiError && (
              <div className="mb-4 px-3.5 py-2.5 rounded-md bg-danger-soft border border-danger/20 text-sm text-danger">{apiError}</div>
            )}

            <Button type="submit" variant="primary" className="w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Criando…' : plan ? 'Criar salão e pagar' : 'Criar salão e entrar'}
            </Button>
            <Button type="button" variant="ghost" className="w-full justify-center mt-2" disabled={isSubmitting} onClick={() => navigate('/meus-saloes')}>
              Cancelar
            </Button>
          </form>
        </div>

        <PlanDetails planId={plan} />
        </div>
      </div>

      {createdSalon && (
        <UpgradeModal
          salonId={createdSalon.id}
          defaultPlan={plan}
          lockPlan
          onClose={() => navigate(`/${createdSalon.slug}/admin/configuracoes`, { replace: true })}
          onActivated={() => {
            addToast('Pagamento confirmado! Salão ativado.', 'success')
            navigate(`/${createdSalon.slug}/admin`, { replace: true })
          }}
        />
      )}
    </div>
  )
}

function PlanDetails({ planId }) {
  const { included, professionals } = planDetails(planId)
  const opt = PLAN_OPTIONS.find(o => o.id === planId)
  return (
    <aside className="w-full lg:flex-1 lg:sticky lg:top-6 bg-surface border border-line rounded-lg p-6">
      <p className="text-xs text-ink-3 font-medium uppercase tracking-wider">O que está incluso</p>
      <p className="font-display font-medium text-lg text-ink mt-1">{opt.label}</p>
      <p className="text-sm text-ink-3 mb-4">{opt.tagline}</p>
      <ul className="flex flex-col gap-2">
        {ALL_ITEMS.map(item => {
          const ok = included.includes(item)
          return (
            <li key={item} className={`flex items-center gap-2 text-sm ${ok ? 'text-ink-2' : 'text-ink-4'}`}>
              {ok
                ? <Icon name="check" size={14} className="text-success shrink-0" />
                : <span className="w-[14px] text-center shrink-0">—</span>}
              {item}
            </li>
          )
        })}
        <li className="flex items-center gap-2 text-sm text-ink-2 pt-1.5 mt-0.5 border-t border-line-3">
          <Icon name="check" size={14} className="text-success shrink-0" />
          {professionals}
        </li>
      </ul>
    </aside>
  )
}
