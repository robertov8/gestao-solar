import { Badge, Flex, IconButton, Link, Strong, Table, Text } from '@radix-ui/themes'
import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { Link as RouterLink } from 'react-router'
import { useSummary } from '../api/summary.ts'
import { unitTypeLabel, useDeleteUnit, type Unit } from '../api/units.ts'
import { formatKwh } from '../format.ts'
import ConfirmDeleteDialog from './ConfirmDeleteDialog.tsx'
import UnitFormDialog from './UnitFormDialog.tsx'

export default function UnitsTable({ units }: { units: Unit[] }) {
  const { data: summary } = useSummary()
  const remove = useDeleteUnit()
  const balances = new Map(summary?.units.map((b) => [b.unitId, b.balanceKwh]))

  if (units.length === 0) {
    return <Text color="gray">Nenhuma unidade cadastrada. Clique em "Nova unidade" para começar.</Text>
  }

  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Tipo</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">Saldo atualizado (Banco de kWh)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {units.map((unit) => (
          <Table.Row key={unit.id} align="center">
            <Table.RowHeaderCell>
              <Link asChild weight="medium">
                <RouterLink to={`/units/${unit.id}`}>{unit.name}</RouterLink>
              </Link>
            </Table.RowHeaderCell>
            <Table.Cell>
              <Badge color={unit.type === 'generator' ? 'amber' : 'blue'}>
                {unitTypeLabel[unit.type]}
              </Badge>
            </Table.Cell>
            <Table.Cell justify="end">{formatKwh(balances.get(unit.id) ?? 0)}</Table.Cell>
            <Table.Cell>
              <Flex gap="2" justify="end">
                <UnitFormDialog
                  unit={unit}
                  trigger={
                    <IconButton variant="soft" aria-label={`Editar ${unit.name}`}>
                      <Pencil1Icon />
                    </IconButton>
                  }
                />
                <ConfirmDeleteDialog
                  title="Apagar unidade"
                  description={
                    <>
                      Apagar <Strong>{unit.name}</Strong>? Esta ação não pode ser desfeita.
                    </>
                  }
                  trigger={
                    <IconButton variant="soft" color="red" aria-label={`Apagar ${unit.name}`}>
                      <TrashIcon />
                    </IconButton>
                  }
                  onConfirm={() => remove.mutateAsync(unit.id)}
                />
              </Flex>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}
