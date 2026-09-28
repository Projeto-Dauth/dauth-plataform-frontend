import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Button from '@/components/ui/Button'
import platformApi from '@/lib/platformApi'
import useSalonStore from '@/store/salonStore'
import { useToast } from '@/context/ToastContext'
import { PLANS, formatPlanPrice } from '@/config/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'

const PLAN_OPTIONS = [
  { id: null, label: 'Trial', tagline: '7 dias grátis, decidir depois' },
  ...PLANS.map(p => ({ id: p.id, label: p.label, tagline: formatPlanPrice(p.priceCents) + '/mês' })),
]

export default function CreateSalonPage() {
  const [apiError, setApiError] = useState('')
  const [plan, setPlan] = useState(null)
  const [createdSalon, setCreatedSalon] = useState(null)
  const navigate = useNavigate()
  const setSalon = useSalonStore((s) => s.setSalon)
  const { addToast } = useToast()

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm()
  const nameValue = watch('name', '')

  const onSubmit = async ({ name, slug, phone, address }) => {
    setApiError('')
    try {
      const { data: salon } = await platformApi.post('/salon', { name, slug, phone, address, plan })
      setSalon({ id: salon.id, name: salon.name, slug: salon.slug, plan: salon.plan, status: salon.status }, 'Admin', null)

      // Plano pago escolhido: nunca entra em trial — precisa pagar antes de acessar o salão.
      // Abre o modal de pagamento aqui mesmo, sem navegar pra dentro do produto ainda.
      if (plan) {
        setCreatedSalon(salon)
        return
      }

      addToast('Salão criado com sucesso!', 'success')
      navigate('/admin', { replace: true })
    } catch (err) {
      setApiError(err.response?.data?.error ?? 'Erro ao criar salão.')
    }
  }

  const generateSlug = (name) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits.length ? `(${digits}` : ''
    if (digits.length <= 3) return `(${digits.slice(0,2)}) ${digits[2]}`
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3)}`
    return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-brand flex items-center justify-center mb-4">
            <span className="font-serif text-white text-2xl">D</span>
          </div>
          <h1 className="font-display font-medium text-[28px] tracking-tight">Configure seu salão</h1>
          <p className="text-sm text-ink-3 mt-1">Vamos criar o seu espaço na plataforma</p>
        </div>

        <div className="bg-surface border border-line rounded-lg p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-ink-3 font-medium uppercase tracking-wider">Nome do salão</label>
              <input
                type="text"
                placeholder="Ex: Salão Bela Arte"
                className={`h-[42px] px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors ${errors.name ? 'border-danger' : 'border-line'}`}
                {...register('name', { required: 'Nome obrigatório' })}
                onChange={(e) => {
                  setValue('name', e.target.value)
                  setValue('slug', generateSlug(e.target.value))
                }}
              />
              {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-ink-3 font-medium uppercase tracking-wider">
                URL do salão <span className="normal-case font-normal text-ink-4">(slug)</span>
              </label>
              <div className="flex items-center border rounded-md overflow-hidden focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/12 transition-colors border-line">
                <span className="px-3 text-ink-4 text-sm bg-surface-2 border-r border-line h-[42px] flex items-center shrink-0">dauth.app/s/</span>
                <input
                  type="text"
                  placeholder="bela-arte"
                  className="flex-1 h-[42px] px-3 bg-surface text-ink-2 font-mono text-md focus:outline-none"
                  {...register('slug', { required: 'Slug obrigatório', pattern: { value: /^[a-z0-9-]+$/, message: 'Apenas letras, números e hífens' } })}
                />
              </div>
              {errors.slug && <span className="text-xs text-danger">{errors.slug.message}</span>}
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
      </div>

      {createdSalon && (
        <UpgradeModal
          salonId={createdSalon.id}
          defaultPlan={plan}
          lockPlan
          onClose={() => navigate('/admin/configuracoes', { replace: true })}
          onActivated={() => {
            addToast('Pagamento confirmado! Salão ativado.', 'success')
            navigate('/admin', { replace: true })
          }}
        />
      )}
    </div>
  )
}
