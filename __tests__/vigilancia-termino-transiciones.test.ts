import { describe, it, expect } from 'vitest';
import {
  calcularTransiciones,
  componerResumen,
  hayNovedades,
  type EstadoVigilado,
} from '@/lib/server/vigilancia-termino';

const e = (id: string, nivel: EstadoVigilado['nivel'], numero = `1-110-202608-0000000${id}`): EstadoVigilado =>
  ({ expedienteId: id, numeroExpediente: numero, nivel });

describe('la memoria del vigía: qué cambió desde ayer', () => {
  it('lo que no estaba y ahora está, ENTRA', () => {
    const t = calcularTransiciones([], [e('1', 'AVISO')], true);
    expect(t.entraron).toHaveLength(1);
    expect(t.entraron[0]).toMatchObject({ anterior: null, actual: 'AVISO' });
  });

  it('subir peldaño en la escalera es AGRAVAMIENTO', () => {
    const t = calcularTransiciones([e('1', 'AVISO')], [e('1', 'CRITICO')], true);
    expect(t.agravaron).toHaveLength(1);
    expect(t.cambiaron).toHaveLength(0);
  });

  it('bajar peldaño NO es agravamiento', () => {
    const t = calcularTransiciones([e('1', 'VENCIDO')], [e('1', 'AVISO')], true);
    expect(t.agravaron).toHaveLength(0);
    expect(t.cambiaron).toHaveLength(1);
  });

  it('lo que sigue igual no genera novedad — esta es la regla anti-ruido', () => {
    /* El defecto que este módulo evita: el cron de PQRSD reenvía la misma
       alerta cada día hábil hasta que el radicado sale del umbral. */
    const ayer = [e('1', 'VENCIDO'), e('2', 'CRITICO')];
    const t = calcularTransiciones(ayer, [...ayer], true);
    expect(hayNovedades(t), 'sin cambios no hay nada que contar').toBe(false);
  });

  it('lo que estaba y ya no está, SALE', () => {
    const t = calcularTransiciones([e('1', 'CRITICO')], [], true);
    expect(t.salieron).toHaveLength(1);
    expect(t.salieron[0]).toMatchObject({ anterior: 'CRITICO', actual: null });
  });
});

describe('ESPERA_EXCESIVA está fuera de la escalera, a propósito', () => {
  it('pasar de espera excesiva a vencido no se llama agravamiento', () => {
    /* Son ejes distintos: uno es «el plazo nunca empezó», el otro «el plazo se
       acabó». Ordenarlos sería inventar una jerarquía que la norma no da. */
    const t = calcularTransiciones([e('1', 'ESPERA_EXCESIVA')], [e('1', 'VENCIDO')], true);
    expect(t.agravaron).toHaveLength(0);
    expect(t.cambiaron).toHaveLength(1);
  });

  it('y al revés tampoco', () => {
    const t = calcularTransiciones([e('1', 'VENCIDO')], [e('1', 'ESPERA_EXCESIVA')], true);
    expect(t.agravaron).toHaveLength(0);
    expect(t.cambiaron).toHaveLength(1);
  });
});

describe('la trampa del techo de lectura', () => {
  /**
   * ESTE ES EL CASO QUE IMPORTA.
   *
   * El cron lee `expedientes` con `limit(1000)`. Si la colección lo supera, los
   * no leídos aparecen AUSENTES — y ausente se leería como «salió de alerta»,
   * que es exactamente al revés: un expediente vencido desaparecería del radar
   * por ser el número 1001.
   */
  it('con lectura truncada NO se declara ninguna salida', () => {
    const t = calcularTransiciones([e('1', 'VENCIDO'), e('2', 'CRITICO')], [], false);
    expect(
      t.salieron,
      'ausente en una lectura truncada NO significa resuelto: puede ser que no se leyó',
    ).toHaveLength(0);
  });

  it('y se DECLARA que no se pudieron calcular, en vez de callarlo', () => {
    const t = calcularTransiciones([e('1', 'VENCIDO')], [], false);
    expect(t.salidasNoCalculables).toBe(true);
    /* Callarlo convertiría «no pude mirar» en «no había nada» — la ambigüedad
       que este vigía existe para eliminar. */
    expect(componerResumen('2026-08-27T12:00:00Z', 1000, [], t, false).salidasNoCalculables).toBe(true);
  });

  it('con lectura completa sí se declaran', () => {
    const t = calcularTransiciones([e('1', 'VENCIDO')], [], true);
    expect(t.salieron).toHaveLength(1);
    expect(t.salidasNoCalculables).toBe(false);
  });
});

describe('el resumen que lee el tablero y manda el correo semanal', () => {
  it('cuenta por nivel, incluidos los ceros', () => {
    const r = componerResumen(
      '2026-08-27T12:00:00Z',
      12,
      [e('1', 'VENCIDO'), e('2', 'VENCIDO'), e('3', 'ESPERA_EXCESIVA')],
      calcularTransiciones([], [], true),
      true,
    );
    expect(r.porNivel).toEqual({ AVISO: 0, CRITICO: 0, VENCIDO: 2, ESPERA_EXCESIVA: 1 });
  });

  it('declara «conjunto vacío» de forma explícita, no por deducción de ceros', () => {
    /* Hoy es el caso NORMAL: con R10 cerrado todo expediente nace `esPrueba` y
       el vigía los excluye. Que el resumen lo diga evita que un silencio se
       lea como salud — el fallo PT-2 del otro cron. */
    const r = componerResumen('2026-08-27T12:00:00Z', 0, [], calcularTransiciones([], [], true), true);
    expect(r.conjuntoVacio).toBe(true);
    expect(r.revisados).toBe(0);
  });

  it('un conjunto NO vacío no se marca como vacío', () => {
    const r = componerResumen('2026-08-27T12:00:00Z', 5, [e('1', 'AVISO')], calcularTransiciones([], [], true), true);
    expect(r.conjuntoVacio).toBe(false);
  });
});
