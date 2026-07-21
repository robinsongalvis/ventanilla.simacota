import { sugerirSerieDocumental } from '@/lib/catalogos/series-documentales';
import type { TipoSolicitudId, UnidadTermino } from '@/lib/tiempos-radicado';
import type {
  OrigenRadicado,
  Prioridad,
  TenantId,
  TipoPresentacionPqrsd,
  ZonaGeografica,
} from '@/src/types/radicado';
import type {
  AnalisisIA,
  ArchivoRadicado,
  CanalRespuesta,
  ClasificacionRadicado,
  DatosNoAportados,
  MedioRecepcion,
  OrigenIngreso,
  TipoDocumento,
  TipoEntrada,
  TipoPersona,
  VentanillaRadicado,
} from '@/src/types/ventanilla';

/* ══════════════════════════════════════════════════════════════
   lib/recepcion/construir-radicado.ts

   Constructor puro único del documento `VentanillaRadicado`.

   Pieza angular (P2.1) — Fase 1. Ver:
     - docs/CRONOGRAMA_PIEZA_ANGULAR.md (criterios de éxito de esta fase)
     - docs/blueprints/CN-pieza-angular-radicacion-interna.md (§M1)

   Reemplaza la construcción del objeto, hoy duplicada en:
     - app/api/radicacion/route.ts        (superficie PÚBLICA / ciudadana)
     - lib/actions/radicarVentanilla.ts   (superficie INTERNA / recepción)

   CONTRATO
   ────────
   - Función PURA: sin Firestore/Storage, sin `new Date()`, `Math.random()`
     ni `crypto` internos. Todo lo variable entra por parámetro —
     identificadores ya asignados por el helper de consecutivo legal
     (`lib/server/consecutivo-legal.ts`), archivos ya en su ruta final,
     reloj inyectado (`ahora`). No formatea el id de radicado ni toca
     contadores: H3 permanece intacto.
   - SUPERSET PARAMETRIZADO: nunca aplana ni descarta campos que hoy
     produce alguna de las dos superficies. Las diferencias de origen
     (pública vs. interna) se expresan como PARÁMETROS opcionales —
     nunca como una rama `if (origen === …)` dentro de esta función.
   - La SANITIZACIÓN queda FUERA de este constructor (decisión del
     blueprint v2, firestore-datos): la pública sigue aplicando
     `removeUndefinedDeep` (elimina claves `undefined`) y la interna
     `sanitizeFirestoreData` (convierte `undefined` → `null`,
     CONSERVA la clave) sobre el objeto que esta función devuelve. Este
     módulo no decide null-vs-ausente; solo decide qué claves puede
     dejar en `undefined` para que el sanitizador de cada superficie las
     resuelva a su manera — exactamente el comportamiento de hoy.

   Campos exclusivos de la superficie PÚBLICA (`cumplioTermino`,
   `consultaTokenHash`, `analisisIa`, `solicitante.razonSocial`) se
   agregan con SPREAD CONDICIONAL sobre el parámetro: si la superficie
   interna no los pasa (quedan `undefined`), la clave NUNCA llega a
   existir en el objeto devuelto — así el sanitizador interno (que
   preserva toda clave presente, incluso en `undefined`, convirtiéndola
   en `null`) no puede materializarlos por accidente.

   `solicitante.datosNoAportados` es la ÚNICA excepción deliberada: se
   asigna SIN spread condicional (siempre queda como clave, con valor
   `DatosNoAportados` o `undefined`) porque su comportamiento HOY
   depende exactamente de esa asimetría entre sanitizadores — es el
   campo que la revisión cruzada de firestore-datos (blueprint v2)
   marcó como la divergencia real de sanitización a preservar, no a
   unificar, en esta fase. Ver golden Fase 0
   (`__tests__/fase0-golden-radicacion-interna.test.ts`).
══════════════════════════════════════════════════════════════ */

