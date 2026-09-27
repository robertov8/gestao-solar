import type { Page } from '@playwright/test'
import { chooseUnit, expect, test, unitRow, type Unit } from './fixtures.ts'

async function saveMonth(
  page: Page,
  unit: Unit,
  month: string,
  values: { injected?: string; used: string },
) {
  await page.getByRole('button', { name: 'Adicionar mês' }).click()
  const dialog = page.getByRole('dialog', { name: 'Valores do mês' })
  await chooseUnit(page, dialog, 'Unidade', unit.name)
  await dialog.getByLabel('Mês').fill(month)
  if (values.injected !== undefined) {
    await dialog.getByLabel('Energia injetada (kWh)').fill(values.injected)
  }
  await dialog.getByLabel('Saldo utilizado (Consumo faturado kWh)').fill(values.used)
  await dialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(dialog).toBeHidden()
}

test.describe('Valores do mês', () => {
  test('divide a sobra da geradora entre as consumidoras', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const first = await api.createUnit('consumer')
    const second = await api.createUnit('consumer')
    await api.createAllocation(generator, first, 30, '2026-01')
    await api.createAllocation(generator, second, 50, '2026-01')
    await page.goto('/')

    await saveMonth(page, generator, '2026-01', { injected: '1000', used: '400' })

    await expect(unitRow(page, generator.name)).toContainText('120,00 kWh')
    await expect(unitRow(page, first.name)).toContainText('180,00 kWh')
    await expect(unitRow(page, second.name)).toContainText('300,00 kWh')
  })

  test('abate o uso da consumidora', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2026-01')
    await api.saveRecord(generator, '2026-01', { injected: 1000, used: 400 })
    await page.goto('/')
    await expect(unitRow(page, consumer.name)).toContainText('180,00 kWh')

    await saveMonth(page, consumer, '2026-01', { used: '100' })

    await expect(unitRow(page, consumer.name)).toContainText('80,00 kWh')
  })

  test('consumidora não tem o campo de energia injetada', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await page.goto('/')

    await page.getByRole('button', { name: 'Adicionar mês' }).click()
    const dialog = page.getByRole('dialog', { name: 'Valores do mês' })
    await chooseUnit(page, dialog, 'Unidade', consumer.name)
    await expect(dialog.getByLabel('Energia injetada (kWh)')).toHaveCount(0)

    await chooseUnit(page, dialog, 'Unidade', generator.name)
    await expect(dialog.getByLabel('Energia injetada (kWh)')).toBeVisible()
  })

  test('o banco cobre a falta de energia e nunca fica negativo', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    await api.saveRecord(generator, '2026-01', { injected: 100, used: 50 })
    await page.goto('/')
    await expect(unitRow(page, generator.name)).toContainText('50,00 kWh')

    await saveMonth(page, generator, '2026-02', { injected: '0', used: '200' })

    await expect(unitRow(page, generator.name)).toContainText('0,00 kWh')
    await expect(unitRow(page, generator.name)).not.toContainText('-')
  })
})
