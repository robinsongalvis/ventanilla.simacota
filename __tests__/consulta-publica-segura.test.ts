import { describe, expect, it } from 'vitest';
import {
  aRadicadoPublico,
  aLineaTiempoPublica,
  esNumeroRadicadoValido,
  generarTokenConsulta,
  hashDatoAuditoria,
  hashTokenConsulta,
  MENSAJE_CONSULTA_NO_VERIFICADA,
  normalizarCorreo,
  normalizarNumeroRadicado,
  verificarDatoConsulta,
} from '@/lib/seguridad/consulta-publica-radicado';
import {
  RateLimitConsultaMemoria,
  type ConfiguracionRateLimitConsulta,
} from '@/lib/seguridad/rate-limit-consulta-publica';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId: '1-WEB-2026-00000001',
    estadoActual: 'RESUELTO',
    ultimaActualizacion: '2026-06-20T12:00:00.000Z',
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1098765432',
      nombreCompleto: 'Nombre Privado',
      email: 'Ciudadano@Ejemplo.com',
      telefono: '3001234567',
      direccion: 'Dirección privada',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: '1-WEB-2026-00000001',
      consecutivo: 1,
      fechaRadicado: '2026-06-01T12:00:00.000Z',
      horaRadicado: '07:00:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: '2026-06-25T22:00:00.000Z',
      prorrogasAplicadas: 0,
    },
    clasificacion: { oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Privado', descripcion: 'Contenido privado', numeroFolios: 1 },
    archivos: [{ nombre: 'privado.pdf', path: 'radicados/id/privado.pdf', tipo: 'application/pdf', tamanioKB: 10, orden: 1 }],
    respuestaOficial: {
      archivoPath: 'respuestas/id/oficio.pdf',
      archivoNombre: 'oficio.pdf',
      nota: 'Respuesta pública autorizada.',
      fecha: '2026-06-20T12:00:00.000Z',
      actorUid: 'uid-interno',
      actorNombre: 'Funcionario interno',
    },
    ...overrides,
  };
}

