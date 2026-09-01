import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/* El escudo institucional para los sellos y carátulas. Extraído del sello de
   ventanilla (1-sep-2026) cuando el propietario cazó que NI el sello de
   licencias por documento NI el paquete lo pasaban: dos rutas llamaban a
   `sellarTodasLasPaginas` sin `logoPng` y el papel salía sin escudo. Una sola
   función para que la próxima ruta no pueda olvidarlo a su manera. */
/* DOS VARIANTES DEL MISMO LOCKUP (1-sep-2026, cazado por el propietario en
   el papel): la original tiene el wordmark BLANCO — hecha para la barra verde
   del panel, fantasma sobre papel blanco. La variante -print lleva el wordmark
   en gris institucional (#58595B) y es la que va a sellos y carátulas. La
   original queda intacta: la barra del panel la necesita blanca. */
export const LOGO_PROJECT_PATH = 'public/brand/logo-alcaldia-simacota-print.png';
const LOGO_RESPALDO = 'public/brand/logo-alcaldia-simacota.png';

export async function cargarLogo(): Promise<Uint8Array | null> {
  for (const ruta of [LOGO_PROJECT_PATH, LOGO_RESPALDO]) {
    try {
      const buf = await readFile(join(process.cwd(), ruta));
      return new Uint8Array(buf);
    } catch { /* siguiente */ }
  }
  // Sin logo el sello igual sale — generar-sello-pdf.ts lo tolera.
  return null;
}
