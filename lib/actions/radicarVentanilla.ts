import { sanitizeFirestoreData } from '@/lib/firestore/removeUndefined';
import type { TipoSolicitudId } from '@/lib/tiempos-radicado';
import type {
  CanalRespuesta,
  DatosNoAportados,
  MedioRecepcion,
  OrigenIngreso,
  TipoDocumento,
  TipoEntrada,
  TipoPersona,
} from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

export interface DatosRadicacionInstitucional {
  tipoPersona:       TipoPersona;
  tipoDocumento:     TipoDocumento;
  numeroDocumento:   string;
  nombreCompleto:    string;
  email:             string;
  telefono:          string;
  direccion:         string;
  pais:              string;
  departamento:      string;
  municipio:         string;
  medioRecepcion:    MedioRecepcion;
  tipoSolicitudId:   TipoSolicitudId;
  asunto:            string;
  descripcion:       string;
  numeroFolios:      number;
  anexosDescripcion: string;
  archivos:          File[];
  fechaVencimiento:  string;
  // Sprint Ventanilla Operativa 1 — campos operativos ampliados
  origenIngreso?:       OrigenIngreso;
  tipoEntrada?:         TipoEntrada;
  telefonoMovil?:       string;
  telefonoFijo?:        string;
  barrio?:              string;
  numeroAnexos?:        number;
  observacionesAnexos?: string;
  canalRespuesta?:      CanalRespuesta;
  noAportaDocumento?:   boolean;
  noAportaCorreo?:      boolean;
  noAportaTelefono?:    boolean;
  noAportaDireccion?:   boolean;
  /** Sprint Radicación dirigida — dependencia a la que va dirigido el
   *  radicado desde su nacimiento. Ausente = VENTANILLA_UNICA (triage
   *  central, comportamiento histórico). */
  oficinaDestino?:      TenantId;
  /** Sprint Radicación dirigida — presentación del solicitante (Ley
   *  1755/2015 art. 14). Ausente = IDENTIFICADA. */
  tipoPresentacion?:    'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA';
  /** Sprint Área al radicar — sub-oficina o programa del destino
   *  (id del catálogo lib/catalogos/areas.ts). Ausente/'' = la
   *  dependencia asigna el área después. */
  areaResponsable?:     string;
}

/**
 * Error de validación de negocio para radicación interna. Se lanza cuando
 * el conjunto de datos infringe una regla operativa (por ejemplo, si el
 * solicitante no aporta correo pero se elige canal de respuesta CORREO).
 */
export class RadicacionValidacionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadicacionValidacionError';
  }
}


/**
 * Sprint 1.5 — construye la nota humana del evento
 * `DATOS_NO_APORTADOS_MARCADOS`. Es defensiva: si por error se llama con
 * un objeto sin marcas activas, retorna un mensaje limpio. La garantía
 * real (que no se emite el evento en ese caso) vive en el guard
 * `if (hayNoAportados)` del caller, no en este helper.
 */
export function construirNotaDatosNoAportados(d: DatosNoAportados): string {
  const items = [
    d.documento && 'documento',
    d.correo    && 'correo',
    d.telefono  && 'teléfono',
    d.direccion && 'dirección',
  ].filter(Boolean) as string[];
  if (items.length === 0) {
    return 'El solicitante aportó todos los datos requeridos.';
  }
  return `El solicitante no aportó: ${items.join(', ')}.`;
}

export interface ActorRadicacion {
  uid:      string;
  nombre:   string;
  tenantId: TenantId;
}

export interface ResultadoRadicacion {
  radicadoId:  string;
  consecutivo: number;
}

/* ══════════════════════════════════════════════════════════════
   SANITIZACIÓN DE DATOS (Firestore no admite `undefined`)
══════════════════════════════════════════════════════════════ */

/**
 * Pieza angular (P2.1, Fase 2) — la implementación vive ahora en
 * `lib/firestore/removeUndefined.ts` (junto a `removeUndefinedDeep`, su
 * contraparte "ausente") para que la nueva ruta
 * `app/api/radicacion/interna/route.ts` la reutilice sin duplicar la
 * lógica. Re-exportada aquí (import arriba + export abajo, en vez de
 * `export … from`) porque este módulo también LLAMA a la función más
 * abajo — sin cambio de comportamiento ni de ruta de import para no
 * romper a los consumidores existentes de este módulo.
 */
export { sanitizeFirestoreData };

/* El canal ya no viaja en el número de radicado: desde el Sprint
   Número con oficina radicadora, todos los radicados de entrada llevan
   el código 110 (la ventanilla). El medio de recepción — incluidos los
   verbales de P-014 — queda en control.medioRecepcion. */

/* ══════════════════════════════════════════════════════════════
   ACCIÓN PRINCIPAL
══════════════════════════════════════════════════════════════ */

/**
 * Crea un VentanillaRadicado completo en la colección `ventanilla_radicados`.
 * Pasos: genera ID → sube archivos → escribe documento Firestore.
 *
 * IMPORTANTE: Todos los campos opcionales usan `|| null` (no `|| undefined`)
 * para garantizar compatibilidad estricta con Firestore. La función
 * `sanitizeFirestoreData` aplica una capa de defensa adicional en el objeto
 * completo antes de la escritura transaccional.
 */
/* ══════════════════════════════════════════════════════════════
   Aquí vivía `radicarInstitucionalmente` — la radicación LEGADA que
   escribía contadores, radicado y trazabilidad desde el NAVEGADOR.

   Se extirpó en el PR-C del cutover (24-ago-2026): desde el flip #215 la
   radicación corre por POST /api/radicacion/interna, y desde el cierre de
   reglas #217 las escrituras de cliente están DENEGADAS — este código no
   podía volver a funcionar: si alguien lo hubiera invocado, habría fallado
   contra las reglas a mitad de camino, dejando estado parcial. Un camino
   muerto que parece vivo es peor que ninguno.

   Este archivo queda como MÓDULO DE CONTRATO: los tipos, el error de
   validación y las notas que comparten el caller y el endpoint del
   servidor. La historia completa del código extirpado vive en git.
══════════════════════════════════════════════════════════════ */
