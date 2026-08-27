import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { areasParaDependencia, getNombreArea } from '@/lib/catalogos/areas';

/* ══════════════════════════════════════════════════════════════
   Sprint Área al radicar — el radicado puede nacer con la
   sub-oficina o programa del destino (opcional, nunca obligatorio:
   el modelo Dependencia + Área no es un árbol rígido).

   Estructura confirmada por el usuario (jul 2026): Familias en
   Acción, Adulto Mayor y Discapacidad pertenecen a la Secretaría
   de Desarrollo Social (la TRD 2025 que los ubicaba en "Salud" es
   un borrador no aprobado).
══════════════════════════════════════════════════════════════ */

describe('catálogo — programas de Desarrollo Social', () => {
  it('los tres programas confirmados existen bajo SEC_DESARROLLO_SOCIAL', () => {
    const ids = areasParaDependencia('SEC_DESARROLLO_SOCIAL').map((a) => a.areaId);
    expect(ids).toContain('FAMILIAS_EN_ACCION');
    expect(ids).toContain('ADULTO_MAYOR');
    expect(ids).toContain('DISCAPACIDAD');
  });

  it('con nombres en lenguaje ciudadano', () => {
    expect(getNombreArea('FAMILIAS_EN_ACCION')).toBe('Familias en Acción');
    expect(getNombreArea('ADULTO_MAYOR')).toBe('Adulto Mayor');
    expect(getNombreArea('DISCAPACIDAD')).toBe('Discapacidad');
  });
});

describe('Radicación Rápida — selector de área', () => {
  const form = readFileSync('app/interno/recepcion/components/RadicacionFuncionarioForm.tsx', 'utf8');

  it('ofrece el área del destino como opcional, nunca obligatoria', () => {
    expect(form).toContain('Área o programa (opcional)');
    expect(form).toContain('La dependencia asigna después');
    expect(form).toContain('areasParaDependencia(form.oficinaDestino)');
  });

  it('cambiar de dependencia limpia el área elegida', () => {
    expect(form).toContain("update('areaResponsable', '')");
  });

  it('el desplegable de destino también lista las áreas de cada dependencia', () => {
    // Pedido del usuario (jul 2026): un solo desplegable donde cada
    // secretaría muestre sus áreas/programas; elegir una fija destino
    // + área en un solo gesto. Las transversales no se repiten por
    // grupo: viven solo en el selector de área.
    expect(form).toContain("v.startsWith('AREA::')");
    expect(form).toContain('`AREA::${g.dependencia}::${a.areaId}`');
    expect(form).toContain('.filter((a) => !a.transversal)');
    expect(form).toContain('areaPropiaDelDestino');
  });
});

describe('acción de radicar — el área viaja a la clasificación', () => {
  it('clasificacion.areaResponsable se escribe solo si viene con valor', () => {
    // Pieza angular (P2.1) Fase 1 — la acción sigue calculando el valor
    // (trim de datos.areaResponsable), pero la escritura CONDICIONAL en
    // clasificacion.areaResponsable (solo si hay valor) se movió al
    // constructor puro compartido `lib/recepcion/construir-radicado.ts`.
    // Re-apuntada en el PR-C: en el handler del servidor, areaResponsable
    // entra por el lector genérico campo(), y ES campo() quien hace trim —
    // dos hechos, dos aserciones (si cualquiera cambia, esto delata).
    const ruta = readFileSync('app/api/radicacion/interna/route.ts', 'utf8');
    expect(ruta).toContain('campo(formData, CAMPOS_RADICACION_INTERNA.areaResponsable)');
    expect(ruta).toMatch(/function campo\([\s\S]{0,200}?\.trim\(\)/);
    const constructor = readFileSync('lib/recepcion/construir-radicado.ts', 'utf8');
    expect(constructor).toContain('entrada.areaResponsable ? { areaResponsable: entrada.areaResponsable } : {}');
  });
});
