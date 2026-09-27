import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes'
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'
import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <Text as="div" size="2" mb="1" weight="bold">
        {label}
      </Text>
      {children}
    </label>
  )
}

export function ErrorCallout({ message }: { message: string }) {
  return (
    <Callout.Root color="red" size="1" role="alert">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{message}</Callout.Text>
    </Callout.Root>
  )
}

export function FormActions({ pending, disabled }: { pending: boolean; disabled?: boolean }) {
  return (
    <Flex gap="3" mt="4" justify="end">
      <Dialog.Close>
        <Button type="button" variant="soft" color="gray">
          Cancelar
        </Button>
      </Dialog.Close>
      <Button type="submit" loading={pending} disabled={disabled}>
        Salvar
      </Button>
    </Flex>
  )
}
