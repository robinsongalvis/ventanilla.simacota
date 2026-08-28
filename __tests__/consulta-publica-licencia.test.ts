import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  aLicenciaPublica,
  ESTADO_CIUDADANO_LICENCIA,
  PLAZO_SIN_EMPEZAR_CIUDADANO,
} from '@/lib/seguridad/consulta-publica-licencia';
import { ESTILOS_ESTADO_JURIDICO } from '@/app/interno/licencias/estilos-estado-juridico';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

/**
 * LO QUE EL CIUDADANO VE DE SU LICENCIA.
 *
 * El ADR-0034 §7 dejó esto abierto por dos reparos: faltaba vocabulario
 * ciudadano y un segundo factor propio. El segundo se resolvió reutilizando la
 * consulta que ya existe; el primero es lo que estas pruebas custodian.
 */

const TODOS = Object.keys(ESTILOS_ESTADO_JURIDICO) as EstadoJuridicoLicencia[];

describe('el vocabulario cubre TODOS los estados', () => {
  it('no falta ninguno, y se descubren solos', () => {
    /* Recorrer el dominio en vez de escribir una lista: un estado nuevo entra
       en esta prueba sin que nadie se acuerde de añadirlo. */
    for (const estado of TODOS) {
      expect(ESTADO_CIUDADANO_LICENCIA[estado], `sin texto ciudadano: ${estado}`).toBeTruthy();
      expect(ESTADO_CIUDADANO_LICENCIA[estado].titulo.length).toBeGreaterThan(0);
      expect(ESTADO_CIUDADANO_LICENCIA[estado].explicacion.length).toBeGreaterThan(0);
    }
  });

  it('y ninguno reutiliza la etiqueta interna', () => {
    /* «Con acta de observaciones» es exacto y no significa nada fuera de
       Planeación. Copiarla habría sido gratis y habría dejado al ciudadano
       igual de perdido, creyendo que le informamos. */
    for (const estado of TODOS) {
      expect(
        ESTADO_CIUDADANO_LICENCIA[estado].titulo,
        `${estado}: el título ciudadano es la etiqueta interna copiada`,
      ).not.toBe(ESTILOS_ESTADO_JURIDICO[estado].label);
    }
  });

  it('habla de USTED, no del expediente', () => {
    /* La diferencia entre informar y notificar: el sujeto de la frase es la
       persona, no el trámite. */
    const conSujeto = TODOS.filter((e) =>
      /\b(su|usted|le)\b/i.test(`${ESTADO_CIUDADANO_LICENCIA[e].titulo} ${ESTADO_CIUDADANO_LICENCIA[e].explicacion}`),
    );
    expect(conSujeto.length, 'todos los textos deben dirigirse a la persona').toBe(TODOS.length);
  });
});

describe('lo que le toca hacer al ciudadano', () => {
  it('las observaciones exigen que complete', () => {
    expect(ESTADO_CIUDADANO_LICENCIA.CON_ACTA_DE_OBSERVACIONES.accionDelCiudadano).toBe('DEBE_COMPLETAR');
  });

  it('concedida y negada exigen que se notifique — también la negada', () => {
    /* La negada también se notifica: de ahí corren los plazos para recurrir, y
       callarlo le quitaría al ciudadano su recurso por desconocimiento. */
    expect(ESTADO_CIUDADANO_LICENCIA.CONCEDIDA.accionDelCiudadano).toBe('DEBE_NOTIFICARSE');
    expect(ESTADO_CIUDADANO_LICENCIA.NEGADA.accionDelCiudadano).toBe('DEBE_NOTIFICARSE');
    expect(ESTADO_CIUDADANO_LICENCIA.NEGADA.explicacion).toMatch(/recursos/i);
  });

  it('los estados de espera NO le piden nada', () => {
    for (const estado of ['PRESENTADA', 'EN_REVISION', 'EN_VIABILIDAD'] as const) {
      expect(ESTADO_CIUDADANO_LICENCIA[estado].accionDelCiudadano).toBe('NINGUNA');
    }
  });

  it('PRESENTADA dice que el plazo todavía no corre', () => {
    /* Es el caso cotidiano —entrega parcial en mostrador— y el que más
       malentendidos causa: el ciudadano cree que su plazo empezó. */
    expect(ESTADO_CIUDADANO_LICENCIA.PRESENTADA.explicacion).toMatch(/no ha empezado a correr/i);
  });
});

describe('la proyección pública', () => {
  it('dice la frase exacta cuando el plazo no corre', () => {
    const p = aLicenciaPublica({
      numeroExpediente: '1-110-202608-00000123',
      estadoJuridico: 'PRESENTADA',
      fechaRadicacionDebidaForma: null,
    });
    expect(p.avisoPlazo).toBe(PLAZO_SIN_EMPEZAR_CIUDADANO);
    expect(p.desdeCuandoCorreElPlazo).toBeNull();
  });

  it('y ninguna cuando sí corre', () => {
    const p = aLicenciaPublica({
      numeroExpediente: '1-110-202608-00000123',
      estadoJuridico: 'EN_REVISION',
      fechaRadicacionDebidaForma: '2026-08-20T12:00:00Z',
    });
    expect(p.avisoPlazo).toBeNull();
    expect(p.desdeCuandoCorreElPlazo).toBe('2026-08-20T12:00:00Z');
  });

  it('expone exactamente cuatro claves, y ninguna del expediente', () => {
    const p = aLicenciaPublica({
      numeroExpediente: 'X',
      estadoJuridico: 'EN_REVISION',
      fechaRadicacionDebidaForma: null,
    });
    expect(Object.keys(p).sort()).toEqual(
      ['avisoPlazo', 'desdeCuandoCorreElPlazo', 'estado', 'numeroExpediente'].sort(),
    );
  });
});

describe('la ruta pública, leída como código', () => {
  const RUTA = readFileSync('app/api/public/radicado/consulta/route.ts', 'utf8');
  const soloCodigo = RUTA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('lee la licencia DESPUÉS de verificar al ciudadano', () => {
    /* Si se leyera antes, la existencia del expediente sería observable sin
       pasar el segundo factor. */
    /* Se miden las LLAMADAS, no los identificadores: la primera aparición de
       `verificarDatoConsulta` es su import, que va arriba del archivo y haría
       pasar esta comprobación siempre. Lo descubrí porque falló. */
    const llamadaVerificar = soloCodigo.indexOf('verificarDatoConsulta(radicado');
    const llamadaLicencia = soloCodigo.indexOf('aLicenciaPublica({');
    expect(llamadaVerificar, 'no se encontró la llamada a verificarDatoConsulta').toBeGreaterThan(-1);
    expect(llamadaLicencia, 'no se encontró la llamada a aLicenciaPublica').toBeGreaterThan(-1);
    expect(llamadaVerificar).toBeLessThan(llamadaLicencia);
  });

  it('NO pasa el expediente entero al mapper', () => {
    /* Pasarlo dejaría la puerta abierta a que un campo nuevo se cuele en una
       respuesta PÚBLICA por olvido. Se pasan tres campos nombrados. */
    expect(soloCodigo).not.toMatch(/aLicenciaPublica\(\s*exp\s*\)/);
    expect(soloCodigo).toMatch(/estadoJuridico: exp\.estadoJuridico/);
  });

  it('un fallo leyendo la licencia no tumba la consulta del radicado', () => {
    /* El ciudadano vino a ver su radicado: si el expediente no se puede leer,
       el bloque sale ausente, no roto. */
    expect(soloCodigo).toMatch(/catch\s*\{\s*licencia = null;/);
  });
});
