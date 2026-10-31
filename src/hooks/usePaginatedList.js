import { useState, useCallback, useEffect, useRef } from 'react'

const PAGE_LIMIT = 30

/**
 * Hook de paginação com load more.
 *
 * fetchFn: (page, limit) => Promise<{ data: [], pagination: { total, page, limit } }>
 * deps: array de dependências que, quando mudam, resetam para página 1
 *
 * Ao trocar filtros (deps mudam), load() é chamado automaticamente e
 * substitui os items. loadMore() busca a próxima página e acumula.
 *
 * Lista nunca fica "atrasada" em relação aos filtros:
 * - no mesmo render em que um filtro muda, `loading` já é true e `items` vem vazio (antes, até o efeito rodar e a
 *   resposta chegar, a tela mostrava a lista do filtro anterior — clicável — com o filtro novo já na busca);
 * - resposta de uma busca antiga que chega depois da nova é descartada (digitar rápido não deixa o resultado errado).
 * `deps` precisam ser valores simples (texto, número, booleano): viram a chave do filtro.
 */
export function usePaginatedList(fetchFn, deps = []) {
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef(1)
  const requestRef = useRef(0) // só a busca mais recente pode gravar na lista
  const filterKey = JSON.stringify(deps)
  const [loadedKey, setLoadedKey] = useState(null) // de qual filtro são os items na tela

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    pageRef.current = 1
    try {
      const result = await fetchRef.current(1, PAGE_LIMIT)
      if (request !== requestRef.current) return
      const data = result.data ?? []
      const total = result.pagination?.total ?? data.length
      setItems(data)
      setHasMore(total > PAGE_LIMIT)
    } catch {
      if (request !== requestRef.current) return
      setItems([])
      setHasMore(false)
    } finally {
      if (request === requestRef.current) {
        setLoadedKey(filterKey)
        setLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const loadMore = async () => {
    if (loadingMore) return
    const request = requestRef.current
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    try {
      const result = await fetchRef.current(nextPage, PAGE_LIMIT)
      if (request !== requestRef.current) return // o filtro mudou no meio: a página é de outra lista
      const data = result.data ?? []
      const total = result.pagination?.total ?? 0
      setItems((prev) => [...prev, ...data])
      pageRef.current = nextPage
      setHasMore(total > nextPage * PAGE_LIMIT)
    } catch {
      // mantém items existentes
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { load() }, [load])

  const fresh = loadedKey === filterKey
  return { items: fresh ? items : [], loading: loading || !fresh, loadingMore, hasMore: fresh && hasMore, reload: load, loadMore }
}
