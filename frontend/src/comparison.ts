// Comparações da caixa de valor do gráfico: mês apontado x mês anterior e unidade x total.

export type MonthChange = {
  kwh: number
  // Variação sobre o mês anterior (0,15 = 15%). Fica vazia quando o mês anterior é 0.
  ratio?: number
}

export type LineComparison = {
  // Valor no mês comparado. Vazio quando a linha não tem valor nesse mês.
  current?: number
  monthChange?: MonthChange
  // Só para unidades: parte do total (0,5 = 50%) e quanto falta para chegar no total.
  shareOfTotal?: number
  gapToTotal?: number
}

// Arredonda para 3 casas (Wh), como o servidor, e troca -0 por 0.
function round(value: number) {
  return Math.round(value * 1000) / 1000 || 0
}

// values usa o mês no formato da API ("2026-09"). total é o total de todas as
// unidades no mês comparado; fica vazio para a própria linha do total.
export function compareLine(
  values: Map<string, number>,
  current: string,
  previous: string | undefined,
  total?: number,
): LineComparison {
  const now = values.get(current)
  if (now === undefined) return {}

  const result: LineComparison = { current: now }
  const before = previous === undefined ? undefined : values.get(previous)
  if (before !== undefined) {
    const kwh = round(now - before)
    result.monthChange = { kwh, ratio: before === 0 ? undefined : kwh / before }
  }
  if (total !== undefined) {
    result.gapToTotal = round(total - now)
    if (total > 0) result.shareOfTotal = now / total
  }
  return result
}
