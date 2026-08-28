import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { aLicenciaPublica } from '@/lib/seguridad/consulta-publica-licencia';
import {
  aLineaTiempoPublica,
  aRadicadoPublico,
  esNumeroRadicadoValido,
  hashDatoAuditoria,
  MENSAJE_CONSULTA_NO_VERIFICADA,
  normalizarNumeroRadicado,
  verificarDatoConsulta,
} from '@/lib/seguridad/consulta-publica-radicado';
import {
  aplicarRateLimitCompartido,
  limpiarFallosCompartidos,
  rateLimitConsultaEmergencia,
  registrarAuditoriaConsulta,
  registrarFalloCompartido,
  type EventoAuditoriaConsulta,
} from '@/lib/seguridad/rate-limit-consulta-publica';
import { getClientIp } from '@/lib/ai/rate-limit';
import type { RespuestaFirma } from '@/src/types/simi-firma';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

function jsonNoCache(body: unknown, status = 200, headers: HeadersInit = {}): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_CACHE_HEADERS, ...headers },
  });
}

function denegado(): NextResponse {
  return jsonNoCache({ ok: false, error: MENSAJE_CONSULTA_NO_VERIFICADA }, 404);
}

function hashSecret(): string {
  return process.env.CONSULTA_HASH_SECRET
    ?? process.env.FIREBASE_SERVICE_ACCOUNT
    ?? 'consulta-publica-simacota-runtime';
}

