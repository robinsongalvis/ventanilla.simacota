/**
 * @vitest-environment node
 *
 * Contrato HTTP de la autenticacion interna centralizada.
 *
 * Esta suite ejecuta cada handler migrado con una denegacion comun y vigila
 * que conserve 401/500 sin abrir fronteras de Firebase antes de autenticar,
 * salvo la auditoria explicita de denegaciones. Los payloads son deliberadamente
 * invalidos; si una ruta los leyera antes del guard, devolveria 400 y fallaria.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { RolInterno } from '@/lib/hooks/useAuth';

const mocks = vi.hoisted(() => ({
  autenticarUsuarioInterno: vi.fn(),
  getFirebaseAdminApp: vi.fn(),
  getFirebaseAdminAuth: vi.fn(),
  getFirebaseAdminDb: vi.fn(),
  getFirebaseAdminStorage: vi.fn(),
  getDb: vi.fn(),
  getFirebaseAuth: vi.fn(),
  getStorage: vi.fn(),
  checkRateLimit: vi.fn(() => null),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/server/internal-auth-http', () => ({
  autenticarUsuarioInterno: mocks.autenticarUsuarioInterno,
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminApp: mocks.getFirebaseAdminApp,
  getFirebaseAdminAuth: mocks.getFirebaseAdminAuth,
  getFirebaseAdminDb: mocks.getFirebaseAdminDb,
  getFirebaseAdminStorage: mocks.getFirebaseAdminStorage,
}));

vi.mock('@/lib/firebase', () => ({
  getDb: mocks.getDb,
  getFirebaseAuth: mocks.getFirebaseAuth,
  getStorage: mocks.getStorage,
}));

vi.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitHeaders: mocks.rateLimitHeaders,
}));

import * as adminUsuarios from '@/app/api/admin/usuarios/route';
import * as adminUsuario from '@/app/api/admin/usuarios/[uid]/route';
import * as aiCopilot from '@/app/api/ai/copilot/route';
import * as aiFeedback from '@/app/api/ai/feedback/route';
import * as aiLog from '@/app/api/ai/log/route';
import * as archivoInterno from '@/app/api/interno/archivo/route';
import * as notificarCiudadano from '@/app/api/interno/notificar-ciudadano/route';
import * as resumenDiario from '@/app/api/interno/resumen-diario/route';
import * as resumenDiarioVisto from '@/app/api/interno/resumen-diario/visto/route';
import * as busquedaAvanzada from '@/app/api/radicados/busqueda-avanzada/route';
import * as reporteMipg from '@/app/api/reportes/mipg/excel/route';
import * as borradores from '@/app/api/simi/borradores/route';
import * as controlInterno from '@/app/api/simi/control-interno/route';
import * as feedback from '@/app/api/simi/feedback/route';
import * as aprobacion from '@/app/api/simi/juridico/aprobacion/[id]/route';
import * as aprobaciones from '@/app/api/simi/juridico/aprobaciones/route';
import * as juridico from '@/app/api/simi/juridico/route';
import * as metricas from '@/app/api/simi/metricas/route';
import * as normogramaId from '@/app/api/simi/normograma/[id]/route';
import * as normograma from '@/app/api/simi/normograma/route';
import * as notificaciones from '@/app/api/simi/notificaciones/route';
import * as whatsapp from '@/app/api/simi/notificaciones/whatsapp/route';
import * as plantillas from '@/app/api/simi/plantillas/route';
import * as radicado from '@/app/api/simi/radicado/route';
import * as reportes from '@/app/api/simi/reportes/route';
import * as trazabilidad from '@/app/api/simi/reportes/trazabilidad/[radicadoId]/route';
import * as firmaPdf from '@/app/api/simi/respuestas/firma/[id]/pdf/route';
import * as firmaId from '@/app/api/simi/respuestas/firma/[id]/route';
import * as firma from '@/app/api/simi/respuestas/firma/route';

type EjecutarHandler = () => Promise<Response>;
type CasoHandler = {
  nombre: string;
  ejecutar: EjecutarHandler;
  permiteAuditoriaDenegacion?: boolean;
};

const solicitud = (method: string): Request => new Request('https://ventanilla.test/api', {
  method,
  ...(method === 'GET' ? {} : { body: '{payload-invalido' }),
});

const uidContext = { params: Promise.resolve({ uid: 'u-objetivo' }) };
const idContext = { params: Promise.resolve({ id: 'documento-1' }) };
const radicadoContext = { params: Promise.resolve({ radicadoId: 'RAD-1' }) };

const HANDLERS: CasoHandler[] = [
  { nombre: 'admin/usuarios GET', ejecutar: () => adminUsuarios.GET(solicitud('GET')) },
  { nombre: 'admin/usuarios POST', ejecutar: () => adminUsuarios.POST(solicitud('POST')) },
  { nombre: 'admin/usuarios/[uid] PATCH', ejecutar: () => adminUsuario.PATCH(solicitud('PATCH'), uidContext) },
  { nombre: 'admin/usuarios/[uid] POST', ejecutar: () => adminUsuario.POST(solicitud('POST'), uidContext) },
  { nombre: 'ai/copilot POST', ejecutar: () => aiCopilot.POST(solicitud('POST')) },
  { nombre: 'ai/feedback POST', ejecutar: () => aiFeedback.POST(solicitud('POST')) },
  {
    nombre: 'ai/log POST',
    ejecutar: () => aiLog.POST(solicitud('POST')),
    permiteAuditoriaDenegacion: true,
  },
  { nombre: 'interno/archivo GET', ejecutar: () => archivoInterno.GET(solicitud('GET')) },
  {
    nombre: 'interno/notificar-ciudadano POST',
    ejecutar: () => notificarCiudadano.POST(solicitud('POST')),
  },
  { nombre: 'interno/resumen-diario GET', ejecutar: () => resumenDiario.GET() },
  {
    nombre: 'interno/resumen-diario/visto POST',
    ejecutar: () => resumenDiarioVisto.POST(solicitud('POST')),
  },
  {
    nombre: 'radicados/busqueda-avanzada POST',
    ejecutar: () => busquedaAvanzada.POST(solicitud('POST')),
  },
  { nombre: 'reportes/mipg/excel POST', ejecutar: () => reporteMipg.POST(solicitud('POST')) },
  { nombre: 'simi/borradores GET', ejecutar: () => borradores.GET(solicitud('GET')) },
  { nombre: 'simi/borradores POST', ejecutar: () => borradores.POST(solicitud('POST')) },
  { nombre: 'simi/control-interno GET', ejecutar: () => controlInterno.GET(solicitud('GET')) },
  { nombre: 'simi/feedback POST', ejecutar: () => feedback.POST(solicitud('POST')) },
  { nombre: 'simi/juridico/aprobacion/[id] PATCH', ejecutar: () => aprobacion.PATCH(solicitud('PATCH'), idContext) },
  { nombre: 'simi/juridico/aprobaciones GET', ejecutar: () => aprobaciones.GET(solicitud('GET')) },
  { nombre: 'simi/juridico POST', ejecutar: () => juridico.POST(solicitud('POST')) },
  { nombre: 'simi/metricas GET', ejecutar: () => metricas.GET() },
  { nombre: 'simi/normograma/[id] PATCH', ejecutar: () => normogramaId.PATCH(solicitud('PATCH'), idContext) },
  { nombre: 'simi/normograma/[id] DELETE', ejecutar: () => normogramaId.DELETE(solicitud('DELETE'), idContext) },
  { nombre: 'simi/normograma GET', ejecutar: () => normograma.GET(solicitud('GET')) },
  { nombre: 'simi/normograma POST', ejecutar: () => normograma.POST(solicitud('POST')) },
  { nombre: 'simi/notificaciones GET', ejecutar: () => notificaciones.GET(solicitud('GET')) },
  { nombre: 'simi/notificaciones PATCH', ejecutar: () => notificaciones.PATCH(solicitud('PATCH')) },
  { nombre: 'simi/notificaciones/whatsapp POST', ejecutar: () => whatsapp.POST(solicitud('POST')) },
  { nombre: 'simi/plantillas GET', ejecutar: () => plantillas.GET(solicitud('GET')) },
  { nombre: 'simi/plantillas POST', ejecutar: () => plantillas.POST(solicitud('POST')) },
  { nombre: 'simi/radicado POST', ejecutar: () => radicado.POST(solicitud('POST')) },
  { nombre: 'simi/reportes GET', ejecutar: () => reportes.GET(solicitud('GET')) },
  {
    nombre: 'simi/reportes/trazabilidad/[radicadoId] GET',
    ejecutar: () => trazabilidad.GET(solicitud('GET'), radicadoContext),
  },
  { nombre: 'simi/respuestas/firma/[id]/pdf GET', ejecutar: () => firmaPdf.GET(solicitud('GET'), idContext) },
  { nombre: 'simi/respuestas/firma/[id] PATCH', ejecutar: () => firmaId.PATCH(solicitud('PATCH'), idContext) },
  { nombre: 'simi/respuestas/firma POST', ejecutar: () => firma.POST(solicitud('POST')) },
];

const HANDLERS_CON_ROL: Array<{
  nombre: string;
  rolDenegado: RolInterno;
  ejecutar: EjecutarHandler;
  permiteAuditoriaDenegacion?: boolean;
}> = [
  { nombre: 'admin/usuarios GET', rolDenegado: 'FUNCIONARIO', ejecutar: () => adminUsuarios.GET(solicitud('GET')) },
  { nombre: 'admin/usuarios POST', rolDenegado: 'FUNCIONARIO', ejecutar: () => adminUsuarios.POST(solicitud('POST')) },
  {
    nombre: 'admin/usuarios/[uid] PATCH',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => adminUsuario.PATCH(solicitud('PATCH'), uidContext),
  },
  {
    nombre: 'admin/usuarios/[uid] POST',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => adminUsuario.POST(solicitud('POST'), uidContext),
  },
  {
    nombre: 'ai/log POST',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => aiLog.POST(solicitud('POST')),
    permiteAuditoriaDenegacion: true,
  },
  {
    nombre: 'simi/control-interno GET',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => controlInterno.GET(solicitud('GET')),
  },
  {
    nombre: 'simi/juridico/aprobacion/[id] PATCH',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => aprobacion.PATCH(solicitud('PATCH'), idContext),
  },
  {
    nombre: 'simi/juridico/aprobaciones GET',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => aprobaciones.GET(solicitud('GET')),
  },
  { nombre: 'simi/metricas GET', rolDenegado: 'FUNCIONARIO', ejecutar: () => metricas.GET() },
  {
    nombre: 'simi/normograma/[id] PATCH',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => normogramaId.PATCH(solicitud('PATCH'), idContext),
  },
  {
    nombre: 'simi/normograma/[id] DELETE',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => normogramaId.DELETE(solicitud('DELETE'), idContext),
  },
  {
    nombre: 'simi/normograma POST',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => normograma.POST(solicitud('POST')),
  },
  {
    nombre: 'simi/notificaciones/whatsapp POST',
    rolDenegado: 'CONTROL_INTERNO',
    ejecutar: () => whatsapp.POST(solicitud('POST')),
  },
  {
    nombre: 'simi/plantillas POST',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => plantillas.POST(solicitud('POST')),
  },
  { nombre: 'simi/reportes GET', rolDenegado: 'FUNCIONARIO', ejecutar: () => reportes.GET(solicitud('GET')) },
  {
    nombre: 'simi/reportes/trazabilidad/[radicadoId] GET',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => trazabilidad.GET(solicitud('GET'), radicadoContext),
  },
  {
    nombre: 'simi/respuestas/firma/[id]/pdf GET',
    rolDenegado: 'RECEPCIONISTA',
    ejecutar: () => firmaPdf.GET(solicitud('GET'), idContext),
  },
  {
    nombre: 'simi/respuestas/firma/[id] PATCH',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => firmaId.PATCH(solicitud('PATCH'), idContext),
  },
  {
    nombre: 'simi/respuestas/firma POST',
    rolDenegado: 'FUNCIONARIO',
    ejecutar: () => firma.POST(solicitud('POST')),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autenticarUsuarioInterno.mockImplementation(async () => ({
    ok: false as const,
    status: 401 as const,
    mensaje: 'No autorizado.',
    respuesta: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }),
  }));
});

describe.each(HANDLERS)('$nombre — contrato de autenticacion', ({ ejecutar, permiteAuditoriaDenegacion }) => {
  it('responde 401 antes de validar payload o tocar Firebase', async () => {
    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toMatchObject({ error: expect.any(String) });
    expect(mocks.autenticarUsuarioInterno).toHaveBeenCalledOnce();
    expect(mocks.getFirebaseAdminApp).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAdminAuth).not.toHaveBeenCalled();
    if (permiteAuditoriaDenegacion) {
      expect(mocks.getFirebaseAdminDb).toHaveBeenCalledOnce();
    } else {
      expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
    }
    expect(mocks.getFirebaseAdminStorage).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAuth).not.toHaveBeenCalled();
    expect(mocks.getStorage).not.toHaveBeenCalled();
  });

  it('conserva el 500 de infraestructura sin escribir datos de dominio', async () => {
    const mensaje = 'Ocurrió un error interno. Intente de nuevo.';
    mocks.autenticarUsuarioInterno.mockResolvedValue({
      ok: false as const,
      status: 500 as const,
      mensaje,
      respuesta: NextResponse.json({ error: mensaje }, { status: 500 }),
    });

    const agregarAuditoria = vi.fn().mockResolvedValue({ id: 'auditoria-denegada' });
    const coleccion = vi.fn(() => ({ add: agregarAuditoria }));
    const documento = vi.fn();
    const lote = vi.fn();
    const transaccion = vi.fn();
    if (permiteAuditoriaDenegacion) {
      mocks.getFirebaseAdminDb.mockReturnValueOnce({
        collection: coleccion,
        doc: documento,
        batch: lote,
        runTransaction: transaccion,
      });
    }

    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(500);
    await expect(respuesta.json()).resolves.toMatchObject({ error: mensaje });
    expect(mocks.autenticarUsuarioInterno).toHaveBeenCalledOnce();
    expect(mocks.getFirebaseAdminApp).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAdminAuth).not.toHaveBeenCalled();
    if (permiteAuditoriaDenegacion) {
      expect(mocks.getFirebaseAdminDb).toHaveBeenCalledOnce();
      expect(coleccion).toHaveBeenCalledExactlyOnceWith('seguridad_ai_log_auditoria');
      expect(agregarAuditoria).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        tipo: 'AI_LOG_DENEGADO',
        motivo: 'FALLO_INFRAESTRUCTURA_AUTENTICACION',
        actorUid: null,
        radicadoId: null,
      }));
    } else {
      expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
      expect(coleccion).not.toHaveBeenCalled();
      expect(agregarAuditoria).not.toHaveBeenCalled();
    }
    expect(documento).not.toHaveBeenCalled();
    expect(lote).not.toHaveBeenCalled();
    expect(transaccion).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAdminStorage).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAuth).not.toHaveBeenCalled();
    expect(mocks.getStorage).not.toHaveBeenCalled();
  });
});

describe.each(HANDLERS_CON_ROL)('$nombre — contrato de rol', ({ rolDenegado, ejecutar, permiteAuditoriaDenegacion }) => {
  it(`responde 403 a ${rolDenegado} antes de tocar Firebase`, async () => {
    mocks.autenticarUsuarioInterno.mockResolvedValue({
      ok: true as const,
      usuario: {
        uid: 'u-sin-rol',
        email: 'usuario@simacota.gov.co',
        nombre: 'Usuario sin rol suficiente',
        rol: rolDenegado,
        tenantId: 'SEC_GOBIERNO',
        activo: true,
      },
    });

    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(403);
    expect(mocks.getFirebaseAdminApp).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAdminAuth).not.toHaveBeenCalled();
    if (permiteAuditoriaDenegacion) {
      expect(mocks.getFirebaseAdminDb).toHaveBeenCalledOnce();
    } else {
      expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
    }
    expect(mocks.getFirebaseAdminStorage).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAuth).not.toHaveBeenCalled();
    expect(mocks.getStorage).not.toHaveBeenCalled();
  });
});
