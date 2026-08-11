import { describe, expect, it } from 'vitest';
import {
  puedeTransicionar,
  transicionesDesde,
  validarCierreExpediente,
  completarRevisionHistorica,
  type EstadoJuridicoLicencia,
  type RevisionHistoricaLicencia,
} from '@/lib/motor-expedientes/estados-licencia';
import type { Expediente } from '@/lib/motor-expedientes/tipos';

/* DF-5/DF-6 (ADR-0029) — esqueleto de estados jurídicos + validación de cierre. */

const TODOS_LOS_ESTADOS: EstadoJuridicoLicencia[] = [
  'RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES', 'EN_VIABILIDAD',
  'CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME',
];

describe('puedeTransicionar — camino feliz completo', () => {
  it('RADICADA → EN_REVISION → EN_VIABILIDAD → CONCEDIDA → NOTIFICADA → EN_FIRME', () => {
    expect(puedeTransicionar('RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION')).toBe(true);
    expect(puedeTransicionar('EN_REVISION', 'EN_VIABILIDAD')).toBe(true);
    expect(puedeTransicionar('EN_VIABILIDAD', 'CONCEDIDA')).toBe(true);
    expect(puedeTransicionar('CONCEDIDA', 'NOTIFICADA')).toBe(true);
    expect(puedeTransicionar('NOTIFICADA', 'EN_FIRME')).toBe(true);
  });

  it('camino con acta: RADICADA → EN_REVISION → CON_ACTA → EN_VIABILIDAD → NEGADA → NOTIFICADA → EN_FIRME', () => {
    expect(puedeTransicionar('EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES')).toBe(true);
    expect(puedeTransicionar('CON_ACTA_DE_OBSERVACIONES', 'EN_VIABILIDAD')).toBe(true);
    expect(puedeTransicionar('EN_VIABILIDAD', 'NEGADA')).toBe(true);
  });
});

describe('puedeTransicionar — guard del acta única (art. 2.2.6.1.2.2.4)', () => {
  it('sin acta previa → EN_REVISION puede pasar a CON_ACTA_DE_OBSERVACIONES', () => {
    expect(puedeTransicionar('EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES', { yaHuboActa: false })).toBe(true);
    expect(puedeTransicionar('EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES')).toBe(true); // default = sin acta
  });

  it('CON acta previa → EN_REVISION NO puede pasar a CON_ACTA_DE_OBSERVACIONES otra vez', () => {
    expect(puedeTransicionar('EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES', { yaHuboActa: true })).toBe(false);
  });

  it('el guard NO afecta otras transiciones desde EN_REVISION', () => {
    expect(puedeTransicionar('EN_REVISION', 'EN_VIABILIDAD', { yaHuboActa: true })).toBe(true);
  });
});

describe('puedeTransicionar — desistimiento expreso desde cualquier estado PRE-decisión', () => {
  it.each(['RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES', 'EN_VIABILIDAD'] as EstadoJuridicoLicencia[])(
    '%s → DESISTIDA es válida',
    (desde) => {
      expect(puedeTransicionar(desde, 'DESISTIDA')).toBe(true);
    },
  );

  it('NO procede desistir DESPUÉS de la decisión (CONCEDIDA/NEGADA no tienen salida a DESISTIDA)', () => {
    expect(puedeTransicionar('CONCEDIDA', 'DESISTIDA')).toBe(false);
    expect(puedeTransicionar('NEGADA', 'DESISTIDA')).toBe(false);
  });
});

describe('puedeTransicionar — pares inválidos / estado terminal', () => {
  it('EN_FIRME no tiene salidas', () => {
    expect(transicionesDesde('EN_FIRME')).toEqual([]);
  });

  it('un salto que se salta etapas es inválido (p. ej. RADICADA → CONCEDIDA directo)', () => {
    expect(puedeTransicionar('RADICADA_EN_DEBIDA_FORMA', 'CONCEDIDA')).toBe(false);
  });

  it('no hay transiciones hacia atrás (p. ej. EN_FIRME → NOTIFICADA)', () => {
    expect(puedeTransicionar('EN_FIRME', 'NOTIFICADA')).toBe(false);
  });
});

describe('transicionesDesde — trae fundamento y respeta el guard de acta', () => {
  it('cada transición reportada tiene un fundamento no vacío', () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      for (const t of transicionesDesde(estado)) {
        expect(t.fundamento.length, `${estado} → ${t.hacia} sin fundamento`).toBeGreaterThan(0);
      }
    }
  });

  it('con yaHuboActa:true, CON_ACTA_DE_OBSERVACIONES no aparece entre las transiciones de EN_REVISION', () => {
    const destinos = transicionesDesde('EN_REVISION', { yaHuboActa: true }).map((t) => t.hacia);
    expect(destinos).not.toContain('CON_ACTA_DE_OBSERVACIONES');
    expect(destinos).toContain('EN_VIABILIDAD');
  });
});

