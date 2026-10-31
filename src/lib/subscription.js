import platformApi from '@/lib/platformApi'
import useSalonStore from '@/store/salonStore'
import { refreshStoreSalon } from '@/lib/salonAccess'

// Depois de um pagamento confirmado: busca o salão no servidor e atualiza o cache do store
// (plano, status e fim do período mudaram). Sem isso a tela continuaria vendo o vencimento antigo.
export async function reloadStoreSalon() {
  const { salon: cur, role, memberId, setSalon } = useSalonStore.getState()
  if (!cur) return
  const { data } = await platformApi.get('/salon/my')
  const fresh = (Array.isArray(data) ? data : []).find((m) => m.salon?.id === cur.id)?.salon
  if (fresh) setSalon(refreshStoreSalon(cur, fresh), role, memberId)
}
