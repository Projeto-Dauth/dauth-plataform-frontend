import { defineConfig, devices } from '@playwright/test'
// Portas e URLs vêm do backend (fonte única do ambiente de teste). Exige o repo do backend em ../backend.
import { E2E_API_URL, E2E_WEB_PORT, E2E_WEB_URL } from '../backend/e2e/testEnv.js'
import { BROWSER_STATE } from './e2e/support/browser.js'

export default defineConfig({
  testDir: './e2e',
  // Um worker só: todos os testes usam o mesmo banco SQLite, que serializa escritas.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo', // mesmo fuso padrão dos salões
    storageState: BROWSER_STATE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Sobe backend e frontend de teste em portas próprias. reuseExistingServer: false → se a porta já
  // estiver ocupada o teste falha, em vez de rodar contra um servidor que não é o isolado.
  webServer: [
    {
      command: 'node e2e/server.js', // banco zerado + seed, sem email/WhatsApp, rede externa bloqueada
      cwd: '../backend',
      url: `${E2E_API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: `npx vite --port ${E2E_WEB_PORT} --strictPort`,
      url: E2E_WEB_URL,
      reuseExistingServer: false,
      // Variáveis do processo têm prioridade sobre o .env no Vite: o front de teste só fala com o backend de teste.
      env: {
        VITE_API_URL: `${E2E_API_URL}/api`,
        VITE_PLATFORM_URL: `${E2E_API_URL}/api/v1`,
        VITE_AUTH_URL: `${E2E_API_URL}/api/auth`,
      },
    },
  ],
})
