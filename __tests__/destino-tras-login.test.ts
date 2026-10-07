import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESTINO_POR_DEFECTO, destinoTrasLogin, urlLoginConRetorno } from '@/lib/auth/destino-tras-login';
import { urlLicencias } from '@/app/interno/licencias/rutas-licencias';

/* ══════════════════════════════════════════════════════════════
   Enlaces directos a través del login (cierre de la Ola 3, hallazgo H1
   de la revisión QA). Sin sesión, `/interno/dashboard?vista=licencias&
   expediente=…` llegaba al login con `next=/interno/dashboard`: se perdían
   los parámetros, y con sesión el layout mandaba siempre al Tablero.
══════════════════════════════════════════════════════════════ */

describe('destinoTrasLogin', () => {
  it('vuelve exactamente al enlace interno, con sus parámetros', () => {
    const expediente = urlLicencias({ expedienteId: 'lic-2026-0001' });
    expect(destinoTrasLogin(expediente)).toBe(expediente);
    expect(destinoTrasLogin('/interno/dashboard?radicadoId=1-110-202609-00000345')).toBe('/interno/dashboard?radicadoId=1-110-202609-00000345');
    expect(destinoTrasLogin('/interno/licencias/lic-7')).toBe('/interno/licencias/lic-7');
  });

  it('nunca sale del panel interno (sin redirecciones abiertas)', () => {
    for (const malo of [
      'https://evil.example', '//evil.example/interno/', '/consulta', 'javascript:alert(1)', '', null, undefined,
      // Revisión de seguridad (24-sep-2026): el texto empieza por /interno/,
      // pero la URL RESUELTA sale del panel o del sitio.
      '/interno/..//evil.com', '/interno/%2e%2e//evil.com', '/interno/%2E%2E/%2e%2e//evil.com',
      '/interno/..\\/evil.com', '/interno/\t..//evil.com', '/interno/.%2e//evil.com',
      '/interno/../consulta', '/interno/%2e%2e/api/auth/logout',
    ]) {
      expect(destinoTrasLogin(malo), String(malo)).toBe(DESTINO_POR_DEFECTO);
    }
  });

  it('no vuelve a la página de login (sin bucles), tenga o no parámetros', () => {
    for (const login of ['/interno/login', '/interno/login?next=/interno/dashboard', '/interno/./login', '/interno/login/', '/interno/../interno/login?next=x', '/interno//login?next=x']) {
      expect(destinoTrasLogin(login), login).toBe(DESTINO_POR_DEFECTO);
    }
  });

  it('invariante: todo destino se resuelve dentro de /interno/ y nunca es relativo al protocolo', () => {
    const entradas = [
      '/interno/dashboard?vista=licencias&expediente=lic-1', '/interno/a/../b', '/interno/%2e%2e//x', '/interno//x',
      '/interno/\\x', '/interno/licencias/lic-7#x', '/interno/..', '/interno/%2F%2Fevil.com', 'x', '/interno/\n//evil',
    ];
    for (const e of entradas) {
      const d = destinoTrasLogin(e);
      expect(new URL(d, 'https://x').pathname.startsWith('/interno/'), `${e} → ${d}`).toBe(true);
      expect(d.startsWith('//'), `${e} → ${d}`).toBe(false);
      expect(new URL(d, 'https://x').origin).toBe('https://x');
    }
  });

  it('la dirección de login lleva la ruta Y los parámetros, codificados', () => {
    const url = urlLoginConRetorno('/interno/dashboard', '?vista=licencias&expediente=lic-7');
    expect(url).toBe('/interno/login?next=%2Finterno%2Fdashboard%3Fvista%3Dlicencias%26expediente%3Dlic-7');
    const next = new URL(url, 'https://x').searchParams.get('next');
    expect(destinoTrasLogin(next)).toBe('/interno/dashboard?vista=licencias&expediente=lic-7');
  });
});

describe('layout interno y formulario usan la misma regla', () => {
  const layout = readFileSync('app/interno/layout.tsx', 'utf8');
  const formulario = readFileSync('app/interno/login/LoginForm.tsx', 'utf8');

  it('sin sesión: el retorno incluye los parámetros de la dirección', () => {
    expect(layout).toContain('router.replace(urlLoginConRetorno(pathname, window.location.search));');
  });

  it('con sesión en el login: se respeta `next` (antes, siempre al Tablero)', () => {
    expect(layout).toContain("router.replace(destinoTrasLogin(new URLSearchParams(window.location.search).get('next')));");
    expect(layout).not.toContain("router.replace('/interno/dashboard')");
  });

  it('el formulario valida `next` con la misma función', () => {
    expect(formulario).toContain("destinoTrasLogin(searchParams.get('next'))");
  });
});

describe('perímetro (proxy.ts) con la misma regla', () => {
  const proxy = readFileSync('proxy.ts', 'utf8');

  it('sin sesión: `next` lleva ruta y parámetros', () => {
    expect(proxy).toContain("loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);");
  });

  it('con sesión en el login: vuelve al `next` validado, nunca a un destino externo', () => {
    expect(proxy).toContain("new URL(destinoTrasLogin(request.nextUrl.searchParams.get('next')), request.url)");
  });
});
