import { useState, useRef, useEffect } from 'react'
import Icon from './Icons'

// Modo estático (padrão): options: [{ value, label }] — filtra localmente.
// Modo remoto: passe onSearch(query) => Promise<[{ value, label }]> — busca no backend
// a cada digitação (debounce 300ms), sem carregar a lista inteira de uma vez.
// injectOption: { value, label } — usado para exibir o label de um item selecionado
// fora do fluxo normal de busca (ex: cliente recém-criado por um modal "+").
export default function SearchableSelect({
  options = [],
  onSearch,
  minChars = 1,
  injectOption = null,
  value,
  onChange,
  placeholder = 'Selecione…',
  disabled = false,
  required = false,
  className = ''
}) {
  const isRemote = typeof onSearch === 'function'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remoteOptions, setRemoteOptions] = useState([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (injectOption) setSelectedOption(injectOption)
  }, [injectOption])

  const selected = isRemote
    ? (selectedOption?.value === value ? selectedOption : remoteOptions.find(o => o.value === value)) ?? selectedOption
    : options.find(o => o.value === value)

  const filtered = !isRemote
    ? (query.trim() ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options)
    : remoteOptions

  useEffect(() => {
    if (!open) { setQuery('') }
    else { setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  useEffect(() => {
    if (!isRemote || !open) return
    if (query.trim().length < minChars) { setRemoteOptions([]); return }

    const myRequestId = ++requestIdRef.current
    setRemoteLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(query.trim())
        if (myRequestId === requestIdRef.current) setRemoteOptions(results ?? [])
      } catch {
        if (myRequestId === requestIdRef.current) setRemoteOptions([])
      } finally {
        if (myRequestId === requestIdRef.current) setRemoteLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, isRemote])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
  }, [])

  function handleSelect(opt) {
    onChange(opt.value)
    if (isRemote) setSelectedOption(opt)
    setOpen(false)
  }

  const baseCls = `h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md
    focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors w-full ${className}`

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`${baseCls} flex items-center justify-between gap-2 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${!selected ? 'text-ink-4' : ''}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <Icon name="chevronRight" size={14} className={`shrink-0 text-ink-3 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {required && (
        <input
          tabIndex={-1}
          value={value ?? ''}
          onChange={() => {}}
          required
          className="absolute opacity-0 h-0 w-0 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-line rounded-md shadow-md overflow-hidden">
          <div className="px-2 pt-2 pb-1.5">
            <div className="flex items-center gap-2 h-[32px] px-2.5 rounded border border-line-2 focus-within:border-line transition-colors">
              <Icon name="search" size={12} className="text-ink-4 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="flex-1 bg-transparent text-[13px] text-ink-2 placeholder:text-ink-4 focus:outline-none"
              />
            </div>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {isRemote && remoteLoading ? (
              <li className="px-3 py-2 text-[13px] text-ink-3 italic">Buscando…</li>
            ) : isRemote && query.trim().length < minChars ? (
              <li className="px-3 py-2 text-[13px] text-ink-3 italic">Digite para buscar…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-ink-3 italic">Nenhum resultado</li>
            ) : filtered.map(o => (
              <li
                key={o.value}
                onClick={() => handleSelect(o)}
                className={`px-3 py-2 text-[13px] cursor-pointer transition-colors hover:bg-surface-2
                  ${o.value === value ? 'font-medium text-ink' : 'text-ink-2'}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
