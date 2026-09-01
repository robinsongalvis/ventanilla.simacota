import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/* El escudo institucional para los sellos y carátulas. Extraído del sello de
   ventanilla (1-sep-2026) cuando el propietario cazó que NI el sello de
   licencias por documento NI el paquete lo pasaban: dos rutas llamaban a
   `sellarTodasLasPaginas` sin `logoPng` y el papel salía sin escudo. Una sola
   función para que la próxima ruta no pueda olvidarlo a su manera. */
export const LOGO_PROJECT_PATH = 'public/brand/logo-alcaldia-simacota.png';

export async function cargarLogo(): Promise<Uint8Array | null> {
  try {
    const buf = await readFile(join(process.cwd(), LOGO_PROJECT_PATH));
    return new Uint8Array(buf);
  } catch {
    // Sin logo el sello igual sale — generar-sello-pdf.ts lo tolera.
    return null;
  }
}
