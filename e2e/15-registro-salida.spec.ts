import { test, expect } from './fixtures';
import { login, irAVentanilla, RE_NUMERO_SALIDA } from './helpers';
import { USUARIOS_LAB } from './env';
import { leerDocumento } from './lab-admin';

/**
 * Escenario (15, Batch B) — registro de salida con constancia de despacho,
 * cierra el presupuesto de 15 del auditor (ADR-0002 §4.1). Vía
 * `RegistrarSalidaModal` en modo OFICIO_INDEPENDIENTE (sin radicado de
 * entrada amarrado — se abre desde la Ventanilla, no desde el detalle de
 * un radicado), `POST /api/salidas/registrar`.
 *
 * Nota sobre "constancia": es un sello IMPRIMIBLE (`SelloDespacho.tsx`,
 * `window.print()`), no un PDF que se sube a Storage — a diferencia del
 * sello de documento (escenario 14). Por eso este test verifica que el
 * CONTENIDO de la constancia se renderiza correcto (número, destinatario,
 * medio, firmante) en vez de accionar "Imprimir constancia de despacho":
 * disparar `window.print()` en un test automatizado no aporta señal y
 * arriesga colgar el navegador headless sin ningún diálogo que cerrar.
 */
test('registro de salida: genera el consecutivo 2-SAL y su constancia con los datos correctos', async ({
  browser,
  registrarDocumentoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.admin);

  await irAVentanilla(page);
  await page.getByRole('button', { name: 'Registrar salida' }).click();

  const modal = page.getByRole('dialog', { name: 'Registrar oficio de salida' });
  await expect(modal).toBeVisible();

  const destinatario = 'Contraloría General de Santander';
  const asunto = `[E2E-AUTO] Registro de salida ${Date.now()}`;
  const firmante = 'Recepcionista Lab';

  // exact: true — "Destinatario" es substring de "Correo del destinatario".
  await modal.getByLabel('Destinatario', { exact: true }).fill(destinatario);
  await modal.getByLabel('Asunto').fill(asunto);
  // Medio de envío queda en su default (Correo electrónico); dependencia
  // que despacha queda en el default del usuario (Ventanilla Única).
  await modal.getByLabel('Firmante del oficio').fill(firmante);

  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/salidas/registrar') && r.request().method() === 'POST'),
    modal.getByRole('button', { name: 'Registrar salida' }).click(),
  ]);
  expect(respuesta.status()).toBe(200);
  const cuerpo = await respuesta.json();
  expect(cuerpo.salida).toBeTruthy();
  const salidaId = cuerpo.salida.salidaId as string;
  expect(salidaId).toMatch(RE_NUMERO_SALIDA);

  await expect(modal.getByText('Salida registrada')).toBeVisible({ timeout: 15_000 });
  // El número se repite dentro del propio modal: el título grande de éxito
  // Y el sello de constancia (SelloDespacho, más abajo en el mismo modal)
  // — .first() basta, ya sabemos por la respuesta HTTP que es el correcto.
  await expect(modal.getByText(salidaId).first()).toBeVisible();

  registrarDocumentoDePrueba('ventanilla_salidas', salidaId);

  // ── Contenido real de la constancia (sin disparar window.print()) ──
  await expect(modal.getByText(`Para: ${destinatario}`)).toBeVisible();
  await expect(modal.getByText(/Medio: Correo electrónico · Despacha: Ventanilla Única/)).toBeVisible();
  await expect(modal.getByText(`Firma: ${firmante}`)).toBeVisible();

  // ── Verificación de solo lectura contra el documento real ──
  const doc = await leerDocumento('ventanilla_salidas', salidaId);
  expect(doc?.salidaId).toBe(salidaId);
  expect(doc?.destinatario?.nombre).toBe(destinatario);
  expect(doc?.asunto).toBe(asunto);
  expect(doc?.firmante?.nombre).toBe(firmante);
  expect(doc?.tipoSalida).toBe('OFICIO_INDEPENDIENTE');
  expect(doc?.radicadoEntradaId).toBeFalsy();

  await ctx.close();
});