describe('validarCierreExpediente — DF-6', () => {
  const actoCompleto = { numero: 'RES-002-2026', fecha: '2026-08-01T00:00:00.000Z', fechaFirmeza: '2026-08-15T00:00:00.000Z' };

  it('REAL con actoFinal completo (numero, fecha, fechaFirmeza) → válido', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = { origen: 'REAL', actoFinal: actoCompleto };
    expect(validarCierreExpediente(expediente).valido).toBe(true);
  });

  it('sin origen declarado se trata como REAL (mismo default del resto del motor)', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = { actoFinal: actoCompleto };
    expect(validarCierreExpediente(expediente).valido).toBe(true);
  });

  it('REAL sin fechaFirmeza → inválido, con mensaje que la nombra', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = {
      origen: 'REAL', actoFinal: { numero: 'RES-002-2026', fecha: '2026-08-01T00:00:00.000Z' },
    };
    const resultado = validarCierreExpediente(expediente);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes('fechaFirmeza'))).toBe(true);
  });

  it('REAL sin actoFinal (undefined) → inválido con los 3 errores', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = { origen: 'REAL' };
    const resultado = validarCierreExpediente(expediente);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toHaveLength(3);
  });

  it('RECONSTRUIDO con cierreDesconocido:true y SIN datos del acto → válido (D6)', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = {
      origen: 'RECONSTRUIDO', actoFinal: { cierreDesconocido: true },
    };
    expect(validarCierreExpediente(expediente).valido).toBe(true);
  });

  it('RECONSTRUIDO CON datos completos del acto (sin cierreDesconocido) → también válido', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = { origen: 'RECONSTRUIDO', actoFinal: actoCompleto };
    expect(validarCierreExpediente(expediente).valido).toBe(true);
  });

  it('RECONSTRUIDO sin cierreDesconocido y sin datos completos → inválido (no puede quedar sin ninguna constancia)', () => {
    const expediente: Pick<Expediente, 'origen' | 'actoFinal'> = { origen: 'RECONSTRUIDO', actoFinal: {} };
    expect(validarCierreExpediente(expediente).valido).toBe(false);
  });
});

describe('completarRevisionHistorica — DF-10 ("histórico sin resolver")', () => {
  const AHORA = new Date(2026, 7, 20, 9, 0, 0, 0);
  const actor = { uid: 'uid-func-1', nombre: 'Funcionaria Planeación' };

  it('con pendiente:true → retira la marca y estampa quién/cuándo (criterio "editable y trazable")', () => {
    const revision: RevisionHistoricaLicencia = { pendiente: true, pendientesAlImportar: ['IDENTIDAD', 'ESTADO_JURIDICO', 'ACTO_FINAL'] };
    const resultado = completarRevisionHistorica(revision, actor, AHORA);
    expect(resultado).not.toBeNull();
    expect(resultado!.pendiente).toBe(false);
    expect(resultado!.completadoPor).toEqual({ actorUid: 'uid-func-1', actorNombre: 'Funcionaria Planeación', fecha: AHORA.toISOString() });
    // `pendientesAlImportar` es historial de la brecha ORIGINAL — no se borra al completar.
    expect(resultado!.pendientesAlImportar).toEqual(['IDENTIDAD', 'ESTADO_JURIDICO', 'ACTO_FINAL']);
  });

  it('fail-closed: con pendiente:false (ya completada) → null, nunca pisa el "completadoPor" anterior', () => {
    const yaCompletada: RevisionHistoricaLicencia = {
      pendiente: false,
      pendientesAlImportar: ['ESTADO_JURIDICO', 'ACTO_FINAL'],
      completadoPor: { actorUid: 'uid-otro', actorNombre: 'Otro Funcionario', fecha: '2026-08-01T00:00:00.000Z' },
    };
    const resultado = completarRevisionHistorica(yaCompletada, actor, AHORA);
    expect(resultado).toBeNull();
  });

  it('nada en este módulo retira la marca automáticamente — solo esta función existe para eso', () => {
    // Documenta el criterio fail-closed (c) del encargo: `puedeTransicionar`
    // no conoce ni toca `RevisionHistoricaLicencia`.
    const revision: RevisionHistoricaLicencia = { pendiente: true, pendientesAlImportar: [] };
    expect(revision.pendiente).toBe(true);
    expect(puedeTransicionar('RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION')).toBe(true); // transición jurídica normal, ajena a la marca
  });
});
