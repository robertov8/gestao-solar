const kwhFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatNumber(value: number) {
  return kwhFormat.format(value)
}

// Espaço que não quebra (\u00A0): o número e o "kWh" ficam sempre na mesma linha.
export function formatKwh(value: number) {
  return `${kwhFormat.format(value)}\u00A0kWh`
}

const signedKwhFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

// Com sinal: "+70,00 kWh" ou "-500,00 kWh".
export function formatSignedKwh(value: number) {
  return `${signedKwhFormat.format(value)}\u00A0kWh`
}

const percentFormat = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const signedPercentFormat = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

// ratio 0,167 → "16,7%".
export function formatPercent(ratio: number) {
  return percentFormat.format(ratio)
}

// ratio 0,167 → "+16,7%".
export function formatSignedPercent(ratio: number) {
  return signedPercentFormat.format(ratio)
}

// "2026-09" → "09/2026". Não usa Date para o fuso horário não trocar o mês.
export function formatMonth(month: string) {
  const [year, m] = month.split('-')
  return `${m}/${year}`
}

// Mês atual no formato da API: "2026-09".
export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const monthCountFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

// 2,14 → "2,1 meses". Abaixo de 1 mês, não mostra a fração.
export function formatMonthCount(value: number) {
  if (value < 1) return 'menos de 1 mês'
  const text = monthCountFormat.format(value)
  return `${text} ${text === '1' ? 'mês' : 'meses'}`
}
