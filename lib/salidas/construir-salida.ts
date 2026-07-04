import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type {
  DestinatarioSalida,
  MedioEnvioSalida,
  SalidaOficial,
  TipoSalida,
} from '@/src/types/salida';

/**
 * Sprint Radicación de salida — construcción y validación del
 * documento de salida, separadas del action para poder testearlas sin
 * Firestore.
 */

export interface EntradaSalida {
  tipoSalida:         TipoSalida;
  radicadoEntradaId?: string | null;
  destinatario:       DestinatarioSalida;
  asunto:             string;
  dependenciaOrigen:  TenantId;
  medioEnvio:         MedioEnvioSalida;
  firmanteNombre:     string;
}

/** Valida la entrada; devuelve el mensaje de error o null si está bien. */
export function validarSalida(e: EntradaSalida): string | null {
  if (!e.destinatario?.nombre?.trim()) {
    return 'El destinatario es obligatorio.';
  }
  if (!e.asunto?.trim()) {
    return 'El asunto es obligatorio.';
  }
  if (e.tipoSalida === 'RESPUESTA' && !e.radicadoEntradaId?.trim()) {
    return 'Una salida de tipo respuesta debe indicar el radicado de entrada.';
  }
  if (e.tipoSalida === 'OFICIO_INDEPENDIENTE' && e.radicadoEntradaId?.trim()) {
    return 'Un oficio independiente no lleva radicado de entrada.';
  }
  if (!e.firmanteNombre?.trim()) {
    return 'El firmante es obligatorio.';
  }
  return null;
}

/** Documento a persistir — `null` explícito en opcionales vacíos (Firestore no acepta undefined). */
export function construirDocSalida(
  e: EntradaSalida,
  salidaId: string,
  consecutivo: number,
  actor: { uid: string; nombre: string },
  ahora: Date,
): SalidaOficial {
  return {
    salidaId,
    consecutivo,
    fechaSalida: ahora.toISOString(),
    tipoSalida:  e.tipoSalida,
    radicadoEntradaId: e.tipoSalida === 'RESPUESTA'
      ? (e.radicadoEntradaId ?? '').trim()
      : null,
    destinatario: {
      nombre:    e.destinatario.nombre.trim(),
      entidad:   e.destinatario.entidad?.trim()   || null,
      email:     e.destinatario.email?.trim()     || null,
      direccion: e.destinatario.direccion?.trim() || null,
    },
    asunto:            e.asunto.trim(),
    dependenciaOrigen: e.dependenciaOrigen,
    firmante: {
      uid:    actor.uid,
      nombre: e.firmanteNombre.trim(),
    },
    medioEnvio:    e.medioEnvio,
    registradoPor: { uid: actor.uid, nombre: actor.nombre },
    archivoPath:   null,
  };
}

/**
 * Nota del evento OFICIO_SALIDA_REGISTRADO en la trazabilidad del
 * radicado de entrada — el amarre visible en la historia del caso.
 */
export function construirNotaSalida(
  salidaId: string,
  destinatarioNombre: string,
  dependenciaOrigen: TenantId,
): string {
  const dependencia = NOMBRES_TENANT[dependenciaOrigen] ?? dependenciaOrigen;
  return `Despachado oficio de salida ${salidaId} para ${destinatarioNombre} · ${dependencia}`;
}
