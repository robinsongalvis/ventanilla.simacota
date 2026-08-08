/**
 * Autorización de descarga de adjuntos internos — Sprint Seguridad P1-01 (H-01).
 *
 * Función pura, sin dependencias de Firestore ni cookies, para que se pueda
 * testear de forma exhaustiva. El endpoint
 * `app/api/interno/archivo/route.ts` la usa después de:
 *
 *   1. Verificar la sesión interna (cookie + revocación + usuario activo).
 *   2. Leer el documento del radicado relacionado.
 *
 * La función decide si el usuario puede descargar el archivo aplicando:
 *
 *   - Validación de path (prefijo permitido, sin path traversal).
 *   - Pertenencia real del archivo al radicado (anti-IDOR).
 *   - Permiso por rol y dependencia.
 *
 * Cuando deniega, devuelve un mensaje humano y un código HTTP listo para
 * usar; nunca filtra rutas internas, bucket ni stack traces.
 */

import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { SalidaOficial } from '@/src/types/salida';
import { PATH_REGEX_DOCUMENTO_EXPEDIENTE } from '@/lib/server/expedientes-documentos-tipos';

/** Prefijos de Storage aceptados por este endpoint. */
export const PREFIJOS_PERMITIDOS = ['radicados', 'respuestas', 'salidas'] as const;
export type PrefijoArchivo = typeof PREFIJOS_PERMITIDOS[number] | 'expedientes';

export interface UsuarioParaDescarga {
  uid:      string;
  rol:      RolInterno;
  tenantId: TenantId;
}

export interface RadicadoParaDescarga {
  /** `clasificacion.oficinaDestino` */
  tenantId: TenantId;
  /** Rutas de Storage de los adjuntos del ciudadano. */
  adjuntosPaths: string[];
  /** Ruta de Storage del oficio de respuesta oficial (si existe). */
  respuestaOficialPath: string | null;
}

export type MotivoDenegacion =
  | 'PATH_INVALIDO'
  | 'SESION_INVALIDA'
  | 'RADICADO_NO_ENCONTRADO'
  | 'ARCHIVO_NO_PERTENECE_AL_RADICADO'
  | 'SALIDA_NO_ENCONTRADA'
  | 'ARCHIVO_NO_PERTENECE_A_LA_SALIDA'
  | 'EXPEDIENTE_NO_ENCONTRADO'
  | 'SIN_PERMISO_DE_DEPENDENCIA';

export interface ResultadoAutorizacionDenegada {
  ok:         false;
  status:     400 | 401 | 403 | 404;
  motivo:     MotivoDenegacion;
  /** Mensaje humano, seguro de devolver al cliente. */
  mensaje:    string;
}

export interface ResultadoAutorizacionConcedida {
  ok:           true;
  prefijo:      PrefijoArchivo;
  /** Id del documento dueño (radicadoId, salidaId o expedienteId, según el prefijo). */
  radicadoId:   string;
  /** Tipo de archivo concedido — útil para el log de auditoría. */
  tipoArchivo:  'ADJUNTO_CIUDADANO' | 'RESPUESTA_OFICIAL' | 'OFICIO_SALIDA' | 'DOCUMENTO_EXPEDIENTE';
}

export type ResultadoAutorizacion =
  | ResultadoAutorizacionConcedida
  | ResultadoAutorizacionDenegada;

/* ══════════════════════════════════════════════════════════════
   VALIDACIÓN DE PATH
══════════════════════════════════════════════════════════════ */

/**
 * Estructura esperada: `<prefijo>/<radicadoId>/<nombreArchivo>`.
 * Solo se permiten los prefijos definidos en `PREFIJOS_PERMITIDOS`.
 * `<radicadoId>` y `<nombreArchivo>` tienen un alfabeto seguro y limitado
 * para evitar trucos de codificación o path traversal.
 *
 * Esta expresión es deliberadamente restrictiva: no admite `..`, ni `/`
 * extra, ni caracteres de control.
 */
const PATH_REGEX = /^(radicados|respuestas|salidas)\/[A-Za-z0-9._-]+\/[A-Za-z0-9._\- ]+$/;

export interface PathParseado {
  prefijo:    PrefijoArchivo;
  /** Id del documento dueño: radicadoId para radicados/respuestas, salidaId para salidas. */
  radicadoId: string;
  nombre:     string;
}

/**
 * Parsea y valida un path de Storage. Devuelve `null` si el path no es
 * estructuralmente válido o si contiene secuencias peligrosas.
 */
