'use client';

import {
  clasificarFrenteAlTermino,
  COLOR_NIVEL_TERMINO,
  PLAZO_DECISION_LICENCIA_DIAS_HABILES,
  type NivelTermino,
} from '@/lib/motor-expedientes/semaforo-termino';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
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

export function CabeceraTermino({ venceIso, desdeIso, estadoJuridico, expedienteId }: CabeceraTerminoProps) {
  const fila = clasificarFrenteAlTermino(
    /* `creadoEn` solo lo usa la rama SIN_ANCLAR, inalcanzable aquí porque
       `venceIso` existe; se pasa el vencimiento como relleno para no fingir un
       ancla que puede no haber. */
    { id: expedienteId, estadoJuridico, creadoEn: desdeIso ?? venceIso, fechaAlertaConservadora: venceIso },
    new Date(),
  );

  /* ── EL RELOJ DETENIDO SE VE. ─────────────────────────────────────────
     Antes, con el término suspendido, esta tarjeta DESAPARECÍA. Y desaparecer
     no dice «está parado»: dice «aquí no hay nada», que es lo mismo que decía
     para un expediente sin ancla. El funcionario no puede distinguir «el plazo
     no ha empezado» de «el plazo está congelado», y son situaciones opuestas —
     en una espera papeles, en la otra el ciudadano tiene la pelota.

     Lo pidió el propietario el 29-ago-2026: que se vea que el reloj está
     parado, no que no exista.

     NO SE PINTA ANILLO NI CUENTA ATRÁS, y eso es deliberado: cuántos días
     quedaban al congelarse depende de la serie de eventos, y el servidor
     todavía no manda ese dato. Inventarlo aquí sería peor que no darlo. Se
     dice lo que se sabe con certeza: que está detenido y por qué. */
  if (fila.situacion === 'SUSPENDIDO') {
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
            {/* Anillo PARTIDO y en gris: la forma dice «detenido» sin números. */}
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden className="shrink-0">
              <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-surface-2)" strokeWidth="7" />
              <circle
                cx="36" cy="36" r="30" fill="none" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round"
                strokeDasharray="10 10" transform="rotate(-90 36 36)"
              />
              <rect x="29" y="27" width="5.5" height="18" rx="1.6" fill="#475569" />
              <rect x="37.5" y="27" width="5.5" height="18" rx="1.6" fill="#475569" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: '#475569' }}>Reloj detenido</p>
              <p className="font-headline text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                El término no está corriendo
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Hay un acta de observaciones: el plazo se suspendió al notificarla.
              </p>
            </div>
          </div>
          <p className="rounded-lg px-3 py-2 text-sm" style={{ background: '#F1F5F9', color: '#334155' }}>
            El turno es del ciudadano: tiene 30 días hábiles para subsanar desde que se le
            notificó. Nada corre contra la Secretaría mientras tanto.
          </p>
        </div>
      </div>
    );
  }

  /* Sin ancla o ya resuelto: el panel de abajo lo dice con sus palabras;
     inventarles un anillo afirmaría un reloj que no existe. */
  if (fila.situacion !== 'CORRIENDO') return null;

  const restantes = fila.diasHabilesRestantes ?? diasRestantesHabiles(venceIso);
  const nivel = fila.nivel ?? 'EN_TERMINO';
  const m = MENSAJE[nivel];
  const acento = nivel === 'EN_TERMINO' ? VERDE_EN_TERMINO : COLOR_NIVEL_TERMINO[nivel];
  const vencido = nivel === 'VENCIDO';

  const transcurridos = Math.max(0, PLAZO_DECISION_LICENCIA_DIAS_HABILES - Math.max(0, restantes));
  const porcentaje = Math.min(100, Math.round((transcurridos / PLAZO_DECISION_LICENCIA_DIAS_HABILES) * 100));

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
              {!vencido && ` · día ${transcurridos} de ${PLAZO_DECISION_LICENCIA_DIAS_HABILES}`}
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
