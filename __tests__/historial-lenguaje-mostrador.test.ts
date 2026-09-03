import { describe, expect, it } from 'vitest';
import { construirTimelineDesdeActuaciones, TITULO_ACTUACION } from '@/app/interno/licencias/presentacion-actuaciones';
import type { Actuacion } from '@/lib/motor-expedientes/tipos';

/**
 * EL HISTORIAL, EN LENGUAJE DE MOSTRADOR.
 *
 * El propietario vio en PRODUCCIÓN un evento que decía literalmente
 * `apertura-expediente`, con la jerga entera detrás — «handoff D2»,
 * «esPrueba: true», «candado R10». La traza interna del sistema delante de
 * quien atiende a un ciudadano.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ─────────────────────────────────────────
 * QUÉ MIRA: que ningún evento se muestre con su slug; que la jerga viaje
 * SEPARADA para poder plegarse; que aparezcan los dos hechos que faltaban; y
 * que el vencimiento se distinga de los hechos.
 * QUÉ NO MIRA: la maquetación del riel ni los colores.
 */

const base = (over: Partial<Actuacion>): Actuacion => ({
  id: 'a1', expedienteId: 'e1', tipo: 'apertura-expediente', etapa: 'apertura',
  actorUid: 'u1', actorNombre: 'Javier Argüello', actorRol: 'FUNCIONARIO',
  fecha: '2026-08-29T14:15:00.000Z', origen: 'REAL', ...over,
});

describe('ningún evento se muestra con su slug', () => {
  it('`apertura-expediente` tiene título de persona', () => {
    const [ev] = construirTimelineDesdeActuaciones([base({})], 'REAL', null);
    expect(ev.titulo).toBe('Se abrió el expediente');
    expect(ev.titulo).not.toMatch(/-/);
  });

  it('el acto se nombra COMPLETO, como en el Decreto', () => {
    expect(TITULO_ACTUACION['radicacion-debida-forma']).toBe('Radicada en legal y debida forma');
  });

  it('todo tipo que el sistema escribe tiene su título', () => {
    /* Si mañana nace una actuación nueva sin título, el historial volvería a
       imprimir su slug. Esta lista son los tipos que el servidor escribe hoy. */
    for (const tipo of ['apertura-expediente', 'vinculacion-radicado', 'radicacion-debida-forma']) {
      expect(TITULO_ACTUACION[tipo], `falta título de ${tipo}`).toBeTruthy();
    }
  });
});

describe('cuándo, quién, y la jerga aparte', () => {
  it('trae fecha con hora y el actor capturado en servidor', () => {
    const [ev] = construirTimelineDesdeActuaciones([base({})], 'REAL', null);
    expect(ev.quien).toBe('Javier Argüello');
    expect(ev.cuando).toMatch(/29\/08\/2026/);
    expect(ev.cuando).toMatch(/\d/);
  });

  it('la jerga viaja SEPARADA, para poder plegarse', () => {
    const jerga = 'Expediente de demostración creado (esPrueba: true) — candado R10.';
    const [ev] = construirTimelineDesdeActuaciones([base({ detalle: jerga })], 'REAL', null);
    expect(ev.detalleTecnico).toBe(jerga);
    /* Y NO se cuela en el título ni en el resumen, que son lo que se lee. */
    expect(ev.titulo).not.toContain('esPrueba');
    expect(ev.resumen ?? '').not.toContain('esPrueba');
  });
});

describe('los dos hechos que el historial no pintaba', () => {
  it('la completitud aparece, aunque no sea una actuación', () => {
    const items = construirTimelineDesdeActuaciones([base({})], 'REAL', null, '2026-08-30T00:15:00.000Z');
    const compl = items.find((i) => i.tipo === 'COMPLETITUD');
    expect(compl?.titulo).toBe('La documentación quedó completa');
    expect(compl?.resumen).toMatch(/se ancla el plazo/);
  });

  it('sin dato de completitud NO se inventa la fila', () => {
    const items = construirTimelineDesdeActuaciones([base({})], 'REAL', null, null);
    expect(items.some((i) => i.tipo === 'COMPLETITUD')).toBe(false);
  });
});

