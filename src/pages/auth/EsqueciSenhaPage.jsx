import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Button from '@/components/ui/Button'
import api from '@/lib/api'
import logo from '@/logo-dauth-agendamentos.png'

export default function EsqueciSenhaPage() {
  const [sent, setSent] = useState(false)
  const [apiError, setApiError] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await api.post('/auth/forgot-password', { phone: data.phone })
      setSent(true)
    } catch (err) {
      setApiError(err.response?.data?.error ?? 'Erro ao processar solicitação. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Dauth" className="w-14 h-14 rounded-xl object-cover mb-4" />
          <h1 className="font-display font-medium text-[28px] tracking-tight">Dauth Agendamentos</h1>
          <p className="text-ink-3 text-[13px] mt-1">Salão da Candi</p>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a6b3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.58 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">
                Verifique seu WhatsApp
              </h3>
              <p className="text-[13px] text-ink-3 mb-6">
                Se o número estiver cadastrado, você receberá um link para redefinir sua senha. O link expira em 1 hora.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-1">
                Esqueci minha senha
              </h3>
              <p className="text-[13px] text-ink-3 mb-6">
                Informe seu telefone cadastrado. Enviaremos um link pelo WhatsApp para você criar uma nova senha.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="flex flex-col gap-1.5 mb-6">
                  <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    autoComplete="off"
                    placeholder="(11) 9 8765-4321"
                    className={`h-[42px] px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md
                      placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors
                      ${errors.phone ? 'border-danger' : 'border-line'}`}
                    {...register('phone', { required: 'Telefone obrigatório' })}
                    onChange={e => setValue('phone', formatPhone(e.target.value), { shouldValidate: true })}
                  />
                  {errors.phone && (
                    <span className="text-[11px] text-danger">{errors.phone.message}</span>
                  )}
                </div>

                {apiError && (
                  <div className="mb-4 px-3.5 py-2.5 rounded-md bg-danger-soft border border-danger/20 text-[13px] text-danger">
                    {apiError}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  loading={isSubmitting}
                >
                  Enviar link pelo WhatsApp
                </Button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <div className="text-center mt-5">
            <Link to="/login" className="text-[13px] text-ink-3 hover:text-ink transition-colors">
              Voltar ao login
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits[2]}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3)}`
  return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}-${digits.slice(7)}`
}
