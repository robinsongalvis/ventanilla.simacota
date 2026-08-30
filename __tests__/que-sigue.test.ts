import { describe, expect, it } from 'vitest';
import { derivarQueSigue } from '@/app/interno/licencias/que-sigue';
import { transicionesDesde, type EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

/**
 * QUÉ SIGUE EN ESTE EXPEDIENTE.
 *
 * La columna de acciones era una PILA PLANA: «Registrar desistimiento» arriba,
 * en verde y habilitado, y lo que de verdad tocaba —iniciar la revisión— ni
 * aparecía. Lo destructivo era lo más visible y lo urgente no se veía.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ─────────────────────────────────────────
 * QUÉ MIRA: que TODO salga del mapa de transiciones y nada de una lista
 * paralela; el orden de la jerarquía; y que lo destructivo nunca sea principal.
 * QUÉ NO MIRA: la maquetación, ni si el servidor acepta la actuación — eso lo
 * decide él, y este módulo consulta el MISMO mapa que él consulta.
 */

describe('la acción del momento sale del mapa, no de una lista', () => {
  it('radicada en debida forma → iniciar revisión, con lo que queda registrado', () => {
    const q = derivarQueSigue({ estado: 'RADICADA_EN_DEBIDA_FORMA', yaHuboActa: false });
    expect(q.principal?.tipo).toBe('inicio-revision');
    expect(q.principal?.nota).toMatch(/con su fecha y su nombre/);
  });

  it('en revisión → el acta está disponible, y NO es la principal', () => {
    const q = derivarQueSigue({ estado: 'EN_REVISION', yaHuboActa: false });
    expect(q.disponibles.map((a) => a.tipo)).toContain('acta-observaciones');
    expect(q.principal?.tipo).not.toBe('acta-observaciones');
  });

  it('notificada → registrar firmeza', () => {
    expect(derivarQueSigue({ estado: 'NOTIFICADA', yaHuboActa: false }).principal?.tipo).toBe('firmeza');
  });

  it('en firme → ya no hay acción del momento', () => {
    const q = derivarQueSigue({ estado: 'EN_FIRME', yaHuboActa: false });
    expect(q.principal).toBeNull();
    expect(q.disponibles).toEqual([]);
  });
});

describe('lo destructivo va APARTE, en todos los estados', () => {
  const ESTADOS: EstadoJuridicoLicencia[] = [
    'PRESENTADA', 'RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION',
    'CON_ACTA_DE_OBSERVACIONES', 'EN_VIABILIDAD',
  ];

  it.each(ESTADOS)('en %s, el desistimiento NUNCA es la acción principal', (estado) => {
    for (const yaHuboActa of [false, true]) {
      const q = derivarQueSigue({ estado, yaHuboActa });
      expect(q.principal?.tipo ?? '').not.toMatch(/desistimiento/);
      expect(q.disponibles.map((a) => a.tipo).join(' ')).not.toMatch(/desistimiento/);
    }
  });

  it('el tácito solo se ofrece si hubo acta', () => {
    const sin = derivarQueSigue({ estado: 'EN_REVISION', yaHuboActa: false });
    const con = derivarQueSigue({ estado: 'CON_ACTA_DE_OBSERVACIONES', yaHuboActa: true });
    expect(sin.aparte.map((a) => a.tipo)).not.toContain('desistimiento-tacito');
    expect(con.aparte.map((a) => a.tipo)).toContain('desistimiento-tacito');
  });
});

describe('lo que no procede se explica; no se esconde', () => {
  it('el motivo del servidor se coloca, no se redacta aquí', () => {
    const q = derivarQueSigue({
      estado: 'RADICADA_EN_DEBIDA_FORMA',
      yaHuboActa: false,
      motivos: { acta: 'El acta solo procede con el expediente en revisión.' },
    });
    expect(q.esperando).toHaveLength(1);
    expect(q.esperando[0].porque).toBe('El acta solo procede con el expediente en revisión.');
  });

  it('sin motivo del servidor, no se inventa ninguno', () => {
    expect(derivarQueSigue({ estado: 'EN_REVISION', yaHuboActa: false }).esperando).toEqual([]);
  });
});

describe('NADIE ofrece lo que el mapa no permite, y los huecos se declaran', () => {
  const TODOS: EstadoJuridicoLicencia[] = [
    'PRESENTADA', 'RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES',
    'EN_VIABILIDAD', 'CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME',
    'HISTORICO_SIN_RESOLVER',
  ];

  it.each(TODOS)('en %s, toda acción ofrecida corresponde a una transición real', (estado) => {
    for (const yaHuboActa of [false, true]) {
      const q = derivarQueSigue({ estado, yaHuboActa });
      const permitidos = new Set(transicionesDesde(estado, { yaHuboActa }).map((t) => t.hacia));
      const ofrecidas = [q.principal, ...q.disponibles, ...q.aparte].filter(Boolean);
      /* Si el mapa no permite NADA, no puede ofrecerse NADA. */
      if (permitidos.size === 0) expect(ofrecidas).toHaveLength(0);
    }
  });

  it('un expediente LIMPIO en revisión no tiene por dónde avanzar — y se declara', () => {
    /* EL HUECO REAL, más estrecho que el que creí primero: `respuesta-subsanacion`
       SÍ produce EN_VIABILIDAD, pero es la respuesta A UN ACTA. Sin acta previa,
       el mapa dice «si no requiere acta, pasa directo al concepto» y no hay
       ninguna actuación que lo lleve. Un expediente sin observaciones se queda
       en EN_REVISION. */
    const limpio = derivarQueSigue({ estado: 'EN_REVISION', yaHuboActa: false });
    expect(limpio.destinosSinActuacion).toContain('EN_VIABILIDAD');
    expect(limpio.principal).toBeNull();
  });

  it('con acta de por medio, la subsanación SÍ es la acción del momento', () => {
    const conActa = derivarQueSigue({ estado: 'CON_ACTA_DE_OBSERVACIONES', yaHuboActa: true });
    expect(conActa.principal?.tipo).toBe('respuesta-subsanacion');
    expect(conActa.destinosSinActuacion).not.toContain('EN_VIABILIDAD');
  });
});

describe('«esperando» es para lo que forma parte del camino', () => {
  it('sin acta, la subsanación NO se anuncia — no es un paso pendiente, no existe', () => {
    const q = derivarQueSigue({
      estado: 'EN_REVISION',
      yaHuboActa: false,
      motivos: { respuesta: 'No hay un acta registrada.' },
    });
    expect(q.esperando).toEqual([]);
  });

  it('con acta, sí se anuncia con su motivo', () => {
    const q = derivarQueSigue({
      estado: 'EN_VIABILIDAD',
      yaHuboActa: true,
      motivos: { respuesta: 'El expediente ya está en viabilidad.' },
    });
    expect(q.esperando.map((e) => e.etiqueta)).toContain('Registrar respuesta de subsanación');
  });
});
