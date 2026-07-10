import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (b) — presentación ANÓNIMA (Ley 1755/2015 art. 14): nombre e
 * identificación quedan bloqueados/vacíos y el radicado se crea igual.
 *
 * Se teclea primero un nombre/documento y luego se cambia a "Anónima"
 * para probar la regla real del formulario (RadicacionFuncionarioForm:
 * al elegir ANONIMA se limpian nombreCompleto/numeroDocumento) y no solo
 * el estado inicial vacío.
 */
test('radicación anónima: nombre e identificación quedan bloqueados y vacíos', async ({ browser, registrarRadicadoDePrueba }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(page);

  const campoDocumento = page.getByLabel('Identificación');
  const campoNombre = page.getByLabel('Nombre / razón social');

  // Se teclea algo primero: la regla debe limpiarlo al cambiar a Anónima,
  // no solo dejarlo vacío porque nunca se llenó.
  await campoDocumento.fill('9998887776');
  await campoNombre.fill('Nombre que debe desaparecer');

  await page.getByLabel('Presentación').selectOption('ANONIMA');

  await expect(campoDocumento).toHaveValue('');
  await expect(campoDocumento).toBeDisabled();
  await expect(campoNombre).toHaveValue('');
  await expect(campoNombre).toBeDisabled();
  await expect(page.getByText('No se registran nombre ni documento.')).toBeVisible();

  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Asunto').fill(asuntoUnico('Radicación anónima'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — presentación anónima (Ley 1755/2015 art. 14).',
  );

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);
  expect(radicadoId).toBeTruthy();

  await ctx.close();
});
