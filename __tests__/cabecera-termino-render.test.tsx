import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CabeceraTermino } from '@/app/interno/licencias/components/CabeceraTermino';
import {
  COLOR_NIVEL_TERMINO,
  PLAZO_DECISION_LICENCIA_DIAS_HABILES,
} from '@/lib/motor-expedientes/semaforo-termino';
import {
  ESTADOS_RESUELTOS_LICENCIA,
  type EstadoJuridicoLicencia,
} from '@/lib/motor-expedientes/estados-licencia';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';

/**
 * LA TARJETA DEL TÉRMINO, RENDERIZADA DE VERDAD.
 *
 * `semaforo-termino-compartido.test.ts` comprueba que la pantalla LLAMA a la
 * función compartida y que no declara umbrales propios — pero lo hace LEYENDO
 * EL ARCHIVO. Eso es exactamente el error que ya costó una vez en este
 * proyecto: un detector que mide el `import` y no la llamada. Un componente
 * puede importar lo correcto y aun así reventar al montarse, pintar el nivel
 * equivocado o no pintar nada.
 *
 * Estas pruebas lo MONTAN y miran lo que sale.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ──────────────────────────────────────────
 * QUÉ MIRA: que cada situación produzca la tarjeta que le toca, que los cuatro
 * niveles se distingan entre sí en color y texto, y que el color sea el del
 * correo.
 * QUÉ NO MIRA: la maquetación (posición, tamaños, tipografías) ni el resto del
 * detalle del expediente. Si el anillo se descuadra, esto sigue verde.
 */

afterEach(cleanup);

/* Anclado a una fecha fija: el criterio cuenta días HÁBILES, así que las
   fechas se construyen con el mismo calendario que usa producción y no
   sumando 24h — que es como se cuelan los festivos. */
const AHORA = new Date();

/* `sumarDiasHabiles` devuelve Date, no cadena — y la tarjeta recibe ISO. La
   primera versión de esto pasaba las 13 pruebas en verde CON EL TIPO MAL:
   vitest no chequea tipos, y `toISOString()` faltante solo lo vio `tsc`. */
function venceEn(diasHabiles: number): string {
  return sumarDiasHabiles(AHORA.toISOString(), diasHabiles).toISOString();
}

function pintar(diasHabiles: number, estado: EstadoJuridicoLicencia = 'RADICADA_EN_DEBIDA_FORMA') {
  return render(
    <CabeceraTermino
      venceIso={venceEn(diasHabiles)}
      desdeIso={venceEn(-3)}
      estadoJuridico={estado}
      expedienteId="exp-prueba"
    />,
  );
}

describe('la tarjeta se monta y dice el nivel que corresponde', () => {
  it('con 40 días por delante NO está en rojo: está en término', () => {
    pintar(40);
    expect(screen.getByText('En término')).toBeTruthy();
    /* El defecto que originó todo el módulo: rojo con 41 días por delante. */
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/silencio administrativo/i)).toBeNull();
  });

  it('a 10 días avisa, sin gritar', () => {
    pintar(10);
    expect(screen.getByText('Por vencer')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a 3 días es CRÍTICO, y se lee distinto del aviso', () => {
    pintar(3);
    expect(screen.getByText('Crítico')).toBeTruthy();
    expect(screen.getByText(/cinco días hábiles o menos/i)).toBeTruthy();
  });

  it('vencido lo dice con la consecuencia entera, y como alerta accesible', () => {
    pintar(-2);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toMatch(/silencio administrativo positivo/i);
    expect(alerta.textContent).toMatch(/podría entenderse concedida por ley/i);
    expect(screen.getByText(/Vencido hace \d+ días?/)).toBeTruthy();
  });
});

describe('crítico y aviso NO se ven iguales', () => {
  /* El defecto real de la primera versión de esta tarjeta: ambos niveles
     compartían fondo y TEXTO IDÉNTICO, con lo cual el escalón de los 5 días
     —el que existe para que alguien suelte lo que está haciendo— era
     invisible. El correo sí los distinguía. */
  it('ni en el rótulo ni en el mensaje', () => {
    const { container: aviso } = pintar(10);
    const textoAviso = aviso.textContent ?? '';
    cleanup();
    const { container: critico } = pintar(3);
    const textoCritico = critico.textContent ?? '';

    expect(textoAviso).not.toEqual(textoCritico);
    expect(textoAviso).toContain('Por vencer');
    expect(textoCritico).toContain('Crítico');
  });

  it('y el color de cada uno es el que manda el correo', () => {
    const { container } = pintar(3);
    expect(container.innerHTML).toContain(COLOR_NIVEL_TERMINO.CRITICO);
    expect(container.innerHTML).not.toContain(COLOR_NIVEL_TERMINO.AVISO);
  });
});

