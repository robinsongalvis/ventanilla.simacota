import { describe, expect, it } from 'vitest';
import {
  construirClasificacionInicial,
  construirNotaRadicacion,
} from '@/lib/recepcion/clasificacion-inicial';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación dirigida — clasificación de nacimiento.

   Regla aprobada: destino Ventanilla Única → responsable el actor;
   destino en otra dependencia → nace SIN responsable ("sin asignar"
   dentro de esa dependencia).
══════════════════════════════════════════════════════════════ */

describe('Radicación dirigida — construirClasificacionInicial', () => {
  /* 1 · Ventanilla Única conserva el comportamiento histórico */
  it('con destino VENTANILLA_UNICA el actor queda como responsable', () => {
    const c = construirClasificacionInicial('VENTANILLA_UNICA', 'uid-laura');
    expect(c.oficinaDestino).toBe('VENTANILLA_UNICA');
    expect(c.funcionarioResponsableUid).toBe('uid-laura');
    expect(c.zonaGeografica).toBe('CASCO_URBANO');
  });

  /* 2 · otra dependencia nace sin asignar */
  it('con destino en otra dependencia NO fija funcionario responsable', () => {
    const c = construirClasificacionInicial('SEC_PLANEACION', 'uid-laura');
    expect(c.oficinaDestino).toBe('SEC_PLANEACION');
    expect(c.funcionarioResponsableUid).toBeUndefined();
    // La clave ni siquiera existe — Firestore no acepta undefined.
    expect('funcionarioResponsableUid' in c).toBe(false);
  });

  /* 3 · aplica igual para dependencias sensibles */
  it('Comisaría de Familia también nace sin responsable', () => {
    const c = construirClasificacionInicial('SUB_COMISARIA', 'uid-laura');
    expect('funcionarioResponsableUid' in c).toBe(false);
  });
});

describe('Radicación dirigida — construirNotaRadicacion', () => {
  /* 4 · el formato aprobado, con destino desde el nacimiento */
  it('arma la nota con actor, canal legible y destino', () => {
    expect(construirNotaRadicacion('Laura', 'OFICIO_FISICO', 'SEC_PLANEACION'))
      .toBe('Radicado por Laura · Canal: Oficio físico · Dirigido a: Secretaría de Planeación');
  });

  /* 5 · el default de triage también queda trazado explícito */
  it('con destino Ventanilla Única la nota lo dice igual', () => {
    expect(construirNotaRadicacion('Laura', 'PRESENCIAL', 'VENTANILLA_UNICA'))
      .toContain('Dirigido a: Ventanilla Única');
  });
});
