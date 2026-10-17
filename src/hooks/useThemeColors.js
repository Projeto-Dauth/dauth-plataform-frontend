import { useEffect, useState } from 'react'

// Atributos SVG (stroke/fill do Recharts) não resolvem var(--token): lê o valor computado da paleta e o refaz
// quando o SalonLayout/Configurações trocam as CSS vars (style) ou o data-palette do <html>.
const read = () => {
  const cs = getComputedStyle(document.documentElement)
  const rgb = (token) => `rgb(${cs.getPropertyValue(token).trim().replace(/\s+/g, ' ')})`
  return { brand: rgb('--brand'), ink: rgb('--ink'), ink2: rgb('--ink-2'), ink4: rgb('--ink-4'), line: rgb('--line'), surface: rgb('--surface') }
}

export default function useThemeColors() {
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-palette'] })
    return () => observer.disconnect()
  }, [])
  return colors
}
