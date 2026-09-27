import { Box, Flex, Strong, Text } from '@radix-ui/themes'
import { compareLine, type MonthChange } from '../comparison.ts'
import { formatKwh, formatMonth, formatPercent, formatSignedKwh, formatSignedPercent } from '../format.ts'
import { seasonOf, seasonStyle } from '../seasons.ts'
import { LineSample, type LegendItem } from './LineLegend.tsx'

// Uma linha do gráfico. values usa o mês no formato da API ("2026-09").
export type TooltipLine = LegendItem & {
  values: Map<string, number>
  isTotal?: boolean
}

type Props = {
  lines: TooltipLine[]
  months: string[]
  // Posição do mês apontado pelo mouse no eixo X.
  index: number
}

// Caixa de valor do gráfico. Para o mês apontado, cada linha mostra o valor,
// a variação sobre o mês anterior e, nas unidades, a parte do total.
export default function ChartTooltip({ lines, months, index }: Props) {
  const month = months[index]
  if (!month) return null
  const previous = index > 0 ? months[index - 1] : undefined
  const total = lines.find((line) => line.isTotal)?.values.get(month)
  const rows = lines
    .filter((line) => line.values.has(month))
    .map((line) => ({
      line,
      comparison: compareLine(line.values, month, previous, line.isTotal ? undefined : total),
    }))

  return (
    <Box
      p="3"
      style={{
        background: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-a6)',
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)',
      }}
    >
      <Text as="p" size="2" weight="bold">
        {formatMonth(month)} · {seasonStyle[seasonOf(month)].label}
      </Text>
      <Text as="p" size="1" color="gray" mb="2">
        {previous
          ? `Variação comparada a ${formatMonth(previous)}`
          : 'Primeiro mês: sem mês anterior para comparar'}
      </Text>
      <Flex asChild direction="column" gap="2" m="0" p="0" style={{ listStyle: 'none' }}>
        <ul role="list" aria-label="Valores do mês">
          {rows.map(({ line, comparison }) => (
            <Flex asChild gap="2" align="start" key={line.key}>
              <li>
                <Box pt="1">
                  <LineSample style={line.style} />
                </Box>
                <Flex direction="column">
                  <Text size="2">
                    <Strong>{line.name}</Strong>: {formatKwh(comparison.current ?? 0)}
                  </Text>
                  {previous && <MonthChangeText change={comparison.monthChange} />}
                  {comparison.shareOfTotal !== undefined && comparison.gapToTotal !== undefined && (
                    <Text size="1">
                      Parte do total: <Strong>{formatPercent(comparison.shareOfTotal)}</Strong> ·
                      Diferença: <Strong>{formatKwh(comparison.gapToTotal)}</Strong>
                    </Text>
                  )}
                </Flex>
              </li>
            </Flex>
          ))}
        </ul>
      </Flex>
    </Box>
  )
}

function MonthChangeText({ change }: { change?: MonthChange }) {
  if (!change) {
    return (
      <Text size="1" color="gray">
        Variação: sem dados no mês anterior
      </Text>
    )
  }
  // Mesmo arredondamento da tela (2 casas): evita "▲ +0,00 kWh".
  const kwh = Math.round(change.kwh * 100) / 100 || 0
  const arrow = kwh > 0 ? '▲' : kwh < 0 ? '▼' : '='

  return (
    <Text size="1">
      Variação:{' '}
      <Strong>
        <span aria-hidden="true">{arrow} </span>
        {kwh === 0 ? 'sem mudança' : formatSignedKwh(kwh)}
        {kwh !== 0 && change.ratio !== undefined && ` (${formatSignedPercent(change.ratio)})`}
      </Strong>
    </Text>
  )
}
