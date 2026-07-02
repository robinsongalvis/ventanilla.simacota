import { describe, expect, it } from 'vitest';
import {
  LABEL_ORIGEN_INGRESO,
  LABEL_TIPO_ENTRADA,
  LABEL_TIPO_PERSONA,
  SIN_CLASIFICAR,
} from '@/lib/labels/labels-operativos';

/* ══════════════════════════════════════════════════════════════
   Sprint 1.5 · PR 3 — defaults "Sin clasificar" para radicados
   históricos sin origenIngreso ni tipoEntrada registrado.

   Antes del Sprint Ventanilla Operativa 1 los radicados nacían sin
   esos campos. Con estos tests garantizamos que el dashboard NO los
   etiquete falsamente como "Portal web" / "PQRSD", sino como
   "Sin clasificar" — cambio necesario para que los reportes MIPG no
   mezclen histórico con datos actuales.
══════════════════════════════════════════════════════════════ */

describe('Sprint 1.5 — labels operativos y default "Sin clasificar"', () => {
  /* 1 */
  it('radicados históricos sin origenIngreso caen a "Sin clasificar"', () => {
    const origenAusente: string | undefined = undefined;
    const label = LABEL_ORIGEN_INGRESO[origenAusente ?? SIN_CLASIFICAR];
    expect(label).toBe('Sin clasificar');
  });

  /* 2 */
  it('radicados históricos sin tipoEntrada caen a "Sin clasificar"', () => {
    const tipoAusente: string | undefined = undefined;
    const label = LABEL_TIPO_ENTRADA[tipoAusente ?? SIN_CLASIFICAR];
    expect(label).toBe('Sin clasificar');
  });

  /* 3 */
  it('radicados nuevos con origenIngreso real conservan su label específico', () => {
    expect(LABEL_ORIGEN_INGRESO['PQRSD_WEB_OFICIAL']).toBe('Portal web');
    expect(LABEL_ORIGEN_INGRESO['OFICIO_EXTERNO']).toBe('Oficio ext.');
    expect(LABEL_ORIGEN_INGRESO['VENTANILLA_FISICA']).toBe('Ventanilla');
  });

  /* 4 — LABEL_TIPO_PERSONA sí cubre todos los valores del enum
     TipoPersona (no hay valor SIN_CLASIFICAR porque el enum incluye
     'NO_IDENTIFICADO' para el caso ambiguo). */
  it('LABEL_TIPO_PERSONA cubre los 5 valores del enum sin necesidad de default', () => {
    expect(LABEL_TIPO_PERSONA['NATURAL']).toBe('Persona natural');
    expect(LABEL_TIPO_PERSONA['JURIDICA']).toBe('Persona jurídica');
    expect(LABEL_TIPO_PERSONA['ENTIDAD_PUBLICA']).toBe('Entidad pública');
    expect(LABEL_TIPO_PERSONA['COMUNICACION_INSTITUCIONAL']).toBe('Com. institucional');
    expect(LABEL_TIPO_PERSONA['NO_IDENTIFICADO']).toBe('No identificado');
  });
});
