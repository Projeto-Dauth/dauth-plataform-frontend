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
 */
export function usePaginatedList(fetchFn, deps = []) {
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef(1)

  const load = useCallback(async () => {
    setLoading(true)
    pageRef.current = 1
    try {
      const result = await fetchRef.current(1, PAGE_LIMIT)
      const data = result.data ?? []
      const total = result.pagination?.total ?? data.length
      setItems(data)
      setHasMore(total > PAGE_LIMIT)
    } catch {
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const loadMore = async () => {
    if (loadingMore) return
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    try {
      const result = await fetchRef.current(nextPage, PAGE_LIMIT)
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

  return { items, loading, loadingMore, hasMore, reload: load, loadMore }
}
