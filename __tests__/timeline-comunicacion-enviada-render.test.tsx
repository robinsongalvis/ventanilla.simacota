import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EventoTimeline } from '@/app/interno/licencias/components/EventoTimeline';
import { construirTimelineDesdeActuaciones, tituloComunicacionEnviada } from '@/app/interno/licencias/presentacion-actuaciones';
import type { Actuacion } from '@/lib/motor-expedientes/tipos';

afterEach(() => {
  cleanup();
});

/* ══════════════════════════════════════════════════════════════
   Bloque A·A4/A5 — la actuación `comunicacion-enviada` (constancia de
   handoff o aviso de acta, `construirActuacionComunicacionEnviada`,
   `lib/server/expedientes-licencias.ts`) debe verse en el timeline con
   etiqueta PROPIA (no el `tipo` crudo) y tono INFORMATIVO — nunca el verde
   de éxito de `RADICACION`.

   El servidor NO tiene un campo `metadata.tipo` (ni `Actuacion` ni
   `ActuacionLicenciaDoc` lo declaran) — constancia y aviso de acta
   comparten `tipo: 'comunicacion-enviada'` y solo se distinguen por el
   PREFIJO de `detalle`. Estos fixtures usan el texto REAL que arma
   `construirActuacionComunicacionEnviada` para las dos llamadas que hoy
   existen (`desde-radicado/route.ts` y `[id]/actuaciones/route.ts`).
══════════════════════════════════════════════════════════════ */

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

describe('EventoTimeline — comunicacion-enviada con etiqueta y tono propios', () => {
  it('renderiza "Constancia enviada al ciudadano" y "Aviso de acta enviado" en tono info (nunca el verde de RADICACION)', () => {
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
      const puntos = fila.querySelectorAll('span[aria-hidden="true"]');
      // El punto (dot) siempre es el ÚLTIMO `span[aria-hidden]` de la fila —
      // el primero, si existe, es la línea conectora (ver `EventoTimeline.tsx`).
      const punto = puntos[puntos.length - 1] as HTMLElement;
      expect(punto.style.background).toBe('var(--color-info)');
      // Nunca el verde institucional de éxito/RADICACION ni el ámbar de ACTA.
      expect(punto.style.background).not.toBe('#14532D');
      expect(punto.style.background).not.toBe('#D97706');
    });
  });
});
