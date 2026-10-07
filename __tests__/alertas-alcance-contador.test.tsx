import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { construirContextoInterno } from '@/lib/permisos/contexto-interno';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { VistaAlertas, contarAlertasActivas } from '@/app/interno/dashboard/components/analytics/VistaAlertas';

/* ══════════════════════════════════════════════════════════════
   Corrección funcional (23-sep-2026, matriz Ola 3 §4.3/§6.3): el contador
   de Alertas del menú y la vista Alertas cuentan sobre el MISMO universo:
   los radicados que el rol ve, con el alcance de la bandeja.

   Antes:
   - la vista usaba `esAdmin` (ADMIN y CONTROL_INTERNO) y el contador
     `veTodosTenants` (además RECEPCIONISTA): Recepción veía en el menú el
     número municipal y, al entrar, solo su dependencia;
   - la vista filtraba por radicados de los últimos 30 días y el contador
     no: los vencidos más antiguos se contaban pero no se veían.
══════════════════════════════════════════════════════════════ */

afterEach(cleanup);

const AHORA = new Date('2026-09-23T15:00:00.000Z');
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AHORA); });
afterAll(() => { vi.useRealTimers(); });

const ROLES: RolInterno[] = ['ADMIN', 'CONTROL_INTERNO', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'FUNCIONARIO'];
const DEPENDENCIAS: TenantId[] = ['VENTANILLA_UNICA', 'SEC_PLANEACION', 'SEC_GOBIERNO', 'SEC_HACIENDA'];
const ACTIVOS = new Set(['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA']);

