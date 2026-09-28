import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import ModalFecharConta from '@/components/ui/ModalFecharConta'
import CreditToggleRow from '@/components/ui/CreditToggleRow'
import PaymentMethodSplit from '@/components/ui/PaymentMethodSplit'
import { useCreditAndTroco } from '@/hooks/useCreditAndTroco'
import { usePaymentSplit } from '@/hooks/usePaymentSplit'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import PaginationControls from '@/components/ui/PaginationControls'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { searchClients } from '@/lib/searchClients'
import { batchPayExtraMessage } from '@/lib/creditToast'
import { navItemsByRole } from '@/config/navItems'
import { usePagination } from '@/hooks/usePagination'
import { useTour } from '@/hooks/useTour'
import { profissionalComandasSteps } from '@/tours/profissionalComandasTour'
import MoneyValue from '@/components/ui/MoneyValue'

const navItems = navItemsByRole['Profissional']

const STATUS_FILTERS = ['Todos', 'Em aberto', 'Paga', 'Expirada']

const PERIOD_PRESETS = [
  { key: 'todos', label: 'Todos' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
]

function toLocalDateStr(date) {
  return date.toLocaleDateString('en-CA')
}

function nowTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Date/Start_time calculados no navegador (não no servidor) — evita o bug de fuso horário
// já documentado no projeto quando "agora" é calculado no backend. O backend usa isso pra
// também representar o serviço na Agenda da profissional (funde no agendamento dela se ela
// já atende essa comanda, ou cria um novo ligado por Booking_group) — ver
// tabController.addItem.
function postAddService(tabId, serviceId, professionalId, confirmOverlap = false) {
  return api.post(`/tab/${tabId}/items`, {
    Item_type: 'service',
    Service_id: serviceId,
    Professional_id: professionalId,
    Quantity: 1,
    Date: toLocalDateStr(new Date()),
    Start_time: nowTimeStr(),
    Confirm_overlap: confirmOverlap,
  })
}

// Comanda não tem data própria — usa a data do agendamento quando existe (o caso comum);
// comandas sem Appointment (combo, ou comanda combinada sem Appointment direto) caem no
// Created_at da própria Tab, que é o fallback mais próximo do "quando essa comanda existiu".
function tabDateStr(t) {
  return t.Appointment?.Date ?? t.Created_at?.slice(0, 10) ?? null
}

function getPeriodRange(preset) {
  if (preset === 'todos' || preset === 'personalizado') return { from: null, to: null }

  const today = new Date()
  const to = toLocalDateStr(today)

  if (preset === 'semana') {
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((day + 6) % 7))
    return { from: toLocalDateStr(monday), to }
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toLocalDateStr(start), to }
}

