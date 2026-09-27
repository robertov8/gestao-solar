import type { Locator, Page } from '@playwright/test'
import { chooseUnit, expect, formatKwh, formatPercent, test } from './fixtures.ts'

function chartRegion(page: Page) {
  return page
    .getByRole('region')
    .filter({ has: page.getByRole('combobox', { name: 'Unidade do gráfico' }) })
}

// Uma linha por item da caixa de valor (unidades e total).
function tooltipRows(chart: Locator) {
  return chart
    .locator('.recharts-tooltip-wrapper')
    .getByRole('list', { name: 'Valores do mês' })
    .getByRole('listitem')
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
    // O valor do total vem da API. A unidade vem primeiro, depois o total.
    await chart.locator('.unit-dot').first().hover()
    const rows = tooltipRows(chart)
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText(`${generator.name}: 420,00 kWh`)
    await expect(rows.nth(1)).toContainText(
      `Total de todas as unidades: ${formatKwh(january!.updatedBalanceKwh)}`,
    )
  })

  // Os testes da caixa de valor usam 2030: nenhum outro teste cria meses entre
  // 01/2030 e 02/2030, então o mês anterior a 02/2030 é sempre 01/2030.
  test('a caixa de valor compara o mês com o anterior e com o total', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2030-01')
    await api.saveRecord(generator, '2030-01', { injected: 1000, used: 400 })
    await api.saveRecord(generator, '2030-02', { injected: 500, used: 400 })
    const total = (await api.monthlyTotals()).find((t) => t.referenceMonth === '2030-02')!
    await page.goto('/')

    const chart = chartRegion(page)
    const title = chart.getByRole('heading', { level: 2 })
    const dots = chart.locator(`.unit-dot-${generator.id}`)
    await chooseUnit(page, chart, 'Unidade do gráfico', generator.name)
    // Espera a troca de "Todas as unidades" para a unidade: antes disso, os
    // pontos na tela ainda são os da visão anterior.
    await expect(title).toHaveText(`Saldo atualizado (Banco de kWh): ${generator.name}`)
    await expect(chart.getByRole('list', { name: 'Linhas do gráfico' }).getByRole('listitem')).toHaveCount(2)
    await expect(dots).toHaveCount(2)

    // Sem force: o hover espera a página parar de mexer depois da troca de visão.
    await dots.last().hover()
    const tooltip = chart.locator('.recharts-tooltip-wrapper')
    await expect(tooltip).toContainText('02/2030 · Verão')
    await expect(tooltip).toContainText('Variação comparada a 01/2030')

    // Banco da geradora: 420 em janeiro; em fevereiro sobram 100, 30 vão para a
    // consumidora e 70 ficam: 490.
    const unitRow = tooltipRows(chart).filter({ hasText: generator.name })
    await expect(unitRow).toContainText(`${generator.name}: 490,00 kWh`)
    await expect(unitRow).toContainText('Variação: ▲ +70,00 kWh (+16,7%)')
    await expect(unitRow).toContainText(
      `Parte do total: ${formatPercent(490 / total.updatedBalanceKwh)} · ` +
        `Diferença: ${formatKwh(total.updatedBalanceKwh - 490)}`,
    )

    const totalRow = tooltipRows(chart).filter({ hasText: 'Total de todas as unidades' })
    await expect(totalRow).toContainText(
      `Total de todas as unidades: ${formatKwh(total.updatedBalanceKwh)}`,
    )
    await expect(totalRow).not.toContainText('Parte do total')

    await chart.getByRole('radio', { name: 'Energia injetada' }).click()
    await expect(title).toHaveText(`Energia injetada: ${generator.name}`)
    await dots.last().hover()
    await expect(unitRow).toContainText('Variação: ▼ -500,00 kWh (-50%)')
  })

  test('o gráfico mostra todas as unidades numa única visão', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    const newConsumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2030-01')
    await api.saveRecord(generator, '2030-01', { injected: 1000, used: 400 })
    await api.saveRecord(generator, '2030-02', { injected: 500, used: 400 })
    // Sem rateio e só com fevereiro: não tem valor no mês anterior.
    await api.saveRecord(newConsumer, '2030-02', { used: 0 })
    await page.goto('/')

    // "Todas as unidades" já vem escolhido.
    const chart = chartRegion(page)
    await expect(chart.getByRole('combobox', { name: 'Unidade do gráfico' })).toHaveText(
      'Todas as unidades',
    )
    await expect(chart.getByRole('heading', { level: 2 })).toHaveText(
      'Saldo atualizado (Banco de kWh): Todas as unidades',
    )

    // Uma linha por unidade, com um ponto por mês que a unidade tem.
    await expect(chart.locator(`.unit-dot-${generator.id}`)).toHaveCount(2)
    await expect(chart.locator(`.unit-dot-${consumer.id}`)).toHaveCount(2)
    await expect(chart.locator(`.unit-dot-${newConsumer.id}`)).toHaveCount(1)
    await expect(chart.locator('.total-dot')).toHaveCount((await api.monthlyTotals()).length)

    const legend = chart.getByRole('list', { name: 'Linhas do gráfico' }).getByRole('listitem')
    await expect(legend.filter({ hasText: generator.name })).toContainText('Geradora')
    await expect(legend.filter({ hasText: consumer.name })).toContainText('Consumidora')
    await expect(legend.filter({ hasText: 'Total de todas as unidades' })).toHaveCount(1)

    // force: o ponto de uma unidade de outro teste, com o mesmo valor, pode ficar
    // por cima. A caixa de valor depende só do mês em que o mouse está.
    await chart.locator(`.unit-dot-${generator.id}`).last().hover({ force: true })
    const row = (name: string) => tooltipRows(chart).filter({ hasText: name })
    await expect(chart.locator('.recharts-tooltip-wrapper')).toContainText('02/2030 · Verão')
    await expect(row(generator.name)).toContainText('Variação: ▲ +70,00 kWh (+16,7%)')
    // A consumidora recebe 180 em janeiro e 30 em fevereiro: banco 180 e 210.
    await expect(row(consumer.name)).toContainText(`${consumer.name}: 210,00 kWh`)
    await expect(row(consumer.name)).toContainText('Variação: ▲ +30,00 kWh (+16,7%)')
    await expect(row(newConsumer.name)).toContainText('Variação: sem dados no mês anterior')
    await expect(row('Total de todas as unidades')).toHaveCount(1)

    await chart.getByRole('radio', { name: 'Energia injetada' }).click()
    await chart.locator(`.unit-dot-${generator.id}`).last().hover({ force: true })
    await expect(row(generator.name)).toContainText(`${generator.name}: 500,00 kWh`)
    await expect(row(consumer.name)).toContainText('Variação: = sem mudança')
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

    // Outros testes criam meses de outros anos: a mesma estação pode ter mais de uma faixa.
    const surface = chart.locator('.recharts-surface')
    for (const name of ['Verão', 'Outono', 'Inverno', 'Primavera']) {
      await expect(surface.getByText(name, { exact: true }).first()).toBeVisible()
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
