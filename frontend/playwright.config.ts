import { defineConfig, devices } from '@playwright/test'

// Porta própria e banco em memória: os testes nunca tocam no banco de desenvolvimento.
const port = 8081

export default defineConfig({
  testDir: './e2e',
  // Um teste por vez: o total do banco de kWh soma todas as unidades.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    locale: 'pt-BR',
    // Fuso do Brasil: ajuda a achar o erro de um mês aparecer como o anterior.
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && cd ../backend && go run ./cmd/server',
    url: `http://localhost:${port}/api/health`,
    env: { PORT: String(port), DB_PATH: ':memory:' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
