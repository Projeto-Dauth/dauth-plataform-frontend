import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import ComboCard from '@/components/ui/ComboCard'
import LoadMoreButton from '@/components/ui/LoadMoreButton'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { searchClients } from '@/lib/searchClients'
import { navItemsByRole } from '@/config/navItems'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate } from '@/lib/format'

const navItems = navItemsByRole['Admin']

const EMPTY_PKG = { Name: '', Price: '', Available_until: '' }
const EMPTY_DRAFT_ITEM = { service_id: '', quantity: 1, unit_price: '', commission_override: '' }

const SOLD_STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'ativo', label: 'Ativos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'concluido', label: 'Concluídos' },
  { key: 'cancelado', label: 'Cancelados' },
]

// Visão geral pro Admin: quais clientes têm pacotes, quais pacotes, e o status de cada
// um — sem precisar abrir cliente por cliente (GET /package/sold, ver decisions.md).
// Reaproveita o ComboCard já usado em "Meus combos" e no painel do cliente, pra manter a
// mesma linguagem visual de status/progresso em todo o sistema.
function PacotesVendidos() {
  const { addToast } = useToast()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [concludingId, setConcludingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  async function handleCancelSale(combo) {
    setCancellingId(combo.UUID)
    try {
      await api.patch(`/package/client/${combo.UUID}/cancel`)
      addToast('Venda do pacote cancelada', 'success')
      reload()
      return true
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao cancelar venda', 'error')
      return false
    } finally {
      setCancellingId(null)
    }
  }

  const { items, loading, loadingMore, hasMore, loadMore, reload } = usePaginatedList(
    (page, limit) => api.get('/package/sold', { params: { page, limit, status: status || undefined, search: search || undefined } }).then(r => r.data),
    [status, search]
  )

  async function handleConclude(combo, note) {
    setConcludingId(combo.UUID)
    try {
      await api.patch(`/package/client/${combo.UUID}/conclude`, { Note: note })
      addToast('Pacote marcado como concluído', 'success')
      reload()
      return true
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao concluir pacote', 'error')
      return false
    } finally {
      setConcludingId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente..." className={inputCls + ' md:max-w-xs'} />
        <div className="flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-xl shrink-0 overflow-x-auto">
          {SOLD_STATUS_FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setStatus(key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                status === key
                  ? 'bg-surface text-ink shadow-sm border border-line'
                  : 'text-ink-3 hover:text-ink'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <PageSpinner /> : items.length === 0 ? (
        <EmptyState icon="package" title="Nenhum pacote vendido" description="Pacotes vendidos a clientes aparecem aqui." />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((c) => (
              <ComboCard
                key={c.UUID}
                combo={c}
                clientName={c.Client?.Name ?? '—'}
                onConclude={handleConclude}
                concluding={concludingId === c.UUID}
                onCancelSale={handleCancelSale}
                cancelling={cancellingId === c.UUID}
              />
            ))}
          </div>
          {hasMore && <div className="mt-5"><LoadMoreButton onClick={loadMore} loading={loadingMore} /></div>}
        </>
      )}
    </div>
  )
}

export default function AdminCombos() {
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const mainView = searchParams.get('view') === 'vendidos' ? 'vendidos' : 'catalogo'
  function setMainView(v) {
    setSearchParams(v === 'vendidos' ? { view: 'vendidos' } : {}, { replace: true })
  }

  const [packages, setPackages] = useState([])  // [{ ...pkg, items: [] }]
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [pkgTab, setPkgTab] = useState('ativos')  // 'ativos' | 'desativados'

  // Drawer pacote
  const [pkgDrawer, setPkgDrawer] = useState(false)  // false | 'create' | uuid
  const [pkgForm, setPkgForm] = useState(EMPTY_PKG)
  const [draftItems, setDraftItems] = useState([])   // serviços adicionados antes de salvar
  const [draftItem, setDraftItem] = useState(EMPTY_DRAFT_ITEM)
  const [savingPkg, setSavingPkg] = useState(false)
  const [deletePkg, setDeletePkg] = useState(null)
  const [deletingPkg, setDeletingPkg] = useState(false)

  // Drawer de itens (gerenciar serviços do pacote) — tudo em rascunho local
  // (draftPkgItems/deletedItemIds); só grava no banco ao clicar em "Salvar" (PUT em lote).
  const [itemsDrawer, setItemsDrawer] = useState(null)  // uuid do pacote
  const [draftPkgItems, setDraftPkgItems] = useState([])  // [{ key, uuid|null, service_id, name, quantity, unit_price, commission_override }]
  const [deletedItemIds, setDeletedItemIds] = useState([])
  const [newItem, setNewItem] = useState({ service_id: '', quantity: 1, unit_price: '', commission_override: '' })
  const [savingItems, setSavingItems] = useState(false)
  const [editingItemKey, setEditingItemKey] = useState(null)
  const [editItemForm, setEditItemForm] = useState({ unit_price: '', commission_override: '' })

  // Modal vender
  const [sellPkg, setSellPkg] = useState(null)  // { UUID, Name }
  const [sellClientId, setSellClientId] = useState('')
  const [selling, setSelling] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data: pkgData } = await api.get('/package', { params: { limit: 100 } })
      const pkgs = pkgData.data ?? []
      setPackages(pkgs.map((p) => ({ ...p, items: p.Service_package_items ?? [] })))
    } catch {
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    api.get('/service', { params: { limit: 100 } }).then(({ data }) => setServices(data.data ?? [])).catch(() => {})
  }, [])

  // ── Pacote handlers ──────────────────────────────────────────────────────

  function openCreate() {
    setPkgForm(EMPTY_PKG)
    setDraftItems([])
    setDraftItem(EMPTY_DRAFT_ITEM)
    setPkgDrawer('create')
  }

  // Interpreta o formulário "Adicionar serviço" (dos dois drawers). Retorna
  // `{ item: null }` quando está totalmente vazio (nada pendente), `{ error }`
  // quando está preenchido pela metade, ou `{ item }` pronto para entrar na lista.
  // Serve tanto para o botão "Adicionar" quanto para o "Salvar", que precisa
  // recolher o que o Admin digitou mas esqueceu de adicionar — antes esse item
  // era descartado em silêncio e a soma travada acusava valor a menos.
  function buildFormItem(form) {
    const untouched = !form.service_id && form.unit_price === '' && form.commission_override === ''
    if (untouched) return { item: null }
    if (!form.service_id) return { error: 'Selecione um serviço' }
    if (form.unit_price === '' || form.commission_override === '') {
      return { error: 'Informe o valor por sessão e a comissão deste serviço' }
    }
    const svc = services.find((s) => s.UUID === form.service_id)
    return {
      item: {
        service_id: form.service_id,
        name: svc?.Name ?? '—',
        quantity: Number(form.quantity) || 1,
        unit_price: Number(form.unit_price),
        commission_override: Number(form.commission_override),
      }
    }
  }

  function addDraftItem() {
    const { item, error } = buildFormItem(draftItem)
    if (!item) { addToast(error ?? 'Selecione um serviço', 'warning'); return }
    setDraftItems((prev) => [...prev, item])
    setDraftItem(EMPTY_DRAFT_ITEM)
  }

  function removeDraftItem(idx) {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function openEdit(pkg) {
    setPkgForm({
      Name: pkg.Name,
      Price: pkg.Price,
      Available_until: pkg.Available_until ? pkg.Available_until.split('T')[0] : '',
    })
    setPkgDrawer(pkg.UUID)
  }

  async function handleSavePkg(e) {
    e.preventDefault()

    // Recolhe o serviço que ficou digitado no formulário sem o clique em
    // "Adicionar serviço" — ele conta para o pacote igual aos demais.
    let itemsToSave = draftItems
    if (pkgDrawer === 'create') {
      const { item: pending, error: pendingError } = buildFormItem(draftItem)
      if (pendingError) { addToast(pendingError, 'warning'); return }
      if (pending) itemsToSave = [...draftItems, pending]
      if (itemsToSave.length === 0) {
        addToast('Adicione ao menos um serviço ao pacote antes de criar', 'warning')
        return
      }
      // Confere a soma travada ANTES do POST — o backend também valida, mas lá o pacote
      // já teria sido criado e o drawer fecharia, jogando fora a lista de serviços.
      const sum = itemsToSave.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0)
      const price = Number(pkgForm.Price) || 0
      if (Math.abs(sum - price) > 0.01) {
        addToast(
          `A soma dos itens (${formatCurrency(sum)}) não bate com o preço do pacote (${formatCurrency(price)}). Ajuste antes de salvar.`,
          'warning'
        )
        return
      }
    }
    setSavingPkg(true)
    const body = {
      Name: pkgForm.Name,
      Price: Number(pkgForm.Price),
      ...(pkgForm.Available_until ? { Available_until: pkgForm.Available_until } : {}),
    }
    try {
      if (pkgDrawer === 'create') {
        const { data: created } = await api.post('/package', body)
        const newId = created.data?.UUID ?? created.UUID
        if (itemsToSave.length > 0) {
          try {
            // PUT em lote — mesma rota usada por "gerenciar itens": valida a soma travada
            // UMA VEZ contra o conjunto final, não por item, então não importa a ordem de
            // preenchimento nem sofre com estado intermediário incorreto.
            await api.put(`/package/${newId}/items`, {
              items: itemsToSave.map((item) => ({
                Service_id: item.service_id,
                Quantity: item.quantity,
                Unit_price: item.unit_price,
                Commission_override: item.commission_override,
              })),
              deleted_ids: [],
            })
          } catch (itemErr) {
            // O pacote já existe (POST /package teve sucesso) — não tentar de novo do
            // zero. Fecha o drawer e manda o Admin terminar de ajustar os valores pelo
            // "gerenciar itens" (ícone +).
            addToast(
              `Pacote criado, mas os serviços não puderam ser salvos: ${itemErr.response?.data?.error || 'erro desconhecido'} Ajuste em "gerenciar itens".`,
              'warning'
            )
            setPkgDrawer(false)
            loadAll()
            return
          }
        }
        addToast('Pacote criado', 'success')
      } else {
        await api.patch(`/package/${pkgDrawer}`, body)
        addToast('Pacote atualizado', 'success')
      }
      setPkgDrawer(false)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao salvar pacote', 'error')
    } finally {
      setSavingPkg(false)
    }
  }

  async function handleToggleActive(pkg) {
    try {
      await api.patch(`/package/${pkg.UUID}`, { Active: !pkg.Active })
      addToast(pkg.Active ? 'Pacote desativado' : 'Pacote ativado', 'success')
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar pacote', 'error')
    }
  }

  async function handleDeletePkg() {
    if (!deletePkg) return
    setDeletingPkg(true)
    try {
      await api.delete(`/package/${deletePkg.UUID}`)
      addToast('Pacote excluído', 'success')
      setDeletePkg(null)
      loadAll()
    } catch (err) {
      if (err.response?.data?.code === 'FK_VIOLATION') {
        addToast('Este pacote já foi vendido para algum cliente e não pode ser excluído — use "Desativar" para escondê-lo da venda.', 'error')
      } else {
        addToast(err.response?.data?.error || 'Erro ao excluir pacote', 'error')
      }
    } finally {
      setDeletingPkg(false)
    }
  }

  // ── Item handlers — tudo local, PUT em lote só no "Salvar" ─────────────────

  function openItems(pkg) {
    setDraftPkgItems(pkg.items.map((it) => ({
      key: it.UUID,
      uuid: it.UUID,
      service_id: it.Service_id,
      name: it.Service?.Name ?? '—',
      quantity: it.Quantity,
      unit_price: it.Unit_price ?? null,
      commission_override: it.Commission_override ?? null,
    })))
    setDeletedItemIds([])
    setNewItem({ service_id: '', quantity: 1, unit_price: '', commission_override: '' })
    setEditingItemKey(null)
    setItemsDrawer(pkg.UUID)
  }

  // Insere o item na lista, somando a quantidade se o serviço já estiver lá.
  function mergeDraftPkgItem(list, item) {
    const idx = list.findIndex((it) => it.service_id === item.service_id)
    if (idx < 0) {
      return [...list, { key: `new-${Date.now()}-${Math.random()}`, uuid: null, ...item }]
    }
    const updated = [...list]
    updated[idx] = {
      ...updated[idx],
      quantity: updated[idx].quantity + item.quantity,
      unit_price: item.unit_price,
      commission_override: item.commission_override,
    }
    return updated
  }

  function addDraftPkgItem() {
    const { item, error } = buildFormItem(newItem)
    if (!item) { addToast(error ?? 'Selecione um serviço', 'warning'); return }
    setDraftPkgItems((prev) => mergeDraftPkgItem(prev, item))
    setNewItem({ service_id: '', quantity: 1, unit_price: '', commission_override: '' })
  }

  function removeDraftPkgItem(item) {
    if (item.uuid) setDeletedItemIds((prev) => [...prev, item.uuid])
    setDraftPkgItems((prev) => prev.filter((it) => it.key !== item.key))
    if (editingItemKey === item.key) setEditingItemKey(null)
  }

  function openEditItemOverride(item) {
    setEditingItemKey(item.key)
    setEditItemForm({
      unit_price: item.unit_price ?? '',
      commission_override: item.commission_override ?? '',
    })
  }

  function saveEditItemOverride(item) {
    setDraftPkgItems((prev) => prev.map((it) => it.key === item.key ? {
      ...it,
      unit_price: editItemForm.unit_price === '' ? null : Number(editItemForm.unit_price),
      commission_override: editItemForm.commission_override === '' ? null : Number(editItemForm.commission_override),
    } : it))
    setEditingItemKey(null)
  }

  async function handleSaveItemsBatch() {
    // Mesmo caso do drawer de criação: o serviço digitado sem o clique em
    // "Adicionar à lista" entra no salvamento em vez de ser descartado.
    const { item: pending, error: pendingError } = buildFormItem(newItem)
    if (pendingError) { addToast(pendingError, 'warning'); return }
    const itemsToSave = pending ? mergeDraftPkgItem(draftPkgItems, pending) : draftPkgItems

    setSavingItems(true)
    try {
      await api.put(`/package/${itemsDrawer}/items`, {
        items: itemsToSave.map((it) => ({
          ...(it.uuid ? { Id: it.uuid } : {}),
          Service_id: it.service_id,
          Quantity: it.quantity,
          Unit_price: it.unit_price,
          Commission_override: it.commission_override,
        })),
        deleted_ids: deletedItemIds,
      })
      addToast('Itens do pacote salvos', 'success')
      setItemsDrawer(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao salvar itens do pacote', 'error')
    } finally {
      setSavingItems(false)
    }
  }

  // ── Vender handler ───────────────────────────────────────────────────────

  async function handleSell() {
    if (!sellClientId) { addToast('Selecione um cliente', 'warning'); return }
    setSelling(true)
    try {
      await api.post(`/package/${sellPkg.UUID}/sell`, { Client_id: sellClientId })
      addToast(`Combo "${sellPkg.Name}" vendido! Registre o pagamento na Caixa.`, 'success')
      setSellPkg(null)
      setSellClientId('')
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao vender combo', 'error')
    } finally {
      setSelling(false)
    }
  }

  const currentPkg = packages.find((p) => p.UUID === itemsDrawer)
  const activePackages = packages.filter((p) => p.Active !== false)
  const inactivePackages = packages.filter((p) => p.Active === false)
  const visiblePackages = pkgTab === 'ativos' ? activePackages : inactivePackages

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex justify-between items-end mb-5 md:mb-7">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Pacotes</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">
            {mainView === 'catalogo'
              ? `${packages.length} pacote${packages.length !== 1 ? 's' : ''} no catálogo`
              : 'Quais clientes têm pacotes, quais pacotes e o status de cada um'}
          </p>
        </div>
        {mainView === 'catalogo' && (
          <Button size="sm" onClick={openCreate}>
            <Icon name="plus" size={14} />Novo pacote
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-line">
        {[{ key: 'catalogo', label: 'Catálogo' }, { key: 'vendidos', label: 'Pacotes vendidos' }].map(({ key, label }) => (
          <button key={key} onClick={() => setMainView(key)}
            className={`px-3 md:px-4 py-2 md:py-2.5 text-[13px] md:text-[13.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer
              ${mainView === key ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink-2'}`}>
            {label}
          </button>
        ))}
      </div>

      {mainView === 'vendidos' ? <PacotesVendidos /> : (
      <>
      <div className="flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-xl shrink-0 w-fit mb-5">
        <button onClick={() => setPkgTab('ativos')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
            pkgTab === 'ativos' ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-3 hover:text-ink'
          }`}>
          Ativos
          <span className="ml-1.5 font-mono text-[10.5px]">{activePackages.length}</span>
        </button>
        <button onClick={() => setPkgTab('desativados')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
            pkgTab === 'desativados' ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-3 hover:text-ink'
          }`}>
          Desativados
          <span className="ml-1.5 font-mono text-[10.5px]">{inactivePackages.length}</span>
        </button>
      </div>

      {loading ? <PageSpinner /> : visiblePackages.length === 0 ? (
        <EmptyState icon="package" title={pkgTab === 'ativos' ? 'Nenhum pacote ativo' : 'Nenhum pacote desativado'}
          description={pkgTab === 'ativos' ? 'Crie o primeiro combo do salão.' : 'Pacotes desativados aparecem aqui.'}
          action={pkgTab === 'ativos' ? openCreate : undefined} actionLabel={pkgTab === 'ativos' ? 'Novo pacote' : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePackages.map((pkg) => (
            <div key={pkg.UUID} className={`bg-surface border border-line rounded-2xl p-6 flex flex-col ${pkg.Active === false ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start pb-4 border-b border-line-2 mb-4">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand">Pacote</div>
                    {pkg.Active === false && (
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3 bg-surface-2 px-1.5 py-[1px] rounded">Desativado</div>
                    )}
                  </div>
                  <h3 className="font-display font-medium text-[18px] tracking-tight leading-snug">{pkg.Name}</h3>
                  {pkg.Available_until && (
                    <div className="font-mono text-[11px] text-ink-3 mt-1">Válido até {formatDate(pkg.Available_until)}</div>
                  )}
                </div>
                <div className="font-display font-medium text-[22px] tracking-tight flex-shrink-0"><MoneyValue>{formatCurrency(pkg.Price)}</MoneyValue></div>
              </div>

              {/* Itens */}
              <div className="flex-1 mb-4">
                {pkg.items.length === 0 ? (
                  <div className="text-[12px] text-ink-3 italic">Nenhum serviço adicionado</div>
                ) : pkg.items.map((item) => (
                  <div key={item.UUID} className="flex justify-between items-center py-2 text-[13px] border-b border-line-2 last:border-0">
                    <span>{item.Service?.Name ?? '—'}</span>
                    <span className="font-mono text-[11.5px] px-2 py-[2px] bg-surface-2 rounded-full text-ink-2">×{item.Quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t border-line-2">
                <Button variant="primary" size="sm" className="flex-1 justify-center" disabled={pkg.Active === false} onClick={() => { setSellPkg(pkg); setSellClientId('') }}>
                  Vender
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openItems(pkg)}>
                  <Icon name="plus" size={13} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(pkg)}>
                  <Icon name="edit" size={13} />
                </Button>
                <Button variant="ghost" size="sm" title={pkg.Active === false ? 'Ativar pacote' : 'Desativar pacote'} onClick={() => handleToggleActive(pkg)}>
                  <Icon name={pkg.Active === false ? 'eyeOff' : 'eye'} size={13} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeletePkg(pkg)}>
                  <Icon name="trash" size={13} />
                </Button>
              </div>
            </div>
          ))}

          {/* Card criar */}
          {pkgTab === 'ativos' && (
            <button onClick={openCreate}
              className="border border-dashed border-line rounded-2xl flex flex-col items-center justify-center gap-2.5 min-h-[200px] text-ink-3 hover:border-ink-3 transition-colors cursor-pointer bg-transparent">
              <Icon name="plus" size={26} />
              <div className="font-display text-[15px]">Criar novo pacote</div>
            </button>
          )}
        </div>
      )}
      </>
      )}

      {/* ── DRAWER — Pacote ─────────────────────────────────────────── */}
      {pkgDrawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-ink/30" onClick={() => setPkgDrawer(false)} />
          <div className="w-full md:w-[520px] bg-surface border-l border-line h-full overflow-y-auto p-5 md:p-7 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-display font-medium text-[20px] tracking-tight">
                {pkgDrawer === 'create' ? 'Novo pacote' : 'Editar pacote'}
              </h4>
              <button onClick={() => setPkgDrawer(false)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSavePkg} className="flex flex-col gap-4 flex-1">
              <DrawerField label="Nome do pacote">
                <input required value={pkgForm.Name}
                  onChange={(e) => setPkgForm((f) => ({ ...f, Name: e.target.value }))}
                  placeholder="Ex: Combo Noiva" className={inputCls} />
              </DrawerField>
              <DrawerField label="Preço (R$)">
                <input required type="number" min="0" step="0.01" value={pkgForm.Price}
                  onChange={(e) => setPkgForm((f) => ({ ...f, Price: e.target.value }))}
                  placeholder="0,00" className={inputCls} />
              </DrawerField>
              <DrawerField label="Válido até (opcional)">
                <input type="date" value={pkgForm.Available_until}
                  onChange={(e) => setPkgForm((f) => ({ ...f, Available_until: e.target.value }))}
                  className={inputCls} />
              </DrawerField>

              {pkgDrawer === 'create' && (
                <div className="border-t border-line pt-4 flex flex-col gap-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Serviços</div>

                  {draftItems.length > 0 && (
                    <>
                      <div className="flex flex-col divide-y divide-line-2 border border-line rounded-lg overflow-hidden mb-1">
                        {draftItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center px-3 py-2.5">
                            <div>
                              <div className="text-[13px]">{item.name}</div>
                              <div className="font-mono text-[11px] text-ink-3 flex items-center gap-2">
                                <span>×{item.quantity}</span>
                                {item.unit_price !== null && <span className="text-brand"><MoneyValue>{formatCurrency(item.unit_price)}</MoneyValue>/sessão</span>}
                                {item.commission_override !== null && <span className="text-brand">{item.commission_override}% comissão</span>}
                              </div>
                            </div>
                            <button type="button" onClick={() => removeDraftItem(idx)}
                              className="text-ink-3 hover:text-danger transition-colors cursor-pointer p-1">
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {draftItems.some((it) => it.unit_price !== null) && (
                        <DraftItemsSumIndicator items={draftItems} packagePrice={pkgForm.Price} />
                      )}
                    </>
                  )}

                  <DrawerField label="Serviço">
                    <select value={draftItem.service_id}
                      onChange={(e) => setDraftItem((f) => ({ ...f, service_id: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                      className={inputCls}>
                      <option value="">Selecione...</option>
                      {services.map((s) => (
                        <option key={s.UUID} value={s.UUID}>{s.Name}</option>
                      ))}
                    </select>
                  </DrawerField>
                  <DrawerField label="Quantidade">
                    <input type="number" min="1" value={draftItem.quantity}
                      onChange={(e) => setDraftItem((f) => ({ ...f, quantity: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftItem() } }}
                      className={inputCls} />
                  </DrawerField>
                  <div className="grid grid-cols-2 gap-2">
                    <DrawerField label="Valor/sessão (R$)">
                      {/* sem `required`: estes campos são do sub-formulário "adicionar
                          serviço", mas vivem dentro do <form> do pacote — com `required` o
                          próprio navegador bloqueava o "Salvar" exigindo preenchê-los mesmo
                          com serviços já na lista. A validação real está em addDraftItem. */}
                      <input type="number" min="0" step="0.01" value={draftItem.unit_price}
                        placeholder="0,00"
                        onChange={(e) => setDraftItem((f) => ({ ...f, unit_price: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftItem() } }}
                        className={inputCls} />
                    </DrawerField>
                    <DrawerField label="Comissão (%)">
                      <input type="number" min="0" max="100" step="0.01" value={draftItem.commission_override}
                        placeholder="0"
                        onChange={(e) => setDraftItem((f) => ({ ...f, commission_override: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftItem() } }}
                        className={inputCls} />
                    </DrawerField>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="w-full justify-center" onClick={addDraftItem}>
                    <Icon name="plus" size={13} />Adicionar serviço
                  </Button>
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-4">
                <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={() => setPkgDrawer(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1 justify-center" loading={savingPkg}>
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRAWER — Itens do pacote ─────────────────────────────── */}
      {itemsDrawer && currentPkg && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-ink/30" onClick={() => setItemsDrawer(null)} />
          <div className="w-full md:w-[520px] bg-surface border-l border-line h-full overflow-y-auto p-5 md:p-7 flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-display font-medium text-[20px] tracking-tight">Serviços do pacote</h4>
              <button onClick={() => setItemsDrawer(null)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="font-mono text-[11px] text-ink-3 mb-1">{currentPkg.Name}</div>
            <div className="text-[11.5px] text-ink-3 bg-surface-2 rounded-lg px-3 py-2 mb-4">
              As alterações abaixo só são salvas ao clicar em "Salvar alterações" no fim da tela.
            </div>

            {/* Indicador de soma — só relevante quando algum item define Valor por sessão */}
            {draftPkgItems.some((it) => it.unit_price !== null) && (
              <ItemsSumIndicator items={draftPkgItems.map((it) => ({ Unit_price: it.unit_price, Quantity: it.quantity }))} packagePrice={currentPkg.Price} />
            )}

            {/* Lista atual (rascunho) */}
            <div className="mb-5">
              {draftPkgItems.length === 0 ? (
                <div className="text-[13px] text-ink-3 italic">Nenhum serviço ainda</div>
              ) : draftPkgItems.map((item) => (
                <div key={item.key} className="py-2.5 border-b border-line-2 last:border-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[13px] font-medium">{item.name}</div>
                      <div className="font-mono text-[11px] text-ink-3">×{item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingItemKey !== item.key && (
                        <button type="button" onClick={() => openEditItemOverride(item)}
                          className="text-right cursor-pointer group">
                          <div className={`text-[12.5px] ${item.unit_price != null ? 'text-brand font-medium' : 'text-ink-3'}`}>
                            {item.unit_price != null ? formatCurrency(item.unit_price) : 'Valor padrão'}
                          </div>
                          <div className={`text-[11px] ${item.commission_override != null ? 'text-brand' : 'text-ink-3'}`}>
                            {item.commission_override != null ? `${item.commission_override}% comissão` : 'Comissão padrão'}
                          </div>
                        </button>
                      )}
                      <button type="button"
                        onClick={() => removeDraftPkgItem(item)}
                        className="text-ink-3 hover:text-danger transition-colors cursor-pointer p-1"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>

                  {editingItemKey === item.key && (
                    <div className="flex flex-col gap-2 mt-2 bg-surface-2 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <DrawerField label="Valor/sessão (R$)">
                          <input type="number" min="0" step="0.01" value={editItemForm.unit_price}
                            placeholder="Padrão do serviço"
                            onChange={(e) => setEditItemForm((f) => ({ ...f, unit_price: e.target.value }))}
                            className={inputCls} />
                        </DrawerField>
                        <DrawerField label="Comissão (%)">
                          <input type="number" min="0" max="100" step="0.01" value={editItemForm.commission_override}
                            placeholder="Padrão do serviço"
                            onChange={(e) => setEditItemForm((f) => ({ ...f, commission_override: e.target.value }))}
                            className={inputCls} />
                        </DrawerField>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" className="flex-1 justify-center" onClick={() => setEditingItemKey(null)}>
                          Cancelar
                        </Button>
                        <Button type="button" variant="primary" size="sm" className="flex-1 justify-center"
                          onClick={() => saveEditItemOverride(item)}>
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar serviço (fica no rascunho, ainda não grava) */}
            <div className="border-t border-line pt-5">
              <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3 mb-3">Adicionar serviço</div>
              <div className="flex flex-col gap-3">
                <DrawerField label="Serviço">
                  <select value={newItem.service_id}
                    onChange={(e) => setNewItem((f) => ({ ...f, service_id: e.target.value }))}
                    className={inputCls}>
                    <option value="">Selecione...</option>
                    {services.map((s) => (
                      <option key={s.UUID} value={s.UUID}>{s.Name}</option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Quantidade">
                  <input type="number" min="1" value={newItem.quantity}
                    onChange={(e) => setNewItem((f) => ({ ...f, quantity: e.target.value }))}
                    className={inputCls} />
                </DrawerField>
                <div className="grid grid-cols-2 gap-2">
                  <DrawerField label="Valor/sessão (R$)">
                    <input type="number" min="0" step="0.01" value={newItem.unit_price} required
                      placeholder="0,00"
                      onChange={(e) => setNewItem((f) => ({ ...f, unit_price: e.target.value }))}
                      className={inputCls} />
                  </DrawerField>
                  <DrawerField label="Comissão (%)">
                    <input type="number" min="0" max="100" step="0.01" value={newItem.commission_override} required
                      placeholder="0"
                      onChange={(e) => setNewItem((f) => ({ ...f, commission_override: e.target.value }))}
                      className={inputCls} />
                  </DrawerField>
                </div>
                <Button type="button" variant="outline" className="w-full justify-center" onClick={addDraftPkgItem}>
                  <Icon name="plus" size={14} />
                  Adicionar à lista
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-line">
              <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={() => setItemsDrawer(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" className="flex-1 justify-center"
                loading={savingItems} onClick={handleSaveItemsBatch}>
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — Vender ───────────────────────────────────────── */}
      {sellPkg && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setSellPkg(null)} />
          <div className="relative bg-surface border border-line rounded-2xl p-5 md:p-7 w-full max-w-[400px] mx-4 shadow-lg">
            <div className="flex justify-between items-center mb-5">
              <h4 className="font-display font-medium text-[20px] tracking-tight">Vender pacote</h4>
              <button onClick={() => setSellPkg(null)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="bg-surface-2 border border-line rounded-lg px-4 py-3 mb-5">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-0.5">Pacote</div>
              <div className="font-display font-medium text-[16px]">{sellPkg.Name}</div>
              <div className="font-mono text-[13px] text-brand mt-0.5"><MoneyValue>{formatCurrency(sellPkg.Price)}</MoneyValue></div>
            </div>
            <DrawerField label="Cliente">
              <SearchableSelect
                value={sellClientId}
                onChange={setSellClientId}
                onSearch={searchClients}
                placeholder="Selecionar cliente…"
              />
            </DrawerField>
            <div className="text-[12px] text-ink-3 mt-2 mb-5">
              Uma comanda será criada automaticamente. Registre o pagamento na Caixa.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 justify-center" onClick={() => setSellPkg(null)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1 justify-center" onClick={handleSell} loading={selling}>
                Confirmar venda
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAIS DE CONFIRMAÇÃO ────────────────────────────────── */}
      <Modal
        isOpen={!!deletePkg}
        onClose={() => setDeletePkg(null)}
        onConfirm={handleDeletePkg}
        title="Excluir pacote"
        message={`"${deletePkg?.Name}" será removido permanentemente.`}
        confirmLabel="Excluir"
        loading={deletingPkg}
      />
    </AppLayout>
  )
}

const inputCls = `h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md
  placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors w-full`

function DraftItemsSumIndicator({ items, packagePrice }) {
  const allDefined = items.every((it) => it.unit_price !== null)
  if (!allDefined) {
    return (
      <div className="text-[11.5px] text-ink-3 bg-surface-2 rounded-lg px-3 py-2 mb-1">
        Alguns itens ainda não têm Valor/sessão — a soma só é conferida quando todos tiverem.
      </div>
    )
  }
  const sum = items.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0)
  const price = Number(packagePrice) || 0
  const matches = Math.abs(sum - price) <= 0.01
  return (
    <div className={`text-[11.5px] rounded-lg px-3 py-2 mb-1 ${matches ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
      Soma dos itens: <MoneyValue>{formatCurrency(sum)}</MoneyValue> / Preço do pacote: <MoneyValue>{formatCurrency(price)}</MoneyValue>
      {!matches && ' — ajuste antes de salvar.'}
    </div>
  )
}

function ItemsSumIndicator({ items, packagePrice }) {
  const allDefined = items.every((it) => it.Unit_price !== null && it.Unit_price !== undefined)
  if (!allDefined) {
    return (
      <div className="text-[11.5px] text-ink-3 bg-surface-2 rounded-lg px-3 py-2 mb-4">
        Alguns itens ainda não têm Valor/sessão definido — a soma só é validada quando todos tiverem.
      </div>
    )
  }
  const sum = items.reduce((acc, it) => acc + Number(it.Unit_price) * Number(it.Quantity), 0)
  const matches = Math.abs(sum - Number(packagePrice)) <= 0.01
  return (
    <div className={`text-[11.5px] rounded-lg px-3 py-2 mb-4 ${matches ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
      Soma dos itens: <MoneyValue>{formatCurrency(sum)}</MoneyValue> / Preço do pacote: <MoneyValue>{formatCurrency(packagePrice)}</MoneyValue>
      {!matches && ' — ajuste os valores antes de salvar.'}
    </div>
  )
}

function DrawerField({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