/**
 * Base de clasificación ya resuelta por el caller antes de invocar este
 * constructor:
 *  - superficie pública: objeto fijo
 *    `{ oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO' }`;
 *  - superficie interna: `construirClasificacionInicial(oficinaDestino,
 *    actorUid)` (`lib/recepcion/clasificacion-inicial.ts`), que puede
 *    agregar `funcionarioResponsableUid`.
 *
 * Este constructor NO decide esa lógica — solo incorpora el resultado.
 */
export interface ClasificacionBaseRadicado {
  oficinaDestino: TenantId;
  zonaGeografica: ZonaGeografica;
  funcionarioResponsableUid?: string;
}

export interface SolicitanteEntradaRadicado {
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombreCompleto: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ubicacion: {
    pais: string;
    departamento: string;
    municipio: string;
    /** Solo superficie interna. */
    barrio?: string | null;
  };
  /** Solo superficie interna. */
  telefonoMovil?: string | null;
  /** Solo superficie interna. */
  telefonoFijo?: string | null;
  /** Solo superficie pública (siempre `null` cuando se pasa). */
  razonSocial?: string | null;
  /**
   * Solo superficie interna. Asignación SIN spread condicional a
   * propósito — ver comentario de cabecera de este módulo.
   */
  datosNoAportados?: DatosNoAportados;
}

export interface ControlEntradaRadicado {
  medioRecepcion: MedioRecepcion;
  origen: OrigenRadicado;
  /** Ya formateada por el caller — el formato difiere por superficie
   *  (pública: con segundos y `hour12:false`; interna: corta, sin
   *  segundos). No se unifica en esta fase. */
  horaRadicado: string;
  /** Solo superficie interna. */
  origenIngreso?: OrigenIngreso;
  /** Solo superficie interna. */
  tipoEntrada?: TipoEntrada;
}

export interface TerminoEntradaRadicado {
  tipoSolicitudId: TipoSolicitudId;
  tipoSolicitudNombre: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
  fechaVencimiento: string;
}

export interface DetalleEntradaRadicado {
  asunto: string;
  descripcion: string;
  numeroFolios: number;
  anexosDescripcion: string | null;
  /** Solo superficie interna. */
  numeroAnexos?: number;
  /** Solo superficie interna. */
  observacionesAnexos?: string | null;
}

export interface EntradaConstruirRadicado {
  /** Ya asignado por el helper de consecutivo legal. */
  radicadoId: string;
  /** Ya asignado por el helper de consecutivo legal. */
  consecutivo: number;
  /** Reloj inyectado — el constructor nunca llama `new Date()`. */
  ahora: Date;

  prioridad: Prioridad;
  tipoPresentacion: TipoPresentacionPqrsd;
  canalRespuesta: CanalRespuesta | null;

  solicitante: SolicitanteEntradaRadicado;
  control: ControlEntradaRadicado;
  termino: TerminoEntradaRadicado;
  clasificacionBase: ClasificacionBaseRadicado;
  /** Solo superficie interna. */
  areaResponsable?: string | null;
  detalle: DetalleEntradaRadicado;
  /** Adjuntos ya en su ruta final (N adjuntos, como `api/radicacion` —
   *  no el caso de 1 archivo de `salidas/registrar`). */
  archivos: ArchivoRadicado[];

  /** Solo superficie pública — siempre `null` cuando se pasa. */
  cumplioTermino?: null;
  /** Solo superficie pública — condicional (solo si el ciudadano no dejó
   *  correo y se generó código de consulta). */
  consultaTokenHash?: string;
  /** Solo superficie pública. */
  analisisIa?: AnalisisIA;
}

/**
 * Construye el documento `VentanillaRadicado` a persistir, a partir de
 * datos ya validados e identificadores ya asignados. Función PURA: no
 * hace I/O, no lee contadores, no formatea el id de radicado.
 *
 * Las dos superficies vivas (pública e interna) convergen a esta
 * función; la sanitización final (`removeUndefinedDeep` /
 * `sanitizeFirestoreData`) la sigue aplicando cada caller sobre el
 * objeto devuelto.
 */
