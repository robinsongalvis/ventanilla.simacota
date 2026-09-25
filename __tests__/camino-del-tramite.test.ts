import { describe, it, expect } from 'vitest';
import { PASOS, situacionDePaso } from '@/app/interno/licencias/camino-del-tramite';
import { ESTILOS_ESTADO_JURIDICO } from '@/app/interno/licencias/estilos-estado-juridico';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

/**
 * EL CAMINO NO PUEDE CONTRADECIR A LA CABECERA.
 *
 * Defecto real, visto en pantalla: el paso 2 llevaba «el plazo aún no corre»
 * como cadena fija, así que un expediente ya radicado lo mostraba ✓ CUMPLIDO y
 * a la vez afirmaba que el plazo no corría — mientras la cabecera de la MISMA
 * pantalla decía que vencía el 27/10 y quedaban 41 días hábiles.
 *
 * Dos afirmaciones contrarias sobre el mismo hecho, a diez centímetros una de
 * otra. Estas pruebas impiden que vuelva.
 */

const TODOS = Object.keys(ESTILOS_ESTADO_JURIDICO) as EstadoJuridicoLicencia[];

describe('ningún paso ya cumplido niega el plazo', () => {
  it('un paso CUMPLIDO nunca dice que el plazo no corre', () => {
    for (const paso of PASOS) {
      expect(
        paso.subtexto('CUMPLIDO'),
        `el paso ${paso.numero} sigue negando el plazo después de cumplirse`,
      ).not.toMatch(/aún no corre|todavía no corre|no ha empezado/i);
    }
  });

  it('y el paso 2 solo lo dice mientras se está en él', () => {
    const paso2 = PASOS.find((p) => p.numero === 2)!;
    expect(paso2.subtexto('ACTUAL')).toMatch(/aún no corre/i);
    expect(paso2.subtexto('CUMPLIDO')).not.toMatch(/aún no corre/i);
  });

  it('ningún subtexto queda vacío en ninguna situación', () => {
    for (const paso of PASOS) {
      for (const s of ['CUMPLIDO', 'ACTUAL', 'PENDIENTE'] as const) {
        expect(paso.subtexto(s).length, `paso ${paso.numero} sin texto en ${s}`).toBeGreaterThan(3);
      }
    }
  });
});

describe('en qué paso cae cada estado', () => {
  it('PRESENTADA está completando documentos, no en el primer paso', () => {
    /* La solicitud YA se recibió: ponerla en el 1 haría creer que no se ha
       hecho nada. */
    expect(situacionDePaso(PASOS[1], 'PRESENTADA')).toBe('ACTUAL');
    expect(situacionDePaso(PASOS[0], 'PRESENTADA')).toBe('CUMPLIDO');
  });

  it('radicada en debida forma ya dejó atrás los tres primeros', () => {
    for (const paso of PASOS.slice(0, 3)) {
      expect(situacionDePaso(paso, 'RADICADA_EN_DEBIDA_FORMA')).toBe('CUMPLIDO');
    }
    expect(situacionDePaso(PASOS[3], 'RADICADA_EN_DEBIDA_FORMA')).toBe('ACTUAL');
  });

  it('los once estados caen en algún paso, sin huecos', () => {
    /* Recorre el dominio: un estado nuevo sin paso asignado no compila, pero
       esto además comprueba que ninguno quede sin situación. */
    for (const estado of TODOS) {
      const situaciones = PASOS.map((p) => situacionDePaso(p, estado));
      expect(situaciones.filter((s) => s === 'ACTUAL').length, `${estado}: debe tener UN paso actual`).toBe(1);
    }
  });
});

describe('presentada e incompleta NO es presentada y completa', () => {
  /* Lo vio el propietario en pantalla (29-ago-2026): «17 de 17 · COMPLETO» en
     la barra, y el camino señalando «Completar documentos» como paso ACTUAL.
     Le pedía hacer algo ya hecho, y dejaba sin señalar lo que de verdad
     faltaba: radicar.

     El estado jurídico `PRESENTADA` no distingue los dos momentos. Son
     distintos en el mostrador: uno espera papeles del ciudadano, el otro
     espera un acto de la Administración. */
  const paso2 = PASOS.find((p) => p.numero === 2)!;
  const paso3 = PASOS.find((p) => p.numero === 3)!;

  it('sin completar, el paso actual sigue siendo reunir documentos', () => {
    expect(situacionDePaso(paso2, 'PRESENTADA', false)).toBe('ACTUAL');
    expect(situacionDePaso(paso3, 'PRESENTADA', false)).toBe('PENDIENTE');
  });

  it('completa, el paso 2 queda CUMPLIDO y el actual pasa a radicar', () => {
    expect(situacionDePaso(paso2, 'PRESENTADA', true)).toBe('CUMPLIDO');
    expect(situacionDePaso(paso3, 'PRESENTADA', true)).toBe('ACTUAL');
  });

  it('y entonces el paso 2 habla en pasado, no en presente', () => {
    expect(paso2.subtexto(situacionDePaso(paso2, 'PRESENTADA', true))).toBe('documentación completa');
    expect(paso2.subtexto(situacionDePaso(paso2, 'PRESENTADA', false))).toBe('el plazo aún no corre');
  });

  it('SIN el dato no se supone que esté completa: no saber no es estar completo', () => {
    expect(situacionDePaso(paso2, 'PRESENTADA')).toBe('ACTUAL');
  });
});