describe('verificación obligatoria de consulta pública', () => {
  it('normaliza número y correo sin cambiar el valor lógico', () => {
    expect(normalizarNumeroRadicado(' 1-web-2026-00000001 ')).toBe('1-WEB-2026-00000001');
    expect(normalizarCorreo(' Ciudadano@Ejemplo.COM ')).toBe('ciudadano@ejemplo.com');
  });

  it('valida únicamente formatos institucionales y legacy conocidos', () => {
    expect(esNumeroRadicadoValido('1-WEB-2026-00000001')).toBe(true);
    expect(esNumeroRadicadoValido('1-WEB-2026-1')).toBe(false);
    expect(esNumeroRadicadoValido('texto-libre')).toBe(false);
  });

  it('autoriza correo correcto con espacios y mayúsculas', () => {
    expect(verificarDatoConsulta(radicado(), ' CIUDADANO@EJEMPLO.COM ')).toEqual({ autorizado: true, metodo: 'CORREO' });
  });

  it('autoriza los últimos cuatro dígitos de un documento válido', () => {
    expect(verificarDatoConsulta(radicado({ solicitante: { ...radicado().solicitante, email: null } }), '5432'))
      .toEqual({ autorizado: true, metodo: 'DOCUMENTO' });
  });

  it('deniega correo, documento o dato vacío incorrectos sin explicar cuál falló', () => {
    expect(verificarDatoConsulta(radicado(), 'otro@example.com')).toEqual({ autorizado: false, motivo: 'NO_VERIFICADO' });
    expect(verificarDatoConsulta(radicado(), '')).toEqual({ autorizado: false, motivo: 'DATOS_INVALIDOS' });
    expect(MENSAJE_CONSULTA_NO_VERIFICADA).not.toMatch(/existe|correo no coincide|documento/i);
  });

  it('genera un token anónimo aleatorio de 256 bits y almacena solo SHA-256', () => {
    const token = generarTokenConsulta();
    const otro = generarTokenConsulta();
    const hash = hashTokenConsulta(token);
    expect(token).not.toBe(otro);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('autoriza un anónimo nuevo con token y deniega token incorrecto', () => {
    const token = generarTokenConsulta();
    const anonimo = radicado({
      esAnonimo: true,
      tipoPresentacion: 'ANONIMA',
      consultaTokenHash: hashTokenConsulta(token),
      solicitante: { ...radicado().solicitante, email: null, numeroDocumento: '', nombreCompleto: 'Anónimo / Reservado' },
    });
    expect(verificarDatoConsulta(anonimo, token)).toEqual({ autorizado: true, metodo: 'TOKEN' });
    expect(verificarDatoConsulta(anonimo, 'incorrecto')).toEqual({ autorizado: false, motivo: 'NO_VERIFICADO' });
  });

  it('bloquea un anónimo histórico sin token y no crea bypass', () => {
    const anonimoHistorico = radicado({
      esAnonimo: true,
      tipoPresentacion: 'ANONIMA',
      consultaTokenHash: undefined,
      solicitante: { ...radicado().solicitante, email: null, numeroDocumento: '' },
    });
    expect(verificarDatoConsulta(anonimoHistorico, 'cualquier-cosa'))
      .toEqual({ autorizado: false, motivo: 'SIN_METODO_VERIFICACION' });
  });

  it('bloquea identificado histórico sin correo, documento ni token', () => {
    const sinMetodo = radicado({
      consultaTokenHash: undefined,
      solicitante: { ...radicado().solicitante, email: null, numeroDocumento: '' },
    });
    expect(verificarDatoConsulta(sinMetodo, 'dato')).toEqual({ autorizado: false, motivo: 'SIN_METODO_VERIFICACION' });
  });

  it('permite token para un identificado nuevo que no tiene correo ni documento', () => {
    const token = generarTokenConsulta();
    const conToken = radicado({
      consultaTokenHash: hashTokenConsulta(token),
      solicitante: { ...radicado().solicitante, email: null, numeroDocumento: '' },
    });
    expect(verificarDatoConsulta(conToken, token)).toEqual({ autorizado: true, metodo: 'TOKEN' });
  });
});

describe('respuesta pública por lista positiva', () => {
  it('incluye solo campos públicos previstos y nunca PII, UIDs o rutas', () => {
    const salida = aRadicadoPublico({ radicado: radicado(), lineaTiempo: [{ fecha: '2026-06-01T12:00:00.000Z', evento: 'Solicitud recibida' }] });
    const serializado = JSON.stringify(salida);
    expect(Object.keys(salida).sort()).toEqual([
      'dependencia', 'estadoPublico', 'fechaRadicacion', 'fechaRespuesta', 'fechaVencimiento',
      'fueRespondido', 'lineaTiempo', 'numeroRadicado', 'requiereAclaracion', 'respuestaDisponible',
      'respuestaOficial', 'tipoSolicitud',
    ]);
    for (const privado of ['Nombre Privado', 'Ciudadano@Ejemplo.com', '3001234567', 'Dirección privada', 'uid-interno', 'privado.pdf', 'archivoPath', 'actorUid']) {
      expect(serializado).not.toContain(privado);
    }
  });

  it('oculta también la dependencia en anónimos y reservados verificados', () => {
    for (const protegido of [
      radicado({ esAnonimo: true, tipoPresentacion: 'ANONIMA' }),
      radicado({ identidadReservada: true, tipoPresentacion: 'RESERVADA' }),
    ]) {
      const salida = aRadicadoPublico({ radicado: protegido });
      expect(salida.dependencia).toBeUndefined();
      expect(JSON.stringify(salida)).not.toContain('SEC_GOBIERNO');
      expect(salida.respuestaOficial?.dependenciaNombre).toBe('Alcaldía Municipal de Simacota');
    }
  });

  it('solo conserva acciones de trazabilidad aprobadas para el ciudadano', () => {
    const linea = aLineaTiempoPublica([
      { fecha: '2026-01-01T00:00:00.000Z', accion: 'RADICACION', actorUid: 'privado', actorNombre: 'Privado', nota: 'nota privada' },
      { fecha: '2026-01-02T00:00:00.000Z', accion: 'NOTIFICACION_CORREO_FALLIDA', actorUid: 'privado', actorNombre: 'Privado', nota: 'correo privado' },
    ]);
    expect(linea).toEqual([{ fecha: '2026-01-01T00:00:00.000Z', evento: 'Solicitud recibida' }]);
    expect(JSON.stringify(linea)).not.toContain('privado');
  });
});

describe('rate limit de emergencia (el endpoint usa Firestore como fuente compartida)', () => {
  const config: ConfiguracionRateLimitConsulta = {
    maxIpPorMinuto: 2,
    maxRadicadoPorHora: 10,
    maxCombinacionPorMinuto: 2,
    maxFallosPorRadicado: 2,
    bloqueoFallosMs: 60_000,
  };

  it('permite el cupo, bloquea el siguiente intento y reinicia tras la ventana', () => {
    const rate = new RateLimitConsultaMemoria(config);
    expect(rate.verificar('ip-a', 'rad-a', 0).bloqueado).toBe(false);
    expect(rate.verificar('ip-a', 'rad-a', 1).bloqueado).toBe(false);
    expect(rate.verificar('ip-a', 'rad-a', 2)).toMatchObject({ bloqueado: true });
    expect(rate.verificar('ip-a', 'rad-a', 60_001).bloqueado).toBe(false);
  });

  it('mantiene contadores separados por IP y por radicado', () => {
    const rate = new RateLimitConsultaMemoria({ ...config, maxIpPorMinuto: 10, maxCombinacionPorMinuto: 1 });
    expect(rate.verificar('ip-a', 'rad-a', 0).bloqueado).toBe(false);
    expect(rate.verificar('ip-b', 'rad-a', 1).bloqueado).toBe(false);
    expect(rate.verificar('ip-a', 'rad-b', 2).bloqueado).toBe(false);
    expect(rate.verificar('ip-a', 'rad-a', 3).bloqueado).toBe(true);
  });

  it('aplica también el límite horario agregado por radicado', () => {
    const rate = new RateLimitConsultaMemoria({ ...config, maxIpPorMinuto: 10, maxCombinacionPorMinuto: 10, maxRadicadoPorHora: 2 });
    expect(rate.verificar('ip-a', 'rad-a', 0).bloqueado).toBe(false);
    expect(rate.verificar('ip-b', 'rad-a', 1).bloqueado).toBe(false);
    expect(rate.verificar('ip-c', 'rad-a', 2)).toMatchObject({ bloqueado: true, alcance: 'RADICADO' });
  });

  it('activa bloqueo progresivo por fallos y lo elimina tras autorización', () => {
    const rate = new RateLimitConsultaMemoria(config);
    expect(rate.registrarFallo('rad-a', 0).bloqueado).toBe(false);
    expect(rate.registrarFallo('rad-a', 1).bloqueado).toBe(true);
    expect(rate.verificar('ip-a', 'rad-a', 2)).toMatchObject({ bloqueado: true, alcance: 'FALLOS' });
    rate.limpiarFallos('rad-a');
    expect(rate.verificar('ip-a', 'rad-a', 3).bloqueado).toBe(false);
  });

  it('seudonimiza IP y radicado mediante HMAC SHA-256', () => {
    const hash = hashDatoAuditoria('192.0.2.10', 'secreto-test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('192.0.2.10');
  });
});
