import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from './firebase';
import { periodoColombia } from './fecha-colombia';
import { CONTINGENCIA_STORAGE_ACTIVA } from './recepcion/contingencia-storage';

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
 *
 * ADR-0024 (2026-07-15, decisión del propietario): el tercer segmento pasa
 * de `{AAAA}` a `{AAAAMM}` para alinear el id con el formato del sistema
 * legado municipal que los funcionarios ya conocen (continuidad
 * institucional; evidencia = planilla física real). El consecutivo SIGUE
 * SIENDO ANUAL — AGN 060/2001 exige una serie anual continua; el mes es
 * solo informativo en el id, no reinicia la numeración. El contador
 * (`counters/radicados-{año}`) y el helper transaccional
 * (`lib/server/consecutivo-legal.ts`) no cambian: siguen indexando por año
 * puro, calculado en America/Bogota (ADR-0043), igual que la máscara.
 * Los ids anteriores a este cambio (`1-110-{AAAA}-…`) siguen existiendo tal
 * cual — nunca se reescriben — y todo consumidor que los lea debe seguir
 * aceptándolos (ver `lib/seguridad/consulta-publica-radicado.ts` y
 * `scripts/laboratorio/detectar-consecutivos-fantasma.mjs`).
 */
export const CODIGO_OFICINA_RADICADORA = '110';

export function formatearRadicadoInstitucional(
  consecutivo: number,
  fecha = new Date(),
): string {
  const { anio: year, mes } = periodoColombia(fecha);
  return `1-${CODIGO_OFICINA_RADICADORA}-${year}${mes}-${String(consecutivo).padStart(8, '0')}`;
}

export async function generarRadicadoInstitucional(
  fecha = new Date(),
): Promise<{ consecutivo: number; radicadoId: string }> {
  if (CONTINGENCIA_STORAGE_ACTIVA) {
    throw new Error('En contingencia solo la radicación interna autenticada puede emitir un consecutivo.');
  }
  const db = getDb();
  const { anio: year } = periodoColombia(fecha);
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
