import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

/* ══════════════════════════════════════════════════════════════
   estadoTerminoServer — Helper PURO server-safe.

   Calcula estado del término y días restantes a partir de un
   radicado, SIN dependencias de React/Tailwind/cliente. Es la
   versión usable desde endpoints de Next.js sin arrastrar el
   componente client `SemaforoTermino`.

   La versión completa con clases visuales sigue viviendo en
   app/interno/dashboard/components/mipg/SemaforoTermino.tsx y se
   usa solo desde la UI.

   Defensa: si fechaVencimiento es inválida o falta, devuelve
   estado 'EN_TERMINO' con diasRestantes = 0 para no romper el
   reporte.
══════════════════════════════════════════════════════════════ */

export type EstadoTermino = 'EN_TERMINO' | 'POR_VENCER' | 'VENCIDO' | 'RESUELTO';

export interface EstadoTerminoData {
  estado:        EstadoTermino;
  diasRestantes: number;
}

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);

export function estadoTerminoServer(r: VentanillaRadicado): EstadoTerminoData {
  if (ESTADOS_RESUELTOS.has(r.estadoActual)) {
    return { estado: 'RESUELTO', diasRestantes: 0 };
  }
  const fechaVenc = r.termino?.fechaVencimiento;
  if (!fechaVenc) {
    return { estado: 'EN_TERMINO', diasRestantes: 0 };
  }
  let dias = 0;
  try {
    dias = diasRestantesHabiles(fechaVenc);
  } catch {
    return { estado: 'EN_TERMINO', diasRestantes: 0 };
  }
  if (!Number.isFinite(dias)) {
    return { estado: 'EN_TERMINO', diasRestantes: 0 };
  }
  if (dias < 0)  return { estado: 'VENCIDO',    diasRestantes: dias };
  if (dias <= 2) return { estado: 'POR_VENCER', diasRestantes: dias };
  return { estado: 'EN_TERMINO', diasRestantes: dias };
}
