// Insights do painel: números e alertas calculados com os dados que o front já busca.
// Não acessa a API: recebe os dados e devolve os resultados.
import { generatorShare, type Allocation } from './api/allocations.ts'
import type { MonthlyRecord, MonthlyTotal } from './api/records.ts'
import type { Unit } from './api/units.ts'

// Quantos meses entram nas médias (consumo e ritmo do banco).
export const recentMonths = 3

export type Overview = {
  // Último mês com dados, no formato da API ("2026-09").
  month: string
  previousMonth?: string
  bankKwh: number
  // Consumo médio dos últimos meses e quantos meses o banco cobre com ele.
  averageUsedKwh: number
  monthsUsed: number
  reserveMonths?: number
  // Injetada ÷ consumo no último mês (1,03 = 103%). Vazia sem consumo.
  injectedKwh: number
  usedKwh: number
  coverage?: number
  // Quanto o banco mudou no último mês e a média das últimas mudanças.
  bankChangeKwh?: number
  averageBankChangeKwh?: number
  bankChangeCount: number
  generation: Generation
}

export type Generation = {
  // Variação sobre o mês anterior e sobre a média dos meses com geração.
  previousRatio?: number
  averageKwh?: number
  averageRatio?: number
  best?: MonthValue
  worst?: MonthValue
}

export type MonthValue = { month: string; kwh: number }

export type Alert =
  | { kind: 'empty-bank'; unit: Unit; month: string; missingKwh: number }
  | { kind: 'draining'; unit: Unit; month: string; bankKwh: number; changeKwh: number; monthsLeft: number }
  | {
      kind: 'allocation'
      consumer: Unit
      generator: Unit
      month: string
      usedKwh: number
      percentage: number
      suggested: number
      // Falso quando nem a porcentagem sugerida (o máximo livre) cobre o consumo.
      covers: boolean
    }
  | { kind: 'missing-month'; unit: Unit; month: string }
  | { kind: 'no-records'; unit: Unit }

