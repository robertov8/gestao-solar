export type Season = 'summer' | 'autumn' | 'winter' | 'spring'

type SeasonStyle = {
  label: string
  months: string
  // Cor clara para a faixa de fundo e cor forte para o texto.
  band: string
  text: string
}

// Hemisfério sul, 3 meses por estação (divisão usada pela meteorologia).
export const seasonStyle: Record<Season, SeasonStyle> = {
  summer: { label: 'Verão', months: 'dez a fev', band: 'var(--yellow-a3)', text: 'var(--yellow-11)' },
  autumn: { label: 'Outono', months: 'mar a mai', band: 'var(--orange-a3)', text: 'var(--orange-11)' },
  winter: { label: 'Inverno', months: 'jun a ago', band: 'var(--blue-a3)', text: 'var(--blue-11)' },
  spring: { label: 'Primavera', months: 'set a nov', band: 'var(--grass-a3)', text: 'var(--grass-11)' },
}

export const seasonOrder: Season[] = ['summer', 'autumn', 'winter', 'spring']

// Estação do mês no formato da API ("2026-09").
export function seasonOf(month: string): Season {
  const m = Number(month.split('-')[1])
  if (m === 12 || m <= 2) return 'summer'
  if (m <= 5) return 'autumn'
  if (m <= 8) return 'winter'
  return 'spring'
}

export type SeasonRange = { season: Season; start: number; end: number }

// Junta meses seguidos da mesma estação em faixas (start e end são posições na lista).
// O verão que começa em dezembro fica junto com janeiro e fevereiro do ano seguinte.
export function seasonRanges(months: string[]): SeasonRange[] {
  const ranges: SeasonRange[] = []
  let lastKey = ''
  months.forEach((month, index) => {
    const season = seasonOf(month)
    const [year, m] = month.split('-').map(Number)
    const key = `${season}-${m === 12 ? year + 1 : year}`
    if (key === lastKey) {
      ranges[ranges.length - 1].end = index
    } else {
      ranges.push({ season, start: index, end: index })
      lastKey = key
    }
  })
  return ranges
}
