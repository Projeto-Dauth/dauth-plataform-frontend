import api from '@/lib/api'
import useSalonStore from '@/store/salonStore'
import { excludeMonitorAdmins } from '@/config/monitorAdmins'

// Equipe que atende no salão (Admin + Profissional, sem os admins "monitor"). Fonte única da lista usada
// em agenda, caixa, serviços, comissões e detalhes do agendamento: um par de buscas por salão, guardado
// por alguns minutos e compartilhado entre as telas (também enquanto a busca ainda está em andamento).
// Quem altera a equipe (remover/convidar) chama clearTeamCache().
const CACHE_MS = 2 * 60_000
let cache = null // { salonId, at, promise }

export function clearTeamCache() {
  cache = null
}

export function fetchTeam() {
  const salonId = useSalonStore.getState().salon?.id
  if (cache && cache.salonId === salonId && Date.now() - cache.at < CACHE_MS) return cache.promise

  const promise = Promise.all([
    api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
  ]).then(([admins, profs]) => excludeMonitorAdmins([...(admins.data.data ?? []), ...(profs.data.data ?? [])]))

  cache = { salonId, at: Date.now(), promise }
  // Falha não fica em cache: a próxima tela tenta de novo
  promise.catch(() => { if (cache?.promise === promise) cache = null })
  return promise
}
