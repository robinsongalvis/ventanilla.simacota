import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { BotonDescargarSellado } from '@/app/interno/licencias/components/BotonDescargarSellado';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function responder(body: unknown, ok = true) {
  const f = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal('fetch', f);
  vi.stubGlobal('open', vi.fn());
  return f;
}

const PDF = { expedienteId: 'exp-1', documentoId: 'doc-1', mimeType: 'application/pdf' };

describe('el tipo que no admite sello', () => {
  it('dice POR QUÉ, en vez de esconder el botón', () => {
    /* Instrucción literal del propietario: nunca un botón que aparece y
       desaparece sin explicación. Una funcionaria que lo ve unas veces sí y
       otras no concluye que el sistema falla. */
    render(<BotonDescargarSellado {...PDF} mimeType="image/jpeg" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.body.textContent).toMatch(/es una imagen JPG/i);
    expect(document.body.textContent).toMatch(/solo puede estamparse sobre PDF/i);
  });

  it('nombra cada tipo por lo que es, no por su MIME', () => {
    render(<BotonDescargarSellado {...PDF} mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />);
    expect(document.body.textContent).toMatch(/hoja de cálculo Excel/i);
  });

  it('un tipo desconocido no rompe la explicación', () => {
    render(<BotonDescargarSellado {...PDF} mimeType="application/zip" />);
    expect(document.body.textContent).toMatch(/no es PDF/i);
  });
});

describe('el PDF sí ofrece el botón', () => {
  it('pide la copia y la abre', async () => {
    const f = responder({ url: 'https://firmada/x.pdf', paginasSinSello: [] });
    render(<BotonDescargarSellado {...PDF} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar con sello/i }));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(String(f.mock.calls[0][0])).toContain('/documentos/doc-1/sellado');
  });

  it('avisa de que la primera vez tarda, en vez de quedarse mudo', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<BotonDescargarSellado {...PDF} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar con sello/i }));
    await waitFor(() => expect(document.body.textContent).toMatch(/primera vez tarda/i));
  });
});

describe('las páginas que quedaron sin sello', () => {
  it('se nombran, y se dice cuántas sí lo llevan', async () => {
    /* No pasa en silencio: es la mitad de la instrucción que acompaña a «no
       abortes el documento entero». */
    responder({ url: 'https://firmada/x.pdf', paginasSinSello: [3, 7], totalPaginas: 10 });
    render(<BotonDescargarSellado {...PDF} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar con sello/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/páginas 3, 7/));
    expect(screen.getByRole('alert').textContent).toMatch(/otras 8 sí lo llevan/i);
  });

  it('una sola se dice en singular', async () => {
    responder({ url: 'https://x', paginasSinSello: [4], totalPaginas: 5 });
    render(<BotonDescargarSellado {...PDF} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar con sello/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/La página 4 quedó sin sello/));
  });

  it('sin páginas problemáticas no se dice nada', async () => {
    responder({ url: 'https://x', paginasSinSello: [], totalPaginas: 3 });
    render(<BotonDescargarSellado {...PDF} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar con sello/i }));
    await waitFor(() => expect((globalThis.open as ReturnType<typeof vi.fn>)).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('el error del servidor', () => {
  it('se muestra tal cual llega', async () => {
    const mensaje = 'Este expediente todavía no tiene número de la serie legal.';
    responder({ error: mensaje }, false);
    render(<BotonDescargarSellado {...PDF} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar con sello/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(mensaje));
  });
});

describe('la ruta, leída como código', () => {
  const RUTA = readFileSync('app/api/licencias/expedientes/[id]/documentos/[documentoId]/sellado/route.ts', 'utf8');
  const soloCodigo = RUTA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('NO abre el original para escritura: solo lo descarga', () => {
    /* El requisito literal: el original queda intacto. La única escritura de la
       ruta es sobre el archivo derivado. */
    expect(soloCodigo).toMatch(/bucket\.file\(documento\.storagePath\)\.download\(\)/);
    expect(soloCodigo, 'no debe haber ninguna escritura sobre el path original')
      .not.toMatch(/file\(documento\.storagePath\)\.save\(/);
  });

  it('la copia va a un prefijo aparte y lleva el HASH de la versión', () => {
    /* Contenido distinto ⇒ copia distinta: imposible servir un sello viejo
       sobre un documento que cambió. */
    /* Sin la bandera `s` —no disponible en el target de este tsconfig—: se
       comprueba en la misma línea, que es como está escrito. */
    expect(soloCodigo).toMatch(/PREFIJO_SELLADOS[^\n]*\$\{documento\.hashSha256\}\.pdf/);
  });

  it('no sella si el expediente no tiene número de la serie legal', () => {
    /* Estampar un `DEMO-` en el papel que se lleva el ciudadano sería peor que
       no sellarlo. */
    expect(soloCodigo).toMatch(/serieId === 'demo'/);
  });
});
