import { formatFechaColombia } from '@/lib/fecha-colombia';
import { esErrorVigencia } from '@/lib/motor-expedientes/vigencias';
import type { VigenciaUI } from '../tipos-computos';

/**
 * Panel de vigencia del acto — Bloque "Términos y vigencias protectores"
 * (10-ago-2026). Consume `computos.vigencia` YA CALCULADO por el servidor
 * (`calcularVencimientoVigencia`, `lib/motor-expedientes/vigencias.ts`) —
 * este componente NO decide la regla ni el régimen, solo la presenta.
 *
 * El caller (`DetalleLicenciaClient`) es responsable de NO renderizar este
 * panel cuando `computos.vigencia === undefined` (expediente sin
 * `actoFinal.fechaFirmeza`, es decir, no está en firme) — a este componente
 * siempre le llega un `vigencia` presente: éxito o error de selección de
 * regla.
 */
export function PanelVigenciaActo({ vigencia }: { vigencia: VigenciaUI }) {
  if (esErrorVigencia(vigencia)) {
    const mensaje =
      vigencia.codigo === 'MODALIDAD_REQUERIDA'
        ? 'No se puede calcular la vigencia: falta la modalidad de construcción.'
        : vigencia.mensaje;
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          Vigencia del acto
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          {mensaje}
        </p>
      </div>
    );
  }

  const { vencimiento, configAplicada } = vigencia;
  const prorrogable = !configAplicada.improrrogable && Boolean(configAplicada.prorroga);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        Vigencia del acto
      </p>
      <p className="font-black mt-1" style={{ fontSize: 20, color: 'var(--text-primary)' }}>
        Vence el {formatFechaColombia(vencimiento)}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {configAplicada.meses} meses desde la firmeza del acto
        {prorrogable
          ? ` · Prorrogable una vez (+${configAplicada.prorroga!.meses} meses)`
          : ' · No admite prórroga'}
      </p>
    </div>
  );
}
