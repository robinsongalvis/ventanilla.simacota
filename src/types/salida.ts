import type { TenantId } from './radicado';

/**
 * Sprint Radicación de salida — correspondencia DESPACHADA por la
 * administración municipal.
 *
 * Serie propia `2-SAL-{año}-{consecutivo}`, colección
 * `ventanilla_salidas`. Una salida puede responder a un radicado de
 * entrada (tipo RESPUESTA, con amarre) o ser correspondencia propia de
 * la administración (tipo OFICIO_INDEPENDIENTE, sin amarre) — un
 * oficio a la Gobernación, a un contratista, a otra entidad.
 *
 * v1 sin archivo adjunto: el PDF del oficio llega en la Fase B vía
 * Admin SDK (patrón respuestas/). El documento registra el hecho del
 * despacho: quién firma, a quién se envía, por qué medio y cuándo.
 */

export type TipoSalida = 'RESPUESTA' | 'OFICIO_INDEPENDIENTE';

export type MedioEnvioSalida = 'CORREO' | 'FISICO' | 'MENSAJERO' | 'PRESENCIAL';

export interface DestinatarioSalida {
  nombre:    string;
  /** Entidad u organización, si aplica (Gobernación, banco, empresa…). */
  entidad?:  string | null;
  email?:    string | null;
  direccion?: string | null;
}

export interface SalidaOficial {
  salidaId:      string;
  consecutivo:   number;
  /** ISO del momento del registro del despacho. */
  fechaSalida:   string;
  tipoSalida:    TipoSalida;
  /** Amarre al radicado de entrada que responde (solo tipo RESPUESTA). */
  radicadoEntradaId?: string | null;
  destinatario:  DestinatarioSalida;
  asunto:        string;
  /** Dependencia que despacha el oficio. */
  dependenciaOrigen: TenantId;
  /** Quien firma el oficio (snapshot al momento del registro). */
  firmante: {
    uid:    string;
    nombre: string;
  };
  medioEnvio:    MedioEnvioSalida;
  /** Quien registró el despacho en el sistema. */
  registradoPor: {
    uid:    string;
    nombre: string;
  };
  /** Fase B: path del PDF del oficio en Storage (`salidas/{salidaId}/...`). */
  archivoPath?:  string | null;
  /** Fase B: nombre original del PDF, para mostrarlo en el libro. */
  archivoNombre?: string | null;
}
