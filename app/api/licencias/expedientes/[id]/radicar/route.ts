/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/{id}/radicar

   EL ACTO DE RADICAR — PRESENTADA → RADICADA_EN_DEBIDA_FORMA.

   Es el momento en que la Alcaldía AFIRMA que la solicitud llegó completa:
   nace el número oficial de la serie legal y arranca el término de 45 días
   hábiles (D.1077/2015 art. 2.2.6.1.2.1.1 par. 1). ADR-0033: el número y el
   término nacen en ESTA transición, no al abrir el expediente.

   TODO O NADA. Una sola `runTransaction`: revalidar, derivar el ancla,
   emitir el consecutivo, escribir la actuación y parchear el expediente. Si
   algo falla, no queda ni el número consumido ni el estado movido.

   ORDEN QUE NO SE PUEDE ALTERAR. Firestore exige todas las lecturas antes de
   todas las escrituras, y aquí eso además tiene consecuencia legal: la
   emisión del consecutivo es la ÚLTIMA lectura y su confirmación la PRIMERA
   escritura. Así, un rechazo nunca llega siquiera a mirar el contador — y un
   intento fallido no puede dejar un hueco en la serie.

   IDEMPOTENCIA POR EL DOMINIO. No hay clave de idempotencia inventada: el
   propio `estadoJuridico`, leído bajo el bloqueo pesimista de `tx.get`, es el
   candado; la reserva `unicidad_expedientes/{numero}` es el segundo; y el id
   determinista de la actuación (`{expedienteId}-radicacion`, escrito con
   `tx.create`) es el tercero. Un reintento devuelve 200 con lo ya escrito.

   NADA SE CAPTURA FUERA DEL CALLBACK. El SDK REUTILIZA el mismo objeto
   `Transaction` entre reintentos, así que una variable de ámbito exterior con
   un `if (!emitido)` escribiría el contador con un valor leído en un intento
   ABORTADO. Todo lo derivado sale como VALOR DE RETORNO de `runTransaction`.
