import {
  test as base,
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'

export type UnitType = 'generator' | 'consumer'

export type Unit = { id: number; name: string; type: UnitType }

// Nome único por teste, para os testes não se misturarem no mesmo banco.
export function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 6)}`
}

const numberFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatKwh(value: number) {
  return `${numberFormat.format(value)} kWh`
}

const percentFormat = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export function formatPercent(ratio: number) {
  return percentFormat.format(ratio)
}

// Linha da tabela de unidades pelo nome exato da unidade.
export function unitRow(page: Page, name: string) {
  return page
    .getByRole('region', { name: 'Unidades', exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name, exact: true }) })
}

// Escolhe uma unidade num seletor. As opções abrem fora de scope, no fim da página.
export async function chooseUnit(page: Page, scope: Locator, label: string, name: string) {
  await scope.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

// Cria dados direto pela API: é mais rápido do que pela tela.
function createApi(request: APIRequestContext) {
  async function ok<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    expect(res.ok(), await res.text()).toBe(true)
    return (await res.json()) as T
  }

  return {
    createUnit(type: UnitType, name = uniqueName(type === 'generator' ? 'Geradora' : 'Consumidora')) {
      return request.post('/api/units', { data: { name, type } }).then((res) => ok<Unit>(res))
    },
    createAllocation(generator: Unit, consumer: Unit, percentage: number, startMonth: string) {
      return request
        .post('/api/allocations', {
          data: {
            generatorUnitId: generator.id,
            consumerUnitId: consumer.id,
            percentage,
            startMonth,
          },
        })
        .then((res) => ok(res))
    },
    saveRecord(unit: Unit, referenceMonth: string, values: { injected?: number; used?: number }) {
      return request
        .put('/api/monthly-records', {
          data: {
            unitId: unit.id,
            referenceMonth,
            injectedEnergyKwh: values.injected ?? 0,
            usedBalanceKwh: values.used ?? 0,
          },
        })
        .then((res) => ok(res))
    },
    allocations(generator: Unit) {
      return request
        .get(`/api/allocations?generatorUnitId=${generator.id}`)
        .then((res) => ok<unknown[]>(res))
    },
    summary() {
      return request.get('/api/summary').then((res) => ok<{ totalBalanceKwh: number }>(res))
    },
    monthlyTotals() {
      return request
        .get('/api/monthly-totals')
        .then((res) => ok<{ referenceMonth: string; updatedBalanceKwh: number }[]>(res))
    },
  }
}

export type Api = ReturnType<typeof createApi>

export const test = base.extend<{ api: Api }>({
  // O segundo parâmetro não se chama "use" para o lint não confundir com o hook do React.
  api: async ({ request }, provide) => {
    await provide(createApi(request))
  },
})

export { expect }
