import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RadicacionFuncionarioForm } from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';
import { RegistroExpresModal } from '@/app/interno/dashboard/components/RegistroExpresModal';
import PortalCiudadano from '@/app/radicacion/page';
import { ComprobanteRadicado } from '@/app/interno/dashboard/components/ComprobanteRadicado';
import { SelloRecibido } from '@/app/interno/dashboard/components/SelloRecibido';
import { RadicarDebidaFormaModal } from '@/app/interno/licencias/components/RadicarDebidaFormaModal';

// El formulario completo comparte catálogos amplios; jsdom bajo la batería
// completa puede tardar más que los 5s por defecto en su primer render.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Contingencia — interfaz sin recepción ficticia de adjuntos', () => {
  it('no ofrece file input y exige inventario, custodia y confirmación', () => {
    const onSubmit = vi.fn();
    const { container } = render(<RadicacionFuncionarioForm radicadoPreview="Se asigna al guardar" onSubmit={onSubmit} />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(/Storage no disponible/)).toBeTruthy();
    fireEvent.submit(container.querySelector('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Describe los soportes pendientes/);
  });

  it('envía el inventario confirmado sin archivos ni actor inventado', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<RadicacionFuncionarioForm radicadoPreview="Se asigna al guardar" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Inventario de soportes pendientes'), { target: { value: 'Solicitud física de dos folios para digitalizar.' } });
    fireEvent.change(screen.getByLabelText('Cantidad de soportes pendientes'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Referencia de custodia'), { target: { value: 'Caja de contingencia, carpeta 01' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que conservo todos los originales/ }));
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      archivos: [],
      soportesPendientes: {
        descripcion: 'Solicitud física de dos folios para digitalizar.', cantidad: 2,
        custodiaTipo: 'FISICA_EN_VENTANILLA', custodiaReferencia: 'Caja de contingencia, carpeta 01',
        confirmacionCustodia: true,
      },
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('actorUid');
  });

  it('cambiar la custodia exige nueva confirmación', () => {
    render(<RadicacionFuncionarioForm radicadoPreview="Se asigna al guardar" />);
    const confirmacion = screen.getByRole('checkbox', { name: /Confirmo que conservo todos los originales/ }) as HTMLInputElement;
    fireEvent.click(confirmacion);
    expect(confirmacion.checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Tipo de custodia'), { target: { value: 'CORREO_INSTITUCIONAL' } });
    expect(confirmacion.checked).toBe(false);
  });

  it('portal público informa el cierre temporal y no monta el formulario', () => {
    const { container } = render(<PortalCiudadano />);
    expect(screen.getByRole('heading', { name: 'Radicación web temporalmente no disponible' })).toBeTruthy();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('registro exprés no permite emitir ni llama a su API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<RegistroExpresModal usuario={{ uid: 'stage-sintetico', nombre: 'Prueba controlada', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA' }} onCerrar={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Registro exprés suspendido/ })).toBeTruthy();
    expect(container.querySelector('form')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('licencias no ofrece transcribir ni reservar la serie protegida', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<RadicarDebidaFormaModal expedienteId="stage-sintetico" previa={{ procede: true, yaRadicada: false }} onCerrar={vi.fn()} onRadicado={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Radicación de licencias suspendida/ })).toBeTruthy();
    expect(container.querySelector('input')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('incluye la advertencia dentro de la constancia y del sello imprimibles', () => {
    const { container } = render(<>
      <ComprobanteRadicado estadoAdjuntos="PENDIENTE_STORAGE" radicadoId="1-110-202609-00000028"
        solicitanteNombre="Prueba sintética" numeroDocumento="" tipoDocumento="CC"
        fechaRadicado="2026-09-29T15:00:00Z" horaRadicado="10:00" medioRecepcion="PRESENCIAL"
        tipoTramite="Petición general" diasRespuesta={15} unidad="HABILES" asunto="Prueba sintética"
        fechaVencimiento="2026-10-20T15:00:00Z" funcionarioNombre="Recepción de prueba" dependencia="VENTANILLA_UNICA" />
      <SelloRecibido estadoAdjuntos="PENDIENTE_STORAGE" radicadoId="1-110-202609-00000028" fechaRadicado="2026-09-29T15:00:00Z" horaRadicado="10:00" />
    </>);
    expect(container.querySelector('#comprobante-ventanilla')?.textContent).toMatch(/no acredita la carga de archivos digitales/);
    expect(container.querySelector('#sello-recibido-print')?.textContent).toMatch(/PENDIENTE DE ADJUNTO/);
  });
});
