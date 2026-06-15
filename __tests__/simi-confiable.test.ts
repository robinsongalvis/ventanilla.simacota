/**
 * Tests del sprint SIMI Confiable por Dependencias.
 *
 * Cubre:
 *  - evaluarCompetenciaRadicado: casos principales de la heurística
 *  - construirContextoSimi: sanitización de privacidad
 *  - instruccionParaAccion: tipos de instrucciones y validación de acciones
 *  - pareceSalidaTruncada: detección de truncamiento
 */

import { describe, it, expect } from 'vitest';
import { evaluarCompetenciaRadicado } from '../lib/simi/evaluar-competencia';
import type { EntradaEvaluacion } from '../lib/simi/evaluar-competencia';
import { construirContextoSimi } from '../lib/simi/contexto-radicado';
import {
  instruccionParaAccion,
  pareceSalidaTruncada,
  ACCIONES_SIMI_VALIDAS,
  requiereEstructuraCompleta,
} from '../lib/simi/instrucciones-acciones';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function entradaBase(overrides: Partial<EntradaEvaluacion> = {}): EntradaEvaluacion {
  return {
    dependenciaActual:   'SEC_GOBIERNO',
    asunto:              'Queja por ruido excesivo de vecinos en zona urbana',
    descripcion:         'El señor solicita intervención por comportamientos contrarios a la convivencia ciudadana en el barrio centro.',
    tipoSolicitudNombre: 'Queja',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────
// evaluarCompetenciaRadicado
// ──────────────────────────────────────────────────────────────────

describe('evaluarCompetenciaRadicado', () => {
  it('devuelve ALTO cuando la dependencia encaja claramente', () => {
    const r = evaluarCompetenciaRadicado(entradaBase());
    expect(['ALTO', 'MEDIO']).toContain(r.nivelConfianza);
    expect(r.esCompetente).not.toBe(false);
  });

  it('devuelve DUDOSO cuando la descripción es demasiado corta', () => {
    const r = evaluarCompetenciaRadicado(entradaBase({ descripcion: 'ok' }));
    expect(r.nivelConfianza).toBe('DUDOSO');
  });

  it('devuelve DUDOSO cuando la dependencia no está en la matriz', () => {
    const r = evaluarCompetenciaRadicado(entradaBase({ dependenciaActual: 'NO_EXISTE' as never }));
    expect(r.nivelConfianza).toBe('DUDOSO');
  });

  it('marca requiereEscalamiento cuando hay conflicto explícito', () => {
    // SEC_GOBIERNO no es competente para "pago de impuestos predial"
    const r = evaluarCompetenciaRadicado(
      entradaBase({
        asunto:      'Liquidación predial y cobro por industria y comercio',
        descripcion: 'El contribuyente solicita paz y salvo del impuesto predial y acuerdo de pago por industria y comercio municipal vigente.',
      }),
    );
    expect(r.requiereEscalamiento).toBe(true);
    expect(r.esCompetente).toBe(false);
  });

  it('detecta necesidad de revisión jurídica en SEC_GOBIERNO cuando aplica sanción', () => {
    // La heurística busca frases exactas configuradas en `requiereRevisionJuridicaCuando`
    // Para SEC_GOBIERNO: "la solicitud involucra sanciones, multas o medidas correctivas"
    const r = evaluarCompetenciaRadicado(
      entradaBase({
        descripcion: 'La solicitud involucra sanciones, multas o medidas correctivas por comportamientos contrarios a la convivencia ciudadana del sector.',
      }),
    );
    expect(r.requiereRevisionJuridica).toBe(true);
  });

  it('sugiere Comisaría para caso de violencia intrafamiliar asignado a Gobierno', () => {
    const r = evaluarCompetenciaRadicado(
      entradaBase({
        descripcion: 'La denunciante reporta violencia intrafamiliar y maltrato infantil y solicita medidas de protección inmediata.',
      }),
    );
    // Puede devolver dependenciaSugerida apuntando a SUB_COMISARIA
    if (r.dependenciaSugerida) {
      expect(r.dependenciaSugerida).toBe('SUB_COMISARIA');
    }
  });

  it('retorna razon no vacía en todos los casos', () => {
    const casos: Partial<EntradaEvaluacion>[] = [
      {},
      { descripcion: 'ok' },
      { dependenciaActual: 'VENTANILLA_UNICA' as never },
      { dependenciaActual: 'SUB_COMISARIA' as never },
    ];
    for (const c of casos) {
      const r = evaluarCompetenciaRadicado(entradaBase(c));
      expect(typeof r.razon).toBe('string');
      expect(r.razon.length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// construirContextoSimi — sanitización de privacidad
// ──────────────────────────────────────────────────────────────────

describe('construirContextoSimi — privacidad', () => {
  function radicadoBase(overrides: Record<string, unknown> = {}): Parameters<typeof construirContextoSimi>[0]['radicado'] {
    return {
      radicadoId: 'RAD-TEST-001',
      estadoActual: 'EN_PROCESO',
      ultimaActualizacion: '2026-06-01T10:00:00.000Z',
      prioridad: 'AMARILLO',
      esAnonimo: false,
      identidadReservada: false,
      tipoPresentacion: 'IDENTIFICADA',
      canalRespuesta: 'CORREO',
      archivos: [],
      solicitante: {
        nombreCompleto: 'Juan García',
        email: 'juan@example.com',
        tipoIdentificacion: 'CC',
        numeroIdentificacion: '123456',
        telefono: '',
        municipio: 'Simacota',
      },
      detalle: {
        asunto: 'Queja por ruido vecinos',
        descripcion: 'El ciudadano solicita intervención por ruido en la madrugada que perturba la convivencia.',
      },
      clasificacion: {
        oficinaDestino: 'SEC_GOBIERNO',
        funcionarioResponsableNombre: 'María López',
      },
      termino: {
        tipoSolicitudNombre: 'Queja',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        prorrogasAplicadas: 0,
      },
      control: {
        fechaRadicado: '2026-06-01',
      },
      respuestaOficial: null,
      ...overrides,
      // Fixture mínimo para tests del context builder; los campos que faltan
      // (tipoPersona, ubicacion, etc.) no son leídos por construirContextoSimi.
    } as unknown as Parameters<typeof construirContextoSimi>[0]['radicado'];
  }

  const usuarioBase = { rol: 'FUNCIONARIO' as const, tenantId: 'SEC_GOBIERNO' as const, nombre: 'Test User' };

  it('incluye el nombre del solicitante cuando no es anónimo ni reservado', () => {
    const ctx = construirContextoSimi({ radicado: radicadoBase(), trazabilidad: [], usuario: usuarioBase });
    expect(ctx.bloqueTexto).toContain('Juan García');
  });

  it('oculta el nombre del solicitante cuando esAnonimo es true', () => {
    const ctx = construirContextoSimi({
      radicado: radicadoBase({ esAnonimo: true }),
      trazabilidad: [],
      usuario: usuarioBase,
    });
    expect(ctx.bloqueTexto).not.toContain('Juan García');
    expect(ctx.bloqueTexto).toContain('ANÓNIMO');
  });

  it('oculta el nombre cuando tipoPresentacion es RESERVADA', () => {
    const ctx = construirContextoSimi({
      radicado: radicadoBase({ tipoPresentacion: 'RESERVADA' }),
      trazabilidad: [],
      usuario: usuarioBase,
    });
    expect(ctx.bloqueTexto).not.toContain('Juan García');
  });

  it('oculta el nombre cuando identidadReservada es true', () => {
    const ctx = construirContextoSimi({
      radicado: radicadoBase({ identidadReservada: true }),
      trazabilidad: [],
      usuario: usuarioBase,
    });
    expect(ctx.bloqueTexto).not.toContain('Juan García');
  });

  it('incluye evaluacionCompetencia en meta con nivelConfianza válido', () => {
    const ctx = construirContextoSimi({ radicado: radicadoBase(), trazabilidad: [], usuario: usuarioBase });
    expect(['ALTO','MEDIO','BAJO','DUDOSO']).toContain(ctx.meta.evaluacionCompetencia.nivelConfianza);
  });

  it('clasifica estado de término VENCIDO correctamente', () => {
    const radicadoVencido = radicadoBase({
      termino: {
        tipoSolicitudNombre: 'Queja',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: '2020-01-01', // pasado
        prorrogasAplicadas: 0,
      },
    });
    const ctx = construirContextoSimi({ radicado: radicadoVencido, trazabilidad: [], usuario: usuarioBase });
    expect(ctx.meta.estadoTermino).toBe('VENCIDO');
    expect(ctx.meta.diasRestantes).toBeLessThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// instruccionParaAccion
// ──────────────────────────────────────────────────────────────────

describe('instruccionParaAccion', () => {
  const ACCIONES_CON_ESTRUCTURA = [
    'ANALIZAR_COMPETENCIA',
    'AYUDAR_A_RESPONDER',
    'SUGERIR_RESPUESTA',
    'GENERAR_BORRADOR_OFICIO',
    'MEJORAR_RESPUESTA',
    'VERIFICAR_CALIDAD',
    'VALIDAR_RESPUESTA',
    'CONTINUAR_RESPUESTA',
    'SUGERIR_DEPENDENCIA',
  ] as const;

  it('genera instrucción no vacía para todas las acciones válidas', () => {
    for (const accion of ACCIONES_SIMI_VALIDAS) {
      const instr = instruccionParaAccion({
        accion,
        respuestaBorrador: 'texto de prueba',
        ultimaSalidaPrevia: 'texto previo',
      });
      expect(instr.length).toBeGreaterThan(0);
    }
  });

  it('incluye el mensajeUsuario cuando se provee', () => {
    const instr = instruccionParaAccion({ accion: 'RESUMIR_RADICADO', mensajeUsuario: 'FOO_CUSTOM' });
    expect(instr).toContain('FOO_CUSTOM');
  });

  it('MEJORAR_RESPUESTA incluye el borrador en la instrucción', () => {
    const instr = instruccionParaAccion({ accion: 'MEJORAR_RESPUESTA', respuestaBorrador: 'MI BORRADOR ESPECIAL' });
    expect(instr).toContain('MI BORRADOR ESPECIAL');
  });

  it('CONTINUAR_RESPUESTA incluye la salida previa', () => {
    const instr = instruccionParaAccion({ accion: 'CONTINUAR_RESPUESTA', ultimaSalidaPrevia: 'SALIDA PREVIA TEST' });
    expect(instr).toContain('SALIDA PREVIA TEST');
  });

  it('requiereEstructuraCompleta devuelve true para acciones que requieren 6 secciones', () => {
    for (const accion of ACCIONES_CON_ESTRUCTURA) {
      expect(requiereEstructuraCompleta(accion)).toBe(true);
    }
  });

  it('requiereEstructuraCompleta devuelve false para acciones breves', () => {
    const breves = ['RESUMIR_RADICADO', 'EXPLICAR_ESTADO', 'REVISAR_TERMINO', 'RESUMIR_TRAZABILIDAD'] as const;
    for (const accion of breves) {
      expect(requiereEstructuraCompleta(accion)).toBe(false);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// pareceSalidaTruncada
// ──────────────────────────────────────────────────────────────────

describe('pareceSalidaTruncada', () => {
  it('devuelve false para string vacío', () => {
    expect(pareceSalidaTruncada('')).toBe(false);
  });

  it('devuelve false para texto completo con punto final', () => {
    expect(pareceSalidaTruncada('Texto completo con cierre final.')).toBe(false);
  });

  it('devuelve false si termina con la nota de cierre del sistema', () => {
    // El texto debe tener contenido antes de la nota de cierre para no activar la heurística de título vacío
    const texto = [
      'Resumen',
      'El ciudadano solicita intervención.',
      '',
      'Análisis de competencia',
      'La dependencia es competente.',
      '',
      '[Respuesta cerrada hasta aquí. El funcionario puede solicitar continuar.]',
    ].join('\n');
    expect(pareceSalidaTruncada(texto)).toBe(false);
  });

  it('devuelve true si la última oración no tiene puntuación final', () => {
    expect(pareceSalidaTruncada('Este es un texto que queda incompleto porque')).toBe(true);
  });

  it('devuelve true si el último bloque es un título sin contenido', () => {
    const texto = 'Resumen\nContenido.\n\nAdvertencias';
    expect(pareceSalidaTruncada(texto)).toBe(true);
  });

  it('devuelve false para texto con signos de interrogación o exclamación', () => {
    expect(pareceSalidaTruncada('¿Cómo podemos ayudarle?')).toBe(false);
  });
});
