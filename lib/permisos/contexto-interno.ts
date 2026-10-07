import type { RolInterno, UsuarioAutenticado } from '@/lib/hooks/useAuth';
import type { VistaActual } from '@/lib/store/ventanillaStore';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { puedeVerTodosLosTenants } from '@/lib/permisos/alcance-tenants';
import { puedeVerReportes } from '@/lib/permisos/acceso-reportes';

/* ══════════════════════════════════════════════════════════════
   Contexto del usuario interno (ADR-0046, Ola 1).

   Punto ÚNICO donde la interfaz decide qué ve y qué puede hacer cada
   usuario según `rol + dependencia`. La misma pantalla, con contenido
   distinto: nada de interfaces paralelas por dependencia.

   Reúne, SIN cambiar la lógica, las funciones `puede*` que antes vivían
   dispersas en `app/interno/dashboard/page.tsx`, en el menú lateral y en
   el guard de Licencias. La matriz de `__tests__/contexto-interno.test.ts`
   fija que el resultado es idéntico al anterior.

   IMPORTANTE: esto es PRESENTACIÓN. Ocultar una acción sin permiso es
   obligatorio, pero la autorización real vive en `firestore.rules` y en
   las API. Ningún permiso nuevo se decide aquí.
══════════════════════════════════════════════════════════════ */

/** Dependencia de las licencias urbanísticas (mismo valor que `GuardModuloPlaneacion`). */
export const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

/** Alcance de los datos que ve el usuario. */
export type AlcanceDatos = 'MUNICIPAL' | 'DEPENDENCIA';

/** Acciones y bloques de interfaz habilitados para el usuario. */
export interface PermisosInterfaz {
  /** Radicar entradas («Nuevo radicado», Radicación rápida). */
  radicar: boolean;
  /** Bandeja de asignación y mostrador de Ventanilla. */
  usarBandejaAsignacion: boolean;
  /** Panorama por dependencias. */
  verDependencias: boolean;
  /** Analítica avanzada. */
  verAnaliticaAvanzada: boolean;
  /** Módulo de licencias urbanísticas (Planeación). */
  verLicencias: boolean;
  /** Reportes MIPG. */
  verReportes: boolean;
  /** Libro de salidas (lectura). */
  verLibroSalidas: boolean;
  /** Registrar salidas y repartir correspondencia. */
  registrarSalida: boolean;
  /** Registro exprés. */
  registroExpres: boolean;
  /** Ve radicados pero no ejecuta acciones sobre ellos. */
  soloLectura: boolean;
  /** Semáforo PQRSD global e indicadores de gobierno. */
  verIndicadoresGlobales: boolean;
  /** Selector de dependencia (solo con alcance municipal). */
  filtrarPorDependencia: boolean;
}

export interface ContextoInterno {
  rol: RolInterno;
  tenantId: TenantId;
  /** Nombre oficial de la dependencia del usuario. */
  nombreDependencia: string;
  alcance: AlcanceDatos;
  permisos: PermisosInterfaz;
  /** Vistas a las que puede entrar, en el orden del menú. */
  vistasPermitidas: readonly VistaActual[];
}

/** Orden del menú lateral: primero las vistas base, luego las que agrega el rol. */
export const ORDEN_VISTAS_MENU: readonly VistaActual[] = [
  'TABLERO', 'BANDEJA', 'VENTANILLA', 'SALIDAS', 'DEPENDENCIAS', 'MI_GESTION',
  'REPORTES', 'ANALYTICS', 'ALERTAS',
  'ANTICIPACION_OPERATIVA', 'SUPERVISION_IA', 'CONTROL_INTERNO', 'APROBACIONES',
  'ADMINISTRACION', 'LICENCIAS',
];

type Usuario = Pick<UsuarioAutenticado, 'rol' | 'tenantId'>;

export function puedeRadicar(usuario: Usuario): boolean {
  return usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';
}

export function puedeUsarBandejaAsignacion(usuario: Usuario): boolean {
  return usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';
}

