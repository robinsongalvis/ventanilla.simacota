import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import {
  login,
  abrirRadicacionRapida,
  enviarRadicacionRapida,
  asuntoUnico,
  irAVentanilla,
  cerrarModalRadicacion,
  abrirPanelRadicado,
  irABandeja,
} from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (07, Batch A) — presentación RESERVADA (Ley 1755/2015 art. 14):
 * a diferencia de ANÓNIMA, los campos de identidad SÍ se capturan; lo que
 * cambia es la protección en las vistas/consulta. Verificado, no asumido:
 *
 * - Interno: H2 (`docs/REGISTRO_RIESGOS.md`) + ADR-0006 (variante A,
 *   enmascarar por defecto) — CONTROL DE REGRESIÓN. El helper compartido
 *   `lib/seguridad/identidad-protegida.ts` se aplica de forma transversal
 *   y este test lo afirma en TODAS las superficies internas: mostrador de
 *   Ventanilla, panel de detalle (pestaña Información), bandeja de
 *   asignación y la exportación CSV técnico — el vector de mayor impacto,
 *   porque exfiltra en un solo archivo lo que las demás vistas exponen
 *   fila por fila. Antes este test documentaba la fuga como comportamiento
 *   vigente; ahora es el control que la rompe si reaparece.
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
  // El test creció con la extensión de H2 (panel de detalle, bandeja,
  // exportación CSV y búsqueda avanzada); esta última puede tardar hasta
  // 45s en stage (lee la colección completa server-side). El timeout
  // global de 60s (playwright.config.ts) ya no alcanza con margen.
  test.setTimeout(150_000);

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

  // ── Protección real en Búsqueda histórica avanzada (revisión cruzada
  //    del coordinador: `BusquedaAvanzadaPanel.tsx` mostraba
  //    `r.solicitante?.nombreCompleto` en el dropdown de resultados sin
  //    guarda — superficie de visualización distinta del predicado de
  //    filtro de `page.tsx`, que sí filtra bien sin exponer nada). Se
  //    filtra por número de radicado exacto para no depender del orden/
  //    paginación del listado por defecto.
  await page.getByRole('button', { name: 'Búsqueda avanzada' }).click();
  const dialogoBusqueda = page.getByRole('dialog', { name: 'Búsqueda histórica avanzada' });
  await expect(dialogoBusqueda).toBeVisible();
  await page.getByLabel('Número de radicado (exacto)').fill(radicadoId);
  // El endpoint lee la colección completa `ventanilla_radicados` server-side
  // (sin límite en la query de Firestore, pagina en memoria) — en stage,
  // con cientos de radicados sintéticos acumulados de corridas previas de
  // esta misma suite, la búsqueda puede tardar más que el timeout por
  // defecto de `expect` (10s). Se espera explícitamente a que el botón
  // "Buscar" vuelva a estar habilitado (deja de decir "Buscando…") antes
  // de mirar los resultados, en vez de asumir que ya cargaron.
  await expect(dialogoBusqueda.getByRole('button', { name: 'Buscar', exact: true })).toBeEnabled({ timeout: 45_000 });
  const filaBusquedaAvanzada = dialogoBusqueda.locator('li', { hasText: radicadoId });
  await expect(filaBusquedaAvanzada).toBeVisible();
  await expect(filaBusquedaAvanzada.getByText('Identidad protegida')).toBeVisible();
  await expect(filaBusquedaAvanzada.getByText(nombreCiudadano)).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialogoBusqueda).toHaveCount(0);

  // ── Protección real en el panel de detalle (pestaña Información) ──
  // H2: `app/interno/dashboard/page.tsx` ~2498-2500 mostraba nombre y
  // documento en texto plano sin condicional. Ahora pasa por
  // `documentoSolicitanteVisible`/`nombreSolicitanteVisible`. El nombre y
  // el documento reales no deben aparecer en NINGÚN lugar de la página
  // (ni en el panel, ni en la lista de fondo que sigue montada detrás).
  //
  // El stage acumula radicados reservados/anónimos de corridas previas de
  // esta misma suite, así que "Identidad protegida" NO es único en la
  // página (aparece también en filas de fondo del Tablero) — hay que
  // escopar al valor que sigue inmediatamente a la etiqueta del bloque
  // "Solicitante" (`FilaInfo`: <p>label</p><p>value</p> hermanos), no a un
  // `.first()` sobre toda la página.
  await abrirPanelRadicado(page, radicadoId);
  const valorDocumento = page.getByText('Documento', { exact: true }).locator('xpath=following-sibling::p[1]');
  const valorNombre = page.getByText('Nombre completo', { exact: true }).locator('xpath=following-sibling::p[1]');
  await expect(valorDocumento).toHaveText('Documento protegido');
  await expect(valorNombre).toHaveText('Identidad protegida');
  await expect(page.getByText(nombreCiudadano)).toHaveCount(0);
  await expect(page.getByText(documento, { exact: false })).toHaveCount(0);
  // Correo/teléfono/dirección: la fila entera se omite cuando la
  // identidad está reservada (reidentificarían al solicitante aunque el
  // nombre esté enmascarado).
  await expect(page.getByText(emailSolicitante)).toHaveCount(0);
  await expect(page.getByText('Correo', { exact: true })).toHaveCount(0);

  // ── Protección real en la bandeja de asignación ──
  // H2: `app/interno/dashboard/page.tsx` ~4295-4302. El radicado recién
  // creado nace en estado PENDIENTE, así que aparece en la bandeja antes
  // de asignarse.
  //
  // El panel de detalle queda "enganchado" a `?radicadoId=` en la URL: un
  // `useEffect` (page.tsx ~4539-4550) lo reabre y fuerza `SET_VISTA:
  // TABLERO` mientras ese parámetro siga presente, así que un simple clic
  // en el nav "Bandeja" no navega (el botón de cerrar el panel es un ícono
  // sin nombre accesible — hallazgo aparte, no de H2). Navegar por URL
  // limpia sin el parámetro reproduce lo que hace `cerrarPanelDerecho`.
  await page.goto('/interno/dashboard');
  await irABandeja(page);
  const filaBandeja = page.locator('tr', { hasText: radicadoId });
  await expect(filaBandeja).toBeVisible();
  await expect(filaBandeja.getByText('Identidad protegida')).toBeVisible();
  await expect(filaBandeja.getByText('Documento protegido')).toBeVisible();
  await expect(filaBandeja.getByText(nombreCiudadano)).toHaveCount(0);
  await expect(filaBandeja.getByText(documento, { exact: false })).toHaveCount(0);

  // ── Protección real en la exportación CSV técnico (vector de mayor
  //    impacto: exfiltra en un solo archivo lo que las demás vistas
  //    exponen fila por fila) ──
  // H2: `app/interno/dashboard/page.tsx` ~3697-3698 (`exportarCSVMIPG`)
  // emitía `nombreCompleto`/`numeroDocumento` sin guarda.
  await page.getByRole('navigation').getByRole('button', { name: 'Reportes MIPG' }).click();
  await expect(page.getByRole('heading', { name: 'Indicadores de Eficiencia' })).toBeVisible();
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV técnico' }).click(),
  ]);
  const rutaCsv = await descarga.path();
  expect(rutaCsv).toBeTruthy();
  const contenidoCsv = readFileSync(rutaCsv as string, 'utf8');
  const filaCsv = contenidoCsv
    .split('\r\n')
    .find((linea) => linea.startsWith(`"${radicadoId}"`));
  expect(filaCsv, 'la fila del radicado de prueba debe existir en el CSV exportado').toBeTruthy();
  expect(filaCsv).toContain('Identidad protegida');
  expect(filaCsv).toContain('Documento protegido');
  expect(filaCsv).not.toContain(nombreCiudadano);
  expect(filaCsv).not.toContain(documento);

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
