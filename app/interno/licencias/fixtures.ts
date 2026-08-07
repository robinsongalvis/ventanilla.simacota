/**
 * Fixtures de la Bandeja y el Detalle de Licencias — Fase 2 (arranque,
 * Tarea 5). NO hay colección Firestore de expedientes todavía (Fase 1); los
 * datos de esta pantalla son locales A PROPÓSITO.
 *
 * Lo que SÍ es real: cada cifra de término, vencimiento y número de
 * expediente que se muestra en pantalla sale de llamar al motor real
 * (`lib/motor-expedientes/termino.ts`, `lib/motor-expedientes/
 * numero-expediente.ts`, `lib/tiempos-radicado.ts`) sobre una serie de
 * `Actuacion[]` de juguete — nunca se hardcodea una fecha de vencimiento ya
 * calculada. Esto es deliberado: cuando Fase 3 conecte una colección
 * Firestore real, el único cambio en esta capa de presentación es de dónde
 * vienen las `Actuacion[]`, no cómo se calculan las fechas.
 */

import {
  calcularVencimiento,
  derivarEventosTermino,
  type EventoTermino,
  type PoliticaTermino,
} from '@/lib/motor-expedientes/termino';
import { formatearNumeroExpediente, type CodigosExpediente } from '@/lib/motor-expedientes/numero-expediente';
import { atLocalNoon, diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import type { Actuacion } from '@/lib/motor-expedientes/tipos';
import type { DetalleLicencia, EstadoLicenciaUI, EventoTimelineItem, FilaLicencia } from './tipos';

/* ──────────────────────────────────────────────
   Constantes del régimen — Decreto 1077 (licencias urbanísticas),
   Secretaría de Planeación. `codigoDane`/`codigoCuraduria` son los mismos
   que ya declara el tenant real `SEC_PLANEACION`
   (`src/types/reglas-negocio.ts`) — no se inventan aquí.
────────────────────────────────────────────── */

const CODIGOS: CodigosExpediente = { codigoDane: '68745', codigoCuraduria: '0' };
const PLAZO_DIAS = 45;

const POLITICA_REINICIO_A_CERO: PoliticaTermino = {
  plazoDias: PLAZO_DIAS,
  computo: 'HABILES',
  efectoSubsanacion: 'REINICIO_A_CERO',
  anclaje: 'RADICACION_EN_DEBIDA_FORMA',
};
const POLITICA_SUSPENSION_REANUDACION: PoliticaTermino = {
  plazoDias: PLAZO_DIAS,
  computo: 'HABILES',
  efectoSubsanacion: 'SUSPENSION_REANUDACION',
  anclaje: 'RADICACION_EN_DEBIDA_FORMA',
};

/**
 * Umbral "por vencer" — SUPUESTO EXPLÍCITO (Principio 13): no hay guía
 * operativa todavía para el semáforo de licencias (45 días hábiles), a
 * diferencia del semáforo general de PQRSD (2 días, `calcularMetricas`,
 * `app/interno/dashboard/page.tsx`) que sí está validado con la
 * funcionaria. 5 días hábiles es una extrapolación proporcional al plazo
 * mayor; se declara aquí para que sea fácil de corregir cuando exista
 * validación con Planeación, sin que la cifra quede escondida en JSX.
 */
export const UMBRAL_POR_VENCER_DIAS_HABILES = 5;

/* ──────────────────────────────────────────────
   Helpers de fecha — ancla a las 12:00 UTC (~07:00 Bogotá). Nunca cae en
   medianoche UTC, así que el día civil de Bogotá coincide siempre con
   (año, mes, día) tal como se escriben abajo, sin depender de la zona
   horaria de la máquina que ejecuta el build (mismo cuidado de RS-1).
────────────────────────────────────────────── */

function fechaAncla(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function actuacion(
  id: string,
  expedienteId: string,
  tipo: string,
  [y, m, d]: [number, number, number],
  origen: Actuacion['origen'] = 'REAL',
  detalle?: string,
): Actuacion {
  return {
    id,
    expedienteId,
    tipo,
    etapa: tipo,
    actorUid: 'fixture-fase1',
    actorNombre: 'Dato de ejemplo (Fase 1 — sin colección real)',
    actorRol: 'FUNCIONARIO',
    fecha: fechaAncla(y, m, d).toISOString(),
    origen,
    detalle,
  };
}

function bucketPorDias(dias: number): 'EN_TERMINO' | 'POR_VENCER' | 'VENCIDO' {
  if (dias < 0) return 'VENCIDO';
  if (dias <= UMBRAL_POR_VENCER_DIAS_HABILES) return 'POR_VENCER';
  return 'EN_TERMINO';
}

interface Proyeccion {
  eventos: EventoTermino[];
  reinicio: Date | null;
  suspension: Date | null;
  /** `true` cuando las dos políticas divergen — la política real está pendiente de concepto jurídico. */
  ambiguo: boolean;
  /** La más próxima de las dos (conservadora): nunca deja a la funcionaria con menos margen del que el sistema le advirtió. */
  vigente: Date | null;
}

/**
 * Proyecta el vencimiento bajo AMBAS políticas (`calcularVencimiento`,
 * `lib/motor-expedientes/termino.ts`) — la UI de licencias NUNCA asume cuál
 * aplica (ver `AvisoPoliticaSubsanacion`). Cuando divergen, `vigente` toma
 * la MÁS PRÓXIMA de las dos para el semáforo/KPIs compactos: mostrar una
 * fecha más lejana de la real dejaría a la funcionaria con menos margen del
 * que el sistema le advirtió, el error más costoso de los dos.
 */
function proyectarVencimiento(actuaciones: Actuacion[]): Proyeccion {
  const eventos = derivarEventosTermino(actuaciones);
  const reinicio = calcularVencimiento(eventos, POLITICA_REINICIO_A_CERO);
  const suspension = calcularVencimiento(eventos, POLITICA_SUSPENSION_REANUDACION);
  const ambiguo = !!(reinicio && suspension && reinicio.getTime() !== suspension.getTime());
  const vigente = ambiguo
    ? new Date(Math.min(reinicio!.getTime(), suspension!.getTime()))
    : (reinicio ?? suspension);
  return { eventos, reinicio, suspension, ambiguo, vigente };
}

/* ──────────────────────────────────────────────
   Definición de los fixtures
────────────────────────────────────────────── */

interface FixtureExpediente {
  id: string;
  numeroConsecutivo: number;
  fechaNumero: Date;
  radicadoOrigen: string;
  solicitante: string;
  modalidad: string;
  predio: string;
  subtipos: string[];
  actuaciones: Actuacion[];
  origen: 'REAL' | 'RECONSTRUIDO';
  /** Estados de flujo que NO dependen del reloj de término — pisan el semáforo por fecha. */
  estadoManual?: 'ASIGNADO' | 'TERMINADO';
  resueltoEn?: Date;
  colision?: FilaLicencia['colision'];
}

const FIXTURES: FixtureExpediente[] = [
  {
    id: 'lic-0012',
    numeroConsecutivo: 12,
    fechaNumero: fechaAncla(2026, 4, 6),
    radicadoOrigen: '1-110-202604-00000037',
    solicitante: 'CARLOS ALBERTO ROJAS MANTILLA',
    modalidad: 'LC',
    predio: 'Predio rural "La Esperanza", vereda El Hato',
    subtipos: ['LC · Construcción'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0012-1', 'lic-0012', 'radicacion-debida-forma', [2026, 4, 6]),
    ],
  },
  {
    id: 'lic-0015',
    numeroConsecutivo: 15,
    fechaNumero: fechaAncla(2026, 5, 28),
    radicadoOrigen: '1-110-202605-00000058',
    solicitante: 'SANDRA MILENA OSORIO PEÑA',
    modalidad: 'LC, PH',
    predio: 'Cra 4 # 6-18, Barrio Centro',
    subtipos: ['LC · Construcción', 'PH · Prop. horizontal'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0015-1', 'lic-0015', 'radicacion-debida-forma', [2026, 5, 28]),
    ],
  },
  {
    id: 'lic-0021',
    numeroConsecutivo: 21,
    fechaNumero: fechaAncla(2026, 6, 3),
    radicadoOrigen: '1-110-202606-00000012',
    solicitante: 'JAIRO HUMBERTO VILLAMIZAR CORREA',
    modalidad: 'PH',
    predio: 'Cll 3 # 5-40, Barrio San José',
    subtipos: ['PH · Prop. horizontal'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0021-1', 'lic-0021', 'radicacion-debida-forma', [2026, 6, 3]),
    ],
  },
  {
    id: 'lic-0023',
    numeroConsecutivo: 23,
    fechaNumero: fechaAncla(2026, 6, 8),
    radicadoOrigen: '1-110-202606-00000031',
    solicitante: 'LUZ DARY AMAYA GÓMEZ',
    modalidad: 'LC',
    predio: 'Vereda Guamalito, finca "El Recreo"',
    subtipos: ['LC · Construcción'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0023-1', 'lic-0023', 'radicacion-debida-forma', [2026, 6, 8]),
    ],
  },
  {
    id: 'lic-0029',
    numeroConsecutivo: 29,
    fechaNumero: fechaAncla(2026, 7, 13),
    radicadoOrigen: '1-110-202607-00000009',
    solicitante: 'INVERSIONES YARIGUÍES S.A.S.',
    modalidad: 'LC',
    predio: 'Cra 7 # 12-05, Barrio El Progreso',
    subtipos: ['LC · Construcción'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0029-1', 'lic-0029', 'radicacion-debida-forma', [2026, 7, 13]),
    ],
  },
  {
    id: 'lic-0031',
    numeroConsecutivo: 31,
    fechaNumero: fechaAncla(2026, 8, 3),
    radicadoOrigen: '1-110-202608-00000003',
    solicitante: 'FABIÁN RICARDO NIÑO CÁCERES',
    modalidad: 'LC',
    predio: 'Vereda La Cristalina, finca "Buenavista"',
    subtipos: ['LC · Construcción'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0031-1', 'lic-0031', 'radicacion-debida-forma', [2026, 8, 3]),
    ],
  },
  {
    // Ejemplar de la Pantalla 02 (spec: "68745-0-26-0017") — el único fixture
    // con historial de subsanación, para que el aviso ⚖️ muestre una
    // divergencia REAL entre REINICIO_A_CERO y SUSPENSION_REANUDACION.
    id: 'lic-0017',
    numeroConsecutivo: 17,
    fechaNumero: fechaAncla(2026, 6, 1),
    radicadoOrigen: '1-110-202606-00000004',
    solicitante: 'MARTHA LUCÍA SUÁREZ DELGADO',
    modalidad: 'LC, PH',
    predio: 'Cra 6 # 9-31, Barrio Los Almendros',
    subtipos: ['LC · Construcción', 'PH · Prop. horizontal'],
    origen: 'REAL',
    actuaciones: [
      actuacion('a-0017-1', 'lic-0017', 'radicacion-debida-forma', [2026, 6, 1]),
      actuacion('a-0017-2', 'lic-0017', 'acta-observaciones', [2026, 7, 1], 'REAL', 'Observaciones sobre planos estructurales y cesión de andén.'),
      actuacion('a-0017-3', 'lic-0017', 'respuesta-subsanacion', [2026, 7, 20], 'REAL', 'Solicitante aporta planos corregidos y escritura de cesión.'),
    ],
  },
  {
    id: 'lic-0018',
    numeroConsecutivo: 18,
    fechaNumero: fechaAncla(2026, 7, 20),
    radicadoOrigen: '1-110-202607-00000021',
    solicitante: 'PEDRO JOSÉ MEDINA TARAZONA',
    modalidad: 'LC',
    predio: 'Cra 9 # 3-14, Barrio El Rosario',
    subtipos: ['LC · Construcción'],
    origen: 'REAL',
    estadoManual: 'ASIGNADO',
    actuaciones: [
      actuacion('a-0018-1', 'lic-0018', 'radicacion-debida-forma', [2026, 7, 20]),
    ],
  },
  {
    id: 'lic-0008',
    numeroConsecutivo: 8,
    fechaNumero: fechaAncla(2026, 5, 4),
    radicadoOrigen: '1-110-202605-00000002',
    solicitante: 'GLORIA INÉS CADENA RUEDA',
    modalidad: 'PH',
    predio: 'Cll 7 # 2-09, Barrio Centro',
    subtipos: ['PH · Prop. horizontal'],
    origen: 'REAL',
    estadoManual: 'TERMINADO',
    resueltoEn: fechaAncla(2026, 6, 25),
    actuaciones: [
      actuacion('a-0008-1', 'lic-0008', 'radicacion-debida-forma', [2026, 5, 4]),
    ],
  },

  /* ── Históricos migrados (origen RECONSTRUIDO) — R9: sus actuaciones se
     excluyen del cómputo de término (`derivarEventosTermino`), nunca
     entran al semáforo ni a las alertas. ── */
  {
    id: 'lic-h-0037',
    numeroConsecutivo: 37,
    fechaNumero: fechaAncla(2025, 9, 10),
    radicadoOrigen: 'Expediente físico (pre-digital) — sin radicado Ventanilla',
    solicitante: 'MARIA DEL ROSARIO DUARTE JAIME (LA)',
    modalidad: 'LA, LR',
    predio: 'Sin predio digitalizado — pendiente de depuración de migración',
    subtipos: ['LA · Ampliación', 'LR · Reconocimiento'],
    origen: 'RECONSTRUIDO',
    colision: {
      nota: '(2 solicitantes · colisión)',
      segundoSolicitante: 'MYRIAM CALA RODRIGUEZ (LR)',
      detalle: 'MARIA DEL ROSARIO DUARTE JAIME (LA) y MYRIAM CALA RODRIGUEZ (LR) comparten este número en el archivo físico migrado. Nunca se renumera (R9): renumerar un expediente migrado falsearía la trazabilidad del archivo físico que representa.',
    },
    actuaciones: [
      actuacion('a-h0037-1', 'lic-h-0037', 'radicacion-debida-forma', [2025, 9, 10], 'RECONSTRUIDO'),
    ],
  },
  {
    id: 'lic-h-0089',
    numeroConsecutivo: 89,
    fechaNumero: fechaAncla(2024, 11, 3),
    radicadoOrigen: '1-110-2024-00000512',
    solicitante: 'JORGE ELIÉCER PABÓN NIÑO',
    modalidad: 'LC',
    predio: 'Cra 5 # 8-22, Barrio Centro',
    subtipos: ['LC · Construcción'],
    origen: 'RECONSTRUIDO',
    actuaciones: [
      actuacion('a-h0089-1', 'lic-h-0089', 'radicacion-debida-forma', [2024, 11, 3], 'RECONSTRUIDO'),
    ],
  },
  {
    id: 'lic-h-0156',
    numeroConsecutivo: 156,
    fechaNumero: fechaAncla(2023, 9, 20),
    radicadoOrigen: '1-110-2023-00000298',
    solicitante: 'CONSTRUCTORA SIMACOTA S.A.S.',
    modalidad: 'PH',
    predio: 'Cll 10 # 4-15, Barrio La Esperanza',
    subtipos: ['PH · Prop. horizontal'],
    origen: 'RECONSTRUIDO',
    actuaciones: [
      actuacion('a-h0156-1', 'lic-h-0156', 'radicacion-debida-forma', [2023, 9, 20], 'RECONSTRUIDO'),
    ],
  },
];

/* ──────────────────────────────────────────────
   Derivación — fila de bandeja
────────────────────────────────────────────── */

function construirFila(fx: FixtureExpediente): FilaLicencia {
  const numeroExpediente = formatearNumeroExpediente(fx.numeroConsecutivo, fx.fechaNumero, CODIGOS);

  if (fx.origen === 'RECONSTRUIDO') {
    return {
      id: fx.id,
      numeroExpediente,
      radicadoOrigen: fx.radicadoOrigen,
      solicitante: fx.solicitante,
      modalidad: fx.modalidad,
      estado: 'HISTORICO',
      vence: null,
      diasRestantes: null,
      politicaAmbigua: false,
      origen: 'RECONSTRUIDO',
      colision: fx.colision,
    };
  }

  const { vigente, ambiguo } = proyectarVencimiento(fx.actuaciones);
  const diasRestantes = vigente ? diasRestantesHabiles(vigente) : null;
  const estado: EstadoLicenciaUI = fx.estadoManual ?? (diasRestantes != null ? bucketPorDias(diasRestantes) : 'EN_TERMINO');

  return {
    id: fx.id,
    numeroExpediente,
    radicadoOrigen: fx.radicadoOrigen,
    solicitante: fx.solicitante,
    modalidad: fx.modalidad,
    estado,
    vence: fx.estadoManual === 'TERMINADO' ? null : vigente,
    diasRestantes,
    politicaAmbigua: ambiguo,
    origen: 'REAL',
    resueltoEn: fx.resueltoEn,
  };
}

export function filasBandeja(): FilaLicencia[] {
  const reales = FIXTURES.filter((f) => f.origen === 'REAL').map(construirFila);
  const historicas = FIXTURES.filter((f) => f.origen === 'RECONSTRUIDO').map(construirFila);

  const severidad: Record<EstadoLicenciaUI, number> = {
    VENCIDO: 0,
    POR_VENCER: 1,
    EN_TERMINO: 2,
    ASIGNADO: 3,
    TERMINADO: 4,
    HISTORICO: 5,
  };
  reales.sort((a, b) => {
    const diff = severidad[a.estado] - severidad[b.estado];
    if (diff !== 0) return diff;
    return (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0);
  });

  // Los históricos van al final: son archivo migrado, no trabajo activo.
  return [...reales, ...historicas];
}

/* ──────────────────────────────────────────────
   KPIs de la bandeja
────────────────────────────────────────────── */

export interface KpisBandeja {
  vencidas: FilaLicencia[];
  porVencer: FilaLicencia[];
  enTermino: FilaLicencia[];
  masCritica: FilaLicencia | null;
  masProxima: FilaLicencia | null;
  /** Actas de observaciones (evento que dispara reinicio/suspensión) registradas en el año civil de Bogotá vigente. */
  reiniciosEsteAnio: number;
}

export function kpisBandeja(filas: FilaLicencia[]): KpisBandeja {
  const activas = filas.filter((f) => f.origen === 'REAL');
  const vencidas = activas.filter((f) => f.estado === 'VENCIDO');
  const porVencer = activas.filter((f) => f.estado === 'POR_VENCER');
  const enTermino = activas.filter((f) => f.estado === 'EN_TERMINO');

  const masCritica = vencidas.reduce<FilaLicencia | null>(
    (peor, f) => (!peor || (f.diasRestantes ?? 0) < (peor.diasRestantes ?? 0) ? f : peor),
    null,
  );
  const masProxima = porVencer.reduce<FilaLicencia | null>(
    (prox, f) => (!prox || (f.diasRestantes ?? Infinity) < (prox.diasRestantes ?? Infinity) ? f : prox),
    null,
  );

  const anioVigente = atLocalNoon(new Date()).getFullYear();
  const reiniciosEsteAnio = FIXTURES
    .flatMap((fx) => fx.actuaciones)
    .filter((a) => a.origen === 'REAL' && a.tipo === 'acta-observaciones')
    .filter((a) => atLocalNoon(a.fecha).getFullYear() === anioVigente)
    .length;

  return { vencidas, porVencer, enTermino, masCritica, masProxima, reiniciosEsteAnio };
}

/* ──────────────────────────────────────────────
   Detalle de expediente (Pantalla 02)
────────────────────────────────────────────── */

const TITULO_ACTUACION: Record<string, string> = {
  'radicacion-debida-forma': 'Radicación en debida forma',
  'acta-observaciones': 'Acta de observaciones',
  'respuesta-subsanacion': 'Respuesta de subsanación',
  'modificacion-solicitud': 'Modificación de la solicitud',
};

const TIPO_TIMELINE: Record<string, EventoTimelineItem['tipo']> = {
  'radicacion-debida-forma': 'RADICACION',
  'acta-observaciones': 'ACTA',
  'respuesta-subsanacion': 'SUBSANACION',
  'modificacion-solicitud': 'SUBSANACION',
};

function construirTimeline(fx: FixtureExpediente, vigente: Date | null): EventoTimelineItem[] {
  const items: EventoTimelineItem[] = fx.actuaciones
    .slice()
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .map((a) => ({
      tipo: TIPO_TIMELINE[a.tipo] ?? 'SUBSANACION',
      titulo: TITULO_ACTUACION[a.tipo] ?? a.tipo,
      meta: a.detalle ? `${formatFechaColombia(a.fecha)} · ${a.detalle}` : formatFechaColombia(a.fecha),
    }));

  if (fx.origen === 'REAL' && vigente) {
    items.push({
      tipo: 'VENCIMIENTO_CALCULADO',
      titulo: `Vencimiento calculado: ${formatFechaColombia(vigente)}`,
      meta: 'Proyección, nunca almacenado — se recalcula en cada consulta a partir de los hechos anteriores.',
    });
  }

  return items;
}

export function detalleLicencia(id: string): DetalleLicencia | null {
  const fx = FIXTURES.find((f) => f.id === id);
  if (!fx) return null;

  const fila = construirFila(fx);

  if (fx.origen === 'RECONSTRUIDO') {
    return {
      fila,
      predio: fx.predio,
      subtipos: fx.subtipos,
      timeline: construirTimeline(fx, null),
    };
  }

  const { eventos, vigente, ambiguo } = proyectarVencimiento(fx.actuaciones);
  const radicacion = fx.actuaciones.find((a) => a.tipo === 'radicacion-debida-forma');

  return {
    fila,
    predio: fx.predio,
    subtipos: fx.subtipos,
    timeline: construirTimeline(fx, vigente),
    proyeccion: vigente
      ? {
          plazoDias: PLAZO_DIAS,
          eventos,
          vigente,
          diasRestantes: diasRestantesHabiles(vigente),
          ancla: atLocalNoon(radicacion!.fecha),
        }
      : undefined,
  };
}

export { proyectarVencimiento };
export const totalesUniverso = {
  /** Universo completo del sistema (no solo la muestra renderizada en esta bandeja) — cifra declarada por Planeación, ver pie de la Pantalla 01. */
  activosReal: 21,
  historicosMigrados: 132,
};
