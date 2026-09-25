import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  aplicarResultadoEnvio,
  elActaNoSeComunico,
  hayComunicacionFallida,
  QUE_HACER,
  NOMBRE_CLASE,
} from '@/lib/server/comunicacion-fallida';

/**
 * LA MARCA DE CORREO FALLIDO — requisito vinculante del ADR-0033 §4.7-bis,
 * incumplido hasta ahora.
 *
 * El resultado del envío viajaba en la respuesta HTTP y se evaporaba: la
 * funcionaria veía la actuación registrada y nada le decía que el aviso al
 * ciudadano no salió. Peor que no avisar, porque el sistema parecía haberlo
 * hecho.
 */

const HOY = '2026-08-29T12:00:00.000Z';
const fallo = (dest = 'ana@correo.com') => ({ exito: false, destinatario: dest, fechaIso: HOY });
const exito = (dest = 'ana@correo.com') => ({ exito: true, destinatario: dest, fechaIso: HOY });

describe('cada clase se marca por separado', () => {
  it('un fallo queda registrado con a quién y cuándo', () => {
    const m = aplicarResultadoEnvio(undefined, 'ACTA', fallo());
    expect(m?.ACTA).toEqual({ fechaIso: HOY, destinatario: 'ana@correo.com' });
  });

  it('un envío exitoso limpia SOLO su clase', () => {
    /* Si el acta falló y semanas después sale bien un correo de hito, la marca
       del acta SIGUE EN PIE: son hechos distintos, y dejar que uno borre al
       otro escondería justo el que tiene efecto jurídico. */
    const conActaFallida = aplicarResultadoEnvio(undefined, 'ACTA', fallo());
    const trasHitoExitoso = aplicarResultadoEnvio(conActaFallida ?? undefined, 'HITO', exito());
    expect(trasHitoExitoso?.ACTA, 'el fallo del acta no puede borrarse solo').toBeTruthy();
  });

  it('reintentar la MISMA clase con éxito sí la limpia', () => {
    const conActaFallida = aplicarResultadoEnvio(undefined, 'ACTA', fallo());
    const tras = aplicarResultadoEnvio(conActaFallida ?? undefined, 'ACTA', exito());
    expect(tras).toBeNull();
  });

  it('sin marcas devuelve null, no un objeto vacío', () => {
    /* Un `{}` guardado se leería como «hay algo» al comprobar existencia. El
       `null` le dice al llamador que BORRE el campo. */
    expect(aplicarResultadoEnvio(undefined, 'HITO', exito())).toBeNull();
    expect(hayComunicacionFallida({})).toBe(false);
  });

  it('conviven fallos de clases distintas', () => {
    let m = aplicarResultadoEnvio(undefined, 'ACUSE', fallo());
    m = aplicarResultadoEnvio(m ?? undefined, 'ACTA', fallo());
    expect(Object.keys(m ?? {}).sort()).toEqual(['ACTA', 'ACUSE']);
  });
});

describe('el fallo del ACTA no es uno más', () => {
  it('se puede preguntar por él aparte', () => {
    const m = aplicarResultadoEnvio(undefined, 'ACTA', fallo());
    expect(elActaNoSeComunico(m ?? undefined)).toBe(true);
    expect(elActaNoSeComunico(aplicarResultadoEnvio(undefined, 'HITO', fallo()) ?? undefined)).toBe(false);
  });

  it('y su instrucción dice que el plazo NO ha empezado', () => {
    /* Es la consecuencia que la funcionaria tiene que conocer: si el acta no se
       comunicó, no se puede archivar por desistimiento tácito a alguien a quien
       nunca se le requirió. */
    expect(QUE_HACER.ACTA).toMatch(/NO ha empezado/);
    expect(QUE_HACER.ACTA).toMatch(/desistimiento tácito/i);
  });

  it('las otras dos dicen expresamente que no cambian plazos', () => {
    expect(QUE_HACER.ACUSE).toMatch(/no afecta ningún plazo/i);
    expect(QUE_HACER.HITO).toMatch(/no cambia ningún plazo/i);
  });

  it('cada clase tiene nombre legible, sin códigos', () => {
    for (const [clase, nombre] of Object.entries(NOMBRE_CLASE)) {
      expect(nombre, `${clase} sin nombre legible`).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('la marca es alcanzable: se persiste y se muestra', () => {
  const soloCodigo = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const ACT = soloCodigo(readFileSync('app/api/licencias/expedientes/[id]/actuaciones/route.ts', 'utf8'));
  const DESDE = soloCodigo(readFileSync('app/api/licencias/expedientes/desde-radicado/route.ts', 'utf8'));
  const PANEL = soloCodigo(readFileSync('app/interno/licencias/components/PanelDetalleExpediente.tsx', 'utf8'));

  it('las TRES rutas de envío registran su resultado', () => {
    /* El requisito llevaba incumplido desde que existió el primer correo de
       licencias: el resultado se guardaba en una variable local. */
    expect(ACT, 'falta el registro del hito').toMatch(/'HITO'/);
    expect(ACT, 'falta el registro del acta').toMatch(/'ACTA'/);
    expect(DESDE, 'falta el registro del acuse').toMatch(/'ACUSE'/);
  });

  it('y el detalle del expediente la muestra', () => {
    expect(PANEL).toMatch(/<AvisoComunicacionFallida[\s/>]/);
  });

  it('cuando no queda ninguna marca, el campo se BORRA', () => {
    /* Guardar `{}` dejaría un campo que existe y no dice nada. */
    expect(ACT).toMatch(/FieldValue\.delete\(\)/);
  });
});
