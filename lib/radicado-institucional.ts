import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from './firebase';

export type CanalRadicadoInstitucional = 'WEB' | 'OFICIO' | 'EMAIL' | 'PRESENCIAL';

export function formatearRadicadoInstitucional(
  consecutivo: number,
  canal: CanalRadicadoInstitucional,
  fecha = new Date(),
): string {
  const year = fecha.getFullYear();
  return `1-${canal}-${year}-${String(consecutivo).padStart(8, '0')}`;
}

export async function generarRadicadoInstitucional(
  canal: CanalRadicadoInstitucional,
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
      radicadoId: formatearRadicadoInstitucional(siguiente, canal, fecha),
    };
  });
}

