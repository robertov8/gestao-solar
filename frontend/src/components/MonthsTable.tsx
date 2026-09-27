import { Flex, IconButton, Spinner, Strong, Table, Text } from '@radix-ui/themes'
import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { useDeleteMonthlyRecord, useMonthlyRecords } from '../api/records.ts'
import type { Unit } from '../api/units.ts'
import { formatKwh, formatMonth } from '../format.ts'
import ConfirmDeleteDialog from './ConfirmDeleteDialog.tsx'
import { ErrorCallout } from './form.tsx'
import MonthlyRecordFormDialog from './MonthlyRecordFormDialog.tsx'

// Meses da unidade, do mais novo para o mais antigo, com botões para editar e apagar.
export default function MonthsTable({ unit }: { unit: Unit }) {
  const { data: records, isPending, error } = useMonthlyRecords(unit.id)
  const remove = useDeleteMonthlyRecord()
  const isGenerator = unit.type === 'generator'

  if (isPending) {
    return (
      <Flex justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  }
  if (error) {
    return <ErrorCallout message={`Erro ao carregar os meses: ${error.message}`} />
  }
  if (records.length === 0) {
    return <Text color="gray">Nenhum mês cadastrado. Clique em "Adicionar mês" para começar.</Text>
  }

  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Mês</Table.ColumnHeaderCell>
          {isGenerator && <Table.ColumnHeaderCell justify="end">Energia injetada</Table.ColumnHeaderCell>}
          <Table.ColumnHeaderCell justify="end">Saldo utilizado (Consumo faturado kWh)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">
            {isGenerator ? 'Energia rateada (enviada)' : 'Energia rateada (recebida)'}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">Saldo atualizado (Banco de kWh)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {records.toReversed().map((record) => {
          const month = formatMonth(record.referenceMonth)
          return (
            <Table.Row key={record.id} align="center">
              <Table.RowHeaderCell>{month}</Table.RowHeaderCell>
              {isGenerator && (
                <Table.Cell justify="end">{formatKwh(record.injectedEnergyKwh)}</Table.Cell>
              )}
              <Table.Cell justify="end">{formatKwh(record.usedBalanceKwh)}</Table.Cell>
              <Table.Cell justify="end">{formatKwh(record.allocatedEnergyKwh)}</Table.Cell>
              <Table.Cell justify="end">{formatKwh(record.updatedBalanceKwh)}</Table.Cell>
              <Table.Cell>
                <Flex gap="2" justify="end">
                  <MonthlyRecordFormDialog
                    unit={unit}
                    record={record}
                    trigger={
                      <IconButton variant="soft" aria-label={`Editar mês ${month}`}>
                        <Pencil1Icon />
                      </IconButton>
                    }
                  />
                  <ConfirmDeleteDialog
                    title="Apagar mês"
                    description={
                      <>
                        Apagar o mês <Strong>{month}</Strong>? O sistema recalcula os meses
                        seguintes.
                      </>
                    }
                    trigger={
                      <IconButton variant="soft" color="red" aria-label={`Apagar mês ${month}`}>
                        <TrashIcon />
                      </IconButton>
                    }
                    onConfirm={() => remove.mutateAsync(record.id)}
                  />
                </Flex>
              </Table.Cell>
            </Table.Row>
          )
        })}
      </Table.Body>
    </Table.Root>
  )
}
