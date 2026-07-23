/* ══════════════════════════════════════════════════════════════
   Pieza angular (P2.1) — Fase 3: bifurcación del kill-switch.

   Único punto donde `app/interno/dashboard/page.tsx` decide qué camino de
   radicación institucional invocar. Se extrae del componente (en vez de
   escribir el `if` inline en `handleSubmit`) por una sola razón:
   testabilidad — `DrawerNuevoRadicado` no se exporta y el dashboard es un
   God component sin arnés de render (ver
   `__tests__/dashboard-modo-amplio-radicados.test.ts`, que ya prueba el
   archivo por inspección de texto, no por render). Sacar SOLO esta
   decisión de 2 líneas a una función nombrada permite un test de
   comportamiento real con mocks en la frontera
   (`__tests__/radicar-segun-flag.test.ts`) sin tocar la estructura del
   componente — no es el refactor del God component que el encargo de
   Fase 3 prohíbe (eso sigue intacto: hooks, JSX, estado, todo igual).

   El caller (`app/interno/dashboard/page.tsx`, línea ~3444) cambia una
   sola línea: `radicarInstitucionalmente(...)` → `radicarSegunFlag(...)`,
   mismos argumentos, mismo tipo de retorno.
══════════════════════════════════════════════════════════════ */
import {
  radicarInstitucionalmente,
  type ActorRadicacion,
  type DatosRadicacionInstitucional,
  type ResultadoRadicacion,
} from '@/lib/actions/radicarVentanilla';
import { USA_RADICACION_INTERNA_SERVER } from '@/lib/recepcion/radicacion-interna-flag';
import { radicarInternaCliente } from '@/lib/recepcion/radicar-interna-cliente';

/**
 * Con el switch en `false` (producción, hoy): camino legado INTACTO —
 * `radicarInstitucionalmente` (cliente Firestore). Con el switch en
 * `true` (Fase 3 en adelante, tras el cutover del propietario): camino
 * nuevo — `radicarInternaCliente` (fetch a `/api/radicacion/interna`).
 */
export async function radicarSegunFlag(
  datos: DatosRadicacionInstitucional,
  actor: ActorRadicacion,
  onProgress: (mensaje: string, pct: number) => void = () => {},
): Promise<ResultadoRadicacion> {
  if (USA_RADICACION_INTERNA_SERVER) {
    return radicarInternaCliente(datos, onProgress);
  }
  return radicarInstitucionalmente(datos, actor, onProgress);
}
