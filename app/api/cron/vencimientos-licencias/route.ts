import { NextResponse }       from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autorizarCron }      from '@/lib/seguridad/autorizar-cron';
import { logError }           from '@/lib/logger';
import { soloOperacionReal }  from '@/lib/radicados/dato-de-prueba';
import { diasHabilesTranscurridos, diasRestantesHabiles, sumarDiasHabiles } from '@/lib/tiempos-radicado';
/* EL CRITERIO VIVE FUERA, y la ruta lo consume igual que la pantalla del
   expediente. Antes estaba aquí dentro; moverlo fue la única forma de que el
   correo y la pantalla no pudieran divergir. Se reexporta porque las pruebas
   del vigía lo importan desde esta ruta —y son justo el testigo de que el
   traslado no cambió nada—. */
import {
  clasificarFrenteAlTermino,
  type FilaVigia,
} from '@/lib/motor-expedientes/semaforo-termino';
export { clasificarFrenteAlTermino };
import { terminoResolucionSigueCorriendo } from '@/lib/motor-expedientes/estados-licencia';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { TenantId } from '@/src/types/radicado';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';

export const runtime = 'nodejs';
export const maxDuration = 300;

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/cron/vencimientos-licencias

   VIGÍA DEL TÉRMINO DE LICENCIAS (Decreto 1077, 45 días hábiles).

   Por qué existe. Hasta ahora NINGÚN trabajo programado miraba la colección
   `expedientes`: los tres crons declarados vigilan `ventanilla_radicados`
   (el reloj de PQRSD) o son de infraestructura. El término de licencias solo
   se calculaba cuando un humano abría la pantalla del expediente. Si nadie la
   abría, el plazo podía vencerse entero en silencio — y en licencias vencer
   el término no es una demora administrativa: es la concesión de la licencia
   por SILENCIO ADMINISTRATIVO POSITIVO.

   TRES SITUACIONES, NO DOS. Un expediente puede estar en tres estados frente
   al reloj, y cada uno se vigila con su propia regla:

     1. CORRIENDO      — término anclado y avanzando. Alerta escalonada según
                         los días hábiles que queden.
     2. SUSPENDIDO     — hay acta de observaciones: el término está detenido a
                         la espera del ciudadano. No se alerta por vencimiento
                         (no corre), pero se REPORTA para que no se olvide.
     3. SIN_ANCLAR     — el expediente existe y su término todavía no arrancó.
                         Hoy no debería ocurrir; a partir del estado previo
                         (ADR-0033) ocurrirá POR DISEÑO.

   La tercera es la que obliga a escribir esto así. Colapsar el mundo en
   «tiene fecha / no tiene fecha» vuelve invisible justo el caso nuevo — el
   mismo error de fondo que este módulo viene corrigiendo. Y un expediente sin
   anclar tampoco es un caso a ignorar: **también hay un plazo**, el de la
   Administración para verificar completitud, que no puede ser indefinido. Por
   eso tiene edad máxima y alerta al superarla.

   Seguridad: exige Authorization: Bearer <CRON_SECRET> (`autorizarCron`).
══════════════════════════════════════════════════════════════════════════ */


/* ── Edad máxima en estado previo ────────────────────────────────────────
   NO es una constante de código a propósito, y el porqué importa más que el
   mecanismo.

   Este número no mide solo «cuánto puede tardar la Administración en
   verificar completitud». Mide el tiempo durante el cual un ciudadano YA
   entregó su solicitud y TODAVÍA no tiene término corriendo a su favor. Los
   dos intereses apuntan en direcciones opuestas: mientras más largo, más
   cómoda la verificación y más tiempo la persona en el limbo.

   Por eso el valor por defecto es el extremo CORTO, no el cómodo: ampliarlo
   después con evidencia es una conversación fácil; reducirlo cuando ya se
   acostumbraron, no. Y por eso se lee de configuración: cambiarlo no debe
   exigir un despliegue, pero sí debe ser un acto deliberado y visible.

   Valor definitivo pendiente de la Secretaría de Planeación (ADR-0033 §7). */
const EDAD_MAXIMA_SIN_ANCLAR_POR_DEFECTO = 3;
/** Cota de cordura: un valor de configuración es un dato, y los datos vienen
 *  mal. Fuera de este rango se ignora y se usa el defecto. */
const EDAD_MAXIMA_LIMITE = 45;

