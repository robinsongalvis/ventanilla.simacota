/**
 * D5 del go-live (24-ago-2026) — las bitácoras probatorias no fallan mudas.
 *
 * Los catch de auditoría de descargas y trazabilidad de notificación eran
 * deliberadamente no-bloqueantes (correcto) pero con cuerpo VACÍO: si
 * Firestore rechazara esas escrituras, la bitácora institucional se
 * agujerearía sin señal — se descubriría en una auditoría externa, no por
 * el control. Ahora cada catch registra con logError (que nunca lanza:
 * el no-bloqueo se conserva).
 *
 * Prueba de comportamiento para el representante (auditoría de descargas,
 * con stub de Firestore que rechaza) + guardas de forma para los cinco.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const registrado: unknown[] = [];
vi.mock('@/lib/logger', () => ({
  logError: vi.fn((e: unknown) => { registrado.push(e); }),
}));
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    collection: () => ({ add: async () => { throw new Error('firestore rechaza'); } }),
    doc: () => ({ set: async () => { throw new Error('firestore rechaza'); }, update: async () => { throw new Error('firestore rechaza'); } }),
  }),
}));

import { registrarDescargaAuditoria } from '@/lib/seguridad/auditoria-descargas';

beforeEach(() => { registrado.length = 0; });

describe('auditoría de descargas — comportamiento ante Firestore caído', () => {
  it('NO lanza (no bloquea la descarga) pero SÍ deja rastro por logError', async () => {
    await expect(
      registrarDescargaAuditoria({
        evento: 'DESCARGA_AUTORIZADA',
        radicadoId: '1-110-202608-00000001',
        tipoArchivo: 'adjunto',
        archivoNombre: 'a.pdf',
        actorUid: 'u1', actorNombre: 'F', actorRol: 'FUNCIONARIO', actorTenant: 'VENTANILLA_UNICA',
      } as never),
    ).resolves.not.toThrow();
    expect(registrado.length).toBeGreaterThan(0);
  });
});

describe('guardas de forma — los cinco catch probatorios registran', () => {
  const PUNTOS: ReadonlyArray<[string, string]> = [
    ['lib/seguridad/auditoria-descargas.ts', 'auditoria/descargas'],
    ['lib/trazabilidad/notificacion.ts', 'trazabilidad/notificacion'],
    ['lib/trazabilidad/notificacion.ts', 'trazabilidad/notificacion-gestionada'],
    ['app/api/interno/notificar-ciudadano/route.ts', 'notificar-ciudadano/auditoria'],
    ['app/api/interno/notificar-ciudadano/route.ts', 'notificar-ciudadano/trazabilidad'],
  ];
  it.each(PUNTOS)('%s registra con módulo %s', (archivo, modulo) => {
    const fuente = readFileSync(join(process.cwd(), archivo), 'utf8');
    expect(fuente).toContain(`modulo: '${modulo}'`);
  });

  it('no queda ningún catch de cuerpo vacío en las zonas probatorias', () => {
    for (const archivo of ['lib/seguridad/auditoria-descargas.ts', 'lib/trazabilidad/notificacion.ts', 'app/api/interno/notificar-ciudadano/route.ts']) {
      const fuente = readFileSync(join(process.cwd(), archivo), 'utf8');
      const sinComentarios = fuente.replace(/\/\/[^\n]*/g, '');
      expect(sinComentarios).not.toMatch(/catch(?:\s*\([^)]*\))?\s*\{\s*\}/);
    }
  });
});

describe('auth/session — distingue ruido de cliente de avería del servidor', () => {
  const fuente = readFileSync(join(process.cwd(), 'app/api/auth/session/route.ts'), 'utf8');
  const codigo = fuente.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('un token del cliente (código auth/*) NO va a Sentry — solo consola', () => {
    // Endpoint público: un token expirado es ruido esperable. Mandarlo a
    // Sentry inundaría la bandeja el día que se estrene el DSN.
    expect(codigo).toContain("codigo.startsWith('auth/')");
    expect(codigo).toContain("console.warn('[auth/session] token rechazado:'");
  });

  it('cualquier otro fallo SÍ se registra con logError (credencial, Firestore, cookie)', () => {
    expect(codigo).toContain("logError({ radicadoId: '', modulo: 'auth/session', error: err });");
  });

  it('la respuesta al cliente sigue siendo genérica', () => {
    expect(codigo).toContain("{ error: 'Sesion invalida.' }");
  });
});
