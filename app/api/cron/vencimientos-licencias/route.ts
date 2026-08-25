import { NextResponse }       from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autorizarCron }      from '@/lib/seguridad/autorizar-cron';
import { logError }           from '@/lib/logger';
import { soloOperacionReal }  from '@/lib/radicados/dato-de-prueba';
import { diasRestantesHabiles, sumarDiasHabiles } from '@/lib/tiempos-radicado';
import { terminoResolucionSigueCorriendo } from '@/lib/motor-expedientes/estados-licencia';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

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

/** Umbrales de alerta, en días hábiles restantes. Escalonados a propósito:
 *  un único aviso a dos días no da margen para reunir un concepto técnico. */
const ESCALONES = [
  { hasta: 0,  nivel: 'VENCIDO'  as const },
  { hasta: 5,  nivel: 'CRITICO'  as const },
  { hasta: 15, nivel: 'AVISO'    as const },
];

/** Días hábiles que la Administración puede tardar en verificar completitud
 *  antes de que el expediente sin anclar se convierta en un hallazgo. */
const EDAD_MAXIMA_SIN_ANCLAR_HABILES = 5;

/** Techo de lectura (clase BATCH, ADR-0011 2B) — defensa en profundidad. */
const TECHO_LECTURA = 1000;

type Situacion = 'CORRIENDO' | 'SUSPENDIDO' | 'SIN_ANCLAR' | 'RESUELTO';

/* El estado en que el término está DETENIDO a la espera del ciudadano. Se
   nombra explícito y NO se deduce de `terminoResolucionSigueCorriendo`: esa
   función responde «¿ya se resolvió?» (CONCEDIDA, NEGADA, DESISTIDA…), no
   «¿está suspendido?». Al escribir esto la primera vez las confundí, y
   CON_ACTA_DE_OBSERVACIONES habría caído en CORRIENDO — el colapso de
   situaciones que este vigía existe para evitar. */
const ESTADO_TERMINO_SUSPENDIDO = 'CON_ACTA_DE_OBSERVACIONES';

interface FilaVigia {
  expedienteId: string;
  numeroExpediente: string | null;
  situacion: Situacion;
  /** Solo en CORRIENDO. */
  diasHabilesRestantes?: number;
  nivel?: 'VENCIDO' | 'CRITICO' | 'AVISO';
  /** Solo en SIN_ANCLAR. */
  diasHabilesEnEspera?: number;
}

/**
 * Clasifica un expediente frente al reloj. Función PURA: sin Firestore y sin
 * `new Date()` propio — el instante entra por parámetro para que la prueba
 * pueda fijarlo y para que TODA la corrida use el mismo reloj.
 */
export function clasificarFrenteAlTermino(
  exp: Pick<ExpedienteLicenciaDoc, 'id' | 'estadoJuridico' | 'creadoEn'> & {
    numeroExpediente?: { numero: string } | null;
    fechaAlertaConservadora?: string | null;
  },
  ahora: Date,
): FilaVigia {
  const base = {
    expedienteId: exp.id,
    numeroExpediente: exp.numeroExpediente?.numero ?? null,
  };

  // SIN_ANCLAR primero: la ausencia de fecha es el discriminante más fuerte y
  // no depende de interpretar el estado jurídico.
  if (!exp.fechaAlertaConservadora) {
    const diasHabilesEnEspera = diasHabilesTranscurridos(exp.creadoEn, ahora);
    return { ...base, situacion: 'SIN_ANCLAR', diasHabilesEnEspera };
  }

  // RESUELTO: la Administración ya decidió; el plazo dejó de correr. Fuera del
  // alcance del vigía — medirlo contra "hoy" convierte el paso del tiempo en
  // una mora que no existe (el defecto que la E2E del 12-ago corrigió).
  // OJO al añadir estados: esta función decide con un ARRAY, no con un Record,
  // así que el compilador NO avisa (ADR-0033 §5).
  if (!terminoResolucionSigueCorriendo(exp.estadoJuridico)) {
    return { ...base, situacion: 'RESUELTO' };
  }

  // SUSPENDIDO: hay acta de observaciones y el reloj está detenido.
  if (exp.estadoJuridico === ESTADO_TERMINO_SUSPENDIDO) {
    return { ...base, situacion: 'SUSPENDIDO' };
  }

  const diasHabilesRestantes = diasRestantesHabiles(exp.fechaAlertaConservadora, ahora);
  const escalon = ESCALONES.find((e) => diasHabilesRestantes <= e.hasta);
  return {
    ...base,
    situacion: 'CORRIENDO',
    diasHabilesRestantes,
    ...(escalon ? { nivel: escalon.nivel } : {}),
  };
}

/** Días hábiles transcurridos entre dos instantes. Se apoya en la misma pieza
 *  de conteo del resto del sistema (festivos colombianos incluidos) en vez de
 *  dividir por 86.400.000, que ignoraría fines de semana y puentes. */
function diasHabilesTranscurridos(desdeIso: string, ahora: Date): number {
  const desde = new Date(desdeIso);
  if (Number.isNaN(desde.getTime())) return 0;
  let dias = 0;
  // Cota dura: un expediente de más de 400 días hábiles en espera ya es un
  // hallazgo por sí solo; no hace falta contar exacto para reportarlo.
  while (dias < 400 && sumarDiasHabiles(desde, dias + 1).getTime() <= ahora.getTime()) {
    dias += 1;
  }
  return dias;
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
  try {
    const db = getFirebaseAdminDb();
    const snap = await db.collection('expedientes').limit(TECHO_LECTURA).get();

    // Los datos de prueba no generan alertas: el criterio vive en un solo
    // sitio desde que Control Interno lo olvidó (ver lib/radicados/dato-de-prueba).
    const vivos = soloOperacionReal(
      snap.docs.map((d) => d.data() as ExpedienteLicenciaDoc & { isTest?: boolean }),
    );

    const filas = vivos.map((e) => clasificarFrenteAlTermino(e as never, ahora));

    const corriendo   = filas.filter((f) => f.situacion === 'CORRIENDO');
    const suspendidos = filas.filter((f) => f.situacion === 'SUSPENDIDO');
    const sinAnclar   = filas.filter((f) => f.situacion === 'SIN_ANCLAR');
    const resueltos   = filas.filter((f) => f.situacion === 'RESUELTO');

    const alertables = corriendo.filter((f) => f.nivel !== undefined);
    const enEsperaExcesiva = sinAnclar.filter(
      (f) => (f.diasHabilesEnEspera ?? 0) > EDAD_MAXIMA_SIN_ANCLAR_HABILES,
    );

    /* El informe cuenta las TRES situaciones siempre, incluso en cero. Un
       vigía que solo reporta lo que encontró no permite distinguir «no hay
       nada que alertar» de «no miré»: esa ambigüedad es la que deja pasar los
       silencios administrativos. */
    return NextResponse.json({
      ok: true,
      revisadoEn: ahora.toISOString(),
      revisados: filas.length,
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
