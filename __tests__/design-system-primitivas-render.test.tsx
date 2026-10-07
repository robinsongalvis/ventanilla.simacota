import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { Indicador } from '@/app/components/design-system/Indicador';
import { ChipFiltro } from '@/app/components/design-system/ChipFiltro';
import { PanelIndicadoresColapsable } from '@/app/components/design-system/PanelIndicadoresColapsable';
import { BarraTrabajo } from '@/app/components/design-system/BarraTrabajo';
import { CabeceraTablaSticky, SuperficieTabla } from '@/app/components/design-system/SuperficieTabla';
import { PanelPestana, Pestanas } from '@/app/components/design-system/Pestanas';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { razonDeContraste, CONTRASTE_MINIMO_AA } from './utiles/contraste-accesibilidad';

/* ══════════════════════════════════════════════════════════════
   Primitivas compartidas extraídas del Tablero (ADR-0046, Ola 2).

   La extracción se verificó con un arnés temporal que comparó el HTML del
   Tablero antes y después, byte a byte, en 14 escenarios. Este archivo
   deja fijo el CONTRATO que las demás vistas usarán en la Ola 3:
   accesibilidad, acciones y agnosticismo de módulo.
══════════════════════════════════════════════════════════════ */

afterEach(cleanup);

describe('Indicador', () => {
  it('es un botón accesible: valor y aclaración en la etiqueta, estado en aria-pressed', () => {
    const onClick = vi.fn();
    render(<Indicador etiqueta="Vencidos" valor={7} descripcion="Requieren atención" tono="rojo" Icono={AlertTriangle} activo onClick={onClick} />);
    const boton = screen.getByRole('button', { name: 'Vencidos: 7. Requieren atención' });
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    expect(boton.getAttribute('title')).toBe('Requieren atención');
    fireEvent.click(boton);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('ChipFiltro', () => {
  it('muestra el contador solo si se le pasa y refleja el estado activo', () => {
    const { rerender } = render(<ChipFiltro etiqueta="Todos" activo={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('false');
    rerender(<ChipFiltro etiqueta="Vencidos" valor={4} tono="rojo" activo onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Vencidos\s*4$/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('PanelIndicadoresColapsable', () => {
  const indicadores = [
    { etiqueta: 'En término', valor: 2, descripcion: 'Dentro del plazo', tono: 'verde' as const, Icono: AlertTriangle, activo: false, onClick: vi.fn() },
    { etiqueta: 'Con errores', valor: 1, descripcion: 'Notificaciones fallidas', tono: 'rojo' as const, Icono: AlertTriangle, activo: true, onClick: vi.fn() },
  ];

  it('cerrado conserva los valores en línea; abierto muestra las tarjetas', () => {
    const onAlternar = vi.fn();
    const { rerender } = render(
      <PanelIndicadoresColapsable id="p" titulo="Seguimiento" subtitulo="Detalle" indicadores={indicadores} abierto={false} onAlternar={onAlternar} clasesGrid="grid-cols-2" />,
    );
    const alternar = screen.getByRole('button', { expanded: false });
    expect(alternar.getAttribute('aria-controls')).toBe('p');
    expect(screen.getByText('en término')).toBeTruthy();
    fireEvent.click(alternar);
    expect(onAlternar).toHaveBeenCalledOnce();

    rerender(
      <PanelIndicadoresColapsable id="p" titulo="Seguimiento" subtitulo="Detalle" indicadores={indicadores} abierto onAlternar={onAlternar} clasesGrid="grid-cols-2" />,
    );
    expect(screen.getByRole('button', { name: 'Con errores: 1. Notificaciones fallidas' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('BarraTrabajo', () => {
  it('propaga la búsqueda y deja las acciones al módulo', () => {
    const onBusquedaChange = vi.fn();
    render(
      <BarraTrabajo busqueda="" onBusquedaChange={onBusquedaChange} placeholder="Buscar…" contador="3 resultados">
        <button type="button">Acción del módulo</button>
      </BarraTrabajo>,
    );
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'abc' } });
    expect(onBusquedaChange).toHaveBeenCalledWith('abc');
    expect(screen.getByText('3 resultados')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Acción del módulo' })).toBeTruthy();
  });
});

describe('SuperficieTabla y CabeceraTablaSticky', () => {
  it('pinta todas las columnas en una cabecera fija', () => {
    render(
      <SuperficieTabla>
        <table><CabeceraTablaSticky columnas={['Radicado', 'Estado']} /><tbody /></table>
      </SuperficieTabla>,
    );
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Radicado', 'Estado']);
    const thead = screen.getByRole('table').querySelector('thead');
    expect(thead?.classList.contains('sticky') && thead.classList.contains('top-0')).toBe(true);
  });

  it('integrada no aplica el panel: el scroll pertenece a la columna', () => {
    const { container } = render(<SuperficieTabla integrada><p>x</p></SuperficieTabla>);
    expect(container.firstElementChild?.getAttribute('class')).toBe('');
  });
});

/* ── Ola 3: ajustes aditivos (el arnés byte a byte confirmó que el Tablero no cambia) ── */

describe('Indicador estático (Ola 3)', () => {
  it('sin acción no es un botón: un botón que no hace nada sería una acción falsa', () => {
    const { container } = render(<Indicador etiqueta="Pendientes" valor="—" descripcion="Sin dato aún" tono="gris" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('—Pendientes. Sin dato aún');
    expect(container.firstElementChild?.getAttribute('title')).toBe('Sin dato aún');
  });

  it('descripcionVisible la pinta como segunda línea (para impresión) y no la duplica', () => {
    const { container } = render(<Indicador etiqueta="Tasa" valor="87 %" descripcion="Resueltos / Total" descripcionVisible tono="verde" />);
    expect(container.textContent).toBe('87 %TasaResueltos / Total');
  });
});

describe('BarraTrabajo (Ola 3)', () => {
  it('Enter dispara onEnter y el botón de limpiar vacía la búsqueda', () => {
    const onEnter = vi.fn();
    const onBusquedaChange = vi.fn();
    render(<BarraTrabajo busqueda="123" onBusquedaChange={onBusquedaChange} placeholder="Buscar" ariaLabel="Buscar radicado" onEnter={onEnter} limpiable />);
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Buscar radicado' }), { key: 'Enter' });
    expect(onEnter).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(onBusquedaChange).toHaveBeenCalledWith('');
  });

  it('sin texto no ofrece limpiar', () => {
    render(<BarraTrabajo busqueda="" onBusquedaChange={vi.fn()} placeholder="Buscar" limpiable />);
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
  });
});

describe('CabeceraTablaSticky (Ola 3)', () => {
  it('admite columna de control, anchos y cifras alineadas a la derecha', () => {
    render(
      <table>
        <CabeceraTablaSticky
          control={<input type="checkbox" aria-label="Seleccionar todos" />}
          columnas={['Radicado', { etiqueta: 'Total', alineacion: 'derecha', ancho: 80 }, { etiqueta: '', etiquetaAccesible: 'Acciones' }]}
        />
      </table>,
    );
    const ths = screen.getAllByRole('columnheader');
    expect(ths).toHaveLength(4);
    expect(ths[0].querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(ths[2].className).toContain('text-right');
    expect(ths[2].style.width).toBe('80px');
    expect(ths[3].getAttribute('aria-label')).toBe('Acciones');
  });
});

describe('ChipFiltro (Ola 3)', () => {
  it('conserva un nombre accesible propio cuando se le pasa', () => {
    render(<ChipFiltro etiqueta="Correo fallido" valor={2} activo={false} onClick={vi.fn()} ariaLabel="Filtrar trabajo de hoy: Correo fallido (2)" />);
    expect(screen.getByRole('button', { name: 'Filtrar trabajo de hoy: Correo fallido (2)' })).toBeTruthy();
  });
});

describe('Pestanas (Ola 3)', () => {
  const pestanas = [
    { id: 'a', etiqueta: 'Resumen', detalle: 'Qué revisar hoy' },
    { id: 'b', etiqueta: 'Alertas' },
    { id: 'c', etiqueta: 'Reportes' },
  ] as const;

  it('patrón WAI-ARIA: una sola pestaña en el orden de Tab y panel enlazado', () => {
    render(
      <>
        <Pestanas idBase="ci" etiquetaGrupo="Secciones" pestanas={pestanas} activa="b" onCambiar={vi.fn()} />
        <PanelPestana idBase="ci" activa="b"><p>contenido</p></PanelPestana>
      </>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Alertas');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[1].id);
  });

  it('las flechas mueven el foco sin cambiar de sección; Enter (clic) la cambia', () => {
    const onCambiar = vi.fn();
    render(<Pestanas idBase="ci" etiquetaGrupo="Secciones" pestanas={pestanas} activa="a" onCambiar={onCambiar} />);
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2], { key: 'Home' });
    expect(document.activeElement).toBe(tabs[0]);
    expect(onCambiar).not.toHaveBeenCalled();
    fireEvent.click(tabs[1]);
    expect(onCambiar).toHaveBeenCalledWith('b');
  });

  it('el detalle de la pestaña activa cumple AA sobre el verde en claro y oscuro', () => {
    // rgba(255,255,255,0.88) mezclado sobre el fondo activo de cada tema.
    const mezcla = (fondo: [number, number, number]) =>
      `#${fondo.map((c) => Math.round(255 * 0.88 + c * 0.12).toString(16).padStart(2, '0')).join('')}`;
    expect(razonDeContraste(mezcla([0x00, 0x70, 0x49]), '#007049')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
    expect(razonDeContraste(mezcla([0x1a, 0x6b, 0x3c]), '#1A6B3C')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
  });
});

describe('TarjetaIndicador (Ola 3 · referencia visual oficial)', () => {
  it('resume el estado: sin acción no es botón y nunca es un filtro (sin aria-pressed)', () => {
    const { container } = render(<TarjetaIndicador etiqueta="Vencidos" valor={3} descripcion="Requieren atención" tono="rojo" Icono={AlertTriangle} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[aria-pressed]')).toBeNull();
    expect(container.textContent).toBe('3Vencidos. Requieren atención');
    expect(container.firstElementChild?.getAttribute('title')).toBe('Requieren atención');
  });

  it('con onAbrir lleva a la vista que gestiona ese estado, con nombre accesible completo', () => {
    const onAbrir = vi.fn();
    render(<TarjetaIndicador etiqueta="Sin asignar" valor={2} descripcion="Pendientes de asignación" tono="ambar" onAbrir={onAbrir} etiquetaAbrir="Abrir la bandeja de asignación" />);
    const boton = screen.getByRole('button', { name: 'Sin asignar: 2. Pendientes de asignación. Abrir la bandeja de asignación' });
    expect(boton.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(boton);
    expect(onAbrir).toHaveBeenCalledOnce();
  });

  it('descripción visible y pie propio del módulo', () => {
    const { container } = render(<TarjetaIndicador etiqueta="Tasa" valor="87%" descripcion="5 resueltos" descripcionVisible tono="verde" pie={<a href="#x">LIC-1</a>} />);
    expect(container.textContent).toBe('87%Tasa5 resueltosLIC-1');
    expect(screen.getByRole('link', { name: 'LIC-1' })).toBeTruthy();
  });

  it('la fila es un grupo con nombre y se reparte sola según el ancho', () => {
    render(<FilaTarjetas etiqueta="Resumen de la bandeja"><TarjetaIndicador etiqueta="A" valor={1} tono="gris" /></FilaTarjetas>);
    const grupo = screen.getByRole('group', { name: 'Resumen de la bandeja' });
    expect(grupo.className).toContain('grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]');
  });
});

describe('las primitivas son agnósticas al módulo', () => {
  it.each(['Indicador', 'ChipFiltro', 'PanelIndicadoresColapsable', 'BarraTrabajo', 'SuperficieTabla', 'Pestanas', 'TarjetaIndicador'])(
    '%s no conoce radicados, filtros MIPG ni roles',
    (nombre) => {
      const fuente = readFileSync(`app/components/design-system/${nombre}.tsx`, 'utf8');
      expect(fuente).not.toMatch(/VentanillaRadicado|FiltroMIPG|RolInterno|TenantId|usuario\.rol|dispatch\(/);
    },
  );
});
