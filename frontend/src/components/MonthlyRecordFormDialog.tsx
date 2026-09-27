import { Dialog, Flex, Strong, Text, TextField } from '@radix-ui/themes'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useSaveMonthlyRecord, type MonthlyRecord } from '../api/records.ts'
import { useUnits, type Unit } from '../api/units.ts'
import { currentMonth, formatMonth } from '../format.ts'
import { ErrorCallout, Field, FormActions } from './form.tsx'
import UnitSelect from './UnitSelect.tsx'

type Props = {
  trigger: ReactNode
  // Com unit, a unidade fica fixa (página da unidade).
  // Com record, edita esse mês: unidade e mês ficam fixos. Passe unit junto.
  unit?: Unit
  record?: MonthlyRecord
}

export default function MonthlyRecordFormDialog({ trigger, unit, record }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>
          {record ? `Editar mês ${formatMonth(record.referenceMonth)}` : 'Valores do mês'}
        </Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {record
            ? 'Mude os valores do mês. O sistema recalcula este mês e os seguintes.'
            : 'Informe os valores da conta de luz. Se o mês já existir, os valores serão substituídos.'}
        </Dialog.Description>
        <MonthlyRecordForm fixedUnit={unit} record={record} onDone={() => setOpen(false)} />
      </Dialog.Content>
    </Dialog.Root>
  )
}

type FormProps = {
  fixedUnit?: Unit
  record?: MonthlyRecord
  onDone: () => void
}

function MonthlyRecordForm({ fixedUnit, record, onDone }: FormProps) {
  const { data: units = [] } = useUnits()
  const save = useSaveMonthlyRecord()
  const [unitId, setUnitId] = useState(fixedUnit?.id)
  const [referenceMonth, setReferenceMonth] = useState(record?.referenceMonth ?? currentMonth())
  const [injected, setInjected] = useState(record ? String(record.injectedEnergyKwh) : '')
  const [used, setUsed] = useState(record ? String(record.usedBalanceKwh) : '')

  const unit = fixedUnit ?? units.find((u) => u.id === unitId)
  const isGenerator = unit?.type === 'generator'

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (unitId === undefined) return
    save.mutate(
      {
        unitId,
        referenceMonth,
        injectedEnergyKwh: isGenerator ? Number(injected) : 0,
        usedBalanceKwh: Number(used),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3">
        {fixedUnit ? (
          <Text size="2">
            Unidade: <Strong>{fixedUnit.name}</Strong>
          </Text>
        ) : (
          <Field label="Unidade">
            <UnitSelect label="Unidade" units={units} value={unitId} onChange={setUnitId} />
          </Field>
        )}
        {record ? (
          <Text size="2">
            Mês: <Strong>{formatMonth(record.referenceMonth)}</Strong>
          </Text>
        ) : (
          <Field label="Mês">
            <TextField.Root
              required
              type="month"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
            />
          </Field>
        )}
        {isGenerator && (
          <Field label="Energia injetada (kWh)">
            <TextField.Root
              required
              type="number"
              min={0}
              step="any"
              value={injected}
              onChange={(e) => setInjected(e.target.value)}
            />
          </Field>
        )}
        <Field label="Saldo utilizado (Consumo faturado kWh)">
          <TextField.Root
            required
            type="number"
            min={0}
            step="any"
            value={used}
            onChange={(e) => setUsed(e.target.value)}
          />
        </Field>
        {unit && !isGenerator && (
          <Text size="2" color="gray">
            A energia recebida da geradora é calculada pelo rateio.
          </Text>
        )}
        {save.isError && <ErrorCallout message={save.error.message} />}
      </Flex>
      <FormActions pending={save.isPending} disabled={unitId === undefined} />
    </form>
  )
}
