import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import platformApi from '@/lib/platformApi'

const ROLES = [
  { value: 'SalonOwner', label: 'Dono de salão', desc: 'Gerencie salões, equipe e agenda' },
  { value: 'Cliente',    label: 'Cliente',        desc: 'Descubra salões e agende serviços' },
]

export default function RegisterPage() {
  const [showPass, setShowPass] = useState(false)
  const [apiError, setApiError] = useState('')
  const [selectedRole, setSelectedRole] = useState('SalonOwner')
  const [sentTo, setSentTo] = useState(null)
  const [sentVia, setSentVia] = useState('email') // 'email' | 'whatsapp'

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async ({ name, phone, email, password }) => {
    setApiError('')
    try {
      await platformApi.post('/auth/register', { name, phone, email, password, platformRole: selectedRole })

      if (selectedRole === 'SalonOwner') {
        setSentVia('email')
        setSentTo(email)
      } else {
        setSentVia('whatsapp')
        setSentTo(phone)
      }
    } catch (err) {
      setApiError(err.response?.data?.error ?? 'Erro ao criar conta.')
    }
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits.length ? `(${digits}` : ''
    if (digits.length <= 3) return `(${digits.slice(0,2)}) ${digits[2]}`
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3)}`
    return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Painel esquerdo — brand ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-brand grain px-12 py-14">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="font-serif text-white text-xl">D</span>
          </div>
          <span className="font-display font-semibold text-[14px] text-white/80">Dauth Platform</span>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-5">Comece agora</p>
          <h2 className="font-serif text-[48px] font-light leading-[1.1] text-white tracking-wide mb-5">
            Seu negócio,<br />elevado.
          </h2>
          <p className="text-[13.5px] text-white/55 leading-relaxed max-w-[270px]">
            Junte-se a profissionais que gerenciam seus salões com eficiência e elegância.
          </p>
        </div>
        <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest">Plataforma Multi-tenant</p>
      </div>

      {/* ── Painel direito — form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-bg">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="font-serif text-white">D</span>
            </div>
            <span className="font-display font-semibold text-[14px] text-ink">Dauth Platform</span>
          </div>

          {sentTo ? (
            <>
              <h1 className="font-serif text-[36px] font-light text-ink leading-tight mb-1 tracking-tight">
                {sentVia === 'whatsapp' ? 'Confirme seu WhatsApp' : 'Confirme seu email'}
              </h1>
              <p className="text-sm text-ink-3 mb-8">
                {sentVia === 'whatsapp'
                  ? <>Enviamos um link de confirmação para o WhatsApp <strong className="text-ink">{sentTo}</strong>. Clique nele para ativar sua conta.</>
                  : <>Enviamos um link de confirmação para <strong className="text-ink">{sentTo}</strong>. Clique nele para ativar sua conta.</>}
              </p>
              <Link to="/login" className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-line text-ink-2 font-medium text-sm hover:border-ink-3 transition-colors">
                Ir para o login
              </Link>
            </>
          ) : (
          <>
          <h1 className="font-serif text-[36px] font-light text-ink leading-tight mb-1 tracking-tight">
            Criar conta
          </h1>
          <p className="text-sm text-ink-3 mb-8">Escolha como quer usar a plataforma.</p>

          {/* Seletor de role */}
          <div className="flex gap-2 p-1 rounded-lg bg-surface-3 mb-8">
            {ROLES.map((r) => (
              <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                className={`flex-1 flex flex-col items-center py-3 px-2 rounded-md transition-all text-center ${
                  selectedRole === r.value ? 'bg-surface shadow-sm' : 'hover:bg-surface/50'
                }`}>
                <span className={`text-[13px] font-display font-semibold mb-0.5 ${selectedRole === r.value ? 'text-brand' : 'text-ink-2'}`}>
                  {r.label}
                </span>
                <span className="text-[11px] text-ink-3 leading-tight">{r.desc}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off" className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow">Nome completo</label>
              <input type="text" autoComplete="off" placeholder="Seu nome"
                className={`h-11 bg-transparent border-b-[1.5px] text-ink text-md placeholder:text-ink-4 focus:outline-none transition-colors pb-1 ${errors.name ? 'border-danger' : 'border-line-3'}`}
                onFocus={e => !errors.name && (e.target.style.borderColor = '#8b4a2b')}
                onBlur={e => !errors.name && (e.target.style.borderColor = '')}
                {...register('name', { required: 'Nome obrigatório' })} />
              {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
            </div>

            {selectedRole === 'SalonOwner' && (
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow">Email</label>
                <input type="email" autoComplete="off" placeholder="voce@email.com"
                  className={`h-11 bg-transparent border-b-[1.5px] text-ink text-md placeholder:text-ink-4 focus:outline-none transition-colors pb-1 ${errors.email ? 'border-danger' : 'border-line-3'}`}
                  onFocus={e => !errors.email && (e.target.style.borderColor = '#8b4a2b')}
                  onBlur={e => !errors.email && (e.target.style.borderColor = '')}
                  {...register('email', {
                    required: selectedRole === 'SalonOwner' ? 'Email obrigatório' : false,
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' },
                  })} />
                {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="eyebrow">Telefone (WhatsApp)</label>
              <input type="tel" autoComplete="off" placeholder="(11) 9 8765-4321"
                className={`h-11 bg-transparent border-b-[1.5px] text-ink text-md placeholder:text-ink-4 focus:outline-none transition-colors pb-1 ${errors.phone ? 'border-danger' : 'border-line-3'}`}
                onFocus={e => !errors.phone && (e.target.style.borderColor = '#8b4a2b')}
                onBlur={e => !errors.phone && (e.target.style.borderColor = '')}
                {...register('phone', {
                  required: 'Telefone obrigatório',
                  onChange: e => setValue('phone', formatPhone(e.target.value)),
                })} />
              {errors.phone && <span className="text-xs text-danger">{errors.phone.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="eyebrow">Senha</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} autoComplete="off" placeholder="Mínimo 8 caracteres"
                  className={`w-full h-11 bg-transparent border-b-[1.5px] text-ink text-md placeholder:text-ink-4 focus:outline-none transition-colors pb-1 pr-8 ${errors.password ? 'border-danger' : 'border-line-3'}`}
                  onFocus={e => !errors.password && (e.target.style.borderColor = '#8b4a2b')}
                  onBlur={e => !errors.password && (e.target.style.borderColor = '')}
                  {...register('password', { required: 'Senha obrigatória', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 pb-1 text-ink-4 hover:text-ink-2 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
              {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
            </div>

            {apiError && (
              <div className="px-3.5 py-2.5 rounded-lg bg-danger-soft border border-danger/20 text-sm text-danger">{apiError}</div>
            )}

            <button type="submit" disabled={isSubmitting}
              className="mt-1 h-11 rounded-lg bg-brand text-white font-display font-semibold text-md hover:bg-brand/90 transition-colors active:scale-[0.98] disabled:opacity-60">
              {isSubmitting ? 'Criando conta…' : `Criar como ${selectedRole === 'SalonOwner' ? 'Dono de Salão' : 'Cliente'}`}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-ink-3">
            Já tem conta?{' '}
            <Link to="/login" className="text-brand hover:underline font-medium">Entrar</Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
