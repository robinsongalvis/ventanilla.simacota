import { describe, it, expect } from 'vitest';
import { canOperateTenant } from '@/lib/server/internal-auth';
import { canOperateTenant as replica } from '@/e2e/rules/support/fase3-stub-internal-auth.mjs';
import type { TenantId } from '@/src/types/radicado';

/**
 * El arnés del emulador sustituye `@/lib/server/internal-auth` entero, así que
 * tiene su propia copia de `canOperateTenant`. Una réplica que se desincroniza
 * hace que las pruebas del emulador autoricen distinto que producción — y el
 * fallo aparecería como «la prueba pasa pero en producción da 403», o peor,
 * al revés.
 *
 * Mismo criterio que `abrir-series-coherente.test.ts` con la otra réplica.
 */
const ROLES = ['ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO'];
const TENANTS: TenantId[] = ['VENTANILLA_UNICA', 'SEC_PLANEACION'];

describe('la réplica de canOperateTenant del arnés no se desvía de la real', () => {
  it.each(ROLES)('rol %s: mismo veredicto para cada combinación de tenants', (rol) => {
    for (const propio of TENANTS) {
      for (const objetivo of TENANTS) {
        const sesion = { uid: 'u', email: 'u@x', nombre: 'U', rol, tenantId: propio, activo: true };
        expect(replica(sesion, objetivo), `${rol} ${propio}→${objetivo}`)
          .toBe(canOperateTenant(sesion as never, objetivo));
      }
    }
  });
});