async function leerEdadMaximaSinAnclar(
  db: FirebaseFirestore.Firestore,
): Promise<{ dias: number; origen: 'CONFIGURACION' | 'DEFECTO' }> {
  try {
    const snap = await db.doc('configuracion/licencias').get();
    const crudo = snap.exists ? snap.data()?.edadMaximaSinAnclarHabiles : undefined;
    if (Number.isInteger(crudo) && crudo >= 1 && crudo <= EDAD_MAXIMA_LIMITE) {
      return { dias: crudo as number, origen: 'CONFIGURACION' };
    }
  } catch {
    // Un fallo al leer configuración NO puede tumbar la vigilancia del plazo:
    // se sigue con el defecto, que es el valor conservador.
  }
  return { dias: EDAD_MAXIMA_SIN_ANCLAR_POR_DEFECTO, origen: 'DEFECTO' };
}

import {
  calcularTransiciones,
  componerResumen,
  type EstadoVigilado,
  type NivelVigilancia,
  type Transiciones,
} from '@/lib/server/vigilancia-termino';
import { enviarEmail } from '@/lib/email/mailer';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import {
  buildNovedadesVigilanciaHtml,
  buildNovedadesVigilanciaSubject,
  buildResumenSemanalHtml,
  buildResumenSemanalSubject,
} from '@/lib/email/templates/vigilancia-termino-licencias';

/** Techo de lectura (clase BATCH, ADR-0011 2B) — defensa en profundidad. */
const TECHO_LECTURA = 1000;

/** Memoria del vigía — cerradas a cliente en `firestore.rules`, igual que `expedientes`. */
const COLECCION_MEMORIA = 'vigilancia_termino_licencias';
const COLECCION_CORRIDAS = 'vigilancia_termino_corridas';






/** Tenant dueño de los expedientes de licencias — el mismo del resto del módulo. */
const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

/**
 * ¿Toca el resumen semanal?
 *
 * LUNES, día fijo, decidido en hora de Bogotá y no en UTC: el cron corre a las
 * 12:30 UTC, que es 07:30 en Colombia — mismo día civil, pero razonarlo en UTC
 * es la clase de suposición que rompe el día que cambie el horario del cron.
 */
export function esLunes(ahora: Date): boolean {
  const enBogota = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
  }).format(ahora);
  return enBogota === 'Mon';
}

interface ResultadoAviso {
  /** Cuántos correos HABÍA que mandar. Cero significa «no había nada que avisar». */
  intentados: number;
  enviados: number;
  errores: number;
  /** Por qué no se intentó, cuando `intentados` es 0 pese a haber novedades. */
  omitido?: string;
}

/**
 * Manda los dos correos que correspondan: las NOVEDADES (solo si algo entró o
 * se agravó) y el RESUMEN SEMANAL (los lunes, SIEMPRE, incluso con el conjunto
 * vacío — para que Planeación aprenda a esperarlo y su ausencia informe).
 */
