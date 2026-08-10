/**
 * Tipos de presentación para `computos`/`borradorActoDesistimiento` del
 * contrato `GET /api/licencias/expedientes/[id]` — Bloque "Términos y
 * vigencias protectores" (10-ago-2026).
 *
 * Los tipos de DOMINIO (`VencimientoDual`, `ResultadoVencimientoVigencia`)
 * ya existen en `lib/motor-expedientes/termino.ts` y `lib/motor-expedientes/
 * vigencias.ts` — pero ahí declaran sus fechas como `Date` porque son el
 * tipo de RETORNO de una función que corre en el SERVIDOR. Al cruzar
 * `NextResponse.json(...)` esas `Date` se serializan a `string` (ISO 8601);
 * este archivo declara la forma REAL que llega al cliente tras
 * `fetch(...).json()`, para no tipar con `Date` un valor que en tiempo de
 * ejecución siempre es un `string` (mismo cuidado que ya aplican
 * `ActuacionLicenciaDoc`/`ExpedienteLicenciaDoc` para sus propios campos de
 * fecha).
 *
 * `EvaluacionPlazoSubsanacion`, `BorradorActoDesistimiento`, `ErrorVigencia`
 * y `ReglaVigencia` NO tienen ningún campo `Date` en su tipo de origen —
 * esos se reexportan/reutilizan tal cual, sin redeclarar.
 */

import type { EvaluacionPlazoSubsanacion, BorradorActoDesistimiento } from '@/lib/server/expedientes-licencias';
import type { ErrorVigencia, ReglaVigencia } from '@/lib/motor-expedientes/vigencias';

export type { EvaluacionPlazoSubsanacion, BorradorActoDesistimiento };

/** `VencimientoDual` (`lib/motor-expedientes/termino.ts`) tras `NextResponse.json`. */
export interface TerminoDualUI {
  suspension: string | null;
  reinicio: string | null;
  fechaAlertaConservadora: string | null;
}

/** Caso exitoso de `ResultadoVencimientoVigencia` (`lib/motor-expedientes/vigencias.ts`) tras `NextResponse.json`. */
export interface VigenciaOkUI {
  vencimiento: string;
  configAplicada: ReglaVigencia;
}

/** `vigencia` del contrato: éxito, error de selección de regla, o ausente (expediente sin `fechaFirmeza`). */
export type VigenciaUI = VigenciaOkUI | ErrorVigencia;

export interface ComputosExpedienteUI {
  terminoDual: TerminoDualUI;
  /** Ausente cuando el expediente no tiene `actoFinal.fechaFirmeza` (no está en firme) — nunca un error HTTP. */
  vigencia?: VigenciaUI;
  plazoSubsanacion: EvaluacionPlazoSubsanacion;
}
