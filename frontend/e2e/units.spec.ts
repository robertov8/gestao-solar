import { expect, test, uniqueName, unitRow } from './fixtures.ts'

test.describe('Unidades', () => {
  test('cria uma geradora pelo modal', async ({ page }) => {
    const name = uniqueName('Usina')
    await page.goto('/')

    await page.getByRole('button', { name: 'Nova unidade' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova unidade' })
    await dialog.getByLabel('Nome').fill(name)
    await dialog.getByRole('radio', { name: /Geradora/ }).check()
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    await expect(dialog).toBeHidden()
    const row = unitRow(page, name)
    await expect(row).toContainText('Geradora')
    await expect(row).toContainText('0,00 kWh')
  })

  test('muda o nome da unidade', async ({ page, api }) => {
    const unit = await api.createUnit('consumer')
    const newName = uniqueName('Casa')
    await page.goto('/')

    await page.getByRole('button', { name: `Editar ${unit.name}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar unidade' })
    await expect(dialog.getByRole('radio', { name: /Consumidora/ })).toBeDisabled()
    await dialog.getByLabel('Nome').fill(newName)
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    await expect(unitRow(page, newName)).toBeVisible()
    await expect(unitRow(page, unit.name)).toHaveCount(0)
  })

  test('apaga uma unidade sem histórico', async ({ page, api }) => {
    const unit = await api.createUnit('consumer')
    await page.goto('/')

    await page.getByRole('button', { name: `Apagar ${unit.name}` }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Apagar unidade' })
    await confirm.getByRole('button', { name: 'Apagar' }).click()

    await expect(confirm).toBeHidden()
    await expect(unitRow(page, unit.name)).toHaveCount(0)
  })

  test('não apaga uma unidade com histórico', async ({ page, api }) => {
    const unit = await api.createUnit('generator')
    await api.saveRecord(unit, '2026-01', { injected: 100 })
    await page.goto('/')

    await page.getByRole('button', { name: `Apagar ${unit.name}` }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Apagar unidade' })
    await confirm.getByRole('button', { name: 'Apagar' }).click()

    await expect(confirm.getByRole('alert')).toContainText('tem histórico')
    await confirm.getByRole('button', { name: 'Cancelar' }).click()
    await expect(unitRow(page, unit.name)).toBeVisible()
  })
})
