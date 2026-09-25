import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (c) — anti-enumeración: la consulta pública con dato de
 * verificación INCORRECTO responde 404 genérico, indistinguible del caso
 * "radicado inexistente" (lib/seguridad/consulta-publica-radicado.ts).
 *
 * Nota de datos: el endpoint público tiene rate limit por IP
 * (CONSULTA_RATE_IP_MINUTO, default 5/min) y por radicado
 * (CONSULTA_RATE_FALLOS_RADICADO, default 5 fallos → bloqueo 15 min).
 * Este test consume 1 fallo de cada contador; no lo reintentes en bucle
 * dentro del mismo minuto o el propio rate limit te devolverá 429 en vez
 * de 404 y el test se leerá (falsamente) como intermitente.
 */
test('consulta pública con verificación incorrecta responde 404 genérico', async ({ browser, request, registrarRadicadoDePrueba }) => {
  const emailReal = `e2e.consulta.${Date.now()}@example.com`;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003005');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Consulta Incorrecta');
  // exact: true — ver comentario equivalente en 01-ciclo-dorado.spec.ts.
  await page.getByLabel('Correo electrónico', { exact: true }).fill(emailReal);
  await page.getByLabel('Asunto').fill(asuntoUnico('Consulta incorrecta'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — verificación de consulta pública con dato incorrecto.',
  );

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);
  await ctx.close();

  const respuesta = await request.post('/api/public/radicado/consulta', {
    data: { numeroRadicado: radicadoId, datoVerificacion: 'no-es-el-correo-correcto@example.com' },
  });

  expect(respuesta.status()).toBe(404);
  const cuerpo = await respuesta.json();
  expect(cuerpo.ok).toBe(false);
  expect(cuerpo.error).toBe(
    'No fue posible verificar el radicado con la información suministrada. Revise los datos e intente nuevamente.',
  );
});
