/* ══════════════════════════════════════════════════════════════
   lib/radicacion.ts
   Orquestador centralizado del proceso de radicación.
   Usado por el portal ciudadano (/ciudadano/radicar) y la
   ventanilla física (/interno/recepcion).
══════════════════════════════════════════════════════════════ */

import { doc, setDoc }    from 'firebase/firestore';
import { getDb }          from './firebase';
import { subirArchivos, type UploadResult, type UploadProgress } from './storage';
import { enviarWebhookN8N }  from './webhook';

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
    cedula?:  string;   // Solo ventanilla física
  };
  descripcion:     string;
  notasInternas?:  string;   // Solo ventanilla física
  archivos:        File[];
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
 *   3. Envía el webhook a n8n para clasificación IA
 *
 * DECISIÓN ARQUITECTÓNICA:
 * - El webhook es fire-and-forget: si falla, el radicado ya está en Firestore
 *   y se clasifica manualmente. El ciudadano NUNCA pierde su radicado.
 * - Defaults: oficinaDestino = "VENTANILLA_UNICA", prioridad = "AMARILLO".
 *   La IA los sobreescribirá vía n8n → Firebase Admin.
 *
 * FIRESTORE SECURITY RULES (agregar en Firebase Console → Firestore → Rules):
 * ──────────────────────────────────────────────────────────────────────────
 * match /radicados/{radicadoId} {
 *   // Lectura pública de documento individual (consulta ciudadana por ID)
 *   allow get: if true;
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

    const radicado = {
      radicadoId,
      origen:        datos.origen,
      fechaCreacion: new Date().toISOString(),
      estadoActual:  'PENDIENTE',
      // Default AMARILLO; la IA lo reclasificará vía n8n
      prioridad:     'AMARILLO',
      ciudadano: {
        nombre:   datos.ciudadano.nombre,
        email:    datos.ciudadano.email ?? '',
        telefono: datos.ciudadano.telefono,
        ...(datos.ciudadano.cedula ? { cedula: datos.ciudadano.cedula } : {}),
      },
      clasificacionIA: {
        // Defaults que la IA sobreescribirá
        oficinaDestino: 'VENTANILLA_UNICA',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    '',
        mensajeOriginal: datos.descripcion,
      },
      archivos: archivosResultado.map((a, i) => ({
        nombre:    a.nombre,
        url:       a.url,
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
            ? 'Radicado desde portal web por el ciudadano.'
            : 'Radicado por ventanilla física.',
        },
      ],
      ...(datos.notasInternas ? { notasInternas: datos.notasInternas } : {}),
    };

    const db = getDb();
    await setDoc(doc(db, 'radicados', radicadoId), radicado);

    // ── Paso 3: Webhook a n8n ────────────────────────────────────────────
    onProgreso?.('Enviando a clasificación IA...', 80);

    try {
      await enviarWebhookN8N(radicado);
    } catch (webhookErr: unknown) {
      // El webhook NO bloquea la radicación — el radicado ya está en Firestore
      const msg = webhookErr instanceof Error ? webhookErr.message : String(webhookErr);
      errores.push(
        `Clasificación IA no disponible (${msg}). Se clasificará manualmente.`,
      );
    }

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
