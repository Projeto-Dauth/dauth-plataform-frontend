import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

// Gravação do vídeo de demonstração (e2e-demo/). Reaproveita o ambiente isolado dos testes
// (backend 3100 + front 5183, banco zerado + seed, sem email/WhatsApp, rede externa bloqueada).
// Rodar:  npx playwright test -c playwright.demo.config.js
export default defineConfig({
  ...base,
  testDir: './e2e-demo',
  timeout: 300_000,
  reporter: [['list']],
})
