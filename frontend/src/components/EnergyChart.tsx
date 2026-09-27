import { Box, Card, Flex, Heading, RadioCards, Select, Spinner, Strong, Text } from '@radix-ui/themes'
import { Fragment, useId, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMonthlyRecordsOf, useMonthlyTotals, type MonthlyRecord } from '../api/records.ts'
import { unitTypeLabel, type Unit } from '../api/units.ts'
import { formatMonth, formatNumber } from '../format.ts'
import { seasonOrder, seasonRanges, seasonStyle, type Season } from '../seasons.ts'
import ChartTooltip, { type TooltipLine } from './ChartTooltip.tsx'
import { ErrorCallout } from './form.tsx'
import LineLegend, { SeriesMarker, type LineStyle } from './LineLegend.tsx'

type Metric = keyof Pick<MonthlyRecord, 'injectedEnergyKwh' | 'usedBalanceKwh' | 'updatedBalanceKwh'>

const metricLabel: Record<Metric, string> = {
  injectedEnergyKwh: 'Energia injetada',
  usedBalanceKwh: 'Saldo utilizado (Consumo faturado kWh)',
  updatedBalanceKwh: 'Saldo atualizado (Banco de kWh)',
}

const metrics = Object.keys(metricLabel) as Metric[]

// O seletor escolhe uma unidade (pelo id) ou todas as unidades.
type Selection = number | 'all'

const allUnitsLabel = 'Todas as unidades'
const totalLabel = 'Total de todas as unidades'

export default function EnergyChart({ units }: { units: Unit[] }) {
  // Começa com todas as unidades: a visão consolidada é a primeira que aparece.
  const [selection, setSelection] = useState<Selection>('all')
  const [metric, setMetric] = useState<Metric>('updatedBalanceKwh')
  const titleId = useId()
  const showAll = selection === 'all'
  const unit = units.find((u) => u.id === selection) ?? units[0]
  const subject = showAll ? allUnitsLabel : unit?.name

  return (
    <Card asChild size="3">
      <section aria-labelledby={titleId}>
        <Flex direction="column" gap="4">
          <Heading as="h2" size="4" id={titleId}>
            {subject ? `${metricLabel[metric]}: ${subject}` : 'Gráfico'}
          </Heading>
          {unit === undefined ? (
            <Text color="gray">Cadastre uma unidade para ver o gráfico.</Text>
          ) : (
            <>
              <Box width="260px">
                <ChartUnitSelect
                  units={units}
                  value={showAll ? 'all' : unit.id}
                  onChange={setSelection}
                />
              </Box>
              {/* Cartões em grade: com nomes longos, descem de linha em telas estreitas. */}
              <RadioCards.Root
                aria-label="Métrica"
                size="1"
                columns={{ initial: '1', sm: '3' }}
                value={metric}
                onValueChange={(v) => setMetric(v as Metric)}
              >
                {metrics.map((m) => (
                  <RadioCards.Item key={m} value={m}>
                    {metricLabel[m]}
                  </RadioCards.Item>
                ))}
              </RadioCards.Root>
              <Chart
                units={showAll ? units : [unit]}
                styles={unitLineStyles(units)}
                metric={metric}
                showAll={showAll}
              />
            </>
          )}
        </Flex>
      </section>
    </Card>
  )
}

type SelectProps = {
  units: Unit[]
  value: Selection
  onChange: (value: Selection) => void
}

function ChartUnitSelect({ units, value, onChange }: SelectProps) {
  const groups = [
    { label: 'Geradoras', units: units.filter((u) => u.type === 'generator') },
    { label: 'Consumidoras', units: units.filter((u) => u.type === 'consumer') },
  ].filter((group) => group.units.length > 0)

  return (
    <Select.Root
      value={String(value)}
      onValueChange={(v) => onChange(v === 'all' ? 'all' : Number(v))}
    >
      <Select.Trigger aria-label="Unidade do gráfico" style={{ width: '100%' }} />
      <Select.Content position="popper">
        <Select.Item value="all">{allUnitsLabel}</Select.Item>
        {groups.map((group) => (
          <Fragment key={group.label}>
            <Select.Separator />
            <Select.Group>
              <Select.Label>{group.label}</Select.Label>
              {group.units.map((u) => (
                <Select.Item key={u.id} value={String(u.id)}>
                  {u.name}
                </Select.Item>
              ))}
            </Select.Group>
          </Fragment>
        ))}
      </Select.Content>
    </Select.Root>
  )
}

// Geradoras: linha grossa com pontos quadrados. Consumidoras: linha fina com
// pontos redondos. Total: linha tracejada cinza. Cada unidade mantém a mesma cor
// na visão de uma unidade e na visão de todas.
const generatorColors = ['var(--amber-11)', 'var(--brown-11)', 'var(--orange-11)', 'var(--gold-11)']
const consumerColors = [
  'var(--blue-11)',
  'var(--crimson-11)',
  'var(--teal-11)',
  'var(--violet-11)',
  'var(--cyan-11)',
  'var(--pink-11)',
  'var(--indigo-11)',
  'var(--jade-11)',
]
const totalStyle: LineStyle = {
  color: 'var(--gray-12)',
  width: 2,
  dash: '6 4',
  marker: 'circle',
  markerSize: 3,
}

function unitLineStyles(units: Unit[]) {
  const styles = new Map<number, LineStyle>()
  const count = { generator: 0, consumer: 0 }
  for (const unit of units) {
    const position = count[unit.type]++
    styles.set(
      unit.id,
      unit.type === 'generator'
        ? {
            color: generatorColors[position % generatorColors.length],
            width: 3,
            marker: 'square',
            markerSize: 4,
          }
        : {
            color: consumerColors[position % consumerColors.length],
            width: 2,
            marker: 'circle',
            markerSize: 4,
          },
    )
  }
  return styles
}

