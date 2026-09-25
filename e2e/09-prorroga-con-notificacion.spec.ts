import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, abrirPanelRadicado, irATabRadicado } from './helpers';
import { USUARIOS_LAB } from './env';
import { leerRadicado } from './lab-admin';

/**
 * Escenario (09, Batch A) — prórroga desde la pestaña "Traslado" → sección
 * "Prórroga" (comparten pestaña con Devolver, `TABS_PANEL` solo tiene un id
 * `'prorroga'` para ambas — `app/interno/dashboard/page.tsx` ~3013-3059).
 * `POST /api/radicados/{id}/prorroga`.
 *
 * Verifica lo que pide el encargo — `termino.prorrogasAplicadas` incrementa,
 * el vencimiento se recalcula, y queda evento de trazabilidad — vía lectura
 * de solo lectura del documento real (no solo la respuesta HTTP, que no
 * devuelve `prorrogasAplicadas`).
 *
 * ── CONTROL NORMATIVO (ADR-0003, hallazgo H1, RESUELTO) ── Ley 1755/2015
 * art. 14 exige que la prórroga sea ÚNICA. Este test aplicaba antes una
 * SEGUNDA prórroga para documentar que el sistema la aceptaba sin objeción
 * (brecha confirmada, `prorrogasAplicadas` llegaba a 2). Con el control
 * ejecutable de `validarProrroga` (`lib/server/radicados-security.ts`),
 * invocado por el endpoint antes de escribir, la segunda prórroga ahora
 * debe ser RECHAZADA (409) y el contador debe permanecer en 1. Este test
 * se invierte para asertar el rechazo, tal como anticipaba este comentario.
 */
test('prórroga: la primera aplica y notifica; la segunda es rechazada por unicidad (Ley 1755 art. 14, ADR-0003)', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.admin);

  const emailSolicitante = `e2e.prorroga.${Date.now()}@example.com`;

  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003010');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Prórroga');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(emailSolicitante);
  await page.getByLabel('Asunto').fill(asuntoUnico('Prórroga con notificación'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — prórroga con notificación (Ley 1755/2015).',
  );

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);

  const antes = await leerRadicado(radicadoId);
  expect(antes?.termino?.prorrogasAplicadas ?? 0).toBe(0);
  const vencimientoOriginal = new Date(antes!.termino.fechaVencimiento as string);

  await abrirPanelRadicado(page, radicadoId);
  await irATabRadicado(page, 'Prórroga');

  const campoMotivo = page.getByPlaceholder('Fundamento legal de la prórroga');
  const campoDias = page.locator('p:text-is("Días") + input');
  const diasProrroga = 10;

  await campoMotivo.fill('Se requiere tiempo adicional para reunir soportes del área técnica.');
  await campoDias.fill(String(diasProrroga));

  const botonProrroga = page.getByRole('button', { name: `Aplicar prórroga (+${diasProrroga} días)` });
  const [respuestaProrroga] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/prorroga') && r.request().method() === 'POST'),
    botonProrroga.click(),
  ]);
  expect(respuestaProrroga.status()).toBe(200);
  const cuerpoProrroga = await respuestaProrroga.json();
  expect(cuerpoProrroga.ok).toBe(true);
  expect(cuerpoProrroga.estadoActual).toBe('PRORROGA');

  await expect(page.getByText('Operación guardada correctamente.')).toBeVisible({ timeout: 15_000 });

  // ── Trazabilidad ──
  await irATabRadicado(page, 'Historia');
  await expect(page.getByText('Prórroga aplicada al término')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Se requiere tiempo adicional para reunir soportes del área técnica.')).toBeVisible();

  // ── Verificación de solo lectura contra el documento real ──
  const despuesUna = await leerRadicado(radicadoId);
  expect(despuesUna?.termino?.prorrogasAplicadas).toBe(1);
  const vencimientoEsperado = new Date(vencimientoOriginal);
  vencimientoEsperado.setDate(vencimientoEsperado.getDate() + diasProrroga);
  expect(new Date(despuesUna!.termino.fechaVencimiento as string).toISOString()).toBe(vencimientoEsperado.toISOString());
  // Notificación: sí se intenta cuando hay correo (queda "notificada" —
  // la respuesta HTTP ya confirmó ok:true; el envío real depende de que
  // stage tenga SMTP configurado, fuera del alcance de este test).

  // ── Control ADR-0003: la segunda prórroga debe ser RECHAZADA ──
  await irATabRadicado(page, 'Prórroga');
  await page.getByPlaceholder('Fundamento legal de la prórroga').fill('Segunda prórroga — debe ser rechazada por el control de unicidad.');
  const [respuestaSegundaProrroga] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/prorroga') && r.request().method() === 'POST'),
    page.getByRole('button', { name: `Aplicar prórroga (+${diasProrroga} días)` }).click(),
  ]);
  expect(respuestaSegundaProrroga.status()).toBe(409);
  const cuerpoSegundaProrroga = await respuestaSegundaProrroga.json();
  expect(cuerpoSegundaProrroga.error).toMatch(/una sola|una prórroga|1755/i);
  await expect(page.getByText(/^Error:/)).toBeVisible({ timeout: 15_000 });

  const despuesDos = await leerRadicado(radicadoId);
  // Si este número alguna vez sube a 2, significa que el control de
  // unicidad (ADR-0003, `validarProrroga` en
  // lib/server/radicados-security.ts) se rompió o fue removido — no
  // "arreglar" el test para que siga pasando; es una regresión normativa
  // sobre Ley 1755/2015 art. 14 (hallazgo H1).
  expect(despuesDos?.termino?.prorrogasAplicadas).toBe(1);

  await ctx.close();
});
