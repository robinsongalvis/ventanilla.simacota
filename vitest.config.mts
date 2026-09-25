import { defineConfig } from 'vitest/config';
import react            from '@vitejs/plugin-react';
import tsconfigPaths    from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // Importaciones explícitas en cada archivo — sin globals
    // para mantener coherencia con el estilo TypeScript del proyecto.
    //
    // `e2e/` es la suite de Playwright (auditor funcional, ADR-0002 Fase 2):
    // corre con navegador real contra STAGE (`npm run test:e2e`), nunca con
    // Vitest/jsdom. Sin esta exclusión, el glob por defecto de Vitest
    // (`**/*.spec.ts`) también la recogería y fallaría (usa `test`/`expect`
    // de @playwright/test, no de Vitest).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'e2e/**',
    ],
  },
});
