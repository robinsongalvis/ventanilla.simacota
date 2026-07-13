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
    expect(contador.ultimo).toBe(1); // el consecutivo SÍ se consumió (irreversible)
    expect(setDoc).not.toHaveBeenCalled(); // el radicado NO se persistió

    // INVARIANTE que el fix atómico debe garantizar; HOY está VIOLADA → rojo.
    // "Todo consecutivo consumido tiene su radicado": size(0) === contador(1) es FALSO.
    // El número 1-110-2026-00000001 quedó como consecutivo fantasma.
    expect(radicadosPersistidos.size).toBe(contador.ultimo);
  });
});