async function auditarSinBloquear(params: {
  evento: EventoAuditoriaConsulta;
  motivo: string;
  ipHash: string;
  radicadoHash: string;
  userAgentHash?: string;
}): Promise<void> {
  try {
    await registrarAuditoriaConsulta({ db: getFirebaseAdminDb(), ...params });
  } catch {
    // La auditoría agregada no debe revelar datos ni convertir un rechazo en 500.
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 4_096) return denegado();

  const body = await request.json().catch(() => null) as {
    numeroRadicado?: unknown;
    datoVerificacion?: unknown;
    tokenConsulta?: unknown;
  } | null;
  const numeroRadicado = normalizarNumeroRadicado(body?.numeroRadicado);
  const datoVerificacion = typeof body?.tokenConsulta === 'string'
    ? body.tokenConsulta.trim()
    : typeof body?.datoVerificacion === 'string'
      ? body.datoVerificacion.trim()
      : '';

  const secret = hashSecret();
  const ipHash = hashDatoAuditoria(getClientIp(request), secret);
  const radicadoHash = hashDatoAuditoria(numeroRadicado || 'FORMATO_INVALIDO', secret);
  const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? '';
  const userAgentHash = userAgent ? hashDatoAuditoria(userAgent, secret) : undefined;
  let db: FirebaseFirestore.Firestore;
  try {
    db = getFirebaseAdminDb();
  } catch {
    return jsonNoCache(
      { ok: false, error: 'No fue posible realizar la consulta. Intente nuevamente más tarde.' },
      500,
    );
  }

  let limite;
  try {
    limite = await aplicarRateLimitCompartido({ db, ipHash, radicadoHash });
  } catch {
    limite = rateLimitConsultaEmergencia.verificar(ipHash, radicadoHash);
  }

  if (limite.bloqueado) {
    await auditarSinBloquear({
      evento: 'CONSULTA_PUBLICA_BLOQUEADA',
      motivo: limite.alcance ?? 'LIMITE',
      ipHash,
      radicadoHash,
      userAgentHash,
    });
    return jsonNoCache(
      { ok: false, error: 'Ha realizado varios intentos. Espere un momento antes de volver a consultar.' },
      429,
      { 'Retry-After': String(limite.retryAfterSeconds ?? 60) },
    );
  }

  if (!esNumeroRadicadoValido(numeroRadicado) || !datoVerificacion || datoVerificacion.length > 320) {
    await auditarSinBloquear({
      evento: 'CONSULTA_PUBLICA_DENEGADA',
      motivo: 'DATOS_INVALIDOS',
      ipHash,
      radicadoHash,
      userAgentHash,
    });
    return denegado();
  }

  // Los radicados legacy no tienen un segundo factor confiable normalizado.
  if (numeroRadicado.startsWith('EXT-')) {
    await auditarSinBloquear({
      evento: 'CONSULTA_PUBLICA_SIN_METODO_VERIFICACION',
      motivo: 'LEGACY_SIN_METODO',
      ipHash,
      radicadoHash,
      userAgentHash,
    });
    return denegado();
  }

  try {
    const snap = await db.doc(`ventanilla_radicados/${numeroRadicado}`).get();
    if (!snap.exists) {
      await registrarFalloSeguro(db, radicadoHash);
      await auditarSinBloquear({
        evento: 'CONSULTA_PUBLICA_DENEGADA',
        motivo: 'NO_ENCONTRADO',
        ipHash,
        radicadoHash,
        userAgentHash,
      });
      return denegado();
    }

    const radicado = snap.data() as VentanillaRadicado;
    const verificacion = verificarDatoConsulta(radicado, datoVerificacion);
    if (!verificacion.autorizado) {
      await registrarFalloSeguro(db, radicadoHash);
      await auditarSinBloquear({
        evento: verificacion.motivo === 'SIN_METODO_VERIFICACION'
          ? 'CONSULTA_PUBLICA_SIN_METODO_VERIFICACION'
          : 'CONSULTA_PUBLICA_DENEGADA',
        motivo: verificacion.motivo,
        ipHash,
        radicadoHash,
        userAgentHash,
      });
      return denegado();
    }

    const [trazabilidadSnap, firmaSnap] = await Promise.all([
      db.collection(`ventanilla_radicados/${numeroRadicado}/trazabilidad`)
        .orderBy('fecha', 'asc')
        .limit(25)
        .get(),
      db.collection('simi_respuestas_firma')
        .where('radicadoId', '==', numeroRadicado)
        .where('estado', 'in', ['enviado_ciudadano', 'notificado', 'cerrado'])
        .limit(1)
        .get(),
    ]);
    const trazabilidad = trazabilidadSnap.docs.map((doc) => doc.data() as TrazabilidadRadicado);
    const firma = firmaSnap.empty ? null : firmaSnap.docs[0].data() as RespuestaFirma;
    const respuesta = aRadicadoPublico({
      radicado,
      lineaTiempo: aLineaTiempoPublica(trazabilidad),
      fechaRespuestaSimi: firma?.fechaEnvio,
      canalRespuestaSimi: firma?.canalEnvio,
    });

    await Promise.allSettled([
      limpiarFallosCompartidos(db, radicadoHash),
      auditarSinBloquear({
        evento: 'CONSULTA_PUBLICA_AUTORIZADA',
        motivo: verificacion.metodo,
        ipHash,
        radicadoHash,
        userAgentHash,
      }),
    ]);
    /* ── LA LICENCIA, SI LA HAY ────────────────────────────────────────
       El ADR-0034 §7 dejó abierta la consulta ciudadana de licencias por dos
       reparos: faltaba vocabulario ciudadano y un segundo factor propio. El
       segundo desapareció solo — desde #252 el número del expediente ES el del
       libro de ventanilla, así que el ciudadano consulta con el número que ya
       tiene, por esta misma ruta, con el mismo segundo factor y el mismo límite
       de tasa. No se abre superficie nueva: se añade un bloque.

       Se lee DESPUÉS de verificar. Un fallo aquí no puede tumbar la consulta
       del radicado, que es lo que el ciudadano vino a ver: si el expediente no
       se puede leer, el bloque sale ausente, no roto. */
    let licencia = null;
    const expedienteId = radicado.vinculoExpediente?.expedienteId;
    if (expedienteId) {
      try {
        const expSnap = await db.doc(`expedientes/${expedienteId}`).get();
        if (expSnap.exists) {
          const exp = expSnap.data() as {
            numeroExpediente?: { numero?: string } | null;
            estadoJuridico?: EstadoJuridicoLicencia;
            fechaRadicacionDebidaForma?: string | null;
          };
          /* Solo los TRES campos que el bloque necesita. Pasar el expediente
             entero dejaría la puerta abierta a que un campo nuevo se cuele en
             una respuesta PÚBLICA por olvido. */
          if (exp.estadoJuridico) {
            licencia = aLicenciaPublica({
              numeroExpediente: exp.numeroExpediente?.numero ?? null,
              estadoJuridico: exp.estadoJuridico,
              fechaRadicacionDebidaForma: exp.fechaRadicacionDebidaForma ?? null,
            });
          }
        }
      } catch {
        licencia = null;
      }
    }

    rateLimitConsultaEmergencia.limpiarFallos(radicadoHash);
    return jsonNoCache({ ok: true, radicado: respuesta, licencia });
  } catch {
    return jsonNoCache(
      { ok: false, error: 'No fue posible realizar la consulta. Intente nuevamente más tarde.' },
      500,
    );
  }
}

async function registrarFalloSeguro(
  db: FirebaseFirestore.Firestore,
  radicadoHash: string,
): Promise<void> {
  try {
    await registrarFalloCompartido({ db, radicadoHash });
  } catch {
    rateLimitConsultaEmergencia.registrarFallo(radicadoHash);
  }
}

export async function GET(): Promise<NextResponse> {
  return jsonNoCache(
    { ok: false, error: 'Utilice el formulario seguro de consulta.' },
    405,
    { Allow: 'POST' },
  );
}