export function construirVentanillaRadicado(
  entrada: EntradaConstruirRadicado,
): VentanillaRadicado {
  const esAnonimo = entrada.tipoPresentacion === 'ANONIMA';
  const identidadReservada = entrada.tipoPresentacion === 'RESERVADA';
  const ahoraIso = entrada.ahora.toISOString();

  const serie = sugerirSerieDocumental(
    entrada.termino.tipoSolicitudId,
    entrada.clasificacionBase.oficinaDestino,
  );

  const clasificacion: ClasificacionRadicado = {
    ...entrada.clasificacionBase,
    ...(entrada.areaResponsable ? { areaResponsable: entrada.areaResponsable } : {}),
    ...(serie ? { serieDocumental: serie } : {}),
  };

  return {
    radicadoId: entrada.radicadoId,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: ahoraIso,
    prioridad: entrada.prioridad,
    ...(entrada.cumplioTermino !== undefined ? { cumplioTermino: entrada.cumplioTermino } : {}),
    esAnonimo,
    tipoPresentacion: entrada.tipoPresentacion,
    identidadReservada,
    ...(entrada.consultaTokenHash ? { consultaTokenHash: entrada.consultaTokenHash } : {}),
    canalRespuesta: entrada.canalRespuesta,

    solicitante: {
      tipoPersona: entrada.solicitante.tipoPersona,
      tipoDocumento: entrada.solicitante.tipoDocumento,
      numeroDocumento: entrada.solicitante.numeroDocumento,
      nombreCompleto: entrada.solicitante.nombreCompleto,
      ...(entrada.solicitante.razonSocial !== undefined
        ? { razonSocial: entrada.solicitante.razonSocial }
        : {}),
      email: entrada.solicitante.email,
      telefono: entrada.solicitante.telefono,
      ...(entrada.solicitante.telefonoMovil !== undefined
        ? { telefonoMovil: entrada.solicitante.telefonoMovil }
        : {}),
      ...(entrada.solicitante.telefonoFijo !== undefined
        ? { telefonoFijo: entrada.solicitante.telefonoFijo }
        : {}),
      direccion: entrada.solicitante.direccion,
      ubicacion: {
        pais: entrada.solicitante.ubicacion.pais,
        departamento: entrada.solicitante.ubicacion.departamento,
        municipio: entrada.solicitante.ubicacion.municipio,
        ...(entrada.solicitante.ubicacion.barrio !== undefined
          ? { barrio: entrada.solicitante.ubicacion.barrio }
          : {}),
      },
      // Sin spread condicional: ver comentario de cabecera del módulo.
      datosNoAportados: entrada.solicitante.datosNoAportados,
    },

    control: {
      radicadoId: entrada.radicadoId,
      consecutivo: entrada.consecutivo,
      fechaRadicado: ahoraIso,
      horaRadicado: entrada.control.horaRadicado,
      medioRecepcion: entrada.control.medioRecepcion,
      origen: entrada.control.origen,
      ...(entrada.control.origenIngreso !== undefined
        ? { origenIngreso: entrada.control.origenIngreso }
        : {}),
      ...(entrada.control.tipoEntrada !== undefined
        ? { tipoEntrada: entrada.control.tipoEntrada }
        : {}),
    },

    termino: {
      tipoSolicitudId: entrada.termino.tipoSolicitudId,
      tipoSolicitudNombre: entrada.termino.tipoSolicitudNombre,
      diasRespuesta: entrada.termino.diasRespuesta,
      unidad: entrada.termino.unidad,
      fechaVencimiento: entrada.termino.fechaVencimiento,
      prorrogasAplicadas: 0,
    },

    clasificacion,

    detalle: {
      asunto: entrada.detalle.asunto,
      descripcion: entrada.detalle.descripcion,
      numeroFolios: entrada.detalle.numeroFolios,
      anexosDescripcion: entrada.detalle.anexosDescripcion,
      ...(entrada.detalle.numeroAnexos !== undefined
        ? { numeroAnexos: entrada.detalle.numeroAnexos }
        : {}),
      ...(entrada.detalle.observacionesAnexos !== undefined
        ? { observacionesAnexos: entrada.detalle.observacionesAnexos }
        : {}),
    },

    archivos: entrada.archivos,

    ...(entrada.analisisIa !== undefined ? { analisisIa: entrada.analisisIa } : {}),
  };
}
