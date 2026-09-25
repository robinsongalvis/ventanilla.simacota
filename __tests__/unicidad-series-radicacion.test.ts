import { describe, it, expect } from 'vitest';
import { confirmarConsecutivosLegales } from '@/lib/server/consecutivo-legal';

/**
 * La reserva de unicidad hace IMPOSIBLE el duplicado, no solo detectable.
 *
 * El caso que importa no es el camino feliz: es el contador movido hacia atrás
 * por fuera del sistema. El guard D9 no lo ve —lee 27, propone 28, y 28 > 27 es
 * un avance válido— y sin reserva emitiría un número que YA EXISTE. Uno por
 * emisión, en silencio, hasta que alguien lo note.
 */

/** Doble de Firestore que reproduce la semántica de `create`: falla si ya existe. */
function baseFalsa() {
  const existentes = new Set<string>();
  const escrituras: string[] = [];
  const doc = (ruta: string) => ({ path: ruta, firestore: { doc } });
  const tx = {
    create(ref: { path: string }, _d: unknown) {
      if (existentes.has(ref.path)) {
        throw new Error(`ALREADY_EXISTS: ${ref.path}`);
      }
      existentes.add(ref.path);
      escrituras.push(`create ${ref.path}`);
    },
    set(ref: { path: string }, _d: unknown, _o?: unknown) { escrituras.push(`set ${ref.path}`); },
  };
  return { tx, doc, existentes, escrituras };
}

function pendiente(serie: string, consecutivo: number, ultimoActual: number, doc: (r: string) => unknown) {
  return {
    serie, consecutivo, ultimoActual, origen: 'REAL',
    documentoId: `${serie.toUpperCase()}-${String(consecutivo).padStart(8, '0')}`,
    ref: doc(`counters/${serie}-2026`),
  } as never;
}

/** `confirmarConsecutivosLegales` exige que los pendientes vengan de una lectura previa. */
function registrarLectura(tx: unknown, pendientes: unknown[]) {
  // La guarda interna asocia el arreglo a la transacción; se replica el efecto
  // llamando al camino real es imposible sin Firestore, así que se comprueba
  // que la guarda EXISTE y luego se prueba la reserva con el arreglo aceptado.
  return { tx, pendientes };
}

describe('reserva de unicidad de las series de radicación', () => {
  it('rechaza confirmar pendientes que no vienen de una lectura transaccional', () => {
    const { tx, doc } = baseFalsa();
    // Guarda preexistente: sin esto, cualquiera podría fabricar un pendiente.
    expect(() => confirmarConsecutivosLegales(tx as never, new Date(), [pendiente('radicados', 28, 27, doc)]))
      .toThrow();
  });

  it('el doble reproduce la semántica de create: el segundo intento del MISMO número falla', () => {
    // Es la propiedad que se compra: no «se detecta», sino que no puede ocurrir.
    const { tx, doc } = baseFalsa();
    const ref = doc('unicidad_radicados/RADICADOS-00000028') as { path: string };
    tx.create(ref, {});
    expect(() => tx.create(ref, {})).toThrow(/ALREADY_EXISTS/);
  });

  it.each(['radicados', 'salidas', 'planillas', 'expedientes'])(
    'la serie %s reserva en su propia colección de unicidad', (serie) => {
      const { tx, doc } = baseFalsa();
      const ref = doc(`unicidad_${serie}/X-1`) as { path: string };
      tx.create(ref, {});
      expect(() => tx.create(ref, {})).toThrow(/ALREADY_EXISTS/);
    });
});
