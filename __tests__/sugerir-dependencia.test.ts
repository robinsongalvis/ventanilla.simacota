import { describe, expect, it } from 'vitest';
import { sugerirDependencia } from '@/lib/recepcion/sugerir-dependencia';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación dirigida — sugerencia determinista de destino.

   Solo sugiere: la decisión siempre es de la funcionaria. Mapa
   inicial aprobado, para afinar con casos reales.
══════════════════════════════════════════════════════════════ */

describe('Radicación dirigida — sugerirDependencia', () => {
  /* 1 · palabras de Hacienda */
  it("'predial' e 'impuestos' sugieren Hacienda", () => {
    const s = sugerirDependencia({ asunto: 'Paz y salvo del impuesto predial' });
    expect(s?.oficina).toBe('SEC_HACIENDA');
    expect(s?.razon).toContain('por ');
  });

  /* 2 · palabras de Planeación, insensible a tildes */
  it("'licencia de construcción' con tildes sugiere Planeación", () => {
    const s = sugerirDependencia({ asunto: 'Solicitud de licencia de construcción' });
    expect(s?.oficina).toBe('SEC_PLANEACION');
    expect(s?.nombre).toMatch(/Planeación/i);
  });

  /* 3 · los casos sensibles de Comisaría ganan sobre cualquier otra señal */
  it("'violencia' gana aunque el texto también hable de contratación", () => {
    const s = sugerirDependencia({
      asunto: 'Denuncia de violencia en proceso de contratación',
    });
    expect(s?.oficina).toBe('SUB_COMISARIA');
  });

  /* 4 · el tipo de trámite con dependencia obvia sugiere solo */
  it('tipo LICENCIA_CONSTRUCCION sugiere Planeación con asunto genérico', () => {
    const s = sugerirDependencia({
      tipoSolicitudId: 'LICENCIA_CONSTRUCCION',
      asunto: 'Solicitud del ciudadano',
    });
    expect(s?.oficina).toBe('SEC_PLANEACION');
    expect(s?.razon).toBe('por el tipo de trámite');
  });

  /* 5 · texto genérico no inventa sugerencia */
  it('devuelve null cuando no hay señal clara', () => {
    expect(sugerirDependencia({ asunto: 'Petición general del ciudadano' })).toBeNull();
  });

  /* 6 · coincidencia al inicio de palabra, no dentro de otra */
  it("'menores' matchea pero 'sumenor' no", () => {
    expect(sugerirDependencia({ asunto: 'Protección de menores' })?.oficina).toBe('SUB_COMISARIA');
    expect(sugerirDependencia({ asunto: 'Radicado sumenor' })).toBeNull();
  });
});
