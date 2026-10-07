import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { SalidaOficial } from '@/src/types/salida';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { construirContextoInterno, puedeAccederVista } from '@/lib/permisos/contexto-interno';
import { VistaReportes } from '@/app/interno/dashboard/components/reportes/VistaReportes';
import { VistaAnticipacionOperativa } from '@/app/interno/dashboard/components/analytics/VistaAnticipacionOperativa';
import { VistaSupervisionIA } from '@/app/interno/dashboard/components/analytics/VistaSupervisionIA';

/* Firestore simulado para las vistas de IA (leen colecciones en vivo). */
const DATOS_FS: Record<string, unknown[]> = {};
vi.mock('@/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (original) => ({
  ...(await original<typeof import('firebase/firestore')>()),
  collection: (_db: unknown, nombre: string) => ({ nombre }),
  query: (c: { nombre: string }) => c,
  limit: () => null,
  orderBy: () => null,
  onSnapshot: (q: { nombre: string }, siguiente: (s: { docs: { data: () => unknown }[] }) => void) => {
    siguiente({ docs: (DATOS_FS[q.nombre] ?? []).map((d) => ({ data: () => d })) });
    return () => undefined;
  },
}));

/* ══════════════════════════════════════════════════════════════
   Ola 3 · grupo C (ADR-0046) — Reportes, Anticipación y Supervisión IA.
   Pruebas funcionales por rol y dependencia. Correcciones aprobadas:
   el selector de dependencia no se ofrece a quien tiene alcance de
   dependencia (sus datos ya vienen acotados) y el lenguaje de las
   vistas de IA es institucional (sin emojis ni jerga).
══════════════════════════════════════════════════════════════ */

afterEach(() => { cleanup(); for (const k of Object.keys(DATOS_FS)) delete DATOS_FS[k]; });

const AHORA = new Date('2026-09-23T15:00:00.000Z');
const ROLES: RolInterno[] = ['ADMIN', 'CONTROL_INTERNO', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'FUNCIONARIO'];
const DEPENDENCIAS: TenantId[] = ['VENTANILLA_UNICA', 'SEC_PLANEACION', 'SEC_GOBIERNO'];
const CASOS = ROLES.flatMap((rol) => DEPENDENCIAS.map((tenantId) => [rol, tenantId] as const));

let n = 0;
function radicado(oficina: TenantId, venceEnDias: number): VentanillaRadicado {
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
  };
}
const SALIDAS: SalidaOficial[] = [];

describe('Reportes · acceso, selector de dependencia y salidas según el contexto', () => {
  it.each(CASOS)('%s de %s', (rol, tenantId) => {
    const ctx = construirContextoInterno({ rol, tenantId });
    const entra = puedeAccederVista({ rol, tenantId }, 'REPORTES');
    expect(entra).toBe(rol !== 'FUNCIONARIO');
    if (!entra) return;
    // Mismo cableado que `page.tsx`.
    const radicados = ctx.alcance === 'MUNICIPAL' ? [radicado('SEC_GOBIERNO', 3), radicado(tenantId, -2)] : [radicado(tenantId, -2)];
    const { container } = render(
      <VistaReportes
        total={radicados.length}
        radicados={radicados}
        salidas={ctx.permisos.verLibroSalidas ? SALIDAS : null}
        dependenciaFija={ctx.permisos.filtrarPorDependencia ? undefined : tenantId}
      />,
    );
    // El selector solo existe con alcance municipal (antes también al JEFE, con 15 opciones inútiles).
    expect(!!screen.queryByRole('combobox', { name: 'Filtrar reporte por dependencia' })).toBe(ctx.permisos.filtrarPorDependencia);
    // Con alcance de dependencia, el reporte (pantalla e impresión) se rotula con ella.
    if (!ctx.permisos.filtrarPorDependencia) {
      expect(container.textContent).toContain(`MIPG · Rendición de Cuentas · ${NOMBRES_TENANT[tenantId]}`);
      expect(container.textContent).toContain(`· ${NOMBRES_TENANT[tenantId]}`);
      expect(container.textContent).not.toContain('Todas las dependencias');
    }
    // La sección de salidas depende del permiso de leer el libro, como antes.
    expect(container.textContent?.includes('Correspondencia de salida')).toBe(ctx.permisos.verLibroSalidas);
    // Exportaciones intactas para todo rol con acceso.
    for (const accion of ['Imprimir / PDF', 'Exportar Excel MIPG', 'CSV técnico']) {
      expect(screen.getByRole('button', { name: accion })).toBeTruthy();
    }
  });

  it('los presets siguen filtrando el período (chips con estado accesible)', () => {
    render(<VistaReportes total={1} radicados={[radicado('SEC_GOBIERNO', 3)]} salidas={null} />);
    const historico = screen.getByRole('button', { name: 'Histórico completo' });
    expect(historico.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(historico);
    expect(historico.getAttribute('aria-pressed')).toBe('true');
  });

  it('la página rotula el reporte con la dependencia solo cuando el rol no filtra por dependencia', () => {
    const pagina = readFileSync('app/interno/dashboard/page.tsx', 'utf8');
    expect(pagina).toContain('dependenciaFija={contexto.permisos.filtrarPorDependencia ? undefined : usuario.tenantId}');
  });
});

describe('Anticipación y Supervisión IA · solo ADMIN y CONTROL_INTERNO; lenguaje institucional', () => {
  it.each(CASOS)('acceso de %s de %s', (rol, tenantId) => {
    const esperado = rol === 'ADMIN' || rol === 'CONTROL_INTERNO';
    expect(puedeAccederVista({ rol, tenantId }, 'ANTICIPACION_OPERATIVA')).toBe(esperado);
    expect(puedeAccederVista({ rol, tenantId }, 'SUPERVISION_IA')).toBe(esperado);
  });

  it('Supervisión IA: estado sin emojis y mismos cálculos', () => {
    Object.assign(DATOS_FS, {
      ai_feedback: [
        { feedbackId: 'f1', radicadoId: 'r1', puntuacion: 'POSITIVO', fecha: AHORA.toISOString() },
        { feedbackId: 'f2', radicadoId: 'r2', puntuacion: 'CORREGIDO', fecha: AHORA.toISOString() },
      ],
      ai_logs: [{ logId: 'l1', endpoint: 'chat', latenciaMs: 900, error: null, fallbackActivo: true, timestamp: AHORA.toISOString() }],
    });
    const { container } = render(<VistaSupervisionIA />);
    expect(screen.getByText('Respaldo local activo')).toBeTruthy();
    expect(container.textContent).not.toMatch(/[🟢🟡🔴👍❌✦]/u);
    expect(screen.getByText('Precisión Global IA').previousElementSibling?.textContent).toBe('50%');
    expect(screen.getByText('Latencia Promedio').previousElementSibling?.textContent).toBe('900ms');
    // Siguen siendo indicadores de solo lectura, no interruptores (PT-7).
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('Anticipación: la explicación del riesgo se elige también con teclado', () => {
    const riesgos = [radicado('SEC_GOBIERNO', -1), radicado('SEC_PLANEACION', 1)];
    render(<VistaAnticipacionOperativa radicados={riesgos} />);
    expect(screen.getByText(/La IA sugiere; el funcionario decide/)).toBeTruthy();
    const botones = screen.getAllByRole('button', { name: /^Ver la explicación del riesgo de / });
    expect(botones.length).toBeGreaterThan(0);
    const ultimo = botones[botones.length - 1];
    fireEvent.click(ultimo);
    expect(ultimo.getAttribute('aria-pressed')).toBe('true');
  });
});
