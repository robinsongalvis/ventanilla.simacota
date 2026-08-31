/**
 * Auditoría de seguridad — hallazgo M-3 (Roadmap P2.6).
 *
 * `app/api/simi/notificaciones/whatsapp/route.ts` validaba el gate de tenant
 * del USUARIO pero nunca cargaba el radicado para confirmar que `radicadoId`
 * le pertenece, y el `telefono` destino era un valor arbitrario del body.
 * Un funcionario autenticado podía notificar CUALQUIER radicado a un número
 * que él controlara (fuga/suplantación de PII).
 *
 * Estrategia: solo se mockean fronteras (cookies/sesión, Admin SDK,
 * radicados-security, el proveedor de WhatsApp); el handler POST real se
 * invoca de punta a punta, igual que en subsanacion-rutas-ejecucion.test.ts.
 * `isValidWhatsAppPhone`/`normalizePhone` corren con su implementación real
 * (son funciones puras sin dependencias externas).
 *
 * 31-ago-2026 — ESTE ARCHIVO MIRABA EL RESULTADO, NO EL ORDEN. La prueba del
 * gate de rol se llamaba «403 ANTES de tocar el radicado» y solo aseveraba dos
 * cosas: el 403 y el no-envío. La mitad del nombre —el «antes»— no tenía
 * aserción ninguna. Bajar el bloque `if (!ROLES_AUTORIZADOS.has(usuario.rol))`
 * por debajo de `getRadicadoOrFail` dejaba VERDE la suite entera, y sin embargo
 * cambiaba dos cosas: un rol NO autorizado pasaba a disparar una lectura del
 * expediente a su nombre, y su respuesta pasaba a depender de si el radicado
 * existe (403) o no (404).
 *
 * Calibración honesta de lo que esto gana, para que nadie lea la alarma y la
 * descarte por exagerada: el 403/404 distinguible NO se cierra aquí para todo
 * el mundo. El gate de TENANT (route.ts:100) va necesariamente DESPUÉS de la
 * carga —hay que leer el radicado para saber de qué dependencia es—, así que
 * hoy, con el código correcto, cualquier FUNCIONARIO/RECEPCIONISTA/
 * JEFE_DEPENDENCIA ya distingue «existe en otra dependencia» (403) de «no
 * existe» (404). Eso es una propiedad del diseño de la ruta, no un defecto de
 * este archivo, y queda declarado abajo como fuera de alcance. Lo que el gate
 * de ROL sí sostiene —y es lo único que estas pruebas vigilan— es que los roles
 * FUERA de `ROLES_AUTORIZADOS`, hoy solo `CONTROL_INTERNO` (la cuenta que
 * audita), no lean expedientes ni puedan enumerarlos.
 *
 * El testigo estaba a mano y no se usó: `getRadicadoOrFail` ya estaba mockeado
 * en este mismo archivo. Ahora se IMPORTA y se le pregunta si el handler llegó a
 * abrir el expediente. Lo que se vigila desde hoy es el SITIO del control de
 * permisos, no su código de estado: el código de estado es justo lo que no se
 * mueve cuando el control se cae de sitio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

/* ── Estado mutable de los fixtures (leído por los mocks) ─────────── */

let cookieValue: string | undefined;
let userDoc: {
  nombre?: string;
  rol?: string;
  tenantId?: string;
  activo?: boolean;
  archivado?: boolean;
} | null;
let radicadoFixture: {
  clasificacion: { oficinaDestino: string };
  solicitante: { telefonoMovil?: string | null; telefono?: string | null };
} | null;
let sendResult: { ok: boolean; provider: string; simulated?: boolean; messageId?: string; error?: string };
let sendCalls: Array<Record<string, unknown>>;

