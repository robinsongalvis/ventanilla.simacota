/* ══════════════════════════════════════════════════════════════
   Ampliación del gate de rendimiento a onSnapshot de lib/hooks/** (Roadmap
   P1.5, ADR-0011)

   Hallazgo que motiva esta ampliación: el gate original
   (`scripts/laboratorio/presupuesto-rendimiento.mjs`) solo barre lecturas
   de la colección `ventanilla_radicados`. `lib/hooks/useSalidas.ts` hacía
   `onSnapshot` + `orderBy` SIN `limit()`/ventana sobre `ventanilla_salidas`
   — mismo antipatrón O(N) de R11, pero sobre otra colección, así que el
   gate original lo dejaba pasar en VERDE (falso verde).

   Prueba el DETECTOR puro (`detectarSuscripcionesOnSnapshotEnContenido`,
   opera sobre contenido en memoria, sin tocar el filesystem real).
══════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  detectarSuscripcionesOnSnapshotEnContenido,
  claveHook,
  REGISTRO_HOOKS,
} from '@/scripts/laboratorio/presupuesto-rendimiento.mjs';

describe('detectarSuscripcionesOnSnapshotEnContenido', () => {
  it('caso sintético SIN cota: onSnapshot + orderBy sin limit() se marca como NO acotada', () => {
    const contenido = `
'use client';
export function useAlgo() {
  const q = query(
    collection(getDb(), 'alguna_coleccion'),
    orderBy('fecha', 'desc'),
  );
  const unsub = onSnapshot(q, () => {});
  return unsub;
}
`;
    const hallazgos = detectarSuscripcionesOnSnapshotEnContenido(contenido, 'lib/hooks/useAlgo.ts');
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].coleccion).toBe('alguna_coleccion');
    expect(hallazgos[0].acotada).toBe(false);
  });

  it('caso sintético CON cota: onSnapshot + limit() en la ventana de construcción se acepta como acotada', () => {
    const contenido = `
'use client';
export function useAlgo() {
  const constraints = [];
  constraints.push(where('fecha', '>=', cutoff));
  constraints.push(orderBy('fecha', 'desc'));
  constraints.push(limit(500));
  const q = query(collection(getDb(), 'alguna_coleccion'), ...constraints);
  const unsub = onSnapshot(q, () => {});
  return unsub;
}
`;
    const hallazgos = detectarSuscripcionesOnSnapshotEnContenido(contenido, 'lib/hooks/useAlgo.ts');
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].coleccion).toBe('alguna_coleccion');
    expect(hallazgos[0].acotada).toBe(true);
  });

  it('cota declarada ANTES de collection(...) (patrón real: constraints construidas antes de query()) también se reconoce', () => {
    // Mismo orden real de useVentanillaRadicados/useSalidas: limit() se
    // empuja al arreglo de constraints antes de que aparezca la línea
    // `collection(...)` dentro de `query(...)`.
    const contenido = `
export function useAlgo() {
  const constraints = [];
  constraints.push(limit(500));
  const q = query(collection(getDb(), 'otra_coleccion'), ...constraints);
  const unsub = onSnapshot(q, () => {});
  return unsub;
}
`;
    const hallazgos = detectarSuscripcionesOnSnapshotEnContenido(contenido, 'lib/hooks/useAlgo.ts');
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].acotada).toBe(true);
  });

  it('archivo sin onSnapshot: no reporta hallazgos', () => {
    const contenido = `export function useNada() { return getDocs(query(collection(getDb(), 'x'))); }`;
    expect(detectarSuscripcionesOnSnapshotEnContenido(contenido, 'lib/hooks/useNada.ts')).toHaveLength(0);
  });
});

describe('REGISTRO_HOOKS — cobertura de las suscripciones reales del repo', () => {
  it('useSalidas.ts está clasificada ACOTADA (Roadmap P1.5: acotó ventana + limit)', () => {
    const entrada = REGISTRO_HOOKS.find((r) => r.archivo === 'lib/hooks/useSalidas.ts');
    expect(entrada).toBeDefined();
    expect(entrada?.estado).toBe('ACOTADA');
    expect(entrada?.coleccion).toBe('ventanilla_salidas');
  });

  it('claveHook agrupa por archivo+colección de forma estable', () => {
    expect(claveHook('a.ts', 'x')).toBe('a.ts::x');
    expect(claveHook('a.ts', null)).toBe('a.ts::(colección dinámica)');
  });
});
