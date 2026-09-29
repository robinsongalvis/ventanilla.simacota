import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RolInterno, UsuarioAutenticado } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { SalidaOficial } from '@/src/types/salida';
import { VentanillaProvider } from '@/lib/store/ventanillaStore';
import { construirContextoInterno, puedeAccederVista } from '@/lib/permisos/contexto-interno';
import { VistaVentanilla } from '@/app/interno/dashboard/components/ventanilla/VistaVentanilla';
import { VistaSalidas } from '@/app/interno/dashboard/components/salidas/VistaSalidas';

const asignarRadicado = vi.fn(async () => undefined);
const asignarMasivo = vi.fn(async () => ({ asignados: 2, fallidos: 0 }));
vi.mock('@/lib/actions/asignarRadicado', () => ({
  asignarRadicado: (...a: unknown[]) => asignarRadicado(...(a as [])),
  asignarMasivo: (...a: unknown[]) => asignarMasivo(...(a as [])),
}));
// Importado después del mock para que use las acciones simuladas.
const { BandejaAsignacion } = await import('@/app/interno/dashboard/components/bandeja/BandejaAsignacion');

/* ══════════════════════════════════════════════════════════════
   Ola 3 · grupo B (ADR-0046) — Ventanilla, Bandeja y Salidas con el
   lenguaje del Tablero. Pruebas funcionales por rol y dependencia:
   cada acción visible corresponde a un permiso que YA existía, y la
   lógica de asignación y búsqueda no cambia.
══════════════════════════════════════════════════════════════ */

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const AHORA = new Date('2026-09-23T15:00:00.000Z');
const ROLES: RolInterno[] = ['ADMIN', 'CONTROL_INTERNO', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'FUNCIONARIO'];
const DEPENDENCIAS: TenantId[] = ['VENTANILLA_UNICA', 'SEC_PLANEACION', 'SEC_GOBIERNO'];
const CASOS = ROLES.flatMap((rol) => DEPENDENCIAS.map((tenantId) => [rol, tenantId] as const));

let n = 0;
function radicado(extra: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  n += 1;
  const id = `1-110-2026-${String(n).padStart(8, '0')}`;
  return {
    radicadoId: id, estadoActual: 'PENDIENTE', ultimaActualizacion: AHORA.toISOString(), prioridad: 'AMARILLO',
    esAnonimo: false, tipoPresentacion: 'IDENTIFICADA', identidadReservada: false, canalRespuesta: 'CORREO',
    solicitante: { tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1098765432', nombreCompleto: 'María Rincón',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' } },
    control: { radicadoId: id, consecutivo: n, fechaRadicado: AHORA.toISOString(), horaRadicado: '09:00',
      medioRecepcion: 'PRESENCIAL', origen: 'FISICO_ESCANER' },
    termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general', diasRespuesta: 15,
      unidad: 'HABILES', fechaVencimiento: '2026-10-14T15:00:00.000Z', prorrogasAplicadas: 0 },
    clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Solicitud', descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
    ...extra,
  };
}

