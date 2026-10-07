import { describe, expect, it } from 'vitest';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import {
  construirContextoInterno,
  puedeAccederVista,
  type PermisosInterfaz,
} from '@/lib/permisos/contexto-interno';

/* ══════════════════════════════════════════════════════════════
   Contexto del usuario interno (ADR-0046, Ola 1).

   POR QUÉ EXISTE. La Ola 1 movió las reglas de interfaz dispersas en
   `page.tsx`, el menú lateral y el guard de Licencias a un solo módulo,
   sin cambiar la lógica. Esta matriz está transcrita a mano del código
   ANTERIOR, regla por regla: si alguien altera un permiso al refactorizar,
   falla aquí y no en producción con un funcionario viendo lo que no debe.
══════════════════════════════════════════════════════════════ */

const PLANEACION: TenantId = 'SEC_PLANEACION';
const OTRA: TenantId = 'SEC_GOBIERNO';

/** Vistas del menú por rol y dependencia, en el orden del menú anterior. */
const VISTAS_ESPERADAS: Array<[RolInterno, TenantId, string[]]> = [
  ['ADMIN', OTRA, ['TABLERO', 'BANDEJA', 'VENTANILLA', 'SALIDAS', 'DEPENDENCIAS', 'MI_GESTION', 'REPORTES', 'ANALYTICS', 'ALERTAS', 'ANTICIPACION_OPERATIVA', 'SUPERVISION_IA', 'CONTROL_INTERNO', 'APROBACIONES', 'ADMINISTRACION', 'LICENCIAS']],
  ['CONTROL_INTERNO', OTRA, ['TABLERO', 'SALIDAS', 'DEPENDENCIAS', 'MI_GESTION', 'REPORTES', 'ANALYTICS', 'ALERTAS', 'ANTICIPACION_OPERATIVA', 'SUPERVISION_IA', 'CONTROL_INTERNO', 'APROBACIONES']],
  ['RECEPCIONISTA', 'VENTANILLA_UNICA', ['TABLERO', 'BANDEJA', 'VENTANILLA', 'SALIDAS', 'DEPENDENCIAS', 'MI_GESTION', 'REPORTES', 'ALERTAS']],
  ['JEFE_DEPENDENCIA', OTRA, ['TABLERO', 'MI_GESTION', 'REPORTES', 'ANALYTICS', 'ALERTAS', 'APROBACIONES']],
  // El jefe de Planeación NO entra a Licencias: solo ADMIN y FUNCIONARIO de Planeación.
  ['JEFE_DEPENDENCIA', PLANEACION, ['TABLERO', 'MI_GESTION', 'REPORTES', 'ANALYTICS', 'ALERTAS', 'APROBACIONES']],
  ['FUNCIONARIO', OTRA, ['TABLERO', 'MI_GESTION', 'ALERTAS']],
  ['FUNCIONARIO', PLANEACION, ['TABLERO', 'MI_GESTION', 'ALERTAS', 'LICENCIAS']],
];

type Esperado = Record<keyof PermisosInterfaz, boolean> & { alcance: 'MUNICIPAL' | 'DEPENDENCIA' };

const PERMISOS_ESPERADOS: Array<[RolInterno, TenantId, Esperado]> = [
  ['ADMIN', OTRA, { alcance: 'MUNICIPAL', radicar: true, usarBandejaAsignacion: true, verDependencias: true, verAnaliticaAvanzada: true, verLicencias: true, verReportes: true, verLibroSalidas: true, registrarSalida: true, registroExpres: true, soloLectura: false, verIndicadoresGlobales: true, filtrarPorDependencia: true }],
  ['CONTROL_INTERNO', OTRA, { alcance: 'MUNICIPAL', radicar: false, usarBandejaAsignacion: false, verDependencias: true, verAnaliticaAvanzada: true, verLicencias: false, verReportes: true, verLibroSalidas: true, registrarSalida: false, registroExpres: false, soloLectura: true, verIndicadoresGlobales: true, filtrarPorDependencia: true }],
  ['RECEPCIONISTA', 'VENTANILLA_UNICA', { alcance: 'MUNICIPAL', radicar: true, usarBandejaAsignacion: true, verDependencias: true, verAnaliticaAvanzada: false, verLicencias: false, verReportes: true, verLibroSalidas: true, registrarSalida: true, registroExpres: true, soloLectura: false, verIndicadoresGlobales: false, filtrarPorDependencia: true }],
  ['JEFE_DEPENDENCIA', PLANEACION, { alcance: 'DEPENDENCIA', radicar: false, usarBandejaAsignacion: false, verDependencias: false, verAnaliticaAvanzada: true, verLicencias: false, verReportes: true, verLibroSalidas: false, registrarSalida: false, registroExpres: true, soloLectura: true, verIndicadoresGlobales: false, filtrarPorDependencia: false }],
  ['FUNCIONARIO', OTRA, { alcance: 'DEPENDENCIA', radicar: false, usarBandejaAsignacion: false, verDependencias: false, verAnaliticaAvanzada: false, verLicencias: false, verReportes: false, verLibroSalidas: false, registrarSalida: false, registroExpres: true, soloLectura: false, verIndicadoresGlobales: false, filtrarPorDependencia: false }],
  ['FUNCIONARIO', PLANEACION, { alcance: 'DEPENDENCIA', radicar: false, usarBandejaAsignacion: false, verDependencias: false, verAnaliticaAvanzada: false, verLicencias: true, verReportes: false, verLibroSalidas: false, registrarSalida: false, registroExpres: true, soloLectura: false, verIndicadoresGlobales: false, filtrarPorDependencia: false }],
];

describe('contexto interno · vistas por rol y dependencia (idénticas al menú anterior)', () => {
  it.each(VISTAS_ESPERADAS)('%s de %s ve exactamente sus vistas', (rol, tenantId, vistas) => {
    expect(construirContextoInterno({ rol, tenantId }).vistasPermitidas).toEqual(vistas);
  });

  it('vistas fuera del menú (RADICACION) siguen abiertas como antes', () => {
    expect(puedeAccederVista({ rol: 'FUNCIONARIO', tenantId: OTRA }, 'RADICACION')).toBe(true);
  });
});

describe('contexto interno · permisos de acción por rol', () => {
  it.each(PERMISOS_ESPERADOS)('%s de %s', (rol, tenantId, { alcance, ...permisos }) => {
    const ctx = construirContextoInterno({ rol, tenantId });
    expect(ctx.alcance).toBe(alcance);
    expect(ctx.permisos).toEqual(permisos);
  });

  it('nombra la dependencia del usuario con su nombre oficial', () => {
    expect(construirContextoInterno({ rol: 'FUNCIONARIO', tenantId: PLANEACION }).nombreDependencia)
      .toBe('Secretaría de Planeación');
  });
});
