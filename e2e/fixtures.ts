import { test as base, expect } from '@playwright/test';
import { marcarRadicadoDePrueba } from './lab-admin';

/**
 * Fixture de teardown para el marcado `isTest` (hallazgo de
 * firestore-datos, 2026-07-10 — ver e2e/lab-admin.ts y FASE2_BITACORA.md).
 *
 * Cada test que radica llama `registrarRadicadoDePrueba(id)` justo
 * después de crear el radicado; el marcado real vía Admin SDK ocurre en
 * el teardown de la fixture, es decir DESPUÉS de que el `use()` del test
 * retorna — pase o falle el test. Esto es deliberado y no un detalle de
 * implementación: si se marcara `isTest` en el momento de crear, el resto
 * del propio test (Bandeja, Tablero, Mi gestión) dejaría de ver el
 * radicado, porque `useVentanillaRadicados` filtra `isTest` del lado
 * cliente. El teardown garantiza que el marcado ocurra sin interferir
 * con los pasos de UI que ya corrieron dentro del mismo test, y corre
 * incluso si el test falla a mitad de camino (el radicado ya existe en
 * ese punto y de todas formas debe quedar marcado).
 */
type FixturesLaboratorio = {
  registrarRadicadoDePrueba: (radicadoId: string) => void;
};

export const test = base.extend<FixturesLaboratorio>({
  registrarRadicadoDePrueba: async ({}, use) => {
    const idsCreados: string[] = [];
    await use((radicadoId: string) => { idsCreados.push(radicadoId); });

    for (const id of idsCreados) {
      try {
        await marcarRadicadoDePrueba(id);
        console.log(`[lab-admin] Marcado isTest=true en ${id}`);
      } catch (err) {
        // No se rompe el resultado del test por esto — pero SÍ queda en
        // el log del runner para que quede evidencia del radicado huérfano
        // (candidato a barrido retroactivo, ver e2e/marcar-retroactivo.mjs).
        console.error(`[lab-admin] No se pudo marcar isTest en ${id}:`, err);
      }
    }
  },
});

export { expect };
