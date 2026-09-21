import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ChecklistRequisitos } from '@/app/interno/licencias/components/ChecklistRequisitos';
import type { AporteRequisito, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Bloque A·A3 — Checklist de requisitos (detalle del expediente).

   El checklist NUNCA reevalúa condiciones por su cuenta: delega en
   `evaluarCompletitud`/`requisitoAplica` (`lib/motor-expedientes/
   completitud.ts`, el evaluador REAL, sin mocks) contra una Definición de
   Trámite SINTÉTICA — deliberadamente NO se usa
   `DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL` aquí: estos tests verifican el
   MECANISMO genérico del checklist (deriva estados, cuenta el resumen,
   reacciona a cambios de contexto), no el contenido de esa Definición
   concreta (eso lo cubre `definicion-licencia-construccion-parcial.test.ts`).

   REDISEÑO documentación (sep-2026): la vista pasó a resumen + filtros +
   secciones colapsables por categoría, con filas compactas (acción principal
   «Ver» / «+ Adjuntar documento» y lo secundario —descargar/reemplazar— en un
   menú de tres puntos). Los requisitos sintéticos no están mapeados a ninguna
   categoría, así que caen todos en «Documentos adicionales» (fallback), que es
   la sección que se abre por defecto. Lo que estas pruebas custodian —los
   ESTADOS y los NÚMEROS salen del evaluador real— es idéntico; cambia el sitio
   donde se leen, no la exigencia.
══════════════════════════════════════════════════════════════ */

const DEFINICION_TEST: DefinicionTramite = {
  id: 'tramite-test',
  nombre: 'Trámite de prueba',
  activo: true,
  terminos: { dias: 10, unidad: 'HABILES' },
  regimenSubsanacion: {
    dias: 5,
    unidad: 'HABILES',
    prorrogaDias: 2,
    ventanaRequerimiento: { dias: 3, unidad: 'HABILES' },
  },
  requiereVisita: false,
  generaResolucion: false,
  clavesContexto: [{ nombre: 'esApoderado', tipo: 'boolean' }],
  requisitos: [
    { id: 'req-obligatorio-pendiente', nombre: 'Cédula del solicitante', tipo: 'OBLIGATORIO' },
    { id: 'req-obligatorio-aportado', nombre: 'Certificado de tradición', tipo: 'OBLIGATORIO' },
    {
      id: 'req-condicional',
      nombre: 'Poder del apoderado',
      tipo: 'CONDICIONAL',
      condicion: { operador: 'IGUAL', clave: 'esApoderado', valor: true },
    },
    { id: 'req-opcional', nombre: 'Fotos del predio', tipo: 'OPCIONAL' },
  ],
};

const RUTA_DOC = 'expedientes/exp-1/doc-1/v0001/certificado.pdf';

function documentoFixture(overrides: Partial<DocumentoExpedienteDoc> = {}): DocumentoExpedienteDoc {
  return {
    id: 'doc-1',
    tenantId: 'VENTANILLA_UNICA',
    nombre: 'Certificado de tradición y libertad.pdf',
    requisitoId: 'req-obligatorio-aportado',
    creadoEn: '2026-08-01T10:00:00.000Z',
    versionVigente: {
      numeroVersion: 1,
      storagePath: RUTA_DOC,
      hashSha256: 'a'.repeat(64),
      tamanioBytes: 1024,
      mimeType: 'application/pdf',
      subidoPor: { uid: 'uid-1', nombre: 'Ana Funcionaria' },
      subidoEn: '2026-08-01T10:00:00.000Z',
      tenantId: 'VENTANILLA_UNICA',
    },
    totalVersiones: 1,
    ...overrides,
  };
}

/** La fila (`<li>`) de un requisito por su nombre. El nombre puede aparecer
 *  además en el resumen (lista de pendientes), así que se acota a la fila. */
function filaDe(nombre: string): HTMLElement {
  const li = screen.getAllByText(nombre).map((el) => el.closest('li')).find((x): x is HTMLLIElement => x !== null);
  if (!li) throw new Error(`No se encontró la fila del requisito "${nombre}"`);
  return li;
}

describe('Bloque A·A3 — ChecklistRequisitos deriva estados del evaluador real', () => {
  it('clasifica APORTADO / PENDIENTE / NO_APLICA (condicional y opcional) sin reimplementar la evaluación', () => {
    const aportes: AporteRequisito[] = [
      { requisitoId: 'req-obligatorio-aportado', estado: 'APORTADO', documentoIds: ['doc-1'] },
    ];
    const contexto: ContextoEvaluacionRequisito = { esApoderado: false };

    render(
      <ChecklistRequisitos
        expedienteId="exp-1"
        definicion={DEFINICION_TEST}
        contexto={contexto}
        aportes={aportes}
        documentos={[documentoFixture()]}
        soloLectura={false}
        onContextoActualizado={() => {}}
        onDocumentoSubido={() => {}}
      />,
    );

    // OBLIGATORIO sin aporte → PENDIENTE, con la acción principal «+ Adjuntar documento».
    const filaPendiente = filaDe('Cédula del solicitante');
    expect(within(filaPendiente).getByText('Pendiente')).toBeTruthy();
    expect(within(filaPendiente).getByText('+ Adjuntar documento')).toBeTruthy();

    // OBLIGATORIO con aporte real → APORTADO, con el documento, su versión y la acción «Ver».
    const filaAportada = filaDe('Certificado de tradición');
    expect(within(filaAportada).getByText('Aportado')).toBeTruthy();
    expect(within(filaAportada).getByText(/^v1 ·/)).toBeTruthy();
    const enlaceVer = within(filaAportada).getByText('Ver') as HTMLAnchorElement;
    expect(enlaceVer.getAttribute('href')).toBe(`/api/interno/archivo?path=${encodeURIComponent(RUTA_DOC)}`);

    // Lo secundario (descargar, reemplazar) vive en el menú de tres puntos.
    fireEvent.click(within(filaAportada).getByRole('button', { name: 'Más acciones' }));
    const enlaceDescarga = within(filaAportada).getByText('Descargar') as HTMLAnchorElement;
    expect(enlaceDescarga.getAttribute('href')).toBe(`/api/interno/archivo?path=${encodeURIComponent(RUTA_DOC)}`);
    expect(within(filaAportada).getByText('Reemplazar (nueva versión)')).toBeTruthy();

    // CONDICIONAL cuya condición NO se cumple (esApoderado=false) → NO_APLICA, con el motivo legible.
    expect(screen.getByText('Poder del apoderado')).toBeTruthy();
    expect(screen.getByText('No se exige en este caso (esApoderado = sí).')).toBeTruthy();

    // OPCIONAL sin aportar → mismo trío visual que "no aplica" pero rotulado "Opcional" (nunca bloquea).
    expect(screen.getByText('Fotos del predio')).toBeTruthy();
    // "No aplica" (badge de ESTADO) solo para el condicional; el opcional
    // comparte el trío de color pero su badge de estado se rotula "Opcional",
    // que además coincide con su badge de TIPO: dos badges, mismo texto.
    expect(screen.getAllByText('No aplica').length).toBe(1);
    expect(screen.getAllByText('Opcional').length).toBe(2);
  });

  it('el resumen cuenta "X de Y aplicables aportados" a partir de las listas reales del evaluador', () => {
    const aportes: AporteRequisito[] = [
      { requisitoId: 'req-obligatorio-aportado', estado: 'APORTADO', documentoIds: ['doc-1'] },
    ];
    const contexto: ContextoEvaluacionRequisito = { esApoderado: false };

    render(
      <ChecklistRequisitos
        expedienteId="exp-1"
        definicion={DEFINICION_TEST}
        contexto={contexto}
        aportes={aportes}
        documentos={[documentoFixture()]}
        soloLectura={false}
        onContextoActualizado={() => {}}
        onDocumentoSubido={() => {}}
      />,
    );

    // 3 no-opcionales (2 obligatorios + 1 condicional) − 1 no-aplicable = 2 aplicables; de esos, 1 ya aportado.
    /* Se leen por `aria`, no casando cadenas: los números viven en la barra de
       progreso, que los expone semánticamente. Sigue aseverándose el número
       EXACTO que sale de las listas reales del evaluador — que es lo que esta
       prueba existe para custodiar. */
    const barra = screen.getByRole('progressbar', { name: /documentos aportados/i });
    expect(barra.getAttribute('aria-valuenow')).toBe('1');
    expect(barra.getAttribute('aria-valuemax')).toBe('2');
    // El resumen anuncia lo que falta, y el filtro «Pendientes» cuenta ese 1:
    // la información no desapareció, cambió de sitio.
    expect(screen.getByText(/^1 documento por completar$/)).toBeTruthy();
    const chipPendientes = screen.getByRole('button', { name: /^Pendientes/ });
    expect(within(chipPendientes).getByText('1')).toBeTruthy();
  });

  it('modo solo-lectura (RECONSTRUIDO/cerrado): sin controles de carga ni edición de hechos del caso', () => {
    const aportes: AporteRequisito[] = [
      { requisitoId: 'req-obligatorio-aportado', estado: 'APORTADO', documentoIds: ['doc-1'] },
    ];
    const contexto: ContextoEvaluacionRequisito = { esApoderado: false };

    render(
      <ChecklistRequisitos
        expedienteId="exp-1"
        definicion={DEFINICION_TEST}
        contexto={contexto}
        aportes={aportes}
        documentos={[documentoFixture()]}
        soloLectura
        motivoSoloLectura="Expediente histórico migrado — no admite nuevos aportes."
        onContextoActualizado={() => {}}
        onDocumentoSubido={() => {}}
      />,
    );

    // El documento aportado se sigue viendo (solo-lectura ≠ ocultar información): versión + acción «Ver».
    const filaAportada = filaDe('Certificado de tradición');
    expect(within(filaAportada).getByText(/^v1 ·/)).toBeTruthy();
    expect(within(filaAportada).getByText('Ver')).toBeTruthy();
    expect(screen.getByText(/Expediente histórico migrado/)).toBeTruthy();

    // Ningún control de carga, en ningún requisito ni en "Otros documentos".
    expect(screen.queryByText('+ Adjuntar documento')).toBeNull();
    expect(screen.queryByText('Reemplazar (nueva versión)')).toBeNull();
    expect(screen.queryByText('Adjuntar documento')).toBeNull();

    /* El panel «Hechos del caso» se sigue viendo, pero no se puede tocar: lo que
       se custodia —que en solo-lectura NO se pueda cambiar un hecho— es que los
       botones segmentados están deshabilitados. */
    for (const opcion of ['Sí', 'No']) {
      expect(
        (screen.getByRole('button', { name: new RegExp(`^${opcion}$`) }) as HTMLButtonElement).disabled,
        `la opción "${opcion}" debe estar deshabilitada en solo-lectura`,
      ).toBe(true);
    }
  });
});

/** Envoltorio controlado — mismo contrato que usará `DetalleLicenciaClient`: el `contexto` vive en el padre y se actualiza con lo que devuelve el PATCH real. */
function Harness({
  aportes,
  documentos,
  contextoInicial,
}: {
  aportes: AporteRequisito[];
  documentos: DocumentoExpedienteDoc[];
  contextoInicial: ContextoEvaluacionRequisito;
}) {
  const [contexto, setContexto] = useState<ContextoEvaluacionRequisito>(contextoInicial);
  return (
    <ChecklistRequisitos
      expedienteId="exp-1"
      definicion={DEFINICION_TEST}
      contexto={contexto}
      aportes={aportes}
      documentos={documentos}
      soloLectura={false}
      onContextoActualizado={setContexto}
      onDocumentoSubido={() => {}}
    />
  );
}

describe('Bloque A·A3 — ChecklistRequisitos reacciona EN VIVO a "Hechos del caso"', () => {
  it('definir esApoderado=true reevalúa el condicional (de INDETERMINADO a PENDIENTE) y el resumen cambia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, contexto: { esApoderado: true } }),
    }));

    render(<Harness aportes={[]} documentos={[]} contextoInicial={{}} />);

    const filaCondicional = () => filaDe('Poder del apoderado');

    // Antes: sin `esApoderado` en el contexto, el condicional es INDETERMINADO (fail-closed, NO "no aplica").
    expect(within(filaCondicional()).getByText('Falta definir')).toBeTruthy();
    expect(within(filaCondicional()).queryByText('+ Adjuntar documento')).toBeNull();
    const barraAntes = screen.getByRole('progressbar', { name: /documentos aportados/i });
    expect(barraAntes.getAttribute('aria-valuenow')).toBe('0');
    // El indeterminado se descuenta del denominador (no se sabe si se exige):
    // 2 pendientes conocidos, el condicional aparte como «Falta definir».
    expect(barraAntes.getAttribute('aria-valuemax')).toBe('2');
    expect(screen.getAllByText('Pendiente').length).toBe(2);
    expect(screen.getByText('Falta definir')).toBeTruthy();

    // El funcionario marca "hay apoderado":
    fireEvent.click(screen.getByRole('button', { name: /^Sí$/ }));

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/licencias/expedientes/exp-1/contexto',
      expect.objectContaining({ method: 'PATCH' }),
    );

    // Después: el condicional pasa a APLICA (PENDIENTE, con su propio control de carga) — el requisito "aparece" como exigible.
    await waitFor(() => expect(within(filaCondicional()).getByText('Pendiente')).toBeTruthy());
    expect(within(filaCondicional()).getByText('+ Adjuntar documento')).toBeTruthy();
    expect(within(filaCondicional()).queryByText('Falta definir')).toBeNull();

    /* Al definir el hecho, el condicional deja de ser indeterminado y pasa a
       EXIGIRSE: el denominador sube de 2 a 3 y ya no queda nada «por definir».
       Eso es lo que esta prueba custodia. */
    const barraDespues = screen.getByRole('progressbar', { name: /documentos aportados/i });
    expect(barraDespues.getAttribute('aria-valuenow')).toBe('0');
    expect(barraDespues.getAttribute('aria-valuemax')).toBe('3');
    expect(screen.getAllByText('Pendiente').length).toBe(3);
    expect(screen.queryByText('Falta definir')).toBeNull();
  });
});
