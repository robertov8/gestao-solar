import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client.ts'

export type UnitType = 'generator' | 'consumer'

export type Unit = {
  id: number
  name: string
  type: UnitType
  createdAt: string
  updatedAt: string
}

export type UnitInput = Pick<Unit, 'name' | 'type'>

export const unitTypeLabel: Record<UnitType, string> = {
  generator: 'Geradora',
  consumer: 'Consumidora',
}

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: () => api<Unit[]>('/units'),
  })
}

export function useUnit(id: number | undefined) {
  return useQuery({
    queryKey: ['units', id],
    queryFn: () => api<Unit>(`/units/${id}`),
    enabled: id !== undefined,
    // Unidade que não existe não volta a existir: mostra o aviso na hora.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  })
}

export function useSaveUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: UnitInput }) =>
      id === undefined
        ? api<Unit>('/units', { method: 'POST', body: JSON.stringify(input) })
        : api<Unit>(`/units/${id}`, { method: 'PUT', body: JSON.stringify({ name: input.name }) }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeleteUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/units/${id}`, { method: 'DELETE' }),
    // Não espera o recarregamento: quem chamou pode sair da página da unidade
    // antes de a busca pela unidade apagada responder 404.
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}
