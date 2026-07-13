/**
 * REPRODUCCIÓN — Bloque 1 (Escenario B v2) · ADR-0015 mandato #3
 * Hallazgo H3: el consecutivo legal (Acuerdo AGN 060/2001) NO es atómico con la
 * persistencia del radicado. Un fallo entre la asignación del consecutivo y la
 * escritura del documento deja un número consumido sin radicado ("fantasma").
 *
 * ESTA PRUEBA ESTÁ DISEÑADA PARA FALLAR (rojo) mientras H3 no esté corregido.
 * Pasará a verde exactamente cuando la asignación del consecutivo y la escritura
 * del radicado sean atómicas (o se compensen). Es el control de regresión del fix.
 *
 * Fidelidad (por qué NO es circular):
 *  - Ejecuta la orquestación REAL `radicarInstitucionalmente`
 *    (lib/actions/radicarVentanilla.ts): generar consecutivo (:197) → subir
 *    archivos (:200-202) → setDoc del radicado (:332). No reimplementa el flujo.
 *  - Solo se mockean las FRONTERAS externas:
 *      · generarRadicadoInstitucional — modela fielmente lib/radicado-institucional.ts:40-59,
 *        donde el contador se incrementa en su PROPIA transacción y se confirma
 *        antes de devolver, SIN escribir ningún radicado (commit irreversible).
 *      · subirArchivos — falla, reproduciendo el escenario observado en STAGE
 *        (docs/laboratorio/FASE2_BITACORA.md: la subida falló tras consumir el
 *        consecutivo y antes del setDoc → "consecutivos fantasma").
 *      · setDoc/addDoc — registran en un almacén en memoria. NINGÚN Firebase real
 *        ni emulador se toca (el emulador no corre localmente: Java 8, requiere 21).
 *
 * Limitación declarada (ADR-0015, separación hecho/estimación): esta es una
 * reproducción del MECANISMO del defecto (orden + no compensación) en Node, no una
 * corrida de integración contra Firestore. La reproducción canónica de integración
 * contra el emulador (Java 21) se especifica para CI en la evidencia del bloque.
 *
 * ── Alcance y salvedades (revisión cruzada 6/6, 2026-07-13) ──
 *  · Alcance (backend): cubre la ruta INTERNA `radicarInstitucionalmente`
 *    (SDK cliente). Las rutas Admin SDK — `app/api/radicacion` (con su propia
 *    `generarRadicadoInstitucionalAdmin`), `registro-expres`, `salidas/registrar`,
 *    `planillas/generar` — tienen la MISMA clase de defecto con fronteras distintas
 *    y requieren su propia reproducción. H3 queda REPRODUCIDO solo para la ruta interna.
 *  · Invariante (firestore/backend/qa): la invariante del SISTEMA es "ningún
 *    consecutivo confirmado sin su documento" (no-huérfano, por-radicado), NO la
 *    igualdad de cardinalidad `size===ultimo` (que no generaliza a contador anual
 *    ni a resets). Este test la asevera en forma por-radicado.
 *  · Para el FIX (no ahora): además debe (a) asegurar integridad — adjuntos
 *    presentes o compensación explícita del contador (backend); (b) probar también
 *    fallo en el propio `setDoc`, no solo en `subirArchivos` (qa); (c) el cierre de
 *    H3 exige corrida VERDE de este test + verificación de integración contra el
 *    emulador real (Java 21, `ci.yml` job `laboratorio-emulador`) — devops/qa.
 *  · Normativa (gobierno-digital): el Acuerdo AGN 060/2001 art. 5 admite DOS
 *    remedios — atomicidad O constancia automática del número anulado. Este test
 *    fija la invariante del primero; no descarta el segundo.
 */
import { describe, it, expect, vi } from 'vitest';
import { setDoc } from 'firebase/firestore';

/** Estado en memoria que modela los dos artefactos Firestore del flujo. */
const contador = { ultimo: 0 };
const radicadosPersistidos = new Map<string, unknown>();

vi.mock('@/lib/radicado-institucional', () => ({
  generarRadicadoInstitucional: vi.fn(async () => {
    // Fiel a lib/radicado-institucional.ts:40-59: el contador se confirma
    // (commit) en su propia transacción y se devuelve; es irreversible desde
    // el resto del flujo. No se escribe ningún radicado en esta transacción.
    contador.ultimo += 1;
    const consecutivo = contador.ultimo;
    return {
      consecutivo,
      radicadoId: `1-110-2026-${String(consecutivo).padStart(8, '0')}`,
    };
  }),
}));

vi.mock('@/lib/storage', () => ({
  subirArchivos: vi.fn(async () => {
    // Escenario STAGE (FASE2_BITACORA.md): la subida falla DESPUÉS de consumido
    // el consecutivo y ANTES del setDoc del radicado.
    throw new Error('fallo de red al subir adjunto');
  }),
}));

vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn(async (ref: { id: string }, data: unknown) => {
    radicadosPersistidos.set(ref.id, data);
  }),
  addDoc: vi.fn(async () => ({ id: 'trz' })),
  doc: (_db: unknown, _col: string, id: string) => ({ id }),
  collection: () => ({ id: 'col' }),
}));

vi.mock('@/lib/firebase', () => ({ getDb: () => ({}) }));

import {
  radicarInstitucionalmente,
  type DatosRadicacionInstitucional,
  type ActorRadicacion,
} from '@/lib/actions/radicarVentanilla';

// Solo importan los campos usados ANTES del punto de fallo (validación + archivos);
// el resto no se alcanza porque subirArchivos lanza en la línea :201.
const datos = {
  noAportaCorreo: false,
  archivos: [{} as unknown as File],
} as unknown as DatosRadicacionInstitucional;

const actor = {
  uid: 'u1',
  nombre: 'Recepción',
  tenantId: 'VENTANILLA_UNICA',
} as unknown as ActorRadicacion;

describe('H3 — no atomicidad del consecutivo (reproducción, ADR-0015 #3)', () => {
  it('todo consecutivo consumido debe tener su radicado persistido (rojo hasta el fix)', async () => {
    await expect(radicarInstitucionalmente(datos, actor)).rejects.toThrow(
      'fallo de red',
    );

    // Mecanismo del defecto:
    const consecutivoConsumido = contador.ultimo;
    expect(consecutivoConsumido).toBeGreaterThan(0); // el consecutivo SÍ se consumió
    expect(setDoc).not.toHaveBeenCalled(); // el radicado NO se persistió

    // INVARIANTE DEL SISTEMA (no-huérfano, por-radicado): todo consecutivo
    // confirmado debe tener su documento persistido. El fix atómico debe
    // garantizarla. HOY está VIOLADA → rojo: el número 1-110-2026-00000001 se
    // consumió pero su documento no existe (fantasma).
    const idEsperado = `1-110-2026-${String(consecutivoConsumido).padStart(8, '0')}`;
    expect(radicadosPersistidos.has(idEsperado)).toBe(true);
  });
});
