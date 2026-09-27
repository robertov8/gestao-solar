import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client.ts'

export type Allocation = {
  id: number
  generatorUnitId: number
  consumerUnitId: number
  percentage: number
  startMonth: string
  createdAt: string
  updatedAt: string
}

export type AllocationInput = Pick<
  Allocation,
  'generatorUnitId' | 'consumerUnitId' | 'percentage' | 'startMonth'
>

export function useAllocations() {
  return useQuery({
    queryKey: ['allocations'],
    queryFn: () => api<Allocation[]>('/allocations'),
  })
}

export function useCreateAllocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AllocationInput) =>
      api<Allocation>('/allocations', { method: 'POST', body: JSON.stringify(input) }),
    // O rateio muda o cálculo de várias unidades: recarrega tudo.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

// Soma as porcentagens que valem para a geradora no mês, como o servidor faz.
// Para cada consumidora, vale a linha com o início mais recente até o mês.
// A linha de ignoreConsumerId fica de fora, porque a nova linha vai substituí-la.
export function generatorShare(
  allocations: Allocation[],
  generatorUnitId: number,
  month: string,
  ignoreConsumerId?: number,
) {
  const active = new Map<number, Allocation>()
  for (const a of allocations) {
    if (a.startMonth > month) continue
    const current = active.get(a.consumerUnitId)
    if (!current || a.startMonth > current.startMonth) {
      active.set(a.consumerUnitId, a)
    }
  }
  let total = 0
  for (const a of active.values()) {
    if (a.generatorUnitId === generatorUnitId && a.consumerUnitId !== ignoreConsumerId) {
      total += a.percentage
    }
  }
  return total
}
