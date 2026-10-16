// Código de acesso do salão: 8 caracteres mostrados como XXXX-XXXX (espelha backend/src/config/joinCode.js).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Máscara do campo: maiúsculas, só símbolos válidos, hífen automático depois do 4º.
export function formatJoinCodeInput(value) {
  const chars = String(value ?? '').toUpperCase().split('').filter(c => ALPHABET.includes(c)).slice(0, 8).join('')
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars
}

export const isCompleteJoinCode = (value) => formatJoinCodeInput(value).length === 9
