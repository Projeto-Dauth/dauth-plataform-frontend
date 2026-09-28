import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import MoneyValue from '@/components/ui/MoneyValue'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'

const navItems = navItemsByRole['Profissional']

function formatPrice(p) {
  if (!p && p !== 0) return '—'
  return `R$ ${Number(p).toFixed(2).replace('.', ',')}`
}

export default function ProfissionalProdutos() {
  const { user } = useAuthStore()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/product', { params: { limit: 100 } })
      setProducts((data.data ?? []).filter(p => p.Active))
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional" />
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="mb-5 md:mb-6">
        <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Produtos</h3>
        <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Produtos disponíveis no salão</p>
      </div>

      {loading ? <PageSpinner /> : products.length === 0 ? (
        <EmptyState icon="package" title="Nenhum produto disponível" description="Não há produtos ativos no momento." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Produto', 'Descrição', 'Preço', 'Estoque'].map(h => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.UUID} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3.5 py-3 text-[13px] font-medium border-b border-line-2">{p.Name}</td>
                    <td className="px-3.5 py-3 text-[13px] text-ink-3 border-b border-line-2 max-w-[220px] truncate">
                      {p.Description || <span className="italic text-ink-4">—</span>}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[12px] text-ink-2 border-b border-line-2"><MoneyValue>{formatPrice(p.Price)}</MoneyValue></td>
                    <td className="px-3.5 py-3 font-mono text-[12px] border-b border-line-2">
                      <span className={p.Stock === 0 ? 'text-danger' : 'text-ink-2'}>{p.Stock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {products.map(p => (
              <div key={p.UUID} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-[14px]">{p.Name}</div>
                  <div className="font-display text-[16px] font-medium shrink-0"><MoneyValue>{formatPrice(p.Price)}</MoneyValue></div>
                </div>
                {p.Description && (
                  <div className="text-[12px] text-ink-3 mb-2 line-clamp-2">{p.Description}</div>
                )}
                <div className="text-[12px] text-ink-3">
                  Estoque: <span className={p.Stock === 0 ? 'text-danger font-medium' : ''}>{p.Stock}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  )
}
