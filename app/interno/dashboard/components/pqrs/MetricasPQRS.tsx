import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export interface MetricasPQRSData {
  radicadas: number;
  asignadas: number;
  porVencer: number;
  vencidas: number;
  devueltasProrrogas: number;
}

export function calcularMetricasPQRS(radicados: VentanillaRadicado[]): MetricasPQRSData {
  return radicados.reduce<MetricasPQRSData>((acc, radicado) => {
    const restantes = diasRestantesHabiles(radicado.termino.fechaVencimiento);

    if (radicado.estadoActual === 'PENDIENTE') acc.radicadas += 1;
    if (radicado.estadoActual === 'ASIGNADO' || radicado.estadoActual === 'EN_REVISION' || radicado.estadoActual === 'EN_PROCESO') acc.asignadas += 1;
    if (restantes >= 0 && restantes <= 2 && !['RESUELTO', 'RECHAZADO'].includes(radicado.estadoActual)) acc.porVencer += 1;
    if (restantes < 0 && !['RESUELTO', 'RECHAZADO'].includes(radicado.estadoActual)) acc.vencidas += 1;
    if (radicado.estadoActual === 'DEVUELTO' || radicado.estadoActual === 'PRORROGA') acc.devueltasProrrogas += 1;

    return acc;
  }, {
    radicadas: 0,
    asignadas: 0,
    porVencer: 0,
    vencidas: 0,
    devueltasProrrogas: 0,
  });
}

export function MetricasPQRS({ metricas }: { metricas: MetricasPQRSData }) {
  const items = [
    { label: 'Radicadas', value: metricas.radicadas, tone: 'border-indigo-500 text-indigo-300' },
    { label: 'Asignadas', value: metricas.asignadas, tone: 'border-sky-500 text-sky-300' },
    { label: 'Por vencer', value: metricas.porVencer, tone: 'border-amber-500 text-amber-300' },
    { label: 'Vencidas', value: metricas.vencidas, tone: 'border-rose-500 text-rose-300' },
    { label: 'Devueltas / prorrogas', value: metricas.devueltasProrrogas, tone: 'border-slate-500 text-slate-300' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className={`rounded-lg border-l-4 border-t border-r border-b bg-slate-900/40 p-4 ${item.tone}`}>
          <p className="text-2xl font-black leading-none text-slate-50">{item.value}</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

