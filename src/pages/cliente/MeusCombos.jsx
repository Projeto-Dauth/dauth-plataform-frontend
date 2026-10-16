import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import ClienteSidebar from '@/components/layout/ClienteSidebar'
import Icon from '@/components/ui/Icons'
import ComboCard from '@/components/ui/ComboCard'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { useTour } from '@/hooks/useTour'
import { clienteCombosSteps } from '@/tours/clienteCombosTour'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate } from '@/lib/format'

function ExplorarCard({ pkg }) {
  const items = pkg.items ?? []

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 md:p-6 flex flex-col">
      <div className="flex justify-between items-start pb-4 border-b border-line-2 mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand mb-1">Pacote</div>
          <h4 className="font-display font-medium text-[17px] md:text-[18px] tracking-tight leading-snug">{pkg.Name}</h4>
          {pkg.Available_until && (
            <div className="font-mono text-[11px] text-ink-3 mt-1">Válido até {formatDate(pkg.Available_until)}</div>
          )}
        </div>
        <div className="font-display font-medium text-[20px] md:text-[22px] tracking-tight flex-shrink-0 text-brand">
          <MoneyValue>{formatCurrency(pkg.Price)}</MoneyValue>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 mb-4">
        {items.length === 0 ? (
          <div className="text-[12px] text-ink-3 italic">Nenhum serviço listado</div>
        ) : items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="scissors" size={12} className="text-ink-4 shrink-0" />
              <span className="truncate">{item.Service?.Name ?? item.Name ?? '—'}</span>
            </div>
            <span className="font-mono text-[11.5px] px-2 py-[2px] bg-surface-2 rounded-full text-ink-2 shrink-0 ml-2">
              ×{item.Quantity}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-line-2">
        <p className="text-[12px] text-ink-3">Interesse? Fale com a equipe do salão para adquirir este combo.</p>
      </div>
    </div>
  )
}

export default function MeusCombos() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('meus')

  const [combos, setCombos] = useState([])
  const [loadingCombos, setLoadingCombos] = useState(true)
  const { restartTour } = useTour('cliente_combos', clienteCombosSteps, !loadingCombos)

  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    api.get(`/package/client/${user.id}`)
      .then(({ data }) => setCombos(data.data ?? []))
      .catch(() => setCombos([]))
      .finally(() => setLoadingCombos(false))
  }, [user?.id])

  useEffect(() => {
    if (tab !== 'explorar' || catalogLoaded) return
    setLoadingCatalog(true)
    api.get('/package')
      .then(async ({ data }) => {
        const pkgs = data.data ?? []
        const itemResults = await Promise.all(
          pkgs.map((p) => api.get(`/package/${p.UUID}/items`).then((r) => r.data.data ?? []).catch(() => []))
        )
        setCatalog(pkgs.map((p, i) => ({ ...p, items: itemResults[i] })))
        setCatalogLoaded(true)
      })
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCatalog(false))
  }, [tab, catalogLoaded])

  const ativos = combos.filter(c => c.Status === 'ativo' || c.Status === 'pendente')
  const historico = combos.filter(c => c.Status === 'concluido' || c.Status === 'cancelado')

  return (
    <AppLayout sidebar={<ClienteSidebar user={user} />}>
      <div className="flex justify-between items-end mb-5 md:mb-7">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Combos</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Seus pacotes e o catálogo disponível</p>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
      </div>

      {/* Abas */}
      <div data-tour="combos-abas" className="flex gap-1 mb-6 md:mb-7 border-b border-line">
        {[
          { key: 'meus', label: 'Meus combos' },
          { key: 'explorar', label: 'Explorar combos' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 md:px-4 py-2 md:py-2.5 text-[13px] md:text-[13.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer
              ${tab === key
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-3 hover:text-ink-2'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Meus combos ── */}
      {tab === 'meus' && (
        loadingCombos ? (
          <PageSpinner />
        ) : combos.length === 0 ? (
          <EmptyState
            icon="package"
            title="Nenhum combo adquirido"
            description="Explore nossos pacotes e economize em cada atendimento."
            action={() => setTab('explorar')}
            actionLabel="Explorar combos"
          />
        ) : (
          <>
            {ativos.length > 0 && (
              <>
                <h4 className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">
                  Ativos · {ativos.length}
                </h4>
                <div data-tour="combos-lista" className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-7 md:mb-8">
                  {ativos.map(c => <ComboCard key={c.UUID} combo={c} />)}
                </div>
              </>
            )}
            {historico.length > 0 && (
              <>
                <h4 className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">
                  Histórico · {historico.length}
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {historico.map(c => <ComboCard key={c.UUID} combo={c} />)}
                </div>
              </>
            )}
          </>
        )
      )}

      {/* ── Explorar combos ── */}
      {tab === 'explorar' && (
        loadingCatalog ? (
          <PageSpinner />
        ) : catalog.length === 0 ? (
          <EmptyState
            icon="package"
            title="Nenhum combo disponível"
            description="Em breve novos pacotes estarão disponíveis."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {catalog.map(pkg => <ExplorarCard key={pkg.UUID} pkg={pkg} />)}
          </div>
        )
      )}
    </AppLayout>
  )
}
