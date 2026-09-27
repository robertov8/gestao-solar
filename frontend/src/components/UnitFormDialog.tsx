import { Box, Dialog, Flex, RadioGroup, Text, TextField } from '@radix-ui/themes'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useSaveUnit, type Unit, type UnitType } from '../api/units.ts'
import { ErrorCallout, Field, FormActions } from './form.tsx'

type Props = {
  unit?: Unit
  trigger: ReactNode
}

export default function UnitFormDialog({ unit, trigger }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>{unit ? 'Editar unidade' : 'Nova unidade'}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {unit ? 'Mude o nome da unidade.' : 'Informe o nome e o tipo da unidade.'}
        </Dialog.Description>
        {/* Montado só com o diálogo aberto: o estado reinicia a cada abertura. */}
        <UnitForm unit={unit} onDone={() => setOpen(false)} />
      </Dialog.Content>
    </Dialog.Root>
  )
}

function UnitForm({ unit, onDone }: { unit?: Unit; onDone: () => void }) {
  const [name, setName] = useState(unit?.name ?? '')
  const [type, setType] = useState<UnitType>(unit?.type ?? 'generator')
  const save = useSaveUnit()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    save.mutate({ id: unit?.id, input: { name, type } }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3">
        <Field label="Nome">
          <TextField.Root
            required
            autoFocus
            placeholder="Ex.: Casa da praia"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">
            Tipo
          </Text>
          <RadioGroup.Root
            aria-label="Tipo"
            value={type}
            onValueChange={(v) => setType(v as UnitType)}
            disabled={unit !== undefined}
          >
            <RadioGroup.Item value="generator">Geradora (tem placas solares)</RadioGroup.Item>
            <RadioGroup.Item value="consumer">Consumidora (recebe energia do rateio)</RadioGroup.Item>
          </RadioGroup.Root>
          {unit && (
            <Text as="p" size="1" color="gray" mt="1">
              O tipo não pode ser mudado.
            </Text>
          )}
        </Box>
        {save.isError && <ErrorCallout message={save.error.message} />}
      </Flex>
      <FormActions pending={save.isPending} />
    </form>
  )
}
