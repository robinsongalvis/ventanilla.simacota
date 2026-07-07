import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PanelSimi } from '@/app/interno/dashboard/components/simi/PanelSimi';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/* ══════════════════════════════════════════════════════════════
   Sprint SIMI copiloto (Fase 1) — la vista del copiloto.
══════════════════════════════════════════════════════════════ */

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  const id = '1-EMAIL-2026-00000022';
  return {
    radicadoId: id, estadoActual: 'ASIGNADO', ultimaActualizacion: '2026-07-06T22:00:00.000Z',
    prioridad: 'AMARILLO', esAnonimo: false, tipoPresentacion: 'IDENTIFICADA', identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: { tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1', nombreCompleto: 'Mónica Barbosa',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' } },
    control: { radicadoId: id, consecutivo: 22, fechaRadicado: '2026-06-25T14:00:00.000Z', horaRadicado: '09:00', medioRecepcion: 'EMAIL', origen: 'WEB' },
    termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general', diasRespuesta: 15, unidad: 'HABILES', fechaVencimiento: '2026-07-20T09:00:00.000Z', prorrogasAplicadas: 0 },
    clasificacion: { oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Copia de contrato', descripcion: 'Solicito copia del contrato de mantenimiento.', numeroFolios: 1 },
    archivos: [],
    analisisIa: {
      resumenEjecutivo: 'El ciudadano solicita copia del contrato de mantenimiento de vehículos.',
      etiquetasSemanticas: ['contratación'], dependenciaSugerida: 'SEC_PLANEACION',
      confianzaClasificacion: 0.86, fechaAnalisis: '2026-07-06T22:00:00.000Z',
    },
    ...overrides,
  };
}

const FUNCIONARIO: UsuarioAutenticado = { uid: 'u', email: 'c@x.co', nombre: 'Carlos', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO' };
const JEFE: UsuarioAutenticado = { ...FUNCIONARIO, rol: 'JEFE_DEPENDENCIA' };

describe('SIMI copiloto — PanelSimi', () => {
  /* 1 · el header y la tarjeta "lo que Simi entiende" */
  it('muestra el header del copiloto y lo que entiende del caso', () => {
    render(<PanelSimi radicado={radicado()} usuario={FUNCIONARIO} onAdoptarRespuesta={vi.fn()} />);
    expect(screen.getByText('Simi · copiloto del caso')).toBeTruthy();
    expect(screen.getByText(/Lo que Simi entiende de este caso/i)).toBeTruthy();
    expect(screen.getByText(/copia del contrato de mantenimiento/i)).toBeTruthy();
    expect(screen.getByText(/Petición general · 15d hábiles/)).toBeTruthy();
    expect(screen.getByText('Confianza 86%')).toBeTruthy();
  });

  /* 2 · el funcionario ve el botón estrella de respuesta y las 2 salidas */
  it('el botón estrella proyecta respuesta y ofrece resumen y argumentación', () => {
    render(<PanelSimi radicado={radicado()} usuario={FUNCIONARIO} onAdoptarRespuesta={vi.fn()} />);
    expect(screen.getByText(/Proyectar respuesta jurídica/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resumen del caso/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Argumentación/i })).toBeTruthy();
  });

  /* 3 · un rol de lectura no ve "respuesta jurídica" */
  it('el jefe no ve el botón de proyectar respuesta', () => {
    render(<PanelSimi radicado={radicado()} usuario={JEFE} onAdoptarRespuesta={vi.fn()} />);
    expect(screen.queryByText(/Proyectar respuesta jurídica/i)).toBeNull();
    expect(screen.getByText(/Proyectar resumen del caso/i)).toBeTruthy();
  });

  /* 4 · sin emojis en la vista */
  it('no usa emojis en la interfaz', () => {
    const { container } = render(<PanelSimi radicado={radicado()} usuario={FUNCIONARIO} onAdoptarRespuesta={vi.fn()} />);
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(container.textContent ?? '')).toBe(false);
  });

  /* 5 · el botón estrella arma el resultado con credenciales y el puente a Responder */
  it('proyecta la respuesta con fundamento, checklist, riesgo y "Usar como base en Responder"', async () => {
    const onAdoptar = vi.fn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const body = String(url).includes('juridico');
      if (!body) return Promise.resolve({ ok: true, json: async () => ({ ok: true, resultado: '' }) } as Response);
      // Distinguimos proyectar vs analizar por lo que devolvemos según orden de llamada.
      return Promise.resolve({ ok: true, json: async () => ({
        ok: true, modo: 'proyectar_respuesta',
        resultado: 'Señora Barbosa: en atención a su petición se adjunta la copia solicitada.',
        nivelRiesgo: 'bajo', advertencias: [], fraseFinal: 'Revisión humana requerida.',
      }) } as Response);
    });
    // La segunda llamada (analizar) devuelve credenciales.
    let n = 0;
    fetchMock.mockImplementation(() => {
      n += 1;
      const esAnalizar = n === 2;
      return Promise.resolve({ ok: true, json: async () => (esAnalizar ? {
        ok: true, modo: 'analizar_solicitud',
        resultado: {
          tipoSolicitudPrincipal: 'Petición general', tiposSecundarios: [], temaCentral: 'Copia de contrato',
          dependenciaSugerida: 'Planeación', motivoDependencia: '', terminoProbable: '15 hábiles',
          nivelRiesgo: 'bajo', datosFaltantes: [], requiereTraslado: false, requiereAclaracion: false,
          requiereRevisionJuridica: false, rutaInternaRecomendada: '',
          fundamentosNormativos: [{ titulo: 'Ley 1755 de 2015', tipoNorma: 'Ley', estado: 'vigente', aplicabilidad: 'Derecho de petición', notaValidacion: 'ok', nivelConfianza: 'alto' }],
          checklistMipg: { claridad: true, respuestaFondo: true, oportunidad: true, trazabilidad: true, competencia: true, proteccionDatos: true, gestionDocumental: true, requiereRevisionJuridica: false, observaciones: [] },
          mensajeSemaforo: '', advertenciasPersonalData: [],
        },
        nivelRiesgo: 'bajo', advertencias: [], fraseFinal: 'Revisión humana requerida.',
      } : {
        ok: true, modo: 'proyectar_respuesta',
        resultado: 'Señora Barbosa: en atención a su petición se adjunta la copia solicitada.',
        nivelRiesgo: 'bajo', advertencias: [], fraseFinal: 'Revisión humana requerida.',
      }) } as Response);
    });

    render(<PanelSimi radicado={radicado()} usuario={FUNCIONARIO} onAdoptarRespuesta={onAdoptar} />);
    fireEvent.click(screen.getByText(/Proyectar respuesta jurídica/i));

    await waitFor(() => expect(screen.getByText(/Borrador de apoyo — no es la respuesta oficial/i)).toBeTruthy());
    expect(screen.getByText(/Señora Barbosa/)).toBeTruthy();
    expect(screen.getByText(/Riesgo jurídico bajo/i)).toBeTruthy();
    expect(screen.getByText(/Ley 1755 de 2015/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Usar como base en Responder/i }));
    expect(onAdoptar).toHaveBeenCalledWith(expect.stringContaining('Señora Barbosa'));
  });
});
