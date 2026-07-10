import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico } from './helpers';
import { USUARIOS_LAB } from './env';

const TITULO_SOLO_LECTURA = 'Tu rol no permite realizar acciones sobre radicados.';

/**
 * Escenario (e) — JEFE_DEPENDENCIA es solo-lectura por diseño: ve el
 * radicado pero ningún botón de acción está habilitado.
 *
 * jefe.lab está fijado a su propia dependencia (FUNCIONARIO/JEFE_DEPENDENCIA
 * no ven todos los tenants — lib/permisos/alcance-tenants.ts) y ese tenant
 * no está documentado en el encargo. En vez de asumirlo, el test lo
 * descubre leyendo el encabezado "Tablero · {dependencia}" (visible solo
 * para roles sin alcance municipal, page.tsx ~4810) y luego usa ADMIN
 * —que sí puede elegir cualquier "Dependencia destino" al radicar— para
 * crear un radicado dirigido exactamente a esa dependencia.
 */
test('jefe en modo solo lectura: abre el radicado y no puede actuar', async ({ browser, registrarRadicadoDePrueba }) => {
  const jefeCtx = await browser.newContext();
  const jefePage = await jefeCtx.newPage();
  await login(jefePage, USUARIOS_LAB.jefe);

  const encabezadoTablero = jefePage.getByText(/^Tablero · /);
  await expect(encabezadoTablero).toBeVisible({ timeout: 15_000 });
  const texto = (await encabezadoTablero.textContent()) ?? '';
  const dependenciaJefe = texto.replace(/^Tablero\s*·\s*/, '').trim();
  expect(dependenciaJefe.length).toBeGreaterThan(0);
  expect(dependenciaJefe).not.toBe('Vista municipal');

  // ── Admin radica directo a la dependencia del jefe ──
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, USUARIOS_LAB.admin);

  await abrirRadicacionRapida(adminPage);
  await adminPage.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await adminPage.getByLabel('Identificación').fill('1002003007');
  await adminPage.getByLabel('Nombre / razón social').fill('Ciudadano E2E Jefe Solo Lectura');
  await adminPage.getByLabel('Asunto').fill(asuntoUnico('Jefe solo lectura'));
  await adminPage.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — perímetro de solo lectura de JEFE_DEPENDENCIA.',
  );
  await adminPage.getByLabel('Dependencia destino').selectOption({ label: dependenciaJefe });

  const radicadoId = await enviarRadicacionRapida(adminPage);
  registrarRadicadoDePrueba(radicadoId);
  await adminCtx.close();

  // ── El jefe abre ese radicado y verifica que no puede actuar ──
  await jefePage.goto(`/interno/dashboard?radicadoId=${encodeURIComponent(radicadoId)}`);
  // El radicadoId también aparece en el Tablero detrás del panel (no es
  // modal a pantalla completa): usar la pestaña "Responder" —exclusiva
  // del panel de detalle— evita la ambigüedad de un getByText repetido.
  await expect(jefePage.getByRole('tab', { name: 'Responder' })).toBeVisible({ timeout: 20_000 });

  await jefePage.getByRole('tab', { name: 'Responder' }).click();
  const botonResolver = jefePage.getByRole('button', { name: 'Vista de solo lectura' });
  await expect(botonResolver).toBeVisible();
  await expect(botonResolver).toBeDisabled();
  await expect(botonResolver).toHaveAttribute('title', TITULO_SOLO_LECTURA);

  await jefeCtx.close();
});
