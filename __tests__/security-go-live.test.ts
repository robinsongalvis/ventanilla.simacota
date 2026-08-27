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

  it('impide TODA subida directa a Storage — el bucket es Admin-SDK-only (PT-3)', () => {
    // Antes esta guarda exigía `signedIn()` en la subida directa. El PT-3
    // (24-ago-2026) la volvió más fuerte: las puertas autenticadas eran
    // puertas muertas tras el cutover y se cerraron — ninguna cláusula
    // allow del bucket admite nada que no sea `if false`.
    const rules = read('storage.rules');
    expect(rules).toContain('match /radicados/{radicadoId}/{archivo}');
    const codigo = rules.split('\n').filter((l: string) => !l.trim().startsWith('//'));
    const allows = codigo.filter((l: string) => l.includes('allow '));
    expect(allows.length).toBeGreaterThan(0);
    for (const a of allows) expect(a).toContain('if false');
  });

  it('admite anexos Office (OOXML) por tipo exacto — validado en el SERVIDOR, no en reglas (PT-3)', () => {
    // La validación de tipos vivía en storage.rules porque el cliente subía
    // directo. Con el bucket Admin-SDK-only, el único validador es el del
    // servidor (magic-bytes), que verifica CONTENIDO real, no el content
    // type declarable por el cliente — estrictamente más fuerte.
    const magic = read('lib/seguridad/magic-bytes.ts');
    expect(magic).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(magic).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(magic).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(magic).not.toContain("application/*");
  });

  it('revoca tokens al desactivar usuarios internos', () => {
    const route = read('app/api/admin/usuarios/[uid]/route.ts');

    expect(route).toContain('revokeRefreshTokens');
    expect(route).toContain('USUARIO_DESACTIVADO');
  });

  it('valida usuario activo en proxy y sesión interna', () => {
    expect(read('proxy.ts')).toContain('activo !== false');
    expect(read('app/api/auth/session/route.ts')).toContain('activo === false');
    expect(read('lib/server/internal-auth.ts')).toContain('Usuario inactivo o archivado.');
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
