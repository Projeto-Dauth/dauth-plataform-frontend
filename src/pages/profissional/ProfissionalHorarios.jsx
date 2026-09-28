import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'

const DOW_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DOW_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const EMPTY_FORM = { start_time: '09:00', end_time: '18:00', break_start: '', break_end: '' }

function inputCls(err) {
  return `w-full h-[42px] px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors ${err ? 'border-danger' : 'border-line'}`
}

export default function ProfissionalHorarios() {
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const [workingHours, setWorkingHours] = useState([])
  const [loading, setLoading] = useState(true)

  const [drawer, setDrawer] = useState(null) // { mode: 'add'|'edit', weekday, wh? }
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    load()
  }, [user?.id])

  function load() {
    setLoading(true)
    api.get(`/working-hours/professional/${user.id}`)
      .then(({ data }) => setWorkingHours(data.data ?? []))
      .catch(() => addToast('Erro ao carregar horários', 'error'))
      .finally(() => setLoading(false))
  }

  const whByDay = Object.fromEntries(workingHours.map((w) => [w.Weekday, w]))

  function openAdd(weekday) {
    setForm(EMPTY_FORM)
    setErrors({})
    setDrawer({ mode: 'add', weekday })
  }

  function openEdit(wh) {
    setForm({
      start_time: wh.Start_time.slice(0, 5),
      end_time: wh.End_time.slice(0, 5),
      break_start: wh.Break_start ? wh.Break_start.slice(0, 5) : '',
      break_end: wh.Break_end ? wh.Break_end.slice(0, 5) : '',
    })
    setErrors({})
    setDrawer({ mode: 'edit', weekday: wh.Weekday, wh })
  }

  function validate() {
    const e = {}
    if (!form.start_time) e.start_time = 'Obrigatório'
    if (!form.end_time) e.end_time = 'Obrigatório'
    if (form.start_time && form.end_time && form.end_time <= form.start_time)
      e.end_time = 'Horário de fim deve ser após o início'

    const hasBreak = form.break_start || form.break_end
    if (hasBreak) {
      if (!form.break_start) e.break_start = 'Obrigatório quando há intervalo'
      if (!form.break_end) e.break_end = 'Obrigatório quando há intervalo'
      if (form.break_start && form.break_end) {
        if (form.break_end <= form.break_start)
          e.break_end = 'Fim do intervalo deve ser após o início'
        if (form.break_start < form.start_time)
          e.break_start = 'Intervalo deve estar dentro do horário de trabalho'
        if (form.break_end > form.end_time)
          e.break_end = 'Intervalo deve estar dentro do horário de trabalho'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSaveAdd() {
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/working-hours', {
        professional_id: user.id,
        weekday: drawer.weekday,
        start_time: form.start_time,
        end_time: form.end_time,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
      })
      addToast('Horário adicionado')
      setDrawer(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao salvar horário', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!validate()) return
    setSaving(true)
    try {
      await api.patch(`/working-hours/${drawer.wh.UUID}`, {
        start_time: form.start_time,
        end_time: form.end_time,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
      })
      addToast('Horário atualizado')
      setDrawer(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao salvar horário', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleSaveDispatch() {
    if (drawer?.mode === 'add') return handleSaveAdd()
    return handleSaveEdit()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/working-hours/${deleteTarget.UUID}`)
      addToast('Horário removido')
      setDeleteTarget(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao remover horário', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const sidebar = (
    <Sidebar navItems={navItemsByRole[user?.role] ?? navItemsByRole.Profissional} footerUser={user?.name} footerRole={user?.role}>{user?.role}</Sidebar>
  )

  if (loading) return (
    <AppLayout sidebar={sidebar}>
      <div className="flex justify-between items-end mb-7">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-44 bg-surface-2 rounded-lg animate-pulse" />
          <div className="h-4 w-28 bg-surface-2 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-5 p-5 bg-surface border border-line rounded-xl">
            <div className="w-28 shrink-0 flex flex-col gap-1.5">
              <div className="h-4 w-20 bg-surface-2 rounded animate-pulse" />
              <div className="h-3 w-8 bg-surface-2 rounded animate-pulse" />
            </div>
            <div className="flex-1 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-surface-2 shrink-0" />
              <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-surface-2 rounded-lg animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </AppLayout>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex justify-between items-end mb-7">
        <div>
          <h3 className="font-display font-medium text-[26px] tracking-tight">Meus horários</h3>
          <p className="text-[13px] text-ink-3 mt-1">
            {workingHours.length} dia{workingHours.length !== 1 ? 's' : ''} configurado{workingHours.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Grade dos 7 dias */}
      <div className="grid gap-3">
        {DOW_LABELS.map((label, idx) => {
          const wh = whByDay[idx]
          return (
            <div
              key={idx}
              className="flex items-center gap-5 p-5 bg-surface border border-line rounded-xl"
            >
              {/* Dia */}
              <div className="w-28 shrink-0">
                <div className="font-display font-medium text-[15px]">{label}</div>
                <div className="font-mono text-[10.5px] text-ink-4 uppercase tracking-widest">{DOW_SHORT[idx]}</div>
              </div>

              {/* Status */}
              {wh ? (
                <>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                      <span className="font-mono text-[13.5px] text-ink-2 font-medium">
                        {wh.Start_time.slice(0, 5)} – {wh.End_time.slice(0, 5)}
                      </span>
                    </div>
                    {wh.Break_start && wh.Break_end && (
                      <div className="flex items-center gap-2 ml-5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 border border-line text-[11px] font-mono text-ink-3">
                          <Icon name="clock" size={10} />
                          Intervalo {wh.Break_start.slice(0, 5)} – {wh.Break_end.slice(0, 5)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(wh)}
                      className="p-2 rounded-lg border border-line hover:border-brand hover:text-brand transition-colors text-ink-3"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(wh)}
                      className="p-2 rounded-lg border border-line hover:border-danger hover:text-danger transition-colors text-ink-3"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-line shrink-0" />
                    <span className="text-[13px] text-ink-4">Folga</span>
                  </div>
                  <button
                    onClick={() => openAdd(idx)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12.5px] text-ink-3 hover:border-brand hover:text-brand transition-colors"
                  >
                    <Icon name="plus" size={12} />Adicionar
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => !saving && setDrawer(null)} />
          <div className="w-full md:w-80 bg-surface border-l border-line h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 md:px-6 py-5 border-b border-line">
              <h4 className="font-display font-medium text-[17px]">
                {drawer.mode === 'add' ? 'Adicionar horário' : 'Editar horário'}
              </h4>
              <button onClick={() => setDrawer(null)} className="text-ink-3 hover:text-ink transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 md:py-6 flex flex-col gap-4">
              <p className="text-[13px] font-medium text-ink-2">
                {DOW_LABELS[drawer.weekday]}
              </p>

              <div>
                <label className="block text-[12px] font-medium text-ink-3 mb-1.5">Início</label>
                <input
                  type="time"
                  className={inputCls(errors.start_time)}
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
                {errors.start_time && <p className="text-[11px] text-danger mt-1">{errors.start_time}</p>}
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink-3 mb-1.5">Fim</label>
                <input
                  type="time"
                  className={inputCls(errors.end_time)}
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
                {errors.end_time && <p className="text-[11px] text-danger mt-1">{errors.end_time}</p>}
              </div>

              {/* Seção de intervalo */}
              <div className="border-t border-line pt-4">
                <p className="text-[12px] font-medium text-ink-3 mb-3">Intervalo (opcional)</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-ink-3 mb-1.5">Início do intervalo</label>
                    <input
                      type="time"
                      className={inputCls(errors.break_start)}
                      value={form.break_start}
                      onChange={(e) => setForm((f) => ({ ...f, break_start: e.target.value }))}
                    />
                    {errors.break_start && <p className="text-[11px] text-danger mt-1">{errors.break_start}</p>}
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-ink-3 mb-1.5">Fim do intervalo</label>
                    <input
                      type="time"
                      className={inputCls(errors.break_end)}
                      value={form.break_end}
                      onChange={(e) => setForm((f) => ({ ...f, break_end: e.target.value }))}
                    />
                    {errors.break_end && <p className="text-[11px] text-danger mt-1">{errors.break_end}</p>}
                  </div>
                  {(form.break_start || form.break_end) && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, break_start: '', break_end: '' }))}
                      className="text-[11.5px] text-danger hover:underline text-left"
                    >
                      Remover intervalo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 md:px-6 py-5 border-t border-line flex gap-2.5">
              <Button onClick={handleSaveDispatch} loading={saving} className="flex-1">
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setDrawer(null)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover horário"
        message={`Remover horário de ${deleteTarget ? DOW_LABELS[deleteTarget.Weekday] : ''}? Os agendamentos existentes não serão afetados.`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </AppLayout>
  )
}
