import { test, expect } from '@playwright/test';

/**
 * Escenario (f) — perímetro sin sesión: la UI interna redirige a login y
 * las API internas rechazan con 401. Contexto sin storage state alguno
 * (browser.newContext() nuevo, sin login) para garantizar cero cookies.
 */
test.describe('perímetro sin sesión', () => {
  test('/interno/dashboard sin sesión redirige a /interno/login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/interno/dashboard');
    await page.waitForURL('**/interno/login**', { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/interno/login');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/interno/dashboard');

    await ctx.close();
  });

  test('API interna sin sesión responde 401', async ({ request }) => {
    // request fixture: contexto HTTP limpio, sin cookies de ninguna sesión
    // previa de otros tests (no comparte storage state).
    const respuesta = await request.get('/api/interno/resumen-diario');
    expect(respuesta.status()).toBe(401);
  });
});
