import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registrarEventoNegocio,
  type EventoNegocio,
  type OperacionCritica,
} from '@/lib/observabilidad/eventos-negocio';

const CAMPOS_REQUERIDOS: Array<keyof EventoNegocio> = [
  'operacion',
  'resultado',
  'latenciaMs',
  'correlacion',
  'actorRol',
  'tenant',
  'radicadoId',
  'timestamp',
];

describe('registrarEventoNegocio — ADR-0005 (forma del evento)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emite todos los campos requeridos en un evento de éxito', () => {
    const evento = registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'ok',
      latenciaMs: 42,
      radicadoId: '1-110-2026-00000001',
      actorRol: 'PORTAL_CIUDADANO',
      tenant: 'VENTANILLA_UNICA',
    });

    for (const campo of CAMPOS_REQUERIDOS) {
      expect(evento[campo]).not.toBeUndefined();
    }
    expect(evento.operacion).toBe('radicacion');
    expect(evento.resultado).toBe('ok');
    expect(evento.latenciaMs).toBe(42);
    expect(evento.radicadoId).toBe('1-110-2026-00000001');
    expect(evento.mensaje).toBeUndefined();
  });

  it('emite todos los campos requeridos en un evento de fallo, con mensaje saneado', () => {
    const evento = registrarEventoNegocio({
      operacion: 'asignacion',
      resultado: 'error',
      latenciaMs: 17,
      radicadoId: '1-110-2026-00000002',
      actorRol: 'FUNCIONARIO',
      tenant: 'GOBIERNO',
      error: new Error('fallo al notificar'),
    });

    for (const campo of CAMPOS_REQUERIDOS) {
      expect(evento[campo]).not.toBeUndefined();
    }
    expect(evento.resultado).toBe('error');
    expect(evento.mensaje).toBe('fallo al notificar');
  });

  it('el mensaje de error sanea PII (correo, teléfono, documento) — nunca se filtra el dato crudo', () => {
    const errorConPii = new Error(
      'Fallo notificando a maria.perez@example.com al 3001234567, documento CC 123456789',
    );

    const evento = registrarEventoNegocio({
      operacion: 'respuesta',
      resultado: 'error',
      latenciaMs: 5,
      radicadoId: '1-110-2026-00000003',
      actorRol: 'FUNCIONARIO',
      tenant: 'GOBIERNO',
      error: errorConPii,
    });

    expect(evento.mensaje).toBeDefined();
    expect(evento.mensaje).not.toContain('maria.perez@example.com');
    expect(evento.mensaje).not.toContain('3001234567');
    expect(evento.mensaje).not.toContain('123456789');
    expect(evento.mensaje).toContain('[CORREO]');
    expect(evento.mensaje).toContain('[TELEFONO]');
    expect(evento.mensaje).toContain('[DOCUMENTO]');
  });

  it('el evento no tiene forma para transportar PII del solicitante (sin campos de nombre/documento/correo/teléfono)', () => {
    const evento = registrarEventoNegocio({
      operacion: 'prorroga',
      resultado: 'ok',
      latenciaMs: 3,
      radicadoId: '1-110-2026-00000004',
      actorRol: 'JEFE_DEPENDENCIA',
      tenant: 'GOBIERNO',
    });

    const clavesProhibidas = [
      'nombre', 'nombreCompleto', 'email', 'correo', 'telefono',
      'documento', 'numeroDocumento', 'direccion', 'solicitante',
    ];
    const claves = Object.keys(evento);
    for (const prohibida of clavesProhibidas) {
      expect(claves).not.toContain(prohibida);
    }
  });

  it('la correlación incorpora el radicadoId (trazabilidad del flujo)', () => {
    const evento = registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'ok',
      latenciaMs: 1,
      radicadoId: '1-110-2026-00000005',
      actorRol: 'PORTAL_CIUDADANO',
      tenant: 'VENTANILLA_UNICA',
    });

    expect(evento.correlacion.startsWith('1-110-2026-00000005_')).toBe(true);
  });

  it('acepta radicadoId nulo (fallo antes de generar el radicado) sin lanzar', () => {
    expect(() => registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'error',
      latenciaMs: 9,
      radicadoId: null,
      actorRol: 'PORTAL_CIUDADANO',
      tenant: 'VENTANILLA_UNICA',
      error: new Error('fallo antes de persistir'),
    })).not.toThrow();
  });

  it('registra en stdout un JSON parseable con el evento', () => {
    registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'ok',
      latenciaMs: 2,
      radicadoId: '1-110-2026-00000006',
      actorRol: 'PORTAL_CIUDADANO',
      tenant: 'VENTANILLA_UNICA',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [tag, payload] = logSpy.mock.calls[0] as [string, string];
    expect(tag).toBe('[ventanilla:evento-negocio]');
    expect(() => JSON.parse(payload)).not.toThrow();
  });
});

describe('registrarEventoNegocio — instrumentación de los 4 flujos críticos (control de regresión)', () => {
  const raiz = join(__dirname, '..');
  const rutas: Array<{ archivo: string; operacion: OperacionCritica }> = [
    { archivo: 'app/api/radicacion/route.ts', operacion: 'radicacion' },
    { archivo: 'app/api/radicados/[radicadoId]/asignar/route.ts', operacion: 'asignacion' },
    { archivo: 'app/api/radicados/[radicadoId]/prorroga/route.ts', operacion: 'prorroga' },
    { archivo: 'app/api/radicados/[radicadoId]/resolver/route.ts', operacion: 'respuesta' },
  ];

  for (const { archivo, operacion } of rutas) {
    it(`${archivo} importa el primitivo y emite '${operacion}' en éxito y en fallo`, () => {
      const fuente = readFileSync(join(raiz, archivo), 'utf-8');

      expect(fuente).toContain(
        "import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';",
      );

      const ocurrencias = fuente.match(/registrarEventoNegocio\(/g) ?? [];
      expect(ocurrencias.length).toBeGreaterThanOrEqual(2);

      expect(fuente).toMatch(
        new RegExp(`operacion:\\s*'${operacion}'[\\s\\S]{0,80}resultado:\\s*'ok'`),
      );
      expect(fuente).toMatch(
        new RegExp(`operacion:\\s*'${operacion}'[\\s\\S]{0,80}resultado:\\s*'error'`),
      );
    });
  }
});
