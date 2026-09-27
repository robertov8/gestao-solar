import { Box, Dialog, Flex, Strong, Text, TextField } from '@radix-ui/themes'
import { useState, type FormEvent, type ReactNode } from 'react'
import { generatorShare, useAllocations, useCreateAllocation } from '../api/allocations.ts'
import { useUnits } from '../api/units.ts'
import { currentMonth, formatMonth } from '../format.ts'
import AllocationHistory from './AllocationHistory.tsx'
import { ErrorCallout, Field, FormActions } from './form.tsx'
import UnitSelect from './UnitSelect.tsx'

export default function AllocationFormDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>Novo rateio</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Escolha quanto da sobra da geradora vai para a consumidora. Mudar a porcentagem cria uma
          linha nova no histórico. Para tirar a consumidora do rateio, use 0%.
        </Dialog.Description>
        <AllocationForm onDone={() => setOpen(false)} />
      </Dialog.Content>
    </Dialog.Root>
  )
}

function AllocationForm({ onDone }: { onDone: () => void }) {
  const { data: units = [] } = useUnits()
  const { data: allocations = [] } = useAllocations()
  const create = useCreateAllocation()
  const [generatorId, setGeneratorId] = useState<number>()
  const [consumerId, setConsumerId] = useState<number>()
  const [percentage, setPercentage] = useState('')
  const [startMonth, setStartMonth] = useState(currentMonth())

  const generators = units.filter((u) => u.type === 'generator')
  const consumers = units.filter((u) => u.type === 'consumer')
  const generator = generators.find((u) => u.id === generatorId)
  const free =
    generatorId !== undefined && startMonth
      ? 100 - generatorShare(allocations, generatorId, startMonth, consumerId)
      : undefined

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (generatorId === undefined || consumerId === undefined) return
    create.mutate(
      {
        generatorUnitId: generatorId,
        consumerUnitId: consumerId,
        percentage: Number(percentage),
        startMonth,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Flex direction="column" gap="3">
          <Field label="Geradora">
            <UnitSelect label="Geradora" units={generators} value={generatorId} onChange={setGeneratorId} />
          </Field>
          <Field label="Consumidora">
            <UnitSelect label="Consumidora" units={consumers} value={consumerId} onChange={setConsumerId} />
          </Field>
          <Flex gap="3">
            <Box flexGrow="1">
              <Field label="Porcentagem (%)">
                <TextField.Root
                  required
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                />
              </Field>
            </Box>
            <Box flexGrow="1">
              <Field label="Mês de início">
                <TextField.Root
                  required
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                />
              </Field>
            </Box>
          </Flex>
          {free !== undefined && (
            <Text size="2">
              <Strong>{free}% livre</Strong> em {formatMonth(startMonth)}.
            </Text>
          )}
          {create.isError && <ErrorCallout message={create.error.message} />}
        </Flex>
        <FormActions
          pending={create.isPending}
          disabled={generatorId === undefined || consumerId === undefined}
        />
      </form>
      {generator && (
        <Box mt="5">
          <AllocationHistory unit={generator} title="Histórico da geradora" />
        </Box>
      )}
    </>
  )
}
