/* ══════════════════════════════════════════════════════════════
   lib/radicacion.ts
   Orquestador centralizado del proceso de radicación.
   DEPRECATED: compatibilidad legacy. El flujo público vigente usa
   POST /api/radicacion y crea en ventanilla_radicados con Admin SDK.
══════════════════════════════════════════════════════════════ */

import { doc, setDoc }    from 'firebase/firestore';
import { getDb }          from './firebase';
import { subirArchivos, type UploadResult, type UploadProgress } from './storage';
import type { AnalisisIA } from '@/src/types/ventanilla';
import { resolverTipoSolicitud, type TipoSolicitudId } from '@/lib/tiempos-radicado';

/* ──────────────────────────────────────────────
   ID de radicado
   EXT-YYYY-MM-DD-HHmmss-XXXX
   Sin caracteres ambiguos (O/0/I/1/L)
────────────────────────────────────────────── */

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generarRadicadoId(): string {
  const d      = new Date();
  const date   = d.toISOString().split('T')[0];
  const time   = d.toTimeString().slice(0, 8).replace(/:/g, '');
  const sufijo = Array.from(
    { length: 4 },
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)],
  ).join('');
  return `EXT-${date}-${time}-${sufijo}`;
}

/* ──────────────────────────────────────────────
   TIPOS PÚBLICOS
────────────────────────────────────────────── */

export interface DatosRadicacion {
  origen:   'WEB' | 'FISICO_ESCANER';
  ciudadano: {
    nombre:   string;
    email:    string;
    telefono: string;
    direccion?: string;
    cedula?:  string;   // Solo ventanilla física
  };
  descripcion:     string;
  notasInternas?:  string;   // Solo ventanilla física
  archivos:        File[];
  analisisIa?:     AnalisisIA;
  /** PQRSD: tipo de solicitud seleccionado por el ciudadano */
  tipoSolicitudId?: TipoSolicitudId;
  /** PQRSD: presentación identificada, anónima o con identidad reservada */
  tipoPresentacion?: 'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA';
  /** PQRSD: solicitud anónima (compatibilidad con registros previos) */
  esAnonimo?: boolean;
  /** PQRSD: oculta datos sensibles en interfaces no autorizadas */
  identidadReservada?: boolean;
  /** Canal de respuesta preferido */
  canalRespuesta?: 'CORREO' | 'PRESENCIAL' | 'TELEFONO' | 'DIRECCION_FISICA';
}

export interface ResultadoRadicacion {
  exito:            boolean;
  radicadoId:       string;
  errores:          string[];
  archivosSubidos:  number;
  archivosFallidos: number;
}

/* ──────────────────────────────────────────────
   PROCESO COMPLETO DE RADICACIÓN
────────────────────────────────────────────── */

/**
 * Orquesta el proceso completo:
 *   1. Sube archivos a Firebase Storage (con progreso por archivo)
 *   2. Crea el documento en Firestore
 *
 * DECISIÓN ARQUITECTÓNICA:
 * - Defaults: oficinaDestino = "VENTANILLA_UNICA", prioridad = "AMARILLO".
 *   Un funcionario puede reclasificar/asignar el radicado manualmente.
 *
 * FIRESTORE SECURITY RULES (agregar en Firebase Console → Firestore → Rules):
 * ──────────────────────────────────────────────────────────────────────────
 * match /radicados/{radicadoId} {
 *   // Lectura publica: pasar por /api/consulta/{radicadoId};
 *   // Firestore directo queda reservado a usuarios internos.
 *   allow get: if canReadRadicado(resource.data);
 *   // Listado: solo autenticados con rol correcto
 *   allow list: if isAdmin()
 *     || (isFuncionario() && resource.data.clasificacionIA.oficinaDestino == getUserTenant())
 *     || (isRecepcionista() && resource.data.clasificacionIA.oficinaDestino == getUserTenant());
 *   // Creación: cualquiera (ciudadano sin cuenta)
 *   allow create: if true;
 *   // Actualización: funcionarios y admin
 *   allow update: if isAdmin()
 *     || (isFuncionario() && resource.data.clasificacionIA.oficinaDestino == getUserTenant());
 *   // Borrado: nunca
 *   allow delete: if false;
 * }
 */
