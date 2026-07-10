import { expect, type Page } from '@playwright/test';
import { LAB_PASSWORD } from './env';

/** Prefijo obligatorio (encargo QA) para poder re-correr la suite contra
 *  stage repetidamente sin ambigüedad sobre qué radicados son sintéticos. */
export const PREFIJO_E2E = '[E2E-AUTO]';

/** `1-110-{año}-{########}` — formato institucional vigente (AGN 060/2001 +
 *  Ley 1755/2015), verificado en lib/seguridad/consulta-publica-radicado.ts. */
export const RE_NUMERO_RADICADO = /^1-110-\d{4}-\d{8}$/;

export function asuntoUnico(etiqueta: string): string {
  return `${PREFIJO_E2E} ${etiqueta} ${Date.now()}`;
}

/** Inicia sesión en /interno/login y espera a que el panel cargue. */
export async function login(page: Page, email: string): Promise<void> {
  // Hallazgo de esta suite (ver bitácora): al montar el dashboard, un
  // `useEffect` pide `/api/interno/resumen-diario` y si `data.mostrar` es
  // true abre el modal "Resumen del día" en overlay `z-50` — puede resolver
  // en CUALQUIER momento tras el login, incluso a mitad de otra interacción
  // ya en curso (llenar el formulario, clic en "Registrar radicado"...), y
  // su backdrop intercepta clics de cualquier otro control (page.tsx
  // ~4364-4377). `addLocatorHandler` es la respuesta correcta de Playwright
  // a interstitials impredecibles: se registra una vez por página y
  // Playwright lo dispara automáticamente — antes de CUALQUIER acción
  // bloqueada por ese overlay, durante el resto de la vida de esta página—
  // en vez de depender de una ventana de espera fija que puede perder la
  // carrera (como ocurrió en la primera versión de este helper).
  //
  // El botón "Cerrar" DENTRO de la tarjeta (ResumenDiarioModal.tsx ~248),
  // no el backdrop `fixed inset-0` que cubre toda la pantalla: el backdrop
  // resuelve como clicable pero su centro (donde Playwright apunta por
  // defecto) cae bajo la tarjeta del propio modal — un clic ahí queda
  // interceptado por la tarjeta para siempre (bucle de reintentos sin fin,
  // reproducido en la primera versión de este helper).
  await page.addLocatorHandler(
    page.getByRole('dialog', { name: 'Resumen del día' }).getByRole('button', { name: 'Cerrar', exact: true }),
    async (boton) => { await boton.click(); },
  );

  await page.goto('/interno/login');
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(LAB_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar al Panel' }).click();
  await page.waitForURL('**/interno/dashboard**', { timeout: 15_000 });
  // El layout hace una segunda verificación de sesión antes de soltar el
  // spinner "Verificando sesion..."; esperar a que desaparezca evita
  // interactuar con el DOM a medio montar.
  await expect(page.getByText('Verificando sesion...')).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Abre el modal "Radicación Rápida" desde el sidebar (recepcionista/admin)
 * y completa los campos comunes a Presentación IDENTIFICADA y ANÓNIMA.
 * Deja el formulario listo para que el llamador ajuste presentación,
 * destino o adjuntos antes de enviar.
 */
export async function abrirRadicacionRapida(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Radicación Rápida' }).click();
  await expect(page.getByRole('heading', { name: 'Radicación Rápida' })).toBeVisible();
}

export async function enviarRadicacionRapida(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Registrar radicado' }).click();
  await expect(page.getByText('Radicado registrado')).toBeVisible({ timeout: 20_000 });
  // El dashboard vivo detrás del modal (KPIs, "Trabajo de hoy"...) también
  // muestra números de radicado — un getByText global es ambiguo. El único
  // <p> que es HERMANO INMEDIATO de la etiqueta "Radicado registrado" es el
  // número recién creado (page.tsx ~3486); el mismo número repetido en la
  // vista previa de la constancia (más abajo en el modal) no lo es.
  const numero = page.locator('p:has-text("Radicado registrado") + p');
  await expect(numero).toBeVisible();
  const texto = (await numero.textContent())?.trim() ?? '';
  expect(texto).toMatch(RE_NUMERO_RADICADO);
  return texto;
}

export async function cerrarModalRadicacion(page: Page): Promise<void> {
  // exact: true — "Cerrar modal" es substring de la X del header
  // ("Cerrar modal de radicación rápida"); sin exact, ambiguo.
  await page.getByRole('button', { name: 'Cerrar modal', exact: true }).click();
}

/**
 * Va a la vista "Bandeja" (nav lateral). El nombre accesible del botón del
 * sidebar ("Bandeja" o "Bandeja N" con contador) también es substring de
 * los botones de filtro DENTRO de esa misma vista ("Filtrar bandeja por
 * Vencidas...", etc.) — hay que escopar al landmark `nav` del sidebar,
 * no al botón por nombre suelto.
 */
export async function irABandeja(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: 'Bandeja' }).click();
  await expect(page.getByRole('heading', { name: 'Bandeja de Asignación' })).toBeVisible();
}
