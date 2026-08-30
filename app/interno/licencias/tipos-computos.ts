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
/**
 * El término, con UNA fecha y su artículo (ADR-0038).
 *
 * Se llamaba `TerminoDualUI` y traía `suspension` y `reinicio` — las dos
 * lecturas del «hueco 1» del ADR-0029— porque nadie sabía cuál regía. El
 * artículo 2.2.6.1.2.2.4 lo dice: «se suspenderá». Se conserva el nombre del
 * campo `fechaAlertaConservadora` porque está DENORMALIZADO en producción y
 * renombrarlo exigiría migrar cada documento; su significado ya no es «la más
 * temprana de dos», sino la fecha, a secas.
 */
export interface TerminoUI {
  fechaAlertaConservadora: string | null;
  /** El artículo que sostiene el cómputo, para citarlo en vez de explicar dudas. */
  fundamento: string;
}

/** @deprecated Nombre anterior. Se conserva para no romper llamadores externos. */
export type TerminoDualUI = TerminoUI;

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
