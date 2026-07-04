import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

/**
 * Sprint Radicación de salida — serie propia de correspondencia
 * DESPACHADA por la administración.
 *
 * Dos series amarradas (decisión aprobada): la entrada conserva su
 * formato `1-{CANAL}-{AÑO}-{NNNNNNNN}` intacto; la salida estrena la
 * serie `2-SAL-{AÑO}-{NNNNNNNN}` con contador anual propio
 * (`counters/salidas-{año}`), misma mecánica transaccional del
 * consecutivo de entrada. Así el libro de salidas es una serie
 * continua auditable — sin huecos ni duplicados — y el amarre
 * entrada↔salida vive en el documento y la trazabilidad, no en el
 * número.
 */

export function formatearRadicadoSalida(
  consecutivo: number,
  fecha = new Date(),
): string {
  const year = fecha.getFullYear();
  return `2-SAL-${year}-${String(consecutivo).padStart(8, '0')}`;
}

export async function generarRadicadoSalida(
  fecha = new Date(),
): Promise<{ consecutivo: number; salidaId: string }> {
  const db = getDb();
  const year = fecha.getFullYear();
  const counterRef = doc(db, 'counters', `salidas-${year}`);

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
      salidaId: formatearRadicadoSalida(siguiente, fecha),
    };
  });
}
