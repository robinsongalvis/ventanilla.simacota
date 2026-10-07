import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { puedeAccederVista } from '@/lib/permisos/contexto-interno';
import { VistaAlertas, contarAlertasActivas } from '@/app/interno/dashboard/components/analytics/VistaAlertas';
import { VistaAnalytics } from '@/app/interno/dashboard/components/analytics/VistaAnalytics';

/* ══════════════════════════════════════════════════════════════
   Ola 3 (ADR-0046) — Alertas y Analítica con el lenguaje del Tablero.
   La migración es visual: quién entra, qué radicados ve cada alcance y
   qué hace cada acción deben ser exactamente lo de antes. El alcance de
   Alertas se corrigió aparte (§4.3 de la matriz): sus pruebas específicas
   están en `__tests__/alertas-alcance-contador.test.tsx`.
══════════════════════════════════════════════════════════════ */

afterEach(cleanup);

const AHORA = new Date('2026-09-23T15:00:00.000Z');
const ROLES: RolInterno[] = ['ADMIN', 'CONTROL_INTERNO', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'FUNCIONARIO'];
const DEPENDENCIAS: TenantId[] = ['VENTANILLA_UNICA', 'SEC_PLANEACION', 'SEC_GOBIERNO'];
const CASOS = ROLES.flatMap((rol) => DEPENDENCIAS.map((tenantId) => [rol, tenantId] as const));

let n = 0;
function radicado(oficina: TenantId, venceEnDias: number, extra: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
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
    clasificacion: { oficinaDestino: oficina, zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Certificado', descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
    ...extra,
  };
}

const PLANEACION = [radicado('SEC_PLANEACION', -2), radicado('SEC_PLANEACION', 1)];
const GOBIERNO = [radicado('SEC_GOBIERNO', -1, { prioridad: 'ROJO' }), radicado('SEC_GOBIERNO', 20)];
const TODOS = [...PLANEACION, ...GOBIERNO];

describe('Alertas · acceso y alcance intactos', () => {
  it.each(CASOS)('%s de %s entra a Alertas (vista de todos los roles)', (rol, tenantId) => {
    expect(puedeAccederVista({ rol, tenantId }, 'ALERTAS')).toBe(true);
  });

  it('alcance municipal: vista global con los radicados de todas las dependencias', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    const { container } = render(<VistaAlertas radicados={TODOS} alcanceMunicipal tenantIdUsuario="DESPACHO_ALCALDE" onVerRadicado={vi.fn()} />);
    vi.useRealTimers();
    expect(screen.getByText(/^Vista global · Ordenado por severidad$/)).toBeTruthy();
    for (const r of [...PLANEACION, GOBIERNO[0]]) expect(container.textContent).toContain(r.radicadoId);
  });

  it('sin alcance municipal: solo la dependencia del usuario', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    const { container } = render(<VistaAlertas radicados={TODOS} alcanceMunicipal={false} tenantIdUsuario="SEC_PLANEACION" onVerRadicado={vi.fn()} />);
    vi.useRealTimers();
    expect(screen.getByText(/^Solo Secretaría de Planeación · Ordenado por severidad$/)).toBeTruthy();
    for (const r of PLANEACION) expect(container.textContent).toContain(r.radicadoId);
    for (const r of GOBIERNO) expect(container.textContent).not.toContain(r.radicadoId);
  });

  it('«Ver radicado» entrega el radicado de su tarjeta; MIPG y plazo en singular', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    const onVer = vi.fn();
    render(<VistaAlertas radicados={GOBIERNO} alcanceMunicipal tenantIdUsuario="DESPACHO_ALCALDE" onVerRadicado={onVer} />);
    vi.useRealTimers();
    const botones = screen.getAllByRole('button', { name: 'Ver radicado' });
    expect(botones).toHaveLength(1);
    fireEvent.click(botones[0]);
    expect(onVer).toHaveBeenCalledWith(GOBIERNO[0]);
    const tarjeta = botones[0].closest('div.rounded-xl') as HTMLElement;
    expect(within(tarjeta).getByText('MIPG')).toBeTruthy();
    expect(within(tarjeta).getByText('Vencido hace 1 día hábil')).toBeTruthy();
  });

  it('lenguaje institucional: la fórmula en español llano, con los mismos pesos', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    const { container } = render(<VistaAlertas radicados={TODOS} alcanceMunicipal tenantIdUsuario="DESPACHO_ALCALDE" onVerRadicado={vi.fn()} />);
    vi.useRealTimers();
    expect(container.textContent).not.toMatch(/severityScore|Fase 3|ready|score/);
    expect(screen.getByText('Severidad = días vencidos × 5 + días sin movimiento × 3 + 2 si la prioridad MIPG es roja.')).toBeTruthy();
  });

  it('sin alertas: estado vacío del sistema de diseño', () => {
    render(<VistaAlertas radicados={[]} alcanceMunicipal tenantIdUsuario="DESPACHO_ALCALDE" onVerRadicado={vi.fn()} />);
    expect(screen.getByText('Sin alertas activas')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('el contador del menú no cambia: activos que vencen en ≤ 2 días hábiles, por alcance', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    expect(contarAlertasActivas(TODOS, true, 'DESPACHO_ALCALDE')).toBe(3);
    expect(contarAlertasActivas(TODOS, false, 'SEC_PLANEACION')).toBe(2);
    expect(contarAlertasActivas(TODOS, false, 'SEC_GOBIERNO')).toBe(1);
    vi.useRealTimers();
  });
});

describe('Analítica · acceso, período y cálculos intactos', () => {
  it.each(CASOS)('acceso de %s de %s', (rol, tenantId) => {
    const esperado = rol === 'ADMIN' || rol === 'CONTROL_INTERNO' || rol === 'JEFE_DEPENDENCIA';
    expect(puedeAccederVista({ rol, tenantId }, 'ANALYTICS')).toBe(esperado);
  });

  it('el período se elige con los chips del Tablero (estado accesible) y los indicadores no son botones', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    render(<VistaAnalytics radicados={TODOS} esAdmin tenantIdUsuario="DESPACHO_ALCALDE" />);
    vi.useRealTimers();
    const grupo = screen.getByRole('group', { name: 'Período del análisis' });
    const chips = within(grupo).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Últimos 30 d', 'Últimos 60 d', 'Últimos 90 d', 'Ventana operativa (180 d)']);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chips[2]);
    expect(chips[2].getAttribute('aria-pressed')).toBe('true');
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
    // Solo los cuatro chips son acciones: los seis indicadores son de lectura.
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('mismos valores: total, vencidos, dependencia de mayor carga y ranking con vencidos en texto llano', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA);
    const { container } = render(<VistaAnalytics radicados={TODOS} esAdmin tenantIdUsuario="DESPACHO_ALCALDE" />);
    vi.useRealTimers();
    expect(screen.getByText('Total radicados').previousElementSibling?.textContent).toBe('4');
    expect(screen.getByText('Vencidos activos').previousElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Dependencia mayor carga')).toBeTruthy();
    expect(screen.getAllByText('1 vencido')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/severityScore|Fase 3|ready/);
  });
});