export function parsearPathArchivo(input: unknown): PathParseado | null {
  if (typeof input !== 'string') return null;
  const path = input.trim();
  if (path.length === 0) return null;
  if (path.startsWith('/')) return null;
  if (path.includes('..')) return null;
  if (path.includes('//')) return null;
  if (/[\x00-\x1F]/.test(path)) return null;
  if (!PATH_REGEX.test(path)) return null;

  const [prefijoRaw, radicadoId, ...resto] = path.split('/');
  if (!radicadoId || resto.length !== 1) return null;
  if (!(PREFIJOS_PERMITIDOS as readonly string[]).includes(prefijoRaw)) return null;

  return {
    prefijo:    prefijoRaw as PrefijoArchivo,
    radicadoId,
    nombre:     resto[0],
  };
}

/* ══════════════════════════════════════════════════════════════
   AUTORIZACIÓN
══════════════════════════════════════════════════════════════ */

/** Roles que ven todas las dependencias y pueden descargar cualquier archivo institucional. */
const ROLES_GLOBALES: ReadonlySet<RolInterno> = new Set<RolInterno>([
  'ADMIN',
  'RECEPCIONISTA',
  'CONTROL_INTERNO',
]);

/** Roles operativos cuya descarga está limitada a su propia dependencia. */
const ROLES_POR_DEPENDENCIA: ReadonlySet<RolInterno> = new Set<RolInterno>([
  'FUNCIONARIO',
  'JEFE_DEPENDENCIA',
]);

function pertenece(path: string, radicado: RadicadoParaDescarga, prefijo: PrefijoArchivo): boolean {
  if (prefijo === 'radicados') {
    return radicado.adjuntosPaths.includes(path);
  }
  // Un path de salidas nunca pertenece a un radicado: esa autorización
  // vive en autorizarDescargaSalida (defensa en profundidad).
  if (prefijo === 'salidas') return false;
  return radicado.respuestaOficialPath !== null && radicado.respuestaOficialPath === path;
}

/**
 * Decide si `usuario` puede descargar `path`, dado el radicado al que
 * pertenece el archivo. Tanto la pertenencia como el permiso se evalúan
 * sin filtrar información sensible al consumidor.
 *
 * Nota: la búsqueda y carga del radicado se hace antes en el endpoint.
 * Si el radicado no existe (o el archivo no pertenece a él), devolvemos
 * `404` con el mismo mensaje genérico para no revelar existencia.
 */
export function autorizarDescargaArchivo(args: {
  path: string;
  usuario: UsuarioParaDescarga | null;
  radicado: RadicadoParaDescarga | null;
}): ResultadoAutorizacion {
  const parsed = parsearPathArchivo(args.path);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      motivo: 'PATH_INVALIDO',
      mensaje: 'La ruta del archivo no es válida.',
    };
  }

  if (!args.usuario) {
    return {
      ok: false,
      status: 401,
      motivo: 'SESION_INVALIDA',
      mensaje: 'Debe iniciar sesión nuevamente.',
    };
  }

  // Sin radicado o sin pertenencia: respuesta uniforme para no revelar existencia.
  if (!args.radicado || !pertenece(args.path, args.radicado, parsed.prefijo)) {
    // Diferenciamos motivo interno (para el log) pero el mensaje al cliente es uniforme.
    return {
      ok: false,
      status: 404,
      motivo: args.radicado ? 'ARCHIVO_NO_PERTENECE_AL_RADICADO' : 'RADICADO_NO_ENCONTRADO',
      mensaje: 'Archivo no encontrado.',
    };
  }

  const { rol, tenantId } = args.usuario;

  if (ROLES_GLOBALES.has(rol)) {
    return {
      ok: true,
      prefijo: parsed.prefijo,
      radicadoId: parsed.radicadoId,
      tipoArchivo: parsed.prefijo === 'radicados' ? 'ADJUNTO_CIUDADANO' : 'RESPUESTA_OFICIAL',
    };
  }

  if (ROLES_POR_DEPENDENCIA.has(rol)) {
    if (args.radicado.tenantId === tenantId) {
      return {
        ok: true,
        prefijo: parsed.prefijo,
        radicadoId: parsed.radicadoId,
        tipoArchivo: parsed.prefijo === 'radicados' ? 'ADJUNTO_CIUDADANO' : 'RESPUESTA_OFICIAL',
      };
    }
    return {
      ok: false,
      status: 403,
      motivo: 'SIN_PERMISO_DE_DEPENDENCIA',
      mensaje: 'No tiene permiso para descargar este archivo.',
    };
  }

  // Cualquier otro rol no definido (defensa en profundidad).
  return {
    ok: false,
    status: 403,
    motivo: 'SIN_PERMISO_DE_DEPENDENCIA',
    mensaje: 'No tiene permiso para descargar este archivo.',
  };
}

