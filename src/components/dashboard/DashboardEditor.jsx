import { useMemo, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import Widget from './Widget'
import WidgetConfigPanel from './WidgetConfigPanel'
import { ROW_HEIGHT, GRID_GAP } from './DashboardGrid'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import { METRICS } from '@/config/dashboardCatalog'
import { DEFAULT_DASHBOARD_WIDGETS } from '@/config/defaultDashboardWidgets'

const Grid = WidthProvider(GridLayout)
const MAX_WIDGETS = 24 // mesmo limite do backend (MAX_WIDGETS)

const newId = () => `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Editor do dashboard personalizado (Business). Trabalha num rascunho local: nada vai ao servidor até "Salvar".
// Desktop: arrastar pela barra do widget e redimensionar pelo canto. Celular: lista para configurar/remover/adicionar
// (reorganizar fica para o computador).
export default function DashboardEditor({ initialWidgets, period, hasSaved, saving, onSave, onCancel, onResetToOriginal }) {
  const [widgets, setWidgets] = useState(initialWidgets)
  const [selectedId, setSelectedId] = useState(null)
  const [confirmOriginal, setConfirmOriginal] = useState(false)
  const dirty = useMemo(() => !sameLayout(widgets, initialWidgets), [widgets, initialWidgets])
  const selected = widgets.find(w => w.id === selectedId)

  const update = (next) => setWidgets(ws => ws.map(w => (w.id === next.id ? next : w)))
  const remove = (id) => { setWidgets(ws => ws.filter(w => w.id !== id)); setSelectedId(null) }

  function add() {
    if (widgets.length >= MAX_WIDGETS) return
    const bottom = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    const widget = {
      id: newId(), type: 'barra', title: '', query: { metric: 'faturamento', dimension: 'dia' }, style: {},
      x: 0, y: bottom, w: 6, h: 4,
    }
    setWidgets(ws => [...ws, widget])
    setSelectedId(widget.id)
  }

  // react-grid-layout devolve só posição/tamanho; o resto do widget fica como está.
  function onLayoutChange(layout) {
    setWidgets(ws => {
      const next = ws.map(w => {
        const l = layout.find(item => item.i === w.id)
        return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w
      })
      return sameLayout(next, ws) ? ws : next
    })
  }

  const ordered = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x)

  return (
    <div className="space-y-4">
      {/* Barra de edição */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-3">
        <p className="text-[13px] text-ink-3">
          {dirty ? <span className="text-ink font-medium">Você tem alterações não salvas</span> : 'Edite o dashboard: adicione, mova e configure os widgets.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={add} disabled={widgets.length >= MAX_WIDGETS}>
            <Icon name="plus" size={14} /> Adicionar widget
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setWidgets(DEFAULT_DASHBOARD_WIDGETS); setSelectedId(null) }}>
            Usar modelo inicial
          </Button>
          {hasSaved && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmOriginal(true)}>Voltar ao dashboard original</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>{dirty ? 'Descartar' : 'Sair'}</Button>
          <Button size="sm" onClick={() => onSave(widgets)} loading={saving} disabled={!dirty || widgets.length === 0}>Salvar alterações</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div>
          {widgets.length === 0 && (
            <p className="text-sm text-ink-4 text-center py-16 border border-dashed border-line rounded-xl">
              Nenhum widget. Use “Adicionar widget” ou “Usar modelo inicial”.
            </p>
          )}

          {/* Desktop: grade editável */}
          <div className="hidden md:block">
            <Grid
              layout={widgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 2 }))}
              cols={12}
              rowHeight={ROW_HEIGHT}
              margin={[GRID_GAP, GRID_GAP]}
              containerPadding={[0, 0]}
              draggableHandle=".widget-drag"
              onLayoutChange={onLayoutChange}
            >
              {widgets.map(w => (
                <div key={w.id} className={`flex flex-col rounded-xl overflow-hidden ${selectedId === w.id ? 'ring-2 ring-brand' : ''}`}>
                  <div className="widget-drag h-7 shrink-0 flex items-center justify-between px-2 cursor-move bg-surface-2 border border-line border-b-0 rounded-t-xl">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-ink-4">Arrastar</span>
                    <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
                      <button type="button" aria-label={`Configurar ${w.title || METRICS[w.query.metric].label}`} onClick={() => setSelectedId(w.id)} className="p-1 text-ink-3 hover:text-brand cursor-pointer">
                        <Icon name="edit" size={13} />
                      </button>
                      <button type="button" aria-label={`Remover ${w.title || METRICS[w.query.metric].label}`} onClick={() => remove(w.id)} className="p-1 text-ink-3 hover:text-danger cursor-pointer">
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0"><Widget widget={w} period={period} /></div>
                </div>
              ))}
            </Grid>
          </div>

          {/* Celular: lista simples */}
          <div className="md:hidden space-y-2">
            <p className="text-xs text-ink-4">Para mover e redimensionar os widgets, use um computador.</p>
            {ordered.map(w => (
              <div key={w.id} className={`flex items-center justify-between gap-3 bg-surface border rounded-xl px-4 py-3 ${selectedId === w.id ? 'border-brand' : 'border-line'}`}>
                <span className="text-sm text-ink truncate">{w.title || METRICS[w.query.metric].label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" aria-label={`Configurar ${w.title || METRICS[w.query.metric].label}`} onClick={() => setSelectedId(w.id)} className="p-2 text-ink-3 cursor-pointer"><Icon name="edit" size={15} /></button>
                  <button type="button" aria-label={`Remover ${w.title || METRICS[w.query.metric].label}`} onClick={() => remove(w.id)} className="p-2 text-ink-3 cursor-pointer"><Icon name="trash" size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div className="lg:sticky lg:top-20">
            <WidgetConfigPanel widget={selected} onChange={update} onRemove={() => remove(selected.id)} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      <Modal
        isOpen={confirmOriginal}
        onClose={() => setConfirmOriginal(false)}
        onConfirm={() => { setConfirmOriginal(false); onResetToOriginal() }}
        title="Voltar ao dashboard original?"
        message={'Seu dashboard personalizado será apagado e o dashboard padrão volta a ser exibido.\nVocê pode personalizar de novo quando quiser.'}
        confirmLabel="Voltar ao original"
        confirmVariant="primary"
        loading={saving}
      />
    </div>
  )
}
