import { useEffect } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { VentanillaProvider, useVentanilla } from '@/lib/store/ventanillaStore';
import { construirContextoInterno, puedeAccederVista } from '@/lib/permisos/contexto-interno';
import { VistaMiGestion } from '@/app/interno/dashboard/components/mi-gestion/VistaMiGestion';
import { PanelCargaDependencias } from '@/app/interno/dashboard/components/dependencias/PanelCargaDependencias';

/* ══════════════════════════════════════════════════════════════
   Ola 3 · grupo A (ADR-0046) — Mi gestión y Dependencias con el lenguaje
   del Tablero. Pruebas funcionales por rol y dependencia: la migración es
   visual, así que QUIÉN ve QUÉ debe ser exactamente lo de antes.
══════════════════════════════════════════════════════════════ */

afterEach(cleanup);

const AHORA = new Date('2026-09-23T15:00:00.000Z');

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AHORA);
});

afterAll(() => {
  vi.useRealTimers();
});

const ROLES: RolInterno[] = ['ADMIN', 'CONTROL_INTERNO', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'FUNCIONARIO'];
const DEPENDENCIAS: TenantId[] = ['VENTANILLA_UNICA', 'SEC_PLANEACION', 'SEC_GOBIERNO'];

let n = 0;
function radicado(uid: string, oficina: TenantId, venceEnDias: number): VentanillaRadicado {
  n += 1;
  const id = `1-110-2026-${String(n).padStart(8, '0')}`;
  const vence = new Date(AHORA); vence.setDate(vence.getDate() + venceEnDias);
  return {
    radicadoId: id, estadoActual: 'ASIGNADO', ultimaActualizacion: AHORA.toISOString(), prioridad: 'AMARILLO',
    esAnonimo: false, tipoPresentacion: 'IDENTIFICADA', identidadReservada: false, canalRespuesta: 'CORREO',
    solicitante: { tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1', nombreCompleto: 'María Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' } },
    control: { radicadoId: id, consecutivo: n, fechaRadicado: '2026-09-10T13:42:00.000Z', horaRadicado: '08:42',
      medioRecepcion: 'PRESENCIAL', origen: 'FISICO_ESCANER' },
    termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general', diasRespuesta: 15,
      unidad: 'HABILES', fechaVencimiento: vence.toISOString(), prorrogasAplicadas: 0 },
    clasificacion: { oficinaDestino: oficina, zonaGeografica: 'CASCO_URBANO', funcionarioResponsableUid: uid },
    detalle: { asunto: `Asunto de ${uid}`, descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
  };
}

describe('Mi gestión · cada usuario ve SOLO lo suyo, sea cual sea su rol o dependencia', () => {
  const propios = [radicado('uid-yo', 'SEC_PLANEACION', -3), radicado('uid-yo', 'SEC_PLANEACION', 5)];
  const ajenos = [radicado('uid-otro', 'SEC_PLANEACION', -1), radicado('uid-otro', 'SEC_GOBIERNO', 2), radicado('uid-tercero', 'VENTANILLA_UNICA', 8)];

  const casos = ROLES.flatMap((rol) => DEPENDENCIAS.map((tenantId) => [rol, tenantId] as const));
  it.each(casos)('%s de %s', (rol, tenantId) => {
    expect(puedeAccederVista({ rol, tenantId }, 'MI_GESTION')).toBe(true);
    const { container } = render(
      <VistaMiGestion radicados={[...propios, ...ajenos]} usuario={{ uid: 'uid-yo', nombre: 'Ana López', tenantId }} onAbrirRadicado={vi.fn()} ahora={AHORA} />,
    );
    expect(screen.getByText(`Ana López · ${NOMBRES_TENANT[tenantId]}`)).toBeTruthy();
    // «Asignados» cuenta solo los dos propios.
    expect(screen.getByText('Asignados').previousElementSibling?.textContent).toBe('2');
    for (const r of propios) expect(container.textContent).toContain(r.radicadoId);
    for (const r of ajenos) expect(container.textContent).not.toContain(r.radicadoId);
  });

  it('los indicadores son de solo lectura: no hay botones que no hagan nada', () => {
    render(<VistaMiGestion radicados={propios} usuario={{ uid: 'uid-yo', nombre: 'Ana López', tenantId: 'SEC_PLANEACION' }} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    // Los únicos botones abren radicados propios.
    for (const b of screen.getAllByRole('button')) expect(b.getAttribute('aria-label')).toMatch(/^Abrir radicado /);
  });
});

describe('Dependencias · solo roles con alcance municipal; navegación intacta', () => {
  const casos = ROLES.flatMap((rol) => DEPENDENCIAS.map((tenantId) => [rol, tenantId] as const));
  it.each(casos)('acceso de %s de %s = alcance municipal', (rol, tenantId) => {
    const ctx = construirContextoInterno({ rol, tenantId });
    expect(puedeAccederVista({ rol, tenantId }, 'DEPENDENCIAS')).toBe(ctx.alcance === 'MUNICIPAL');
    expect(ctx.permisos.verDependencias).toBe(['ADMIN', 'CONTROL_INTERNO', 'RECEPCIONISTA'].includes(rol));
  });

  function Sonda({ onEstado }: { onEstado: (s: ReturnType<typeof useVentanilla>['state']) => void }) {
    const { state, dispatch } = useVentanilla();
    useEffect(() => { dispatch({ type: 'SET_VISTA', vista: 'DEPENDENCIAS' }); }, [dispatch]);
    useEffect(() => { onEstado(state); }, [state, onEstado]);
    return null;
  }

  const municipio = [
    radicado('a', 'SEC_PLANEACION', -2), radicado('b', 'SEC_PLANEACION', 9),
    radicado('c', 'SEC_GOBIERNO', 1), radicado('d', 'SEC_HACIENDA', 20),
  ];

  it('lista las 15 dependencias con sus indicadores de solo lectura', () => {
    render(<VentanillaProvider><PanelCargaDependencias radicados={municipio} /></VentanillaProvider>);
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(Object.keys(NOMBRES_TENANT).length);
    expect(screen.getByText('Con vencidos').previousElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Con actividad').previousElementSibling?.textContent).toBe('3');
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);
  });

  it('el chip de una celda lleva al Tablero filtrado por dependencia y estado', () => {
    const estados: ReturnType<typeof useVentanilla>['state'][] = [];
    render(<VentanillaProvider><Sonda onEstado={(s) => estados.push(s)} /><PanelCargaDependencias radicados={municipio} /></VentanillaProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Ver 1 radicado (vencidos) de Secretaría de Planeación' }));
    const final = estados.at(-1)!;
    expect([final.vistaActual, final.tenantFiltro, final.filtroMIPG]).toEqual(['TABLERO', 'SEC_PLANEACION', 'VENCIDAS']);
  });

  it('«Ver →» lleva al Tablero con toda la dependencia (sin filtro de estado)', () => {
    const estados: ReturnType<typeof useVentanilla>['state'][] = [];
    render(<VentanillaProvider><Sonda onEstado={(s) => estados.push(s)} /><PanelCargaDependencias radicados={municipio} /></VentanillaProvider>);
    const fila = screen.getByText('Secretaría de Gobierno').closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: 'Ver →' }));
    const final = estados.at(-1)!;
    expect([final.vistaActual, final.tenantFiltro, final.filtroMIPG]).toEqual(['TABLERO', 'SEC_GOBIERNO', 'TODOS']);
  });
});