/* ══════════════════════════════════════════════════════════════
   HELPERS PARA CONSTRUIR RadicadoParaDescarga
══════════════════════════════════════════════════════════════ */

/**
 * Extrae los datos mínimos necesarios para autorizar la descarga a partir
 * del documento completo de `ventanilla_radicados`. Mantenerlo aquí
 * concentra la lectura del esquema en un solo punto.
 */
export function aRadicadoParaDescarga(doc: VentanillaRadicado | null): RadicadoParaDescarga | null {
  if (!doc) return null;
  const adjuntos = Array.isArray(doc.archivos)
    ? doc.archivos
        .map((a) => (typeof a?.path === 'string' ? a.path : null))
        .filter((p): p is string => Boolean(p))
    : [];
  const respuestaPath = doc.respuestaOficial?.archivoPath ?? null;
  return {
    tenantId: doc.clasificacion.oficinaDestino,
    adjuntosPaths: adjuntos,
    respuestaOficialPath: typeof respuestaPath === 'string' ? respuestaPath : null,
  };
}

/* ══════════════════════════════════════════════════════════════
   OFICIOS DE SALIDA — Fase B (PDF adjunto)

   El archivo pertenece a una salida 2-SAL, no a un radicado. El
   permiso es el espejo exacto de las reglas de lectura del libro
   (firestore.rules → ventanilla_salidas): Admin, Recepción y Control
   Interno global; funcionario y jefe solo si la salida la despachó su
   dependencia. Mismas garantías anti-IDOR y de mensaje uniforme.
══════════════════════════════════════════════════════════════ */

export interface SalidaParaDescarga {
  /** `dependenciaOrigen` de la salida. */
  dependenciaOrigen: TenantId;
  /** Ruta de Storage del oficio despachado (si existe). */
  archivoPath: string | null;
}

export function autorizarDescargaSalida(args: {
  path: string;
  usuario: UsuarioParaDescarga | null;
  salida: SalidaParaDescarga | null;
}): ResultadoAutorizacion {
  const parsed = parsearPathArchivo(args.path);
  if (!parsed || parsed.prefijo !== 'salidas') {
    return {
      ok: false,
      status: 400,
      motivo: 'PATH_INVALIDO',
      mensaje: 'La ruta del archivo no es válida.',
    };
  }

  if (!args.usuario) {
    return {
      ok: false,
      status: 401,
      motivo: 'SESION_INVALIDA',
      mensaje: 'Debe iniciar sesión nuevamente.',
    };
  }

  // Sin salida o sin pertenencia: respuesta uniforme para no revelar existencia.
  if (!args.salida
    || args.salida.archivoPath === null
    || args.salida.archivoPath !== args.path) {
    return {
      ok: false,
      status: 404,
      motivo: args.salida ? 'ARCHIVO_NO_PERTENECE_A_LA_SALIDA' : 'SALIDA_NO_ENCONTRADA',
      mensaje: 'Archivo no encontrado.',
    };
  }

  const { rol, tenantId } = args.usuario;
  const concedido: ResultadoAutorizacionConcedida = {
    ok: true,
    prefijo: 'salidas',
    radicadoId: parsed.radicadoId,
    tipoArchivo: 'OFICIO_SALIDA',
  };

  if (ROLES_GLOBALES.has(rol)) return concedido;

  if (ROLES_POR_DEPENDENCIA.has(rol) && args.salida.dependenciaOrigen === tenantId) {
    return concedido;
  }

  return {
    ok: false,
    status: 403,
    motivo: 'SIN_PERMISO_DE_DEPENDENCIA',
    mensaje: 'No tiene permiso para descargar este archivo.',
  };
}

/** Datos mínimos para autorizar la descarga desde el doc de `ventanilla_salidas`. */
export function aSalidaParaDescarga(doc: SalidaOficial | null): SalidaParaDescarga | null {
  if (!doc) return null;
  return {
    dependenciaOrigen: doc.dependenciaOrigen,
    archivoPath: typeof doc.archivoPath === 'string' ? doc.archivoPath : null,
  };
}

