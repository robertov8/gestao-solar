import { Box, Card, Flex, Heading, RadioCards, Spinner, Strong, Text } from '@radix-ui/themes'
import { useId, useState } from 'react'
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
import { useMonthlyRecords, useMonthlyTotals, type MonthlyRecord } from '../api/records.ts'
import type { Unit } from '../api/units.ts'
import { formatKwh, formatMonth, formatNumber } from '../format.ts'
import { seasonOf, seasonOrder, seasonRanges, seasonStyle, type Season } from '../seasons.ts'
import { ErrorCallout } from './form.tsx'
import UnitSelect from './UnitSelect.tsx'

type Metric = keyof Pick<MonthlyRecord, 'injectedEnergyKwh' | 'usedBalanceKwh' | 'updatedBalanceKwh'>

const metricLabel: Record<Metric, string> = {
  injectedEnergyKwh: 'Energia injetada',
  usedBalanceKwh: 'Saldo utilizado (Consumo faturado kWh)',
  updatedBalanceKwh: 'Saldo atualizado (Banco de kWh)',
}

const metrics = Object.keys(metricLabel) as Metric[]

export default function EnergyChart({ units }: { units: Unit[] }) {
  const [selectedId, setSelectedId] = useState<number>()
  const [metric, setMetric] = useState<Metric>('updatedBalanceKwh')
  const titleId = useId()
  const unit = units.find((u) => u.id === selectedId) ?? units[0]

  return (
    <Card asChild size="3">
      <section aria-labelledby={titleId}>
        <Flex direction="column" gap="4">
          <Heading as="h2" size="4" id={titleId}>
            {unit ? `${metricLabel[metric]}: ${unit.name}` : 'Gráfico'}
          </Heading>
          {unit === undefined ? (
            <Text color="gray">Cadastre uma unidade para ver o gráfico.</Text>
          ) : (
            <>
              <Box width="220px">
                <UnitSelect
                  label="Unidade do gráfico"
                  units={units}
                  value={unit.id}
                  onChange={setSelectedId}
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
              <UnitChart unit={unit} metric={metric} />
            </>
          )}
        </Flex>
      </section>
    </Card>
  )
}

function UnitChart({ unit, metric }: { unit: Unit; metric: Metric }) {
  const records = useMonthlyRecords(unit.id)
  const totals = useMonthlyTotals()

  if (records.isPending || totals.isPending) {
    return (
      <Flex justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  }
  if (records.isError || totals.isError) {
    const message = (records.error ?? totals.error)?.message
    return <ErrorCallout message={`Erro ao carregar os meses: ${message}`} />
  }
  if (totals.data.length === 0) {
    return <Text color="gray">Nenhum mês cadastrado.</Text>
  }

  // Os meses do gráfico são os de todas as unidades (os mesmos do total).
  // O eixo X usa a posição do mês (0, 1, 2...): assim a faixa de cada estação
  // vai de meio mês antes até meio mês depois e cobre o mês inteiro.
  const unitValues = new Map(records.data.map((r) => [r.referenceMonth, r[metric]]))
  const data = totals.data.map((t, index) => ({
    index,
    month: formatMonth(t.referenceMonth),
    season: seasonStyle[seasonOf(t.referenceMonth)].label,
    unit: unitValues.get(t.referenceMonth) ?? null,
    total: t[metric],
  }))
  const ranges = seasonRanges(totals.data.map((t) => t.referenceMonth))
  const monthAt = (index: number) => data[index]?.month ?? ''

  return (
    <Flex direction="column" gap="3">
      {records.data.length === 0 && (
        <Text size="2" color="gray">
          {unit.name} ainda não tem meses cadastrados. O gráfico mostra só o total.
        </Text>
      )}
      <Box height="320px">
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
              ticks={data.map((d) => d.index)}
              tickFormatter={(index: number) => monthAt(index)}
            />
            <YAxis width={90} tickFormatter={(v: number) => formatNumber(v)} />
            <Tooltip
              cursor={{ stroke: 'var(--gray-a8)' }}
              separator=": "
              itemStyle={{ color: 'var(--gray-12)' }}
              labelFormatter={(index) => {
                const point = data[Number(index)]
                return point ? `${point.month} · ${point.season}` : ''
              }}
              formatter={(value, name) => [formatKwh(Number(value)), name]}
              // Mesma ordem da legenda: primeiro a unidade, depois o total.
              itemSorter={(item) => (item.dataKey === 'unit' ? 0 : 1)}
            />
            <Line
              name={unit.name}
              type="linear"
              dataKey="unit"
              stroke={unitLine.color}
              strokeWidth={unitLine.width}
              dot={{ r: 4, fill: unitLine.color, className: 'unit-dot' }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              name={totalLine.label}
              type="linear"
              dataKey="total"
              stroke={totalLine.color}
              strokeWidth={totalLine.width}
              strokeDasharray={totalLine.dash}
              dot={{ r: 3, fill: totalLine.color, className: 'total-dot' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <LineLegend unitName={unit.name} />
      <SeasonLegend />
    </Flex>
  )
}

// A linha do total é tracejada: dá para diferenciar as linhas sem depender da cor.
const unitLine = { color: 'var(--accent-11)', width: 3 }
const totalLine = {
  label: 'Total de todas as unidades',
  color: 'var(--gray-12)',
  width: 2,
  dash: '6 4',
}

function LineLegend({ unitName }: { unitName: string }) {
  return (
    <Flex asChild gap="4" wrap="wrap" m="0" p="0" style={{ listStyle: 'none' }}>
      <ul role="list" aria-label="Linhas do gráfico">
        <LegendLine label={unitName} color={unitLine.color} width={unitLine.width} />
        <LegendLine
          label={totalLine.label}
          color={totalLine.color}
          width={totalLine.width}
          dash={totalLine.dash}
        />
      </ul>
    </Flex>
  )
}

type LegendLineProps = { label: string; color: string; width: number; dash?: string }

function LegendLine({ label, color, width, dash }: LegendLineProps) {
  return (
    <Flex asChild align="center" gap="2">
      <li>
        <svg width="32" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="32" y2="5" stroke={color} strokeWidth={width} strokeDasharray={dash} />
        </svg>
        <Text size="2" weight="bold">
          {label}
        </Text>
      </li>
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