══════════════════════════════════════════════════════════════ */
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { canOperateTenant, InternalAuthError, requireActiveInternalUser } from '@/lib/server/internal-auth';
import { appendTrazabilidadAdmin } from '@/lib/server/radicados-security';
import { atLocalNoon } from '@/lib/tiempos-radicado';
import { codigosNumeroExpediente } from '@/src/types/reglas-negocio';
import { emitirNumeroExpedienteReal } from '@/lib/server/emitir-numero-expediente';
import { SerieNoAbiertaError } from '@/lib/server/consecutivo-legal';
import {
  evaluarCandadoEmisionReal,
  evaluarRadicacionEnDebidaForma,
  planRadicarEnDebidaForma,
  esErrorExpediente,
  esRadicacionYaOcurrida,
  idActuacionRadicacion,
  type ActuacionLicenciaDoc,
  type DocumentoParaAncla,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';
import type { TenantId } from '@/src/types/radicado';

export const runtime = 'nodejs';

const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

interface BodyRadicar {
  confirmo?: boolean;
  /**
   * Día civil (`YYYY-MM-DD`) que la pantalla le mostró a la funcionaria como
   * inicio del término. Control optimista LEGIBLE POR UN AUDITOR: si entre lo
   * que vio y el commit alguien tocó la evidencia, el acto se rechaza en vez
   * de afirmar una fecha que ella no vio.
   *
   * NO existe —ni existirá— un campo de fecha libre: sería la puerta trasera
   * exacta al «clic de verificación» que el ADR-0033 §4.3 prohíbe.
   */
  anclaEsperada?: string;
  observacion?: string;
}

type ResultadoTx =
  | { error: { status: number; mensaje: string } }
  | { yaEstaba: true; numeroExpediente: string | null; anclaIso: string }
  | {
      radicoAhora: true;
      numeroExpediente: string;
      consecutivo: number;
      anclaIso: string;
      anclaDiaCivil: string;
      baseDelAncla: string;
      fechaAlertaConservadora: string | null;
      requisitosAplicables: number;
      radicadoId: string | null;
    };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const inicio = Date.now();

  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite operar expedientes de licencias.' }, { status: 403 });
    }

    /* CANDADO R10, ANTES de abrir la transacción. Con él cerrado no existe
       ninguna rama de código que alcance `counters/` ni `unicidad_expedientes`.
       Fallar aquí es lo que hace que eso sea comprobable, no una promesa. */
    const candado = evaluarCandadoEmisionReal();
    if (esErrorExpediente(candado)) {
      return NextResponse.json({ error: candado.mensaje }, { status: candado.status });
    }

    const body = (await req.json().catch(() => null)) as BodyRadicar | null;
    if (body?.confirmo !== true) {
      return NextResponse.json(
        { error: 'Debe confirmar expresamente la radicación en legal y debida forma.' },
        { status: 400 },
      );
    }
    const anclaEsperada = typeof body.anclaEsperada === 'string' ? body.anclaEsperada.trim() : undefined;
    const observacion = typeof body.observacion === 'string' ? body.observacion.trim() || undefined : undefined;

    /* Códigos del número legal, FAIL-CLOSED y fuera de la transacción: un
       número con código DANE inventado es un defecto de identidad legal que no
       se repara. Si falta configuración, la excepción ya dice cuál. */
    const codigos = codigosNumeroExpediente(TENANT_LICENCIAS);

    /* La fecha de emisión se fija UNA VEZ y FUERA del callback, al mediodía
       local: el contador se indexa por año civil de Bogotá, y un reintento
       debe usar el mismo año y el mismo `AA` que el primer intento. */
    const fechaEmision = atLocalNoon(new Date());
    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const actor = { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol };

    const resultado: ResultadoTx = await db.runTransaction(async (tx) => {
      // ── LECTURA 1 · el expediente. Bloqueo pesimista: dos funcionarias que
      //    pulsen a la vez se serializan aquí.
      const expSnap = await tx.get(expedienteRef);
      if (!expSnap.exists) return { error: { status: 404, mensaje: 'Expediente no encontrado.' } };
      const exp = expSnap.data() as ExpedienteLicenciaDoc;

      // ── LECTURA 2 · la serie completa de actuaciones. El espejo del término
      //    se recalcula sobre existentes + la nueva; leerlas fuera lo dejaría
      //    calculado sobre una foto vieja.
      const actuacionesSnap = await tx.get(expedienteRef.collection('actuaciones'));
      const actuacionesPrevias = actuacionesSnap.docs.map((d) => d.data() as ActuacionLicenciaDoc);

      // ── LECTURA 3 · los documentos que respaldan los requisitos aportados.
      //    De aquí sale el ancla cuando el expediente es anterior a
      //    `completoDesde`. Sin `limit`: truncar una lectura de la que depende
      //    la fecha del término daría un ancla equivocada en silencio.
      const idsDocumentos = (exp.aportes ?? [])
        .filter((a) => a.estado === 'APORTADO')
        .flatMap((a) => a.documentoIds ?? []);
      const documentos: DocumentoParaAncla[] = await Promise.all(
        idsDocumentos.map(async (docId) => {
          const snap = await tx.get(expedienteRef.collection('documentos').doc(docId));
          const d = snap.data() as DocumentoParaAncla | undefined;
          return { id: docId, creadoEn: d?.creadoEn ?? '', requisitoId: d?.requisitoId, versionVigente: d?.versionVigente };
        }),
      );
      const documentosLeidos = documentos.filter((d) => d.creadoEn);

      // ── LECTURA 4 · el radicado vinculado, si lo hay. El vínculo escrito al
      //    crear apunta al número DEMO; corregirlo en OTRA transacción dejaría
      //    a ventanilla afirmando para siempre un número que no es el legal.
      const radicadoRef = exp.radicadoId ? db.doc(`ventanilla_radicados/${exp.radicadoId}`) : null;
      if (radicadoRef) {
        const radSnap = await tx.get(radicadoRef);
        if (!radSnap.exists) {
          return {
            error: {
              status: 409,
              mensaje: `El expediente dice estar vinculado al radicado ${exp.radicadoId}, que no existe. No se radica sobre un vínculo roto: corrija el vínculo antes.`,
            },
          };
        }
      }

      // ── GUARDS PUROS. Cómputo sobre lo ya leído; ninguna escritura todavía.
      const evaluacion = evaluarRadicacionEnDebidaForma({
        expediente: exp,
        actuacionesPrevias,
        documentos: documentosLeidos,
        anclaEsperada,
        tenantEsperado: TENANT_LICENCIAS,
        ahora: fechaEmision,
      });
      if (esErrorExpediente(evaluacion)) return { error: { status: evaluacion.status, mensaje: evaluacion.mensaje } };
      if (esRadicacionYaOcurrida(evaluacion)) {
        return { yaEstaba: true, numeroExpediente: evaluacion.numeroExpediente, anclaIso: evaluacion.anclaIso };
      }

      // ── ÚLTIMA LECTURA + PRIMERA ESCRITURA, juntas y al final.
      let emitido;
      try {
        emitido = await emitirNumeroExpedienteReal({
          tx, db, fecha: fechaEmision, tenantId: TENANT_LICENCIAS, codigos, expedienteId: id,
        });
      } catch (err) {
        // Sin esto, «la serie no está abierta» saldría como un 500 genérico en
        // vez del mensaje que dice exactamente qué hay que sembrar.
        if (err instanceof SerieNoAbiertaError) return { error: { status: 409, mensaje: err.message } };
        throw err;
      }

      const plan = planRadicarEnDebidaForma({
        expedienteId: id,
        tenantId: exp.tenantId,
        evaluacion,
        numeroEmitido: emitido.numeroExpediente,
        anioSerie: fechaEmision.getFullYear(),
        actuacionesPrevias,
        actor,
        ahora: fechaEmision,
        observacion,
      });

      /* `tx.create` sobre id determinista: falla si ya existe, sin lectura
         extra. `selloServidor` es la hora del ACTO, que la pone la base de
         datos; la fecha JURÍDICA es el ancla y viaja en `fecha`. Dos relojes
         con papeles distintos en la misma escritura. */
      tx.create(expedienteRef.collection('actuaciones').doc(plan.actuacionId), {
        ...plan.actuacion,
        selloServidor: FieldValue.serverTimestamp(),
      });
      tx.update(expedienteRef, plan.parcheExpediente);

      if (radicadoRef) {
        tx.update(radicadoRef, {
          vinculoExpediente: {
            expedienteId: id,
            numeroExpediente: emitido.numeroExpediente,
            fecha: evaluacion.anclaIso,
          },
          ultimaActualizacion: fechaEmision.toISOString(),
        });
      }

      return {
        radicoAhora: true,
        numeroExpediente: emitido.numeroExpediente,
        consecutivo: emitido.consecutivo,
        anclaIso: evaluacion.anclaIso,
        anclaDiaCivil: evaluacion.anclaDiaCivil,
        baseDelAncla: evaluacion.baseDelAncla,
        fechaAlertaConservadora: plan.parcheExpediente.fechaAlertaConservadora,
        requisitosAplicables: evaluacion.completitud.aplicables,
        radicadoId: exp.radicadoId ?? null,
      };
    });

    if ('error' in resultado) {
      return NextResponse.json({ error: resultado.error.mensaje }, { status: resultado.error.status });
    }

    /* REPLAY. Un reintento tras una desconexión no cometió ninguna falta: se
       devuelve lo escrito, no un 409 que haría pensar en dos radicaciones. Y
       NO se ejecuta nada post-commit — el aviso al ciudadano se condiciona a
       `radicoAhora`, nunca a «ya estaba», o un doble clic le certificaría dos
       veces lo mismo. */
    if ('yaEstaba' in resultado) {
      return NextResponse.json({
        ok: true,
        yaEstaba: true,
        numeroExpediente: resultado.numeroExpediente,
        desdeCuandoCorreElPlazo: resultado.anclaIso,
        mensaje: 'Este expediente ya estaba radicado en legal y debida forma. No se emitió un número nuevo.',
      });
    }

    // ── POST-COMMIT, best-effort. Nunca dentro del callback: una transacción
    //    puede reejecutarse, y la trazabilidad del radicado no es transaccional
    //    con la del expediente.
    if (resultado.radicadoId) {
      await appendTrazabilidadAdmin(resultado.radicadoId, {
        fecha: fechaEmision.toISOString(),
        accion: 'EXPEDIENTE_LICENCIA_VINCULADO',
        actorUid: usuario.uid,
        actorNombre: usuario.nombre,
        nota: `Expediente ${resultado.numeroExpediente} radicado en legal y debida forma. El término corre desde ${resultado.anclaDiaCivil}.`,
        metadata: { expedienteId: id, numeroExpediente: resultado.numeroExpediente },
      }).catch((err) => logError({ radicadoId: resultado.radicadoId!, modulo: 'licencias/radicar/trazabilidad', error: err }));
    }

    registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'ok',
      latenciaMs: Date.now() - inicio,
      radicadoId: resultado.radicadoId,
      actorRol: usuario.rol,
      tenant: TENANT_LICENCIAS,
    });

    /* La respuesta lleva los hechos que la constancia necesita — incluido
       DESDE CUÁNDO corre el plazo y de dónde salió esa fecha. Que se pueda
       verificar el acto sin abrir una consola de Firestore es parte del acto. */
    return NextResponse.json({
      ok: true,
      radicoAhora: true,
      numeroExpediente: resultado.numeroExpediente,
      consecutivo: resultado.consecutivo,
      desdeCuandoCorreElPlazo: resultado.anclaIso,
      diaCivilDelAncla: resultado.anclaDiaCivil,
      baseDelAncla: resultado.baseDelAncla,
      venceAproximadamente: resultado.fechaAlertaConservadora,
      requisitosVerificados: resultado.requisitosAplicables,
      radicadoVentanilla: resultado.radicadoId,
    });
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: id, modulo: 'licencias/radicar', error });
    return NextResponse.json(
      { error: 'No fue posible declarar la radicación en legal y debida forma.' },
      { status: 500 },
    );
  }
}
