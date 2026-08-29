import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PanelHechosCaso } from '@/app/interno/licencias/components/PanelHechosCaso';
import type { ContextoEvaluacionRequisito } from '@/lib/motor-expedientes/tipos';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   "Hechos del caso" en lenguaje natural — el propietario reportó en
   producción que etiquetas como "Sujeto Titulo ENSR10" no le dicen a la
   funcionaria qué se le pregunta ni para qué (`prettyClave()` a secas).
   Estas pruebas cubren el contrato ADITIVO `pregunta`/`ayuda`/`efecto`
   sobre `ClaveContextoDeclarada` — todavía no declarado en el tipo real de
   `lib/motor-expedientes/tipos.ts` mientras otro agente lo incorpora, así
   que las claves de prueba se tipan localmente (no como un cast forzado en
   producción, solo para no bloquear este test en la carrera con `lib/`) y
   se pasan tal cual — el componente las lee de forma defensiva.
══════════════════════════════════════════════════════════════ */

const claveConTextos = {
  nombre: 'esApoderado',
  tipo: 'boolean' as const,
  pregunta: '¿El solicitante actúa mediante apoderado?',
  ayuda: 'Si un tercero firma en representación del solicitante, se exige poder autenticado (Decreto 1077 de 2015, Art. 2.2.6.1.2.1.1).',
  efecto: 'Si responde "Sí", se agrega el requisito "Poder del apoderado" al checklist.',
};

const claveSinTextos = { nombre: 'categoriaComplejidad', tipo: 'boolean' as const };

function renderPanel(overrides: {
  clavesContexto?: Array<typeof claveConTextos | typeof claveSinTextos>;
  contexto?: ContextoEvaluacionRequisito;
  onActualizado?: (c: ContextoEvaluacionRequisito) => void;
} = {}) {
  return render(
    <PanelHechosCaso
      expedienteId="exp-1"
      clavesContexto={overrides.clavesContexto ?? [claveConTextos]}
      contexto={overrides.contexto ?? {}}
      soloLectura={false}
      onActualizado={overrides.onActualizado ?? (() => {})}
    />,
  );
}

describe('PanelHechosCaso — pregunta en lenguaje natural con respaldo', () => {
  it('usa clave.pregunta como etiqueta del campo cuando la Definición la declara', () => {
    renderPanel({ clavesContexto: [claveConTextos] });

    expect(screen.getByLabelText('¿El solicitante actúa mediante apoderado?')).toBeTruthy();
    // El nombre técnico crudo no debe quedar expuesto como etiqueta.
    expect(screen.queryByText('Es Apoderado')).toBeNull();
  });

  it('cae a prettyClave(nombre) cuando la Definición NO declara pregunta (comportamiento de hoy)', () => {
    renderPanel({ clavesContexto: [claveSinTextos] });

    expect(screen.getByLabelText('Categoria Complejidad')).toBeTruthy();
  });

  it('la ayuda se muestra siempre visible (no en un tooltip) y asociada al campo vía aria-describedby', () => {
    renderPanel({ clavesContexto: [claveConTextos] });

    const campo = screen.getByLabelText('¿El solicitante actúa mediante apoderado?');
    const ayuda = screen.getByText(/Decreto 1077 de 2015/);
    expect(ayuda.id).toBeTruthy();
    expect(campo.getAttribute('aria-describedby')).toContain(ayuda.id);
  });

  it('sin ayuda declarada, no se inventa texto ni se agrega aria-describedby de ayuda', () => {
    renderPanel({ clavesContexto: [claveSinTextos] });

    const campo = screen.getByLabelText('Categoria Complejidad');
    expect(campo.getAttribute('aria-describedby')).toBeFalsy();
  });

  it('el efecto se muestra mientras el hecho está "Sin definir"', () => {
    renderPanel({ clavesContexto: [claveConTextos], contexto: {} });

    expect(screen.getByText(/se agrega el requisito "Poder del apoderado"/)).toBeTruthy();
  });

  it('el efecto deja de mostrarse una vez el hecho ya fue respondido', () => {
    renderPanel({ clavesContexto: [claveConTextos], contexto: { esApoderado: true } });

    expect(screen.queryByText(/se agrega el requisito "Poder del apoderado"/)).toBeNull();
  });
});

