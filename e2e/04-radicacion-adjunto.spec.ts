import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, crearPdfValido } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (d) — radicación con ADJUNTO. Marcado por el coordinador como
 * brecha prioritaria: la auditoría manual del 2026-07-09 NO cubrió el
 * flujo de adjuntos (`RadicacionFuncionarioForm` → `subirArchivos` →
 * Firebase Storage → `radicado.archivos`).
 *
 * ── Revisitado en Batch B (2026-07-10) ──────────────────────────────────
 * Primera entrega: `test.fixme` — el bucket de Storage de STAGE no estaba
 * aprovisionado (causa raíz real, no CORS como se documentó entonces; ver
 * hallazgo corregido en la bitácora). Corregido por devops en sesión
 * paralela: Storage activo, reglas desplegadas, subida verificada
 * end-to-end (403→200). Este test vuelve a ejercitar el flujo real de
 * subida por navegador — SIN debilitar la aserción original: sigue
 * verificando que el archivo queda asociado al radicado, ahora con un PDF
 * genuinamente válido (`crearPdfValido`, pdf-lib) en vez del PDF "a mano"
 * de la primera versión — ese PDF pasaba la firma binaria
 * (magic-bytes.ts) pero no era parseable de verdad, lo que habría
 * contaminado el hallazgo del escenario 14 (sellado) si se reutilizaba ahí.
 */
test('radicación con adjunto: el archivo queda asociado al radicado', async ({ browser, registrarRadicadoDePrueba }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003006');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Adjunto');
  await page.getByLabel('Asunto').fill(asuntoUnico('Radicación con adjunto'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — flujo de adjuntos (Storage ya aprovisionado en stage).',
  );

  const nombreArchivo = `e2e-adjunto-${Date.now()}.pdf`;
  const pdfBuffer = await crearPdfValido(`Adjunto de prueba E2E — ${nombreArchivo}`);
  await page.locator('input[type="file"]').setInputFiles({
    name: nombreArchivo,
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });
  await expect(page.getByText(nombreArchivo)).toBeVisible();

  // La subida real a Storage ocurre ANTES del setDoc del radicado
  // (lib/actions/radicarVentanilla.ts ~199-204 vs 332) — con Storage
  // funcionando esto ya no cuelga, pero puede tomar más que el timeout
  // por defecto de `enviarRadicacionRapida` en una subida real (vs. el
  // clic instantáneo de las radicaciones sin adjunto de otros escenarios).
  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);

  // Reabrir el radicado recién creado y verificar que el archivo quedó
  // asociado en la pestaña Información (radicado.archivos, page.tsx ~2613).
  await page.goto(`/interno/dashboard?radicadoId=${encodeURIComponent(radicadoId)}`);
  await expect(page.getByText('Archivos adjuntos (1)')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(nombreArchivo)).toBeVisible();

  await ctx.close();
});
