import Link from 'next/link';
import { ChipEstado } from './components/ChipEstado';
import { NumeroLegal } from './components/NumeroLegal';
import { TarjetaKPI } from './components/TarjetaKPI';
import { BotonAccionPlaceholder } from './components/BotonAccionPlaceholder';
import { filasBandeja, kpisBandeja, totalesUniverso } from './fixtures';
import { formatFechaColombia } from '@/lib/fecha-colombia';

export const metadata = {
  title: 'Bandeja de Licencias',
};

/**
 * Pantalla 01 · Bandeja de Licencias — Fase 2 (arranque, Tarea 5).
 *
 * Server Component: la tabla es de solo lectura sobre fixtures locales
 * (Fase 1, sin colección Firestore todavía — ver `fixtures.ts`). La única
 * pieza interactiva ("Radicar solicitud", "Exportar libro consecutivo") es
 * `BotonAccionPlaceholder`, aislada como Client Component.
 */
export default function BandejaLicenciasPage() {
  const filas = filasBandeja();
  const kpis = kpisBandeja(filas);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Secretaría de Planeación · Licencias Urbanísticas
          </p>
          <h1 className="font-headline text-2xl md:text-[28px] mt-1" style={{ color: 'var(--text-primary)' }}>
            Bandeja de Licencias
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Término legal: 45 días hábiles desde la radicación en debida forma · los históricos no cuentan en el semáforo.
          </p>
        </div>
        <div className="shrink-0">
          <BotonAccionPlaceholder label="Radicar solicitud →" variant="dorado" />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaKPI
          overline="Vencidas"
          valor={kpis.vencidas.length}
          tono="critico"
          detalle={
            kpis.masCritica ? (
              <div className="flex flex-col gap-0.5">
                <Link href={`/interno/licencias/${kpis.masCritica.id}`} className="focus-visible:outline-none focus-visible:ring-2 rounded w-fit">
                  <NumeroLegal value={kpis.masCritica.numeroExpediente} variant="expediente" size="sm" />
                </Link>
                <span>
                  venció hace {Math.abs(kpis.masCritica.diasRestantes ?? 0)} d hábiles
                </span>
              </div>
            ) : (
              'Sin expedientes vencidos'
            )
          }
        />
        <TarjetaKPI
          overline="Por vencer"
          valor={kpis.porVencer.length}
          tono="normal"
          detalle={
            kpis.masProxima ? (
              <div className="flex flex-col gap-0.5">
                <Link href={`/interno/licencias/${kpis.masProxima.id}`} className="focus-visible:outline-none focus-visible:ring-2 rounded w-fit">
                  <NumeroLegal value={kpis.masProxima.numeroExpediente} variant="expediente" size="sm" />
                </Link>
                <span>vence en {kpis.masProxima.diasRestantes} d hábiles</span>
              </div>
            ) : (
              'Sin expedientes por vencer'
            )
          }
        />
        <TarjetaKPI
          overline="En término"
          valor={kpis.enTermino.length}
          tono="exito"
          detalle={<span>Reinicios registrados este año: {kpis.reiniciosEsteAnio}</span>}
        />
      </div>

      {/* ── Tabla ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Th ancho={190}>Expediente</Th>
                <Th ancho={190}>Radicado origen</Th>
                <Th>Solicitante</Th>
                <Th ancho={120}>Modalidad</Th>
                <Th ancho={130}>Estado</Th>
                <Th ancho={130}>Vence</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const vencida = fila.estado === 'VENCIDO';
                return (
                  <tr key={fila.id} className="micro-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td
                      className="px-3 py-2.5 align-top"
                      style={{ borderLeft: `3px solid ${vencida ? '#DC2626' : 'transparent'}` }}
                    >
                      <Link href={`/interno/licencias/${fila.id}`} className="focus-visible:outline-none focus-visible:ring-2 rounded inline-flex items-center gap-1.5">
                        <NumeroLegal value={fila.numeroExpediente} variant="expediente" size="sm" />
                        {fila.colision && (
                          <span aria-hidden="true" title={fila.colision.detalle} className="text-amber-600">⚠</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <NumeroLegal value={fila.radicadoOrigen} variant="radicado" size="sm" />
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>
                      <p>{fila.solicitante}</p>
                      {fila.colision && (
                        <>
                          <p style={{ color: 'var(--text-secondary)' }}>{fila.colision.segundoSolicitante}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#9A6206' }} title={fila.colision.detalle}>
                            {fila.colision.nota}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>{fila.modalidad}</td>
                    <td className="px-3 py-2.5 align-top">
                      <ChipEstado estado={fila.estado} />
                    </td>
                    <td
                      className="px-3 py-2.5 align-top font-mono text-[13px]"
                      style={{ color: vencida ? '#DC2626' : 'var(--text-primary)', fontWeight: vencida ? 700 : 400 }}
                    >
                      {fila.origen === 'RECONSTRUIDO' ? (
                        '—'
                      ) : fila.estado === 'TERMINADO' && fila.resueltoEn ? (
                        `Resuelto ${formatFechaColombia(fila.resueltoEn)}`
                      ) : fila.vence ? (
                        <span className="inline-flex items-center gap-1">
                          {formatFechaColombia(fila.vence)}
                          {fila.politicaAmbigua && (
                            <span aria-hidden="true" title="Política de subsanación pendiente de concepto jurídico — ver detalle">⚖</span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pie ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <p>
          {totalesUniverso.activosReal} expedientes activos (REAL) · {totalesUniverso.historicosMigrados} históricos migrados excluidos del semáforo
        </p>
        <BotonAccionPlaceholder label="Exportar libro consecutivo ↓" variant="outline" />
      </div>
    </div>
  );
}

function Th({ children, ancho }: { children: React.ReactNode; ancho?: number }) {
  return (
    <th
      scope="col"
      className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-widest"
      style={{ color: 'var(--text-secondary)', width: ancho }}
    >
      {children}
    </th>
  );
}
