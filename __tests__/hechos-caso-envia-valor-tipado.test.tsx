import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PanelHechosCaso } from '@/app/interno/licencias/components/PanelHechosCaso';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';

/**
 * CADA OPCIÓN ENVÍA EL VALOR DEL DOMINIO, NO SU ETIQUETA.
 *
 * El defecto que esto fija ocurrió de verdad en el despliegue: al pasar los
 * hechos del caso de `<select>` a botones segmentados se perdió la conversión
 * que hacía el `onChange` (`value === 'true'`), y la pantalla empezó a mandar
 * la CADENA 'true'. El servidor la rechazaba:
 *
 *   «La clave de contexto "esApoderado" espera boolean, se recibió string»
 *
 * Ninguna prueba lo vio porque todas mockean `fetch` y ninguna miraba el TIPO
 * de lo que se enviaba. Esta lo mira.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CLAVES = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!;

function montar(nombreClave: string) {
  const clave = CLAVES.find((c) => c.nombre === nombreClave)!;
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, contexto: {} }) });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <PanelHechosCaso
      expedienteId="exp-1"
      clavesContexto={[clave]}
      contexto={{}}
      soloLectura={false}
      onActualizado={() => {}}
    />,
  );
  return { clave, fetchMock };
}

/** Lo que de verdad viajó en el cuerpo del PATCH. */
async function valorEnviado(fetchMock: ReturnType<typeof vi.fn>, nombre: string) {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  return JSON.parse(fetchMock.mock.calls[0][1].body)[nombre];
}

describe('los booleanos viajan como boolean, no como "true"/"false"', () => {
  it.each([
    ['esApoderado'],
    ['sujetoTituloENSR10'],
    ['predioRodeadoEspacioPublico'],
  ])('%s', async (nombre) => {
    const { clave, fetchMock } = montar(nombre);
    const etiquetaSi = clave.opciones!.si!.etiqueta;

    fireEvent.click(screen.getByRole('button', { name: new RegExp(etiquetaSi.slice(0, 12), 'i') }));

    const enviado = await valorEnviado(fetchMock, nombre);
    expect(
      typeof enviado,
      `${nombre} se envió como ${typeof enviado}: el servidor lo rechaza con «espera boolean, se recibió string»`,
    ).toBe('boolean');
    expect(enviado).toBe(true);
  });

  it('la opción contraria envía false, no la cadena "false"', async () => {
    const { clave, fetchMock } = montar('esApoderado');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(clave.opciones!.no!.etiqueta.slice(0, 12), 'i') }));
    const enviado = await valorEnviado(fetchMock, 'esApoderado');
    expect(typeof enviado).toBe('boolean');
    expect(enviado).toBe(false);
  });
});

describe('los valores de dominio viajan tal cual, no su etiqueta', () => {
  it('la complejidad envía "MEDIA", no "Media"', async () => {
    /* La etiqueta es SOLO presentación: si viajara, el evaluador no
       reconocería el valor y los requisitos condicionales quedarían mal. */
    const { fetchMock } = montar('categoriaComplejidad');
    fireEvent.click(screen.getByRole('button', { name: /^Media/ }));
    const enviado = await valorEnviado(fetchMock, 'categoriaComplejidad');
    expect(enviado).toBe('MEDIA');
  });

  it('cada opción de la escala envía su valor del dominio', async () => {
    const clave = CLAVES.find((c) => c.nombre === 'categoriaComplejidad')!;
    for (const valor of clave.dominio as string[]) {
      cleanup();
      const { fetchMock } = montar('categoriaComplejidad');
      const etiqueta = clave.opciones!.porValor![valor].etiqueta;
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${etiqueta}`) }));
      expect(await valorEnviado(fetchMock, 'categoriaComplejidad')).toBe(valor);
    }
  });
});

describe('las etiquetas NUNCA viajan', () => {
  it('ninguna etiqueta declarada aparece en el cuerpo del PATCH', async () => {
    for (const clave of CLAVES) {
      cleanup();
      const { fetchMock } = montar(clave.nombre);
      const botones = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
      fireEvent.click(botones[0]);
      const cuerpo = JSON.stringify(JSON.parse(fetchMock.mock.calls[0][1].body));
      const etiquetas = [
        clave.opciones?.si?.etiqueta,
        clave.opciones?.no?.etiqueta,
        ...Object.values(clave.opciones?.porValor ?? {}).map((o) => o.etiqueta),
      ].filter(Boolean) as string[];
      for (const e of etiquetas) {
        expect(cuerpo, `la etiqueta "${e}" viajó al servidor`).not.toContain(e);
      }
    }
  });
});
