import { Select } from '@radix-ui/themes'
import type { Unit } from '../api/units.ts'

type Props = {
  label: string
  units: Unit[]
  value: number | undefined
  onChange: (id: number) => void
}

export default function UnitSelect({ label, units, value, onChange }: Props) {
  return (
    <Select.Root
      value={value === undefined ? undefined : String(value)}
      onValueChange={(v) => onChange(Number(v))}
    >
      <Select.Trigger aria-label={label} placeholder="Escolha uma unidade" style={{ width: '100%' }} />
      <Select.Content position="popper">
        {units.map((unit) => (
          <Select.Item key={unit.id} value={String(unit.id)}>
            {unit.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}
