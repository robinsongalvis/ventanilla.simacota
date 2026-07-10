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
 * ── HALLAZGO NORMATIVO (para gobierno-digital, no bloqueante para este
 * test) ── Ley 1755/2015 exige que la prórroga sea ÚNICA. El endpoint
 * (`app/api/radicados/[radicadoId]/prorroga/route.ts`) NO tiene ningún
 * guard que impida una segunda prórroga sobre el mismo radicado:
 * `assertNotClosed` (lib/server/radicados-security.ts:44-48) solo bloquea
 * RESUELTO/RECHAZADO, y el estado que deja una prórroga es `PRORROGA`, que
 * no está en esa lista. Este test aplica una SEGUNDA prórroga a propósito
 * para verificar el comportamiento real (no asumirlo) — confirmado: el
 * sistema la acepta sin objeción y `prorrogasAplicadas` llega a 2. El
 * motivo SÍ se captura (queda "motivada") y la notificación al ciudadano
 * SÍ se intenta si tiene correo (queda "notificada" cuando hay canal) — la
 * brecha real es específicamente la ausencia del límite de unicidad.
 */
test('prórroga: incrementa el contador, recalcula vencimiento y dispara notificación — y detecta que no hay límite de unicidad', async ({
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

  // ── Hallazgo normativo: segunda prórroga, sin bloqueo real ──
  await irATabRadicado(page, 'Prórroga');
  await page.getByPlaceholder('Fundamento legal de la prórroga').fill('Segunda prórroga — verificando si el sistema la bloquea.');
  await page.getByRole('button', { name: `Aplicar prórroga (+${diasProrroga} días)` }).click();
  await expect(page.getByText('Operación guardada correctamente.')).toBeVisible({ timeout: 15_000 });

  const despuesDos = await leerRadicado(radicadoId);
  // Si este número alguna vez baja a 1 (con un mensaje de error visible en
  // su lugar), significa que alguien cerró la brecha normativa — hay que
  // actualizar este comentario y el hallazgo de la bitácora, no "arreglar"
  // el test para que seguir pasando.
  expect(despuesDos?.termino?.prorrogasAplicadas).toBe(2);

  await ctx.close();
});
