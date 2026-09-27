import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client.ts'

export type MonthlyRecord = {
  id: number
  unitId: number
  referenceMonth: string
  injectedEnergyKwh: number
  usedBalanceKwh: number
  allocatedEnergyKwh: number
  updatedBalanceKwh: number
  createdAt: string
  updatedAt: string
}

export type MonthlyRecordInput = Pick<
  MonthlyRecord,
  'unitId' | 'referenceMonth' | 'injectedEnergyKwh' | 'usedBalanceKwh'
>

// Soma de todas as unidades num mês. No banco, a unidade sem registro no mês
// entra com o último banco dela.
export type MonthlyTotal = Pick<
  MonthlyRecord,
  'referenceMonth' | 'injectedEnergyKwh' | 'usedBalanceKwh' | 'updatedBalanceKwh'
>

export function useMonthlyTotals() {
  return useQuery({
    queryKey: ['monthly-totals'],
    queryFn: () => api<MonthlyTotal[]>('/monthly-totals'),
  })
}

export function useMonthlyRecords(unitId: number | undefined) {
  return useQuery({
    queryKey: ['monthly-records', unitId],
    queryFn: () => api<MonthlyRecord[]>(`/monthly-records?unitId=${unitId}`),
    enabled: unitId !== undefined,
  })
}

export function useSaveMonthlyRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MonthlyRecordInput) =>
      api<MonthlyRecord>('/monthly-records', { method: 'PUT', body: JSON.stringify(input) }),
    // O recálculo muda outras unidades e outros meses: recarrega tudo.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeleteMonthlyRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/monthly-records/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