describe('el vencimiento no se disfraza de hecho', () => {
  it('dice que es condicional, y por qué', () => {
    const items = construirTimelineDesdeActuaciones([base({})], 'REAL', new Date('2026-11-03T12:00:00Z'));
    const venc = items.find((i) => i.tipo === 'VENCIMIENTO_CALCULADO');
    expect(venc?.titulo).toMatch(/si nada lo detiene/);
    expect(venc?.resumen).toMatch(/acta de observaciones la suspende/);
  });

  it('un histórico migrado no proyecta vencimiento (R9)', () => {
    const items = construirTimelineDesdeActuaciones([base({})], 'RECONSTRUIDO', new Date('2026-11-03T12:00:00Z'));
    expect(items.some((i) => i.tipo === 'VENCIMIENTO_CALCULADO')).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════
   EL HISTORIAL VA EN ORDEN — custodio del 3-sep-2026.

   Lo cazó el propietario mirando un expediente en el ensayo: «La documentación
   quedó completa · 8:29 a. m.» aparecía DESPUÉS de «Radicada en legal y debida
   forma · 12:00 p. m.». El comentario del código prometía justo lo contrario
   —«se inserta en su sitio cronológico, no al final: el historial cuenta una
   historia y el orden es parte de lo que cuenta»— y el mecanismo no lo cumplía.

   LA CAUSA: se ordenaba por `meta`, que es una fecha YA FORMATEADA
   (`dd/mm/yyyy`). Con día de precisión, dos hechos del mismo día quedaban en
   el orden en que se armó la lista; y entre meses distintos el orden salía
   INVERTIDO, porque «01/09» va antes que «29/08» como texto y después como
   calendario.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA: que los hechos salgan en
   orden cronológico real, dentro del mismo día y a través de meses, con la
   completitud en su sitio. NO mira: los títulos ni el lenguaje (arriba), ni la
   maquetación.
══════════════════════════════════════════════════════════════ */
describe('el historial va en orden cronológico', () => {
  it('dentro del MISMO día, la completitud cae en su sitio y no al final', () => {
    const items = construirTimelineDesdeActuaciones(
      [
        base({ id: 'a1', tipo: 'apertura-expediente', fecha: '2026-09-01T13:25:00.000Z' }),
        base({ id: 'a2', tipo: 'radicacion-debida-forma', fecha: '2026-09-01T17:00:00.000Z' }),
      ],
      'REAL',
      null,
      '2026-09-01T13:29:00.000Z',
    );
    const orden = items.filter((i) => i.tipo !== 'VENCIMIENTO_CALCULADO').map((i) => i.tipo);
    expect(
      orden.indexOf('COMPLETITUD'),
      'la completitud (8:29) quedó fuera de su sitio entre la apertura (8:25) y la radicación (12:00)',
    ).toBe(1);
  });

  it('a través de MESES, el orden es el del calendario y no el del texto', () => {
    /* El caso que el formato dd/mm/yyyy invertía: «01/09» pesa menos que
       «29/08» como cadena, y más como fecha. */
    const items = construirTimelineDesdeActuaciones(
      [base({ id: 'a1', tipo: 'radicacion-debida-forma', fecha: '2026-09-01T14:00:00.000Z' })],
      'REAL',
      null,
      '2026-08-29T14:00:00.000Z',
    );
    const orden = items.filter((i) => i.tipo !== 'VENCIMIENTO_CALCULADO').map((i) => i.tipo);
    expect(
      orden[0],
      'un hecho de agosto quedó DESPUÉS de uno de septiembre — se está ordenando por el texto de la fecha',
    ).toBe('COMPLETITUD');
  });

  it('la proyección de vencimiento se queda al final: no es un hecho ocurrido', () => {
    const items = construirTimelineDesdeActuaciones(
      [base({ id: 'a1', tipo: 'radicacion-debida-forma', fecha: '2026-09-01T14:00:00.000Z' })],
      'REAL',
      new Date('2026-11-05T14:00:00.000Z'),
      '2026-08-29T14:00:00.000Z',
    );
    expect(items.at(-1)?.tipo).toBe('VENCIMIENTO_CALCULADO');
  });
});
