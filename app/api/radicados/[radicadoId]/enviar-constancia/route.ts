import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildConstanciaRadicacionHtml,
  buildConstanciaRadicacionSubject,
} from '@/lib/email/templates/constancia-radicacion';
import { logError } from '@/lib/logger';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 2 —
   POST /api/radicados/{radicadoId}/enviar-constancia

   Envío manual desde la constancia impresa en pantalla. Solo
   funcionarios internos autenticados con rol operativo lo pueden
   disparar. Registra evento CONSTANCIA_ENVIADA_CORREO en la
   trazabilidad del radicado.

   No genera PDF. No modifica el archivo original del solicitante.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

const ROLES_AUTORIZADOS = new Set(['ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA']);

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'No fue posible enviar la constancia.' },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
      return NextResponse.json(
        { error: 'Rol sin permisos para enviar la constancia.' },
        { status: 403 },
      );
    }

    const { radicadoId } = await context.params;
    const radicado = await getRadicadoOrFail(radicadoId);

    // Validar que el solicitante aportó correo y NO marcó `noAportaCorreo`.
    const email = radicado.solicitante?.email?.trim() ?? null;
    const noAportaCorreo = radicado.solicitante?.datosNoAportados?.correo === true;
    if (!email || noAportaCorreo) {
      return NextResponse.json(
        { error: 'El solicitante no aportó correo electrónico. No se puede enviar la constancia.' },
        { status: 400 },
      );
    }

    const dependenciaNombre =
      NOMBRES_TENANT[radicado.clasificacion?.oficinaDestino] ?? 'Ventanilla Única';

    const html = buildConstanciaRadicacionHtml({
      radicadoId,
      solicitanteNombre: radicado.solicitante.nombreCompleto,
      tipoDocumento:     radicado.solicitante.tipoDocumento,
      numeroDocumento:   radicado.solicitante.numeroDocumento,
      correoSolicitante: email,
      telefonoSolicitante:
        radicado.solicitante.datosNoAportados?.telefono === true
          ? null
          : (radicado.solicitante.telefonoMovil ?? radicado.solicitante.telefono ?? null),
      asunto:            radicado.detalle?.asunto ?? '',
      tipoTramite:       radicado.termino?.tipoSolicitudNombre ?? '',
      fechaRadicado:     radicado.control?.fechaRadicado ?? new Date().toISOString(),
      fechaVencimiento:  radicado.termino?.fechaVencimiento ?? '',
      medioRecepcion:    radicado.control?.medioRecepcion ?? '',
      canalRespuesta:    radicado.canalRespuesta ?? null,
      dependenciaNombre,
      funcionarioNombre: usuario.nombre,
      numeroFolios:      radicado.detalle?.numeroFolios,
    });

    const subject = buildConstanciaRadicacionSubject(radicadoId);

    try {
      await enviarEmail({ to: email, subject, html });
    } catch (err) {
      logError({
        radicadoId,
        modulo: 'constancia/envio-fallido',
        error:  err,
      });
      // Registrar el intento fallido en trazabilidad para auditoría.
      try {
        await appendTrazabilidadAdmin(radicadoId, {
          fecha:       new Date().toISOString(),
          accion:      'NOTIFICACION_CORREO_FALLIDA',
          actorUid:    usuario.uid,
          actorNombre: usuario.nombre,
          nota:        `Fallo al enviar constancia por correo a ${email}.`,
          metadata: {
            tipoNotificacion: 'CONSTANCIA',
            destinatario:     email,
            error:            err instanceof Error ? err.message : String(err),
          },
        });
      } catch {
        // Trazabilidad nunca debe interrumpir el flujo principal.
      }
      return NextResponse.json(
        { error: 'No fue posible enviar la constancia. Intente nuevamente en unos minutos.' },
        { status: 502 },
      );
    }

    // Evento de éxito.
    try {
      await appendTrazabilidadAdmin(radicadoId, {
        fecha:       new Date().toISOString(),
        accion:      'CONSTANCIA_ENVIADA_CORREO',
        actorUid:    usuario.uid,
        actorNombre: usuario.nombre,
        nota:        `Constancia enviada por correo a ${email}.`,
        metadata: {
          destinatario:     email,
          tipoNotificacion: 'CONSTANCIA',
        },
      });
    } catch {
      // Trazabilidad nunca debe interrumpir el flujo principal.
    }

    return NextResponse.json({ ok: true, destinatario: email });
  } catch (error) {
    return jsonError(error);
  }
}