async function avisar(p: {
  buzon: string | undefined;
  enlaceBandeja: string;
  transiciones: Transiciones;
  resumen: ReturnType<typeof componerResumen>;
  esDiaDeResumen: boolean;
}): Promise<ResultadoAviso> {
  const novedades = p.transiciones.entraron.length + p.transiciones.agravaron.length;
  const aMandar = (novedades > 0 ? 1 : 0) + (p.esDiaDeResumen ? 1 : 0);
  if (aMandar === 0) return { intentados: 0, enviados: 0, errores: 0 };

  if (!p.buzon) {
    /* Sin buzón NO se cuenta como intento fallido —no hay a quién escribirle—
       pero tampoco se calla: se declara el motivo para que el silencio se pueda
       distinguir de un envío que se perdió. */
    return {
      intentados: 0,
      enviados: 0,
      errores: 0,
      omitido: `El directorio no tiene correo oficial para ${TENANT_LICENCIAS}: no hay a quién avisar.`,
    };
  }

  let enviados = 0;
  let errores = 0;

  if (novedades > 0) {
    try {
      await enviarEmail({
        to: p.buzon,
        subject: buildNovedadesVigilanciaSubject(
          p.transiciones.entraron.length,
          p.transiciones.agravaron.length,
        ),
        html: buildNovedadesVigilanciaHtml({
          entraron: p.transiciones.entraron,
          agravaron: p.transiciones.agravaron,
          fechaCorridaIso: p.resumen.corridaIso,
          enlaceBandeja: p.enlaceBandeja,
        }),
      });
      enviados += 1;
    } catch (error) {
      errores += 1;
      logError({ radicadoId: '', modulo: 'cron/vencimientos-licencias/aviso-novedades', error });
    }
  }

  if (p.esDiaDeResumen) {
    try {
      await enviarEmail({
        to: p.buzon,
        subject: buildResumenSemanalSubject(p.resumen),
        html: buildResumenSemanalHtml({ resumen: p.resumen, enlaceBandeja: p.enlaceBandeja }),
      });
      enviados += 1;
    } catch (error) {
      errores += 1;
      logError({ radicadoId: '', modulo: 'cron/vencimientos-licencias/resumen-semanal', error });
    }
  }

  return { intentados: aMandar, enviados, errores };
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = autorizarCron({
    authorization: request.headers.get('authorization'),
    secret:        process.env.CRON_SECRET,
  });
  if (!auth.ok) {
    console.warn('[cron/vencimientos-licencias] acceso denegado', { motivo: auth.motivo });
    return NextResponse.json({ error: auth.mensaje }, { status: auth.status });
  }

  const ahora = new Date();
  const inicioCron = Date.now();
  try {
    const db = getFirebaseAdminDb();
    const snap = await db.collection('expedientes').limit(TECHO_LECTURA).get();

    // Los datos de prueba no generan alertas: el criterio vive en un solo
    // sitio desde que Control Interno lo olvidó (ver lib/radicados/dato-de-prueba).
    const vivos = soloOperacionReal(
      snap.docs.map((d) => d.data() as ExpedienteLicenciaDoc & { isTest?: boolean }),
    );

    const edadMaxima = await leerEdadMaximaSinAnclar(db);
    const filas = vivos.map((e) => clasificarFrenteAlTermino(e as never, ahora));

    const corriendo   = filas.filter((f) => f.situacion === 'CORRIENDO');
    const suspendidos = filas.filter((f) => f.situacion === 'SUSPENDIDO');
    const sinAnclar   = filas.filter((f) => f.situacion === 'SIN_ANCLAR');
    const resueltos   = filas.filter((f) => f.situacion === 'RESUELTO');

    const alertables = corriendo.filter((f) => f.nivel !== undefined);
    const enEsperaExcesiva = sinAnclar.filter(
      (f) => (f.diasHabilesEnEspera ?? 0) > edadMaxima.dias,
    );

    /* ── LA MEMORIA DEL VIGÍA ──────────────────────────────────────────
       Hasta aquí el vigía clasificaba y se olvidaba: el veredicto vivía en la
       respuesta HTTP y se evaporaba. Nadie lo recibía y nadie podía saber, al
       día siguiente, QUÉ HABÍA CAMBIADO.

       Se persiste el estado por expediente (para calcular transiciones) y un
       resumen por corrida (para el tablero y el resumen semanal). El envío del
       correo NO se hace aquí todavía: el buzón de Planeación está declarado en
       el directorio pero nadie ha confirmado que exista, y enviar a un buzón
       inexistente se pierde en silencio — que es peor que no enviar. */
    const lecturaCompleta = snap.size < TECHO_LECTURA;

    const vigilados: EstadoVigilado[] = [
      ...alertables.map((f) => ({
        expedienteId: f.expedienteId,
        numeroExpediente: f.numeroExpediente,
        nivel: f.nivel as NivelVigilancia,
      })),
      ...enEsperaExcesiva.map((f) => ({
        expedienteId: f.expedienteId,
        numeroExpediente: f.numeroExpediente,
        nivel: 'ESPERA_EXCESIVA' as NivelVigilancia,
      })),
    ];

    /* Se izan fuera del `try`: si RECORDAR falla, el aviso no puede inventarse
       transiciones que no pudo calcular — sale vacío, no falso. */
    let transicionesDeLaCorrida: Transiciones = calcularTransiciones([], [], lecturaCompleta);
    let resumen = componerResumen(
      ahora.toISOString(),
      filas.length,
      vigilados,
      transicionesDeLaCorrida,
      lecturaCompleta,
    );
    try {
      const previosSnap = await db.collection(COLECCION_MEMORIA).get();
      const previos: EstadoVigilado[] = previosSnap.docs.map((d) => d.data() as EstadoVigilado);
      const transiciones = calcularTransiciones(previos, vigilados, lecturaCompleta);
      transicionesDeLaCorrida = transiciones;
      resumen = componerResumen(ahora.toISOString(), filas.length, vigilados, transiciones, lecturaCompleta);

      const lote = db.batch();
      for (const v of vigilados) {
        lote.set(db.collection(COLECCION_MEMORIA).doc(v.expedienteId), {
          ...v,
          ultimaCorridaIso: ahora.toISOString(),
        });
      }
      /* Solo se borran los que SALIERON de verdad. Con lectura truncada
         `salieron` viene vacío a propósito (ver `vigilancia-termino.ts`): un
         expediente que no se leyó no puede declararse resuelto. */
      for (const t of transiciones.salieron) {
        lote.delete(db.collection(COLECCION_MEMORIA).doc(t.expedienteId));
      }
      lote.set(db.collection(COLECCION_CORRIDAS).doc(ahora.toISOString().slice(0, 10)), resumen);
      await lote.commit();
    } catch (error) {
      /* Un fallo al RECORDAR no puede tumbar la vigilancia: el informe de esta
         corrida sigue siendo válido y se devuelve igual. Pero se registra, y el
         resumen sale con las transiciones vacías, no con transiciones falsas. */
      logError({ radicadoId: '', modulo: 'cron/vencimientos-licencias/memoria', error });
    }

    /* ── AVISAR ────────────────────────────────────────────────────────
       El buzón sale del DIRECTORIO de dependencias, no de una variable de
       entorno propia: es el mismo dato que ya usa el cron de PQRSD, y una
       segunda fuente para la misma verdad acabaría divergiendo. */
    const buzonPlaneacion = DIRECTORIO_TENANTS[TENANT_LICENCIAS]?.emailOficial;
    const enlaceBandeja = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://ventanilla-simacota.vercel.app'}/interno/licencias`;
    const correo = await avisar({
      buzon: buzonPlaneacion,
      enlaceBandeja,
      transiciones: transicionesDeLaCorrida,
      resumen,
      esDiaDeResumen: esLunes(ahora),
    });

    /* ── LECCIÓN PT-2 (24-ago-2026) ────────────────────────────────────
       Si HABÍA algo que avisar y NINGÚN envío salió, el cron NO puede
       reportar verde. Es el escenario real que la auditoría encontró en el
       cron de PQRSD: SMTP vacío, cada envío lanzaba, el catch contaba, la
       ruta devolvía ok:true y el panel de Vercel pintaba el cron «sano»
       mientras CERO avisos llegaban a nadie. Un vigilante que reporta éxito
       cuando no vigila es peor que ninguno. */
    if (correo.intentados > 0 && correo.enviados === 0) {
      console.error(
        '[cron/vencimientos-licencias] FRACASO TOTAL DE AVISO: había novedades y ningún correo salió',
        JSON.stringify({ intentados: correo.intentados, errores: correo.errores, buzon: buzonPlaneacion ?? null }),
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            'La revisión del término se completó, pero NINGÚN aviso pudo enviarse. ' +
            'Los expedientes en alerta no han sido comunicados a Planeación.',
          revisadoEn: ahora.toISOString(),
          memoria: resumen,
          correo,
        },
        { status: 500 },
      );
    }

    /* El informe cuenta las TRES situaciones siempre, incluso en cero. Un
       vigía que solo reporta lo que encontró no permite distinguir «no hay
       nada que alertar» de «no miré»: esa ambigüedad es la que deja pasar los
       silencios administrativos. */
    /* DEJAR RASTRO DE LO QUE HIZO, no solo de que respondió 200. Los logs de
       Vercel guardan el estado y la duración, no el cuerpo de la respuesta: sin
       esto, una barrida que revisó cientos y una que no encontró nada se ven
       idénticas. El silencio de un vigilante tiene que poder distinguirse de
       «no hizo nada». */
    registrarEventoNegocio({
      operacion:  'vigia_vencimientos_licencias',
      resultado:  'ok',
      latenciaMs: Date.now() - inicioCron,
      radicadoId: null,
      actorRol:   'CRON',
      tenant:     'SEC_PLANEACION',
      docsLeidos: filas.length,
      accionados: sinAnclar.length + suspendidos.length,
    });

    return NextResponse.json({
      ok: true,
      revisadoEn: ahora.toISOString(),
      revisados: filas.length,
      // Se declara con qué umbral se juzgó y de dónde salió: un informe que no
      // dice su propio criterio no se puede auditar ni discutir.
      edadMaximaSinAnclarHabiles: edadMaxima.dias,
      edadMaximaOrigen: edadMaxima.origen,
      situaciones: {
        corriendo: corriendo.length,
        suspendidos: suspendidos.length,
        sinAnclar: sinAnclar.length,
        resueltos: resueltos.length,
      },
      alertas: {
        vencidos: alertables.filter((f) => f.nivel === 'VENCIDO').length,
        criticos: alertables.filter((f) => f.nivel === 'CRITICO').length,
        avisos:   alertables.filter((f) => f.nivel === 'AVISO').length,
        esperaExcesivaSinAnclar: enEsperaExcesiva.length,
      },
      /* Lo que se PERSISTIÓ, en la misma respuesta: quien lea el JSON del cron
         ve exactamente lo que quedó escrito, sin tener que ir a buscarlo. */
      memoria: resumen,
      correo,
      detalle: [...alertables, ...enEsperaExcesiva, ...suspendidos],
    });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'cron/vencimientos-licencias', error });
    // Fallar en ROJO: un vigía que devuelve 200 cuando no pudo mirar es peor
    // que no tenerlo, porque el tablero lo pinta verde.
    return NextResponse.json(
      { ok: false, error: 'El vigía de vencimientos de licencias no pudo completar la revisión.' },
      { status: 500 },
    );
  }
}
