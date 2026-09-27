import { Flex, Strong, Text } from '@radix-ui/themes'

// Aparência de uma linha do gráfico. O marcador (quadrado ou círculo) e o
// tracejado diferenciam as linhas sem depender só da cor.
export type LineStyle = {
  color: string
  width: number
  dash?: string
  marker: 'square' | 'circle'
  markerSize: number
}

export type LegendItem = {
  key: string
  name: string
  // Tipo da unidade ("Geradora" ou "Consumidora"). Vazio na linha do total.
  detail?: string
  style: LineStyle
}

export default function LineLegend({ items }: { items: LegendItem[] }) {
  return (
    <Flex direction="column" gap="2">
      <Text as="p" size="2" color="gray">
        Passe o mouse (ou toque) no gráfico para ver a variação do mês e a parte de cada unidade no total.
      </Text>
      <Flex asChild gap="4" wrap="wrap" m="0" p="0" style={{ listStyle: 'none' }}>
        {/* role="list": o Safari tira o papel de lista quando list-style é none. */}
        <ul role="list" aria-label="Linhas do gráfico">
          {items.map((item) => (
            <Flex asChild align="center" gap="2" key={item.key}>
              <li>
                <LineSample style={item.style} />
                <Text size="2">
                  <Strong>{item.name}</Strong>
                  {item.detail && <Text color="gray"> · {item.detail}</Text>}
                </Text>
              </li>
            </Flex>
          ))}
        </ul>
      </Flex>
    </Flex>
  )
}

// Pedaço da linha com o marcador no meio: usado na legenda e na caixa de valor.
export function LineSample({ style }: { style: LineStyle }) {
  return (
    <svg width="36" height="14" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1="0"
        y1="7"
        x2="36"
        y2="7"
        stroke={style.color}
        strokeWidth={style.width}
        strokeDasharray={style.dash}
      />
      <SeriesMarker style={style} cx={18} cy={7} />
    </svg>
  )
}

type MarkerProps = {
  style: LineStyle
  cx?: number
  cy?: number
  className?: string
}

// Marcador de um ponto. Sem posição (mês sem valor na linha), não desenha nada.
export function SeriesMarker({ style, cx, cy, className }: MarkerProps) {
  if (cx == null || cy == null) return null
  const size = style.markerSize
  if (style.marker === 'square') {
    return (
      <rect
        className={className}
        x={cx - size}
        y={cy - size}
        width={size * 2}
        height={size * 2}
        fill={style.color}
      />
    )
  }
  return <circle className={className} cx={cx} cy={cy} r={size} fill={style.color} />
}
