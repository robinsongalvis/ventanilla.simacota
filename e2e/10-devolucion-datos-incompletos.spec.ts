import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, abrirPanelRadicado, irATabRadicado } from './helpers';
import { USUARIOS_LAB } from './env';
import { leerRadicado } from './lab-admin';

/**
 * Escenario (10, Batch A) — devolución. El flujo SÍ existe (confirmado
 * antes de escribir este test, per el encargo: "si no existe, no lo
 * inventes"): botón "Devolver" en la pestaña Prórroga
 * (`app/interno/dashboard/page.tsx` ~3017-3033), `POST
 * /api/radicados/{id}/devolver` (`app/api/radicados/[radicadoId]/devolver/route.ts`).
 *
 * Precisión sobre el nombre del escenario: es "devolución con motivo",
 * NO específicamente "por datos incompletos" — el endpoint acepta
 * cualquier motivo de al menos 10 caracteres; no hay una razón
 * estructurada/tipada de devolución (solo texto libre). El estado
 * resultante es `DEVUELTO`; NO reasigna `clasificacion.oficinaDestino`
 * (el título "Devuelto a la Ventanilla" de la Historia es una etiqueta de
 * la línea de tiempo, no un movimiento real de dependencia — verificado
 * leyendo el endpoint, que solo toca `estadoActual`).
 */
test('devolución: motivo obligatorio, estado DEVUELTO y evento de trazabilidad', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.admin);

  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003011');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Devolución');
  await page.getByLabel('Asunto').fill(asuntoUnico('Devolución por datos incompletos'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — devolución con motivo (datos incompletos).',
  );

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);

  await abrirPanelRadicado(page, radicadoId);
  await irATabRadicado(page, 'Prórroga'); // Devolver vive en esta misma pestaña.

  const motivoDevolucion = 'El documento de identidad aportado no es legible; se requiere copia nueva.';
  await page.getByPlaceholder('Indica la razón de la devolución…').fill(motivoDevolucion);

  const [respuestaDevolver] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/devolver') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Devolver', exact: true }).click(),
  ]);
  expect(respuestaDevolver.status()).toBe(200);
  const cuerpo = await respuestaDevolver.json();
  expect(cuerpo.ok).toBe(true);
  expect(cuerpo.estadoActual).toBe('DEVUELTO');

  await expect(page.getByText('Operación guardada correctamente.')).toBeVisible({ timeout: 15_000 });

  await irATabRadicado(page, 'Historia');
  await expect(page.getByText('Devuelto a la Ventanilla')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(motivoDevolucion)).toBeVisible();

  const doc = await leerRadicado(radicadoId);
  expect(doc?.estadoActual).toBe('DEVUELTO');

  await ctx.close();
});
