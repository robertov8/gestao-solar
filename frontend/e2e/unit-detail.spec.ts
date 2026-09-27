import type { Page } from '@playwright/test'
import { expect, test, unitRow } from './fixtures.ts'

// Linha da tabela de meses pelo mês, no formato da tela (MM/AAAA).
function monthRow(page: Page, month: string) {
  return page
    .getByRole('region', { name: 'Meses', exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: month, exact: true }) })
}

function balanceCard(page: Page) {
  return page.getByRole('region', { name: 'Saldo atualizado (Banco de kWh)', exact: true })
}

test.describe('Página da unidade', () => {
  test('abre pelo painel e volta', async ({ page, api }) => {
    const unit = await api.createUnit('generator')
    await page.goto('/')

    await unitRow(page, unit.name).getByRole('link', { name: unit.name }).click()

    await expect(page).toHaveURL(`/units/${unit.id}`)
    await expect(page.getByRole('heading', { level: 1, name: unit.name })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao painel' }).click()
    await expect(page).toHaveURL('/')
  })

  test('edita um mês e recalcula', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2026-01')
    await api.saveRecord(generator, '2026-01', { injected: 1000, used: 400 })
    await page.goto(`/units/${generator.id}`)
    await expect(monthRow(page, '01/2026')).toContainText('180,00 kWh')
    await expect(page.getByRole('columnheader', { name: /restante/i })).toHaveCount(0)

    await page.getByRole('button', { name: 'Editar mês 01/2026' }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar mês 01/2026' })
    await expect(dialog.getByLabel('Energia injetada (kWh)')).toHaveValue('1000')
    await dialog.getByLabel('Saldo utilizado (Consumo faturado kWh)').fill('500')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()

    // Sobram 500 kWh: 150 vão para a consumidora e 350 ficam no banco.
    await expect(monthRow(page, '01/2026')).toContainText('150,00 kWh')
    await expect(balanceCard(page)).toContainText('350,00 kWh')

    await page.goto(`/units/${consumer.id}`)
    await expect(monthRow(page, '01/2026')).toContainText('150,00 kWh')
    const allocation = page.getByRole('region', { name: 'Rateio', exact: true })
    await expect(allocation).toContainText(generator.name)
    await expect(allocation).toContainText('30%')
  })

  test('apaga um mês e recalcula o banco', async ({ page, api }) => {
    const unit = await api.createUnit('generator')
    await api.saveRecord(unit, '2026-01', { injected: 100 })
    await api.saveRecord(unit, '2026-02', { injected: 50 })
    await page.goto(`/units/${unit.id}`)
    await expect(balanceCard(page)).toContainText('150,00 kWh')

    await page.getByRole('button', { name: 'Apagar mês 02/2026' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Apagar mês' })
    await confirm.getByRole('button', { name: 'Apagar' }).click()

    await expect(confirm).toBeHidden()
    await expect(monthRow(page, '02/2026')).toHaveCount(0)
    await expect(monthRow(page, '01/2026')).toBeVisible()
    await expect(balanceCard(page)).toContainText('100,00 kWh')
  })

  test('não apaga o mês de consumidora que recebe energia do rateio', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 30, '2026-01')
    await api.saveRecord(generator, '2026-01', { injected: 1000, used: 400 })
    await page.goto(`/units/${consumer.id}`)

    await page.getByRole('button', { name: 'Apagar mês 01/2026' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Apagar mês' })
    await confirm.getByRole('button', { name: 'Apagar' }).click()

    await expect(confirm.getByRole('alert')).toContainText('recebe energia do rateio')
    await confirm.getByRole('button', { name: 'Cancelar' }).click()
    await expect(monthRow(page, '01/2026')).toContainText('180,00 kWh')
  })

  test('adiciona um mês sem escolher a unidade', async ({ page, api }) => {
    const unit = await api.createUnit('generator')
    await page.goto(`/units/${unit.id}`)
    await expect(page.getByText('Nenhum mês cadastrado')).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar mês' }).click()
    const dialog = page.getByRole('dialog', { name: 'Valores do mês' })
    await expect(dialog.getByRole('combobox', { name: 'Unidade' })).toHaveCount(0)
    await expect(dialog).toContainText(`Unidade: ${unit.name}`)
    await dialog.getByLabel('Mês').fill('2026-03')
    await dialog.getByLabel('Energia injetada (kWh)').fill('10')
    await dialog.getByLabel('Saldo utilizado (Consumo faturado kWh)').fill('0')
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    await expect(monthRow(page, '03/2026')).toContainText('10,00 kWh')
  })

  test('apaga a unidade e volta ao painel', async ({ page, api }) => {
    const unit = await api.createUnit('consumer')
    await page.goto(`/units/${unit.id}`)

    await page.getByRole('button', { name: 'Apagar unidade' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Apagar unidade' })
    await confirm.getByRole('button', { name: 'Apagar' }).click()

    await expect(page).toHaveURL('/')
    await expect(unitRow(page, unit.name)).toHaveCount(0)
  })

  test('mostra aviso para unidade que não existe', async ({ page }) => {
    await page.goto('/units/999999')

    await expect(page.getByText('Unidade não encontrada')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao painel' })).toBeVisible()
  })
})
