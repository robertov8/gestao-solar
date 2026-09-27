import type { Page } from '@playwright/test'
import { chooseUnit, expect, formatKwh, test } from './fixtures.ts'

function chartRegion(page: Page) {
  return page
    .getByRole('region')
    .filter({ has: page.getByRole('combobox', { name: 'Unidade do gráfico' }) })
}

// Os testes usam o mesmo banco: o total e as faixas das estações também têm os
// meses de outros testes. Por isso as verificações olham só os pontos da unidade
// (.unit-dot) e os valores que vêm da API.
test.describe('Painel', () => {
  test('o total do banco é a soma de todas as unidades', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    await api.saveRecord(generator, '2026-01', { injected: 321.5 })
    const { totalBalanceKwh } = await api.summary()

    await page.goto('/')

    await expect(page.getByRole('region', { name: 'Total do banco de kWh' })).toContainText(
      formatKwh(totalBalanceKwh),
    )
  })

  test('o gráfico troca de unidade e de métrica', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2026-01')
    await api.saveRecord(generator, '2026-01', { injected: 1000, used: 400 })
    await api.saveRecord(generator, '2026-02', { injected: 500, used: 400 })
    await page.goto('/')

    const chart = chartRegion(page)
    const title = chart.getByRole('heading', { level: 2 })

    await chooseUnit(page, chart, 'Unidade do gráfico', consumer.name)
    await expect(title).toHaveText(`Saldo atualizado (Banco de kWh): ${consumer.name}`)

    await chart.getByRole('radio', { name: 'Saldo utilizado (Consumo faturado kWh)' }).click()
    await expect(title).toHaveText(`Saldo utilizado (Consumo faturado kWh): ${consumer.name}`)
    await expect(chart.getByRole('radio')).toHaveCount(3)

    await chooseUnit(page, chart, 'Unidade do gráfico', generator.name)
    await chart.getByRole('radio', { name: 'Energia injetada' }).click()
    await expect(title).toHaveText(`Energia injetada: ${generator.name}`)

    // Gráfico de linha: um ponto por mês da unidade.
    await expect(chart.locator('.unit-dot')).toHaveCount(2)
    await chart.locator('.unit-dot').first().hover()
    await expect(chart.locator('.recharts-tooltip-wrapper')).toContainText(
      `${generator.name}: 1.000,00 kWh`,
    )
  })

  test('o gráfico mostra o total de todas as unidades', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2026-01')
    await api.saveRecord(generator, '2026-01', { injected: 1000, used: 400 })
    await api.saveRecord(generator, '2026-02', { injected: 500, used: 400 })
    const totals = await api.monthlyTotals()
    const january = totals.find((t) => t.referenceMonth === '2026-01')
    expect(january).toBeDefined()
    await page.goto('/')

    const chart = chartRegion(page)
    await chooseUnit(page, chart, 'Unidade do gráfico', generator.name)

    const lines = chart.getByRole('list', { name: 'Linhas do gráfico' })
    await expect(lines.getByRole('listitem')).toHaveCount(2)
    await expect(lines).toContainText(generator.name)
    await expect(lines).toContainText('Total de todas as unidades')
    await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
    await expect(chart.locator('.total-dot')).toHaveCount(totals.length)

    // Janeiro: sobram 600 kWh, 30% (180) vão para a consumidora e 420 ficam na geradora.
    // O valor do total vem da API.
    await chart.locator('.unit-dot').first().hover()
    const tooltip = chart.locator('.recharts-tooltip-wrapper')
    // A unidade vem primeiro, depois o total (mesma ordem da legenda).
    await expect(tooltip).toContainText(
      `${generator.name}: 420,00 kWhTotal de todas as unidades: ${formatKwh(january!.updatedBalanceKwh)}`,
    )
  })

  test('o gráfico mostra as estações do ano', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    // Verão que atravessa a virada do ano (dez, jan, fev) e um mês de cada outra estação.
    for (const month of ['2025-12', '2026-01', '2026-02', '2026-03', '2026-06', '2026-09']) {
      await api.saveRecord(generator, month, { injected: 100 })
    }
    await page.goto('/')

    const chart = chartRegion(page)
    await chooseUnit(page, chart, 'Unidade do gráfico', generator.name)

    const surface = chart.locator('.recharts-surface')
    for (const name of ['Verão', 'Outono', 'Inverno', 'Primavera']) {
      await expect(surface.getByText(name, { exact: true })).toBeVisible()
    }

    // Dezembro, janeiro e fevereiro ficam na mesma faixa de verão.
    const dots = chart.locator('.unit-dot')
    await expect(dots).toHaveCount(6)
    const december = await dots.nth(0).boundingBox()
    const february = await dots.nth(2).boundingBox()
    const summers = await Promise.all(
      (await chart.locator('.season-summer').all()).map((band) => band.boundingBox()),
    )
    const sameBand = summers.some(
      (band) =>
        band &&
        december &&
        february &&
        band.x <= december.x &&
        band.x + band.width >= february.x + february.width,
    )
    expect(sameBand).toBe(true)

    const legend = chart.getByRole('list', { name: 'Estações do ano' })
    await expect(legend.getByRole('listitem')).toHaveCount(4)
    await expect(legend).toContainText('Verão (dez a fev)')
    await expect(legend).toContainText('Inverno (jun a ago)')

    await dots.nth(3).hover()
    await expect(chart.locator('.recharts-tooltip-wrapper')).toContainText('03/2026 · Outono')
  })
})
