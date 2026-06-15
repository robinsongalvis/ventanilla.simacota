/**
 * GET /api/public/radicado/consulta?radicado=...&verificacion=...
 *
 * Endpoint público seguro para que el ciudadano consulte el estado de su radicado.
 * No expone información interna, análisis jurídico ni datos sensibles.
 *
 * verificacion: los últimos 4 dígitos del número de documento registrado.
 */

import { NextResponse }          from 'next/server';
import { getFirebaseAdminDb }    from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { NOMBRES_TENANT }        from '@/src/types/reglas-negocio';
import { buildRespuestaPublicaCiudadano } from '@/lib/server/respuesta-publica';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { EstadoCiudadano, RadicadoPublico, ConsultaCiudadanaLog } from '@/src/types/simi-citizen';
import type { RespuestaFirma }   from '@/src/types/simi-firma';

export const runtime = 'nodejs';

/** Mapear estado interno a estado ciudadano */
function mapEstadoCiudadano(
  estadoActual: string,
  fueRespondido: boolean,
): EstadoCiudadano {
  if (fueRespondido || ['RESUELTO', 'RECHAZADO'].includes(estadoActual)) return 'respondido';
  switch (estadoActual) {
    case 'PENDIENTE':    return 'radicado_recibido';
    case 'EN_REVISION':  return 'en_revision';
    case 'ASIGNADO':     return 'asignado_dependencia';
    case 'EN_PROCESO':   return 'en_proyeccion_respuesta';
    case 'DEVUELTO':     return 'requiere_aclaracion';
    case 'PRORROGA':     return 'en_proyeccion_respuesta';
    default:             return 'en_revision';
  }
}

/** Hash simple de IP para auditoría (sin exponer la IP real) */
function hashIp(ip: string): string {
  let hash = 0;
  for (const c of ip) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return Math.abs(hash).toString(36).toUpperCase();
}

export async function GET(request: Request): Promise<NextResponse> {
  /* Rate-limit: 10 consultas/min por IP */
  const ip  = getClientIp(request);
  const lim = { maxRequests: 10, windowMs: 60_000 };
  const bl  = checkRateLimit(`public:consulta:${ip}`, lim);
  if (bl) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Espera un momento e intenta de nuevo.' },
      { status: 429, headers: rateLimitHeaders(lim.maxRequests, bl.retryAfterSeconds) },
    );
  }

  const url          = new URL(request.url);
  const radicadoNum  = (url.searchParams.get('radicado') ?? '').trim().toUpperCase();
  const verificacion = (url.searchParams.get('verificacion') ?? '').trim().replace(/\D/g, '');

  if (!radicadoNum || radicadoNum.length < 5) {
    return NextResponse.json({ error: 'Número de radicado inválido.' }, { status: 400 });
  }

  const db  = getFirebaseAdminDb();
  const log: Omit<ConsultaCiudadanaLog, 'id'> = {
    radicadoId:    radicadoNum,
    tenantId:      'public',
    fechaConsulta: new Date().toISOString(),
    ipHash:        hashIp(ip),
    userAgent:     request.headers.get('user-agent')?.slice(0, 150) ?? '',
    resultado:     'no_encontrado',
  };

  try {
    /* Buscar el radicado */
    const snap = await db.collection('ventanilla_radicados')
      .where('radicadoId', '==', radicadoNum)
      .limit(1)
      .get();

    if (snap.empty) {
      await db.collection('consultas_ciudadanas_radicado').add(log);
      return NextResponse.json(
        { error: 'Radicado no encontrado. Verifica el número e intenta de nuevo.' },
        { status: 404 },
      );
    }

    const radicado = snap.docs[0].data() as VentanillaRadicado;

    /* Verificación de identidad: últimos 4 dígitos del documento */
    if (verificacion && !radicado.esAnonimo) {
      const docNumero = radicado.solicitante.numeroDocumento.replace(/\D/g, '');
      const ultimos4  = docNumero.slice(-4);
      if (verificacion !== ultimos4) {
        log.resultado = 'verificacion_fallida';
        await db.collection('consultas_ciudadanas_radicado').add(log);
        return NextResponse.json(
          { error: 'Los datos de verificación no coinciden con el radicado.' },
          { status: 403 },
        );
      }
    }

    /* ¿Fue respondido oficialmente? */
    const firmaSnap = await db.collection('simi_respuestas_firma')
      .where('radicadoId', '==', radicadoNum)
      .where('estado', 'in', ['enviado_ciudadano', 'notificado', 'cerrado'])
      .limit(1)
      .get();

    const fueRespondidoSimi = !firmaSnap.empty;
    const firmaData         = fueRespondidoSimi ? firmaSnap.docs[0].data() as RespuestaFirma : null;

    /* Respuesta oficial pública desde el flujo Ventanilla Única (sanitizada) */
    const dependenciaNombre   = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? 'Alcaldía de Simacota';
    const respuestaPublica    = buildRespuestaPublicaCiudadano(radicado, dependenciaNombre);

    /* Estado "respondido" se activa si SIMI envió oficialmente O si Ventanilla
       Única tiene respuesta sanitizada disponible. */
    const fueRespondido = fueRespondidoSimi || respuestaPublica !== null;

    /* Construir respuesta pública — sin datos internos */
    const respuesta: RadicadoPublico = {
      radicadoId:         radicado.radicadoId,
      fechaRadicacion:    radicado.control.fechaRadicado,
      estadoCiudadano:    mapEstadoCiudadano(radicado.estadoActual, fueRespondido),
      dependencia:        dependenciaNombre,
      tipoSolicitud:      radicado.termino.tipoSolicitudNombre,
      fechaVencimiento:   radicado.termino.fechaVencimiento,
      requiereAclaracion: radicado.estadoActual === 'DEVUELTO',
      fueRespondido,
      fechaRespuesta:     firmaData?.fechaEnvio ?? respuestaPublica?.fecha ?? undefined,
      canalRespuesta:     firmaData?.canalEnvio ?? undefined,
      respuestaDisponible: fueRespondido,
      ...(respuestaPublica ? { respuestaOficial: respuestaPublica } : {}),
    };

    /* Auditoría exitosa */
    log.resultado = 'encontrado';
    log.tenantId  = radicado.clasificacion.oficinaDestino;
    await db.collection('consultas_ciudadanas_radicado').add(log);

    return NextResponse.json({ ok: true, radicado: respuesta });

  } catch (err) {
    console.error('[public/radicado/consulta]', err);
    return NextResponse.json({ error: 'Error al consultar. Intenta más tarde.' }, { status: 500 });
  }
}
