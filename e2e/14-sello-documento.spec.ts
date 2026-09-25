import { test, expect } from './fixtures';
import { login, abrirRadicacionRapida, enviarRadicacionRapida, asuntoUnico, abrirPanelRadicado, crearPdfValido } from './helpers';
import { USUARIOS_LAB } from './env';
import { leerRadicado } from './lab-admin';

/**
 * Escenario (14, Batch B) — sello digital de documento. Ahora que Storage
 * funciona en stage (Batch B), se puede ejercitar el flujo completo:
 * `FilaArchivoConSello` → `POST /api/radicados/{id}/sellar-documento`
 * (`app/api/radicados/[radicadoId]/sellar-documento/route.ts`) descarga el
 * PDF original de Storage, estampa la primera página
 * (`lib/sello/generar-sello-pdf.ts`, pdf-lib) y sube la copia sellada a
 * `sellados/{id}/...` — cadena de custodia con hash SHA-256 de ambos.
 *
 * Requiere un PDF genuinamente válido (no solo con la firma binaria
 * correcta) porque `PDFDocument.load()` de pdf-lib SÍ lo parsea de
 * verdad — de ahí `crearPdfValido` (ver helpers.ts) en vez del PDF "a
 * mano" de la primera versión de 04-radicacion-adjunto.spec.ts.
 */
test('sello de documento: genera copia sellada con cadena de custodia', async ({
  browser,
  registrarRadicadoDePrueba,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USUARIOS_LAB.recepcionista);

  await abrirRadicacionRapida(page);
  await page.getByLabel('Tipo solicitud / doc').selectOption('PETICION_GENERAL');
  await page.getByLabel('Identificación').fill('1002003031');
  await page.getByLabel('Nombre / razón social').fill('Ciudadano E2E Sello Documento');
  await page.getByLabel('Asunto').fill(asuntoUnico('Sello de documento'));
  await page.getByLabel('Descripción').fill(
    'Prueba automatizada del auditor funcional QA — sello digital de documento (cadena de custodia).',
  );

  const nombreArchivo = `e2e-sello-${Date.now()}.pdf`;
  const pdfBuffer = await crearPdfValido(`Documento a sellar — ${nombreArchivo}`);
  await page.locator('input[type="file"]').setInputFiles({
    name: nombreArchivo,
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });

  const radicadoId = await enviarRadicacionRapida(page);
  registrarRadicadoDePrueba(radicadoId);

  await abrirPanelRadicado(page, radicadoId);
  await expect(page.getByText('Archivos adjuntos (1)')).toBeVisible({ timeout: 20_000 });

  // exact: true — "Sellar" es substring del KPI "Sin sellar (N)" del
  // Tablero detrás del panel.
  const botonSellar = page.getByRole('button', { name: 'Sellar', exact: true });
  await expect(botonSellar).toBeVisible();

  const [respuestaSello] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/sellar-documento') && r.request().method() === 'POST'),
    botonSellar.click(),
  ]);
  expect(respuestaSello.status()).toBe(200);
  const cuerpo = await respuestaSello.json();
  expect(cuerpo.ok).toBe(true);
  expect(typeof cuerpo.sello?.path).toBe('string');
  expect(typeof cuerpo.sello?.hashOriginal).toBe('string');
  expect(typeof cuerpo.sello?.hashSellado).toBe('string');

  await expect(page.getByRole('button', { name: '✓ Sellado' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('link', { name: 'Copia sellada' })).toBeVisible();

  // ── Verificación de solo lectura contra el documento real ──
  const doc = await leerRadicado(radicadoId);
  const archivo = doc?.archivos?.[0];
  expect(archivo?.nombre).toBe(nombreArchivo);
  expect(archivo?.sellado?.path).toBe(cuerpo.sello.path);
  expect(archivo?.sellado?.hashOriginal).toBe(cuerpo.sello.hashOriginal);
  expect(archivo?.sellado?.hashSellado).toBe(cuerpo.sello.hashSellado);

  await ctx.close();
});
