import { test, expect } from './fixtures';
import {
  login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico,
  cerrarModalRadicacion, irABandeja, abrirPanelRadicado, irATabRadicado,
} from './helpers';
import { USUARIOS_LAB } from './env';
import { leerRadicado, leerTrazabilidad } from './lab-admin';

/**
 * Escenario (13, Batch B) — integridad del expediente completo entre
 * radicación y cierre (etapa 16 de la auditoría manual del 2026-07-09:
 * "ningún dato se pierde entre etapas"). Compara documento + trazabilidad
 * ANTES de cualquier gestión (recién radicado) contra DESPUÉS de asignar y
 * resolver — vía lectura directa del documento real, no solo la UI.
 *
 * Campos que DEBEN permanecer idénticos byte a byte (datos del hecho
 * original, nunca deberían mutar por gestión posterior) vs. campos que SÍ
 * deben cambiar (efecto esperado de asignar/resolver) se verifican por
 * separado — el expediente "íntegro" no significa "inmutable", significa
 * "nada se pierde ni se corrompe sin que el cambio esté justificado y
 * trazado".
 */
test('expediente completo: nada se pierde entre radicación, asignación y resolución', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const nombreCiudadano = 'Ciudadano E2E Expediente Completo';
  const documento = '1002003030';
  const emailSolicitante = `e2e.expediente.${Date.now()}@example.com`;
  const asunto = asuntoUnico('Expediente completo inicio a cierre');
  const descripcion = 'Prueba automatizada del auditor funcional QA — integridad del expediente completo (etapa 16).';

  // ── 1. Radica ──
  const recepcionCtx = await browser.newContext();
  const recepcionPage = await recepcionCtx.newPage();
  await login(recepcionPage, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(recepcionPage);
  await recepcionPage.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await recepcionPage.getByLabel('Identificación').fill(documento);
  await recepcionPage.getByLabel('Nombre / razón social').fill(nombreCiudadano);
  await recepcionPage.getByLabel('Correo electrónico', { exact: true }).fill(emailSolicitante);
  await recepcionPage.getByLabel('Asunto').fill(asunto);
  await recepcionPage.getByLabel('Descripción').fill(descripcion);

  const radicadoId = await enviarRadicacionRapida(recepcionPage);
  registrarRadicadoDePrueba(radicadoId);
  await cerrarModalRadicacion(recepcionPage);

  // ── Expediente al INICIO (fuente de verdad: lectura directa) ──
  const docInicio = await leerRadicado(radicadoId);
  const trazaInicio = await leerTrazabilidad(radicadoId);
  expect(docInicio?.estadoActual).toBe('PENDIENTE');
  expect(trazaInicio.length).toBeGreaterThanOrEqual(1);
  expect(trazaInicio[0]?.accion).toBe('RADICACION');

  // ── 2. Asigna a Secretaría de Gobierno ──
  await irABandeja(recepcionPage);
  const fila = recepcionPage.locator('tr', { hasText: radicadoId });
  await expect(fila).toBeVisible({ timeout: 15_000 });
  await fila.locator('select').selectOption({ label: 'Secretaría de Gobierno' });
  // `POST /asignar` envía el correo de notificación al ciudadano de forma
  // SÍNCRONA antes de responder (app/api/radicados/[radicadoId]/asignar/route.ts
  // ~148-178) — sin SMTP en stage el fallo debería ser inmediato, pero se
  // espera la respuesta HTTP real en vez de solo el efecto en la UI para
  // no adivinar cuánto tarda.
  const [respuestaAsignar] = await Promise.all([
    recepcionPage.waitForResponse(
      (r) => r.url().includes('/asignar') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    fila.getByRole('button', { name: 'Asignar →' }).click(),
  ]);
  expect(respuestaAsignar.status()).toBe(200);
  await expect(fila).toHaveCount(0, { timeout: 10_000 });
  await recepcionCtx.close();

  // ── 3. Funcionario responde y resuelve ──
  const funcionarioCtx = await browser.newContext();
  const funcionarioPage = await funcionarioCtx.newPage();
  await login(funcionarioPage, USUARIOS_LAB.funcionario);

  await abrirPanelRadicado(funcionarioPage, radicadoId);
  await irATabRadicado(funcionarioPage, 'Responder');
  const respuestaTexto = 'Se atendió la solicitud del ciudadano — expediente completo, prueba de integridad.';
  await funcionarioPage
    .getByPlaceholder('Describe la respuesta dada al ciudadano o usa “Generar plantilla” para un oficio institucional…')
    .fill(respuestaTexto);
  await funcionarioPage.getByRole('button', { name: 'Marcar como resuelto' }).click();
  await expect(funcionarioPage.getByText('Operación guardada correctamente.')).toBeVisible({ timeout: 15_000 });
  await funcionarioCtx.close();

  // ── Expediente al CIERRE ──
  const docCierre = await leerRadicado(radicadoId);
  const trazaCierre = await leerTrazabilidad(radicadoId);

  // Datos del hecho original: NINGUNO se pierde ni se corrompe.
  expect(docCierre?.solicitante?.nombreCompleto).toBe(nombreCiudadano);
  expect(docCierre?.solicitante?.numeroDocumento).toBe(documento);
  expect(docCierre?.solicitante?.email).toBe(emailSolicitante);
  expect(docCierre?.detalle?.asunto).toBe(asunto);
  expect(docCierre?.detalle?.descripcion).toBe(descripcion);
  expect(docCierre?.control?.fechaRadicado).toBe(docInicio?.control?.fechaRadicado);
  expect(docCierre?.control?.medioRecepcion).toBe(docInicio?.control?.medioRecepcion);
  expect(docCierre?.termino?.tipoSolicitudId).toBe(docInicio?.termino?.tipoSolicitudId);
  expect(docCierre?.radicadoId).toBe(radicadoId);

  // Efecto esperado de la gestión: SÍ cambian, y de forma coherente.
  expect(docCierre?.estadoActual).toBe('RESUELTO');
  expect(docCierre?.clasificacion?.oficinaDestino).toBe('SEC_GOBIERNO');
  expect(docCierre?.respuestaOficial?.nota).toBe(respuestaTexto);

  // Trazabilidad: creció (más eventos), y el evento original de RADICACION
  // sigue estando — no se sobrescribió ni se perdió al añadir los nuevos.
  expect(trazaCierre.length).toBeGreaterThan(trazaInicio.length);
  expect(trazaCierre[0]?.accion).toBe('RADICACION');
  expect(trazaCierre[0]?.fecha).toBe(trazaInicio[0]?.fecha);
  expect(trazaCierre.some((e) => e.accion === 'ASIGNACION')).toBe(true);
  expect(trazaCierre.some((e) => e.accion === 'RESPUESTA_FUNCIONARIO')).toBe(true);
});
