import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  accionesDeCierreDisponibles,
  puedeExpedirEjecutoria,
} from '@/app/interno/licencias/acciones-de-cierre';

/**
 * QUE LA CADENA DE CIERRE SEA ALCANZABLE.
 *
 * En #266 construí las seis actuaciones y NINGUNA tenía llamador en la
 * interfaz: el mismo defecto que diagnostiqué en #234 —construido e
 * inalcanzable— reproducido por mí una semana después. Esta prueba lo impide.
 */

const soloCodigo = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const DETALLE = soloCodigo(readFileSync('app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx', 'utf8'));
const RUTA_ACT = soloCodigo(readFileSync('app/api/licencias/expedientes/[id]/actuaciones/route.ts', 'utf8'));

describe('los botones salen del mapa de transiciones', () => {
  it('desde EN_VIABILIDAD se ofrece conceder, negar y desistir', () => {
    const tipos = accionesDeCierreDisponibles('EN_VIABILIDAD', { yaHuboActa: false }).map((a) => a.tipo);
    expect(tipos).toContain('resolucion-concede');
    expect(tipos).toContain('resolucion-niega');
    expect(tipos).toContain('desistimiento-expreso');
  });

  it('desde CONCEDIDA solo se ofrece notificar', () => {
    const tipos = accionesDeCierreDisponibles('CONCEDIDA', { yaHuboActa: false }).map((a) => a.tipo);
    expect(tipos).toEqual(['notificacion']);
  });

  it('desde NOTIFICADA solo la firmeza', () => {
    expect(accionesDeCierreDisponibles('NOTIFICADA', { yaHuboActa: false }).map((a) => a.tipo))
      .toEqual(['firmeza']);
  });

  it('EN_FIRME no ofrece nada: es el final', () => {
    expect(accionesDeCierreDisponibles('EN_FIRME', { yaHuboActa: false })).toEqual([]);
  });

  it('el tácito SOLO se ofrece si hubo acta', () => {
    /* Ofrecerlo sin acta invitaría a archivar por un incumplimiento que nadie
       requirió. */
    const sinActa = accionesDeCierreDisponibles('EN_REVISION', { yaHuboActa: false }).map((a) => a.tipo);
    expect(sinActa).not.toContain('desistimiento-tacito');

    const conActa = accionesDeCierreDisponibles('CON_ACTA_DE_OBSERVACIONES', { yaHuboActa: true }).map((a) => a.tipo);
    expect(conActa).toContain('desistimiento-tacito');
    expect(conActa, 'el expreso sigue disponible: son dos hechos distintos').toContain('desistimiento-expreso');
  });

  it('un expediente que no ha llegado a decisión no ofrece cierres de fondo', () => {
    const tipos = accionesDeCierreDisponibles('PRESENTADA', { yaHuboActa: false }).map((a) => a.tipo);
    expect(tipos).not.toContain('resolucion-concede');
    expect(tipos).not.toContain('resolucion-niega');
  });
});

describe('la constancia de ejecutoria', () => {
  it('solo se ofrece cuando el acto está EN FIRME', () => {
    expect(puedeExpedirEjecutoria('EN_FIRME')).toBe(true);
    for (const e of ['CONCEDIDA', 'NOTIFICADA', 'EN_VIABILIDAD'] as const) {
      expect(puedeExpedirEjecutoria(e), `${e} no puede expedir ejecutoria`).toBe(false);
    }
  });
});

describe('la cadena es alcanzable de verdad', () => {
  it('el detalle monta los botones derivados', () => {
    expect(DETALLE).toMatch(/accionesDeCierreDisponibles\(/);
    expect(DETALLE).toMatch(/accionesDeCierre\.map\(/);
  });

  it('y el enlace a la constancia de ejecutoria', () => {
    expect(DETALLE).toMatch(/\/ejecutoria/);
  });

  it('la ruta de actuaciones DISPARA el correo de hito', () => {
    /* Los correos entraron en #265 sin disparador: avisos construidos para
       estados que ninguna ruta escribía. */
    expect(RUTA_ACT).toMatch(/componerCorreoHito\(/);
    expect(RUTA_ACT).toMatch(/buildHitoLicenciaHtml\(/);
  });

  it('el correo de hito no revierte la actuación si falla', () => {
    /* Best-effort, post-commit: el hecho quedó registrado aunque el aviso no
       saliera. */
    expect(RUTA_ACT).toMatch(/modulo: 'licencias\/actuaciones\/hito'/);
  });
});
