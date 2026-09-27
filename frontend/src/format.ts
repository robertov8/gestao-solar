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
