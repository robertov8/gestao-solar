import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
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

function monthlyRecordsQuery(unitId: number | undefined) {
  return {
    queryKey: ['monthly-records', unitId],
    queryFn: () => api<MonthlyRecord[]>(`/monthly-records?unitId=${unitId}`),
  }
}

export function useMonthlyRecords(unitId: number | undefined) {
  return useQuery({ ...monthlyRecordsQuery(unitId), enabled: unitId !== undefined })
}

// Meses de várias unidades de uma vez. Usa o mesmo cache de useMonthlyRecords.
export function useMonthlyRecordsOf(unitIds: number[]) {
  return useQueries({ queries: unitIds.map((id) => monthlyRecordsQuery(id)) })
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
