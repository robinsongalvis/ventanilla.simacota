import { test, expect } from './fixtures';
import { login, asuntoUnico, RE_NUMERO_RADICADO_AMPLIO, RE_NUMERO_SALIDA } from './helpers';
import { USUARIOS_LAB } from './env';
import { leerRadicado } from './lab-admin';

/**
 * Escenario (11, Batch A) — Registro exprés: correspondencia que llegó y
 * ya se respondió desde el correo institucional; el funcionario lo declara
 * DESPUÉS y el sistema arma el paquete completo (entrada YA resuelta +
 * salida amarrada) en una sola llamada
 * (`RegistroExpresModal.tsx` → `POST /api/dependencias/registro-expres` →
 * `lib/dependencias/registro-expres.ts:construirPaqueteExpres`).
 *
 * Distinto de "Radicación Rápida": nace RESUELTO de una vez (no PENDIENTE),
 * y crea DOS documentos en DOS colecciones (`ventanilla_radicados` +
 * `ventanilla_salidas`) — el marcado `isTest` de esta suite necesitó un
 * segundo fixture (`registrarDocumentoDePrueba`, e2e/fixtures.ts) porque el
 * original solo cubría `ventanilla_radicados`.
 */
test('registro exprés: produce una entrada resuelta y una salida amarrada, con el término real de PETICION_GENERAL', async ({
  browser,
  registrarRadicadoDePrueba,
  registrarDocumentoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await page.getByRole('button', { name: 'Registro exprés' }).click();
  await expect(page.getByRole('heading', { name: 'Registro exprés' })).toBeVisible();

  // Default de tipo declarado por el coordinador: PETICION_GENERAL,
  // distinto del default de Radicación Rápida (PETICION_INFORMACION,
  // RadicacionFuncionarioForm.tsx INITIAL_FORM). Se verifica, no se asume.
  await expect(page.getByLabel('Tipo de solicitud')).toHaveValue('PETICION_GENERAL');

  const remitente = 'Banco Agrario de Colombia — Sucursal Simacota';
  const respuestaResumen = 'Se envió la certificación de cuentas del convenio 052, firmada digitalmente.';
  const queSePedia = 'Certificación de las cuentas activas del convenio interadministrativo 052 de 2026.';

  await page.getByLabel('Quién escribió').fill(remitente);
  await page.getByLabel('Dependencia que recibió y respondió').selectOption({ label: 'Secretaría de Gobierno' });
  await page.getByLabel('Asunto').fill(asuntoUnico('Registro exprés'));
  await page.getByLabel('Qué pedía').fill(queSePedia);
  await page.getByLabel('Qué se respondió').fill(respuestaResumen);

  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/dependencias/registro-expres') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Registrar', exact: true }).click(),
  ]);
  expect(respuesta.status()).toBe(200);
  const cuerpo = await respuesta.json();
  expect(cuerpo.ok).toBe(true);

  await expect(page.getByText('Registro completo')).toBeVisible({ timeout: 15_000 });
  const entradaId = cuerpo.radicadoId as string;
  const salidaId = cuerpo.salidaId as string;

  // ── Formato real de los dos consecutivos — verificado, no asumido ──
  // Confirmado empíricamente: el comentario de
  // lib/dependencias/registro-expres.ts dice "entrada 1-EMAIL-..." pero el
  // valor real es 1-110-... (CODIGO_OFICINA_RADICADORA fijo, sin excepción
  // — lib/radicado-institucional.ts:23). Documentación desactualizada, no
  // bug funcional: reportado en la bitácora.
  expect(entradaId).toMatch(RE_NUMERO_RADICADO_AMPLIO);
  expect(salidaId).toMatch(RE_NUMERO_SALIDA);
  // El dashboard vivo detrás del modal (Tablero) también muestra el mismo
  // radicadoId recién creado — escopar al diálogo del modal evita la
  // ambigüedad (mismo patrón que helpers.ts:enviarRadicacionRapida).
  const modal = page.getByRole('dialog', { name: 'Registro exprés de correspondencia respondida' });
  await expect(modal.getByText(entradaId)).toBeVisible();
  await expect(modal.getByText(salidaId)).toBeVisible();

  registrarRadicadoDePrueba(entradaId);
  registrarDocumentoDePrueba('ventanilla_salidas', salidaId);

  // ── Verificación de solo lectura contra el documento real ──
  const doc = await leerRadicado(entradaId);
  expect(doc?.estadoActual).toBe('RESUELTO');
  expect(doc?.clasificacion?.oficinaDestino).toBe('SEC_GOBIERNO');
  expect(doc?.respuestaOficial?.nota).toBe(respuestaResumen);
  // Término real de PETICION_GENERAL (lib/catalogos/tipos-solicitud.ts):
  // 15 días hábiles — el registro exprés lo calcula igual que cualquier
  // otra vía (calcularFechaVencimiento), no inventa un término propio.
  expect(doc?.termino?.diasRespuesta).toBe(15);
  expect(doc?.termino?.unidad).toBe('HABILES');
  expect(typeof doc?.cumplioTermino).toBe('boolean');

  await ctx.close();
});
