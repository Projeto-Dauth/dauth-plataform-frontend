import SearchableSelect from './SearchableSelect'

const INPUT_CLS = 'h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md focus:outline-none focus:border-brand transition-colors w-full'

// Corpo da assistente de um item de serviço para a API. Sem assistente vai `Assistant: null`
// (em Update_services isso remove a assistente; em Add_services é ignorado). Percentual vazio
// = o backend usa o padrão do serviço.
export function assistantPayload(item) {
  if (!item.assistantId) return { Assistant: null }
  return {
    Assistant: item.assistantId,
    ...(item.assistantPct !== '' ? { Assistant_commission: Number(item.assistantPct) } : {}),
  }
}

// Seletor de assistente (+ percentual) de um serviço feito por duas profissionais.
// `candidates`: [{ UUID, Name }]; `excludeId`: a profissional principal (não pode ser assistente).
export default function AssistantField({ candidates, excludeId, assistantId, pct, onAssistant, onPct }) {
  return (
    <div className={assistantId ? 'grid grid-cols-[1fr_84px] gap-3' : 'flex flex-col'}>
      <div className="flex flex-col gap-1.5 min-w-0">
        <label className="text-[12px] font-medium text-ink-2">
          Assistente <span className="text-ink-4 font-normal">(opcional)</span>
        </label>
        <SearchableSelect
          value={assistantId}
          onChange={onAssistant}
          options={[
            { value: '', label: 'Sem assistente' },
            ...candidates.filter(p => p.UUID !== excludeId).map(p => ({ value: p.UUID, label: p.Name })),
          ]}
          placeholder="Sem assistente"
        />
      </div>
      {assistantId && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-ink-2">Comissão %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={pct}
            placeholder="0–100"
            onChange={e => onPct(e.target.value)}
            className={`${INPUT_CLS} ${pct === '' ? 'border-danger' : ''}`}
          />
        </div>
      )}
    </div>
  )
}