describe('cuando el reloj no corre, la tarjeta no lo inventa', () => {
  it('con acta de observaciones el término está suspendido: no hay anillo', () => {
    const { container } = pintar(10, 'CON_ACTA_DE_OBSERVACIONES');
    expect(container.innerHTML).toBe('');
  });

  /* Los cinco estados en que la Administración YA se pronunció. Va como
     `it.each` sobre la constante del motor y no sobre una lista escrita a mano:
     si mañana nace un sexto estado resuelto, esta prueba lo cubre sola.

     Y aquí me equivoqué al escribirla: puse `RESUELTA_OTORGA`, que NO EXISTE.
     vitest no chequea tipos, así que la cadena inventada llegó viva hasta
     `terminoResolucionSigueCorriendo` —que decide con un ARRAY— y salió
     clasificada como CORRIENDO: la tarjeta pintó una cuenta atrás para un
     expediente resuelto. Es exactamente el modo de fallo que advierte el
     comentario del motor, y la razón de leer los estados de la constante. */
  it.each(ESTADOS_RESUELTOS_LICENCIA)('%s no pinta cuenta atrás', (estado) => {
    const { container } = pintar(10, estado);
    expect(container.innerHTML).toBe('');
  });
});

describe('el avance se cuenta sobre el plazo real', () => {
  it('dice qué día de los 45 es hoy, no un porcentaje inventado', () => {
    pintar(20);
    expect(screen.getByText(new RegExp(`de ${PLAZO_DECISION_LICENCIA_DIAS_HABILES}`))).toBeTruthy();
  });
});

describe('el expediente de demostración, con sus fechas reales', () => {
  /* LA CAPTURA DEL PROPIETARIO (29-ago-2026), fielmente:
       DEMO-26-130e665c · Radicada en debida forma
       Ancla: 24/08/2026 · Vencimiento proyectado: 27/10/2026 · Quedan 41 días

     El módulo VIEJO pintaba eso en ROJO, con la caja «FECHA CON LA QUE DEBE
     TRABAJAR» en rojo y 41 días por delante. Ese es el defecto entero, y esta
     prueba lo fija con los valores exactos en vez de con una fecha relativa.

     El reloj va congelado a propósito: sin congelar, el mismo expediente
     pasaría a AVISO en octubre y esta prueba cambiaría de veredicto sola —
     una prueba que muda de opinión con el calendario no prueba nada. */
  const DIA_DE_LA_CAPTURA = new Date('2026-08-29T12:00:00-05:00');

  afterEach(() => vi.useRealTimers());

  function pintarLaDemo() {
    vi.useFakeTimers();
    vi.setSystemTime(DIA_DE_LA_CAPTURA);
    return render(
      <CabeceraTermino
        venceIso="2026-10-27T12:00:00.000Z"
        desdeIso="2026-08-24T12:00:00.000Z"
        estadoJuridico="RADICADA_EN_DEBIDA_FORMA"
        expedienteId="DEMO-26-130e665c"
      />,
    );
  }

  it('sale en VERDE, no en rojo', () => {
    const { container } = pintarLaDemo();
    expect(screen.getByText('En término')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    /* Ningún rojo de la paleta del vigía en toda la tarjeta. */
    expect(container.innerHTML).not.toContain(COLOR_NIVEL_TERMINO.VENCIDO);
    expect(container.innerHTML).not.toContain(COLOR_NIVEL_TERMINO.CRITICO);
  });

  it('conserva la fecha de vencimiento y el ancla que ya mostraba', () => {
    pintarLaDemo();
    expect(screen.getByText(/Vence el 27\/10\/2026/)).toBeTruthy();
    expect(screen.getByText(/desde el 24\/08\/2026/)).toBeTruthy();
  });

  it('y dice que se puede trabajar con calma, en vez de alarmar', () => {
    pintarLaDemo();
    expect(screen.getByText(/puede avanzar con calma/i)).toBeTruthy();
  });
});
