import { describe, expect, it } from 'vitest';
import {
  agruparDestinosPorDependencia,
  areasParaDependencia,
  CATALOGO_AREAS,
  getNombreArea,
  validarAreaParaDestino,
} from '@/lib/catalogos/areas';
import type { TenantId } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   Fase 2 · Áreas — catálogo curado de Simacota.

   Fuente: Laura + capacitación + equipo (2026-07-04). Transversales
   reales: Almacén y Archivo (una sola) + Sistemas. Jurídica, Talento
   Humano y Enlace JAC pertenecen SIEMPRE a Gobierno. Ambiental es de
   Planeación (confirmado de primera mano).
══════════════════════════════════════════════════════════════ */

describe('Fase 2 — catálogo de áreas', () => {
  /* 1 · las decisiones curadas quedaron fieles */
  it('registra las pertenencias decididas por la administración', () => {
    expect(CATALOGO_AREAS.JURIDICA.dependencia).toBe('SEC_GOBIERNO');
    expect(CATALOGO_AREAS.TALENTO_HUMANO.dependencia).toBe('SEC_GOBIERNO');
    expect(CATALOGO_AREAS.ENLACE_JAC.dependencia).toBe('SEC_GOBIERNO');
    expect(CATALOGO_AREAS.AMBIENTAL.dependencia).toBe('SEC_PLANEACION');
    expect(CATALOGO_AREAS.CULTURA.dependencia).toBe('SEC_DESARROLLO_SOCIAL');
    expect(CATALOGO_AREAS.ALMACEN_ARCHIVO.transversal).toBe(true);
    expect(CATALOGO_AREAS.SISTEMAS.transversal).toBe(true);
  });

  /* 2 · el selector de Gobierno: propias sin tenant + transversales */
  it('areasParaDependencia(SEC_GOBIERNO) trae propias asignables y transversales', () => {
    const ids = areasParaDependencia('SEC_GOBIERNO').map((a) => a.areaId);
    expect(ids).toContain('JURIDICA');
    expect(ids).toContain('TALENTO_HUMANO');
    expect(ids).toContain('CONTRATACION');
    expect(ids).toContain('ALMACEN_ARCHIVO');
    expect(ids).toContain('SISTEMAS');
    // Las de tenant propio NO: a Comisaría se llega trasladando el destino.
    expect(ids).not.toContain('COMISARIA_FAMILIA');
    // Las de otras dependencias tampoco.
    expect(ids).not.toContain('AMBIENTAL');
  });

  /* 3 · una dependencia sin áreas propias solo ve transversales */
  it('UMATA solo recibe las transversales', () => {
    const ids = areasParaDependencia('SEC_AGRICULTURA_UMATA').map((a) => a.areaId);
    expect(ids).toEqual(expect.arrayContaining(['ALMACEN_ARCHIVO', 'SISTEMAS']));
    expect(ids).toHaveLength(2);
  });

  /* 4 · el validador del endpoint */
  it('validarAreaParaDestino acepta propias y transversales, rechaza el resto', () => {
    expect(validarAreaParaDestino('JURIDICA', 'SEC_GOBIERNO')).toBeNull();
    expect(validarAreaParaDestino('ALMACEN_ARCHIVO', 'SEC_HACIENDA')).toBeNull();
    expect(validarAreaParaDestino('JURIDICA', 'SEC_HACIENDA'))
      .toMatch(/no pertenece/i);
    expect(validarAreaParaDestino('COMISARIA_FAMILIA', 'SEC_GOBIERNO'))
      .toMatch(/destino propio/i);
    expect(validarAreaParaDestino('NO_EXISTE', 'SEC_GOBIERNO'))
      .toMatch(/desconocida/i);
  });

  /* 5 · nombres legibles con fallback */
  it('getNombreArea resuelve el nombre y tolera desconocidos', () => {
    expect(getNombreArea('ALMACEN_ARCHIVO')).toBe('Almacén y Archivo');
    expect(getNombreArea('X_RARO')).toBe('X_RARO');
    expect(getNombreArea(null)).toBe('');
  });

  /* 6 · el selector agrupado (idea de Laura): Gobierno despliega las suyas */
  it('agruparDestinosPorDependencia cuelga las oficinas bajo su dependencia', () => {
    const tenants: TenantId[] = [
      'VENTANILLA_UNICA', 'SEC_GOBIERNO', 'SUB_COMISARIA',
      'SUB_INSPECCION_POLICIA_URBANA', 'SEC_AGRICULTURA_UMATA', 'SUB_SISBEN', 'SEC_PLANEACION',
    ];
    const grupos = agruparDestinosPorDependencia(tenants);
    const gobierno = grupos.find((g) => g.dependencia === 'SEC_GOBIERNO');
    expect(gobierno?.oficinas.map((o) => o.tenant))
      .toEqual(expect.arrayContaining(['SUB_COMISARIA', 'SUB_INSPECCION_POLICIA_URBANA']));
    // Las oficinas NO aparecen como grupos raíz.
    expect(grupos.map((g) => g.dependencia)).not.toContain('SUB_COMISARIA');
    expect(grupos.map((g) => g.dependencia)).not.toContain('SUB_SISBEN');
    // Sisbén cuelga de Planeación; UMATA queda como opción simple.
    expect(grupos.find((g) => g.dependencia === 'SEC_PLANEACION')?.oficinas.map((o) => o.tenant))
      .toContain('SUB_SISBEN');
    expect(grupos.find((g) => g.dependencia === 'SEC_AGRICULTURA_UMATA')?.oficinas).toHaveLength(0);
  });
});
