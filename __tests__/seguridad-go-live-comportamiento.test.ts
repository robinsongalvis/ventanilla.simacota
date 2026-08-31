/**
 * @vitest-environment node
 *
 * TANDA A del barrido de dobles verdes (30-ago-2026).
 *
 * Tres pruebas de seguridad pasaban SIN probar lo que decían. No era una
 * sospecha: a cada una se le metió en el código el fallo que decía vigilar y
 * las tres siguieron en VERDE.
 *
 *   · «los cron no conservan fail-open» — se borró el `return` de la rama de
 *     denegación (el cron corre COMPLETO para un llamador sin credencial) y
 *     la prueba pasó 16/16. Solo buscaba la ausencia de UNA redacción
 *     histórica del fail-open, nunca que el veredicto se OBEDECIERA.
 *   · «revoca tokens al desactivar usuarios internos» — se borró la
 *     revocación entera de la rama de desactivación y la prueba pasó 7/7,
 *     porque la cadena `revokeRefreshTokens` sobrevive en un comentario y en
 *     la rama de archivado.
 *
 * La causa común: comprobaban que el ARCHIVO CONTIENE un texto, no que el
 * MECANISMO FUNCIONE. Mientras el literal siguiera escrito en cualquier
 * parte, el código podía hacer lo contrario de lo que promete.
 *
 * Estas pruebas EJECUTAN el código. Cada una está verificada por mutación:
 * con el fallo puesto se ponen ROJAS (ADR-0033 §4.6-ter — un detector no se
 * da por bueno hasta verlo fallar).
 *
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis). Lo que estas pruebas MIRAN:
 *   · que la denegación de `autorizarCron` DETIENE la ejecución en los dos
 *     crones que autoriza el helper;
 *   · que desactivar un usuario interno revoca sus refresh tokens.
 * Lo que NO miran, y queda cubierto en otra parte:
 *   · el criterio interno de `autorizarCron` — `hardening-produccion.test.ts`;
 *   · que los crones estén CABLEADOS en `vercel.json` — fuera de alcance aquí;
 *   · el resto de ramas del PATCH de usuarios (rol, tenant, archivado).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ══════════════════════════════════════════════════════════════
   Frontera Admin SDK — la única que se simula. El handler es el real.
══════════════════════════════════════════════════════════════ */

const getFirebaseAdminDb = vi.fn(() => {
  throw new Error('El cron tocó la base de datos pese a la denegación.');
});
const verifySessionCookie = vi.fn(async () => ({ uid: 'admin-1' }));
const updateUser          = vi.fn(async () => undefined);
const revokeRefreshTokens = vi.fn(async () => undefined);
const generateDeadlineAlerts = vi.fn(async () => []);

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb:   () => getFirebaseAdminDb(),
  getFirebaseAdminAuth: () => ({ verifySessionCookie, updateUser, revokeRefreshTokens }),
}));
vi.mock('@/lib/email/mailer', () => ({ enviarEmail: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logError: () => {} }));
vi.mock('@/lib/observabilidad/eventos-negocio', () => ({ registrarEventoNegocio: async () => {} }));
vi.mock('@/lib/simi-juridico/predictDeadlineAlerts', () => ({
  generateDeadlineAlerts: () => generateDeadlineAlerts(),
}));
vi.mock('@/lib/simi-juridico/createNotification', () => ({ createNotification: async () => {} }));

import { GET as GET_ALERTAS } from '@/app/api/cron/alertas-vencimiento/route';
import { GET as GET_SIMI }    from '@/app/api/cron/simi/alertas-vencimiento/route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'secreto-real';
});

/* ══════════════════════════════════════════════════════════════
   1 · La denegación del cron DETIENE la ejecución
   ══════════════════════════════════════════════════════════════
   El fail-open que se busca NO es «el helper decide mal» — eso ya está
   probado. Es «el helper decide bien y la ruta sigue de largo». Por eso la
   aserción que importa no es el 401: es que el trabajo NUNCA EMPEZÓ.
══════════════════════════════════════════════════════════════ */

