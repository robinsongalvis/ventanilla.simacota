'use client';

import {
  clasificarFrenteAlTermino,
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
  /** ISO — desde cuándo corre. */
  desdeIso: string;
  estadoJuridico: EstadoJuridicoLicencia;
  expedienteId: string;
}

/** Qué hacer, por nivel. El color significa algo y el texto dice la acción. */
const MENSAJE: Record<'EN_TERMINO' | NivelTermino, { texto: string; fondo: string; borde: string; tinta: string }> = {
  EN_TERMINO: {
    texto: 'Sin riesgo hoy. La revisión técnica puede avanzar con calma.',
    fondo: '#E7F6EC', borde: '#116932', tinta: '#116932',
  },
  AVISO: {
    texto: 'Quedan pocos días para decidir. Si hay observaciones, el acta debe salir ya — es lo único que suspende el término.',
    fondo: '#FDF6E3', borde: '#D4A017', tinta: '#7A4F0A',
  },
  CRITICO: {
    texto: 'Quedan pocos días para decidir. Si hay observaciones, el acta debe salir ya — es lo único que suspende el término.',
    fondo: '#FDF6E3', borde: '#D4A017', tinta: '#7A4F0A',
  },
  VENCIDO: {
    /* La consecuencia con todas sus letras: el silencio administrativo POSITIVO
       de licencias concede por ley (D.1077/2015 art. 2.2.6.1.2.3.5). Suavizarlo
       sería ocultar el riesgo real que corre la Administración. */
    texto: 'Riesgo de silencio administrativo positivo — la licencia podría entenderse concedida por ley. Resolver de inmediato.',
    fondo: '#FEF2F2', borde: '#B42318', tinta: '#B42318',
  },
};

export function CabeceraTermino({ venceIso, desdeIso, estadoJuridico, expedienteId }: CabeceraTerminoProps) {
  const fila = clasificarFrenteAlTermino(
    { id: expedienteId, estadoJuridico, creadoEn: desdeIso, fechaAlertaConservadora: venceIso },
    new Date(),
  );

  /* Solo se pinta el semáforo cuando el término CORRE. Suspendido o resuelto
     tienen su propio tratamiento en el panel; inventarles un anillo diría que
     hay un reloj andando donde no lo hay. */
  if (fila.situacion !== 'CORRIENDO') return null;

  const restantes = fila.diasHabilesRestantes ?? diasRestantesHabiles(venceIso);
  const nivel = fila.nivel ?? 'EN_TERMINO';
  const m = MENSAJE[nivel];
  const vencido = nivel === 'VENCIDO';

  const transcurridos = Math.max(0, PLAZO_DECISION_LICENCIA_DIAS_HABILES - Math.max(0, restantes));
  const porcentaje = Math.min(100, Math.round((transcurridos / PLAZO_DECISION_LICENCIA_DIAS_HABILES) * 100));

  const R = 30;
  const circunferencia = 2 * Math.PI * R;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${m.borde}` }}>
      <div className="p-4 flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
          Término para resolver
        </p>

        <div className="flex items-center gap-4">
          {/* ANILLO: los días restantes en grande y el avance del término. */}
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden className="shrink-0">
            <circle cx="36" cy="36" r={R} fill="none" stroke="var(--bg-surface-2)" strokeWidth="7" />
            <circle
              cx="36" cy="36" r={R} fill="none" stroke={m.borde} strokeWidth="7" strokeLinecap="round"
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
                : nivel === 'EN_TERMINO' ? 'En término' : 'Por vencer'}
            </p>
            <p className="font-headline text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              {vencido ? 'Venció el' : 'Vence el'} {formatFechaColombia(venceIso)}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {vencido ? 'Corría' : 'Corre'} desde el {formatFechaColombia(desdeIso)}
              {!vencido && ` · día ${transcurridos} de ${PLAZO_DECISION_LICENCIA_DIAS_HABILES}`}
            </p>
          </div>
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-2)' }}>
          <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, background: m.borde }} />
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
