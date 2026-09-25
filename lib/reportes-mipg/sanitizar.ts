import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

/* ══════════════════════════════════════════════════════════════
   Sanitizador para el reporte Excel MIPG.

   Reglas:
   - Solicitudes anónimas o con identidad reservada: enmascarar
     nombre, documento, correo y dirección. Mostrar "Anónimo /
     Reservado" / "No disponible".
   - Nunca exponer UID internos del responsable funcional.
   - Nunca exponer archivoPath crudo de Storage. Solo el nombre del
     archivo (si existe) es información pública.
   - Filtros por rol: FUNCIONARIO/JEFE_DEPENDENCIA solo ven su tenant.
     ADMIN/RECEPCIONISTA/CONTROL_INTERNO ven todo.
══════════════════════════════════════════════════════════════ */

const PLACEHOLDER_RESERVADO = 'Anónimo / Reservado';
const PLACEHOLDER_NO_DISPONIBLE = 'No disponible';

export interface UsuarioReporte {
  uid:      string;
  nombre:   string;
  rol:      RolInterno;
  tenantId: TenantId;
}

export function debeOcultarIdentidad(r: VentanillaRadicado): boolean {
  return r.esAnonimo === true
      || r.tipoPresentacion === 'ANONIMA'
      || r.tipoPresentacion === 'RESERVADA'
      || r.identidadReservada === true;
}

/** Datos del solicitante listos para mostrar en el reporte (sin PII si aplica). */
export interface SolicitanteVisible {
  nombre:    string;
  documento: string;
  correo:    string;
  direccion: string;
}

export function solicitanteVisible(r: VentanillaRadicado): SolicitanteVisible {
  if (debeOcultarIdentidad(r)) {
    return {
      nombre:    PLACEHOLDER_RESERVADO,
      documento: PLACEHOLDER_NO_DISPONIBLE,
      correo:    PLACEHOLDER_NO_DISPONIBLE,
      direccion: PLACEHOLDER_NO_DISPONIBLE,
    };
  }
  const s = r.solicitante ?? ({} as Partial<VentanillaRadicado['solicitante']>);
  return {
    nombre:    s.nombreCompleto?.trim() || PLACEHOLDER_NO_DISPONIBLE,
    documento: s.numeroDocumento?.trim() || PLACEHOLDER_NO_DISPONIBLE,
    correo:    s.email?.trim() || PLACEHOLDER_NO_DISPONIBLE,
    direccion: s.direccion?.trim() || PLACEHOLDER_NO_DISPONIBLE,
  };
}

/** Datos del responsable funcional (snapshot MIPG-2) — sin UID. */
export interface ResponsableVisible {
  nombre: string;
  email:  string;
  rol:    string;
  cargo:  string;
}

export function responsableVisible(r: VentanillaRadicado): ResponsableVisible {
  const c = r.clasificacion ?? ({} as Partial<VentanillaRadicado['clasificacion']>);
  return {
    nombre: c.funcionarioResponsableNombre ?? 'No asignado',
    email:  c.funcionarioResponsableEmail  ?? '—',
    rol:    c.funcionarioResponsableRol    ?? '—',
    cargo:  c.funcionarioResponsableCargo  ?? '—',
  };
}

/** Información de anexo público (solo nombre del archivo, nunca el path). */
export function nombreOficioPublico(r: VentanillaRadicado): string {
  const nombre = r.respuestaOficial?.archivoNombre;
  return nombre ? nombre : 'No';
}

/* ══════════════════════════════════════════════════════════════
   Filtros por rol
══════════════════════════════════════════════════════════════ */

export function radicadosVisiblesParaRol(
  radicados: VentanillaRadicado[],
  usuario: UsuarioReporte,
): VentanillaRadicado[] {
  switch (usuario.rol) {
    case 'ADMIN':
    case 'CONTROL_INTERNO':
    case 'RECEPCIONISTA':
      return radicados;
    case 'FUNCIONARIO':
    case 'JEFE_DEPENDENCIA':
      return radicados.filter((r) => r.clasificacion.oficinaDestino === usuario.tenantId);
  }
}

/** Texto resumido de competencia visible: tenant ID con nombre humano lo agrega quien renderiza. */
export const PLACEHOLDERS = {
  RESERVADO: PLACEHOLDER_RESERVADO,
  NO_DISPONIBLE: PLACEHOLDER_NO_DISPONIBLE,
} as const;
