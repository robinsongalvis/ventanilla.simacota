import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, 'utf8');
}

describe('administración institucional de usuarios', () => {
  it('mantiene roles oficiales cerrados', () => {
    const route = read('app/api/admin/usuarios/route.ts');
    const editRoute = read('app/api/admin/usuarios/[uid]/route.ts');

    for (const rol of ['ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO']) {
      expect(route).toContain(`'${rol}'`);
      expect(editRoute).toContain(`'${rol}'`);
    }
    expect(route).toContain('Rol inválido');
    expect(editRoute).toContain('Rol inválido');
  });

  it('mantiene dependencias cerradas desde el directorio oficial', () => {
    const route = read('app/api/admin/usuarios/route.ts');
    const editRoute = read('app/api/admin/usuarios/[uid]/route.ts');

    expect(route).toContain('Object.keys(DIRECTORIO_TENANTS)');
    expect(editRoute).toContain('Object.keys(DIRECTORIO_TENANTS)');
    expect(route).toContain('Dependencia inválida');
    expect(editRoute).toContain('Dependencia inválida');
  });

  it('diferencia usuarios institucionales, UAT y prueba', () => {
    const route = read('app/api/admin/usuarios/route.ts');
    const ui = read('app/interno/dashboard/components/admin/VistaAdministracion.tsx');

    expect(route).toContain('TIPOS_USUARIO_VALIDOS');
    expect(route).toContain('INSTITUCIONAL');
    expect(route).toContain('UAT');
    expect(route).toContain('PRUEBA');
    expect(route).toContain('esPrueba');
    expect(ui).toContain('Prueba/UAT');
    expect(ui).toContain('TIPOS_USUARIO');
  });

  it('implementa archivado lógico y bloquea acceso de archivados', () => {
    const editRoute = read('app/api/admin/usuarios/[uid]/route.ts');

    expect(editRoute).toContain('USUARIO_ARCHIVADO');
    expect(editRoute).toContain('payload.archivado');
    expect(read('proxy.ts')).toContain('archivado !== true');
    expect(read('app/api/auth/session/route.ts')).toContain('archivado === true');
    expect(read('lib/hooks/useAuth.ts')).toContain('archivado === true');
  });

  it('fortalece auditoría administrativa con eventos UAT', () => {
    const editRoute = read('app/api/admin/usuarios/[uid]/route.ts');
    const createRoute = read('app/api/admin/usuarios/route.ts');

    for (const evento of [
      'USUARIO_CREADO',
      'USUARIO_DESACTIVADO',
      'USUARIO_REACTIVADO',
      'USUARIO_MARCADO_PRUEBA',
      'USUARIO_MARCADO_INSTITUCIONAL',
      'ROL_CAMBIADO',
      'DEPENDENCIA_USUARIO_CAMBIADA',
      'RESET_PASSWORD_SOLICITADO',
    ]) {
      expect(`${createRoute}\n${editRoute}`).toContain(evento);
    }
  });

  it('no devuelve ni copia enlaces de reset password en el frontend', () => {
    const editRoute = read('app/api/admin/usuarios/[uid]/route.ts');
    const ui = read('app/interno/dashboard/components/admin/VistaAdministracion.tsx');

    // El route debe usar enviarEmail (link va al correo, no al cliente)
    expect(editRoute).toContain('enviarEmail');
    // El link NO debe devolverse como parte del response JSON al cliente
    expect(editRoute).not.toContain('"link"');
    expect(editRoute).not.toContain("'link'");
    // La UI no debe manipular el link ni copiarlo al portapapeles
    expect(ui).not.toContain('clipboard');
    expect(ui).not.toContain('data.link');
  });
});