describe('PanelHechosCaso — aviso de faltantes', () => {
  it('anuncia cuántos hechos faltan mientras haya claves "Sin definir"', () => {
    renderPanel({
      clavesContexto: [claveConTextos, claveSinTextos],
      contexto: { esApoderado: true }, // categoriaComplejidad queda sin definir
    });

    /* REDISEÑO 28-ago: el banner ámbar de advertencia se sustituye por el
       progreso «N de M definidas» —informa lo mismo sin regañar—. Lo que esta
       prueba custodia NO era el texto sino el MECANISMO: que el recuento viva
       en un nodo `aria-live` para que un lector de pantalla lo anuncie. Eso se
       conserva y se sigue verificando. */
    const texto = screen.getByText('1 de 2');
    expect(texto).toBeTruthy();
    expect(texto.closest('[aria-live="polite"]')).toBeTruthy();
    /* Y el pie sigue diciendo cuántas faltan, en palabras. */
    expect(screen.getByText(/Falta 1 respuesta/)).toBeTruthy();
  });

  it('pasa a confirmación breve cuando ya no queda ningún hecho sin definir', () => {
    renderPanel({
      clavesContexto: [claveConTextos, claveSinTextos],
      contexto: { esApoderado: true, categoriaComplejidad: false },
    });

    expect(screen.getByText('2 de 2')).toBeTruthy();
    /* Sin faltantes NO se muestra el recordatorio: un aviso que sigue ahí
       cuando ya no hay nada que hacer entrena a ignorarlo. */
    expect(screen.queryByText(/Falta/)).toBeNull();
  });

  it('la transición de "faltan" a "todos definidos" ocurre dentro del mismo nodo aria-live', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, contexto: { esApoderado: true } }),
    }));

    let contextoActual: ContextoEvaluacionRequisito = {};
    const onActualizado = vi.fn((c: ContextoEvaluacionRequisito) => { contextoActual = c; });
    const { rerender } = renderPanel({ clavesContexto: [claveConTextos], contexto: contextoActual, onActualizado });

    const avisoInicial = screen.getByText('0 de 1').closest('[role="status"]');
    expect(avisoInicial).toBeTruthy();

    /* Los dropdowns murieron: ahora se responde con botones segmentados. La
       interacción cambia; lo que se verifica —que el anuncio ocurra en el MISMO
       nodo— no. */
    fireEvent.click(screen.getByRole('button', { name: /^Sí$/ }));

    await waitFor(() => expect(onActualizado).toHaveBeenCalledWith({ esApoderado: true }));
    rerender(
      <PanelHechosCaso
        expedienteId="exp-1"
        clavesContexto={[claveConTextos]}
        contexto={contextoActual}
        soloLectura={false}
        onActualizado={onActualizado}
      />,
    );

    const avisoFinal = screen.getByText('1 de 1').closest('[role="status"]');
    expect(avisoFinal).toBe(avisoInicial); // MISMO nodo del DOM — confiable para aria-live.
  });
});

describe('PanelHechosCaso — confirmación honesta tras guardar (sin inventar el delta del checklist)', () => {
  it('al guardar con éxito, avisa que el checklist puede haber cambiado (sin afirmar un número inventado)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, contexto: { esApoderado: true } }),
    }));

    renderPanel({ clavesContexto: [claveConTextos], contexto: {} });

    fireEvent.click(screen.getByRole('button', { name: /^Sí$/ }));

    await waitFor(() => expect(screen.getByText('Guardado — el checklist de requisitos puede haber cambiado.')).toBeTruthy());
  });
});
