/**
 * PT-3 (24-ago-2026) — /api/ai/feedback exige sesión y el actor sale del
 * servidor.
 *
 * Antes era la ÚNICA ruta /api/ai que escribía estado de negocio sin
 * autenticación: un anónimo que derivara un radicadoId (formato público)
 * sembraba feedbackIa en un radicado real y contaminaba ai_feedback y
 * ai_auditoria con actor forjado en el body. Estos tests fijan las dos
 * decisiones: sin sesión → 401 sin escribir nada; con sesión, la identidad
 * del evaluador es LA DE LA SESIÓN aunque el body traiga otra.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let sesion: { uid: string; nombre: string; rol: string; tenantId: string } | null = null;

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: class extends Error { status = 401; },
  requireActiveInternalUser: vi.fn(async () => {
    if (!sesion) throw new Error('sin sesión');
    return sesion;
  }),
}));

const escrituras: { ruta: string; datos: Record<string, unknown> }[] = [];
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (ruta: string) => ({
      set: async (datos: Record<string, unknown>) => { escrituras.push({ ruta, datos }); },
      update: async (datos: Record<string, unknown>) => { escrituras.push({ ruta, datos }); },
    }),
  }),
}));

import { POST } from '@/app/api/ai/feedback/route';

function peticion(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/ai/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sesion = null;
  escrituras.length = 0;
});

describe('/api/ai/feedback — autenticación (PT-3)', () => {
  it('sin sesión → 401 y NO escribe absolutamente nada', async () => {
    const res = await POST(peticion({ radicadoId: '1-110-202608-00000001', puntuacion: 'POSITIVO' }));
    expect(res.status).toBe(401);
    expect(escrituras).toHaveLength(0);
  });

  it('con sesión, el actor es el de la SESIÓN aunque el body intente forjar otro', async () => {
    sesion = { uid: 'uid-real', nombre: 'Funcionaria Real', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO' };
    const res = await POST(peticion({
      radicadoId: '1-110-202608-00000001',
      puntuacion: 'POSITIVO',
      usuarioId: 'uid-forjado',
      actorNombre: 'Impostor',
    }));
    expect(res.status).toBe(200);
    const feedback = escrituras.find((e) => e.ruta.startsWith('ai_feedback/'));
    expect(feedback).toBeDefined();
    expect(feedback!.datos.usuarioId).toBe('uid-real');
    expect(feedback!.datos.actorNombre).toBe('Funcionaria Real');
    const radicado = escrituras.find((e) => e.ruta.startsWith('ventanilla_radicados/'));
    expect((radicado!.datos.feedbackIa as Record<string, unknown>).usuarioId).toBe('uid-real');
  });
});

describe('storage.rules — el bucket entero es Admin-SDK-only (PT-3)', () => {
  it('ninguna cláusula allow distinta de false (las puertas muertas no reviven)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const reglas = readFileSync('storage.rules', 'utf8')
      .split('\n')
      .filter((l: string) => !l.trim().startsWith('//'));
    const allows = reglas.filter((l: string) => l.includes('allow '));
    expect(allows.length).toBeGreaterThan(0); // guardia anti-falso-verde
    for (const a of allows) expect(a).toContain('if false');
  });
});
