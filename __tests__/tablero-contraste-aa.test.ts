import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { razonDeContraste, CONTRASTE_MINIMO_AA } from './utiles/contraste-accesibilidad';

/* ══════════════════════════════════════════════════════════════
   Contraste AA del Tablero (cierre de la Ola 3, 24-sep-2026).

   El gris #94A3B8 (`--tema-texto-94a3b8`) se usaba como TEXTO en el
   Tablero: fechas, cédulas, «10d hábiles», dependencia, rótulos del
   detalle, notas. Rinde 2,56:1 sobre blanco (AA pide 4,5:1). Pasa al gris
   secundario de la paleta (#64748B, ADR-0044), el mismo tono un paso más
   oscuro: la identidad visual se conserva.

   Quedan en #94A3B8 solo adornos que no son texto y van junto a un texto
   que ya dice lo mismo: la lupa dentro del buscador (`BarraTrabajo`) y el
   punto de la insignia neutra (`StatusBadge`).
══════════════════════════════════════════════════════════════ */

const ARCHIVOS_DEL_TABLERO = [
  'app/interno/dashboard/page.tsx',
  'app/interno/dashboard/components/simi/PqrsdDeadlineDashboard.tsx',
  'app/interno/dashboard/components/ResumenEjecutivoRadicado.tsx',
  'app/interno/dashboard/components/BusquedaAvanzadaPanel.tsx',
  'app/components/design-system/PriorityBanner.tsx',
];

const valorToken = (css: string, token: string, tema: 'claro' | 'oscuro') => {
  const valores = [...css.matchAll(new RegExp(`--${token}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))].map((m) => m[1]);
  return tema === 'claro' ? valores[0] : valores[1];
};

describe('Tablero: ningún texto gris por debajo de AA', () => {
  it.each(ARCHIVOS_DEL_TABLERO)('%s no usa #94A3B8 como texto', (archivo) => {
    expect(readFileSync(archivo, 'utf8')).not.toContain('--tema-texto-94a3b8');
  });

  it('el gris secundario cumple AA sobre las superficies del Tablero, en claro y en oscuro', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    for (const tema of ['claro', 'oscuro'] as const) {
      const texto = valorToken(css, 'tema-texto-64748b', tema);
      for (const fondo of ['tema-fondo-ffffff', 'tema-fondo-f7f9fb']) {
        expect(razonDeContraste(texto, valorToken(css, fondo, tema)), `${tema} · ${fondo}`).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
      }
    }
  });

  it('el gris anterior no llegaba a AA (por eso se cambió)', () => {
    expect(razonDeContraste('#94A3B8', '#FFFFFF')).toBeLessThan(3);
  });
});

/* ── Revisión UX/UI del cierre (24-sep-2026): armazón común y Licencias ── */
describe('Armazón común y Licencias: textos AA en claro y oscuro', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const pagina = readFileSync('app/interno/dashboard/page.tsx', 'utf8');

  it('el gris secundario semántico cumple AA también sobre los tintes del panel', () => {
    const secundario = css.match(/:root\s*\{[\s\S]*?--text-secondary:\s*(#[0-9A-Fa-f]{6})/)![1];
    expect(secundario).toBe('#5B6B80');
    for (const fondo of ['#FFFFFF', '#F7F9FB', '#F4F9F6', '#EFF6FF', '#F5F3FF', '#FEF2F2', '#F2F6FE']) {
      expect(razonDeContraste(secundario, fondo), fondo).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
    }
  });

  it('el encabezado común y el detalle ya no usan los grises verdosos por debajo de AA', () => {
    expect(pagina).not.toMatch(/--tema-texto-5f8a6e|--tema-texto-7a8b7f/);
    expect(razonDeContraste('#5F8A6E', '#F7F9FB')).toBeLessThan(CONTRASTE_MINIMO_AA);
  });

  it('menú lateral: «Módulos» y la etiqueta «Planeación» cumplen AA (activa sobre dorado)', () => {
    expect(pagina).toContain("style={{ color: activo ? '#03402A' : 'rgba(255,255,255,0.60)' }}");
    expect(razonDeContraste('#03402A', '#E5A31A')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
    // Blanco al 60 % sobre el verde del menú.
    const mezcla = [0x03, 0x40, 0x2a].map((c) => Math.round(255 * 0.6 + c * 0.4));
    expect(razonDeContraste(`#${mezcla.map((c) => c.toString(16).padStart(2, '0')).join('')}`, '#03402A')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
  });

  it('barra móvil: el título es el h1 por debajo de 1280 px y la campana usa el botón del encabezado', () => {
    expect(pagina).toMatch(/<h1 className="truncate text-sm font-black leading-tight"[^>]*>\s*\{etiquetaVista\}/);
    expect(pagina).not.toContain('text-emerald-200');
  });

  it('Licencias no usa grises por debajo de AA como texto', () => {
    const usos = execSync("grep -rlE \"var\\(--text-muted\\)|var\\(--tema-texto-94a3b8\\)|var\\(--tema-texto-4e9a5f\\)\" app/interno/licencias || true").toString().trim();
    expect(usos).toBe('');
  });

  it('el texto sobre el ámbar de identidad es fijo en ambos temas (ADR-0045 §2)', () => {
    for (const archivo of ['app/interno/licencias/components/PanelVigilanciaTermino.tsx', 'app/interno/licencias/components/PanelDetalleExpediente.tsx', 'app/interno/licencias/components/RadicarDebidaFormaModal.tsx']) {
      const fuente = readFileSync(archivo, 'utf8');
      expect(fuente, archivo).not.toContain('--tema-texto-4a2e02');
      expect(fuente, archivo).toContain("background: 'var(--color-warning)', color: '#4A2E02'");
    }
    expect(razonDeContraste('#4A2E02', '#F59E0B')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
  });
});
