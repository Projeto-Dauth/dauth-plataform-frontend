import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import api from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import logo from '@/logo-dauth-agendamentos.png'

export default function RedefinirSenhaPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      addToast('Senha redefinida com sucesso. Faça login para continuar.', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      setApiError(err.response?.data?.error ?? 'Erro ao redefinir senha. O link pode ter expirado.')
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Dauth" className="w-14 h-14 rounded-xl object-cover mb-4" />
            <h1 className="font-display font-medium text-[28px] tracking-tight">Dauth Agendamentos</h1>
          </div>
          <div className="bg-surface border border-line rounded-[14px] p-8 text-center">
            <p className="text-[13px] text-ink-3 mb-6">
              Link inválido. Solicite um novo link de redefinição de senha.
            </p>
            <Link
              to="/esqueci-senha"
              className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      </div>
    )
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
          <h3 className="font-display font-medium text-[20px] tracking-tight mb-1">
            Criar nova senha
          </h3>
          <p className="text-[13px] text-ink-3 mb-6">
            Escolha uma nova senha para sua conta. Mínimo de 8 caracteres.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <PasswordField
              label="Nova senha"
              show={showPass}
              onToggle={() => setShowPass(v => !v)}
              error={errors.password?.message}
              inputProps={register('password', {
                required: 'Nova senha obrigatória',
                minLength: { value: 8, message: 'Mínimo de 8 caracteres' },
              })}
            />

            <PasswordField
              label="Confirmar nova senha"
              show={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
              error={errors.confirm?.message}
              inputProps={register('confirm', {
                required: 'Confirme a nova senha',
                validate: v => v === watch('password') || 'As senhas não coincidem',
              })}
            />

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
              Salvar nova senha
            </Button>
          </form>
        </div>

        <div className="text-center mt-5">
          <Link to="/login" className="text-[13px] text-ink-3 hover:text-ink transition-colors">
            Voltar ao login
          </Link>
        </div>

      </div>
    </div>
  )
}

function PasswordField({ label, show, onToggle, error, inputProps }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••••"
          className={`h-[42px] w-full pl-[14px] pr-10 rounded-md border bg-surface text-ink-2 font-body text-md
            placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors
            ${error ? 'border-danger' : 'border-line'}`}
          {...inputProps}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors"
          tabIndex={-1}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={15} />
        </button>
      </div>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  )
}
