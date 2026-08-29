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

function documentoFixture(overrides: Partial<DocumentoExpedienteDoc> = {}): DocumentoExpedienteDoc {
  return {
    id: 'doc-1',
    tenantId: 'VENTANILLA_UNICA',
    nombre: 'Certificado de tradición y libertad.pdf',
    requisitoId: 'req-obligatorio-aportado',
    creadoEn: '2026-08-01T10:00:00.000Z',
    versionVigente: {
      numeroVersion: 1,
      storagePath: 'expedientes/exp-1/doc-1/v0001/certificado.pdf',
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

    // OBLIGATORIO sin aporte → PENDIENTE, con control de carga.
    expect(screen.getByText('Cédula del solicitante')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Subir documento')).toBeTruthy();

    // OBLIGATORIO con aporte real → APORTADO, con el documento y su versión.
    expect(screen.getByText('Certificado de tradición')).toBeTruthy();
    expect(screen.getByText('Aportado')).toBeTruthy();
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getByText('Reemplazar (nueva versión)')).toBeTruthy();
    const enlaceDescarga = screen.getByText('Descargar') as HTMLAnchorElement;
    expect(enlaceDescarga.getAttribute('href')).toBe(
      `/api/interno/archivo?path=${encodeURIComponent('expedientes/exp-1/doc-1/v0001/certificado.pdf')}`,
    );

    // CONDICIONAL cuya condición NO se cumple (esApoderado=false) → NO_APLICA, con el motivo legible.
    expect(screen.getByText('Poder del apoderado')).toBeTruthy();
    expect(screen.getByText('No aplica a este caso: esApoderado = sí.')).toBeTruthy();

    // OPCIONAL sin aportar → mismo trío visual que "no aplica" pero rotulado "Opcional" (nunca bloquea).
    expect(screen.getByText('Fotos del predio')).toBeTruthy();
    expect(screen.getByText('Opcional — no bloquea la completitud del checklist.')).toBeTruthy();
    // "No aplica" (badge de ESTADO) solo debe aparecer para el condicional —
    // el opcional comparte el mismo trío de color pero el badge de estado se
    // rotula "Opcional" (ver estilos-estado-requisito.ts), que además coincide
    // con el badge de TIPO del propio requisito opcional: dos badges, mismo texto.
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
    /* REDISEÑO 28-ago: el resumen pasó de una frase larga a una barra de
       progreso —«1 de 2 documentos aportados»— y lo que antes iba en el
       sufijo («faltan 1», «N sin definir») ahora vive en los encabezados de
       grupo («Faltan · N») y en el contador de la pestaña de Hechos.

       Se actualiza la FRASE, no la exigencia: sigue aseverándose el número
       exacto que sale de las listas reales del evaluador, que es lo que esta
       prueba existe para custodiar. */
    /* Se leen por `aria` y no casando cadenas: los números viven en la barra de
       progreso, que los expone semánticamente. Un `textContent` se rompería con
       cualquier cambio de maquetación sin que nada hubiera cambiado de verdad. */
    const barra = screen.getByRole('progressbar', { name: /documentos aportados/i });
    expect(barra.getAttribute('aria-valuenow')).toBe('1');
    expect(barra.getAttribute('aria-valuemax')).toBe('2');
    /* Y el grupo «Faltan» cuenta el que falta: la información no desapareció,
       cambió de sitio. */
    expect(screen.getByText(/^Faltan · 1$/)).toBeTruthy();
    expect(screen.getByText('Incompleto')).toBeTruthy();
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

    // El documento aportado se sigue viendo (solo-lectura ≠ ocultar información).
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getByText('Descargar')).toBeTruthy();
    expect(screen.getByText(/Expediente histórico migrado/)).toBeTruthy();

    // Ningún control de carga, en ningún requisito ni en "Otros documentos".
    expect(screen.queryByText('Subir documento')).toBeNull();
    expect(screen.queryByText('Reemplazar (nueva versión)')).toBeNull();
    expect(screen.queryByText('Adjuntar documento')).toBeNull();

    /* El panel «Hechos del caso» se sigue viendo, pero no se puede tocar.
       REDISEÑO 28-ago: los dropdowns pasaron a botones segmentados; lo que se
       custodia —que en solo-lectura NO se pueda cambiar un hecho— es idéntico,
       solo cambia el control en el que se comprueba. */
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

    const filaCondicional = () => screen.getByText('Poder del apoderado').closest('li') as HTMLElement;

    // Antes: sin `esApoderado` en el contexto, el condicional es INDETERMINADO (fail-closed, NO "no aplica").
    expect(within(filaCondicional()).getByText('Falta definir')).toBeTruthy();
    expect(within(filaCondicional()).queryByText('Subir documento')).toBeNull();
    const barraAntes = screen.getByRole('progressbar', { name: /documentos aportados/i });
    expect(barraAntes.getAttribute('aria-valuenow')).toBe('0');
    expect(barraAntes.getAttribute('aria-valuemax')).toBe('2');
    /* «Faltan» cuenta los PENDIENTES (2). El condicional indeterminado va en su
       propio grupo: no se sabe si se exige —el evaluador lo descuenta de
       aplicables— y su acción es responder, no subir. */
    expect(screen.getByText(/^Faltan · 2$/)).toBeTruthy();
    expect(screen.getByText(/^Sin definir — dependen de Hechos del caso · 1$/)).toBeTruthy();

    // El funcionario marca "hay apoderado":
    fireEvent.click(screen.getByRole('button', { name: /^Sí$/ }));

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/licencias/expedientes/exp-1/contexto',
      expect.objectContaining({ method: 'PATCH' }),
    );

    // Después: el condicional pasa a APLICA (PENDIENTE, con su propio control de carga) — el requisito "aparece" como exigible.
    await waitFor(() => expect(within(filaCondicional()).getByText('Pendiente')).toBeTruthy());
    expect(within(filaCondicional()).getByText('Subir documento')).toBeTruthy();
    expect(within(filaCondicional()).queryByText('Falta definir')).toBeNull();

    /* Al definir el hecho, el condicional deja de ser indeterminado y pasa a
       EXIGIRSE: el denominador sube de 2 a 3 y el grupo «Sin definir»
       desaparece. Eso es lo que esta prueba custodia. */
    const barraDespues = screen.getByRole('progressbar', { name: /documentos aportados/i });
    expect(barraDespues.getAttribute('aria-valuenow')).toBe('0');
    expect(barraDespues.getAttribute('aria-valuemax')).toBe('3');
    expect(screen.getByText(/^Faltan · 3$/)).toBeTruthy();
    expect(screen.queryByText(/^Sin definir/)).toBeNull();
  });
});
