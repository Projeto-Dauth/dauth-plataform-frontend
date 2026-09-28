import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import MoneyValue from '@/components/ui/MoneyValue'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'

const navItems = navItemsByRole['Admin']

function formatPrice(p) {
  if (!p && p !== 0) return '—'
  return `R$ ${Number(p).toFixed(2).replace('.', ',')}`
}

const EMPTY = { Name: '', Description: '', Price: '', Stock: '' }

export default function AdminProdutos() {
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState(EMPTY)
  const [drawer, setDrawer] = useState(false)   // false | 'create' | uuid
  const [saving, setSaving] = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(null) // UUID do produto sendo alternado

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/product', { params: { limit: 100 } })
      setProducts(data.data ?? [])
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm(EMPTY)
    setDrawer('create')
  }

  function openEdit(p) {
    setForm({
      Name: p.Name,
      Description: p.Description ?? '',
      Price: p.Price,
      Stock: p.Stock,
    })
    setDrawer(p.UUID)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const body = {
      Name: form.Name,
      Description: form.Description || null,
      Price: Number(form.Price),
      Stock: Number(form.Stock),
    }
    try {
      if (drawer === 'create') {
        await api.post('/product', body)
        addToast('Produto criado', 'success')
      } else {
        await api.patch(`/product/${drawer}`, body)
        addToast('Produto atualizado', 'success')
      }
      setDrawer(false)
      load()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao salvar produto', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(p) {
    if (toggling) return
    setToggling(p.UUID)
    try {
      await api.patch(`/product/${p.UUID}`, { Active: !p.Active })
      addToast(p.Active ? 'Produto desativado' : 'Produto ativado', 'success')
      load()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar produto', 'error')
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete() {
    if (!deleteItem) return
    setDeleting(true)
    try {
      await api.delete(`/product/${deleteItem.UUID}`)
      addToast('Produto excluído', 'success')
      setDeleteItem(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao excluir produto', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin" />
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Produtos</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Gerencie os produtos à venda no salão</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Icon name="plus" size={14} />
          Novo produto
        </Button>
      </div>

      {loading ? <PageSpinner /> : products.length === 0 ? (
        <EmptyState
          icon="tag"
          title="Nenhum produto cadastrado"
          description="Cadastre o primeiro produto do salão."
          action={openCreate}
          actionLabel="Novo produto"
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Produto', 'Descrição', 'Preço', 'Estoque', 'Status', ''].map((h) => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.UUID} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3.5 py-3 text-[13px] font-medium border-b border-line-2">{p.Name}</td>
                    <td className="px-3.5 py-3 text-[13px] text-ink-3 border-b border-line-2 max-w-[200px] truncate">
                      {p.Description || <span className="italic text-ink-4">—</span>}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[12px] text-ink-2 border-b border-line-2"><MoneyValue>{formatPrice(p.Price)}</MoneyValue></td>
                    <td className="px-3.5 py-3 font-mono text-[12px] border-b border-line-2">
                      <span className={p.Stock === 0 ? 'text-danger' : 'text-ink-2'}>{p.Stock}</span>
                    </td>
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <button
                        onClick={() => handleToggleActive(p)}
                        disabled={toggling === p.UUID}
                        className={`font-mono text-[10.5px] uppercase tracking-widest px-2 py-0.5 rounded transition-colors
                          ${toggling === p.UUID ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          ${p.Active ? 'bg-success-soft text-success hover:bg-success/20' : 'bg-surface-2 text-ink-3 hover:bg-surface-3'}`}
                      >
                        {toggling === p.UUID ? '...' : p.Active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-3.5 py-3 text-right border-b border-line-2">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Icon name="edit" size={13} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteItem(p)}><Icon name="trash" size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {products.map((p) => (
              <div key={p.UUID} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-[14px]">{p.Name}</div>
                  <div className="font-display text-[16px] font-medium shrink-0"><MoneyValue>{formatPrice(p.Price)}</MoneyValue></div>
                </div>
                {p.Description && (
                  <div className="text-[12px] text-ink-3 mb-2 line-clamp-2">{p.Description}</div>
                )}
                <div className="flex items-center gap-3 text-[12px] text-ink-3 mb-3">
                  <span>Estoque: <span className={p.Stock === 0 ? 'text-danger font-medium' : ''}>{p.Stock}</span></span>
                  <span>·</span>
                  <button
                    onClick={() => handleToggleActive(p)}
                    disabled={toggling === p.UUID}
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded transition-colors
                      ${toggling === p.UUID ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      ${p.Active ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-3'}`}
                  >
                    {toggling === p.UUID ? '...' : p.Active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                <div className="flex gap-2 pt-3 border-t border-line-2">
                  <Button variant="ghost" size="sm" className="flex-1 justify-center" onClick={() => openEdit(p)}>
                    <Icon name="edit" size={13} /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 justify-center" onClick={() => setDeleteItem(p)}>
                    <Icon name="trash" size={13} /> Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-ink/30" onClick={() => setDrawer(false)} />
          <div className="w-full md:w-[420px] bg-surface border-l border-line h-full overflow-y-auto p-5 md:p-7 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-display font-medium text-[20px] tracking-tight">
                {drawer === 'create' ? 'Novo produto' : 'Editar produto'}
              </h4>
              <button onClick={() => setDrawer(false)} className="text-ink-3 hover:text-ink cursor-pointer transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4 flex-1">
              <Field label="Nome do produto">
                <input
                  required
                  value={form.Name}
                  onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))}
                  placeholder="Ex: Shampoo Keratina 300ml"
                  className={inputCls}
                />
              </Field>
              <Field label="Descrição (opcional)">
                <textarea
                  value={form.Description}
                  onChange={(e) => setForm((f) => ({ ...f, Description: e.target.value }))}
                  placeholder="Detalhes do produto..."
                  rows={3}
                  className={`${inputCls} h-auto py-2.5 resize-none`}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.Price}
                    onChange={(e) => setForm((f) => ({ ...f, Price: e.target.value }))}
                    placeholder="0,00"
                    className={inputCls}
                  />
                </Field>
                <Field label="Estoque">
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.Stock}
                    onChange={(e) => setForm((f) => ({ ...f, Stock: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="flex gap-2 mt-auto pt-4">
                <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={() => setDrawer(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1 justify-center" loading={saving}>
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Excluir produto"
        message={`"${deleteItem?.Name}" será removido permanentemente.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
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
