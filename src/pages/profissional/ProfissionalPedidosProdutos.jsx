import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import MoneyValue from '@/components/ui/MoneyValue'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import LoadMoreButton from '@/components/ui/LoadMoreButton'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { searchClients } from '@/lib/searchClients'
import { navItemsByRole } from '@/config/navItems'
import { usePaginatedList } from '@/hooks/usePaginatedList'

const navItems = navItemsByRole['Profissional']

const STATUS_LABELS  = { encomendado: 'Encomendado', pago: 'Pago', cancelado: 'Cancelado' }
const STATUS_COLORS  = {
  encomendado: 'bg-warning-soft text-warning',
  pago:        'bg-success-soft text-success',
  cancelado:   'bg-surface-2 text-ink-3',
}
const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Crédito', cartao_debito: 'Débito',
}

function formatPrice(p) {
  if (!p && p !== 0) return '—'
  return `R$ ${Number(p).toFixed(2).replace('.', ',')}`
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const EMPTY_ORDER = { Product_id: '', Client_id: '', Quantity: '1', Payment_method: '', Notes: '' }

export default function ProfissionalPedidosProdutos() {
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const [filterStatus, setFilterStatus] = useState('')
  const [products, setProducts] = useState([])
  const [newDrawer, setNewDrawer] = useState(false)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [savingOrder, setSavingOrder] = useState(false)
  const [detailDrawer, setDetailDrawer] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [paying, setPaying] = useState(false)
  const [cancelModal, setCancelModal] = useState(null)
  const [canceling, setCanceling] = useState(false)

  const { items: orders, loading, loadingMore, hasMore, reload, loadMore } = usePaginatedList(
    (page, limit) => {
      const params = { page, limit }
      if (filterStatus) params.status = filterStatus
      return api.get('/product-order', { params }).then((r) => r.data)
    },
    [filterStatus]
  )

  useEffect(() => {
    api.get('/product', { params: { limit: 100 } })
      .then((res) => setProducts((res.data.data ?? []).filter(p => p.Active)))
      .catch(() => {})
  }, [])

  async function handleSaveOrder(e) {
    e.preventDefault()
    if (!orderForm.Product_id) { addToast('Selecione um produto', 'warning'); return }
    if (!orderForm.Client_id)  { addToast('Selecione um cliente', 'warning'); return }
    setSavingOrder(true)
    try {
      await api.post('/product-order', {
        Product_id: orderForm.Product_id,
        Client_id:  orderForm.Client_id,
        Quantity:   Number(orderForm.Quantity),
        Payment_method: orderForm.Payment_method || null,
        Notes:      orderForm.Notes || null,
      })
      addToast('Pedido criado com sucesso', 'success')
      setNewDrawer(false)
      setOrderForm(EMPTY_ORDER)
      reload()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao criar pedido', 'error')
    } finally {
      setSavingOrder(false)
    }
  }

  async function handlePay() {
    if (!payModal) return
    setPaying(true)
    try {
      await api.patch(`/product-order/${payModal.UUID}`, { Status: 'pago' })
      addToast('Pedido marcado como pago', 'success')
      setPayModal(null)
      if (detailDrawer?.UUID === payModal.UUID) setDetailDrawer(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar pedido', 'error')
    } finally {
      setPaying(false)
    }
  }

  async function handleCancel() {
    if (!cancelModal) return
    setCanceling(true)
    try {
      await api.patch(`/product-order/${cancelModal.UUID}`, { Status: 'cancelado' })
      addToast('Pedido cancelado', 'success')
      setCancelModal(null)
      if (detailDrawer?.UUID === cancelModal.UUID) setDetailDrawer(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao cancelar pedido', 'error')
    } finally {
      setCanceling(false)
    }
  }

  const selectedProduct = products.find(p => p.UUID === orderForm.Product_id)
  const estimatedTotal  = selectedProduct ? formatPrice(selectedProduct.Price * Number(orderForm.Quantity || 1)) : null

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional" />
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Pedidos de Produtos</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Registre e acompanhe as vendas de produtos</p>
        </div>
        <Button size="sm" onClick={() => { setOrderForm(EMPTY_ORDER); setNewDrawer(true) }}>
          <Icon name="plus" size={14} />Novo pedido
        </Button>
      </div>

      {/* Filtro */}
      <div className="flex gap-1 mb-5 p-1 bg-surface-2 border border-line rounded-lg w-fit flex-wrap">
        {[['', 'Todos'], ['encomendado', 'Encomendados'], ['pago', 'Pagos'], ['cancelado', 'Cancelados']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer
              ${filterStatus === val ? 'bg-surface border border-line shadow-sm text-ink' : 'text-ink-3 hover:text-ink-2'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <PageSpinner /> : orders.length === 0 ? (
        <EmptyState icon="cash" title="Nenhum pedido encontrado"
          description={filterStatus ? 'Tente outro filtro ou registre um novo pedido.' : 'Registre o primeiro pedido de produto.'}
          action={filterStatus ? undefined : () => { setOrderForm(EMPTY_ORDER); setNewDrawer(true) }}
          actionLabel="Novo pedido" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Data', 'Cliente', 'Produto', 'Qtd', 'Total', 'Método', 'Status', ''].map(h => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.UUID} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3.5 py-3 font-mono text-[11px] text-ink-3 border-b border-line-2 whitespace-nowrap">{formatDate(o.Created_at)}</td>
                    <td className="px-3.5 py-3 text-[13px] font-medium border-b border-line-2">{o.Client?.Name ?? '—'}</td>
                    <td className="px-3.5 py-3 text-[13px] border-b border-line-2">{o.Product?.Name ?? '—'}</td>
                    <td className="px-3.5 py-3 font-mono text-[12px] text-ink-2 border-b border-line-2">{o.Quantity}</td>
                    <td className="px-3.5 py-3 font-mono text-[12px] text-ink-2 border-b border-line-2"><MoneyValue>{formatPrice(o.Total_price)}</MoneyValue></td>
                    <td className="px-3.5 py-3 font-mono text-[11px] text-ink-3 border-b border-line-2">
                      {o.Payment_method ? PAYMENT_LABELS[o.Payment_method] : <span className="italic">—</span>}
                    </td>
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <span className={`font-mono text-[10.5px] uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_COLORS[o.Status]}`}>
                        {STATUS_LABELS[o.Status]}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right border-b border-line-2">
                      <Button variant="ghost" size="sm" onClick={() => setDetailDrawer(o)}><Icon name="chevronRight" size={13} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {orders.map(o => (
              <div key={o.UUID} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium text-[14px]">{o.Client?.Name ?? '—'}</div>
                    <div className="text-[12px] text-ink-3 mt-0.5">{o.Product?.Name ?? '—'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_COLORS[o.Status]}`}>
                      {STATUS_LABELS[o.Status]}
                    </span>
                    <div className="font-display text-[15px] font-medium"><MoneyValue>{formatPrice(o.Total_price)}</MoneyValue></div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-ink-3 mb-3 flex-wrap">
                  <span>Qtd: {o.Quantity}</span>
                  {o.Payment_method && <><span>·</span><span>{PAYMENT_LABELS[o.Payment_method]}</span></>}
                  <span>·</span><span>{formatDate(o.Created_at)}</span>
                </div>
                <div className="pt-3 border-t border-line-2">
                  <button onClick={() => setDetailDrawer(o)}
                    className="flex items-center gap-1.5 font-mono text-[11px] text-brand hover:text-brand/80 transition-colors cursor-pointer">
                    Ver detalhes <Icon name="chevronRight" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
        </>
      )}

      {/* Drawer — Novo pedido */}
      {newDrawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-ink/30" onClick={() => setNewDrawer(false)} />
          <div className="w-full md:w-[420px] bg-surface border-l border-line h-full overflow-y-auto p-5 md:p-7 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-display font-medium text-[20px] tracking-tight">Novo pedido</h4>
              <button onClick={() => setNewDrawer(false)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOrder} className="flex flex-col gap-4 flex-1">
              <Field label="Produto">
                <select required value={orderForm.Product_id} onChange={e => setOrderForm(f => ({ ...f, Product_id: e.target.value }))} className={inputCls}>
                  <option value="">Selecione...</option>
                  {products.map(p => <option key={p.UUID} value={p.UUID}>{p.Name} — {formatPrice(p.Price)} (estoque: {p.Stock})</option>)}
                </select>
              </Field>
              <Field label="Cliente">
                <SearchableSelect
                  required
                  value={orderForm.Client_id}
                  onChange={(val) => setOrderForm(f => ({ ...f, Client_id: val }))}
                  onSearch={searchClients}
                  placeholder="Selecione…"
                />
              </Field>
              <Field label="Quantidade">
                <input required type="number" min="1" value={orderForm.Quantity}
                  onChange={e => setOrderForm(f => ({ ...f, Quantity: e.target.value }))} className={inputCls} />
              </Field>
              {estimatedTotal && (
                <div className="bg-brand-soft rounded-lg px-4 py-2.5 flex justify-between items-center">
                  <span className="text-[12px] text-ink-3">Total estimado</span>
                  <span className="font-display font-medium text-[16px] text-brand"><MoneyValue>{estimatedTotal}</MoneyValue></span>
                </div>
              )}
              <Field label="Método de pagamento (opcional)">
                <select value={orderForm.Payment_method} onChange={e => setOrderForm(f => ({ ...f, Payment_method: e.target.value }))} className={inputCls}>
                  <option value="">A definir</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cartao_credito">Cartão de crédito</option>
                  <option value="cartao_debito">Cartão de débito</option>
                </select>
              </Field>
              <Field label="Observações (opcional)">
                <textarea value={orderForm.Notes} onChange={e => setOrderForm(f => ({ ...f, Notes: e.target.value }))}
                  placeholder="Alguma observação sobre o pedido..." rows={3}
                  className={`${inputCls} h-auto py-2.5 resize-none`} />
              </Field>
              <div className="flex gap-2 mt-auto pt-4">
                <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={() => setNewDrawer(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1 justify-center" loading={savingOrder}>
                  Criar pedido
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer — Detalhes */}
      {detailDrawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-ink/30" onClick={() => setDetailDrawer(null)} />
          <div className="w-full md:w-[400px] bg-surface border-l border-line h-full overflow-y-auto p-5 md:p-7 flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-display font-medium text-[20px] tracking-tight">Detalhes do pedido</h4>
              <button onClick={() => setDetailDrawer(null)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="font-mono text-[11px] text-ink-3 mb-6">{formatDate(detailDrawer.Created_at)}</div>
            <div className="flex items-center gap-2 mb-6">
              <span className={`font-mono text-[11px] uppercase tracking-widest px-2.5 py-1 rounded ${STATUS_COLORS[detailDrawer.Status]}`}>
                {STATUS_LABELS[detailDrawer.Status]}
              </span>
            </div>
            <div className="flex flex-col gap-3 mb-6">
              <InfoRow label="Cliente"       value={detailDrawer.Client?.Name} />
              <InfoRow label="Telefone"      value={detailDrawer.Client?.Phone} mono />
              <InfoRow label="Produto"       value={detailDrawer.Product?.Name} />
              <InfoRow label="Preço unitário" value={<MoneyValue>{formatPrice(detailDrawer.Unit_price)}</MoneyValue>} mono />
              <InfoRow label="Quantidade"    value={detailDrawer.Quantity} mono />
              <InfoRow label="Total"         value={<MoneyValue>{formatPrice(detailDrawer.Total_price)}</MoneyValue>} mono highlight />
              <InfoRow label="Método"        value={detailDrawer.Payment_method ? PAYMENT_LABELS[detailDrawer.Payment_method] : '—'} />
              {detailDrawer.Notes && <InfoRow label="Observações" value={detailDrawer.Notes} />}
            </div>
            {detailDrawer.Status === 'encomendado' && (
              <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-line">
                <Button variant="primary" className="w-full justify-center" onClick={() => setPayModal(detailDrawer)}>
                  <Icon name="check" size={14} />Marcar como pago
                </Button>
                <Button variant="ghost" className="w-full justify-center text-danger hover:text-danger" onClick={() => setCancelModal(detailDrawer)}>
                  Cancelar pedido
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} onConfirm={handlePay}
        title="Confirmar pagamento"
        message={`Marcar o pedido de "${payModal?.Product?.Name}" como pago? O estoque será decrementado.`}
        confirmLabel="Confirmar" loading={paying} />
      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)} onConfirm={handleCancel}
        title="Cancelar pedido"
        message={`Cancelar o pedido de "${cancelModal?.Product?.Name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar pedido" loading={canceling} />
    </AppLayout>
  )
}

const inputCls = `h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md
  placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors w-full`

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-[12px] text-ink-3 shrink-0">{label}</span>
      <span className={`text-right ${mono ? 'font-mono text-[12px]' : 'text-[13px]'} ${highlight ? 'font-medium text-brand' : 'text-ink-2'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}
