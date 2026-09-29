import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { leerDestinoLicencias, urlLicencias, PARAMETROS_LICENCIAS } from '@/app/interno/licencias/rutas-licencias';
import { RedireccionLicencias } from '@/app/interno/licencias/components/RedireccionLicencias';
import BandejaLicenciasPage from '@/app/interno/licencias/page';
import DetalleLicenciaPage from '@/app/interno/licencias/[expedienteId]/page';
import LibroConsecutivoPage from '@/app/interno/licencias/libro-consecutivo/page';
import { VistaLicencias } from '@/app/interno/dashboard/components/licencias/VistaLicencias';

/* ══════════════════════════════════════════════════════════════
   Armazón único de Licencias (ADR-0046 §7). Licencias vive en el panel
   interno con el mismo menú, encabezado, barra móvil y selector de tema.
   Se conservan:
   - los enlaces directos: las rutas antiguas redirigen a la dirección
     canónica `/interno/dashboard?vista=licencias…`;
   - la navegación: la pantalla sale de la dirección (recarga y
     atrás/adelante);
   - la impresión: reglas acotadas a Licencias en `globals.css`.
══════════════════════════════════════════════════════════════ */

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }));
vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

afterEach(() => { cleanup(); replace.mockReset(); push.mockReset(); vi.unstubAllGlobals(); });

const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');

describe('Dirección canónica', () => {
  it('bandeja, libro y expediente', () => {
    expect(urlLicencias()).toBe('/interno/dashboard?vista=licencias');
    expect(urlLicencias({ seccion: 'LIBRO_CONSECUTIVO' })).toBe('/interno/dashboard?vista=licencias&seccion=libro');
    expect(urlLicencias({ expedienteId: 'lic-7' })).toBe('/interno/dashboard?vista=licencias&expediente=lic-7');
  });

  it('el expediente tiene prioridad y el id viaja codificado', () => {
    expect(urlLicencias({ expedienteId: 'a b/c', seccion: 'LIBRO_CONSECUTIVO' })).toBe('/interno/dashboard?vista=licencias&expediente=a+b%2Fc');
  });

  it('ida y vuelta: lo que se escribe es lo que se lee', () => {
    for (const destino of [{}, { seccion: 'LIBRO_CONSECUTIVO' as const }, { expedienteId: 'lic-7' }]) {
      const url = new URL(urlLicencias(destino), 'https://x');
      const leido = leerDestinoLicencias(url.searchParams);
      expect(leido.activa).toBe(true);
      expect(leido.expedienteId).toBe(destino.expedienteId ?? null);
      expect(leido.seccion).toBe(destino.seccion ?? 'BANDEJA');
    }
    expect(leerDestinoLicencias(new URLSearchParams('radicadoId=1')).activa).toBe(false);
    expect(PARAMETROS_LICENCIAS).toEqual(['vista', 'expediente', 'seccion']);
  });
});

describe('Rutas antiguas: redirigen sin dejar rastro en el historial', () => {
  it('/interno/licencias → Bandeja', async () => {
    render(BandejaLicenciasPage());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/interno/dashboard?vista=licencias'));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Abriendo Licencias en el panel…' }).getAttribute('href')).toBe('/interno/dashboard?vista=licencias');
  });

  it('/interno/licencias/{id} → detalle del expediente', async () => {
    render(await DetalleLicenciaPage({ params: Promise.resolve({ expedienteId: 'lic-2026-0001' }) }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/interno/dashboard?vista=licencias&expediente=lic-2026-0001'));
  });

  it('/interno/licencias/libro-consecutivo → pestaña del libro', async () => {
    render(LibroConsecutivoPage());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/interno/dashboard?vista=licencias&seccion=libro'));
  });

  it('el layout conserva el guard (sin acceso no hay redirección) y ya no tiene armazón propio', () => {
    const layout = leer('app/interno/licencias/layout.tsx');
    expect(layout).toContain('<GuardModuloPlaneacion>{children}</GuardModuloPlaneacion>');
    expect(layout).not.toMatch(/LicenciasSidebar|LicenciasTopBarMovil|<main/);
  });

  it('el componente de redirección es la única salida de las rutas antiguas', () => {
    render(<RedireccionLicencias expedienteId="x" />);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

/* ── VistaLicencias por dirección ── */
function expediente(extra: Partial<ExpedienteLicenciaDoc> = {}): ExpedienteLicenciaDoc {
  return {
    id: 'exp-1', tenantId: 'SEC_PLANEACION', tramiteId: 'LICENCIA_CONSTRUCCION_PARCIAL', estado: 'RADICADO',
    solicitanteNombre: 'Carlos Alberto Rojas', solicitanteDocumento: '91234567', contexto: {}, aportes: [], radicadoId: null,
    creadoEn: '2026-08-01T10:00:00.000Z', actualizadoEn: '2026-08-01T10:00:00.000Z',
    numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, subtipos: ['CONSTRUCCION'],
    origen: 'RECONSTRUIDO', estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA', esPrueba: false, ...extra,
  };
}
function prepararModulo() {
  vi.mocked(useAuth).mockReturnValue({
    usuario: { uid: 'u1', email: 'planeacion@simacota.gov.co', nombre: 'Funcionaria', rol: 'FUNCIONARIO', tenantId: 'SEC_PLANEACION' },
    cargando: false, error: null, cerrarSesion: vi.fn(),
  } satisfies UseAuthReturn);
  const exp = expediente();
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/licencias/expedientes') return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, expedientes: [exp] }) });
    if (url === `/api/licencias/expedientes/${exp.id}`) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, expediente: exp, actuaciones: [], documentos: [], definicionId: null, radicadoVinculado: null }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ultimaCorrida: null, nuncaHaCorrido: true }) });
  }));
}

