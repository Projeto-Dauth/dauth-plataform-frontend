import api from '@/lib/api'
import useAuthStore from '@/store/authStore'

// Sair da conta — fonte única: encerra a sessão no servidor (se falhar, segue) e limpa o login guardado no navegador.
// Quem chama decide para onde ir depois (login, ou login voltando para a página atual).
export async function signOut() {
  try { await api.post('/auth/logout') } catch { /* sessão já pode ter caído; limpa do mesmo jeito */ }
  useAuthStore.getState().logout()
}
