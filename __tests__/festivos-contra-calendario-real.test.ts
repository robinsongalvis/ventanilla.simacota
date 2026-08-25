import { describe, it, expect } from 'vitest';
import { festivosColombia, sumarDiasHabiles, esDiaHabil } from '@/lib/tiempos-radicado';

/**
 * Las pruebas verdes del motor demuestran que coincide CONSIGO MISMO, no que
 * coincida con el calendario. Este archivo enfrenta el motor a un calendario
 * TRANSCRITO A MANO y a un contador de días hábiles ESCRITO APARTE, para que
 * un error de cómputo no pueda esconderse detrás de su propia definición.
 *
 * Si el motor y este archivo divergen, uno de los dos está mal — y hay que ir
 * al calendario de papel a decidir cuál, no a ajustar el que moleste.
 */

/** Festivos de Colombia en 2026, transcritos del calendario oficial (Ley 51 de 1983). */
const CALENDARIO_2026_A_MANO = [
  '2026-01-01', // Año Nuevo (jueves)
  '2026-01-12', // Reyes — el 6 es martes, se traslada al lunes
  '2026-03-23', // San José — el 19 es jueves, se traslada
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo (viernes)
  '2026-05-18', // Ascensión
  '2026-06-08', // Corpus Christi
  '2026-06-15', // Sagrado Corazón
  '2026-06-29', // San Pedro y San Pablo — cae lunes, no se traslada
  '2026-07-20', // Independencia (lunes)
  '2026-08-07', // Batalla de Boyacá (viernes)
  '2026-08-17', // Asunción — el 15 es sábado, se traslada
  '2026-10-12', // Día de la Raza — cae lunes
  '2026-11-02', // Todos los Santos — el 1 es domingo, se traslada
  '2026-11-16', // Independencia de Cartagena — el 11 es miércoles, se traslada
  '2026-12-08', // Inmaculada Concepción (martes)
  '2026-12-25', // Navidad (viernes)
];

/* Los 45 días de una radicación de diciembre CRUZAN el año. El contador a mano
   nació con solo 2026 y difería del motor en dos días — precisamente los dos
   festivos de enero de 2027 que le faltaban. El motor tenía razón: recalcula
   los festivos del año que va pisando en vez de fijarlos al del inicio. Ese
   comportamiento no estaba cubierto por ninguna prueba; ahora sí. */
const CALENDARIO_2027_PARCIAL = [
  '2027-01-01', // Año Nuevo (viernes)
  '2027-01-11', // Reyes — el 6 es miércoles, se traslada al lunes
];

/** Contador de días hábiles independiente: no comparte una línea con el motor. */
function contarAMano(desdeIso: string, dias: number): string {
  const festivos = new Set([...CALENDARIO_2026_A_MANO, ...CALENDARIO_2027_PARCIAL]);
  const d = new Date(`${desdeIso}T12:00:00`);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !festivos.has(iso)) restantes -= 1;
  }
  return d.toISOString().slice(0, 10);
}

describe('el motor contra el calendario real de 2026', () => {
  it('produce exactamente los 18 festivos del calendario oficial', () => {
    const delMotor = [...festivosColombia(2026)].sort();
    expect(delMotor).toEqual([...CALENDARIO_2026_A_MANO].sort());
  });

  it('no confunde festivos trasladados: el 6 y el 19 son hábiles; el 12 y el 23 no', () => {
    const habil = (iso: string) => esDiaHabil(new Date(`${iso}T12:00:00`));
    expect(habil('2026-01-06')).toBe(true);   // Reyes se trasladó
    expect(habil('2026-01-12')).toBe(false);
    expect(habil('2026-03-19')).toBe(true);   // San José se trasladó
    expect(habil('2026-03-23')).toBe(false);
    expect(habil('2026-06-29')).toBe(false);  // ya era lunes: NO se mueve
  });

  const CASOS: Array<[string, string]> = [
    ['viernes', '2026-08-21'],            // radicación en viernes
    ['víspera de festivo', '2026-12-07'], // lunes, víspera del 8 de diciembre
    ['cruza Semana Santa', '2026-03-16'], // los 45 días atraviesan el 2 y 3 de abril
  ];

  it('el conteo NO se queda con los festivos del año de inicio al cruzar de año', () => {
    // Radicación del 7-dic-2026: los 45 días caen en febrero de 2027 y deben
    // descontar el 1 y el 11 de enero de 2027.
    const conCruce = sumarDiasHabiles(new Date('2026-12-07T12:00:00'), 45).toISOString().slice(0, 10);
    expect(conCruce).toBe('2027-02-12');
  });

  it.each(CASOS)('45 días hábiles desde %s (%s) coinciden con el conteo a mano', (_n, desde) => {
    const delMotor = sumarDiasHabiles(new Date(`${desde}T12:00:00`), 45)
      .toISOString().slice(0, 10);
    expect(delMotor).toBe(contarAMano(desde, 45));
  });
});