let n = 0;
function radicado(oficina: TenantId, venceEnDias: number, extra: Partial<VentanillaRadicado> = {}, radicadoHaceDias = 10): VentanillaRadicado {
  n += 1;
  const id = `1-110-202609-${String(n).padStart(8, '0')}`;
  const vence = new Date(AHORA); vence.setDate(vence.getDate() + venceEnDias);
  const radicadoEn = new Date(AHORA); radicadoEn.setDate(radicadoEn.getDate() - radicadoHaceDias);
  return {
    radicadoId: id, estadoActual: 'ASIGNADO', ultimaActualizacion: AHORA.toISOString(), prioridad: 'AMARILLO',
    esAnonimo: false, tipoPresentacion: 'IDENTIFICADA', identidadReservada: false, canalRespuesta: 'CORREO',
    solicitante: { tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1', nombreCompleto: 'María Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' } },
    control: { radicadoId: id, consecutivo: n, fechaRadicado: radicadoEn.toISOString(), horaRadicado: '08:42',
      medioRecepcion: 'PRESENCIAL', origen: 'FISICO_ESCANER' },
    termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general', diasRespuesta: 15,
      unidad: 'HABILES', fechaVencimiento: vence.toISOString(), prorrogasAplicadas: 0 },
    clasificacion: { oficinaDestino: oficina, zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Certificado', descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
    ...extra,
  };
}

/* Un vencido radicado hace 60 días: fuera de la antigua ventana de 30. */
const VENCIDO_ANTIGUO = radicado('SEC_GOBIERNO', -20, {}, 60);
const MUNICIPIO: VentanillaRadicado[] = [
  radicado('SEC_PLANEACION', -3),
  radicado('SEC_PLANEACION', 1),
  radicado('SEC_PLANEACION', 4),
  radicado('SEC_PLANEACION', -1, { estadoActual: 'RESUELTO' }),
  radicado('SEC_GOBIERNO', 0),
  radicado('SEC_GOBIERNO', 12),
  VENCIDO_ANTIGUO,
  radicado('VENTANILLA_UNICA', 2, { estadoActual: 'PENDIENTE' }),
  radicado('SEC_HACIENDA', -8, { estadoActual: 'PRORROGA' }),
];

/** Lo que entrega la capa de datos (`useVentanillaRadicados`) a cada rol. */
function streamDelRol(rol: RolInterno, tenantId: TenantId, tenantFiltro: TenantId | 'TODOS' = 'TODOS'): VentanillaRadicado[] {
  const municipal = construirContextoInterno({ rol, tenantId }).alcance === 'MUNICIPAL';
  const dependencia = municipal ? tenantFiltro : tenantId;
  return dependencia === 'TODOS' ? MUNICIPIO : MUNICIPIO.filter((r) => r.clasificacion.oficinaDestino === dependencia);
}

/** Esperado calculado aparte: activos del stream que vencen en ≤ 2 días hábiles. */
function esperadoCriticasYUrgentes(stream: VentanillaRadicado[]): string[] {
  return stream
    .filter((r) => ACTIVOS.has(r.estadoActual) && diasRestantesHabiles(r.termino.fechaVencimiento) <= 2)
    .map((r) => r.radicadoId)
    .sort();
}

/** Monta la vista exactamente como la página (mismas props que el contador). */
function montarComoLaPagina(rol: RolInterno, tenantId: TenantId, tenantFiltro: TenantId | 'TODOS' = 'TODOS') {
  const veTodosTenants = construirContextoInterno({ rol, tenantId }).permisos.filtrarPorDependencia;
  const stream = streamDelRol(rol, tenantId, tenantFiltro);
  const contador = contarAlertasActivas(stream, veTodosTenants, tenantId);
  const vista = render(
    <VistaAlertas
      radicados={stream}
      alcanceMunicipal={veTodosTenants}
      tenantIdUsuario={tenantId}
      dependenciaFiltrada={veTodosTenants && tenantFiltro !== 'TODOS' ? tenantFiltro : undefined}
      onVerRadicado={vi.fn()}
    />,
  );
  return { stream, contador, vista };
}

/** Radicados de los grupos Crítico y Urgente que pinta la vista. */
function criticasYUrgentesEnVista(contenedor: HTMLElement): string[] {
  const ids: string[] = [];
  for (const grupo of contenedor.querySelectorAll('section')) {
    const nivel = grupo.querySelector('h3')?.textContent;
    if (nivel !== 'Crítico' && nivel !== 'Urgente') continue;
    for (const el of grupo.querySelectorAll('span.font-mono')) ids.push(el.textContent ?? '');
  }
  return ids.sort();
}

function contadoresDelEncabezado(): number {
  const criticos = screen.queryByText(/^\d+ críticos?$/)?.textContent ?? '0';
  const urgentes = screen.queryByText(/^\d+ urgentes?$/)?.textContent ?? '0';
  return parseInt(criticos, 10) + parseInt(urgentes, 10);
}

describe('Contador de Alertas = lo que la vista muestra, para cada rol y dependencia', () => {
  const casos = ROLES.flatMap((rol) => DEPENDENCIAS.map((tenantId) => [rol, tenantId] as const));

  it.each(casos)('%s de %s', (rol, tenantId) => {
    const { stream, contador, vista } = montarComoLaPagina(rol, tenantId);
    const esperado = esperadoCriticasYUrgentes(stream);
    expect(contador).toBe(esperado.length);
    expect(contadoresDelEncabezado()).toBe(contador);
    expect(criticasYUrgentesEnVista(vista.container)).toEqual(esperado);
  });

  it.each(DEPENDENCIAS)('rol municipal con el selector en %s: la vista y el contador siguen el filtro', (filtro) => {
    const { stream, contador, vista } = montarComoLaPagina('RECEPCIONISTA', 'VENTANILLA_UNICA', filtro);
    expect(contador).toBe(esperadoCriticasYUrgentes(stream).length);
    expect(contadoresDelEncabezado()).toBe(contador);
    expect(criticasYUrgentesEnVista(vista.container)).toEqual(esperadoCriticasYUrgentes(stream));
  });
});

describe('Regresiones corregidas', () => {
  it('Recepción ve en la vista las alertas de todo el municipio, como su contador (antes solo su dependencia)', () => {
    const { contador, vista } = montarComoLaPagina('RECEPCIONISTA', 'VENTANILLA_UNICA');
    expect(screen.getByText(/^Vista global · Ordenado por severidad$/)).toBeTruthy();
    const soloSuDependencia = esperadoCriticasYUrgentes(MUNICIPIO.filter((r) => r.clasificacion.oficinaDestino === 'VENTANILLA_UNICA'));
    expect(contador).toBe(esperadoCriticasYUrgentes(MUNICIPIO).length);
    expect(contador).toBeGreaterThan(soloSuDependencia.length);
    expect(vista.container.textContent).toContain(VENCIDO_ANTIGUO.radicadoId);
    expect(vista.container.textContent).toContain(MUNICIPIO[0].radicadoId); // Planeación
  });

  it('un vencido radicado hace 60 días aparece en la vista y en el contador (antes solo en el contador)', () => {
    const { contador, vista } = montarComoLaPagina('ADMIN', 'DESPACHO_ALCALDE' as TenantId);
    expect(esperadoCriticasYUrgentes(MUNICIPIO)).toContain(VENCIDO_ANTIGUO.radicadoId);
    expect(criticasYUrgentesEnVista(vista.container)).toContain(VENCIDO_ANTIGUO.radicadoId);
    expect(contador).toBe(esperadoCriticasYUrgentes(MUNICIPIO).length);
  });

  it('JEFE y FUNCIONARIO: solo su dependencia, en la vista y en el contador', () => {
    for (const rol of ['JEFE_DEPENDENCIA', 'FUNCIONARIO'] as const) {
      const { contador, vista } = montarComoLaPagina(rol, 'SEC_PLANEACION');
      expect(screen.getByText(/^Solo Secretaría de Planeación · Ordenado por severidad$/)).toBeTruthy();
      const planeacion = MUNICIPIO.filter((r) => r.clasificacion.oficinaDestino === 'SEC_PLANEACION');
      expect(contador).toBe(esperadoCriticasYUrgentes(planeacion).length);
      expect(contador).toBeGreaterThan(0);
      expect(vista.container.textContent).not.toContain(VENCIDO_ANTIGUO.radicadoId);
      cleanup();
    }
  });

  it('los resueltos nunca cuentan', () => {
    const resuelto = MUNICIPIO[3];
    const { vista } = montarComoLaPagina('ADMIN', 'DESPACHO_ALCALDE' as TenantId);
    expect(vista.container.textContent).not.toContain(resuelto.radicadoId);
  });
});

describe('La página pasa el mismo alcance y el mismo stream a la vista y al contador', () => {
  const pagina = readFileSync('app/interno/dashboard/page.tsx', 'utf8');

  it('contador del menú', () => {
    expect(pagina).toContain('contarAlertasActivas(todosLosRadicados, veTodosTenants, usuario.tenantId)');
  });

  it('vista Alertas', () => {
    const inicio = pagina.indexOf('<VistaAlertas');
    const bloque = pagina.slice(inicio, pagina.indexOf('/>', inicio));
    expect(bloque).toContain('radicados={todosLosRadicados}');
    expect(bloque).toContain('alcanceMunicipal={veTodosTenants}');
    expect(bloque).toContain('tenantIdUsuario={usuario.tenantId}');
    expect(bloque).not.toContain('esAdmin');
  });
});
