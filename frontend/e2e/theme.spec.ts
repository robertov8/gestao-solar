import { expect, test } from '@playwright/test'

test.describe('tema', () => {
  test.use({ colorScheme: 'light' })

  test('segue o sistema por padrão e troca para escuro e claro pelo menu', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')

    await expect(html).toHaveClass(/\blight\b/)
    await page.getByRole('button', { name: 'Tema: Sistema (claro). Trocar tema' }).click()
    await page.getByRole('menuitem', { name: 'Escuro' }).click()
    await expect(html).toHaveClass(/\bdark\b/)

    // A escolha continua depois de recarregar.
    await page.reload()
    await expect(html).toHaveClass(/\bdark\b/)
    await page.getByRole('button', { name: 'Tema: Escuro. Trocar tema' }).click()
    await page.getByRole('menuitem', { name: 'Claro' }).click()
    await expect(html).toHaveClass(/\blight\b/)
    await expect(page.getByRole('button', { name: 'Tema: Claro. Trocar tema' })).toBeVisible()
  })

  test('no modo Sistema acompanha o escuro do sistema operacional', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(page.getByRole('button', { name: 'Tema: Sistema (escuro). Trocar tema' })).toBeVisible()
  })
})
