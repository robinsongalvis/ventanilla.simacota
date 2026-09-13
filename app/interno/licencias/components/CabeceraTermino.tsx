'use client';

import {
  COLOR_NIVEL_TERMINO,
  type NivelTermino,
} from '@/lib/motor-expedientes/semaforo-termino';
/* LOS NÚMEROS NO SE CALCULAN AQUÍ. Desde el 9-sep-2026 los comparte
   `leerElTermino` con la proyección de ventanilla (ADR-0034): si esta tarjeta
   volviera a hacer su propia aritmética, el mostrador y Planeación podrían
   decirle al mismo ciudadano dos plazos distintos. */
import { leerElTermino } from '@/lib/motor-expedientes/lectura-del-termino';
import type { RelojDetenido } from '@/lib/motor-expedientes/termino';
import type { EvaluacionPlazoSubsanacion } from '../tipos-computos';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { formatFechaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   EL SEMÁFORO DEL TÉRMINO.

   El módulo anterior estaba en ROJO con 41 días por delante. Un cronómetro que
   siempre grita acaba ignorado justo el día que grita de verdad.

   LA CLASIFICACIÓN NO SE DECIDE AQUÍ. Sale de `clasificarFrenteAlTermino`, la
   MISMA función que consulta el cron: si la pantalla tuviera sus propios
   umbrales, un expediente podría verse «en término» mientras el correo lo
   reporta crítico. Por eso el criterio se movió a un módulo puro y esta
   pantalla lo consume, no lo reimplementa.
══════════════════════════════════════════════════════════════ */

export interface CabeceraTerminoProps {
  /** ISO — vencimiento proyectado (la fecha más exigente). */
  venceIso: string;
  /**
   * ISO — desde cuándo corre. OPCIONAL: los expedientes anteriores al acto de
   * radicar (#248) no tienen el ancla persistida, y aun así su término corre y
   * hay que clasificarlo. Sin ancla se omite la línea «Corre desde el …» en vez
   * de inventarse una fecha.
   */
  desdeIso?: string;
  estadoJuridico: EstadoJuridicoLicencia;
  expedienteId: string;
  /**
   * El reloj detenido con sus números, tal como lo manda el servidor. Opcional:
   * sin él la tarjeta sigue diciendo que está parado, pero sin la cuenta —
   * nunca la inventa.
   */
  relojDetenido?: RelojDetenido | null;
  /**
   * El plazo que corre contra el CIUDADANO mientras el término está suspendido
   * (30 días hábiles desde la comunicación del acta, art. 2.2.6.1.2.2.4). Se
   * pinta DENTRO de esta tarjeta y no solo en una línea suelta arriba: cuando
   * el reloj de la Secretaría está parado, el único reloj que corre es ese, y
   * es el que hay que mirar.
   */
  plazoCiudadano?: EvaluacionPlazoSubsanacion;
}

/* Qué hacer, por nivel.

   LOS COLORES NO SE ELIGEN AQUÍ: salen de `COLOR_NIVEL_TERMINO`, el mismo juego
   que usa el correo del vigía. Si un expediente sale en ámbar oscuro en la
   bandeja de Planeación, en pantalla se ve del mismo ámbar oscuro.

   Y CRÍTICO NO ES AVISO. La primera versión de esta tarjeta les daba el mismo
   fondo y el mismo texto, con lo cual el escalón de los 5 días —el que existe
   precisamente para que alguien deje lo que está haciendo— no se distinguía del
   de los 15. El correo sí los distinguía: la pantalla mentía por omisión. */
const MENSAJE: Record<'EN_TERMINO' | NivelTermino, { texto: string; estado: string; fondo: string; tinta: string }> = {
  EN_TERMINO: {
    estado: 'En término',
    texto: 'Sin riesgo hoy. La revisión técnica puede avanzar con calma.',
    fondo: '#E7F6EC', tinta: '#116932',
  },
  AVISO: {
    estado: 'Por vencer',
    texto: 'Entra en la ventana de aviso. Si va a haber observaciones, es el momento de prepararlas — el acta es lo único que suspende el término.',
    fondo: '#FDF6E3', tinta: '#5A4A16',
  },
  CRITICO: {
    estado: 'Crítico',
    texto: 'Quedan cinco días hábiles o menos. O sale la resolución, o sale el acta de observaciones: nada más detiene el reloj.',
    fondo: '#FFF4ED', tinta: '#B54708',
  },
  VENCIDO: {
    /* La consecuencia con todas sus letras: el silencio administrativo POSITIVO
       de licencias concede por ley (D.1077/2015 art. 2.2.6.1.2.3.5). Suavizarlo
       sería ocultar el riesgo real que corre la Administración. */
    estado: 'Vencido',
    texto: 'Riesgo de silencio administrativo positivo — la licencia podría entenderse concedida por ley. Resolver de inmediato.',
    fondo: '#FEF2F2', tinta: '#B42318',
  },
};

/** El color del borde y del anillo — compartido con el correo. Verde solo cuando no hay nivel. */
const VERDE_EN_TERMINO = '#116932';

export function CabeceraTermino({
  venceIso, desdeIso, estadoJuridico, expedienteId, relojDetenido, plazoCiudadano,
}: CabeceraTerminoProps) {
  const lectura = leerElTermino({ expedienteId, estadoJuridico, venceIso, desdeIso, relojDetenido });

  /* ── EL RELOJ DETENIDO SE VE, Y AHORA SE CUENTA. ─────────────────────
     Antes, con el término suspendido, esta tarjeta DESAPARECÍA. Y desaparecer
     no dice «está parado»: dice «aquí no hay nada», que es lo mismo que decía
     para un expediente sin ancla. El funcionario no puede distinguir «el plazo
     no ha empezado» de «el plazo está congelado», y son situaciones opuestas —
     en una espera papeles, en la otra el ciudadano tiene la pelota.

     Lo pidió el propietario el 29-ago-2026: que se vea que el reloj está
     parado, no que no exista. Y el 9-sep pidió lo que faltaba — el TIEMPO que
     lleva parado y lo que quedará al arrancar de nuevo.

     HASTA HOY NO SE PODÍA: el motor congelaba los días restantes y acto seguido
     los tiraba, así que el comentario que vivía aquí decía, con razón, que
     inventarlos sería peor que no darlos. Ya no hay que inventar nada:
     `proyectarComputo` los devuelve y el servidor los manda.

     LA REGLA DE NO INVENTAR SIGUE EN PIE, y tiene un caso vivo. El acto de
     viabilidad —la otra causa de suspensión— sigue INERTE en el cómputo, así
     que para un expediente `EN_VIABILIDAD` no llegan números. Entonces no se
     pinta un cero: se dice con todas las letras que esos días NO se están
     descontando, que es un hecho con consecuencia para la Secretaría. */
  if (lectura.situacion === 'SUSPENDIDO') {
    const acreditada = lectura.diasHabilesDetenido !== undefined;
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid #64748B' }}
      >
        <div className="p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
            Término para resolver
          </p>
          <div className="flex items-center gap-4">
            {/* Anillo PUNTEADO y gris: la forma dice «detenido». Dentro, cuando
                el servidor los acredita, los días que lleva parado; cuando no,
                el símbolo de pausa de siempre. */}
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden className="shrink-0">
              <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-surface-2)" strokeWidth="7" />
              <circle
                cx="36" cy="36" r="30" fill="none" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round"
                strokeDasharray="10 10" transform="rotate(-90 36 36)"
              />
              {acreditada ? (
                <>
                  <text x="36" y="34" textAnchor="middle" fontSize="19" fontWeight="800" fill="#475569">
                    {lectura.diasHabilesDetenido}
                  </text>
                  <text x="36" y="47" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#94A3B8" letterSpacing="0.5">
                    DÍAS PARADO
                  </text>
                </>
              ) : (
                <>
                  <rect x="29" y="27" width="5.5" height="18" rx="1.6" fill="#475569" />
                  <rect x="37.5" y="27" width="5.5" height="18" rx="1.6" fill="#475569" />
                </>
              )}
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: '#475569' }}>Reloj detenido</p>
              <p className="font-headline text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                El término no está corriendo
              </p>
              {lectura.detenidoDesdeIso ? (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Detenido desde el <strong>{formatFechaColombia(lectura.detenidoDesdeIso)}</strong>
                  {lectura.diasHabilesGuardados !== undefined && (
                    <> · al reanudar quedarán <strong>{lectura.diasHabilesGuardados} días hábiles</strong></>
                  )}
                  .
                </p>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Hay un acto que suspende el trámite: el plazo dejó de correr.
                </p>
              )}
            </div>
          </div>

          {/* EL ÚNICO RELOJ QUE CORRE AHORA. Vivía en una línea suelta más
              arriba de la pantalla; su sitio es este — cuando el término de la
              Secretaría está parado, el plazo del ciudadano es lo que hay que
              mirar. */}
          <div className="rounded-lg px-3 py-2 text-sm flex flex-col gap-1" style={{ background: '#F1F5F9', color: '#334155' }}>
            <p>
              El turno es del ciudadano: tiene 30 días hábiles para subsanar desde que se le
              notificó. Nada corre contra la Secretaría mientras tanto.
            </p>
            {plazoCiudadano?.resultado === 'EN_PLAZO' && plazoCiudadano.diasHabilesRestantes !== undefined && (
              <p style={{ fontWeight: 700 }}>
                Le quedan {plazoCiudadano.diasHabilesRestantes} días hábiles
                {plazoCiudadano.fechaVencimientoPlazo && (
                  <> — vence el {formatFechaColombia(plazoCiudadano.fechaVencimientoPlazo)}</>
                )}
                {/* DE DÓNDE SALE EL PLAZO. Con prórroga son 45 y no 30, y quien
                    mira tiene que poder ver por qué cambió el número — si no,
                    parece que el sistema se equivocó. */}
                {plazoCiudadano.conProrroga && <> (30 + 15 de prórroga concedida)</>}.
              </p>
            )}
            {plazoCiudadano?.prorrogaDescartada === 'SOLICITADA_FUERA_DE_PLAZO' && (
              /* UNA PRÓRROGA DESCARTADA EN SILENCIO ES PEOR QUE NINGUNA: la
                 funcionaria creería que el ciudadano tiene quince días que no
                 tiene, y dejaría correr un archivo que ya procede. */
              <p role="alert" style={{ fontWeight: 700, color: '#B54708' }}>
                ⚠ Consta una prórroga solicitada DESPUÉS de vencido el plazo: no lo amplía.
                El término sigue siendo de 30 días hábiles.
              </p>
            )}
            {plazoCiudadano?.resultado === 'POR_ARCHIVAR' && (
              <p role="alert" style={{ fontWeight: 700, color: '#B42318' }}>
                ⚠ El plazo del ciudadano ya venció sin respuesta. Procede evaluar el desistimiento tácito.
              </p>
            )}
          </div>

          {!acreditada && (
            /* NO ES UN DETALLE DE IMPLEMENTACIÓN: mientras esto siga así, los
               días de esta pausa se los come la Secretaría. Quien mira la
               pantalla tiene derecho a saberlo. */
            <p role="alert" className="rounded-lg px-3 py-2 text-xs" style={{ background: '#FDF6E3', color: '#5A4A16' }}>
              Los días de esta pausa <strong>no se están descontando</strong> del término: la
              suspensión por el acto de viabilidad está pendiente del concepto escrito de
              Jurídica. El vencimiento se sigue calculando como si el reloj no se hubiera detenido.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* Sin ancla o ya resuelto: el panel de abajo lo dice con sus palabras;
     inventarles un anillo afirmaría un reloj que no existe. */
  if (lectura.situacion !== 'CORRIENDO') return null;

  const { diasHabilesRestantes: restantes, nivel, vencido, diaTranscurrido: transcurridos, porcentaje } = lectura;
  const m = MENSAJE[nivel];
  const acento = nivel === 'EN_TERMINO' ? VERDE_EN_TERMINO : COLOR_NIVEL_TERMINO[nivel];

  const R = 30;
  const circunferencia = 2 * Math.PI * R;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${acento}` }}>
      <div className="p-4 flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
          Término para resolver
        </p>

        <div className="flex items-center gap-4">
          {/* ANILLO: los días restantes en grande y el avance del término. */}
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden className="shrink-0">
            <circle cx="36" cy="36" r={R} fill="none" stroke="var(--bg-surface-2)" strokeWidth="7" />
            <circle
              cx="36" cy="36" r={R} fill="none" stroke={acento} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circunferencia}
              strokeDashoffset={circunferencia * (1 - porcentaje / 100)}
              transform="rotate(-90 36 36)"
            />
            <text x="36" y="34" textAnchor="middle" fontSize="19" fontWeight="800" fill={m.tinta}>
              {vencido ? `−${Math.abs(restantes)}` : restantes}
            </text>
            <text x="36" y="47" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#94A3B8" letterSpacing="0.5">
              DÍAS HÁBILES
            </text>
          </svg>

          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: m.tinta }}>
              {vencido
                ? `Vencido hace ${Math.abs(restantes)} día${Math.abs(restantes) === 1 ? '' : 's'}`
                : m.estado}
            </p>
            <p className="font-headline text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              {vencido ? 'Venció el' : 'Vence el'} {formatFechaColombia(venceIso)}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {desdeIso
                ? `${vencido ? 'Corría' : 'Corre'} desde el ${formatFechaColombia(desdeIso)}`
                : 'Sin ancla registrada'}
              {!vencido && ` · día ${transcurridos} de ${lectura.totalDias}`}
            </p>
          </div>
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-2)' }}>
          <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, background: acento }} />
        </div>

        <p
          role={vencido ? 'alert' : undefined}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: m.fondo, color: m.tinta, fontWeight: vencido ? 700 : 400 }}
        >
          {vencido && <span aria-hidden>⚠ </span>}
          {m.texto}
        </p>
      </div>
    </div>
  );
}
