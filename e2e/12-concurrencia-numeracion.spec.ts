import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico } from './helpers';
import { USUARIOS_LAB } from './env';
import { leerRadicado } from './lab-admin';

/**
 * Escenario (12, Batch B) — numeración consecutiva bajo concurrencia real.
 * `generarRadicadoInstitucional` (lib/radicado-institucional.ts:33-47) usa
 * `runTransaction` sobre `counters/radicados-{año}` — Firestore garantiza
 * serializabilidad ahí, pero esto lo mide con carga real en vez de leer el
 * código y asumir. Tres `BrowserContext` (tres pestañas/sesiones reales)
 * disparan la radicación EXACTAMENTE al mismo tiempo con `Promise.all`.
 *
 * Como `playwright.config.ts` corre con `workers: 1` y ningún otro archivo
 * de test se ejecuta en paralelo con este, las únicas escrituras
 * concurrentes al contador durante la ventana de `Promise.all` son estas
 * 3 — por eso se puede exigir contigüidad estricta entre ellas (no solo
 * "sin duplicados", sino N, N+1, N+2 sin huecos).
 */
test('numeración consecutiva bajo concurrencia: sin huecos ni duplicados', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const CANTIDAD = 3;

  const sesiones = await Promise.all(
    Array.from({ length: CANTIDAD }, async (_, i) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, USUARIOS_LAB.recepcionista);

      await abrirRadicacionRapida(page);
      await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
      await page.getByLabel('Identificación').fill(`100200${3020 + i}`);
      await page.getByLabel('Nombre / razón social').fill(`Ciudadano E2E Concurrencia ${i + 1}`);
      await page.getByLabel('Asunto').fill(asuntoUnico(`Concurrencia numeración ${i + 1}`));
      await page.getByLabel('Descripción').fill(
        'Prueba automatizada del auditor funcional QA — numeración consecutiva bajo concurrencia.',
      );
      return { ctx, page };
    }),
  );

  // El momento que importa: las 3 radicaciones se disparan a la vez, no
  // una tras otra — esto es lo que ejercita de verdad la transacción del
  // contador bajo carrera real.
  const radicadoIds = await Promise.all(sesiones.map(({ page }) => enviarRadicacionRapida(page)));
  for (const id of radicadoIds) registrarRadicadoDePrueba(id);

  await Promise.all(sesiones.map(({ ctx }) => ctx.close()));

  expect(new Set(radicadoIds).size).toBe(CANTIDAD); // sin duplicados

  const consecutivos = radicadoIds
    .map((id) => Number(id.slice(-8)))
    .sort((a, b) => a - b);

  for (let i = 1; i < consecutivos.length; i += 1) {
    expect(consecutivos[i] - consecutivos[i - 1]).toBe(1); // sin huecos
  }

  // Verificación de solo lectura: los 3 documentos persistieron de verdad,
  // cada uno con su propio `control.consecutivo` coherente con su id —
  // descarta que alguno haya sobrescrito a otro silenciosamente.
  for (const id of radicadoIds) {
    const doc = await leerRadicado(id);
    expect(doc?.radicadoId).toBe(id);
    expect(doc?.control?.consecutivo).toBe(Number(id.slice(-8)));
  }
});
