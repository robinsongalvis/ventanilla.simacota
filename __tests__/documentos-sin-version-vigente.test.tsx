/**
 * Issue #308 — una pantalla institucional no se cae por un campo ausente.
 *
 * VISTO EN VIVO el 1-sep-2026 durante el ensayo del ciclo completo en stage: el
 * límite de error de `/interno` capturó
 * `TypeError: Cannot read properties of undefined (reading 'numeroVersion')`.
 *
 * `DocumentoExpedienteDoc` declara `versionVigente` como OBLIGATORIA y el flujo
 * normal de subida siempre la escribe (INV-5) — pero el dato real puede no
 * cumplirlo: un histórico migrado, una siembra con datos mínimos, una escritura
 * interrumpida a mitad. El tipo describe la intención, no garantiza el dato que
 * ya está en Firestore.
 *
 * Lo que se custodia NO es que el campo exista, sino que su ausencia **degrade
 * una fila** en vez de tumbar el expediente entero: el funcionario tiene que
 * poder seguir viendo y trabajando el resto del caso.
 *
 * Sensible a mutación (ADR-0039): si se quita cualquiera de las guardas
 * `version ? … : …` de los componentes, estas pruebas se ponen en rojo — el
 * render lanza y `render()` propaga la excepción.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ChecklistRequisitos } from '@/app/interno/licencias/components/ChecklistRequisitos';
import { OtrosDocumentos } from '@/app/interno/licencias/components/OtrosDocumentos';
import type { AporteRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';

afterEach(cleanup);

const DEFINICION: DefinicionTramite = {
  id: 'tramite-test',
  nombre: 'Trámite de prueba',
  activo: true,
  terminos: { dias: 10, unidad: 'HABILES' },
  regimenSubsanacion: { dias: 5, unidad: 'HABILES', prorrogaDias: 2, ventanaRequerimiento: { dias: 3, unidad: 'HABILES' } },
  requiereVisita: false,
  generaResolucion: false,
  clavesContexto: [],
  requisitos: [
    { id: 'req-roto', nombre: 'Certificado de tradición', tipo: 'OBLIGATORIO' },
    { id: 'req-sano', nombre: 'Cédula del solicitante', tipo: 'OBLIGATORIO' },
  ],
};

/** Documento tal y como puede estar HOY en Firestore: sin `versionVigente`.
 *  El `as unknown as` es deliberado — se simula el dato que el tipo promete
 *  pero la base no garantiza; sin él no se podría escribir esta prueba. */
function documentoSinVersion(): DocumentoExpedienteDoc {
  return {
    id: 'doc-roto',
    tenantId: 'VENTANILLA_UNICA',
    nombre: 'historico-migrado.pdf',
    requisitoId: 'req-roto',
    creadoEn: '2026-08-01T10:00:00.000Z',
    totalVersiones: 1,
    // versionVigente: AUSENTE a propósito.
  } as unknown as DocumentoExpedienteDoc;
}

describe('Issue #308 — un documento sin versionVigente no tumba la pantalla', () => {
  it('el checklist se sigue viendo entero y la fila rota se degrada', () => {
    const aportes: AporteRequisito[] = [
      { requisitoId: 'req-roto', estado: 'APORTADO', documentoIds: ['doc-roto'] },
    ];

    // Si falta la guarda, este render lanza y la prueba falla aquí mismo.
    render(
      <ChecklistRequisitos
        expedienteId="exp-1"
        definicion={DEFINICION}
        contexto={{}}
        aportes={aportes}
        documentos={[documentoSinVersion()]}
        soloLectura={false}
        onContextoActualizado={() => {}}
        onDocumentoSubido={() => {}}
      />,
    );

    /** La fila (`<li>`) de un requisito — el nombre puede aparecer además en el
     *  resumen de pendientes, así que se acota al listado. */
    const filaDe = (nombre: string) =>
      screen.getAllByText(nombre)
        .map((el) => el.closest('li'))
        .find((li): li is HTMLLIElement => li !== null);

    // 1. El resto del expediente SIGUE VISIBLE — que es el punto del issue.
    expect(filaDe('Cédula del solicitante'), 'el requisito sano debe seguir listándose').toBeTruthy();

    // 2. La fila rota se pinta, no desaparece: ocultarla sería mentir sobre
    //    lo que hay en el expediente.
    const fila = filaDe('Certificado de tradición')!;
    expect(fila).toBeTruthy();

    // 3. Y lo dice en lugar de callarlo.
    expect(within(fila).getByText('Sin versión registrada')).toBeTruthy();

    // 4. No se ofrece descargar lo que no tiene ruta: un enlace que no puede
    //    resolver a un archivo es peor que no ofrecerlo.
    expect(within(fila).queryByText('Ver')).toBeNull();
    expect(within(fila).queryByText('Descargar')).toBeNull();
  });

  it('«Otros documentos» tampoco se cae', () => {
    render(
      <OtrosDocumentos
        expedienteId="exp-1"
        documentos={[{ ...documentoSinVersion(), requisitoId: undefined } as unknown as DocumentoExpedienteDoc]}
        soloLectura={false}
        onDocumentoSubido={() => {}}
      />,
    );

    expect(screen.getByText('historico-migrado.pdf')).toBeTruthy();
    expect(screen.getByText('Sin versión registrada')).toBeTruthy();
    expect(screen.queryByText('Descargar')).toBeNull();
  });
});
