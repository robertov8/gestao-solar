import { useQuery } from '@tanstack/react-query'
import { api } from './client.ts'

export type Summary = {
  totalBalanceKwh: number
  units: { unitId: number; balanceKwh: number }[]
}

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: () => api<Summary>('/summary'),
  })
}
