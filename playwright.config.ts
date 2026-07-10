import { defineConfig, devices } from '@playwright/test';

/**
 * Auditor funcional automatizado — Fase 2 del Laboratorio Institucional
 * de Calidad (ADR-0002, docs/laboratorio/ARQUITECTURA_LABORATORIO_CALIDAD.md §4.1).
 *
 * Corre contra STAGE (ventanilla-simacota-stage), NUNCA contra producción.
 * El servidor no se levanta desde aquí (sin `webServer`): debe estar
 * corriendo antes de ejecutar la suite.
 *
 *   npm run dev:stage      # levanta next dev con .env.stage — JAMÁS `npm run dev`
 *   npm run test:e2e       # en otra terminal, con el servidor arriba
 *
 * Presupuesto duro (ADR-0002): máximo 15 escenarios E2E para siempre.
 * Este archivo gobierna solo `e2e/`; la suite de Vitest (`__tests__/`)
 * sigue aparte y no se toca (`npm test`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
