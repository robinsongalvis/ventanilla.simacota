import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PanelHechosCaso } from '@/app/interno/licencias/components/PanelHechosCaso';

/**
 * LO RESPONDIDO SE COMPACTA — Y NO SE BORRA.
 *
 * Una fila sin decidir carga con todo lo que hace falta para decidir: la
 * pregunta, el contexto y, debajo de cada opción, LA CONSECUENCIA de elegirla.
 * Eso es exactamente lo que la funcionaria necesita en ese momento.
 *
 * Decidido el hecho, esa misma consecuencia deja de decidir nada y sigue
 * ocupando dos líneas. Con cuatro hechos respondidos, el panel se llena de
 * texto que ya no cambia nada y empuja hacia abajo lo que sí está vivo.
 *
 * LA REGLA, ENTONCES: las consecuencias por opción se retiran al responder, y
 * lo decidido sigue dicho — el chip lleva el `resumen`, que la Definición
 * escribe para nombrar la consecuencia YA APLICADA y con más palabras de las
 * que caben en un botón. Compactar es mover información a su forma corta, no
 * quitarla.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ──────────────────────────────────────────
 * QUÉ MIRA: qué desaparece y qué permanece al responder, y que el hecho se
 * pueda seguir cambiando.
 * QUÉ NO MIRA: alturas, anchos ni espaciados — si la fila compacta queda fea,
 * esto sigue verde. Y no mira el tipo del valor enviado, que es de
 * `hechos-caso-envia-valor-tipado.test.tsx`.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const CLAVE = {
  nombre: 'esApoderado',
  tipo: 'boolean' as const,
  pregunta: '¿El solicitante actúa mediante apoderado?',
  efecto: 'Solo decide si se exige el poder autenticado.',
  opciones: {
    si: {
      etiqueta: 'Un apoderado',
      consecuencia: 'se exigirá el poder autenticado',
      resumen: 'Actúa mediante apoderado — se exige poder autenticado',
    },
    no: {
      etiqueta: 'El titular del predio',
      consecuencia: 'no se exige poder',
      resumen: 'Actúa el titular — no se exige poder',
    },
  },
};

function pintar(contexto: Record<string, unknown>) {
  return render(
    <PanelHechosCaso
      expedienteId="exp-1"
      clavesContexto={[CLAVE] as never}
      contexto={contexto as never}
      soloLectura={false}
      onActualizado={() => {}}
    />,
  );
}

describe('sin responder, la fila trae todo lo que hace falta para decidir', () => {
  it('cada opción muestra su consecuencia', () => {
    pintar({});
    expect(screen.getByText('se exigirá el poder autenticado')).toBeTruthy();
    expect(screen.getByText('no se exige poder')).toBeTruthy();
  });
});

describe('respondida, la fila se compacta', () => {
  it('las consecuencias por opción se retiran', () => {
    pintar({ esApoderado: true });
    expect(screen.queryByText('se exigirá el poder autenticado')).toBeNull();
    expect(screen.queryByText('no se exige poder')).toBeNull();
  });

  it('pero lo decidido SIGUE DICHO, en el chip y con sus palabras', () => {
    pintar({ esApoderado: true });
    expect(screen.getByText('Actúa mediante apoderado — se exige poder autenticado')).toBeTruthy();
  });

  it('y el chip dice la opción ELEGIDA, no la otra', () => {
    pintar({ esApoderado: false });
    expect(screen.getByText('Actúa el titular — no se exige poder')).toBeTruthy();
    expect(screen.queryByText('Actúa mediante apoderado — se exige poder autenticado')).toBeNull();
  });

  it('la pregunta y la línea de contexto no se tocan', () => {
    pintar({ esApoderado: true });
    expect(screen.getByText('¿El solicitante actúa mediante apoderado?')).toBeTruthy();
    expect(screen.getByText('Solo decide si se exige el poder autenticado.')).toBeTruthy();
  });

  it('el hecho se puede seguir cambiando: las opciones siguen ahí y activas', () => {
    /* Compactar no puede convertirse en «bloquear»: corregir un hecho mal
       respondido es parte del trabajo, y el servidor lo admite entre Sí y No. */
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contexto: { esApoderado: false } }),
    });
    vi.stubGlobal('fetch', fetchFalso);

    pintar({ esApoderado: true });
    const otra = screen.getByRole('button', { name: /El titular del predio/ });
    expect(otra.hasAttribute('disabled')).toBe(false);
    fireEvent.click(otra);
    expect(fetchFalso).toHaveBeenCalled();
  });

  it('la opción elegida se sigue distinguiendo de la otra', () => {
    pintar({ esApoderado: true });
    expect(screen.getByRole('button', { name: /Un apoderado/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /El titular del predio/ }).getAttribute('aria-pressed')).toBe('false');
  });
});
