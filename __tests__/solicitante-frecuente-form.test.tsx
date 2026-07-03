import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { RadicacionFuncionarioForm } from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Solicitante frecuente — autocompletar en Radicación Rápida.

   Regla de UX aprobada: el sistema sugiere, Laura confirma. Al
   seleccionar se llenan los campos, quedan editables y aparece la
   nota de verificación, que desaparece al editar.
══════════════════════════════════════════════════════════════ */

function radicadoConocido(): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000010',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: '2026-07-02T15:00:00.000Z',
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1101321226',
      nombreCompleto:  'Robinson David Galvis',
      email:           'robinson@example.com',
      telefonoMovil:   '3203452716',
      direccion:       'Carrera 4 620',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-WEB-2026-00000010',
      consecutivo:    10,
      fechaRadicado:  '2026-07-02T15:00:00.000Z',
      horaRadicado:   '10:00',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    '2026-07-20T09:00:00.000Z',
      prorrogasAplicadas:  0,
    },
    clasificacion: { oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Solicitud', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
  };
}

function renderConPool() {
  render(
    <RadicacionFuncionarioForm
      radicadoPreview="1-OFICIO-2026-00000099"
      radicados={[radicadoConocido()]}
    />,
  );
  const nombre = screen.getByLabelText('Nombre / razón social') as HTMLInputElement;
  fireEvent.focus(nombre);
  return { nombre };
}

describe('Solicitante frecuente — autocompletar en el formulario', () => {
  /* 1 · con 3+ caracteres aparece el dropdown con documento enmascarado */
  it('escribir 3+ caracteres en Nombre muestra la sugerencia enmascarada', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'rob' } });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByText('Robinson David Galvis')).toBeTruthy();
    expect(screen.getByText(/CC ····1226/)).toBeTruthy();
    // El número completo NUNCA está en pantalla antes de seleccionar.
    expect(screen.queryByText(/1101321226/)).toBeNull();
  });

  /* 2 · bajo el mínimo no hay sugerencias */
  it('con 2 caracteres no aparece el dropdown', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'ro' } });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  /* 3 · seleccionar llena los campos y muestra la nota de verificación */
  it('seleccionar una sugerencia llena los campos editables y avisa verificar', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'robinson' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Usar datos de Robinson David Galvis/i }));

    expect(nombre.value).toBe('Robinson David Galvis');
    expect((screen.getByLabelText('Identificación') as HTMLInputElement).value).toBe('1101321226');
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('robinson@example.com');
    expect((screen.getByLabelText('Teléfono móvil') as HTMLInputElement).value).toBe('3203452716');
    expect(screen.getByRole('status').textContent).toMatch(/verifícalos con el ciudadano/i);
    // El dropdown se cierra tras seleccionar.
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  /* 4 · editar un dato precargado retira la nota */
  it('editar el correo después de seleccionar borra la nota', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'robinson' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Usar datos de Robinson/i }));
    expect(screen.getByRole('status')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'otro@example.com' },
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  /* 5 · Escape cierra el dropdown */
  it('Escape cierra las sugerencias', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'robinson' } });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(nombre, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  /* 6 · Tab (blur) pasa al siguiente campo y cierra el dropdown */
  it('salir del campo con Tab cierra las sugerencias sin romperse', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'robinson' } });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.blur(nombre);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  /* 7 · en presentación anónima no hay sugerencias */
  it('cambiar a presentación Anónima oculta las sugerencias', () => {
    const { nombre } = renderConPool();
    fireEvent.change(nombre, { target: { value: 'robinson' } });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Presentación'), { target: { value: 'ANONIMA' } });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  /* 8 · el pool que trae anónimos/reservados no los sugiere */
  it('un radicado con identidad reservada no aparece en el dropdown', () => {
    const reservado = radicadoConocido();
    reservado.identidadReservada = true;
    render(
      <RadicacionFuncionarioForm
        radicadoPreview="1-OFICIO-2026-00000099"
        radicados={[reservado]}
      />,
    );
    const nombre = screen.getByLabelText('Nombre / razón social') as HTMLInputElement;
    fireEvent.focus(nombre);
    fireEvent.change(nombre, { target: { value: 'robinson' } });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