export async function radicarSolicitud(
  datos:      DatosRadicacion,
  onProgreso?: (mensaje: string, porcentaje: number, progresos?: UploadProgress[]) => void,
): Promise<ResultadoRadicacion> {
  const errores:    string[]       = [];
  const radicadoId: string         = generarRadicadoId();
  let   archivosResultado: UploadResult[] = [];
  let   archivosFallidos  = 0;

  try {
    // ── Paso 1: Subir archivos a Storage ──────────────────────────────────
    if (datos.archivos.length > 0) {
      onProgreso?.('Subiendo documentos...', 20);

      const resultado = await subirArchivos(
        datos.archivos,
        radicadoId,
        (progresos) => onProgreso?.('Subiendo documentos...', 20, progresos),
      );

      archivosResultado = resultado.exitosos;
      archivosFallidos  = resultado.fallidos.length;
      resultado.fallidos.forEach((f) =>
        errores.push(`Archivo "${f.nombre}": ${f.error}`),
      );
    } else {
      onProgreso?.('Sin documentos adjuntos...', 20);
    }

    // ── Paso 2: Crear documento en Firestore ─────────────────────────────
    onProgreso?.('Registrando radicado...', 60);

    const tipoSolicitudId = datos.tipoSolicitudId ?? 'PETICION_GENERAL';
    const tipoSolicitud = resolverTipoSolicitud(tipoSolicitudId);
    const tipoPresentacion = datos.tipoPresentacion ?? (datos.esAnonimo ? 'ANONIMA' : 'IDENTIFICADA');
    const esAnonimo = tipoPresentacion === 'ANONIMA';
    const identidadReservada = tipoPresentacion === 'RESERVADA' || !!datos.identidadReservada;

    const radicado = {
      radicadoId,
      origen:        datos.origen,
      fechaCreacion: new Date().toISOString(),
      estadoActual:  'PENDIENTE',
      prioridad:     tipoSolicitud.prioridadSugerida,
      ciudadano: {
        nombre:   esAnonimo ? 'Ciudadano anonimo' : datos.ciudadano.nombre,
        email:    datos.ciudadano.email ?? '',
        telefono: datos.ciudadano.telefono,
        ...(datos.ciudadano.direccion ? { direccion: datos.ciudadano.direccion } : {}),
        ...(datos.ciudadano.cedula ? { cedula: datos.ciudadano.cedula } : {}),
      },
      clasificacionIA: {
        oficinaDestino: datos.analisisIa?.dependenciaSugerida ?? 'VENTANILLA_UNICA',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    datos.analisisIa?.resumenEjecutivo ?? 'Pendiente de clasificación manual.',
        mensajeOriginal: datos.descripcion,
        confianza:      datos.analisisIa?.confianzaClasificacion ?? 1.0,
        etiquetasSemanticas: datos.analisisIa?.etiquetasSemanticas ?? [],
        fechaAnalisis:  datos.analisisIa?.fechaAnalisis ?? new Date().toISOString(),
      },
      archivos: archivosResultado.map((a, i) => ({
        nombre:    a.nombre,
        url:       a.url,
        path:      a.path,
        tipo:      a.tipo,
        tamanioKB: a.tamanioKB,
        orden:     i + 1,
      })),
      auditoria: [
        {
          fecha:  new Date().toISOString(),
          accion: 'RADICACION',
          actor:  datos.origen === 'WEB'
            ? 'Portal Ciudadano'
            : 'Recepcionista VU',
          nota: datos.origen === 'WEB'
            ? `Radicado desde portal web por el ciudadano. Tipo: ${tipoSolicitud.nombre}. Presentacion: ${tipoPresentacion}.`
            : 'Radicado por ventanilla física.',
        },
      ],
      ...(datos.notasInternas ? { notasInternas: datos.notasInternas } : {}),
      tipoSolicitudId,
      tipoSolicitudNombre: tipoSolicitud.nombre,
      tipoPresentacion,
      esAnonimo,
      identidadReservada,
      ...(datos.canalRespuesta ? { canalRespuesta: datos.canalRespuesta } : {}),
    };

    const db = getDb();
    await setDoc(doc(db, 'radicados', radicadoId), radicado);

    onProgreso?.('¡Radicado exitosamente!', 100);

    return {
      exito:            true,
      radicadoId,
      errores,
      archivosSubidos:  archivosResultado.length,
      archivosFallidos,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exito:            false,
      radicadoId,
      errores:          [...errores, msg],
      archivosSubidos:  archivosResultado.length,
      archivosFallidos: datos.archivos.length - archivosResultado.length,
    };
  }
}
