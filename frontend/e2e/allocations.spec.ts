import type { Page } from '@playwright/test'
import { chooseUnit, expect, test } from './fixtures.ts'

async function openAllocationDialog(page: Page) {
  await page.getByRole('button', { name: 'Novo rateio' }).click()
  return page.getByRole('dialog', { name: 'Novo rateio' })
}

test.describe('Rateio', () => {
  test('mostra quanto ainda está livre', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const first = await api.createUnit('consumer')
    const second = await api.createUnit('consumer')
    await api.createAllocation(generator, first, 30, '2026-01')
    await page.goto('/')

    let dialog = await openAllocationDialog(page)
    await chooseUnit(page, dialog, 'Geradora', generator.name)
    await dialog.getByLabel('Mês de início').fill('2026-01')
    await expect(dialog).toContainText('70% livre em 01/2026')

    await chooseUnit(page, dialog, 'Consumidora', second.name)
    await dialog.getByLabel('Porcentagem (%)').fill('70')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()

    dialog = await openAllocationDialog(page)
    await chooseUnit(page, dialog, 'Geradora', generator.name)
    await dialog.getByLabel('Mês de início').fill('2026-01')
    await expect(dialog).toContainText('0% livre em 01/2026')
  })

  test('não deixa a soma passar de 100%', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const first = await api.createUnit('consumer')
    const second = await api.createUnit('consumer')
    await api.createAllocation(generator, first, 60, '2026-01')
    await page.goto('/')

    const dialog = await openAllocationDialog(page)
    await chooseUnit(page, dialog, 'Geradora', generator.name)
    await chooseUnit(page, dialog, 'Consumidora', second.name)
    await dialog.getByLabel('Porcentagem (%)').fill('50')
    await dialog.getByLabel('Mês de início').fill('2026-01')
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    await expect(dialog.getByRole('alert')).toContainText('passa de 100% (ficaria 110% em 01/2026)')
    await expect(dialog).toBeVisible()
    expect(await api.allocations(generator)).toHaveLength(1)
  })

  test('cada lista mostra só o tipo certo de unidade', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await page.goto('/')

    const dialog = await openAllocationDialog(page)
    await dialog.getByRole('combobox', { name: 'Geradora' }).click()
    await expect(page.getByRole('option', { name: generator.name })).toBeVisible()
    await expect(page.getByRole('option', { name: consumer.name })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await dialog.getByRole('combobox', { name: 'Consumidora' }).click()
    await expect(page.getByRole('option', { name: consumer.name })).toBeVisible()
    await expect(page.getByRole('option', { name: generator.name })).toHaveCount(0)
  })

  test('guarda o histórico quando a porcentagem muda', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2026-01')
    await page.goto('/')

    let dialog = await openAllocationDialog(page)
    await chooseUnit(page, dialog, 'Geradora', generator.name)
    await chooseUnit(page, dialog, 'Consumidora', consumer.name)
    await dialog.getByLabel('Porcentagem (%)').fill('40')
    await dialog.getByLabel('Mês de início').fill('2026-02')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()

    dialog = await openAllocationDialog(page)
    await chooseUnit(page, dialog, 'Geradora', generator.name)
    const rows = dialog.getByRole('region', { name: 'Histórico da geradora' }).getByRole('row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText(`02/2026${consumer.name}40%`)
    await expect(rows.nth(2)).toContainText(`01/2026${consumer.name}30%`)
  })
})
