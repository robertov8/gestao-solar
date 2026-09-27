import { AlertDialog, Box, Button, Flex } from '@radix-ui/themes'
import { useState, type ReactNode } from 'react'
import { ErrorCallout } from './form.tsx'

type Props = {
  title: string
  description: ReactNode
  trigger: ReactNode
  // Faz a exclusão. Se der erro, a mensagem aparece e o diálogo continua aberto.
  onConfirm: () => Promise<unknown>
}

export default function ConfirmDeleteDialog({ title, description, trigger, onConfirm }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setError(undefined)
  }

  async function handleConfirm() {
    setPending(true)
    setError(undefined)
    try {
      await onConfirm()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Trigger>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="440px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        {error && (
          <Box mt="3">
            <ErrorCallout message={error} />
          </Box>
        )}
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Cancelar
            </Button>
          </AlertDialog.Cancel>
          <Button color="red" loading={pending} onClick={handleConfirm}>
            Apagar
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
