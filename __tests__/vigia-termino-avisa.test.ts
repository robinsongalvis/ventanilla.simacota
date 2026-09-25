import { describe, it, expect } from 'vitest';
import { esLunes } from '@/app/api/cron/vencimientos-licencias/route';
import {
  buildNovedadesVigilanciaHtml,
  buildNovedadesVigilanciaSubject,
  buildResumenSemanalHtml,
  buildResumenSemanalSubject,
} from '@/lib/email/templates/vigilancia-termino-licencias';
import { componerResumen, calcularTransiciones } from '@/lib/server/vigilancia-termino';

/** En HTML el salto de línea no es semántico: una frase partida por el
 *  formateo del template sigue siendo la misma frase para quien la lee. */
const texto = (html: string) => html.replace(/\s+/g, ' ');

const resumenVacio = componerResumen('2026-08-31T12:30:00Z', 0, [], calcularTransiciones([], [], true), true);
const resumenConAlertas = componerResumen(
  '2026-08-31T12:30:00Z',
  9,
  [
    { expedienteId: 'a', numeroExpediente: '1-110-202608-00000012', nivel: 'VENCIDO' },
    { expedienteId: 'b', numeroExpediente: '1-110-202608-00000013', nivel: 'ESPERA_EXCESIVA' },
  ],
  calcularTransiciones([], [], true),
  true,
);

describe('el día fijo del resumen semanal', () => {
  /* El propietario lo pidió un día fijo para que Planeación aprenda a
     esperarlo: si algún lunes NO llega, eso también informa. */
  it('es lunes, decidido en hora de Bogotá', () => {
    // 31-ago-2026 es lunes. 12:30 UTC = 07:30 en Bogotá, mismo día civil.
    expect(esLunes(new Date('2026-08-31T12:30:00Z'))).toBe(true);
    expect(esLunes(new Date('2026-09-01T12:30:00Z'))).toBe(false);
  });

  it('un lunes de madrugada en UTC que todavía es domingo en Bogotá NO cuenta', () => {
    /* 31-ago 02:00 UTC = 30-ago 21:00 en Bogotá: domingo. Razonar en UTC habría
       mandado el resumen un día antes. */
    expect(esLunes(new Date('2026-08-31T02:00:00Z'))).toBe(false);
  });

  it('y un domingo tarde en UTC que ya es lunes en Bogotá tampoco se adelanta', () => {
    // 30-ago 23:00 UTC = 30-ago 18:00 en Bogotá: sigue siendo domingo.
    expect(esLunes(new Date('2026-08-30T23:00:00Z'))).toBe(false);
  });
});

describe('el correo de novedades', () => {
  const params = {
    entraron: [{ expedienteId: 'a', numeroExpediente: '1-110-202608-00000012', anterior: null, actual: 'VENCIDO' as const }],
    agravaron: [{ expedienteId: 'b', numeroExpediente: '1-110-202608-00000013', anterior: 'AVISO' as const, actual: 'CRITICO' as const }],
    fechaCorridaIso: '2026-08-27T12:30:00Z',
    enlaceBandeja: 'https://x/interno/licencias',
  };

  it('dice expresamente que solo avisa de lo que cambió', () => {
    /* Es la promesa que evita que el correo se vuelva ruido: quien lo recibe
       tiene que saber que NO es la lista completa. */
    expect(texto(buildNovedadesVigilanciaHtml(params))).toMatch(/solo se avisa de lo que cambió/i);
  });

  it('nombra cada expediente y de dónde viene', () => {
    const html = buildNovedadesVigilanciaHtml(params);
    expect(html).toContain('1-110-202608-00000012');
    expect(html).toContain('1-110-202608-00000013');
    expect(html, 'un agravamiento dice desde qué nivel').toMatch(/antes:/i);
  });

  it('un expediente sin número todavía NO se cae del correo', () => {
    /* Omitirlo lo dejaría fuera justo por ser el caso incompleto — que es el
       que más suele necesitar que alguien lo mire. */
    const html = buildNovedadesVigilanciaHtml({
      ...params,
      entraron: [{ expedienteId: 'exp-sin-numero', numeroExpediente: null, anterior: null, actual: 'ESPERA_EXCESIVA' }],
      agravaron: [],
    });
    expect(html).toContain('exp-sin-numero');
  });

  it('el asunto dice cuántos, sin obligar a abrirlo', () => {
    expect(buildNovedadesVigilanciaSubject(1, 1)).toMatch(/2 expedientes/);
    expect(buildNovedadesVigilanciaSubject(1, 0)).toMatch(/1 expediente requiere/);
  });
});

describe('el resumen semanal con el conjunto vacío', () => {
  it('dice que se ejecutó y que no hay nada — no cuatro ceros mudos', () => {
    const html = buildResumenSemanalHtml({ resumen: resumenVacio, enlaceBandeja: 'https://x' });
    expect(texto(html)).toMatch(/se ejecutó con normalidad/i);
    expect(texto(html)).toMatch(/no hay ningún expediente bajo vigilancia/i);
  });

  it('explica que su AUSENCIA es la que hay que mirar', () => {
    /* El encargo literal del propietario: que Planeación aprenda a esperar el
       correo, para que dejar de recibirlo sea la señal. */
    const html = buildResumenSemanalHtml({ resumen: resumenVacio, enlaceBandeja: 'https://x' });
    expect(texto(html)).toMatch(/si algún lunes no llega/i);
  });

  it('y el asunto no finge alarma cuando no la hay', () => {
    expect(buildResumenSemanalSubject(resumenVacio)).toMatch(/ningún expediente en vigilancia/i);
  });
});

describe('el resumen semanal con alertas', () => {
  it('cuenta por nivel, incluida la categoría que Planeación resuelve el mismo día', () => {
    const html = buildResumenSemanalHtml({ resumen: resumenConAlertas, enlaceBandeja: 'https://x' });
    expect(html).toMatch(/Presentada hace demasiado y todavía sin radicar/i);
    expect(buildResumenSemanalSubject(resumenConAlertas)).toMatch(/atención inmediata/i);
  });

  it('si la revisión no lo miró todo, el correo lo DICE', () => {
    /* Presentar un mínimo como si fuera el total es exactamente la mentira que
       este vigía existe para no cometer. */
    const truncado = componerResumen(
      '2026-08-31T12:30:00Z',
      1000,
      [{ expedienteId: 'a', numeroExpediente: 'X', nivel: 'VENCIDO' }],
      calcularTransiciones([], [], false),
      false,
    );
    const html = buildResumenSemanalHtml({ resumen: truncado, enlaceBandeja: 'https://x' });
    expect(texto(html)).toMatch(/no alcanzó a mirar todos/i);
    expect(texto(html)).toMatch(/mínimo, no un total/i);
  });
});
