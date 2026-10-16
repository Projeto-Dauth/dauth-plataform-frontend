import api from '@/lib/api'
import useSalonStore from '@/store/salonStore'
import useAuthStore from '@/store/authStore'

export const ROLE_PATH = { Admin: 'admin', Profissional: 'profissional', Usuario: 'cliente', Servico: 'admin' }

// Entrar num salão a partir de um membership de GET /salon/my. Fonte única para "Meus salões" e
// para o "Trocar salão" do menu: grava o salão no store, carrega o papel/permissões da pessoa
// naquele salão (sem isso o menu de quem tem módulos bloqueados mostra tudo até recarregar) e navega.
export async function enterSalon(member, navigate) {
  const { salon } = member
  useSalonStore.getState().setSalon(
    {
      id: member.salonId, name: salon.name, slug: salon.slug, plan: salon.plan, status: salon.status,
      trialEndsAt: salon.trialEndsAt, colorPalette: salon.colorPalette ?? null, paymentMethods: salon.paymentMethods,
    },
    member.role, member.id,
  )
  try {
    const headers = { 'x-salon-id': member.salonId }
    const { data: perfil } = await api.get('/users/perfil/me', { headers })
    const permissions = ['Profissional', 'Servico'].includes(perfil.Role)
      ? await api.get(`/professional/${perfil.UUID}/permissions`, { headers }).then(r => r.data.data).catch(() => null)
      : null
    useAuthStore.getState().updateUser({
      id: perfil.UUID, publicId: perfil.UUID, role: perfil.Role, must_change_password: perfil.Must_change_password, permissions,
    })
  } catch { /* o SalonLayout recarrega o perfil se falhar aqui */ }
  navigate(`/${salon.slug}/${ROLE_PATH[member.role] ?? 'admin'}`, { replace: true })
}