describe('Ventanilla · solo ADMIN y RECEPCIONISTA; acciones según permisos existentes', () => {
  it.each(CASOS)('%s de %s', (rol, tenantId) => {
    const ctx = construirContextoInterno({ rol, tenantId });
    const entra = puedeAccederVista({ rol, tenantId }, 'VENTANILLA');
    expect(entra).toBe(rol === 'ADMIN' || rol === 'RECEPCIONISTA');
    if (!entra) return;
    // Mismo cableado que `page.tsx`.
    render(
      <VistaVentanilla
        radicados={[radicado()]}
        puedeRadicar={ctx.permisos.radicar}
        onNuevaRadicacion={vi.fn()}
        onAbrirBusquedaAvanzada={vi.fn()}
        onAbrirRadicado={vi.fn()}
        onRegistrarSalida={ctx.permisos.registrarSalida ? vi.fn() : undefined}
        onAbrirReparto={ctx.permisos.registrarSalida ? vi.fn() : undefined}
        ahora={AHORA}
      />,
    );
    expect(!!screen.queryByRole('button', { name: 'Nueva radicación' })).toBe(ctx.permisos.radicar);
    expect(!!screen.queryByRole('button', { name: 'Registrar salida' })).toBe(ctx.permisos.registrarSalida);
    expect(!!screen.queryByRole('button', { name: 'Reparto del día' })).toBe(ctx.permisos.registrarSalida);
  });

  it('sin permiso de radicar no se ofrece «Nueva radicación» (acción oculta, no deshabilitada)', () => {
    render(<VistaVentanilla radicados={[]} puedeRadicar={false} onNuevaRadicacion={vi.fn()} onAbrirBusquedaAvanzada={vi.fn()} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    expect(screen.queryByRole('button', { name: 'Nueva radicación' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar salida' })).toBeNull();
  });

  it('identidad reservada: no coincide por nombre ni documento, solo por número (ADR-0012)', () => {
    const reservado = radicado({ identidadReservada: true });
    const onAbrir = vi.fn();
    render(<VistaVentanilla radicados={[reservado]} puedeRadicar onNuevaRadicacion={vi.fn()} onAbrirBusquedaAvanzada={vi.fn()} onAbrirRadicado={onAbrir} ahora={AHORA} />);
    const buscador = screen.getByRole('searchbox', { name: 'Buscar radicado por número, cédula o nombre' });
    fireEvent.change(buscador, { target: { value: 'maría' } });
    expect(screen.queryByRole('button', { name: `Abrir radicado ${reservado.radicadoId}` })).toBeNull();
    expect(screen.getAllByText('Sin coincidencias').length).toBeGreaterThan(0);
    fireEvent.change(buscador, { target: { value: reservado.radicadoId } });
    fireEvent.keyDown(buscador, { key: 'Enter' });
    expect(onAbrir).toHaveBeenCalledWith(reservado.radicadoId);
  });
});

describe('Bandeja de asignación · acceso y asignación intactos', () => {
  const RECEPCION = { uid: 'uid-laura', nombre: 'Laura Gómez', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA' } as UsuarioAutenticado;

  it.each(CASOS)('acceso de %s de %s', (rol, tenantId) => {
    expect(puedeAccederVista({ rol, tenantId }, 'BANDEJA')).toBe(rol === 'ADMIN' || rol === 'RECEPCIONISTA');
  });

  it('asignar una fila envía la dependencia elegida y el funcionario que asigna', async () => {
    const r = radicado();
    render(<VentanillaProvider><BandejaAsignacion radicados={[r]} cargando={false} error={null} usuario={RECEPCION} /></VentanillaProvider>);
    fireEvent.change(screen.getByRole('combobox', { name: `Dependencia destino de ${r.radicadoId}` }), { target: { value: 'SEC_GOBIERNO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Asignar →' }));
    expect(asignarRadicado).toHaveBeenCalledWith(r.radicadoId, 'SEC_GOBIERNO', { uid: 'uid-laura', nombre: 'Laura Gómez' });
    expect(await screen.findByText('✓ Asignado')).toBeTruthy();
  });

  it('asignación masiva: seleccionar todos + dependencia + «Asignar N»', async () => {
    const filas = [radicado(), radicado()];
    render(<VentanillaProvider><BandejaAsignacion radicados={filas} cargando={false} error={null} usuario={RECEPCION} /></VentanillaProvider>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los pendientes' }));
    const asignar = screen.getByRole('button', { name: 'Asignar 2' }) as HTMLButtonElement;
    expect(asignar.disabled).toBe(true); // sin dependencia destino no se puede
    fireEvent.change(screen.getByRole('combobox', { name: 'Dependencia destino de los seleccionados' }), { target: { value: 'SEC_HACIENDA' } });
    fireEvent.click(asignar);
    expect(asignarMasivo).toHaveBeenCalledWith(filas.map((f) => f.radicadoId), 'SEC_HACIENDA', { uid: 'uid-laura', nombre: 'Laura Gómez' });
    expect(await screen.findByText('2 asignados')).toBeTruthy();
  });

  it('con identidad reservada no expone nombre ni documento', () => {
    const r = radicado({ identidadReservada: true });
    render(<VentanillaProvider><BandejaAsignacion radicados={[r]} cargando={false} error={null} usuario={RECEPCION} /></VentanillaProvider>);
    const fila = screen.getByText(r.radicadoId).closest('tr')!;
    expect(within(fila).queryByText('María Rincón')).toBeNull();
    expect(within(fila).queryByText(/1098765432/)).toBeNull();
  });
});

describe('Salidas · lectura para quien lee el libro; registrar solo con permiso', () => {
  const SALIDA = {
    salidaId: '2-SAL-2026-00000012', consecutivo: 12, fechaSalida: '2026-09-22T15:00:00.000Z', tipoSalida: 'RESPUESTA',
    radicadoEntradaId: '1-110-2026-00000001', destinatario: { nombre: 'María Rincón', entidad: null, email: null, direccion: null },
    asunto: 'Respuesta', dependenciaOrigen: 'SEC_HACIENDA', firmante: { uid: 'u1', nombre: 'Secretario de Hacienda' },
    medioEnvio: 'CORREO', registradoPor: { uid: 'uid-laura', nombre: 'Laura' }, archivoPath: null,
  } as SalidaOficial;

  it.each(CASOS)('%s de %s', (rol, tenantId) => {
    const ctx = construirContextoInterno({ rol, tenantId });
    const entra = puedeAccederVista({ rol, tenantId }, 'SALIDAS');
    expect(entra).toBe(ctx.permisos.verLibroSalidas);
    if (!entra) return;
    render(<VistaSalidas salidas={[SALIDA]} cargando={false} error={null} onAbrirEntrada={vi.fn()} onNuevaSalida={ctx.permisos.registrarSalida ? vi.fn() : undefined} />);
    expect(screen.getByText('2-SAL-2026-00000012')).toBeTruthy();
    // CONTROL_INTERNO lee el libro pero no ve «Registrar salida» (corrección aprobada).
    expect(!!screen.queryByRole('button', { name: 'Registrar salida' })).toBe(ctx.permisos.registrarSalida);
  });

  it('la página solo pasa la acción cuando el rol registra salidas', () => {
    const pagina = readFileSync('app/interno/dashboard/page.tsx', 'utf8');
    expect(pagina).toContain('onNuevaSalida={puedeRegistrarSalida ? () => setSalidaModal({ entrada: null }) : undefined}');
  });
});
