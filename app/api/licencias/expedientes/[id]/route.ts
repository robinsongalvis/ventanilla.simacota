/* ══════════════════════════════════════════════════════════════
   GET /api/licencias/expedientes/[id]  — detalle: expediente + actuaciones
   + documentos + definicionId + computos

   Bloque "Integración UI y demo" / Bloque A·A2. Dos `orderBy` de un solo
   campo sobre subcolecciones de UN padre — orden natural, sin índice
   compuesto (ningún `where` combinado con el `orderBy`).

   `documentos`: lista de documentos LÓGICOS con su `versionVigente` (1
   query a `documentos`, NUNCA se toca `versiones` — INV-5 del contrato A1,
   `lib/server/expedientes-documentos-tipos.ts`).

   NO calcula completitud aquí: `evaluarCompletitud` es pura
   (`lib/motor-expedientes/completitud.ts`) y la ejecuta la UI con
   `documentos`/`aportes`/`contexto` + la Definición.

   `computos` (Bloque "Términos y vigencias protectores", 10-ago-2026):
   `{ terminoDual, vigencia?, plazoSubsanacion }`, TODO calculado EN
   MEMORIA sobre `actuaciones`/`expediente` YA LEÍDOS arriba — CERO
   lecturas nuevas a Firestore (R11). `borradorActoDesistimiento` viaja
   junto (no dentro de `computos`: es un documento generado, no un
   cómputo) — `null` salvo que `plazoSubsanacion.resultado === 'POR_ARCHIVAR'`.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import { SUBCOLECCION_DOCUMENTOS } from '@/lib/server/expedientes-documentos-tipos';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import {
  evaluarPlazoSubsanacion,
  evaluarRadicacionEnDebidaForma,
  esErrorExpediente,
  esRadicacionYaOcurrida,
  generarBorradorActoDesistimiento,
  PLAZO_DECISION_LICENCIA_DIAS_HABILES,
  type ExpedienteLicenciaDoc,
  type ActuacionLicenciaDoc,
  type DocumentoParaAncla,
} from '@/lib/server/expedientes-licencias';
import { atLocalNoon, sumarDiasHabiles, diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { calcularVencimientoDual, derivarEventosTermino } from '@/lib/motor-expedientes/termino';
import { calcularVencimientoVigencia, esErrorVigencia } from '@/lib/motor-expedientes/vigencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible consultar el expediente.' }, { status: 500 });
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { id } = await context.params;

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const doc = await expedienteRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = doc.data() as Record<string, unknown>;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite consultar este expediente.' }, { status: 403 });
    }

    const actuacionesSnap = await expedienteRef.collection('actuaciones').orderBy('fecha', 'asc').get();
    const actuaciones = actuacionesSnap.docs.map((d) => d.data());

    const documentosSnap = await expedienteRef.collection(SUBCOLECCION_DOCUMENTOS).get();
    const documentos = documentosSnap.docs.map((d) => d.data());

    // Bloque A·A4 (D2): proyección mínima del radicado de origen, si el
    // expediente nació por handoff (`radicadoId` poblado). Solo id + fecha
    // del vínculo — no se trae el radicado completo (N+1 evitado a
    // propósito: la UI que necesite más detalle del radicado lo pide por
    // su propia ruta).
    let radicadoVinculado: { id: string; fecha: string } | null = null;
    const radicadoId = (expediente as { radicadoId?: string | null }).radicadoId;
    if (radicadoId) {
      const radicadoSnap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
      const vinculo = radicadoSnap.exists
        ? (radicadoSnap.data() as { vinculoExpediente?: { fecha: string } | null })?.vinculoExpediente
        : null;
      if (vinculo) {
        radicadoVinculado = { id: radicadoId, fecha: vinculo.fecha };
      }
    }

    // ── computos (Bloque "Términos y vigencias protectores") — TODO en
    // memoria sobre `actuaciones`/`expediente` ya leídos arriba, CERO
    // lecturas nuevas a Firestore (R11).
    const actuacionesLicencia = actuaciones as unknown as ActuacionLicenciaDoc[];
    const expedienteLicencia = expediente as unknown as ExpedienteLicenciaDoc;

    const eventos = derivarEventosTermino(actuacionesLicencia);
    const terminoDual = calcularVencimientoDual(eventos, PLAZO_DECISION_LICENCIA_DIAS_HABILES);

    const plazoSubsanacion = evaluarPlazoSubsanacion(actuacionesLicencia, new Date());
    const borradorActoDesistimiento = generarBorradorActoDesistimiento(expedienteLicencia, plazoSubsanacion);

    // `vigencia` es OMITIDA (no un error HTTP) si el expediente aún no
    // tiene `actoFinal.fechaFirmeza` (no está cerrado) o si
    // `calcularVencimientoVigencia` no puede resolver la regla (p. ej.
    // CONSTRUCCION sin `modalidadConstruccion` — dato que HOY ningún
    // expediente captura, ver JSDoc de `seleccionarReglaVigencia`): en
    // ambos casos es un hueco honesto, no un fallo del cómputo.
    let vigencia: ReturnType<typeof calcularVencimientoVigencia> | undefined;
    const fechaFirmeza = expedienteLicencia.actoFinal?.fechaFirmeza;
    if (fechaFirmeza) {
      const resultado = calcularVencimientoVigencia({
        fechaFirmeza,
        subtipos: expedienteLicencia.subtipos ?? [],
      });
      if (!esErrorVigencia(resultado)) {
        vigencia = resultado;
      }
    }

    /* ── VISTA PREVIA DEL ACTO DE RADICAR ────────────────────────────────
       Lo que la funcionaria tiene que ver ANTES de pulsar el acto que emite
       identidad legal y arranca un plazo de 45 días hábiles:

         · si procede, y si no, POR QUÉ — con la lista de lo que falta;
         · QUÉ DÍA quedará anclado el término, y por qué documento;
         · si esa fecha es un hecho registrado o una deducción;
         · y el caso duro: si el término nacerá ya vencido.

       Descubrir cualquiera de esas cosas DESPUÉS de pulsar sería el peor
       mostrador posible: el número ya estaría emitido y el plazo corriendo.

       Se calcula con la MISMA función pura que ejecuta el POST — no con una
       réplica «de presentación». Si divergieran, la pantalla prometería una
       cosa y el acto haría otra, que es exactamente la clase de defecto que
       este módulo lleva una semana persiguiendo.

       CERO lecturas nuevas: `actuaciones` y `documentos` ya se trajeron
       arriba para otros fines. */
    /* Un solo reloj para toda la vista previa: la fecha del ancla, la
       proyección del vencimiento y el juicio de «nace vencido» tienen que
       mirar el mismo instante, o pueden contradecirse entre sí. */
    const ahora = new Date();
    const evaluacion = evaluarRadicacionEnDebidaForma({
      expediente: expediente as unknown as ExpedienteLicenciaDoc,
      actuacionesPrevias: actuaciones as ActuacionLicenciaDoc[],
      documentos: (documentos as DocumentoParaAncla[]).filter((d) => d?.creadoEn),
      tenantEsperado: expediente.tenantId as TenantId,
      ahora,
    });

    const debidaForma = esErrorExpediente(evaluacion)
      ? { procede: false, motivo: evaluacion.mensaje, yaRadicada: false }
      : esRadicacionYaOcurrida(evaluacion)
        ? {
            procede: false,
            yaRadicada: true,
            motivo: 'Este expediente ya está radicado en legal y debida forma.',
            numeroExpediente: evaluacion.numeroExpediente,
            desdeCuandoCorreElPlazo: evaluacion.anclaIso,
          }
        : {
            procede: true,
            yaRadicada: false,
            /* El día que la funcionaria confirma. Viaja de vuelta en el POST
               como `anclaEsperada`: si la evidencia cambia entre que mira y
               pulsa, el acto se rechaza en vez de afirmar una fecha que ella
               no vio. */
            anclaPropuesta: evaluacion.anclaDiaCivil,
            anclaIso: evaluacion.anclaIso,
            baseDelAncla: evaluacion.baseDelAncla,
            requisitoQueFijaElAncla: evaluacion.evidencia.requisitoId,
            documentoQueFijaElAncla: evaluacion.evidencia.documentoId,
            requisitosAplicables: evaluacion.completitud.aplicables,
            /* El caso duro, dicho antes y no después: si el último documento
               entró hace más de 45 días hábiles, el término nace vencido. El
               acto procede igual —es un hecho verdadero— pero nadie debería
               enterarse al pulsar. */
            venceraEl: sumarDiasHabiles(
              atLocalNoon(evaluacion.anclaIso),
              PLAZO_DECISION_LICENCIA_DIAS_HABILES,
            ).toISOString(),
            naceVencido:
              diasRestantesHabiles(
                sumarDiasHabiles(atLocalNoon(evaluacion.anclaIso), PLAZO_DECISION_LICENCIA_DIAS_HABILES).toISOString(),
              ) < 0,
          };

    return NextResponse.json({
      ok: true,
      expediente,
      actuaciones,
      documentos,
      radicadoVinculado,
      // Placeholder: única Definición sembrada hoy (Bloque A·A2). Cuando
      // exista resolución real por `expediente.tramiteId` (persistencia de
      // Fase 1), este campo se resuelve dinámicamente en vez de fijo.
      definicionId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
      computos: { terminoDual, vigencia, plazoSubsanacion, debidaForma },
      borradorActoDesistimiento,
    });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/[id]/GET', error });
    return jsonError(error);
  }
}
