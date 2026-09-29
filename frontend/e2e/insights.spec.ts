import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

function insights(page: Page) {
  return page.getByRole('region', { name: 'Insights', exact: true })
}

// Os testes usam o mesmo banco: os números gerais têm os meses de outros testes.
// Por isso as verificações olham os alertas das unidades criadas aqui.
test.describe('Insights', () => {
  test('mostra os números gerais', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    await api.saveRecord(generator, '2026-01', { injected: 500, used: 100 })
    await page.goto('/')

    const section = insights(page)
    for (const title of ['Reserva do banco', 'Cobertura da geração', 'Ritmo do banco']) {
      await expect(section.getByRole('heading', { name: title })).toBeVisible()
    }
    await expect(section.getByRole('heading', { name: /^Geração de / })).toBeVisible()
  })

  test('avisa quando o banco da consumidora cai e sugere o rateio', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    const consumer = await api.createUnit('consumer')
    await api.createAllocation(generator, consumer, 50, '2026-01')
    // Janeiro: sobra 600, consumidora recebe 300 e usa 100. Banco dela: 200.
    await api.saveRecord(generator, '2026-01', { injected: 1000, used: 400 })
    await api.saveRecord(consumer, '2026-01', { used: 100 })
    // Fevereiro: sobra 200, consumidora recebe 100 e usa 150. Banco dela: 150.
    await api.saveRecord(generator, '2026-02', { injected: 600, used: 400 })
    await api.saveRecord(consumer, '2026-02', { used: 150 })
    await page.goto('/')

    const list = insights(page).getByRole('list', { name: 'Alertas' })
    const consumerAlerts = list.getByRole('listitem').filter({ hasText: consumer.name })

    await expect(consumerAlerts.filter({ hasText: 'o banco está caindo' })).toContainText(
      'caindo 50,00 kWh por mês. Com 150,00 kWh em 02/2026, zera em cerca de 3 meses',
    )
    // 150 de consumo ÷ 200 de sobra = 75%.
    await expect(consumerAlerts.filter({ hasText: 'Subir o rateio' })).toContainText(
      'Subir o rateio de 50% para 75% cobriria esse consumo.',
    )
  })

  test('avisa quando o banco zera', async ({ page, api }) => {
    const generator = await api.createUnit('generator')
    await api.saveRecord(generator, '2026-01', { injected: 100, used: 50 })
    await api.saveRecord(generator, '2026-02', { injected: 100, used: 230 })
    await page.goto('/')

    // Banco de 50 menos 130 que faltaram: 80 sem crédito.
    await expect(
      insights(page)
        .getByRole('listitem')
        .filter({ hasText: generator.name })
        .filter({ hasText: 'zerou' }),
    ).toContainText('o banco zerou em 02/2026. 80,00 kWh de consumo ficaram sem crédito')
  })

  test('avisa quando a unidade não tem meses', async ({ page, api }) => {
    const consumer = await api.createUnit('consumer')
    await page.goto('/')

    await expect(
      insights(page).getByRole('listitem').filter({ hasText: consumer.name }),
    ).toContainText('ainda não tem meses cadastrados')
  })
})
