import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

/**
 * Panel Operativo Nivel 3B — radicado más crítico por KPI grande.
 *
 * Cada una de las 4 tarjetas grandes destaca el radicado que la
 * funcionaria debe perseguir primero dentro de ese grupo. La criticidad
 * cambia por grupo:
 *
 *   VENCIDAS   → el que lleva MÁS tiempo vencido (menor días restantes).
 *   POR_VENCER → el que vence PRIMERO (menor días restantes).
 *   RADICADAS  → el más ANTIGUO sin asignar (menor fechaRadicado).
 *   ASIGNADAS  → el más PRÓXIMO a vencer (menor días restantes).
 *
 * Función pura: recibe la lista completa, devuelve el destacado o null.
 * NUNCA expone el nombre del solicitante — solo id, dependencia y la
 * razón de criticidad — para respetar identidades reservadas (Comisaría
 * de Familia, anónimos) igual que el resto del sistema.
 */

export type FiltroGrande = 'VENCIDAS' | 'POR_VENCER' | 'RADICADAS' | 'ASIGNADAS';

export interface RadicadoCritico {
  radicadoId:  string;
  oficinaDestino: VentanillaRadicado['clasificacion']['oficinaDestino'];
  /** Texto corto de criticidad: "venció hace 3 d", "vence en 1 d", "hace 5 d". */
  razon:       string;
  /** Días restantes hábiles (negativo = vencido). Útil para color en la UI. */
  diasRestantes: number;
}

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);
const ESTADOS_ASIGNADOS = new Set<string>(['ASIGNADO', 'EN_REVISION', 'EN_PROCESO']);

function estaActivo(r: VentanillaRadicado): boolean {
  return !ESTADOS_RESUELTOS.has(r.estadoActual);
}

function dias(r: VentanillaRadicado, ahora: Date): number {
  // `ahora` debe llegar hasta el cálculo de hábiles: sin él, la función
  // usaría el reloj real e ignoraría la referencia inyectada.
  return diasRestantesHabiles(r.termino.fechaVencimiento, ahora);
}

/** Grupo de radicados que corresponde a cada KPI grande (mismos criterios que aplicarFiltroMIPG). */
function grupo(radicados: VentanillaRadicado[], filtro: FiltroGrande, ahora: Date): VentanillaRadicado[] {
  switch (filtro) {
    case 'VENCIDAS':
      return radicados.filter((r) => estaActivo(r) && dias(r, ahora) < 0);
    case 'POR_VENCER':
      return radicados.filter((r) => { const d = dias(r, ahora); return estaActivo(r) && d >= 0 && d <= 2; });
    case 'RADICADAS':
      return radicados.filter((r) => r.estadoActual === 'PENDIENTE');
    case 'ASIGNADAS':
      return radicados.filter((r) => ESTADOS_ASIGNADOS.has(r.estadoActual));
  }
}

function fechaRadicadoMs(r: VentanillaRadicado): number {
  const t = new Date(r.control.fechaRadicado).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function razonPorVencimiento(d: number): string {
  if (d < 0)  return `venció hace ${Math.abs(d)} d`;
  if (d === 0) return 'vence hoy';
  return `vence en ${d} d`;
}

function razonPorAntiguedad(r: VentanillaRadicado, ahora: Date): string {
  const ms = ahora.getTime() - new Date(r.control.fechaRadicado).getTime();
  const d = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  if (d === 0) return 'hoy';
  return `hace ${d} d`;
}

/**
 * Devuelve el radicado más crítico de un KPI grande, o null si el grupo
 * está vacío. `ahora` es inyectable para tests deterministas.
 */
export function radicadoMasCriticoPorFiltro(
  radicados: VentanillaRadicado[],
  filtro:    FiltroGrande,
  ahora:     Date = new Date(),
): RadicadoCritico | null {
  const items = grupo(radicados, filtro, ahora);
  if (items.length === 0) return null;

  let elegido: VentanillaRadicado;

  if (filtro === 'RADICADAS') {
    // Más antiguo sin asignar: menor fechaRadicado.
    elegido = items.reduce((a, b) => (fechaRadicadoMs(a) <= fechaRadicadoMs(b) ? a : b));
    return {
      radicadoId:     elegido.radicadoId,
      oficinaDestino: elegido.clasificacion.oficinaDestino,
      razon:          razonPorAntiguedad(elegido, ahora),
      diasRestantes:  dias(elegido, ahora),
    };
  }

  // VENCIDAS / POR_VENCER / ASIGNADAS: menor días restantes (más urgente).
  elegido = items.reduce((a, b) => (dias(a, ahora) <= dias(b, ahora) ? a : b));
  const d = dias(elegido, ahora);
  return {
    radicadoId:     elegido.radicadoId,
    oficinaDestino: elegido.clasificacion.oficinaDestino,
    razon:          razonPorVencimiento(d),
    diasRestantes:  d,
  };
}
