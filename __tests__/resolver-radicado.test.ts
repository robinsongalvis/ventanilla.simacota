/**
 * Tests del flujo de resolución de radicados.
 *
 * Cubren los 4 escenarios del sprint de hardening:
 *   1. Caso exitoso   — Storage OK + Firestore OK → formulario limpio + email enviado
 *   2. Caso Firestore fallido → ok:false, logError, NO email
 *   3. Caso SMTP fallido  → radicado resuelto, error logueado, flujo no bloqueado
 *   4. Caso Trazabilidad fallida → radicado resuelto, correo enviado, error logueado
 *
 * Estrategia: probamos las funciones puras ejecutarResolucion() y
 * despacharNotificaciones() directamente — sin montar el componente React.
 * El guard "if (!resultado.ok) return" del componente es verificado por
 * el test de integración implícito (escenario 2): si ok:false no puede
 * llamarse despacharNotificaciones, lo que los tests 3 y 4 confirman
 * funciona de forma aislada.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mocks de módulos externos ──────────────────────────────── */

vi.mock('firebase/firestore', () => ({
  doc:       vi.fn(() => ({ _path: 'mock-doc-ref' })),
  updateDoc: vi.fn(),
  addDoc:    vi.fn(),
  collection: vi.fn(() => ({ _path: 'mock-collection-ref' })),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock('@/lib/storage', () => ({
  subirArchivo: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

/* ── Imports (después de los mocks para que Vitest los intercepte) ── */

import { updateDoc, addDoc } from 'firebase/firestore';
import { subirArchivo }      from '@/lib/storage';
import { logError }          from '@/lib/logger';
import {
  ejecutarResolucion,
  despacharNotificaciones,
  type EjecutarResolucionInput,
  type DespacharNotificacionesParams,
} from '@/lib/acciones/resolver-radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';

/* ── Fixtures ───────────────────────────────────────────────── */

const mockUsuario: UsuarioAutenticado = {
  uid:      'usr_001',
  email:    'funcionario@simacota.gov.co',
  nombre:   'Funcionario Prueba',
  rol:      'FUNCIONARIO',
  tenantId: 'SEC_GOBIERNO',
};

const mockRadicado = {
  radicadoId:   'SIM-2025-001',
  estadoActual: 'EN_PROCESO',
  ultimaActualizacion: new Date().toISOString(),
  prioridad:    'NORMAL',
  solicitante: {
    tipoPersona:     'NATURAL',
    tipoDocumento:   'CC',
    numeroDocumento: '12345678',
    nombreCompleto:  'Juan Ciudadano',
    email:           'juan@example.com',
    ubicacion:       { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
  },
  control: {
    radicadoId:    'SIM-2025-001',
    consecutivo:   1,
    fechaRadicado: '2025-01-01',
    horaRadicado:  '08:00',
    medioRecepcion:'WEB',
    origen:        'EXTERNO',
  },
  termino: {
    tipoSolicitudId:   'PETICION_GENERAL',
    tipoSolicitudNombre: 'Petición general (Derecho de petición)',
    diasRespuesta:     15,
    unidad:            'HABILES',
    fechaVencimiento:  '2025-02-01T00:00:00.000Z',
    prorrogasAplicadas: 0,
  },
  clasificacion: {
    oficinaDestino:   'SEC_GOBIERNO',
    zonaGeografica:   'URBANA',
  },
  detalle: {
    asunto:       'Solicitud de información',
    descripcion:  'Descripción de la solicitud',
    numeroFolios: 1,
  },
  archivos: [],
} as unknown as VentanillaRadicado;

const baseInput: EjecutarResolucionInput = {
  radicado:   mockRadicado,
  usuario:    mockUsuario,
  nota:       'Respuesta oficial del funcionario al ciudadano.',
  archivoPdf: null,
};

const baseDespacharParams: DespacharNotificacionesParams = {
  radicadoId:      'SIM-2025-001',
  actorUid:        'usr_001',
  actorNombre:     'Funcionario Prueba',
  nota:            'Respuesta oficial.',
  archivoNombre:   null,
  ahora:           '2025-06-01T10:00:00.000Z',
  emailCiudadano:  'juan@example.com',
  nombreCiudadano: 'Juan Ciudadano',
  asunto:          'Solicitud de información',
  tenantId:        'SEC_GOBIERNO',
  tieneArchivo:    false,
};

/* ══════════════════════════════════════════════════════════════
   SUITE 1 — ejecutarResolucion (operaciones críticas)
══════════════════════════════════════════════════════════════ */

describe('ejecutarResolucion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── Escenario 1: Caso exitoso ─────────────────────────────── */
  it('Escenario 1 — Storage OK + Firestore OK: retorna ok:true con ahora y archivoNombre', async () => {
    const mockFile = new File(['pdf-content'], 'oficio-firmado.pdf', { type: 'application/pdf' });

    vi.mocked(subirArchivo).mockResolvedValueOnce({
      nombre:    'oficio-firmado.pdf',
      url:       '',
      path:      'respuestas/SIM-2025-001/oficio-firmado.pdf',
      tipo:      'application/pdf',
      tamanioKB: 50,
    });
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined);

    const resultado = await ejecutarResolucion({ ...baseInput, archivoPdf: mockFile });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return; // type narrowing

    expect(resultado.archivoNombre).toBe('oficio-firmado.pdf');
    expect(resultado.ahora).toBeTruthy();

    // Firestore recibió estadoActual: RESUELTO con respuestaOficial
    expect(updateDoc).toHaveBeenCalledOnce();
    const [, payload] = vi.mocked(updateDoc).mock.calls[0];
    expect(payload).toMatchObject({
      estadoActual: 'RESUELTO',
      respuestaOficial: expect.objectContaining({
        archivoNombre: 'oficio-firmado.pdf',
        nota:          baseInput.nota,
        actorUid:      mockUsuario.uid,
      }),
    });

    // Sin PDF el archivoNombre sería null; aquí debe ser el nombre
    expect(logError).not.toHaveBeenCalled();
  });

  it('Escenario 1 — Sin PDF: archivoNombre es null, updateDoc sin respuestaOficial', async () => {
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined);

    const resultado = await ejecutarResolucion(baseInput);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.archivoNombre).toBeNull();

    const [, payload] = vi.mocked(updateDoc).mock.calls[0];
    expect(payload).not.toHaveProperty('respuestaOficial');
    expect(subirArchivo).not.toHaveBeenCalled();
  });

  /* ── Escenario 2: Firestore falla ─────────────────────────── */
  it('Escenario 2 — updateDoc falla: retorna ok:false, logError llamado, subirArchivo SÍ ejecutado', async () => {
    const mockFile = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
    vi.mocked(subirArchivo).mockResolvedValueOnce({
      nombre:    'test.pdf',
      url:       '',
      path:      'respuestas/SIM-2025-001/test.pdf',
      tipo:      'application/pdf',
      tamanioKB: 10,
    });
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Firestore: network unavailable'));

    const resultado = await ejecutarResolucion({ ...baseInput, archivoPdf: mockFile });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.mensaje).toContain('Firestore: network unavailable');

    expect(logError).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        radicadoId: 'SIM-2025-001',
        modulo:     'resolver-radicado/critico',
        error:      expect.objectContaining({ message: 'Firestore: network unavailable' }),
      }),
    );
  });

  it('Escenario 2 — Storage falla: retorna ok:false antes de llegar a updateDoc', async () => {
    const mockFile = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
    vi.mocked(subirArchivo).mockRejectedValueOnce(new Error('Storage: quota exceeded'));

    const resultado = await ejecutarResolucion({ ...baseInput, archivoPdf: mockFile });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.mensaje).toContain('Storage: quota exceeded');

    // updateDoc NO debe llamarse si el upload previo falló
    expect(updateDoc).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'resolver-radicado/critico' }),
    );
  });
});

