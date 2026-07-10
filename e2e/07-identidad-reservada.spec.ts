import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, irAVentanilla, cerrarModalRadicacion } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (07, Batch A) — presentación RESERVADA (Ley 1755/2015 art. 14):
 * a diferencia de ANÓNIMA, los campos de identidad SÍ se capturan; lo que
 * cambia es la protección en las vistas/consulta. Verificado, no asumido:
 *
 * - Interno: el campo queda protegido SOLO en el mostrador de Ventanilla
 *   (`VistaVentanilla.identidadProtegida`, "Identidad protegida" en vez del
 *   nombre) — NO en el panel de detalle completo (Información), que sigue
 *   mostrando nombre y documento en texto plano
 *   (`app/interno/dashboard/page.tsx` ~2494, sin condicional por
 *   `identidadReservada`). Documentado como hallazgo, no como fallo del
 *   test: el test verifica lo que el sistema REALMENTE hace hoy.
 * - Público: `aRadicadoPublico` (lib/seguridad/consulta-publica-radicado.ts
 *   ~178-183) omite la clave `dependencia` del JSON cuando el radicado es
 *   reservado — así el ciudadano puede consultar su propio caso, pero la
 *   respuesta no revela CUÁL dependencia lo atendió (relevante para casos
 *   sensibles, p. ej. Comisaría de Familia).
 */
test('identidad reservada: datos capturados, protección real verificada en Ventanilla y consulta pública', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(page);

  const campoDocumento = page.getByLabel('Identificación');
  const campoNombre = page.getByLabel('Nombre / razón social');
  const nombreCiudadano = 'Ciudadano E2E Identidad Reservada';
  const documento = '1002003008';
  const emailSolicitante = `e2e.reservada.${Date.now()}@example.com`;

  await campoDocumento.fill(documento);
  await campoNombre.fill(nombreCiudadano);

  await page.getByLabel('Presentación').selectOption('RESERVADA');

  // A diferencia de ANÓNIMA (02-radicacion-anonima.spec.ts): los datos
  // capturados NO se limpian ni se deshabilitan.
  await expect(campoDocumento).toHaveValue(documento);
  await expect(campoDocumento).toBeEnabled();
  await expect(campoNombre).toHaveValue(nombreCiudadano);
  await expect(campoNombre).toBeEnabled();
  await expect(page.getByText('Los datos se registran pero quedan protegidos en las vistas.')).toBeVisible();

  await page.getByLabel('Correo electrónico', { exact: true }).fill(emailSolicitante);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Asunto').fill(asuntoUnico('Identidad reservada'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — presentación con identidad reservada (Ley 1755/2015 art. 14).',
  );

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);
  await cerrarModalRadicacion(page);

  // ── Protección real en el mostrador de Ventanilla ──
  await irAVentanilla(page);
  await page.getByPlaceholder('Radicado, cédula o nombre del ciudadano…').fill(radicadoId);
  const filaResultado = page.getByRole('button', { name: `Abrir radicado ${radicadoId}` });
  await expect(filaResultado).toBeVisible();
  await expect(filaResultado.getByText('Identidad protegida')).toBeVisible();
  await expect(filaResultado.getByText(nombreCiudadano)).toHaveCount(0);

  await ctx.close();

  // ── Protección real en consulta pública: la dependencia no se revela ──
  const ctxPublico = await browser.newContext();
  const respuesta = await ctxPublico.request.post('/api/public/radicado/consulta', {
    data: { numeroRadicado: radicadoId, datoVerificacion: emailSolicitante },
  });
  expect(respuesta.status()).toBe(200);
  const cuerpo = await respuesta.json();
  expect(cuerpo.ok).toBe(true);
  expect(cuerpo.radicado.numeroRadicado).toBe(radicadoId);
  expect(cuerpo.radicado.dependencia).toBeUndefined();
  await ctxPublico.close();
});
