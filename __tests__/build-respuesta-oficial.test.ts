/**
 * Tests del builder de RespuestaOficial — bug detectado en UAT:
 * la versión anterior retornaba null cuando no había PDF adjunto, lo
 * que dejaba la consulta ciudadana y el CSV MIPG sin texto de respuesta.
 *
 * La nueva versión persiste SIEMPRE que haya `nota` válida, y deja
 * `archivoPath` / `archivoNombre` en null cuando no se adjuntó PDF.
 */
import { describe, it, expect } from 'vitest';
import { buildRespuestaOficial } from '@/lib/server/radicados-security';
import type { InternalUserSession } from '@/lib/server/internal-auth';
import type { ArchivoRadicado } from '@/src/types/ventanilla';

const USUARIO: InternalUserSession = {
  uid: 'usr_001',
  email: 'funcionario@simacota-santander.gov.co',
  nombre: 'Funcionario UAT',
  rol: 'FUNCIONARIO',
  tenantId: 'SEC_GOBIERNO',
  activo: true,
};

const AHORA = '2026-06-14T15:30:00.000Z';
const NOTA = 'Respuesta oficial al ciudadano explicando la situación.';

const ARCHIVO: ArchivoRadicado = {
  nombre: 'oficio-firmado.pdf',
  url: '',
  path: 'respuestas/SIM-001/oficio-firmado.pdf',
  tipo: 'application/pdf',
  tamanioKB: 120,
  orden: 1,
};

describe('buildRespuestaOficial', () => {
  it('persiste la respuesta CON PDF adjunto', () => {
    const respuesta = buildRespuestaOficial(ARCHIVO, NOTA, AHORA, USUARIO);
    expect(respuesta).not.toBeNull();
    expect(respuesta).toMatchObject({
      archivoPath: 'respuestas/SIM-001/oficio-firmado.pdf',
      archivoNombre: 'oficio-firmado.pdf',
      nota: NOTA,
      fecha: AHORA,
      actorUid: 'usr_001',
      actorNombre: 'Funcionario UAT',
    });
  });

  it('persiste la respuesta SIN PDF (caso UAT) con archivoPath y archivoNombre en null', () => {
    const respuesta = buildRespuestaOficial(null, NOTA, AHORA, USUARIO);
    expect(respuesta).not.toBeNull();
    expect(respuesta?.archivoPath).toBeNull();
    expect(respuesta?.archivoNombre).toBeNull();
    expect(respuesta?.nota).toBe(NOTA);
    expect(respuesta?.actorUid).toBe('usr_001');
  });

  it('retorna null si la nota es vacía o solo espacios', () => {
    expect(buildRespuestaOficial(null, '', AHORA, USUARIO)).toBeNull();
    expect(buildRespuestaOficial(null, '    ', AHORA, USUARIO)).toBeNull();
    expect(buildRespuestaOficial(ARCHIVO, '', AHORA, USUARIO)).toBeNull();
  });

  it('recorta whitespace en la nota antes de persistir', () => {
    const respuesta = buildRespuestaOficial(null, `  ${NOTA}  `, AHORA, USUARIO);
    expect(respuesta?.nota).toBe(NOTA);
  });
});