function average(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// Diferença entre cada valor e o anterior.
function changes(values: number[]) {
  return values.slice(1).map((v, i) => v - values[i])
}

function ratio(value: number, base: number | undefined) {
  return base ? value / base - 1 : undefined
}

// totals vem ordenado pelo mês, como a API devolve. Vazio quando não há meses.
export function overview(totals: MonthlyTotal[]): Overview | undefined {
  const last = totals.at(-1)
  if (!last) return undefined
  const previous = totals.at(-2)

  const recent = totals.slice(-recentMonths)
  const averageUsedKwh = average(recent.map((t) => t.usedBalanceKwh))
  const bankChanges = changes(totals.slice(-recentMonths - 1).map((t) => t.updatedBalanceKwh))

  return {
    month: last.referenceMonth,
    previousMonth: previous?.referenceMonth,
    bankKwh: last.updatedBalanceKwh,
    averageUsedKwh,
    monthsUsed: recent.length,
    reserveMonths: averageUsedKwh > 0 ? last.updatedBalanceKwh / averageUsedKwh : undefined,
    injectedKwh: last.injectedEnergyKwh,
    usedKwh: last.usedBalanceKwh,
    coverage: last.usedBalanceKwh > 0 ? last.injectedEnergyKwh / last.usedBalanceKwh : undefined,
    bankChangeKwh: bankChanges.at(-1),
    averageBankChangeKwh: bankChanges.length > 0 ? average(bankChanges) : undefined,
    bankChangeCount: bankChanges.length,
    generation: generation(totals),
  }
}

// Meses sem energia injetada ficam de fora da média, do melhor e do pior mês.
function generation(totals: MonthlyTotal[]): Generation {
  const last = totals.at(-1)!
  const previous = totals.at(-2)
  const months = totals
    .filter((t) => t.injectedEnergyKwh > 0)
    .map((t) => ({ month: t.referenceMonth, kwh: t.injectedEnergyKwh }))
  if (months.length === 0) return {}

  const averageKwh = average(months.map((m) => m.kwh))
  const sorted = [...months].sort((a, b) => b.kwh - a.kwh)
  return {
    previousRatio: ratio(last.injectedEnergyKwh, previous?.injectedEnergyKwh),
    averageKwh,
    averageRatio: ratio(last.injectedEnergyKwh, averageKwh),
    // Com um mês só, melhor e pior seriam o mesmo mês.
    best: sorted.length > 1 ? sorted[0] : undefined,
    worst: sorted.length > 1 ? sorted.at(-1) : undefined,
  }
}

// O que entra no banco da unidade no mês (negativo quando sai), como o servidor calcula.
function kept(unit: Unit, record: MonthlyRecord) {
  return unit.type === 'generator'
    ? record.injectedEnergyKwh - record.usedBalanceKwh - record.allocatedEnergyKwh
    : record.allocatedEnergyKwh - record.usedBalanceKwh
}

// Rateio que vale para a consumidora no mês: a linha com o início mais recente até esse mês.
function activeAllocation(allocations: Allocation[], consumerId: number, month: string) {
  let best: Allocation | undefined
  for (const a of allocations) {
    if (a.consumerUnitId !== consumerId || a.startMonth > month) continue
    if (!best || a.startMonth > best.startMonth) best = a
  }
  return best
}

type AlertsInput = {
  units: Unit[]
  // Meses de cada unidade, ordenados pelo mês.
  records: Map<number, MonthlyRecord[]>
  allocations: Allocation[]
  // Último mês com dados de qualquer unidade.
  latestMonth: string
}

// Alertas por unidade, dos mais urgentes para os avisos.
export function alerts({ units, records, allocations, latestMonth }: AlertsInput): Alert[] {
  const bank: Alert[] = []
  const suggestions: Alert[] = []
  const pending: Alert[] = []

  for (const unit of units) {
    const list = records.get(unit.id) ?? []
    const last = list.at(-1)
    if (!last) {
      pending.push({ kind: 'no-records', unit })
      continue
    }
    if (last.referenceMonth < latestMonth) {
      pending.push({ kind: 'missing-month', unit, month: latestMonth })
    }

    const net = kept(unit, last)
    const bankChanges = changes(list.slice(-recentMonths - 1).map((r) => r.updatedBalanceKwh))
    const lastChange = bankChanges.at(-1)
    if (last.updatedBalanceKwh === 0 && net < 0) {
      // O banco não fica negativo: o que faltou é o consumo que o banco não cobriu.
      const before = list.at(-2)?.updatedBalanceKwh ?? 0
      bank.push({ kind: 'empty-bank', unit, month: last.referenceMonth, missingKwh: -(before + net) })
    } else if (lastChange !== undefined && lastChange < 0 && average(bankChanges) < 0) {
      const changeKwh = average(bankChanges)
      bank.push({
        kind: 'draining',
        unit,
        month: last.referenceMonth,
        bankKwh: last.updatedBalanceKwh,
        changeKwh,
        monthsLeft: last.updatedBalanceKwh / -changeKwh,
      })
    }

    if (unit.type === 'consumer' && net < 0) {
      const suggestion = allocationSuggestion(unit, last, units, records, allocations)
      if (suggestion) suggestions.push(suggestion)
    }
  }
  return [...bank, ...suggestions, ...pending]
}

// Porcentagem de rateio que cobriria o consumo da consumidora no mês.
// Só sugere quando a geradora guardou energia no banco dela nesse mês.
function allocationSuggestion(
  consumer: Unit,
  record: MonthlyRecord,
  units: Unit[],
  records: Map<number, MonthlyRecord[]>,
  allocations: Allocation[],
): Alert | undefined {
  const month = record.referenceMonth
  const allocation = activeAllocation(allocations, consumer.id, month)
  if (!allocation || allocation.percentage === 0) return undefined
  const generator = units.find((u) => u.id === allocation.generatorUnitId)
  const generatorRecord = records
    .get(allocation.generatorUnitId)
    ?.find((r) => r.referenceMonth === month)
  if (!generator || !generatorRecord || kept(generator, generatorRecord) <= 0) return undefined

  const surplus = generatorRecord.injectedEnergyKwh - generatorRecord.usedBalanceKwh
  const needed = Math.ceil((record.usedBalanceKwh / surplus) * 100)
  const free = 100 - (generatorShare(allocations, generator.id, month) - allocation.percentage)
  const suggested = Math.min(needed, free)
  if (suggested <= allocation.percentage) return undefined

  return {
    kind: 'allocation',
    consumer,
    generator,
    month,
    usedKwh: record.usedBalanceKwh,
    percentage: allocation.percentage,
    suggested,
    covers: needed <= free,
  }
}
