import useSalonStore from '@/store/salonStore'

// ÚNICA fonte do papel da pessoa no salão atual ('Admin' | 'Profissional' | 'Servico' | 'Usuario' | null).
// Nunca ler o papel de authStore.user.role: ele é global, persiste entre salões e é sobrescrito por vários
// fluxos — foi o que fez o Admin cair no menu de Profissional nas telas compartilhadas (Perfil etc.).
// Teste de regressão: e2e/papel-menu.spec.js (que também barra `user.role` no código-fonte).
export function useRole() {
  return useSalonStore((s) => s.role)
}