/**
 * Misma política que el alcance de datos: si el rol ve todos los tenants
 * (ADMIN, CONTROL_INTERNO, RECEPCIONISTA), ve el panorama por dependencias.
 * La Ventanilla responde consultas de todo el municipio y necesita esta vista.
 */
export function puedeVerDependencias(usuario: Usuario): boolean {
  return puedeVerTodosLosTenants(usuario.rol);
}

export function puedeVerAnaliticaAvanzada(usuario: Usuario): boolean {
  return usuario.rol === 'ADMIN'
    || usuario.rol === 'CONTROL_INTERNO'
    || usuario.rol === 'JEFE_DEPENDENCIA';
}

/**
 * Licencias urbanísticas (Secretaría de Planeación): ADMIN y FUNCIONARIO de
 * Planeación. `GuardModuloPlaneacion` usa esta misma función para la ruta
 * `/interno/licencias` (deep-links).
 */
export function puedeVerLicencias(usuario: Usuario): boolean {
  return usuario.rol === 'ADMIN'
    || (usuario.rol === 'FUNCIONARIO' && usuario.tenantId === TENANT_LICENCIAS);
}

/** El libro de salidas completo lo ven quienes por reglas leen todas las salidas. */
export function puedeVerLibroSalidas(usuario: Usuario): boolean {
  return usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA'
    || usuario.rol === 'CONTROL_INTERNO';
}

export function puedeAccederVista(usuario: Usuario, vista: VistaActual): boolean {
  if (vista === 'ADMINISTRACION') return usuario.rol === 'ADMIN';
  if (vista === 'APROBACIONES') return usuario.rol === 'ADMIN' || usuario.rol === 'JEFE_DEPENDENCIA' || usuario.rol === 'CONTROL_INTERNO';
  if (vista === 'CONTROL_INTERNO') return usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO';
  if (vista === 'BANDEJA' || vista === 'VENTANILLA') return puedeUsarBandejaAsignacion(usuario);
  if (vista === 'DEPENDENCIAS') return puedeVerDependencias(usuario);
  if (vista === 'SUPERVISION_IA' || vista === 'ANTICIPACION_OPERATIVA') {
    return usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO';
  }
  if (vista === 'LICENCIAS') return puedeVerLicencias(usuario);
  if (vista === 'ANALYTICS') return puedeVerAnaliticaAvanzada(usuario);
  // Reportes se abre también a RECEPCIONISTA: responde «¿qué llegó este
  // mes?» con los mismos datos que ya ve en el Tablero.
  if (vista === 'REPORTES') return puedeVerReportes(usuario.rol);
  if (vista === 'SALIDAS') return puedeVerLibroSalidas(usuario);
  return true;
}

/** Construye el contexto de interfaz del usuario autenticado. Función pura. */
export function construirContextoInterno(usuario: Usuario): ContextoInterno {
  const municipal = puedeVerTodosLosTenants(usuario.rol);
  return {
    rol: usuario.rol,
    tenantId: usuario.tenantId,
    nombreDependencia: NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId,
    alcance: municipal ? 'MUNICIPAL' : 'DEPENDENCIA',
    permisos: {
      radicar: puedeRadicar(usuario),
      usarBandejaAsignacion: puedeUsarBandejaAsignacion(usuario),
      verDependencias: puedeVerDependencias(usuario),
      verAnaliticaAvanzada: puedeVerAnaliticaAvanzada(usuario),
      verLicencias: puedeVerLicencias(usuario),
      verReportes: puedeVerReportes(usuario.rol),
      verLibroSalidas: puedeVerLibroSalidas(usuario),
      registrarSalida: usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA',
      registroExpres: usuario.rol !== 'CONTROL_INTERNO',
      soloLectura: usuario.rol === 'JEFE_DEPENDENCIA' || usuario.rol === 'CONTROL_INTERNO',
      verIndicadoresGlobales: usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO',
      filtrarPorDependencia: municipal,
    },
    vistasPermitidas: ORDEN_VISTAS_MENU.filter((vista) => puedeAccederVista(usuario, vista)),
  };
}
