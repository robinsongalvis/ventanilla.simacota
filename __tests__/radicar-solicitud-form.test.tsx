import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RadicarSolicitudModal } from '@/app/interno/licencias/components/RadicarSolicitudModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Bloque "Integración UI y demo" — formulario "Recibir solicitud"
   (`RadicarSolicitudModal`), consume `POST /api/licencias/expedientes`.
══════════════════════════════════════════════════════════════ */

function llenarDatosBasicos() {
  fireEvent.change(screen.getByLabelText('Nombre del solicitante'), { target: { value: 'Carlos Alberto Rojas' } });
  fireEvent.change(screen.getByLabelText('Documento del solicitante'), { target: { value: '13456789' } });
  /* EL CONTACTO ES OBLIGATORIO DESDE EL 29-ago-2026, y el campo lleva
     `required`: sin él el navegador ni siquiera envía el formulario, que es
     justo lo que debe pasar. Estas pruebas miran otra cosa —subtipos,
     modalidades, errores del servidor— así que llenan el correo para poder
     llegar hasta donde prueban. La regla en sí la cubre
     `contacto-obligatorio-en-el-formulario`, más abajo. */
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'carlos@ejemplo.com' } });
}

describe('Recibir solicitud — validación de subtipos', () => {
  it('exige al menos un subtipo antes de enviar (no llama al servidor)', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('button', { name: /^Recibir solicitud$/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/al menos un subtipo/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /* REESCRITA el 31-ago-2026 (ADR-0038 §6-bis: cuándo SÍ se reescribe una
     prueba custodiada). Se llamaba «muestra el catálogo normativo con nombre y
     CÓDIGO» y exigía ver `CONSTRUCCION` y `RECONOCIMIENTO` en el nombre
     accesible de cada casilla.

     QUÉ SE RETIRA Y CON QUÉ FUNDAMENTO: la exigencia del código interno. El
     propietario decidió no mostrarlos, y no por estética — está verificado
     contra la fuente: el ingeniero de Planeación escribe `LSR`, `LSU`, `LC`,
     `LU`, `LR`, `PH` en su planilla, y el catálogo tiene una tabla
     (`EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS`) cuyo único trabajo es
     traducir esa columna a estos códigos. Son dos vocabularios distintos, y ni
     uno a uno: `LC y PH` se traduce en DOS. El código nuestro no casa con
     ningún papel que ella maneje.

     QUÉ SE CONSERVA: que cada figura del catálogo sea alcanzable por su NOMBRE
     como casilla accesible — que es lo que esta prueba protegía de verdad, y
     sigue protegiendo. Que el código no se pinte lo vigila aparte
     `__tests__/subtipos-sin-codigos-internos.test.tsx`. */
  it('muestra el catálogo normativo, cada figura alcanzable por su nombre', () => {
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Licencia de construcción/i })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Acto de reconocimiento de edificaciones/i })).toBeTruthy();
  });
});

describe('Recibir solicitud — envío y errores del servidor', () => {
  it('envía los subtipos seleccionados al servidor', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ ok: true, expediente: { id: 'exp-1', numeroExpediente: { numero: 'DEMO-26-abc12345' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('checkbox', { name: /Licencia de construcción/i }));
    // La figura CONSTRUCCION exige modalidad (art. 2.2.6.1.1.7, ADR-0035):
    // sin marcarla el formulario ya no envía.
    fireEvent.click(screen.getByRole('checkbox', { name: /Obra nueva/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Recibir solicitud$/i }));

    await waitFor(() => expect(screen.getByText('DEMO-26-abc12345')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledWith('/api/licencias/expedientes', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subtipos).toEqual(['CONSTRUCCION']);
    expect(body.solicitanteNombre).toBe('Carlos Alberto Rojas');
  });

  it('muestra el error del servidor tal cual llega (422 catálogo)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'El subtipo "LA" no está en el catálogo normativo de figuras (DF-4, ADR-0029).' }),
    }));
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('checkbox', { name: /Licencia de construcción/i }));
    // La figura CONSTRUCCION exige modalidad (art. 2.2.6.1.1.7, ADR-0035):
    // sin marcarla el formulario ya no envía.
    fireEvent.click(screen.getByRole('checkbox', { name: /Obra nueva/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Recibir solicitud$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/no está en el catálogo normativo/i));
  });

  it('permite cancelar sin enviar', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onCerrar = vi.fn();
    render(<RadicarSolicitudModal onCerrar={onCerrar} />);
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(onCerrar).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('el verbo del formulario dice lo que la acción hace', () => {
  /* Esta pantalla crea un expediente en PRESENTADA y escribe una actuación
     `apertura-expediente`. Bajo el ADR-0033 eso es un acto ANTERIOR y distinto
     de la radicación en legal y debida forma, que emite el número oficial y
     arranca los 45 días hábiles. Que el botón dijera «Radicar solicitud» le
     afirmaba a la funcionaria que estaba haciendo algo que no estaba haciendo
     — justo en el instante de decidir pulsar, que es donde más pesa. */
  it('no ofrece «radicar» en ninguno de sus textos', () => {
    render(<RadicarSolicitudModal onCerrar={() => {}} onCreado={() => {}} />);
    expect(screen.queryByRole('button', { name: /radicar/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^Recibir solicitud$/i })).toBeTruthy();
  });
});

describe('Recibir solicitud — la modalidad de construcción (ADR-0035)', () => {
  it('la pregunta NO aparece si la figura no la tiene', () => {
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Acto de reconocimiento/i }));
    /* El acto de reconocimiento no tiene eje de modalidad. Preguntarla sería
       pedir un dato que la norma no define para esa figura. */
    expect(screen.queryByRole('checkbox', { name: /Obra nueva/i })).toBeNull();
  });

  it('aparece al elegir construcción, y sin ella no se envía nada al servidor', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);
    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('checkbox', { name: /Licencia de construcción/i }));

    expect(screen.getByRole('checkbox', { name: /Obra nueva/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Recibir solicitud/i }));
    await waitFor(() => {
      const alertas = screen.getAllByRole('alert').map((n) => n.textContent ?? '').join(' | ');
      expect(alertas).toMatch(/modalidad/i);
    });
    expect(fetchMock, 'sin modalidad no se llama al servidor').not.toHaveBeenCalled();
  });
});

describe('contacto obligatorio en el formulario', () => {
  /* El formulario NO pedía contacto, y un expediente creado por aquí no tiene
     radicado del que heredarlo: era un ciudadano al que nunca podríamos
     escribirle. Ahora hay que decidir — y decidir incluye poder decir «no
     tiene», que es un hecho y no un vacío. */
  it('el campo de correo existe y es obligatorio', () => {
    render(<RadicarSolicitudModal onCerrar={() => {}} />);
    const correo = screen.getByLabelText('Correo electrónico') as HTMLInputElement;
    expect(correo.required).toBe(true);
    expect(correo.type).toBe('email');
  });

  it('declarar que no tiene correo lo desactiva y lo deja de exigir', () => {
    render(<RadicarSolicitudModal onCerrar={() => {}} />);
    const correo = screen.getByLabelText('Correo electrónico') as HTMLInputElement;
    fireEvent.click(screen.getByLabelText(/manifiesta no tener correo/i));
    expect(correo.disabled).toBe(true);
    expect(correo.required).toBe(false);
  });

  it('el celular se pide, y es opcional', () => {
    render(<RadicarSolicitudModal onCerrar={() => {}} />);
    const cel = screen.getByLabelText(/Celular/i) as HTMLInputElement;
    expect(cel).toBeTruthy();
    expect(cel.required).toBe(false);
  });
});