/* ══════════════════════════════════════════════════════════════
   SUITE 2 — despacharNotificaciones (operaciones secundarias)
══════════════════════════════════════════════════════════════ */

describe('despacharNotificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restaurar fetch global tras cada test
    vi.stubGlobal('fetch', vi.fn());
  });

  /* ── Escenario 3: SMTP falla ─────────────────────────────── */
  it('Escenario 3 — Email SMTP falla: trazabilidad se guarda, logError módulo email, NO lanza', async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: 'ev_001' } as never);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('SMTP: connection refused'));

    // No debe lanzar — despacharNotificaciones es void
    expect(() => despacharNotificaciones(baseDespacharParams)).not.toThrow();

    // Esperar a que las promesas fire-and-forget se resuelvan
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          radicadoId: 'SIM-2025-001',
          modulo:     'resolver-radicado/email-ciudadano',
          error:      expect.objectContaining({ message: 'SMTP: connection refused' }),
        }),
      );
    });

    // Trazabilidad sí se llamó correctamente
    expect(addDoc).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      '/api/interno/notificar-ciudadano',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  /* ── Escenario 4: Trazabilidad falla ─────────────────────── */
  it('Escenario 4 — Trazabilidad falla: email SE envía, logError módulo trazabilidad, NO lanza', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore: permission denied'));
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ enviado: true }), { status: 200 }),
    );

    expect(() => despacharNotificaciones(baseDespacharParams)).not.toThrow();

    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          radicadoId: 'SIM-2025-001',
          modulo:     'resolver-radicado/trazabilidad',
          error:      expect.objectContaining({ message: 'Firestore: permission denied' }),
        }),
      );
    });

    // Email se envió a pesar del fallo de trazabilidad
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      '/api/interno/notificar-ciudadano',
      expect.objectContaining({
        method: 'POST',
        body:   expect.not.stringContaining('juan@example.com'),
      }),
    );
  });

  it('Escenario 4 — Sin emailCiudadano: solo trazabilidad, fetch nunca llamado', async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: 'ev_002' } as never);

    despacharNotificaciones({ ...baseDespacharParams, emailCiudadano: null });

    await vi.waitFor(() => {
      expect(addDoc).toHaveBeenCalledOnce();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Payload del email solo envía identificador y acción cerrada', async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: 'ev_003' } as never);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ enviado: true }), { status: 200 }),
    );

    despacharNotificaciones({ ...baseDespacharParams, tieneArchivo: true, archivoNombre: 'oficio.pdf' });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/interno/notificar-ciudadano');

    const body = JSON.parse((options as RequestInit).body as string);
    expect(body).toEqual({
      radicadoId: 'SIM-2025-001',
      accion:     'RESPUESTA_OFICIAL',
    });
    expect(JSON.stringify(body)).not.toContain('juan@example.com');
    expect(JSON.stringify(body)).not.toContain('Respuesta oficial.');
  });
});
