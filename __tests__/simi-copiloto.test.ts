import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { ChecklistMipg } from '@/src/types/simi-juridico';
import {
  resumirEntendimiento,
  salidasParaRol,
  resumirChecklist,
  resumirRiesgo,
} from '@/lib/simi/copiloto';

/* ══════════════════════════════════════════════════════════════
   Sprint SIMI copiloto (Fase 1) — la lógica pura del copiloto.

   Referencia fija: jueves 2 jul 2026 15:00 UTC → 10:00 Colombia.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  const id = '1-EMAIL-2026-00000022';
  return {
    radicadoId: id,
    estadoActual: 'ASIGNADO',
    ultimaActualizacion: AHORA.toISOString(),
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1',
      nombreCompleto: 'Mónica Barbosa',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: id, consecutivo: 22, fechaRadicado: '2026-06-25T14:00:00.000Z',
      horaRadicado: '09:00', medioRecepcion: 'EMAIL', origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15, unidad: 'HABILES',
      fechaVencimiento: '2026-07-20T09:00:00.000Z', prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO',
    },
    detalle: { asunto: 'Copia de contrato', descripcion: 'Solicito copia del contrato de mantenimiento.', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

const CHECKLIST_OK: ChecklistMipg = {
  claridad: true, respuestaFondo: true, oportunidad: true, trazabilidad: true,
  competencia: true, proteccionDatos: true, gestionDocumental: true,
  requiereRevisionJuridica: false, observaciones: [],
};

describe('SIMI copiloto — resumirEntendimiento', () => {
  /* 1 · con análisis: usa el resumen de la IA y la confianza en % */
  it('toma el resumen ejecutivo y la confianza del análisis de IA', () => {
    const e = resumirEntendimiento(radicado({
      analisisIa: {
        resumenEjecutivo: 'El ciudadano solicita copia del contrato de mantenimiento de vehículos.',
        etiquetasSemanticas: ['contratación'],
        dependenciaSugerida: 'SEC_PLANEACION',
        confianzaClasificacion: 0.86,
        fechaAnalisis: AHORA.toISOString(),
      },
    }), AHORA);
    expect(e.resumen).toContain('copia del contrato');
    expect(e.confianzaPct).toBe(86);
    expect(e.dependenciaSugerida).toBe('Secretaría de Planeación');
    expect(e.tieneAnalisis).toBe(true);
  });

  /* 2 · sin análisis: cae al detalle del radicado, sin inventar confianza */
  it('sin análisis usa la descripción y deja la confianza en null', () => {
    const e = resumirEntendimiento(radicado(), AHORA);
    expect(e.resumen).toBe('Solicito copia del contrato de mantenimiento.');
    expect(e.confianzaPct).toBeNull();
    expect(e.dependenciaSugerida).toBeNull();
    expect(e.tieneAnalisis).toBe(false);
  });

  /* 3 · el chip de trámite arma tipo + días + unidad */
  it('construye el chip de trámite con tipo, días y unidad', () => {
    expect(resumirEntendimiento(radicado(), AHORA).chipTramite)
      .toBe('Petición general · 15d hábiles');
  });

  /* 4 · los días restantes salen del término */
  it('calcula los días hábiles restantes', () => {
    expect(resumirEntendimiento(radicado(), AHORA).diasRestantes).toBeGreaterThan(0);
  });
});

describe('SIMI copiloto — salidasParaRol', () => {
  /* 5 · roles que redactan ven las 3 salidas */
  it('Funcionario y Recepción ven respuesta, resumen y argumentación', () => {
    for (const rol of ['FUNCIONARIO', 'RECEPCIONISTA', 'ADMIN'] as const) {
      const ids = salidasParaRol(rol).map((s) => s.id);
      expect(ids).toContain('RESPUESTA');
      expect(ids).toHaveLength(3);
    }
  });

  /* 6 · roles de lectura no ven "Respuesta jurídica" */
  it('Jefe y Control Interno no proyectan respuesta', () => {
    for (const rol of ['JEFE_DEPENDENCIA', 'CONTROL_INTERNO'] as const) {
      const ids = salidasParaRol(rol).map((s) => s.id);
      expect(ids).not.toContain('RESPUESTA');
      expect(ids).toEqual(['RESUMEN', 'ARGUMENTACION']);
    }
  });
});

describe('SIMI copiloto — resumirChecklist', () => {
  /* 7 · todo en verde */
  it('cuenta 7/7 y marca todoEnVerde cuando todo cumple', () => {
    const r = resumirChecklist(CHECKLIST_OK);
    expect(r.cumplidos).toBe(7);
    expect(r.total).toBe(7);
    expect(r.todoEnVerde).toBe(true);
    expect(r.requiereRevisionJuridica).toBe(false);
  });

  /* 8 · 'pendiente' no cuenta como cumplido y se ve la bandera jurídica */
  it('trata pendiente como no cumplido y expone requiereRevisionJuridica', () => {
    const r = resumirChecklist({
      ...CHECKLIST_OK,
      competencia: 'pendiente',
      proteccionDatos: 'pendiente',
      requiereRevisionJuridica: true,
    });
    expect(r.cumplidos).toBe(5);
    expect(r.todoEnVerde).toBe(false);
    expect(r.requiereRevisionJuridica).toBe(true);
    // Las banderas internas no se cuelan como items.
    expect(r.items.map((i) => i.label)).not.toContain('observaciones');
  });
});

describe('SIMI copiloto — resumirRiesgo', () => {
  /* 9 · niveles a etiqueta + tono */
  it('mapea bajo/medio/alto a etiqueta y tono', () => {
    expect(resumirRiesgo('bajo')).toEqual({ label: 'Riesgo jurídico bajo', tono: 'VERDE' });
    expect(resumirRiesgo('medio')?.tono).toBe('AMBAR');
    expect(resumirRiesgo('alto')?.tono).toBe('ROJO');
    expect(resumirRiesgo(null)).toBeNull();
  });
});
