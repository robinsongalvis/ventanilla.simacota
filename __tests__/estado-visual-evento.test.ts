import { describe, expect, it } from 'vitest';
import {
  construirEventosVisuales,
  estadoVisualDeTipo,
  ESTADOS_VISUALES,
  type EstadoVisual,
} from '@/app/interno/licencias/estado-visual-evento';
import type { EventoTimelineItem } from '@/app/interno/licencias/tipos';

/* ══════════════════════════════════════════════════════════════
   CAPA DE ESTADO VISUAL — presentación PURA, independiente del cálculo
   jurídico. Traduce la ESPECIE de la actuación (`tipo`) a un ESTADO VISUAL, y
   —cuando hay contexto y el expediente sigue en trámite— marca la fase ACTUAL
   como «en curso», reutilizando `situacionDePaso` (no una máquina paralela).

   ── ALCANCE (ADR-0033 §4.6-bis) ──────────────────────────────────────────
   Esto MIRA: que el color salga del ESTADO y no del tipo; que la proyección de
   vencimiento sea `projected`; que el acta sea `warning`; que se inserte UN
   evento «en curso» solo si el expediente sigue en trámite, antes de la
   proyección; y que un expediente resuelto NO lo tenga.
   Esto NO MIRA: términos, fechas, anclas, suspensiones — nada de eso se toca.
══════════════════════════════════════════════════════════════ */

function evento(tipo: EventoTimelineItem['tipo'], ocurrioEn?: string): EventoTimelineItem {
  return { tipo, titulo: `t-${tipo}`, meta: 'm', ocurrioEn };
}

describe('estadoVisualDeTipo — el color sale del estado, no de la especie', () => {
  it('la proyección de vencimiento es projected; el acta es warning; el resto, completed', () => {
    expect(estadoVisualDeTipo('VENCIMIENTO_CALCULADO')).toBe('projected');
    expect(estadoVisualDeTipo('ACTA')).toBe('warning');
    for (const tipo of ['APERTURA', 'RADICACION', 'COMPLETITUD', 'SUBSANACION', 'COMUNICACION', 'DOCUMENTO'] as const) {
      expect(estadoVisualDeTipo(tipo)).toBe('completed');
    }
  });

  it('hechos de distinta ESPECIE comparten estado si comparten situación (independiente del tipo)', () => {
    // Una comunicación y una radicación —especies distintas— son ambas hechos
    // cumplidos: mismo estado visual. Ese es el objetivo del cambio.
    expect(estadoVisualDeTipo('COMUNICACION')).toBe(estadoVisualDeTipo('RADICACION'));
  });
});

describe('construirEventosVisuales — sin contexto', () => {
  it('no inventa el evento «en curso» y respeta el orden que recibe', () => {
    const eventos = [evento('APERTURA', '2026-09-01T08:00:00Z'), evento('VENCIMIENTO_CALCULADO')];
    const visuales = construirEventosVisuales(eventos);
    expect(visuales).toHaveLength(2);
    expect(visuales.some((e) => e.esActual)).toBe(false);
    expect(visuales[0]!.estadoVisual).toBe('completed');
    expect(visuales[1]!.estadoVisual).toBe('projected');
  });
});

describe('construirEventosVisuales — con contexto, expediente EN TRÁMITE', () => {
  const eventos = [
    evento('APERTURA', '2026-09-01T08:00:00Z'),
    evento('RADICACION', '2026-09-01T12:00:00Z'),
    evento('VENCIMIENTO_CALCULADO'),
  ];

  it('inserta UN evento «en curso» (la fase actual del camino) ANTES de la proyección', () => {
    const visuales = construirEventosVisuales(eventos, { estado: 'EN_REVISION' });
    const actuales = visuales.filter((e) => e.esActual);
    expect(actuales).toHaveLength(1);
    expect(actuales[0]!.estadoVisual).toBe('in_progress');
    // La fase actual de EN_REVISION es «Revisión y decisión» (paso 4).
    expect(actuales[0]!.titulo).toBe('Revisión y decisión');

    // Va justo antes de la proyección, nunca después.
    const idxActual = visuales.findIndex((e) => e.esActual);
    const idxProy = visuales.findIndex((e) => e.estadoVisual === 'projected');
    expect(idxActual).toBeLessThan(idxProy);
    // Y después de todos los hechos reales (radicación incluida).
    expect(idxActual).toBeGreaterThan(visuales.findIndex((e) => e.titulo === 't-RADICACION'));
  });

  it('«en curso desde» usa la fecha del último HECHO real, no una fecha calculada', () => {
    const visuales = construirEventosVisuales(eventos, { estado: 'EN_REVISION' });
    const actual = visuales.find((e) => e.esActual)!;
    // La radicación (01/09) es el hecho más reciente; el texto la cita.
    expect(actual.cuando).toMatch(/En curso desde/i);
    expect(actual.cuando).toContain('2026');
  });

  it('sin proyección, el evento «en curso» queda al final', () => {
    const sinProy = [evento('APERTURA', '2026-09-01T08:00:00Z')];
    const visuales = construirEventosVisuales(sinProy, { estado: 'EN_REVISION' });
    expect(visuales.at(-1)!.esActual).toBe(true);
  });
});

describe('construirEventosVisuales — expediente RESUELTO o histórico: sin «en curso»', () => {
  const eventos = [evento('RADICACION', '2026-09-01T12:00:00Z')];

  it('un expediente CONCEDIDA/EN_FIRME no muestra «en curso» (ya no está en trámite)', () => {
    for (const estado of ['CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME'] as const) {
      const visuales = construirEventosVisuales(eventos, { estado });
      expect(visuales.some((e) => e.esActual), `${estado} no debe tener «en curso»`).toBe(false);
    }
  });

  it('un histórico migrado tampoco', () => {
    const visuales = construirEventosVisuales(eventos, { estado: 'HISTORICO_SIN_RESOLVER' });
    expect(visuales.some((e) => e.esActual)).toBe(false);
  });
});

describe('La paleta cubre los siete estados, con etiqueta y color propios', () => {
  it('los siete estados existen y no repiten etiqueta', () => {
    const claves: EstadoVisual[] = ['completed', 'in_progress', 'pending', 'projected', 'warning', 'suspended', 'cancelled'];
    for (const c of claves) expect(ESTADOS_VISUALES[c].etiqueta.length).toBeGreaterThan(0);
    const etiquetas = claves.map((c) => ESTADOS_VISUALES[c].etiqueta);
    // Todas las etiquetas son distintas (aunque suspended y cancelled compartan el emoji rojo).
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
    // El ámbar (warning) NUNCA es el estado actual: el actual es azul.
    expect(ESTADOS_VISUALES.in_progress.color).not.toBe(ESTADOS_VISUALES.warning.color);
  });
});