/* ── Mocks de fronteras ─────────────────────────────────────────── */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieValue !== undefined && name === SESSION_COOKIE_NAME ? { value: cookieValue } : undefined,
  })),
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: vi.fn(async (sc: string) => {
      if (sc !== 'valid-cookie') throw new Error('Sesión inválida.');
      return { uid: 'u1', email: 'funcionario@simacota.gov.co' };
    }),
  }),
  getFirebaseAdminDb: () => ({
    doc: (path: string) => ({
      get: async () => {
        if (path === 'users/u1' && userDoc) {
          return { exists: true, data: () => userDoc };
        }
        return { exists: false, data: () => undefined };
      },
    }),
  }),
}));

vi.mock('@/lib/server/radicados-security', () => {
  class RadicadoActionError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    RadicadoActionError,
    getRadicadoOrFail: vi.fn(async () => {
      if (!radicadoFixture) throw new RadicadoActionError('Radicado no encontrado.', 404);
      return radicadoFixture;
    }),
  };
});

vi.mock('@/lib/simi-juridico/sendCitizenWhatsAppNotification', () => ({
  sendCitizenWhatsAppNotification: vi.fn(async (params: Record<string, unknown>) => {
    sendCalls.push(params);
    return sendResult;
  }),
}));

import { POST } from '@/app/api/simi/notificaciones/whatsapp/route';
import { sendCitizenWhatsAppNotification } from '@/lib/simi-juridico/sendCitizenWhatsAppNotification';
/*
 * EL TESTIGO DEL ORDEN. Llega MOCKEADO (lo sustituye la fábrica de arriba), así
 * que preguntarle si fue llamado es preguntar si el handler llegó a abrir el
 * expediente en Firestore. Es el dato que faltaba: sin él, este archivo solo
 * podía mirar el código de estado de la respuesta.
 */
import { getRadicadoOrFail } from '@/lib/server/radicados-security';

/* ── Helpers ────────────────────────────────────────────────────── */

function req(body: unknown): Request {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
}

const BODY_BASE = {
  radicadoId: 'r1',
  telefono: '3101234567',
  eventType: 'radicado_recibido' as const,
  consentimiento: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  cookieValue = 'valid-cookie';
  userDoc = { nombre: 'Ana Funcionaria', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO', activo: true };
  radicadoFixture = {
    clasificacion: { oficinaDestino: 'SEC_GOBIERNO' },
    solicitante: { telefonoMovil: '3101234567' },
  };
  sendResult = { ok: true, provider: 'mock', simulated: true, messageId: 'msg_1' };
  sendCalls = [];
});

