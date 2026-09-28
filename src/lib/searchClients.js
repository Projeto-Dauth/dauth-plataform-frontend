import api from '@/lib/api'

// Profissionais também usam o salão como clientes — busca junta as duas roles
// (2 chamadas em vez de 1 porque `GET /users?Role=` só aceita um valor por vez).
export async function searchClients(query) {
  const params = { limit: 20, ...(query ? { search: query } : {}) }
  const [usuarios, profissionais, admins] = await Promise.all([
    api.get('/users', { params: { ...params, Role: 'Usuario' } }),
    api.get('/users', { params: { ...params, Role: 'Profissional' } }),
    api.get('/users', { params: { ...params, Role: 'Admin' } }),
  ])
  return [...(usuarios.data.data ?? []), ...(profissionais.data.data ?? []), ...(admins.data.data ?? [])]
    .map(c => ({ value: c.UUID, label: c.Name }))
}