const CRONES = [
  {
    nombre: 'alertas-vencimiento',
    handler: GET_ALERTAS,
    // El primer acto del cron autorizado es abrir la base.
    noDebioEmpezar: () => expect(getFirebaseAdminDb).not.toHaveBeenCalled(),
  },
  {
    nombre: 'simi/alertas-vencimiento',
    handler: GET_SIMI,
    // El primer acto del cron autorizado es calcular las alertas.
    noDebioEmpezar: () => expect(generateDeadlineAlerts).not.toHaveBeenCalled(),
  },
] as const;

describe.each(CRONES)('cron $nombre — la denegación detiene la ejecución', ({ handler, noDebioEmpezar }) => {
  const peticion = (authorization: string | null) =>
    new Request('https://ventanilla.test/api/cron', {
      headers: authorization === null ? {} : { authorization },
    });

  it('sin cabecera Authorization: responde 401 y NO empieza el trabajo', async () => {
    const res = await handler(peticion(null));

    expect(res.status).toBe(401);
    noDebioEmpezar();
  });

  it('con token incorrecto: responde 401 y NO empieza el trabajo', async () => {
    const res = await handler(peticion('Bearer token-que-no-es'));

    expect(res.status).toBe(401);
    noDebioEmpezar();
  });

  it('y el cuerpo del rechazo no filtra el secreto', async () => {
    const res = await handler(peticion('Bearer token-que-no-es'));

    expect(JSON.stringify(await res.json())).not.toContain('secreto-real');
  });
});

/* ══════════════════════════════════════════════════════════════
   2 · Desactivar un usuario revoca sus tokens
   ══════════════════════════════════════════════════════════════
   Sin la revocación, una cuenta dada de baja conserva su sesión viva hasta
   que el refresh token caduque por su cuenta: el usuario sigue entrando
   después de que la Alcaldía lo dio de baja.
══════════════════════════════════════════════════════════════ */

const SESSION_COOKIE = 'cookie-de-sesion-de-admin';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: SESSION_COOKIE }) }),
}));

type Documento = { exists: boolean; data: () => Record<string, unknown> };

let escrituras: Record<string, unknown>[];

function fakeDb(usuarioObjetivo: Record<string, unknown>) {
  const doc = (path: string) => ({
    path,
    get: async (): Promise<Documento> =>
      path === 'users/admin-1'
        ? { exists: true, data: () => ({ rol: 'ADMIN', activo: true, nombre: 'La admin' }) }
        : { exists: true, data: () => usuarioObjetivo },
    update: async (d: Record<string, unknown>) => { escrituras.push(d); },
  });
  return {
    doc,
    collection: () => ({ doc: () => ({ path: 'admin_auditoria/x' }) }),
    batch: () => ({ set: () => {}, commit: async () => {} }),
  };
}

describe('PATCH /api/admin/usuarios/[uid] — desactivar revoca los tokens', () => {
  const desactivar = async (usuarioObjetivo: Record<string, unknown>, body: Record<string, unknown>) => {
    escrituras = [];
    const db = fakeDb(usuarioObjetivo);
    getFirebaseAdminDb.mockImplementation(() => db as never);
    const { PATCH } = await import('@/app/api/admin/usuarios/[uid]/route');
    return PATCH(
      new Request('https://ventanilla.test/api/admin/usuarios/u-9', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ uid: 'u-9' }) },
    );
  };

  it('al desactivar, revoca los refresh tokens del usuario afectado', async () => {
    const res = await desactivar(
      { rol: 'FUNCIONARIO', activo: true, nombre: 'Quien se va', tenantId: 'SEC_PLANEACION' },
      { activo: false },
    );

    expect(res.status).toBe(200);
    expect(revokeRefreshTokens).toHaveBeenCalledWith('u-9');
    // Y se deshabilita en Auth, que es la otra mitad del cierre de sesión.
    expect(updateUser).toHaveBeenCalledWith('u-9', { disabled: true });
  });

  it('al REACTIVAR no revoca nada — revocar ahí echaría a un usuario legítimo', async () => {
    await desactivar(
      { rol: 'FUNCIONARIO', activo: false, nombre: 'Quien vuelve', tenantId: 'SEC_PLANEACION' },
      { activo: true },
    );

    expect(updateUser).toHaveBeenCalledWith('u-9', { disabled: false });
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