describe('POST /api/simi/notificaciones/whatsapp — pertenencia radicado-tenant, teléfono del solicitante y ORDEN del control de permisos', () => {
  it('caso feliz — radicado propio + teléfono del solicitante → envía y usa el teléfono REGISTRADO', async () => {
    const res = await POST(req(BODY_BASE));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(sendCitizenWhatsAppNotification).toHaveBeenCalledOnce();
    expect(sendCalls[0]).toMatchObject({
      radicadoId: 'R1',
      tenantId: 'SEC_GOBIERNO',
      to: '3101234567',
    });
  });

  it('radicado de otro tenant — FUNCIONARIO de otro tenant → 403, no envía', async () => {
    userDoc = { nombre: 'Ana', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA', activo: true };
    // radicadoFixture sigue en SEC_GOBIERNO: fuera del alcance del usuario.
    const res = await POST(req(BODY_BASE));
    const json = await res.json();

    expect(res.status).toBe(403);
    /*
     * El 403 no puede ser mudo: en esta ruta hay TRES protecciones distintas
     * que responden 403 (rol, tenant y teléfono que no coincide). Mirar solo el
     * número deja que esta prueba se dé por satisfecha con el 403 de otra.
     * El patrón admite «dependencia» porque el dominio de este proyecto se
     * nombra en español (AGENTS.md) y renombrar ese mensaje es plausible; los
     * otros dos mensajes de 403 no contienen ninguna de las dos palabras, así
     * que la aserción sigue discriminando.
     */
    expect(json.error, 'el 403 tenía que venir del gate de TENANT, no de otro de los tres controles que responden 403').toMatch(/tenant|dependencia/i);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('ADMIN puede notificar un radicado de cualquier tenant (si el teléfono coincide) → 200', async () => {
    userDoc = { nombre: 'Root', rol: 'ADMIN', tenantId: 'SEC_HACIENDA', activo: true };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(200);
    expect(sendCitizenWhatsAppNotification).toHaveBeenCalledOnce();
  });

  it('teléfono que no coincide con el solicitante → rechazado (403), no envía', async () => {
    const res = await POST(req({ ...BODY_BASE, telefono: '3009999999' }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/no coincide/i);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('teléfono con formato distinto pero mismo número (con +57) → coincide y envía', async () => {
    const res = await POST(req({ ...BODY_BASE, telefono: '+57 310 123 4567' }));
    expect(res.status).toBe(200);
    expect(sendCitizenWhatsAppNotification).toHaveBeenCalledOnce();
  });

  it('radicado inexistente → 404, no envía', async () => {
    radicadoFixture = null;
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(404);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('radicado sin teléfono móvil registrado del solicitante → 422, no envía', async () => {
    radicadoFixture = { clasificacion: { oficinaDestino: 'SEC_GOBIERNO' }, solicitante: {} };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(422);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('compatibilidad — usa el `telefono` legado del solicitante si no hay `telefonoMovil`', async () => {
    radicadoFixture = {
      clasificacion: { oficinaDestino: 'SEC_GOBIERNO' },
      solicitante: { telefono: '3101234567' },
    };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(200);
    expect(sendCalls[0]).toMatchObject({ to: '3101234567' });
  });

  it('sin consentimiento en el body → 422, no envía (comportamiento preexistente)', async () => {
    const res = await POST(req({ ...BODY_BASE, consentimiento: false }));

    expect(res.status).toBe(422);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('sin sesión → 401 y el radicado NUNCA se lee (el anónimo no toca el expediente)', async () => {
    cookieValue = undefined;
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(401);
    /*
     * Misma forma que la del rol: el nombre prometía una puerta y solo se
     * miraba el número. Un 401 se sigue devolviendo aunque la puerta se abra
     * después de leer el expediente.
     */
    expect(
      getRadicadoOrFail,
      'una petición SIN SESIÓN llegó a leer el radicado: la puerta de autenticación dejó de ir primero',
    ).not.toHaveBeenCalled();
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  /* ── EL ORDEN DEL CONTROL DE PERMISOS ──────────────────────────────────────
     Las tres pruebas que siguen no miran el RESULTADO de la petición: miran
     DÓNDE se corta. El gate de rol vive antes de leer el body y antes de cargar
     el radicado, y ese sitio ES la protección — el 403 sale igual desde
     cualquier otro sitio, que es exactamente por lo que nadie lo vigilaba.

     QUÉ VIGILAN: que un rol fuera de `ROLES_AUTORIZADOS` (1) no llegue nunca a
     `getRadicadoOrFail`, (2) reciba la MISMA respuesta exista o no el radicado
     pedido, y (3) sea cortado antes de que el handler parsee el body. Entre las
     tres fijan el gate por encima de TODO lo que hoy le sigue; por debajo del
     chequeo de sesión no puede subir, porque lee `usuario.rol`.

     QUÉ NO VIGILAN (declarado, ADR-0033 §4.6-bis):
     · El orden entre las validaciones del body (evento, consentimiento, formato
       del teléfono) y la carga del radicado: moverlas no cambia quién puede leer
       expedientes.
     · El orden del gate de TENANT respecto de la carga. No es que se dé por
       bueno: es que NO PUEDE ir antes — hay que leer el radicado para saber de
       qué dependencia es. Consecuencia asumida y NO cerrada aquí: un rol SÍ
       autorizado (FUNCIONARIO, RECEPCIONISTA, JEFE_DEPENDENCIA) distingue hoy
       403 «existe, otra dependencia» de 404 «no existe». Cerrar eso es un cambio
       de producto —unificar ambas respuestas—, no una prueba.
     · Las rutas hermanas con el mismo patrón: sellar-documento:91,
       completar-datos:62, enviar-constancia:56, registro-expres:60. Las cuatro
       son correctas hoy y ninguna tiene detector de orden; la ausencia queda
       escrita para que sea deliberada y no un olvido. */

  /* El mismo usuario en las tres: autenticado y activo, y en el MISMO tenant que
     el radicado —para que ningún 403 pueda venir del gate de tenant— pero fuera
     de `ROLES_AUTORIZADOS`: control interno audita, no notifica. */
  const AUDITOR_SIN_PERMISO = { nombre: 'Aud', rol: 'CONTROL_INTERNO', tenantId: 'SEC_GOBIERNO', activo: true };

  it('rol sin permiso (CONTROL_INTERNO) → 403 y el radicado NUNCA se lee', async () => {
    userDoc = AUDITOR_SIN_PERMISO;
    const res = await POST(req(BODY_BASE));
    const json = await res.json();

    expect(res.status, 'un rol fuera de ROLES_AUTORIZADOS dejó de ser rechazado').toBe(403);
    expect(json.error, 'el 403 tenía que venir del gate de ROL, no de otro de los tres controles que responden 403').toMatch(/sin permiso/i);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
    /*
     * LA ASERCIÓN QUE FALTABA. Es la mitad del nombre («antes de tocar el
     * radicado») que nunca comprobó nada: con el gate movido debajo de la
     * carga, el 403 y el no-envío seguían saliendo idénticos.
     */
    expect(
      getRadicadoOrFail,
      'el gate de ROL dejó de cortar antes de cargar el expediente: CONTROL_INTERNO, que solo audita, ya dispara lecturas de radicados a su nombre',
    ).not.toHaveBeenCalled();
  });

  it('rol sin permiso + radicado INEXISTENTE → sigue 403, jamás 404 (misma respuesta exista o no el expediente)', async () => {
    userDoc = AUDITOR_SIN_PERMISO;
    radicadoFixture = null; // el `radicadoId` pedido no existe en Firestore

    const res = await POST(req(BODY_BASE));
    const json = await res.json();

    /*
     * Con el gate en su sitio, quien no está autorizado recibe SIEMPRE la misma
     * respuesta, exista o no el expediente. Si el gate baja, esta prueba
     * responde 404 y la anterior 403: esa diferencia convierte la ruta en un
     * enumerador de radicados para la cuenta de auditoría.
     */
    expect(
      res.status,
      'un rol SIN autorización ya distingue radicado existente (403) de inexistente (404): CONTROL_INTERNO puede enumerar expedientes a golpe de radicadoId',
    ).toBe(403);
    expect(json.error, 'el mensaje delata el 404 del radicado: el gate de ROL no fue quien respondió').toMatch(/sin permiso/i);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('rol sin permiso + body ilegible → 403, no 400 (el gate corta antes de leer el body)', async () => {
    userDoc = AUDITOR_SIN_PERMISO;
    /* Body que `request.json()` no puede parsear. Con el gate en su sitio ni
       siquiera se intenta parsearlo; si el gate baja, la respuesta pasa a ser
       400 «Payload inválido.» — señal de que la entrada no confiable de quien
       no tiene permiso ya se está procesando. */
    const res = await POST(new Request('http://x', { method: 'POST', body: 'esto-no-es-json' }));
    const json = await res.json();

    expect(
      res.status,
      'el gate de ROL dejó de cortar antes de leer el body: quien no tiene permiso ya llega al parseo de entrada no confiable',
    ).toBe(403);
    expect(json.error, 'el 403 no vino del gate de ROL').toMatch(/sin permiso/i);
    expect(getRadicadoOrFail).not.toHaveBeenCalled();
  });
});
