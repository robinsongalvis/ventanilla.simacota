import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RadicarDebidaFormaModal, type VistaPreviaDebidaForma } from '@/app/interno/licencias/components/RadicarDebidaFormaModal';

/**
 * EL LLAMADOR QUE FALTABA.
 *
 * El acto de radicar existía desde #248 —transaccional, idempotente, probado
 * contra el emulador— y NO TENÍA UN SOLO LLAMADOR EN LA INTERFAZ: construido e
 * inalcanzable desde el mostrador. Esto lo prueba.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const procede: VistaPreviaDebidaForma = {
  procede: true,
  yaRadicada: false,
  anclaPropuesta: '2026-08-20',
  anclaIso: '2026-08-20T12:00:00.000Z',
  baseDelAncla: 'MOMENTO_REGISTRADO_DE_COMPLETITUD',
  requisitosAplicables: 19,
  venceraEl: '2026-10-24T12:00:00.000Z',
  naceVencido: false,
};

function abrir(previa: VistaPreviaDebidaForma, onRadicado = vi.fn()) {
  render(
    <RadicarDebidaFormaModal expedienteId="exp-1" previa={previa} onCerrar={vi.fn()} onRadicado={onRadicado} />,
  );
}

function responder(body: unknown, ok = true) {
  const f = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal('fetch', f);
  return f;
}

describe('cuando la radicación NO procede', () => {
  it('muestra el motivo del servidor ENTERO, sin reescribirlo', () => {
    /* Reescribir el motivo aquí es la forma más común de convertir una razón
       precisa en un «algo salió mal». Hoy el motivo más frecuente es el candado
       que protege la serie legal. */
    const motivo =
      'Este es un expediente de demostración (esPrueba). No puede recibir un número de la serie legal de expedientes.';
    abrir({ procede: false, yaRadicada: false, motivo });
    expect(screen.getByRole('alert').textContent).toBe(motivo);
  });

  it('y no ofrece el botón de radicar', () => {
    abrir({ procede: false, yaRadicada: false, motivo: 'X' });
    expect(screen.queryByRole('button', { name: /radicar en debida forma/i })).toBeNull();
  });
});

describe('cuando YA estaba radicado', () => {
  it('lo dice y muestra el número, en vez de ofrecer radicar otra vez', () => {
    abrir({
      procede: false,
      yaRadicada: true,
      motivo: 'Este expediente ya está radicado en legal y debida forma.',
      numeroExpediente: '1-110-202608-00000123',
    });
    expect(screen.getByRole('status').textContent).toMatch(/ya está radicado/i);
    expect(document.body.textContent).toContain('1-110-202608-00000123');
  });
});

describe('la confirmación antes de pulsar', () => {
  it('muestra la fecha del ancla y DE DÓNDE sale', () => {
    abrir(procede);
    /* La funcionaria tiene que poder explicárselo al ciudadano: el sistema no
       le enseña una fecha sin decir de dónde salió. */
    expect(document.body.textContent).toMatch(/instante que el sistema registró/i);
    expect(document.body.textContent).toMatch(/19 requisitos verificados/i);
  });

  it('avisa ANTES de pulsar si el expediente nacerá vencido', () => {
    /* El caso duro, dicho antes y no después: el acto procede —es un hecho
       verdadero— pero nadie debería enterarse al pulsar. */
    abrir({ ...procede, naceVencido: true });
    expect(screen.getByRole('alert').textContent).toMatch(/nacerá vencido/i);
  });

  it('NO ofrece ningún campo de fecha libre', () => {
    /* Sería la puerta trasera exacta al «clic de verificación» que el ADR-0033
       §4.3 prohíbe: el ancla la decide el servidor. */
    abrir(procede);
    const fechas = Array.from(document.querySelectorAll('input')).filter(
      (i) => i.type === 'date' || /fecha/i.test(i.id) || /fecha/i.test(i.getAttribute('name') ?? ''),
    );
    expect(fechas, 'la fecha del ancla no se teclea: la decide el servidor').toHaveLength(0);
  });
});

