// Aba "Pedidos de produtos" do Caixa (Admin) e das Comandas (Profissional).
import { useState, useEffect, useCallback } from 'react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import SearchableSelect from '@/components/ui/SearchableSelect'
import MoneyValue from '@/components/ui/MoneyValue'
import { useToast } from '@/context/ToastContext'
import api from '@/lib/api'
import { searchClients } from '@/lib/searchClients'
import { formatCurrency, formatDate } from '@/lib/format'
import { PAY_METHODS, PAY_METHODS_FIADO } from '@/lib/caixa'
import { useAcceptedPaymentMethods } from '@/config/paymentMethods'

const PROD_STATUS_LABELS = { encomendado: 'Encomendado', pago: 'Pago', cancelado: 'Cancelado' }

const PROD_STATUS_COLORS = {
  encomendado: 'bg-warning-soft text-warning',
  pago: 'bg-success-soft text-success',
  cancelado: 'bg-surface-2 text-ink-3',
}

const inputClsProd = 'h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors w-full'

const EMPTY_ORDER = { Product_id: '', Client_id: '', Quantity: '1', Payment_method: '', Notes: '' }

function FieldProd({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

// showSeller: Admin vê quem vendeu o pedido; Profissional não.
export function TabPedidosProdutos({ showSeller = false }) {
  const acceptedMethods = useAcceptedPaymentMethods()
  const payOptions = PAY_METHODS.filter(m => acceptedMethods.includes(m.id))
  const { addToast } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [payMethod, setPayMethod] = useState(() => payOptions[0]?.id ?? 'fiado')
  const [paying, setPaying] = useState(false)
  const [products, setProducts] = useState([])
  const [newDrawer, setNewDrawer] = useState(false)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [savingOrder, setSavingOrder] = useState(false)
  const [cancelModal, setCancelModal] = useState(null)
  const [canceling, setCanceling] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      const { data } = await api.get('/product-order', { params })
      setOrders(data.data ?? [])
    } catch { setOrders([]) }
    finally { if (!silent) setLoading(false) }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/product', { params: { limit: 100 } })
      .then(({ data }) => setProducts((data.data ?? []).filter(p => p.Active)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (orders.length === 0) return
    if (!selectedId) setSelectedId(orders[0].UUID)
  }, [orders])

  const filtered = filterStatus ? orders.filter(o => o.Status === filterStatus) : orders
  const selected = orders.find(o => o.UUID === selectedId)
  const encomendadoCount = orders.filter(o => o.Status === 'encomendado').length

  async function handlePay() {
    if (!selected) return
    setPaying(true)
    try {
      await api.patch(`/product-order/${selected.UUID}`, { Status: 'pago', Payment_method: payMethod, Payment: payMethod !== 'fiado' })
      addToast(payMethod === 'fiado' ? 'Registrado como mensalidade' : 'Pagamento registrado', 'success')
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao registrar pagamento', 'error')
    } finally {
      setPaying(false)
    }
  }

  async function handleCancel() {
    setCanceling(true)
    try {
      await api.patch(`/product-order/${cancelModal.UUID}`, { Status: 'cancelado' })
      addToast('Pedido cancelado', 'success')
      setCancelModal(null)
      load(true)
    } catch (err) { addToast(err.response?.data?.error || 'Erro', 'error') }
    finally { setCanceling(false) }
  }

  async function handleSaveOrder(e) {
    e.preventDefault()
    if (!orderForm.Product_id) { addToast('Selecione um produto', 'warning'); return }
    if (!orderForm.Client_id)  { addToast('Selecione um cliente', 'warning'); return }
    setSavingOrder(true)
    try {
      await api.post('/product-order', {
        Product_id: orderForm.Product_id,
        Client_id: orderForm.Client_id,
        Quantity: Number(orderForm.Quantity),
        Payment_method: orderForm.Payment_method || null,
        Notes: orderForm.Notes || null,
      })
      addToast('Pedido criado com sucesso', 'success')
      setNewDrawer(false)
      setOrderForm(EMPTY_ORDER)
      load()
    } catch (err) { addToast(err.response?.data?.error || 'Erro ao criar pedido', 'error') }
    finally { setSavingOrder(false) }
  }

  const selProd = products.find(p => p.UUID === orderForm.Product_id)
  const estTotal = selProd ? formatCurrency(selProd.Price * Number(orderForm.Quantity || 1)) : null

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[12px] md:text-[13px] text-ink-3">
          {encomendadoCount} encomendado{encomendadoCount !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => { setOrderForm(EMPTY_ORDER); setNewDrawer(true) }}>
          <Icon name="plus" size={14} />Novo pedido
        </Button>
      </div>

      <div className="flex gap-1.5 mb-5">
        {[['', 'Todos'], ['encomendado', 'Encomendados'], ['pago', 'Pagos'], ['cancelado', 'Cancelados']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val)}
            className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${filterStatus === val ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <PageSpinner /> : orders.length === 0 ? (
        <EmptyState icon="package" title="Nenhum pedido encontrado"
          description={filterStatus ? 'Tente outro filtro.' : 'Registre o primeiro pedido de produto.'}
          action={filterStatus ? undefined : () => { setOrderForm(EMPTY_ORDER); setNewDrawer(true) }}
          actionLabel="Novo pedido" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
          {/* Lista */}
          <div className={`bg-surface border border-line rounded-[14px] overflow-hidden h-fit ${selectedId ? 'hidden lg:block' : ''}`}>
            <div className="px-5 py-3.5 border-b border-line flex justify-between items-center">
              <div className="font-display font-medium text-[16px]">Pedidos</div>
              <span className="font-mono text-[11px] text-ink-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-ink-3 text-[13px]">Nenhum pedido neste filtro</div>
            ) : filtered.map((o, idx) => (
              <button key={o.UUID} onClick={() => setSelectedId(o.UUID)}
                className={`w-full flex items-center gap-3 px-4 md:px-5 py-3.5 md:py-4 border-b border-line-2 last:border-0 cursor-pointer transition-colors text-left
                  ${o.UUID === selectedId ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}>
                <Avatar name={o.Client?.Name ?? '?'} index={idx} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] md:text-[13.5px] font-medium truncate">{o.Client?.Name ?? '—'}</div>
                  <div className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">
                    {o.Product?.Name} · {formatDate(o.Created_at)} · Qtd {o.Quantity}
                  </div>
                </div>
                <div className="font-mono text-[12px] md:text-[13px] font-medium shrink-0">
                  <MoneyValue>{formatCurrency(o.Total_price)}</MoneyValue>
                </div>
                <span className={`font-mono text-[10.5px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${PROD_STATUS_COLORS[o.Status]}`}>
                  {PROD_STATUS_LABELS[o.Status]}
                </span>
              </button>
            ))}
          </div>

          {/* Painel de pagamento */}
          {selected && (
            <div className="bg-surface border border-line rounded-[14px] h-fit lg:sticky top-6">
              <button onClick={() => setSelectedId(null)} className="lg:hidden w-full flex items-center gap-1.5 px-6 pt-4 text-[12px] text-ink-3 hover:text-brand transition-colors cursor-pointer">
                <Icon name="arrowLeft" size={14} />
                Voltar para a lista
              </button>
              <div className="px-6 py-5 border-b border-line">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Pedido selecionado</span>
                <h4 className="font-display font-medium text-[19px] tracking-tight mt-1.5">
                  {selected.Client?.Name ?? '—'}
                </h4>
                <div className="font-mono text-[11.5px] text-ink-3 mt-1">
                  {selected.Product?.Name} · {formatDate(selected.Created_at)} · Qtd {selected.Quantity}
                  {showSeller && selected.SoldBy?.Name && ` · ${selected.SoldBy.Name}`}
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="flex justify-between items-center py-3.5 border-b border-dashed border-line-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Valor</span>
                  <span className="font-display text-[22px] font-medium"><MoneyValue>{formatCurrency(selected.Total_price)}</MoneyValue></span>
                </div>

                <div className="flex justify-between items-center py-3.5 border-b border-dashed border-line-2 mb-4">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Status</span>
                  <span className={`font-mono text-[10.5px] uppercase tracking-widest px-2.5 py-1 rounded ${PROD_STATUS_COLORS[selected.Status]}`}>
                    {PROD_STATUS_LABELS[selected.Status]}
                  </span>
                </div>

                {selected.Status === 'encomendado' ? (
                  <>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3 mb-2.5">
                      Método de pagamento
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {payOptions.map((m) => (
                        <button key={m.id} onClick={() => setPayMethod(m.id)}
                          className={`px-3 py-3.5 rounded-[10px] border flex flex-col items-center gap-1.5 text-[13px] cursor-pointer transition-colors
                            ${payMethod === m.id ? 'bg-ink text-bg border-ink' : 'bg-surface border-line hover:border-ink-3'}`}>
                          <Icon name={m.icon} size={20} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {acceptedMethods.includes('fiado') && <button
                      onClick={() => setPayMethod(PAY_METHODS_FIADO.id)}
                      className={`w-full px-3 py-3 rounded-[10px] border flex items-center justify-center gap-2 text-[13px] cursor-pointer transition-colors mb-5
                        ${payMethod === 'fiado' ? 'bg-warning/10 text-warning border-warning' : 'bg-surface border-line hover:border-warning/50 text-ink-2'}`}
                    >
                      <Icon name={PAY_METHODS_FIADO.icon} size={16} />
                      {PAY_METHODS_FIADO.label}
                    </button>}
                    <Button variant="primary" className="w-full justify-center mb-2" onClick={handlePay} loading={paying}>
                      <Icon name="check" size={14} />
                      {payMethod === 'fiado' ? 'Registrar mensalidade' : 'Registrar pagamento'}
                    </Button>
                    <Button variant="ghost" className="w-full justify-center text-danger hover:text-danger" onClick={() => setCancelModal(selected)}>
                      Cancelar pedido
                    </Button>
                  </>
                ) : (
                  <div className={`rounded-lg px-4 py-3 text-[13px] text-center
                    ${selected.Status === 'pago' ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-3'}`}>
                    {selected.Status === 'pago' ? 'Pedido pago' : 'Pedido cancelado'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {newDrawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-ink/30" onClick={() => setNewDrawer(false)} />
          <div className="w-full md:w-[420px] bg-surface border-l border-line h-full overflow-y-auto p-5 md:p-7 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-display font-medium text-[20px] tracking-tight">Novo pedido</h4>
              <button onClick={() => setNewDrawer(false)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors"><Icon name="x" size={18} /></button>
            </div>
            <form onSubmit={handleSaveOrder} className="flex flex-col gap-4 flex-1">
              <FieldProd label="Produto">
                <select required value={orderForm.Product_id} onChange={e => setOrderForm(f => ({ ...f, Product_id: e.target.value }))} className={inputClsProd}>
                  <option value="">Selecione...</option>
                  {products.map(p => <option key={p.UUID} value={p.UUID}>{p.Name} — <MoneyValue>{formatCurrency(p.Price)}</MoneyValue> (estoque: {p.Stock})</option>)}
                </select>
              </FieldProd>
              <FieldProd label="Cliente">
                <SearchableSelect
                  required
                  value={orderForm.Client_id}
                  onChange={val => setOrderForm(f => ({ ...f, Client_id: val }))}
                  onSearch={searchClients}
                  placeholder="Selecione…"
                />
              </FieldProd>
              <FieldProd label="Quantidade">
                <input required type="number" min="1" value={orderForm.Quantity} onChange={e => setOrderForm(f => ({ ...f, Quantity: e.target.value }))} className={inputClsProd} />
              </FieldProd>
              {estTotal && (
                <div className="bg-brand-soft rounded-lg px-4 py-2.5 flex justify-between items-center">
                  <span className="text-[12px] text-ink-3">Total estimado</span>
                  <span className="font-display font-medium text-[16px] text-brand"><MoneyValue>{estTotal}</MoneyValue></span>
                </div>
              )}
              <FieldProd label="Observações (opcional)">
                <textarea value={orderForm.Notes} onChange={e => setOrderForm(f => ({ ...f, Notes: e.target.value }))}
                  placeholder="Alguma observação sobre o pedido..." rows={3}
                  className={`${inputClsProd} h-auto py-2.5 resize-none`} />
              </FieldProd>
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

      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)} onConfirm={handleCancel}
        title="Cancelar pedido"
        message={`Cancelar o pedido de "${cancelModal?.Product?.Name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar pedido" loading={canceling} />
    </>
  )
}
