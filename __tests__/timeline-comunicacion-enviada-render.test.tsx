import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EventoTimeline } from '@/app/interno/licencias/components/EventoTimeline';
import { construirTimelineDesdeActuaciones, tituloComunicacionEnviada } from '@/app/interno/licencias/presentacion-actuaciones';
import { ESTADOS_VISUALES } from '@/app/interno/licencias/estado-visual-evento';
import type { Actuacion } from '@/lib/motor-expedientes/tipos';

afterEach(() => {
  cleanup();
});

/* ══════════════════════════════════════════════════════════════
   Bloque A·A4/A5 — la actuación `comunicacion-enviada` (constancia de
   handoff o aviso de acta, `construirActuacionComunicacionEnviada`,
   `lib/server/expedientes-licencias.ts`) debe verse en el timeline con
   etiqueta PROPIA (no el `tipo` crudo). El COLOR ya no depende de la especie:
   desde el cambio de UI/UX (15-sep-2026) sale del ESTADO VISUAL — un hecho ya
   ocurrido es `completed` (`app/interno/licencias/estado-visual-evento.ts`).

   El servidor NO tiene un campo `metadata.tipo` (ni `Actuacion` ni
   `ActuacionLicenciaDoc` lo declaran) — constancia y aviso de acta
   comparten `tipo: 'comunicacion-enviada'` y solo se distinguen por el
   PREFIJO de `detalle`. Estos fixtures usan el texto REAL que arma
   `construirActuacionComunicacionEnviada` para las dos llamadas que hoy
   existen (`desde-radicado/route.ts` y `[id]/actuaciones/route.ts`).
══════════════════════════════════════════════════════════════ */

/** jsdom devuelve `style.background` normalizado a `rgb(...)`; comparamos ahí. */
function hexARgb(hex: string): string {
  const n = hex.replace('#', '');
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`;
}

function actuacionComunicacion(overrides: Partial<Actuacion> = {}): Actuacion {
  return {
    id: 'act-1',
    expedienteId: 'exp-1',
    tipo: 'comunicacion-enviada',
    etapa: 'comunicacion',
    actorUid: 'uid-1',
    actorNombre: 'Ana Funcionaria',
    actorRol: 'FUNCIONARIO',
    fecha: '2026-08-08T10:00:00.000Z',
    origen: 'REAL',
    detalle:
      'Constancia de radicación en legal y debida forma enviada a juan@example.com. Asunto: "Constancia de radicación en legal y debida forma – Expediente DEMO-26-abc12345".',
    ...overrides,
  };
}

describe('tituloComunicacionEnviada — distingue constancia de aviso de acta por el detalle real', () => {
  it('reconoce los dos prefijos que hoy usa el servidor y cae en un título genérico si no coincide', () => {
    expect(
      tituloComunicacionEnviada(
        'Constancia de radicación en legal y debida forma enviada a x@x.com. Asunto: "x".',
      ),
    ).toBe('Constancia enviada al ciudadano');
    expect(
      tituloComunicacionEnviada(
        'Aviso de acta de observaciones y correcciones enviada a x@x.com. Asunto: "x".',
      ),
    ).toBe('Aviso de acta enviado');
    expect(tituloComunicacionEnviada(undefined)).toBe('Comunicación enviada al ciudadano');
    expect(tituloComunicacionEnviada('texto inesperado, sin prefijo conocido')).toBe('Comunicación enviada al ciudadano');
  });
});

describe('EventoTimeline — comunicacion-enviada con etiqueta propia y color por estado', () => {
  it('renderiza "Constancia enviada al ciudadano" y "Aviso de acta enviado" con título propio y color de estado (completed)', () => {
    const actuaciones: Actuacion[] = [
      actuacionComunicacion({ id: 'act-1', fecha: '2026-08-08T10:00:00.000Z' }),
      actuacionComunicacion({
        id: 'act-2',
        fecha: '2026-08-09T10:00:00.000Z',
        detalle:
          'Aviso de acta de observaciones y correcciones enviada a juan@example.com. Asunto: "Aviso de acta de observaciones – Expediente DEMO-26-abc12345".',
      }),
    ];
    // origen='REAL' pero vigente=null: sin proyección de vencimiento en la
    // mezcla — aísla el aserto a las dos filas de comunicación.
    const timeline = construirTimelineDesdeActuaciones(actuaciones, 'REAL', null);
    expect(timeline).toHaveLength(2);

    const { container } = render(<EventoTimeline eventos={timeline} />);

    expect(screen.getByText('Constancia enviada al ciudadano')).toBeTruthy();
    expect(screen.getByText('Aviso de acta enviado')).toBeTruthy();
    // "tipo" crudo del servidor nunca debe filtrarse como título.
    expect(screen.queryByText('comunicacion-enviada')).toBeNull();

    const filas = container.querySelectorAll('li');
    expect(filas.length).toBe(2);
    filas.forEach((fila) => {
      /* SE LOCALIZA POR SU ATRIBUTO, no por su posición. `data-punto-timeline`
         es un contrato estable; el orden del DOM no. */
      const punto = fila.querySelector('[data-punto-timeline]') as HTMLElement;
      /* NUEVA SEMÁNTICA (UI/UX 15-sep-2026): el color del punto ya NO sale del
         `tipo` de la actuación, sino de su ESTADO VISUAL, deliberadamente
         INDEPENDIENTE del tipo (`estado-visual-evento.ts`). Una comunicación
         enviada es un hecho ya ocurrido → `completed` (verde), como cualquier
         otro hecho cumplido. Que la especie ya NO decida el color es justo el
         objetivo del cambio; la distinción «comunicación» vive ahora en su
         título, no en su color. */
      expect(punto.style.background).toBe(hexARgb(ESTADOS_VISUALES.completed.color));
    });
  });
});
