import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync('app/interno/dashboard/page.tsx', 'utf8');

function bloqueTabla(): string {
  const inicio = fuente.indexOf('function TablaRadicados({');
  const fin = fuente.indexOf('/* ══════════════════════════════════════════════════════════════\n   SUB-COMPONENTE: PanelDerecho', inicio);
  return fuente.slice(inicio, fin);
}

function bloquePanelRespuesta(): string {
  const inicio = fuente.indexOf('function PanelDerecho({');
  const fin = fuente.indexOf('/* ══════════════════════════════════════════════════════════════\n   SUB-COMPONENTE: DrawerNuevoRadicado', inicio);
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
    expect(tabla).toContain('desplazamientoExterno');
    expect(fuente).toContain('forzarTarjetas={panelDerechoAbierto}');
    expect(fuente).toContain('desplazamientoExterno={panelDerechoAbierto}');
    expect(fuente).toContain('enPanelDetalle={panelDerechoAbierto}');
    expect(fuente).toContain("? 'grid-cols-2'");
    expect(fuente).toContain("? 'overflow-y-scroll' : vistaActual === 'TABLERO' ? 'overflow-y-auto' : 'overflow-hidden'");
  });

  it('la bandeja ocupa el alto restante con scroll interno y cabecera sticky', () => {
    const tabla = bloqueTabla();
    expect(tabla).toContain("'flex-1 min-h-[18rem] overflow-hidden'");
    expect(tabla).toContain("'flex-1 min-h-0 overflow-y-auto'");
    // Cabecera fija: primitiva compartida `CabeceraTablaSticky` (Ola 2, ADR-0046).
    expect(tabla).toContain('<CabeceraTablaSticky columnas={COLUMNAS_TABLA_RADICADOS} />');
    expect(readFileSync('app/components/design-system/SuperficieTabla.tsx', 'utf8'))
      .toContain('<thead className="sticky top-0 z-20">');
  });

  it('separa las métricas globales del semáforo de las de la vista actual', () => {
    expect(fuente).toContain('Estado general de todos los radicados del sistema');
    expect(fuente).toContain('Vista actual: <span className="font-black">{etiquetaFiltroMIPG(filtroActivo)}</span>');
    expect(fuente).toContain('Seguimiento de gestión');
  });

  it('Resumen y Seguimiento son colapsables sin perder indicadores ni filtros', () => {
    // El panel es la primitiva compartida (Ola 2, ADR-0046); el Tablero la usa.
    const panel = readFileSync('app/components/design-system/PanelIndicadoresColapsable.tsx', 'utf8');
    expect(fuente).toContain("from '@/app/components/design-system/PanelIndicadoresColapsable'");
    expect(panel).toContain('aria-expanded={abierto}');
    expect(panel).toContain('aria-controls={id}');
    expect(fuente).toContain('id="resumen-tramites-indicadores"');
    expect(fuente).toContain('id="seguimiento-gestion-indicadores"');
    // Resumen: los cuatro filtros MIPG de siempre.
    for (const filtro of ['VENCIDAS', 'POR_VENCER', 'RADICADAS', 'ASIGNADAS']) {
      expect(fuente).toContain(`['${filtro}', `);
    }
    expect(fuente).toContain('onClick: () => onFiltroChange(filtro)');
    // Los cuatro indicadores conservan valor y filtro de siempre.
    expect(fuente).toContain("etiqueta: 'En término', valor: enTermino.valor");
    expect(fuente).toContain("onClick: () => onFiltroChange('EN_TERMINO')");
    expect(fuente).toContain("valor: kpisOperativos.sinAsignar");
    expect(fuente).toContain("onFiltroOperativoChange(filtroOperativo === 'SIN_ASIGNAR' ? 'NINGUNO' : 'SIN_ASIGNAR')");
    expect(fuente).toContain("valor: porVencerHoy");
    expect(fuente).toContain("onFiltroChange(filtroActivo === 'POR_VENCER_HOY' ? 'TODOS' : 'POR_VENCER_HOY')");
    expect(fuente).toContain("valor: kpisOperativos.correoFallido");
    expect(fuente).toContain("onFiltroChange(filtroActivo === 'CORREOS_FALLIDOS' ? 'TODOS' : 'CORREOS_FALLIDOS')");
    // Cerrado, los valores siguen a la vista en una línea.
    expect(panel).toContain('{!abierto && (');
    expect(panel).toContain('indicadores.map((ind) => (');
  });

  it('los chips rápidos solo usan filtros existentes, con el mismo contador y handler que sus tarjetas', () => {
    const inicio = fuente.indexOf('function FiltrosRapidos({');
    const chips = fuente.slice(inicio, fuente.indexOf('function SelectorDependencia(', inicio));
    // Mismo origen que el Resumen y el Seguimiento: el número del chip es el de su filtro.
    expect(chips).toContain('construirIndicadoresTablero(indicadores)');
    expect(chips).toContain('[vencidos, porVencer, sinAsignar, radicados, asignados]');
    expect(chips).toContain('onClick={ind.onClick}');
    expect(chips).toContain("onClick={() => onFiltroChange('TODOS')}");
    // Jurídica y Sin analizar SIMI no tienen filtro: siguen solo como métricas del Semáforo.
    expect(chips).not.toMatch(/Jur[ií]dica|SIMI/);
    // Los interruptores existentes siguen presentes.
    expect(chips).toContain('onClick={onToggleDatosIncompletos}');
    expect(chips).toContain('onClick={onToggleSoloMios}');
  });

  it('las aclaraciones de las tarjetas pasan a tooltip y etiqueta accesible, no se pierden', () => {
    // Desde la Ola 2 (ADR-0046) la tarjeta es la primitiva compartida `Indicador`.
    const indicador = readFileSync('app/components/design-system/Indicador.tsx', 'utf8');
    expect(fuente).toContain("from '@/app/components/design-system/Indicador'");
    // Ola 3: la aclaración es opcional (indicadores estáticos); cuando existe,
    // la etiqueta accesible es la misma de siempre.
    expect(indicador).toContain('aria-label={descripcion ? `${etiqueta}: ${valor}. ${descripcion}` : `${etiqueta}: ${valor}`}');
    expect(indicador).toContain('title={descripcion}');
    expect(fuente).toContain('ayuda={AYUDA_RESUMEN}');
    const panel = readFileSync('app/components/design-system/PanelIndicadoresColapsable.tsx', 'utf8');
    expect(panel).toContain('title={ayuda}');
    expect(panel).toContain('<span className="sr-only">{ayuda}</span>');
  });

  it('mantiene todas las acciones de detalle dentro de cada fila', () => {
    const tabla = bloqueTabla();
    expect(fuente).toContain('function AccionesRadicado');
    expect(fuente).toContain('Ver');
    expect(fuente).toContain('Abrir detalle');
    expect(fuente).toContain('Más acciones para');
    expect(tabla).toContain('<AccionesRadicado');
    expect(tabla).toContain('flex-wrap items-end justify-between');
    expect(tabla).toContain('grid-cols-2 gap-x-4');
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

  it('presenta la respuesta como el flujo principal sin cambiar el endpoint de resolución', () => {
    const panel = bloquePanelRespuesta();
    expect(panel).toContain("useState<TabPanelId>('responder')");
    expect(panel).toContain('La respuesta que recibirá el ciudadano');
    expect(panel).toContain('Adjuntar oficio firmado (PDF, máx. 10 MB)');
    expect(panel).toContain('Enviar respuesta y resolver');
    expect(panel).toContain('responderCaso');
    expect(panel).toContain("/resolver");
  });

  it('guarda borradores solo en la sesión local y conserva una barra de acciones adaptable', () => {
    const panel = bloquePanelRespuesta();
    expect(panel).toContain('ventanilla:respuesta-borrador:');
    expect(panel).toContain('window.sessionStorage');
    expect(panel).toContain("setRespuesta(borradorGuardado ?? '')");
    expect(panel).toContain('setArchivoPdf(null);');
    expect(panel).toContain('Guardar borrador');
    expect(panel).toContain('flex-col-reverse gap-2 sm:flex-row');
    expect(panel).toContain('min-w-0');
    expect(panel).toContain('contenidoPanelRef.current?.scrollTo({ top: 0 })');
    expect(panel).toContain('minHeight: modoAmplio ? 180 : 150');
    expect(panel).toContain('bg-[var(--tema-fondo-c9d8cd)]');
    expect(panel).toContain('pb-28');
  });

  it('auto-oculta la navegación solo al gestionar un radicado y conserva acceso por pestaña, foco y fijación', () => {
    expect(fuente).toContain("const SIDEBAR_FIJADO_KEY = 'sidebarFijado';");
    expect(fuente).toContain('const detalleRadicadoActivo = vistaActual === \'TABLERO\'');
    expect(fuente).toContain('window.setTimeout(() => {');
    expect(fuente).toContain('}, 300);');
    expect(fuente).toContain('onMouseEnter={abrirSidebarTemporal}');
    expect(fuente).toContain('onMouseLeave={cerrarSidebarTemporalConRetardo}');
    expect(fuente).toContain('onFocusCapture={abrirSidebarTemporal}');
    expect(fuente).toContain('onBlurCapture={cerrarSidebarCuandoPierdeElFoco}');
    expect(fuente).toContain('inert={!sidebarVisible}');
    expect(fuente).toContain('mostrarControlMenu={detalleRadicadoActivo}');
    expect(fuente).toContain('Fijar menú');
    expect(fuente).toContain('<PanelLeftOpen');
    expect(fuente).toContain('xl:hidden');
  });
});
