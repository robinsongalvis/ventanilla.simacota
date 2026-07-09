import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from './firebase';

/**
 * Sprint Número con oficina radicadora — decisión del usuario con la
 * ingeniera MIPG (jul 2026): el número de radicado lleva el código TRD
 * de la oficina RADICADORA, como el sistema anterior del municipio.
 *
 * `110` = Secretaría General y Gobierno, dueña orgánica de la
 * Ventanilla Única según la TRD. NO es la oficina destino: por eso el
 * número jamás "miente" cuando el radicado se traslada — identifica
 * quién radicó, no quién tramita. El destino, el área y la serie
 * documental viven en la clasificación (que sí se actualiza con
 * constancia en la trazabilidad).
 *
 * Reglas que este número respeta:
 * - Acuerdo AGN 060/2001 art. 5: números sin enmiendas ni correcciones
 *   → el número nunca se reescribe (los históricos 1-WEB-… /
 *   1-PRESENCIAL-… conservan el suyo).
 * - Ley 1755/2015: los términos corren desde la radicación original.
 * - El consecutivo anual continúa: solo cambia la máscara.
 */
export const CODIGO_OFICINA_RADICADORA = '110';

export function formatearRadicadoInstitucional(
  consecutivo: number,
  fecha = new Date(),
): string {
  const year = fecha.getFullYear();
  return `1-${CODIGO_OFICINA_RADICADORA}-${year}-${String(consecutivo).padStart(8, '0')}`;
}

export async function generarRadicadoInstitucional(
  fecha = new Date(),
): Promise<{ consecutivo: number; radicadoId: string }> {
  const db = getDb();
  const year = fecha.getFullYear();
  const counterRef = doc(db, 'counters', `radicados-${year}`);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const actual = snap.exists() ? Number(snap.data().ultimo ?? 0) : 0;
    const siguiente = actual + 1;

    transaction.set(
      counterRef,
      {
        ultimo: siguiente,
        anio: year,
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true },
    );

    return {
      consecutivo: siguiente,
      radicadoId: formatearRadicadoInstitucional(siguiente, fecha),
    };
  });
}
