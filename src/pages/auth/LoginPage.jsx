import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Button from '@/components/ui/Button'
import useAuthStore from '@/store/authStore'
import { useToast } from '@/context/ToastContext'
import platformApi from '@/lib/platformApi'
import { formatPhone } from '@/lib/phone'

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false)
  const [apiError, setApiError] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const { addToast } = useToast()

  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired')
      addToast('Sua sessão expirou. Faça login novamente.', 'warning')
    }
  }, [])

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async ({ identifier, password }) => {
    setApiError('')
    try {
      const isEmail = identifier.includes('@')
      const body = isEmail ? { email: identifier, password } : { phone: identifier, password }
      const { data } = await platformApi.post('/auth/login', body)
      login({ id: data.user.id, name: data.user.name, platformRole: data.user.platformRole })

      const redirect = searchParams.get('redirect')
      if (redirect?.startsWith('/')) return navigate(redirect, { replace: true })

      const { platformRole, memberRole } = data.user
      if (platformRole === 'SalonOwner') return navigate('/meus-saloes', { replace: true })
      if (['Profissional', 'Admin', 'Servico'].includes(memberRole)) return navigate('/meus-empregos', { replace: true })
      navigate('/marketplace', { replace: true })
    } catch (err) {
      setApiError(err.response?.data?.error ?? 'Erro ao entrar. Tente novamente.')
    }
  }

  // Telefone (SalonMember/Cliente) ou email (SalonOwner) no mesmo campo. Só aplica a máscara
  // de telefone se o valor ainda não tem nenhuma letra — senão a máscara vai comendo as letras
  // do email enquanto o usuário digita, antes mesmo do "@" aparecer.
  function formatIdentifier(value) {
    if (/[a-zA-Z]/.test(value)) return value
    return formatPhone(value)
  }

  return (
    <div className="min-h-screen bg-bg flex">

      {/* Brand section — desktop only */}
      <div className="hidden md:flex flex-col justify-between w-[420px] shrink-0 bg-brand px-12 py-14 grain">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="font-serif text-white text-xl">D</span>
          </div>
          <span className="font-display font-semibold text-[14px] text-white/90">Dauth</span>
        </div>
        <div>
          <p className="font-serif text-[46px] font-light leading-[1.15] text-white tracking-wide mb-6">
            Beleza com<br />excelência.
          </p>
          <p className="text-[13.5px] text-white/60 leading-relaxed max-w-[280px]">
            Gerencie múltiplos salões de beleza em um só lugar. Agendamentos, profissionais e caixa integrados.
          </p>
        </div>
        <p className="text-[11px] text-white/30 font-mono tracking-widest uppercase">Sistema de agendamentos</p>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Brand — mobile only */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <div className="w-14 h-14 rounded-xl bg-brand flex items-center justify-center mb-4">
              <span className="font-serif text-white text-2xl">D</span>
            </div>
            <h1 className="font-display font-medium text-[28px] tracking-tight">Dauth</h1>
          </div>

          {/* Card */}
          <div className="bg-surface border border-line rounded-[14px] p-8">
            <h3 className="font-display font-medium text-[20px] tracking-tight mb-1">
              Entrar na sua conta
            </h3>
            <p className="text-[13px] text-ink-3 mb-6">Bem-vindo de volta.</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">

              {/* Telefone (produto/salão) ou email (dono de salão) */}
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">
                  Telefone ou email
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="(11) 9 9999-9999 ou voce@email.com"
                  className={`h-[42px] px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md
                    placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors
                    ${errors.identifier ? 'border-danger' : 'border-line'}`}
                  {...register('identifier', {
                    required: 'Telefone ou email obrigatório',
                    onChange: e => setValue('identifier', formatIdentifier(e.target.value)),
                  })}
                />
                {errors.identifier && (
                  <span className="text-[11px] text-danger">{errors.identifier.message}</span>
                )}
              </div>

              {/* Senha */}
              <div className="flex flex-col gap-1.5 mb-6">
                <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="off"
                    placeholder="Mínimo 8 caracteres"
                    className={`h-[42px] w-full pl-[14px] pr-10 rounded-md border bg-surface text-ink-2 font-body text-md
                      placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors
                      ${errors.password ? 'border-danger' : 'border-line'}`}
                    {...register('password', { required: 'Senha obrigatória' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors"
                    tabIndex={-1}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      {showPass
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M1 1l22 22" /></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      }
                    </svg>
                  </button>
                </div>
                {errors.password && (
                  <span className="text-[11px] text-danger">{errors.password.message}</span>
                )}
              </div>

              {apiError && (
                <div className="mb-4 px-3.5 py-2.5 rounded-md bg-danger-soft border border-danger/20 text-[13px] text-danger">
                  {apiError}
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full justify-center" loading={isSubmitting}>
                Entrar
              </Button>
            </form>

            {/* Links */}
            <div className="mt-4 pt-4 border-t border-line flex justify-between">
              <Link to="/esqueci-senha" className="text-[13px] text-ink-3 hover:text-ink transition-colors">
                Esqueci a senha
              </Link>
            </div>
          </div>

          <div className="flex justify-center mt-5">
            <Link to="/register" className="text-[13px] text-ink-3 hover:text-ink transition-colors">
              Não tem conta? <span className="text-brand font-medium">Criar conta</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
