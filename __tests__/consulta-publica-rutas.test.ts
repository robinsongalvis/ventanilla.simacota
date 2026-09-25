import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/consulta/[radicadoId]/route';
import { GET as GET_CANONICO } from '@/app/api/public/radicado/consulta/route';
import { readFileSync } from 'node:fs';

describe('ruta pública heredada', () => {
  it('GET ya no permite consultar únicamente con el número', async () => {
    const response = await GET();
    expect(response.status).toBe(410);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).not.toHaveProperty('radicadoId');
  });

  it('POST tampoco ofrece un bypass alternativo', async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    expect(await response.json()).not.toHaveProperty('radicado');
  });

  it('el endpoint canónico rechaza GET y evita caché', async () => {
    const response = await GET_CANONICO();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('el PDF firmado no acepta correo, documento o token en query string', () => {
    const source = readFileSync('app/api/simi/respuestas/firma/[id]/pdf/route.ts', 'utf8');
    expect(source).not.toContain("searchParams.get('verificacion')");
    expect(source).not.toContain("searchParams.get('token')");
    expect(source).toContain('const autorizado = usuario ? puedeAccederInterno(usuario, firma) : false');
  });
});
