import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, cerrarModalRadicacion, irABandeja } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (a) del encargo Fase 2 — ciclo dorado completo:
 * recepcionista radica (identificada, petición general) → asigna a
 * Secretaría de Gobierno → funcionario responde y resuelve → la consulta
 * pública ya refleja `fueRespondido: true`.
 *
 * Tres actores reales (recepcionista, funcionario, ciudadano anónimo) se
 * modelan como tres `BrowserContext` aislados — evita depender de logout/
 * login secuencial sobre la misma pestaña (control de pestaña única del
 * layout) y refleja cómo ocurre en producción: máquinas y sesiones
 * distintas.
 */
test('ciclo dorado: radicar → asignar → responder → consulta pública', async ({ browser, request, registrarRadicadoDePrueba }) => {
  // Escenario más largo de la suite (4 etapas, 3 contextos + consulta pública).
  // El timeout global de 60s (playwright.config.ts) se queda corto cuando STAGE
  // acumula datos de muchas corridas y el dashboard se ralentiza al montar
  // (carga la colección completa — deuda de rendimiento registrada, no defecto
  // de este test). Mismo patrón que e2e/07. No se debilita ninguna aserción:
  // solo se da margen realista sobre un entorno compartido y acumulativo.
  test.setTimeout(120_000);
  const asunto = asuntoUnico('Ciclo dorado');
  const emailSolicitante = `e2e.ciclo.${Date.now()}@example.com`;

  // ── 1. Recepcionista radica (identificada, petición general) ──
  const recepcionCtx = await browser.newContext();
  const recepcionPage = await recepcionCtx.newPage();
  await login(recepcionPage, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(recepcionPage);
  await recepcionPage.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await recepcionPage.getByLabel('Identificación').fill('1002003004');
  await recepcionPage.getByLabel('Nombre / razón social').fill('Ciudadano E2E Ciclo Dorado');
  // exact: true — "Correo electrónico" es substring de "No aporta correo
  // electrónico" (checkbox) y del select "Medio de respuesta" (una de sus
  // <option>), y getByLabel hace match por substring por defecto.
  await recepcionPage.getByLabel('Correo electrónico', { exact: true }).fill(emailSolicitante);
  await recepcionPage.getByLabel('Asunto').fill(asunto);
  await recepcionPage.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA (Fase 2, ADR-0002) — ciclo dorado completo.',
  );

  const radicadoId = await enviarRadicacionRapida(recepcionPage);
  registrarRadicadoDePrueba(radicadoId);
  await cerrarModalRadicacion(recepcionPage);

  // ── 2. Asigna a Secretaría de Gobierno desde la Bandeja ──
  await irABandeja(recepcionPage);

  const fila = recepcionPage.locator('tr', { hasText: radicadoId });
  await expect(fila).toBeVisible({ timeout: 15_000 });
  await fila.locator('select').selectOption({ label: 'Secretaría de Gobierno' });
  await fila.getByRole('button', { name: 'Asignar →' }).click();
  // Hallazgo (no bloqueante, ver bitácora): NO se puede afirmar de forma
  // fiable "✓ Asignado" — es estado LOCAL de BandejaAsignacion (page.tsx
  // ~4137) mientras que la fila desaparece por el listener en tiempo real
  // de Firestore en cuanto `estadoActual` deja de ser PENDIENTE
  // (radicadosPendientes filtra por ese estado). Si el eco del listener
  // llega antes o junto con el re-render del "✓ Asignado" local, la fila
  // se desmonta y esa confirmación nunca llega a verse — carrera real,
  // reproducida de forma consistente en esta suite. La señal fiable de
  // éxito es que la fila desaparece de la Bandeja (transición de estado
  // confirmada); el paso 3 confirma independientemente que la asignación
  // se aplicó (el funcionario de SEC_GOBIERNO ve y resuelve el radicado).
  await expect(fila).toHaveCount(0, { timeout: 10_000 });

  await recepcionCtx.close();

  // ── 3. Funcionario responde y marca como resuelto ──
  const funcionarioCtx = await browser.newContext();
  const funcionarioPage = await funcionarioCtx.newPage();
  await login(funcionarioPage, USUARIOS_LAB.funcionario);

  await funcionarioPage.goto(`/interno/dashboard?radicadoId=${encodeURIComponent(radicadoId)}`);
  // El radicadoId también aparece en el listado del Tablero detrás del
  // panel (no es un modal a pantalla completa) — un getByText ambiguo
  // resolvería a >1 elemento. La pestaña "Responder" solo existe dentro
  // del panel de detalle: confirma que abrió sin esa ambigüedad.
  await expect(funcionarioPage.getByRole('tab', { name: 'Responder' })).toBeVisible({ timeout: 15_000 });

  await funcionarioPage.getByRole('tab', { name: 'Responder' }).click();
  await funcionarioPage
    .getByPlaceholder('Describe la respuesta dada al ciudadano o usa “Generar plantilla” para un oficio institucional…')
    .fill('Se atendió la solicitud del ciudadano — respuesta generada por el auditor funcional QA.');
  await funcionarioPage.getByRole('button', { name: 'Marcar como resuelto' }).click();

  // Estabilización (coordinador, corrida de confirmación 2026-07-10): NO se
  // aserta el toast efímero "Operación guardada correctamente." — aparece y
  // se autodescarta, y bajo la carga de la suite completa se perdía (falló
  // en corrida + reintento). La señal DURADERA es que el botón se re-rotula
  // a "Ya está resuelto" cuando el estado pasa a RESUELTO: más precisa y no
  // flaky. Si el resolver fallara de verdad, esta aserción y la consulta
  // pública (paso 4) lo detectan igual — no se pierde cobertura.
  await expect(funcionarioPage.getByRole('button', { name: 'Ya está resuelto' })).toBeVisible({ timeout: 20_000 });

  await funcionarioCtx.close();

  // ── 4. Consulta pública ya refleja la respuesta ──
  const respuestaConsulta = await request.post('/api/public/radicado/consulta', {
    data: { numeroRadicado: radicadoId, datoVerificacion: emailSolicitante },
  });
  expect(respuestaConsulta.status()).toBe(200);
  const cuerpo = await respuestaConsulta.json();
  expect(cuerpo.ok).toBe(true);
  expect(cuerpo.radicado.fueRespondido).toBe(true);
});
