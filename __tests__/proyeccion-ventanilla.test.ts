import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  proyectarParaVentanilla,
  PLAZO_SIN_EMPEZAR,
} from '@/lib/server/proyeccion-ventanilla';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

/**
 * VENTANILLA VE EL ESTADO DEL TRÁMITE, NO EL EXPEDIENTE (ADR-0034).
 *
 * Lo que estas pruebas sostienen no es que la proyección funcione: es que NO
 * CREZCA. La regla de ampliación del ADR existe porque la utilidad fue siempre
 * el argumento con el que las proyecciones dejan de serlo.
 */

const base = (over: Partial<ExpedienteLicenciaDoc> = {}) =>
  ({
    id: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    estadoJuridico: 'PRESENTADA',
    creadoEn: '2026-08-20T12:00:00.000Z',
    numeroExpediente: { numero: '1-110-202608-00000123', serieId: 'radicados', año: 2026 },
    ...over,
  }) as unknown as ExpedienteLicenciaDoc;

describe('los cuatro datos, y ninguno más', () => {
  it('expone exactamente las claves que el ADR-0034 enumera', () => {
    /* Si mañana alguien añade un campo «porque es útil», este caso se pone rojo
       y le recuerda que ampliar la proyección exige modificar el ADR. */
    const p = proyectarParaVentanilla(base());
    expect(Object.keys(p).sort()).toEqual(
      [
        'avisoPlazo',
        'completitudSinEvaluar',
        'estadoJuridico',
        'estadoLegible',
        'faltantes',
        'fechaRadicacionDebidaForma',
        'numeroExpediente',
        'venceEl',
      ].sort(),
    );
  });

  it('NO deja pasar actuaciones, documentos ni deliberación interna', () => {
    /* La lista de exclusiones es el objeto de la decisión, no un detalle: se
       proyecta un expediente que las trae y se comprueba que no salen. */
    const p = proyectarParaVentanilla(
      base({
        actuaciones: [{ tipo: 'acta-observaciones', contenido: 'borrador interno' }],
        documentos: [{ nombre: 'cedula.pdf' }],
        notasInternas: 'concepto en formación',
        contexto: { categoriaComplejidad: 'ALTA' },
      } as never),
    );
    const serializado = JSON.stringify(p);
    for (const prohibido of ['actuaciones', 'documentos', 'notasInternas', 'borrador', 'concepto', 'cedula.pdf']) {
      expect(serializado, `la proyección filtró "${prohibido}"`).not.toContain(prohibido);
    }
  });

  it('traduce el estado a la etiqueta que ya usa Planeación', () => {
    /* Una segunda tabla de etiquetas acabaría divergiendo, y el mismo
       expediente diría una cosa arriba y otra en el mostrador. */
    expect(proyectarParaVentanilla(base({ estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA' } as never)).estadoLegible)
      .toBe('Radicada en debida forma');
  });
});

describe('el cuarto dato: cuando el plazo no ha empezado', () => {
  it('dice la frase exacta, no un guion', () => {
    /* Un guion obliga a la funcionaria a interpretar, y lo que interprete será
       suyo y no del sistema. Tiene que poder leérselo al ciudadano tal cual. */
    const p = proyectarParaVentanilla(base({ fechaRadicacionDebidaForma: undefined } as never));
    expect(p.avisoPlazo).toBe(PLAZO_SIN_EMPEZAR);
    expect(PLAZO_SIN_EMPEZAR).toBe('El plazo aún no ha empezado a correr.');
    expect(p.fechaRadicacionDebidaForma).toBeNull();
  });

  it('y NO proyecta vencimiento, aunque el documento traiga la fecha', () => {
    /* Un vencimiento sin plazo corriendo es una alarma sobre algo que todavía
       no empezó. */
    const p = proyectarParaVentanilla(
      base({ fechaRadicacionDebidaForma: undefined, fechaAlertaConservadora: '2026-10-24T12:00:00Z' } as never),
    );
    expect(p.venceEl).toBeNull();
  });

  it('cuando SÍ corre, da las dos fechas y ningún aviso', () => {
    const p = proyectarParaVentanilla(
      base({
        fechaRadicacionDebidaForma: '2026-08-20T12:00:00Z',
        fechaAlertaConservadora: '2026-10-24T12:00:00Z',
      } as never),
    );
    expect(p.avisoPlazo).toBeNull();
    expect(p.fechaRadicacionDebidaForma).toBe('2026-08-20T12:00:00Z');
    expect(p.venceEl).toBe('2026-10-24T12:00:00Z');
  });
});

describe('«nadie lo ha revisado» NO es «no falta nada»', () => {
  it('un expediente sin completitud evaluada se marca como tal', () => {
    /* Confundirlos haría que ventanilla le dijera al ciudadano que su solicitud
       está completa cuando nadie la miró. */
    const p = proyectarParaVentanilla(base());
    expect(p.completitudSinEvaluar).toBe(true);
    expect(p.faltantes).toEqual([]);
  });

  it('un expediente evaluado y completo NO se marca como sin evaluar', () => {
    const p = proyectarParaVentanilla(base({ completitud: { faltantes: [], aplicables: 19 } } as never));
    expect(p.completitudSinEvaluar).toBe(false);
    expect(p.faltantes).toEqual([]);
  });

  it('lista los faltantes por su nombre', () => {
    const p = proyectarParaVentanilla(
      base({ completitud: { faltantes: [{ nombre: 'Proyecto arquitectónico' }], aplicables: 19 } } as never),
    );
    expect(p.faltantes).toEqual(['Proyecto arquitectónico']);
  });
});

describe('la ruta es de solo lectura POR CONSTRUCCIÓN', () => {
  const RUTA = readFileSync('app/api/ventanilla/radicados/[radicadoId]/expediente/route.ts', 'utf8');

  it('no exporta ningún método de escritura', () => {
    /* «De solo lectura por convención» dura hasta que alguien añade un POST
       «pequeño». Que no exista es lo que lo impide. */
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(RUTA, `la ruta expone ${metodo}: ventanilla no escribe`).not.toMatch(
        new RegExp(`export\\s+async\\s+function\\s+${metodo}\\b`),
      );
    }
    expect(RUTA).toMatch(/export\s+async\s+function\s+GET\b/);
  });

  it('comprueba el permiso sobre el radicado Y sobre el expediente', () => {
    /* Dos comprobaciones, no una: el radicado decide si puede saber que hay
       expediente; el expediente decide si puede verlo. */
    expect(RUTA.match(/canOperateTenant\(/g) ?? []).toHaveLength(2);
  });
});
