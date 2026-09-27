import { Box, Heading, Table, Text } from '@radix-ui/themes'
import { useId } from 'react'
import { useAllocations } from '../api/allocations.ts'
import { useUnits, type Unit } from '../api/units.ts'
import { formatMonth } from '../format.ts'

// Histórico de rateio da unidade, do mais novo para o mais antigo.
// Para a geradora, mostra as consumidoras; para a consumidora, as geradoras.
type Props = {
  unit: Unit
  title: string
  headingAs?: 'h2' | 'h3'
}

export default function AllocationHistory({ unit, title, headingAs = 'h3' }: Props) {
  const { data: units = [] } = useUnits()
  const { data: allocations = [] } = useAllocations()
  const titleId = useId()

  const isGenerator = unit.type === 'generator'
  const history = allocations.filter((a) =>
    isGenerator ? a.generatorUnitId === unit.id : a.consumerUnitId === unit.id,
  )
  const nameOf = (id: number) => units.find((u) => u.id === id)?.name ?? `#${id}`

  return (
    <Box asChild>
      <section aria-labelledby={titleId}>
        <Heading as={headingAs} size={headingAs === 'h2' ? '4' : '3'} mb="2" id={titleId}>
          {title}
        </Heading>
        {history.length === 0 ? (
          <Text size="2" color="gray">
            Esta unidade ainda não tem rateio.
          </Text>
        ) : (
          <Table.Root size="1" variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Início</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{isGenerator ? 'Consumidora' : 'Geradora'}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Porcentagem</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {history.map((a) => (
                <Table.Row key={a.id}>
                  <Table.Cell>{formatMonth(a.startMonth)}</Table.Cell>
                  <Table.Cell>
                    {nameOf(isGenerator ? a.consumerUnitId : a.generatorUnitId)}
                  </Table.Cell>
                  <Table.Cell justify="end">{a.percentage}%</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </section>
    </Box>
  )
}