/* ══════════════════════════════════════════════════════════════
   DOCUMENTOS DE EXPEDIENTE (D7, Bloque A·A1/A2)

   Forma de path DISTINTA de las anteriores (4 segmentos, no 2):
   `expedientes/{expedienteId}/{documentoId}/{vNNNN}/{archivo}`
   (`PATH_REGEX_DOCUMENTO_EXPEDIENTE`, contrato de
   `lib/server/expedientes-documentos-tipos.ts` — NO se toca ese regex
   aquí, solo se importa). Por eso vive en un parser/autorizador propio en
   vez de forzarse en `parsearPathArchivo`/`PATH_REGEX` (2 segmentos).
   El alfabeto del contrato EXCLUYE `_` en `expedienteId`/`documentoId` —
   `expedientes/_pendientes/…` (staging) nunca matchea: la exclusión de
   staging es estructural, no una comprobación aparte.
══════════════════════════════════════════════════════════════ */

export interface PathParseadoDocumentoExpediente {
  expedienteId: string;
  documentoId:  string;
  /** `vNNNN`, p. ej. `v0001`. */
  idVersion:    string;
  nombre:       string;
}

export function parsearPathDocumentoExpediente(input: unknown): PathParseadoDocumentoExpediente | null {
  if (typeof input !== 'string') return null;
  const path = input.trim();
  if (path.length === 0) return null;
  if (path.startsWith('/')) return null;
  if (path.includes('..')) return null;
  if (path.includes('//')) return null;
  if (/[\x00-\x1F]/.test(path)) return null;
  if (!PATH_REGEX_DOCUMENTO_EXPEDIENTE.test(path)) return null;

  const [, expedienteId, documentoId, idVersion, ...resto] = path.split('/');
  if (!expedienteId || !documentoId || !idVersion || resto.length !== 1) return null;

  return { expedienteId, documentoId, idVersion, nombre: resto[0] };
}

/** Datos mínimos del expediente dueño, para el anti-IDOR (por tenant). */
export interface ExpedienteParaDescarga {
  tenantId: string;
}

/**
 * Autoriza la descarga de un documento de expediente — anti-IDOR CONTRA
 * EL TENANT del expediente (no contra una lista de paths pertenecientes,
 * a diferencia de `autorizarDescargaArchivo`: el path YA codifica
 * `expedienteId`/`documentoId`/versión de forma no adivinable —
 * `crypto.randomUUID()`/auto-id de Firestore — así que la defensa
 * relevante es "¿este usuario puede operar el TENANT de este expediente?",
 * mismo criterio de `canOperateTenant`).
 *
 * La validación de HASH (INV-3) NO vive aquí — esta función es pura y no
 * puede leer el binario ni el doc de versión; la hace el endpoint
 * (`app/api/interno/archivo/route.ts`) DESPUÉS de autorizar, antes de
 * entregar cualquier byte.
 */
export function autorizarDescargaDocumentoExpediente(args: {
  path: string;
  usuario: UsuarioParaDescarga | null;
  expediente: ExpedienteParaDescarga | null;
}): ResultadoAutorizacion {
  const parsed = parsearPathDocumentoExpediente(args.path);
  if (!parsed) {
    return { ok: false, status: 400, motivo: 'PATH_INVALIDO', mensaje: 'La ruta del archivo no es válida.' };
  }

  if (!args.usuario) {
    return { ok: false, status: 401, motivo: 'SESION_INVALIDA', mensaje: 'Debe iniciar sesión nuevamente.' };
  }

  if (!args.expediente) {
    return { ok: false, status: 404, motivo: 'EXPEDIENTE_NO_ENCONTRADO', mensaje: 'Archivo no encontrado.' };
  }

  const { rol, tenantId } = args.usuario;
  const concedido: ResultadoAutorizacionConcedida = {
    ok: true,
    prefijo: 'expedientes',
    radicadoId: parsed.expedienteId,
    tipoArchivo: 'DOCUMENTO_EXPEDIENTE',
  };

  if (ROLES_GLOBALES.has(rol)) return concedido;

  if (ROLES_POR_DEPENDENCIA.has(rol) && args.expediente.tenantId === tenantId) {
    return concedido;
  }

  return {
    ok: false,
    status: 403,
    motivo: 'SIN_PERMISO_DE_DEPENDENCIA',
    mensaje: 'No tiene permiso para descargar este archivo.',
  };
}