describe('el envío', () => {
  it('exige el número antes de llamar al servidor', async () => {
    const f = responder({});
    abrir(procede);
    fireEvent.click(screen.getByRole('button', { name: /radicar en debida forma/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/libro de ventanilla/i));
    expect(f).not.toHaveBeenCalled();
  });

  it('manda el ancla que la funcionaria VIO, como control optimista', async () => {
    const f = responder({ ok: true, radicoAhora: true, numeroExpediente: '1-110-202608-00000123' });
    abrir(procede);
    fireEvent.change(screen.getByLabelText(/número de radicado/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /radicar en debida forma/i }));

    await waitFor(() => expect(f).toHaveBeenCalled());
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.confirmo).toBe(true);
    expect(body.numeroRadicado).toBe('123');
    /* Si entre que mira y pulsa alguien tocó la evidencia, el servidor rechaza
       en vez de afirmar una fecha que ella no vio. */
    expect(body.anclaEsperada).toBe('2026-08-20');
  });

  it('si el número se normalizó, se lo ENSEÑA', async () => {
    /* Escribió una cosa y quedó grabada otra —la misma, con el formato
       canónico—. Callarlo la dejaría creyendo que está lo que tecleó. */
    responder({
      ok: true,
      radicoAhora: true,
      numeroExpediente: '1-110-202608-00000123',
      transcrito: '123',
      seNormalizo: true,
    });
    abrir(procede);
    fireEvent.change(screen.getByLabelText(/número de radicado/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /radicar en debida forma/i }));

    await waitFor(() => expect(document.body.textContent).toMatch(/es el mismo número/i));
    expect(document.body.textContent).toContain('1-110-202608-00000123');
  });

  it('un error del servidor se muestra TAL CUAL llega', async () => {
    const mensaje = 'Ya existe un expediente con el número 1-110-202608-00000123.';
    responder({ error: mensaje }, false);
    abrir(procede);
    fireEvent.change(screen.getByLabelText(/número de radicado/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /radicar en debida forma/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(mensaje));
  });

  it('avisa al detalle para que se recargue', async () => {
    const onRadicado = vi.fn();
    responder({ ok: true, radicoAhora: true, numeroExpediente: 'X' });
    abrir(procede, onRadicado);
    fireEvent.change(screen.getByLabelText(/número de radicado/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /radicar en debida forma/i }));
    await waitFor(() => expect(onRadicado).toHaveBeenCalled());
  });
});

describe('el prefijo del radicado viene puesto', () => {
  /* DECISIÓN DEL PROPIETARIO (29-ago-2026): la funcionaria transcribe del libro
     de papel, y averiguar el formato le cuesta más que escribir el número. El
     campo nace con `1-110-AAAAMM-` y ella solo teclea los ocho dígitos.

     LO QUE ESTAS PRUEBAS PROTEGEN es que siga siendo una SUGERENCIA DE FORMATO
     y no un número inventado: el prefijo lo manda el SERVIDOR —nunca el reloj
     del navegador, que puede estar corrido— y el consecutivo sigue siendo
     obligatorio. */
  it('usa el prefijo que manda el servidor, no uno calculado aquí', () => {
    abrir({ ...procede, prefijoRadicadoSugerido: '1-110-202512-' });
    expect((screen.getByLabelText(/número de radicado/i) as HTMLInputElement).value)
      .toBe('1-110-202512-');
  });

  it('sin prefijo del servidor cae a la serie fija, sin inventarse el mes', () => {
    const { prefijoRadicadoSugerido: _omitido, ...sinPrefijo } = { ...procede, prefijoRadicadoSugerido: 'x' };
    abrir(sinPrefijo as typeof procede);
    expect((screen.getByLabelText(/número de radicado/i) as HTMLInputElement).value).toBe('1-110-');
  });

  it('el prefijo SOLO no vale como número escrito', async () => {
    /* Sin esto, el campo prellenado pasaría por «ya escribió algo» y se
       enviaría `1-110-202512-` como si fuera un radicado. */
    const f = responder({});
    abrir({ ...procede, prefijoRadicadoSugerido: '1-110-202512-' });
    fireEvent.click(screen.getByRole('button', { name: /radicar en debida forma/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/libro de ventanilla/i));
    expect(f).not.toHaveBeenCalled();
  });
});
