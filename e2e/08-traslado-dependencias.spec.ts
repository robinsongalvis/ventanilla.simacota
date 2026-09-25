import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, abrirPanelRadicado, irATabRadicado } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (08, Batch A) — traslado entre dependencias desde la pestaña
 * "Traslado" del panel de detalle (`app/interno/dashboard/page.tsx`
 * ~2739-2924, `POST /api/radicados/{id}/asignar`, mismo endpoint que la
 * asignación inicial de la Bandeja — un traslado es una asignación cuando
 * `dependenciaNueva !== dependenciaActual`, ver `lib/traslado/resumir-cambio.ts`).
 *
 * Verifica los tres efectos que pide el encargo:
 *  1. El evento de trazabilidad queda con origen y destino
 *     (`accion: 'ASIGNACION'`, `oficinaOrigen`, `oficinaDestino` —
 *     `app/api/radicados/[radicadoId]/asignar/route.ts` ~102-114), legible
 *     en la pestaña Historia como "Trasladado a X" / "Desde Y"
 *     (`lib/trazabilidad/humanizar-evento.ts` ~97-118).
 *  2. `clasificacion.oficinaDestino` cambia de verdad (no solo la UI
 *     optimista) — se confirma recargando el panel desde cero.
 *  3. Usa ADMIN (no recepcionista) para poder radicar directo a la
 *     dependencia de origen y trasladar sin pelear con `canOperateTenant`.
 */
test('traslado entre dependencias: trazabilidad con origen/destino y cambio real', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.admin);

  // ── Nace en Secretaría de Gobierno ──
  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003009');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Traslado');
  await page.getByLabel('Asunto').fill(asuntoUnico('Traslado entre dependencias'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — traslado entre dependencias.',
  );
  await page.getByLabel('Dependencia destino').selectOption({ label: 'Secretaría de Gobierno' });

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);

  // ── Traslada a Secretaría de Planeación ──
  await abrirPanelRadicado(page, radicadoId);
  await irATabRadicado(page, 'Traslado');

  const selectDependencia = page.locator('p:text-is("Dependencia") + select');
  await expect(selectDependencia).toHaveValue('SEC_GOBIERNO');

  await selectDependencia.selectOption('SEC_PLANEACION');
  const botonTrasladar = page.getByRole('button', { name: 'Trasladar a Secretaría de Planeación' });
  await expect(botonTrasladar).toBeVisible();
  await botonTrasladar.click();

  await expect(page.getByText('Operación guardada correctamente.')).toBeVisible({ timeout: 15_000 });

  // ── Trazabilidad: evento con origen y destino ──
  await irATabRadicado(page, 'Historia');
  await expect(page.getByText('Trasladado a Secretaría de Planeación')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Desde Secretaría de Gobierno')).toBeVisible();

  // ── El cambio es real, no solo optimista: recarga el panel desde cero ──
  // (getByText('Secretaría de Planeación') suelto es ambiguo aquí — el
  // Tablero detrás repite el nombre en su propio filtro/listado; el valor
  // del <select> ya es la señal inequívoca de `clasificacion.oficinaDestino`
  // persistido, que es justo lo que pide verificar el encargo.)
  await abrirPanelRadicado(page, radicadoId);
  await irATabRadicado(page, 'Traslado');
  await expect(page.locator('p:text-is("Dependencia") + select')).toHaveValue('SEC_PLANEACION');
  await expect(page.getByText('El caso está hoy en')).toBeVisible();

  await ctx.close();
});
