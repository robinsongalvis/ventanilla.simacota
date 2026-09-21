import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync('app/interno/dashboard/page.tsx', 'utf8');

function bloqueTabla(): string {
  const inicio = fuente.indexOf('function TablaRadicados({');
  const fin = fuente.indexOf('/* ══════════════════════════════════════════════════════════════\n   SUB-COMPONENTE: PanelDerecho', inicio);
  return fuente.slice(inicio, fin);
}

describe('Tablero de trámites — presentación responsive', () => {
  it('usa tarjetas verticales en tablet y móvil, y tabla fija en escritorio amplio', () => {
    const tabla = bloqueTabla();
    expect(tabla).toContain('xl:hidden');
    expect(tabla).toContain('hidden xl:block');
    expect(tabla).toContain('table-fixed');
    expect(tabla).not.toContain('md:min-w-[920px]');
    expect(tabla).not.toContain('overflow-x-auto');
  });

  it('cambia a tarjetas si el panel de detalle reduce el ancho útil del tablero', () => {
    const tabla = bloqueTabla();
    expect(tabla).toContain('forzarTarjetas');
    expect(fuente).toContain('forzarTarjetas={panelDerechoAbierto}');
  });

  it('mantiene todas las acciones de detalle dentro de cada fila', () => {
    const tabla = bloqueTabla();
    expect(fuente).toContain('function AccionesRadicado');
    expect(fuente).toContain('Ver');
    expect(fuente).toContain('Abrir detalle');
    expect(fuente).toContain('Más acciones para');
    expect(tabla).toContain('<AccionesRadicado');
  });

  it('compacta las filas y conserva el tiempo legal en una línea cuando cabe', () => {
    const tabla = bloqueTabla();
    expect(tabla).toContain('px-2 py-2 align-top');
    expect(tabla).toContain('whitespace-nowrap text-sm font-semibold tabular-nums');
  });

  it('usa la misma biblioteca outline para los iconos operativos del tablero', () => {
    expect(fuente).toContain("from 'lucide-react'");
    expect(fuente).toContain('AlertTriangle');
    expect(fuente).toContain('Clock3');
    expect(fuente).toContain('SlidersHorizontal');
    expect(fuente).toContain('MoreVertical');
  });

  it('calcula el seguimiento de vencimiento de hoy con el mismo conjunto autorizado', () => {
    expect(fuente).toContain("calcDiasRestantes(radicado) === 0");
    expect(fuente).toContain("filtro === 'POR_VENCER_HOY'");
    expect(fuente).toContain("filtroActivo === 'POR_VENCER_HOY'");
    expect(fuente).toContain('Por vencer hoy');
    expect(fuente).toContain('Con errores');
  });

  it('da prioridad visual a un término vencido sin mutar el estado del radicado', () => {
    expect(fuente).toContain("if (semaforo.estado === 'VENCIDO')");
    expect(fuente).toContain("etiqueta: 'Vencido'");
    expect(fuente).toContain('radicado.estadoActual');
  });

  it('mantiene la alerta de atención breve y sin duplicar el código de la dependencia', () => {
    const inicio = fuente.indexOf('/* Banner de prioridad');
    const fin = fuente.indexOf('/* Tabla maestra */', inicio);
    const alerta = fuente.slice(inicio, fin);
    expect(alerta).toContain('mensaje="Atención requerida"');
    expect(alerta).toContain('descripcion={descripcionBanner}');
    expect(alerta).toContain('Trámite vencido hace');
    expect(alerta).not.toContain('NOMBRES_TENANT[siguiente.clasificacion.oficinaDestino]');
  });
});