const PROD_STATUS_LABELS = { encomendado: 'Encomendado', pago: 'Pago', cancelado: 'Cancelado' }
const PROD_STATUS_COLORS = {
  encomendado: 'bg-warning-soft text-warning',
  pago: 'bg-success-soft text-success',
  cancelado: 'bg-surface-2 text-ink-3',
}
const PAYMENT_LABELS_PROD = { dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Crédito', cartao_debito: 'Débito', fiado: 'Mensalista (fiado)' }

function isFiadoTab(t) {
  return (t.Transaction ?? []).some(tx => tx.Method === 'fiado')
}

// Uma comanda paga em mais de uma forma tem N Transactions (o batch_pay_tabs cria uma por
// item por método), então ler só a primeira mostrava um método só e escondia o resto.
// Agrupa por forma de pagamento e soma o valor de cada uma.
function paymentBreakdown(tab) {
  const byMethod = new Map()
  for (const tx of tab.Transaction ?? []) {
    // Gross 0 é sessão de pacote: a cliente pagou na compra do combo, não nesta comanda.
    if (Number(tx.Gross_amount) === 0) continue
    byMethod.set(tx.Method, (byMethod.get(tx.Method) ?? 0) + Number(tx.Gross_amount ?? 0))
  }
  return [...byMethod].map(([method, amount]) => ({ method, amount }))
}

function TabPaymentInfo({ tab }) {
  const isPaga = tab.Status === 'Paga' || tab.Status === 'Pago'
  if (!isPaga) {
    return (
      <div className="rounded-lg px-4 py-3 text-[13px] text-center bg-danger-soft text-danger">
        Comanda expirada
      </div>
    )
  }
  const txs = tab.Transaction ?? []
  const isFiadoPendente = txs.some(tx => tx.Method === 'fiado' && tx.Payment === false)
  const methods = paymentBreakdown(tab)
  const paymentDate = txs.find(tx => tx.Payment_date)?.Payment_date
  const methodLabel = (m) => PAYMENT_LABELS_PROD[m.method] ?? m.method

  return (
    <div className={`rounded-lg px-4 py-3 text-[13px] text-center ${isFiadoPendente ? 'bg-warning/10 text-warning' : 'bg-success-soft text-success'}`}>
      {isFiadoPendente ? 'Registrada como mensalidade' : 'Pagamento confirmado'}
      <div className="mt-1 font-mono text-[11px] opacity-80">
        {methods.length > 1 ? (
          <>
            <div>{methods.map((m, i) => (
              <span key={m.method}>{i > 0 && ' · '}{methodLabel(m)} <MoneyValue>{formatCurrency(m.amount)}</MoneyValue></span>
            ))}</div>
            {paymentDate && <div>{formatDate(paymentDate)}</div>}
          </>
        ) : methods.length === 1
          ? `${methodLabel(methods[0])}${paymentDate ? ` · ${formatDate(paymentDate)}` : ''}${isFiadoPendente ? ' · aguardando quitação' : ''}`
          : txs.length > 0 || tab.Value === 0 ? 'Sessão de combo' : 'Sem transação registrada'}
      </div>
    </div>
  )
}
const inputClsProd = 'h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors w-full'
const EMPTY_ORDER = { Product_id: '', Client_id: '', Quantity: '1', Payment_method: '', Notes: '' }
const PAY_METHODS_PROD = [
  { id: 'pix', icon: 'qr', label: 'Pix' },
  { id: 'dinheiro', icon: 'cash', label: 'Dinheiro' },
  { id: 'cartao_debito', icon: 'card', label: 'Débito' },
  { id: 'cartao_credito', icon: 'card', label: 'Crédito' },
]

const PAY_METHODS_FIADO = { id: 'fiado', icon: 'clock', label: 'Mensalista — cobrar depois' }

function FieldProd({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
function InfoRowProd({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-[12px] text-ink-3 shrink-0">{label}</span>
      <span className={`text-right ${mono ? 'font-mono text-[12px]' : 'text-[13px]'} ${highlight ? 'font-medium text-brand' : 'text-ink-2'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function TabPedidosProdutos() {
  const { addToast } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [payMethod, setPayMethod] = useState('pix')
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
                      {PAY_METHODS_PROD.map((m) => (
                        <button key={m.id} onClick={() => setPayMethod(m.id)}
                          className={`px-3 py-3.5 rounded-[10px] border flex flex-col items-center gap-1.5 text-[13px] cursor-pointer transition-colors
                            ${payMethod === m.id ? 'bg-ink text-bg border-ink' : 'bg-surface border-line hover:border-ink-3'}`}>
                          <Icon name={m.icon} size={20} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setPayMethod(PAY_METHODS_FIADO.id)}
                      className={`w-full px-3 py-3 rounded-[10px] border flex items-center justify-center gap-2 text-[13px] cursor-pointer transition-colors mb-5
                        ${payMethod === 'fiado' ? 'bg-warning/10 text-warning border-warning' : 'bg-surface border-line hover:border-warning/50 text-ink-2'}`}
                    >
                      <Icon name={PAY_METHODS_FIADO.icon} size={16} />
                      {PAY_METHODS_FIADO.label}
                    </button>
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

function statusVariant(s) {
  if (s === 'Em aberto') return 'warning'
  if (s === 'Paga' || s === 'Pago') return 'success'
  return 'danger'
}

function statusLabel(s) {
  if (s === 'Pago') return 'Paga'
  return s
}

function formatDate(iso) {
  if (!iso) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return `${d}/${m}/${y}`
  }
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function formatTime(t) {
  if (!t) return '—'
  return t.slice(0, 5)
}

function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProfissionalComandas() {
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const initialAppointmentId = searchParams.get('appointment')
  const initialGroup = searchParams.get('group')
  const [subTab, setSubTab] = useState('servicos')

  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const { restartTour } = useTour('profissional_comandas', profissionalComandasSteps, !loading)
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [periodPreset, setPeriodPreset] = useState('todos')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [onlyMensalista, setOnlyMensalista] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [paying, setPaying] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Itens da comanda selecionada — GET /tab não traz Tab_items completo (só usa pra
  // calcular o valor pendente), então busca à parte, igual ao ModalFecharConta.
  const [selectedItems, setSelectedItems] = useState([])
  const [editingItemId, setEditingItemId] = useState(null)
  const [updatingItemId, setUpdatingItemId] = useState(null)

  const [batchClient, setBatchClient] = useState(null)
  const [batchPaying, setBatchPaying] = useState(false)
  const [openAccounts, setOpenAccounts] = useState([])

  // Adicionar serviço avulso à comanda selecionada — mesmo endpoint (POST /tab/:id/items)
  // já usado pelo ModalFecharConta, com um profissional escolhido na hora (pode ser
  // diferente do(s) já vinculado(s) à comanda). Profissional primeiro: nem toda
  // profissional atende todo serviço, então a lista de serviços só aparece filtrada por
  // quem já foi escolhido.
  const [professionals, setProfessionals] = useState([])
  const [newServiceProfId, setNewServiceProfId] = useState('')
  const [profServices, setProfServices] = useState([])
  const [loadingProfServices, setLoadingProfServices] = useState(false)
  const [newServiceId, setNewServiceId] = useState('')
  const [addingService, setAddingService] = useState(false)
  const [conflictModal, setConflictModal] = useState(null) // { serviceId, professionalId, message }
  const [confirmingOverlap, setConfirmingOverlap] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([a, b]) => setProfessionals([...(a.data.data ?? []), ...(b.data.data ?? [])]))
      .catch(() => setProfessionals([]))
  }, [])

  useEffect(() => {
    if (!newServiceProfId) { setProfServices([]); return }
    setLoadingProfServices(true)
    api.get('/service', { params: { professional: newServiceProfId, limit: 100 } })
      .then(({ data }) => setProfServices(data.data ?? []))
      .catch(() => setProfServices([]))
      .finally(() => setLoadingProfServices(false))
  }, [newServiceProfId])

  function applyAddedService(newItem, serviceId, professionalId) {
    const service = profServices.find(s => s.UUID === serviceId)
    const professional = professionals.find(p => p.UUID === professionalId)
    const enrichedItem = {
      ...newItem,
      Service: service ? { Name: service.Name } : null,
      Professional: professional ? { Name: professional.Name } : null,
    }
    setSelectedItems(prev => [...prev, enrichedItem])
    setTabs(prev => prev.map(t => t.UUID === selected.UUID
      ? { ...t, Value: t.Value + enrichedItem.Unit_price * enrichedItem.Quantity }
      : t
    ))
    addToast(`${service?.Name ?? 'Serviço'} adicionado à comanda`, 'success')
  }

  async function handleAddService() {
    if (!selected || !newServiceId || !newServiceProfId) return
    setAddingService(true)
    try {
      const { data: newItem } = await postAddService(selected.UUID, newServiceId, newServiceProfId)
      applyAddedService(newItem, newServiceId, newServiceProfId)
      setNewServiceId('')
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.conflict) {
        setConflictModal({ serviceId: newServiceId, professionalId: newServiceProfId, message: err.response.data.error })
      } else {
        addToast(err.response?.data?.error || 'Erro ao adicionar serviço', 'error')
      }
    } finally {
      setAddingService(false)
    }
  }

  async function handleConfirmOverlap() {
    if (!conflictModal || !selected) return
    setConfirmingOverlap(true)
    try {
      const { data: newItem } = await postAddService(selected.UUID, conflictModal.serviceId, conflictModal.professionalId, true)
      applyAddedService(newItem, conflictModal.serviceId, conflictModal.professionalId)
      setNewServiceId('')
      setConflictModal(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao adicionar serviço', 'error')
    } finally {
      setConfirmingOverlap(false)
    }
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [apptRes, tabRes, accountsRes] = await Promise.all([
        api.get('/appointment/my', { params: { limit: 500 } }),
        api.get('/tab', { params: { limit: 1000 } }),
        api.get('/tab/open-accounts'),
      ])
      const apptUUIDs = new Set((apptRes.data.data ?? []).map(a => a.UUID))
      const myTabs = (tabRes.data.data ?? []).filter(t => t.Appointment && apptUUIDs.has(t.Appointment.UUID))
      setTabs(myTabs)
      setOpenAccounts(accountsRes.data.data ?? [])
    } catch {
      setTabs([])
      setOpenAccounts([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Comanda de atendimento combinado (Booking_group) não pertence a UM agendamento — não tem Appointment.UUID
  // próprio, então o link "Abrir comanda" também leva o grupo e a comanda é achada por ele.
  const isTargetTab = t => t.Appointment?.UUID === initialAppointmentId
    || (!!initialGroup && t.Appointment?.Booking_group === initialGroup)

  useEffect(() => {
    if (tabs.length === 0) return
    if (initialAppointmentId) {
      const match = tabs.find(isTargetTab)
      if (match) { setSelectedId(match.UUID); return }
    }
    if (!selectedId) setSelectedId(tabs[0].UUID)
  }, [tabs])

  const filteredByStatus = statusFilter === 'Todos'
    ? tabs
    : tabs.filter(t => {
        if (statusFilter === 'Paga') return t.Status === 'Paga' || t.Status === 'Pago'
        return t.Status === statusFilter
      })

  const { from: periodFrom, to: periodTo } = periodPreset === 'personalizado'
    ? { from: customFrom || null, to: customTo || null }
    : getPeriodRange(periodPreset)

  const filteredByPeriod = (!periodFrom && !periodTo)
    ? filteredByStatus
    : filteredByStatus.filter(t => {
        const d = tabDateStr(t)
        if (!d) return false
        if (periodFrom && d < periodFrom) return false
        if (periodTo && d > periodTo) return false
        return true
      })

  const filteredByMensalista = onlyMensalista
    ? filteredByPeriod.filter(isFiadoTab)
    : filteredByPeriod

  const search_ = search.trim().toLowerCase()
  const filtered = search_
    ? filteredByMensalista.filter(t => (t.Appointment?.Client ?? '').toLowerCase().includes(search_))
    : filteredByMensalista

  const { pageItems: pagedTabs, page, setPage, totalPages } = usePagination(filtered, 20)

  useEffect(() => { setPage(1) }, [statusFilter, periodFrom, periodTo, search, onlyMensalista])

  const selected = tabs.find(t => t.UUID === selectedId)

  const emAberto = tabs.filter(t => t.Status === 'Em aberto').length
  const totalAberto = tabs.filter(t => t.Status === 'Em aberto').reduce((s, t) => s + t.Value, 0)

  const cr = useCreditAndTroco({
    clientId: selected?.Appointment?.ClientId,
    total: selected?.Value ?? 0,
    resetKey: selectedId,
  })
  const sp = usePaymentSplit({ total: cr.remainingAfterCredit, resetKey: selectedId })

  useEffect(() => {
    if (!selectedId) { setSelectedItems([]); return }
    api.get(`/tab/${selectedId}`)
      .then(({ data }) => setSelectedItems(data.Tab_items ?? []))
      .catch(() => setSelectedItems([]))
  }, [selectedId])

  // Edita o Unit_price de um item da comanda selecionada — mesmo padrão do
  // ModalFecharConta.jsx (PATCH /tab/:id/items/:itemId recalcula Tab.Value via trigger no
  // banco; local só espelha a mesma soma pra não precisar rebuscar tudo).
  async function handleUpdateItemPrice(item, rawValue) {
    setEditingItemId(null)
    const newPrice = parseFloat(String(rawValue).replace(',', '.'))
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice === item.Unit_price) return
    setUpdatingItemId(item.UUID)
    try {
      const { data: updatedItem } = await api.patch(`/tab/${selected.UUID}/items/${item.UUID}`, { Unit_price: newPrice })
      const nextItems = selectedItems.map(i =>
        i.UUID === updatedItem.UUID ? { ...i, Unit_price: updatedItem.Unit_price, Quantity: updatedItem.Quantity } : i
      )
      setSelectedItems(nextItems)
      setTabs(prev => prev.map(t => t.UUID === selected.UUID
        ? { ...t, Value: nextItems.filter(i => i.Status !== 'pago').reduce((s, i) => s + i.Unit_price * i.Quantity, 0) }
        : t
      ))
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar valor do item', 'error')
    } finally {
      setUpdatingItemId(null)
    }
  }

  function renderItemPrice(item) {
    if (editingItemId === item.UUID) {
      return (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          defaultValue={item.Unit_price}
          onInput={e => {
            const cleaned = e.target.value.replace(/[^0-9.,]/g, '')
            if (cleaned !== e.target.value) e.target.value = cleaned
          }}
          onBlur={e => handleUpdateItemPrice(item, e.target.value.replace(',', '.'))}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') { e.target.value = item.Unit_price; e.target.blur() }
          }}
          className="w-20 h-6 px-1.5 rounded border border-brand bg-surface text-ink text-[12.5px] font-mono text-right focus:outline-none shrink-0"
        />
      )
    }
    const isUpdating = updatingItemId === item.UUID
    return (
      <button
        type="button"
        onClick={() => setEditingItemId(item.UUID)}
        disabled={isUpdating}
        title="Editar valor do item"
        className="font-mono shrink-0 hover:text-brand hover:underline decoration-dotted underline-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        <MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue>
      </button>
    )
  }

  async function handlePagar() {
    if (!selected) return
    setPaying(true)
    try {
      // Mesma RPC do "Fechar conta" (batch_pay_tabs), com um único tab_id — ver comentário
      // equivalente em AdminCaixa.jsx: o caminho antigo fechava comanda multi-item sem
      // tocar nos Tab_items e perdia a comissão dos demais profissionais.
      const clientId = selected.Appointment?.ClientId
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: [selected.UUID],
        Payment_date: new Date().toISOString(),
        ...(clientId ? { client_id: clientId } : {}),
        ...sp.toRequestBody(),
        ...cr.extra,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Pagamento registrado. ${extraMsg}` : 'Pagamento registrado', 'success')
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao registrar pagamento', 'error')
    } finally {
      setPaying(false)
    }
  }

  async function handleDeleteTab() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await api.delete(`/tab/${deleteModal.UUID}`)
      addToast('Comanda excluída', 'success')
      setDeleteModal(null)
      if (selectedId === deleteModal.UUID) setSelectedId(null)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao excluir comanda', 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function openBatchModal(c) {
    try {
      const { data } = await api.get(`/tab/client/${c.client_id}/account-summary`)
      setBatchClient(data)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao carregar conta do cliente', 'error')
    }
  }

  async function handleFecharConta(tabIds, orderPayments, excludedItemIds, paymentBody) {
    if (!batchClient) return
    setBatchPaying(true)
    try {
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: tabIds,
        Payment_date: new Date().toISOString(),
        order_payments: orderPayments,
        excluded_item_ids: excludedItemIds,
        client_id: batchClient.client_id,
        ...paymentBody,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Conta de ${batchClient.client_name} fechada com sucesso. ${extraMsg}` : `Conta de ${batchClient.client_name} fechada com sucesso`, 'success')
      setBatchClient(null)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao fechar conta', 'error')
    } finally {
      setBatchPaying(false)
    }
  }

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional" />
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="mb-5 md:mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Comandas</h3>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
        <div data-tour="sub-abas" className="flex gap-1 border-b border-line">
          {[['servicos', 'Serviços', 'scissors'], ['produtos', 'Produtos', 'package']].map(([id, label, icon]) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer
                ${subTab === id ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink-2'}`}>
              <Icon name={icon} size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'produtos' ? <TabPedidosProdutos /> : null}

      {subTab === 'servicos' && <>

      <div className="flex items-center justify-between mb-5 md:mb-6">
        <p className="text-[12px] md:text-[13px] text-ink-3">
          {emAberto} em aberto · <MoneyValue>{formatCurrency(totalAberto)}</MoneyValue> a receber
        </p>
      </div>

      {/* Contas a fechar */}
      {openAccounts.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">
            {openAccounts.length === 1 ? 'Conta em aberto' : 'Contas em aberto'}
          </p>
          {openAccounts.map((c, idx) => (
            <div key={c.client_id} className="flex items-center justify-between gap-3 bg-surface border border-line rounded-[12px] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={c.client_name} index={idx} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{c.client_name}</div>
                  <div className="font-mono text-[11px] text-ink-3">
                    {c.tab_count + c.order_count} ite{c.tab_count + c.order_count !== 1 ? 'ns' : 'm'} · <MoneyValue>{formatCurrency(c.total)}</MoneyValue>
                  </div>
                </div>
              </div>
              <button
                onClick={() => openBatchModal(c)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-medium bg-brand text-white hover:bg-brand/90 transition-colors cursor-pointer">
                <Icon name="cash" size={13} />
                Fechar conta
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-xl shrink-0 overflow-x-auto">
          {PERIOD_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodPreset(p.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                periodPreset === p.key ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-3 hover:text-ink'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {periodPreset === 'personalizado' && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              max={customTo || undefined}
              className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand"
            />
            <span className="text-ink-4 text-[12px]">até</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              min={customFrom || undefined}
              className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand"
            />
          </div>
        )}
      </div>

      {/* Busca + Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-5">
        <div className="relative flex-1 sm:max-w-[280px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full h-[36px] pl-8 pr-3 rounded-full border border-line bg-surface text-ink-2 text-[13px] placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
                ${statusFilter === s ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
              {s}
            </button>
          ))}
          <button onClick={() => setOnlyMensalista(v => !v)}
            className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${onlyMensalista ? 'bg-warning text-white border-warning' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
            Mensalistas
          </button>
        </div>
      </div>

      {/* Modal fechar conta */}
      {batchClient && (
        <ModalFecharConta
          client={batchClient}
          paying={batchPaying}
          onClose={() => setBatchClient(null)}
          onConfirm={handleFecharConta}
        />
      )}

      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDeleteTab}
        title="Excluir comanda"
        message={`Excluir a comanda de "${deleteModal?.Appointment?.Client ?? 'cliente'}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />

      <Modal
        isOpen={!!conflictModal}
        onClose={() => setConflictModal(null)}
        onConfirm={handleConfirmOverlap}
        title="Conflito de horário"
        message={`${conflictModal?.message ?? ''} Deseja lançar mesmo assim?`}
        confirmLabel="Lançar mesmo assim"
        loading={confirmingOverlap}
      />

      {loading ? <PageSpinner /> : tabs.length === 0 ? (
        <EmptyState icon="tag" title="Nenhuma comanda" description="Suas comandas aparecerão aqui após os atendimentos." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">

          {/* Lista */}
          <div data-tour="comanda-lista" className={`bg-surface border border-line rounded-[14px] overflow-hidden h-fit ${selectedId ? 'hidden lg:block' : ''}`}>
            <div className="px-5 py-3.5 border-b border-line flex justify-between items-center">
              <div className="font-display font-medium text-[16px]">Comandas</div>
              <span className="font-mono text-[11px] text-ink-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-ink-3 text-[13px]">Nenhuma comanda neste filtro</div>
            ) : pagedTabs.map((t, idx) => (
              <button key={t.UUID} onClick={() => setSelectedId(t.UUID)}
                className={`w-full flex items-center gap-3 px-4 md:px-5 py-3.5 md:py-4 border-b border-line-2 last:border-0 cursor-pointer transition-colors text-left
                  ${t.UUID === selectedId ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}>
                <Avatar name={t.Appointment?.Client ?? '?'} index={idx} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[13px] md:text-[13.5px] font-medium truncate">{t.Appointment?.Client ?? 'Sem agendamento'}</div>
                    {t.Appointment?.Recurring_appointment_id && (
                      <span title="Agendamento recorrente" className="flex-shrink-0 text-ink-4">
                        <Icon name="repeat" size={11} />
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">
                    {t.Appointment
                      ? t.Appointment.Service
                        ? `${t.Appointment.Service} · ${formatDate(t.Appointment.Date)} · ${formatTime(t.Appointment.Start_time)}`
                        : `Atendimento combinado · ${formatDate(t.Appointment.Date)} · ${formatTime(t.Appointment.Start_time)}`
                      : `Criada em ${formatDate(t.Created_at)}`}
                  </div>
                </div>
                <div className="font-mono text-[12px] md:text-[13px] font-medium shrink-0">
                  <MoneyValue>{formatCurrency(t.Value)}</MoneyValue>
                </div>
                {isFiadoTab(t)
                  ? <Chip variant="warning" className="shrink-0">Mensalista</Chip>
                  : <Chip variant={statusVariant(t.Status)} className="shrink-0">{statusLabel(t.Status)}</Chip>}
              </button>
            ))}
            {filtered.length > 0 && (
              <div className="px-4 md:px-5 py-3">
                <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            )}
          </div>

          {/* Painel de pagamento — sticky: acompanha o scroll normalmente até a lista
              alcançá-lo, aí trava no topo (top-6) enquanto o resto da lista continua
              passando por baixo. Wrapper com lg:h-full dá "espaço de sobra" na célula do
              grid pra isso funcionar — sem ele o sticky não gruda (a célula fica exatamente
              do tamanho do painel, sem folga pra ele se mover). */}
          {selected && (
          <div className="lg:h-full">
            <div data-tour="comanda-painel" className="bg-surface border border-line rounded-[14px] h-fit lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] flex flex-col">
              <button onClick={() => setSelectedId(null)} className="lg:hidden w-full flex items-center gap-1.5 px-6 pt-4 text-[12px] text-ink-3 hover:text-brand transition-colors cursor-pointer shrink-0">
                <Icon name="arrowLeft" size={14} />
                Voltar para a lista
              </button>
              <div className="px-6 py-5 border-b border-line shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Comanda selecionada</span>
                  {selected.Status === 'Em aberto' && (
                    <button
                      type="button"
                      onClick={() => setDeleteModal(selected)}
                      title="Excluir comanda"
                      className="text-ink-4 hover:text-danger transition-colors cursor-pointer shrink-0"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
                <h4 className="font-display font-medium text-[19px] tracking-tight mt-1.5">
                  {selected.Appointment?.Client ?? 'Comanda avulsa'}
                </h4>
                {selected.Appointment && (
                  <div className="font-mono text-[11.5px] text-ink-3 mt-1">
                    {selected.Appointment.Service
                      ? `${selected.Appointment.Service} · ${formatDate(selected.Appointment.Date)} · ${formatTime(selected.Appointment.Start_time)}`
                      : `Atendimento combinado · ${formatDate(selected.Appointment.Date)} · ${formatTime(selected.Appointment.Start_time)}`}
                  </div>
                )}
              </div>

              <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0 scrollbar-hidden">
                {selectedItems.length > 0 && (
                  <div className="pb-3.5 border-b border-dashed border-line-2 mb-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">Itens</div>
                    <div className="space-y-1.5">
                      {selectedItems.map(item => (
                        <div key={item.UUID} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="text-ink-2 truncate flex items-center gap-1.5">
                            {(item.Item_type === 'product' ? item.Product?.Name : item.Service?.Name) ?? '—'}
                            {item.Quantity > 1 ? ` ×${item.Quantity}` : ''}
                            {item.Via_package && (
                              <span className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand shrink-0">
                                Pago no pacote
                              </span>
                            )}
                          </span>
                          {item.Status === 'pago'
                            ? <span className="font-mono text-ink-4 shrink-0"><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>
                            : selected.Status === 'Em aberto' && user?.role === 'Admin'
                              ? renderItemPrice(item)
                              : <span className="font-mono shrink-0"><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.Status === 'Em aberto' && (
                  <div className="pb-3.5 border-b border-dashed border-line-2 mb-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">Adicionar serviço</div>
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={newServiceProfId}
                        onChange={e => { setNewServiceProfId(e.target.value); setNewServiceId('') }}
                        className="h-8 px-2 rounded-md border border-line bg-surface text-ink-2 text-[12px] focus:outline-none focus:border-brand transition-colors"
                      >
                        <option value="">Profissional...</option>
                        {professionals.map(p => <option key={p.UUID} value={p.UUID}>{p.Name}</option>)}
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          value={newServiceId}
                          onChange={e => setNewServiceId(e.target.value)}
                          disabled={!newServiceProfId || loadingProfServices}
                          className="h-8 flex-1 min-w-0 px-2 rounded-md border border-line bg-surface text-ink-2 text-[12px] focus:outline-none focus:border-brand transition-colors disabled:opacity-50"
                        >
                          <option value="">{loadingProfServices ? 'Carregando...' : 'Serviço...'}</option>
                          {profServices.map(s => <option key={s.UUID} value={s.UUID}>{s.Name}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddService}
                          disabled={!newServiceId || !newServiceProfId || addingService}
                          title="Adicionar à comanda"
                          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      {newServiceProfId && !loadingProfServices && profServices.length === 0 && (
                        <div className="text-[11px] text-ink-4">Essa profissional não atende nenhum serviço.</div>
                      )}
                    </div>
                  </div>
                )}

                {selected.Status === 'Em aberto' && cr.parsedCreditAmount > 0 && (
                  <div className="flex justify-between items-center py-2 text-[13px]">
                    <span className="text-ink-3">Desconto crédito</span>
                    <span className="font-mono font-medium text-danger">-<MoneyValue>{formatCurrency(cr.parsedCreditAmount)}</MoneyValue></span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3.5 border-b border-dashed border-line-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Valor</span>
                  <span className="font-display text-[22px] font-medium"><MoneyValue>{formatCurrency(selected.Status === 'Em aberto' ? cr.remainingAfterCredit : selected.Value)}</MoneyValue></span>
                </div>

                {selected.Status === 'Em aberto' && selected.Appointment?.ClientId && (
                  <CreditToggleRow cr={cr} className="py-3.5 border-b border-dashed border-line-2" editable={false} />
                )}

                <div className="flex justify-between items-center py-3.5 border-b border-dashed border-line-2 mb-4">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Status</span>
                  <Chip variant={statusVariant(selected.Status)}>{statusLabel(selected.Status)}</Chip>
                </div>

                {selected.Status === 'Em aberto' ? (
                  <>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3 mb-2.5">
                      Método de pagamento
                    </div>
                    <PaymentMethodSplit sp={sp} />

                    <Button variant="primary" className="w-full justify-center mt-3" onClick={handlePagar} loading={paying} disabled={!sp.valid}>
                      <Icon name="check" size={14} />
                      {sp.isFiado ? 'Registrar mensalidade' : 'Registrar pagamento'}
                    </Button>
                  </>
                ) : (
                  <TabPaymentInfo tab={selected} />
                )}

                <div className="h-px bg-line my-4" />
                <div className="font-mono text-[11px] text-ink-3">
                  Expira em {formatDate(selected.Expire_at)}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
      </>}
    </AppLayout>
  )
}