type Series = TooltipLine & { dotClass: string }

type ChartProps = {
  units: Unit[]
  styles: Map<number, LineStyle>
  metric: Metric
  showAll: boolean
}

function Chart({ units, styles, metric, showAll }: ChartProps) {
  const records = useMonthlyRecordsOf(units.map((u) => u.id))
  const totals = useMonthlyTotals()

  if (totals.isPending || records.some((r) => r.isPending)) {
    return (
      <Flex justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  }
  if (totals.isError) {
    return <ErrorCallout message={`Erro ao carregar os meses: ${totals.error.message}`} />
  }
  const recordsError = records.find((r) => r.error)?.error
  if (recordsError) {
    return <ErrorCallout message={`Erro ao carregar os meses: ${recordsError.message}`} />
  }
  if (totals.data.length === 0) {
    return <Text color="gray">Nenhum mês cadastrado.</Text>
  }

  // Os meses do gráfico são os de todas as unidades (os mesmos do total).
  const months = totals.data.map((t) => t.referenceMonth)
  const unitSeries: Series[] = units.map((unit, i) => ({
    key: `unit-${unit.id}`,
    name: unit.name,
    detail: unitTypeLabel[unit.type],
    style: styles.get(unit.id)!,
    dotClass: `unit-dot unit-dot-${unit.id}`,
    values: new Map((records[i].data ?? []).map((r) => [r.referenceMonth, r[metric]])),
  }))
  const series: Series[] = [
    ...unitSeries,
    {
      key: 'total',
      name: totalLabel,
      style: totalStyle,
      dotClass: 'total-dot',
      values: new Map(totals.data.map((t) => [t.referenceMonth, t[metric]])),
      isTotal: true,
    },
  ]

  // O eixo X usa a posição do mês (0, 1, 2...): assim a faixa de cada estação
  // vai de meio mês antes até meio mês depois e cobre o mês inteiro.
  const data = months.map((month, index) => {
    const row: Record<string, number | null> = { index }
    for (const s of series) row[s.key] = s.values.get(month) ?? null
    return row
  })
  const ranges = seasonRanges(months)
  const monthAt = (index: number) => (months[index] ? formatMonth(months[index]) : '')
  const noRecords = !showAll && unitSeries[0]?.values.size === 0

  return (
    <Flex direction="column" gap="3">
      {noRecords && (
        <Text size="2" color="gray">
          {units[0].name} ainda não tem meses cadastrados. O gráfico mostra só o total.
        </Text>
      )}
      <Box height={showAll ? '380px' : '320px'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            {ranges.map((range) => (
              <ReferenceArea
                key={`${range.season}-${range.start}`}
                className={`season-band season-${range.season}`}
                x1={range.start - 0.5}
                x2={range.end + 0.5}
                fill={seasonStyle[range.season].band}
                fillOpacity={1}
                label={<SeasonBandLabel season={range.season} />}
              />
            ))}
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              type="number"
              dataKey="index"
              domain={[-0.5, data.length - 0.5]}
              allowDataOverflow
              ticks={data.map((_, index) => index)}
              tickFormatter={(index: number) => monthAt(index)}
            />
            <YAxis width={90} tickFormatter={(v: number) => formatNumber(v)} />
            <Tooltip
              cursor={{ stroke: 'var(--gray-a8)' }}
              // Em telas estreitas o texto quebra de linha em vez de sair do gráfico.
              // 60%: cabe na área das linhas, que é menor que o gráfico por causa do eixo Y.
              wrapperStyle={{ maxWidth: 'min(360px, 60%)' }}
              content={({ active, label }) =>
                active ? <ChartTooltip lines={series} months={months} index={Number(label)} /> : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                name={s.name}
                type="linear"
                dataKey={s.key}
                stroke={s.style.color}
                strokeWidth={s.style.width}
                strokeDasharray={s.style.dash}
                dot={(props) => (
                  <SeriesMarker
                    key={`${s.key}-${props.index}`}
                    style={s.style}
                    cx={props.cx}
                    cy={props.cy}
                    className={s.dotClass}
                  />
                )}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <LineLegend items={series} />
      <SeasonLegend />
    </Flex>
  )
}

// Nome da estação no topo da faixa. O Recharts passa viewBox com a posição da faixa.
// Em faixas estreitas o nome fica escondido; a legenda continua mostrando a estação.
function SeasonBandLabel({
  season,
  viewBox,
}: {
  season: Season
  viewBox?: { x?: number; y?: number; width?: number }
}) {
  const { label, text } = seasonStyle[season]
  const { x = 0, y = 0, width = 0 } = viewBox ?? {}
  if (width < label.length * 8 + 8) return null
  return (
    <text x={x + width / 2} y={y + 16} textAnchor="middle" fill={text} fontSize={13} fontWeight={600}>
      {label}
    </text>
  )
}

function SeasonLegend() {
  return (
    <Flex asChild gap="4" wrap="wrap" m="0" p="0" style={{ listStyle: 'none' }}>
      {/* role="list": o Safari tira o papel de lista quando list-style é none. */}
      <ul role="list" aria-label="Estações do ano">
        {seasonOrder.map((season) => {
          const style = seasonStyle[season]
          return (
            <Flex asChild align="center" gap="2" key={season}>
              <li>
                <Box
                  width="16px"
                  height="16px"
                  style={{ background: style.band, border: `2px solid ${style.text}`, borderRadius: 4 }}
                />
                <Text size="2">
                  <Strong>{style.label}</Strong> ({style.months})
                </Text>
              </li>
            </Flex>
          )
        })}
      </ul>
    </Flex>
  )
}
