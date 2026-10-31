import Widget from './Widget'

export const ROW_HEIGHT = 80 // px por unidade de `h`
export const GRID_GAP = 16

// Grade de 12 colunas. Desktop: posição exata (x, y, w, h). Celular: uma coluna, na ordem y → x, mantendo a altura.
// Posição e tamanho vão por CSS custom properties — as classes ficam estáticas (o Tailwind não gera classe dinâmica).
export default function DashboardGrid({ widgets, period }) {
  const ordered = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x)
  return (
    <div className="grid grid-cols-1 md:grid-cols-12" style={{ gridAutoRows: ROW_HEIGHT, gap: GRID_GAP }}>
      {ordered.map((w) => (
        <div
          key={w.id}
          className="min-w-0 [grid-row:span_var(--h)] md:[grid-column:var(--gc)] md:[grid-row:var(--gr)]"
          style={{ '--h': w.h, '--gc': `${w.x + 1} / span ${w.w}`, '--gr': `${w.y + 1} / span ${w.h}` }}
        >
          <Widget widget={w} period={period} />
        </div>
      ))}
    </div>
  )
}
