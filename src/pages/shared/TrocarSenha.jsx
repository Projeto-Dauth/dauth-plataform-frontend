import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'

import { navItemsByRole } from '@/config/navItems'

const ROLE_REDIRECT = {
  Admin: '/admin',
  Profissional: '/profissional',
  Usuario: '/cliente',
}

function PasswordInput({ label, value, onChange, error, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {label && <label className="text-xs text-ink-3 font-medium">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`h-[42px] w-full px-[14px] pr-10 rounded-md border border-line bg-surface text-ink-2
            font-body text-md placeholder:text-ink-4
            focus:outline-none focus:border-brand transition-colors
            ${error ? 'border-danger' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors cursor-pointer"
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={15} />
        </button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}

export default function TrocarSenha() {
  const { user, clearMustChangePassword } = useAuthStore()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const isFirstAccess = user?.must_change_password ?? false

  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const e = {}
    if (!current) e.current = 'Informe a senha atual'
    if (!newPass || newPass.length < 8) e.newPass = 'Nova senha deve ter no mínimo 8 caracteres'
    if (newPass !== confirm) e.confirm = 'As senhas não coincidem'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.patch('/users/perfil/me/password', { current_password: current, password: newPass })
      clearMustChangePassword()
      addToast('Senha atualizada com sucesso')
      navigate(ROLE_REDIRECT[user?.role] ?? '/', { replace: true })
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao trocar senha', 'error')
    } finally {
      setSaving(false)
    }
  }

  const navItems = navItemsByRole[user?.role] ?? []

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole={user?.role}>
      {user?.role}
    </Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-md">
        <div className="mb-7">
          <h3 className="font-display font-medium text-[26px] tracking-tight">
            {isFirstAccess ? 'Defina sua senha' : 'Trocar senha'}
          </h3>
          <p className="text-[13px] text-ink-3 mt-1">
            {isFirstAccess
              ? 'Sua conta foi criada pelo administrador. Defina uma nova senha para continuar.'
              : 'Informe a senha atual e escolha uma nova'}
          </p>
        </div>
        {isFirstAccess && (
          <div className="mb-5 px-4 py-3 bg-warning-soft border border-warning/30 rounded-lg text-[13px] text-ink-2">
            A senha padrão é <span className="font-mono font-semibold">12345678</span>. Troque agora para proteger sua conta.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-6">
          <PasswordInput
            label="Senha atual"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            error={errors.current}
            placeholder="••••••••"
          />
          <PasswordInput
            label="Nova senha"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            error={errors.newPass}
            placeholder="Mínimo 8 caracteres"
          />
          <PasswordInput
            label="Confirmar nova senha"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            error={errors.confirm}
            placeholder="Repita a nova senha"
          />
          <div className="flex gap-2.5 mt-2">
            <Button type="submit" loading={saving}>
              {isFirstAccess ? 'Definir senha e entrar' : 'Atualizar senha'}
            </Button>
            {!isFirstAccess && (
              <NavLink to="/perfil">
                <Button type="button" variant="ghost">Cancelar</Button>
              </NavLink>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
