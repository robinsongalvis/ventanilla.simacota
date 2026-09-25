import { calcularVencimiento, type EventoTermino, type PoliticaTermino } from '@/lib/motor-expedientes/termino';
import { formatFechaColombia } from '@/lib/fecha-colombia';

/**
 * Aviso ⚖️ del panel término (Pantalla 02) — mientras Jurídica no emita el
 * concepto escrito sobre qué `efectoSubsanacion` aplica a licencias
 * urbanísticas (Decreto 1077), la UI NUNCA elige una política por su
 * cuenta: llama a `calcularVencimiento` (`lib/motor-expedientes/termino.ts`)
 * DOS VECES sobre los MISMOS eventos — una vez por política — y muestra
 * ambas fechas. Ninguna de las dos se presenta como "la" fecha correcta.
 *
 * Esto consume el motor real, no reimplementa el cómputo: el componente
 * solo arma las dos `PoliticaTermino` y formatea el resultado.
 */
export function AvisoPoliticaSubsanacion({
  eventos,
  plazoDias,
}: {
  eventos: EventoTermino[];
  plazoDias: number;
}) {
  const reinicioACero: PoliticaTermino = {
    plazoDias,
    computo: 'HABILES',
    efectoSubsanacion: 'REINICIO_A_CERO',
    anclaje: 'RADICACION_EN_DEBIDA_FORMA',
  };
  const suspensionReanudacion: PoliticaTermino = {
    plazoDias,
    computo: 'HABILES',
    efectoSubsanacion: 'SUSPENSION_REANUDACION',
    anclaje: 'RADICACION_EN_DEBIDA_FORMA',
  };

  const vReinicio = calcularVencimiento(eventos, reinicioACero);
  const vSuspension = calcularVencimiento(eventos, suspensionReanudacion);

  return (
    <div
      role="note"
      aria-label="Aviso: política de subsanación pendiente de concepto jurídico"
      className="rounded-xl p-3.5 flex gap-2.5"
      style={{ background: '#FDF2E2', border: '1px solid rgba(217,119,6,0.30)' }}
    >
      <span aria-hidden="true" className="text-base leading-none">⚖️</span>
      <p className="text-[13px] leading-relaxed" style={{ color: '#7A4F0A' }}>
        <strong>Política de subsanación: PENDIENTE DE JURÍDICA</strong> — Si{' '}
        <strong>REINICIO A CERO</strong> → vence{' '}
        <span className="font-mono font-semibold">
          {vReinicio ? formatFechaColombia(vReinicio) : '—'}
        </span>{' '}
        · Si <strong>SUSPENSIÓN</strong> → vence{' '}
        <span className="font-mono font-semibold">
          {vSuspension ? formatFechaColombia(vSuspension) : '—'}
        </span>
        . El sistema muestra ambas hasta el concepto escrito.
      </p>
    </div>
  );
}
