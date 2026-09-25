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

/* El escudo SOLO (recortado del lockup, cuadrado): es lo que va en el cuadro
   pequeño del sello. El lockup completo ahí dentro era la mancha que el
   propietario rechazó el 1-sep — por eso su respaldo es NINGUNO y no el
   lockup: mejor un sello sin escudo (tolerado) que uno ilegible. */
export const ESCUDO_PROJECT_PATH = 'public/brand/escudo-alcaldia-simacota.png';

async function leerPrimero(rutas: string[]): Promise<Uint8Array | null> {
  for (const ruta of rutas) {
    try {
      const buf = await readFile(join(process.cwd(), ruta));
      return new Uint8Array(buf);
    } catch { /* siguiente */ }
  }
  // Sin logo el sello igual sale — generar-sello-pdf.ts lo tolera.
  return null;
}

/** El lockup horizontal (escudo + wordmark) — para membretes y carátulas. */
export async function cargarLogo(): Promise<Uint8Array | null> {
  return leerPrimero([LOGO_PROJECT_PATH, LOGO_RESPALDO]);
}

/** El escudo cuadrado — para el cuadro pequeño del sello estampado. */
export async function cargarEscudo(): Promise<Uint8Array | null> {
  return leerPrimero([ESCUDO_PROJECT_PATH]);
}
