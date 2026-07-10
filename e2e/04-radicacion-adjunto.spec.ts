import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico } from './helpers';
import { USUARIOS_LAB } from './env';

/**
 * Escenario (d) — radicación con ADJUNTO. Marcado por el coordinador como
 * brecha prioritaria: la auditoría manual del 2026-07-09 NO cubrió el
 * flujo de adjuntos (`RadicacionFuncionarioForm` → `subirArchivos` →
 * Firebase Storage → `radicado.archivos`). Este es el primer chequeo
 * automatizado de esa ruta.
 *
 * El PDF es un documento mínimo pero válido (cabecera `%PDF-` real) para
 * pasar tanto el filtro de tipo del formulario como cualquier validación
 * de firma binaria aguas abajo (lib/seguridad/magic-bytes.ts).
 *
 * ── HALLAZGO (bloqueante, no es un bug del test) ──────────────────────
 * El bucket de Storage de STAGE (`ventanilla-simacota-stage.firebasestorage.app`)
 * no tiene CORS configurado para aceptar subidas desde un origen web
 * (probado desde http://localhost:3000, el mismo origen que usa
 * `dev:stage`). La subida se queda colgada para siempre: el botón nunca
 * sale de "Radicando…" y el radicado NUNCA se crea (subirArchivos ocurre
 * ANTES del setDoc del radicado — lib/actions/radicarVentanilla.ts
 * líneas 199-204 vs 332 — así que este bug bloquea el 100% de las
 * radicaciones con adjunto en este entorno, no solo el test).
 *
 * Reproducción manual: login como recepcionista.lab, abrir "Radicación
 * Rápida", adjuntar cualquier PDF, llenar el resto y enviar. La consola
 * del navegador muestra:
 *   Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/
 *   v0/b/ventanilla-simacota-stage.firebasestorage.app/o?name=...' from
 *   origin 'http://localhost:3000' has been blocked by CORS policy:
 *   Response to preflight request doesn't pass access control check.
 *
 * Hallazgo secundario relacionado: `generarRadicadoInstitucional`
 * (lib/radicado-institucional.ts ~L33-40) incrementa el consecutivo
 * institucional en una transacción ANTES de que exista certeza de que el
 * radicado se va a terminar de crear. Con el adjunto colgado para
 * siempre, ese consecutivo queda consumido sin que exista jamás un
 * radicado con ese número — un hueco en la numeración AGN 060/2001 cada
 * vez que alguien intente adjuntar algo en este entorno. No confirmado
 * en producción (bucket distinto, posiblemente con CORS sí configurado);
 * se reporta como hipótesis a verificar, no como hecho.
 *
 * Severidad: ALTA (bloquea una función completa del producto en STAGE;
 * el riesgo de huecos de numeración es política/legalmente sensible).
 * Rol que corrige: `devops` (CORS del bucket de Storage) — posible
 * seguimiento de `dev-backend` para el hueco de numeración si el hallazgo
 * secundario se confirma en producción.
 */
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
  'xref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
  'utf8',
);

test.fixme('radicación con adjunto: el archivo queda asociado al radicado', async ({ browser, registrarRadicadoDePrueba }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003006');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Adjunto');
  await page.getByLabel('Asunto').fill(asuntoUnico('Radicación con adjunto'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — brecha prioritaria: flujo de adjuntos.',
  );

  const nombreArchivo = `e2e-adjunto-${Date.now()}.pdf`;
  await page.locator('input[type="file"]').setInputFiles({
    name: nombreArchivo,
    mimeType: 'application/pdf',
    buffer: PDF_MINIMO,
  });
  await expect(page.getByText(nombreArchivo)).toBeVisible();

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);

  // Reabrir el radicado recién creado y verificar que el archivo quedó
  // asociado en la pestaña Información (radicado.archivos, page.tsx ~2613).
  await page.goto(`/interno/dashboard?radicadoId=${encodeURIComponent(radicadoId)}`);
  await expect(page.getByText('Archivos adjuntos (1)')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(nombreArchivo)).toBeVisible();

  await ctx.close();
});