describe('VistaLicencias toma la pantalla de la dirección y navega escribiendo en ella', () => {
  it('pestañas: pide el destino y no cambia por su cuenta', () => {
    prepararModulo();
    const onNavegar = vi.fn();
    render(<VistaLicencias seccion="BANDEJA" expedienteId={null} onNavegar={onNavegar} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Libro consecutivo' }));
    expect(onNavegar).toHaveBeenCalledWith({ seccion: 'LIBRO_CONSECUTIVO' });
    expect(screen.getByRole('tab', { name: 'Bandeja' }).getAttribute('aria-selected')).toBe('true');
  });

  it('la sección del libro viene de la dirección', () => {
    prepararModulo();
    render(<VistaLicencias seccion="LIBRO_CONSECUTIVO" expedienteId={null} onNavegar={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Libro consecutivo' }).getAttribute('aria-selected')).toBe('true');
  });

  it('abrir un expediente y volver son destinos de la dirección', async () => {
    prepararModulo();
    const onNavegar = vi.fn();
    const { rerender } = render(<VistaLicencias seccion="BANDEJA" expedienteId={null} onNavegar={onNavegar} />);
    fireEvent.click(await screen.findByRole('button', { name: /68745-0-26-0001/ }));
    expect(onNavegar).toHaveBeenCalledWith({ expedienteId: 'exp-1' });

    rerender(<VistaLicencias seccion="BANDEJA" expedienteId="exp-1" onNavegar={onNavegar} />);
    fireEvent.click(await screen.findByRole('button', { name: /Bandeja de Licencias/ }));
    expect(onNavegar).toHaveBeenLastCalledWith({ seccion: 'BANDEJA' });
  });

  it('la raíz marca la impresión de Licencias', () => {
    prepararModulo();
    const { container } = render(<VistaLicencias seccion="BANDEJA" expedienteId={null} onNavegar={vi.fn()} />);
    expect(container.firstElementChild?.classList.contains('licencias-impresion')).toBe(true);
  });
});

describe('El panel es el único armazón de Licencias', () => {
  const pagina = leer('app/interno/dashboard/page.tsx');

  it('la vista sale de la dirección y navegar escribe en ella', () => {
    expect(pagina).toContain('const destinoLicencias = leerDestinoLicencias(searchParams);');
    expect(pagina).toContain('expedienteId={destinoLicencias.expedienteId}');
    expect(pagina).toContain('seccion={destinoLicencias.seccion}');
    expect(pagina).toContain('onNavegar={(destino) => router.push(urlLicencias(destino), { scroll: false })}');
    // Entrar desde el menú escribe la dirección; salir la limpia.
    expect(pagina).toContain('router.replace(urlLicencias(), { scroll: false });');
    expect(pagina).toContain('for (const p of PARAMETROS_LICENCIAS) parametros.delete(p);');
  });

  it('el enlace del radicado al expediente vinculado no sale del panel', () => {
    expect(pagina).toContain('href={urlLicencias({ expedienteId: vinculo.expedienteId })}');
  });

  it('menú, encabezado y barra móvil están marcados como armazón de pantalla', () => {
    expect(pagina.match(/data-armazon="pantalla"/g)).toHaveLength(3);
  });

  it('ningún componente interno enlaza ya a las rutas antiguas', () => {
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(join(raiz, dir))) {
        const ruta = join(dir, nombre);
        if (statSync(join(raiz, ruta)).isDirectory()) recorrer(ruta);
        else if (ruta.endsWith('.tsx')) archivos.push(ruta);
      }
    };
    recorrer('app/interno');
    // Navegaciones reales (href o router.push/replace) hacia la ruta antigua.
    const culpables = archivos.filter((a) => /(href=\{?\s*|router\.(push|replace)\(\s*)[`'"]\/interno\/licencias/.test(leer(a)));
    expect(culpables).toEqual([]);
  });
});

describe('Impresión de Licencias dentro del panel', () => {
  const css = leer('app/globals.css');
  const impresion = css.slice(css.indexOf('5. Licencias dentro del panel interno'));

  it('el papel no lleva el armazón de pantalla', () => {
    expect(impresion).toContain("body:has(.licencias-impresion) [data-armazon='pantalla']");
    expect(impresion).toMatch(/\[data-armazon='pantalla'\]\s*\{\s*display: none !important;/);
  });

  it('la cadena del panel deja fluir el contenido en varias hojas, solo con Licencias montada', () => {
    for (const selector of ['html:has(.licencias-impresion)', 'body:has(.licencias-impresion) *:has(.licencias-impresion)', 'body .licencias-impresion']) {
      expect(impresion).toContain(selector);
    }
    for (const regla of ['display: block !important;', 'overflow: visible !important;', 'height: auto !important;', 'max-height: none !important;']) {
      expect(impresion).toContain(regla);
    }
  });
});

describe('Dirección canónica sin permiso (revisión UX/UI, H8)', () => {
  const pagina = leer('app/interno/dashboard/page.tsx');

  it('no monta Licencias ni un instante: la dirección se limpia', () => {
    expect(pagina).toContain("if (puedeVerLicencias) dispatch({ type: 'SET_VISTA', vista: 'LICENCIAS' });");
    expect(pagina).toContain('else router.replace(direccionSinLicencias(), { scroll: false });');
  });

  it('la rama de Licencias exige el permiso además de la vista', () => {
    expect(pagina).toContain("vistaActual === 'LICENCIAS' && puedeVerLicencias ? (");
  });
});
