import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CODIGO_TRD_DEPENDENCIA,
  FUENTE_TRD,
  labelSerieDocumental,
  sugerirSerieDocumental,
} from '@/lib/catalogos/series-documentales';

/* ══════════════════════════════════════════════════════════════
   Sprint Serie documental — el radicado nace clasificado en su
   serie TRD. Fuente: borrador 2025 (decisión del usuario: se
   implementa ya; la TRD aprobada solo actualiza el catálogo).
══════════════════════════════════════════════════════════════ */

describe('sugerirSerieDocumental', () => {
  it('una petición dirigida a Gobierno cae en 110.12 Derechos de Petición', () => {
    const serie = sugerirSerieDocumental('PETICION_GENERAL', 'SEC_GOBIERNO');
    expect(serie).toEqual({
      codigo: '110.12',
      nombre: 'Derechos de Petición',
      fuente: FUENTE_TRD,
    });
  });

  it('el código de oficina productora sigue al destino', () => {
    expect(sugerirSerieDocumental('QUEJA', 'DESPACHO_ALCALDE')?.codigo).toBe('100.12');
    expect(sugerirSerieDocumental('RECLAMO', 'SEC_HACIENDA')?.codigo).toBe('130.12');
    expect(sugerirSerieDocumental('DENUNCIA', 'SEC_DESARROLLO_SOCIAL')?.codigo).toBe('140.12');
  });

  it('las sub-oficinas heredan el código de su dependencia', () => {
    expect(sugerirSerieDocumental('PETICION_GENERAL', 'SUB_COMISARIA')?.codigo).toBe('111.12');
    expect(sugerirSerieDocumental('PETICION_GENERAL', 'SUB_SISBEN')?.codigo).toBe('120.12');
  });

  it('licencia de construcción cae en la subserie 22.01 de Planeación', () => {
    const serie = sugerirSerieDocumental('LICENCIA_CONSTRUCCION', 'SEC_PLANEACION');
    expect(serie?.codigo).toBe('120.22.01');
  });

  it('querella policial cae en proceso verbal abreviado (26.07)', () => {
    expect(sugerirSerieDocumental('QUERELLA', 'SUB_INSPECCION_POLICIA_URBANA')?.codigo)
      .toBe('112.26.07');
  });

  it('lo informativo y las invitaciones se clasifican en archivo (null)', () => {
    expect(sugerirSerieDocumental('INFORMATIVO', 'SEC_GOBIERNO')).toBeNull();
    expect(sugerirSerieDocumental('INVITACION', 'DESPACHO_ALCALDE')).toBeNull();
  });

  it('un destino sin código TRD no inventa clasificación', () => {
    expect(CODIGO_TRD_DEPENDENCIA['VENTANILLA_UNICA' as never]).toBe('110');
    // Tenant hipotético fuera del mapa → null, jamás un código malformado.
    expect(sugerirSerieDocumental('PETICION_GENERAL', 'TENANT_INEXISTENTE' as never)).toBeNull();
  });
});

describe('labelSerieDocumental', () => {
  it('arma la etiqueta corta y el fallback honesto', () => {
    expect(labelSerieDocumental({ codigo: '110.12', nombre: 'Derechos de Petición', fuente: FUENTE_TRD }))
      .toBe('110.12 · Derechos de Petición');
    expect(labelSerieDocumental(null)).toBe('Se clasifica en archivo');
  });
});

describe('integración — el radicado nace con la serie', () => {
  it('la acción de radicar persiste la foto de la serie en la clasificación', () => {
    const accion = readFileSync('lib/actions/radicarVentanilla.ts', 'utf8');
    expect(accion).toContain('sugerirSerieDocumental');
    expect(accion).toContain('serieDocumental: serie');
  });

  it('la Radicación Rápida muestra la serie derivada', () => {
    const form = readFileSync('app/interno/recepcion/components/RadicacionFuncionarioForm.tsx', 'utf8');
    expect(form).toContain('Serie documental (TRD)');
    expect(form).toContain('labelSerieDocumental(serieSugerida)');
  });
});
