import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, 'utf8');
}

describe('cierre seguridad go-live', () => {
  it('bloquea escrituras nuevas en la colección legacy radicados', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('match /radicados/{radicadoId}');
    expect(rules).toContain('allow create: if false;');
    expect(rules).toContain('allow update: if false;');
  });

  it('bloquea mutaciones críticas directas en ventanilla_radicados', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('match /ventanilla_radicados/{radicadoId}');
    expect(rules).toContain('allow update: if false;');
    expect(rules).toContain('cumplioTermino');
  });

  it('impide subida pública anónima directa a Storage', () => {
    const rules = read('storage.rules');

    expect(rules).toContain('match /radicados/{radicadoId}/{archivo}');
    expect(rules).toContain('allow create: if signedIn() && isAllowedRadicadoFile();');
    expect(rules).not.toContain('allow create: if isAllowedRadicadoFile();');
  });

  it('revoca tokens al desactivar usuarios internos', () => {
    const route = read('app/api/admin/usuarios/[uid]/route.ts');

    expect(route).toContain('revokeRefreshTokens');
    expect(route).toContain('USUARIO_DESACTIVADO');
  });

  it('valida usuario activo en proxy y sesión interna', () => {
    expect(read('proxy.ts')).toContain('activo !== false');
    expect(read('app/api/auth/session/route.ts')).toContain('activo === false');
    expect(read('lib/server/internal-auth.ts')).toContain('Usuario inactivo.');
  });

  it('el dashboard usa APIs server-side para acciones críticas', () => {
    const dashboard = read('app/interno/dashboard/page.tsx');

    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/asignar');
    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/devolver');
    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/prorroga');
    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/resolver');
    expect(dashboard).not.toContain('ejecutarResolucion(');
    expect(dashboard).not.toContain('despacharNotificaciones(');
  });
});
