import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GuardModuloPlaneacion } from '@/app/interno/licencias/components/GuardModuloPlaneacion';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/* ══════════════════════════════════════════════════════════════
   Micro-bloque "acceso solo Planeación" — gate visual del módulo
   Licencias. El servidor ya exige `canOperateTenant` sobre SEC_PLANEACION
   (no se prueba aquí); este test cubre SOLO la decisión visual de
   `GuardModuloPlaneacion`, que es a propósito más estricta que el
   servidor (excluye a RECEPCIONISTA — ver JSDoc del componente).
══════════════════════════════════════════════════════════════ */

function mockAuth(usuario: UsuarioAutenticado | null, cargando = false): void {
  vi.mocked(useAuth).mockReturnValue({
    usuario,
    cargando,
    error: null,
    cerrarSesion: vi.fn(),
  } satisfies UseAuthReturn);
}

function usuarioDe(rol: UsuarioAutenticado['rol'], tenantId: UsuarioAutenticado['tenantId']): UsuarioAutenticado {
  return { uid: 'u1', email: 'x@simacota.gov.co', nombre: 'Usuaria de prueba', rol, tenantId };
}

const CONTENIDO = 'Contenido protegido del módulo';

describe('GuardModuloPlaneacion — gate visual del módulo Licencias', () => {
  it('ADMIN ve el contenido del módulo, sin importar su tenant', () => {
    mockAuth(usuarioDe('ADMIN', 'SEC_GOBIERNO'));
    render(<GuardModuloPlaneacion><p>{CONTENIDO}</p></GuardModuloPlaneacion>);
    expect(screen.getByText(CONTENIDO)).toBeTruthy();
    expect(screen.queryByText(/pertenece a la Secretaría de Planeación/i)).toBeNull();
  });

  it('FUNCIONARIO de SEC_PLANEACION ve el contenido del módulo', () => {
    mockAuth(usuarioDe('FUNCIONARIO', 'SEC_PLANEACION'));
    render(<GuardModuloPlaneacion><p>{CONTENIDO}</p></GuardModuloPlaneacion>);
    expect(screen.getByText(CONTENIDO)).toBeTruthy();
    expect(screen.queryByText(/pertenece a la Secretaría de Planeación/i)).toBeNull();
  });

  it('FUNCIONARIO de otra dependencia ve la tarjeta institucional, no el contenido', () => {
    mockAuth(usuarioDe('FUNCIONARIO', 'SEC_GOBIERNO'));
    render(<GuardModuloPlaneacion><p>{CONTENIDO}</p></GuardModuloPlaneacion>);
    expect(screen.queryByText(CONTENIDO)).toBeNull();
    expect(screen.getByText(/pertenece a la Secretaría de Planeación/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Volver al Tablero/i })).toBeTruthy();
  });

  it('RECEPCIONISTA ve la tarjeta institucional aunque el servidor lo deje operar la API', () => {
    mockAuth(usuarioDe('RECEPCIONISTA', 'SEC_GOBIERNO'));
    render(<GuardModuloPlaneacion><p>{CONTENIDO}</p></GuardModuloPlaneacion>);
    expect(screen.queryByText(CONTENIDO)).toBeNull();
    expect(screen.getByText(/pertenece a la Secretaría de Planeación/i)).toBeTruthy();
  });

  it('mientras carga la sesión no muestra ni el contenido ni la tarjeta de rechazo', () => {
    mockAuth(null, true);
    render(<GuardModuloPlaneacion><p>{CONTENIDO}</p></GuardModuloPlaneacion>);
    expect(screen.queryByText(CONTENIDO)).toBeNull();
    expect(screen.queryByText(/pertenece a la Secretaría de Planeación/i)).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
