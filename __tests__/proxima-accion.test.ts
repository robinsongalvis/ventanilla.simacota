import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { calcularProximaAccion } from '@/lib/proxima-accion/calcular-proxima-accion';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 1 — reglas de "próxima acción esperada".

   12 tests, uno por regla, verificando precedencia estricta y
   el `ruleId` retornado para cada caso.
══════════════════════════════════════════════════════════════ */

function fechaVencimientoEn(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-OFICIO-2026-00000042',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: new Date().toISOString(),
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1098765432',
      nombreCompleto:  'Juan Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-OFICIO-2026-00000042',
      consecutivo:    1,
      fechaRadicado:  new Date().toISOString(),
      horaRadicado:   '08:00',
      medioRecepcion: 'OFICIO_FISICO',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    fechaVencimientoEn(10),
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino: 'VENTANILLA_UNICA',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: {
      asunto:       'Solicitud de prueba',
      descripcion:  'Descripción',
      numeroFolios: 1,
    },
    archivos: [],
    ...overrides,
  };
}

describe('Panel Op Fase 1 — calcularProximaAccion (12 reglas)', () => {
  /* 1 · NOTIFICACION_FALLIDA gana sobre todo lo demás activo */
  it('Regla 1: alertaNotificacionFallida gana sobre estado normal', () => {
    const r = radicadoBase({
      estadoActual: 'EN_PROCESO',
      alertaNotificacionFallida: true,
    });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('NOTIFICACION_FALLIDA');
    expect(p.urgencia).toBe('alta');
  });

  /* 2 · VENCIDO cuando dias < 0 y activo */
  it('Regla 2: vencido y activo → responder inmediatamente', () => {
    const r = radicadoBase({
      estadoActual: 'EN_PROCESO',
      termino: { ...radicadoBase().termino, fechaVencimiento: fechaVencimientoEn(-5) },
    });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('VENCIDO');
    expect(p.urgencia).toBe('critica');
    expect(p.accion).toMatch(/término legal excedido/i);
  });

  /* 3 · POR_VENCER cuando 0 ≤ dias ≤ 2 (hábiles) y activo.
     Nota: `fechaVencimientoEn(2)` es calendario, pero
     `diasRestantesHabiles` cuenta hábiles — el conteo puede diferir si
     el vencimiento cae en fin de semana. La aserción se limita al
     ruleId y a que el mensaje mencione "vence" para no ser frágil. */
  it('Regla 3: por vencer → priorizar respuesta', () => {
    const r = radicadoBase({
      estadoActual: 'EN_PROCESO',
      termino: { ...radicadoBase().termino, fechaVencimiento: fechaVencimientoEn(1) },
    });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('POR_VENCER');
    expect(p.urgencia).toBe('alta');
    expect(p.accion).toMatch(/vence/i);
  });

  /* 4 · PENDIENTE sin responsable → asignar */
  it('Regla 4: PENDIENTE sin responsableUid → asignar', () => {
    const r = radicadoBase({ estadoActual: 'PENDIENTE' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('PENDIENTE_SIN_RESPONSABLE');
    expect(p.accion).toMatch(/asignar/i);
  });

  /* 5 · PENDIENTE con responsable → iniciar revisión */
  it('Regla 5: PENDIENTE con responsableUid → iniciar revisión', () => {
    const r = radicadoBase({
      estadoActual: 'PENDIENTE',
      clasificacion: {
        oficinaDestino: 'VENTANILLA_UNICA',
        zonaGeografica: 'CASCO_URBANO',
        funcionarioResponsableUid: 'uid-abc',
      },
    });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('PENDIENTE_CON_RESPONSABLE');
    expect(p.accion).toMatch(/iniciar revisión/i);
  });

  /* 6 · ASIGNADO → iniciar revisión */
  it('Regla 6: ASIGNADO → iniciar revisión', () => {
    const r = radicadoBase({ estadoActual: 'ASIGNADO' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('ASIGNADO');
    expect(p.accion).toMatch(/iniciar revisión/i);
  });

  /* 7 · EN_REVISION → proyectar respuesta */
  it('Regla 7: EN_REVISION → proyectar respuesta', () => {
    const r = radicadoBase({ estadoActual: 'EN_REVISION' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('EN_REVISION');
    expect(p.accion).toMatch(/proyectar respuesta/i);
  });

  /* 8 · EN_PROCESO → continuar gestión */
  it('Regla 8: EN_PROCESO → continuar gestión y responder', () => {
    const r = radicadoBase({ estadoActual: 'EN_PROCESO' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('EN_PROCESO');
    expect(p.accion).toMatch(/continuar gestión/i);
  });

  /* 9 · PRORROGA → continuar con prórroga */
  it('Regla 9: PRORROGA → continuar con prórroga vigente', () => {
    const r = radicadoBase({ estadoActual: 'PRORROGA' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('PRORROGA');
    expect(p.accion).toMatch(/prórroga/i);
  });

  /* 10 · DEVUELTO → requerir aclaración */
  it('Regla 10: DEVUELTO → requerir aclaración al ciudadano', () => {
    const r = radicadoBase({ estadoActual: 'DEVUELTO' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('DEVUELTO');
    expect(p.accion).toMatch(/aclaración/i);
  });

  /* 11 · RESUELTO → sin acción */
  it('Regla 11: RESUELTO → sin acción pendiente', () => {
    const r = radicadoBase({ estadoActual: 'RESUELTO' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('RESUELTO');
    expect(p.urgencia).toBe('ninguna');
  });

  /* 12 · RECHAZADO → sin acción */
  it('Regla 12: RECHAZADO → sin acción pendiente', () => {
    const r = radicadoBase({ estadoActual: 'RECHAZADO' });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('RECHAZADO');
    expect(p.urgencia).toBe('ninguna');
  });

  /* Precedencia · Notificación fallida NO aplica si el radicado está resuelto */
  it('NOTIFICACION_FALLIDA no aplica a radicados resueltos (mantiene RESUELTO)', () => {
    const r = radicadoBase({
      estadoActual: 'RESUELTO',
      alertaNotificacionFallida: true,
    });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('RESUELTO');
  });

  /* Precedencia · Vencido gana sobre estado */
  it('VENCIDO gana sobre EN_PROCESO cuando ambas condiciones aplican', () => {
    const r = radicadoBase({
      estadoActual: 'EN_PROCESO',
      termino: { ...radicadoBase().termino, fechaVencimiento: fechaVencimientoEn(-3) },
    });
    const p = calcularProximaAccion(r);
    expect(p.ruleId).toBe('VENCIDO');
  });
});
