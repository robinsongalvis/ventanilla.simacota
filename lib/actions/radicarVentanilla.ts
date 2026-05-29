import { doc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { generarRadicadoInstitucional, type CanalRadicadoInstitucional } from '@/lib/radicado-institucional';
import { TIPOS_SOLICITUD, type TipoSolicitudId } from '@/lib/tiempos-radicado';
import { subirArchivos } from '@/lib/storage';
import type { VentanillaRadicado, TipoPersona, TipoDocumento, MedioRecepcion } from '@/src/types/ventanilla';
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
 * Elimina recursivamente todos los valores `undefined` de un objeto
 * antes de enviarlo a Firestore. Convierte los `undefined` a `null`
 * para preservar la estructura del documento y respetar el tipado.
 *
 * Firestore: acepta `null` ✅ — rechaza `undefined` ❌
 */
export function sanitizeFirestoreData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      // Convertimos undefined a null para cumplir con Firestore
      sanitized[key] = null;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      // Recursión sobre objetos anidados (ej. solicitante, detalle, termino)
      sanitized[key] = sanitizeFirestoreData(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Los arrays se sanitizan elemento a elemento
      sanitized[key] = value.map((item) =>
        item !== null && typeof item === 'object'
          ? sanitizeFirestoreData(item as Record<string, unknown>)
          : item ?? null,
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/* ══════════════════════════════════════════════════════════════
   MAPEO DE CANAL
══════════════════════════════════════════════════════════════ */

function mapCanal(medio: MedioRecepcion): CanalRadicadoInstitucional {
  if (medio === 'WEB')        return 'WEB';
  if (medio === 'EMAIL')      return 'EMAIL';
  if (medio === 'PRESENCIAL') return 'PRESENCIAL';
  return 'OFICIO';
}

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
export async function radicarInstitucionalmente(
  datos:      DatosRadicacionInstitucional,
  actor:      ActorRadicacion,
  onProgress: (mensaje: string, pct: number) => void = () => {},
): Promise<ResultadoRadicacion> {
  onProgress('Generando número de radicado…', 10);

  const canal = mapCanal(datos.medioRecepcion);
  const { radicadoId, consecutivo } = await generarRadicadoInstitucional(canal);

  onProgress('Subiendo archivos adjuntos…', 30);
  const { exitosos } = datos.archivos.length > 0
    ? await subirArchivos(datos.archivos, radicadoId)
    : { exitosos: [] };

  onProgress('Guardando radicado en Firestore…', 75);

  const tipo = TIPOS_SOLICITUD[datos.tipoSolicitudId];
  const ahora = new Date();

  // Construimos el documento con `null` explícito en campos opcionales vacíos.
  // Nunca usamos `|| undefined` — Firestore rechaza undefined con una excepción:
  // "Function setDoc() called with invalid data. Unsupported field value: undefined"
  const radicado: VentanillaRadicado = {
    radicadoId,
    estadoActual: 'PENDIENTE',
    prioridad:    tipo.prioridadSugerida,

    solicitante: {
      tipoPersona:     datos.tipoPersona,
      tipoDocumento:   datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento.trim(),
      nombreCompleto:  datos.nombreCompleto.trim(),
      // Campos opcionales: cadena vacía → null (NUNCA undefined)
      email:    datos.email.trim()     || null,
      telefono: datos.telefono.trim()  || null,
      direccion: datos.direccion.trim() || null,
      ubicacion: {
        pais:         datos.pais,
        departamento: datos.departamento,
        municipio:    datos.municipio,
      },
    },

    control: {
      radicadoId,
      consecutivo,
      fechaRadicado:  ahora.toISOString(),
      horaRadicado:   ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      medioRecepcion: datos.medioRecepcion,
      origen:         datos.medioRecepcion === 'WEB' ? 'WEB' : 'FISICO_ESCANER',
    },

    termino: {
      tipoSolicitudId:     datos.tipoSolicitudId,
      tipoSolicitudNombre: tipo.nombre,
      diasRespuesta:       tipo.diasRespuesta,
      unidad:              tipo.unidad,
      fechaVencimiento:    datos.fechaVencimiento,
      prorrogasAplicadas:  0,
    },

    clasificacion: {
      oficinaDestino:            'VENTANILLA_UNICA',
      funcionarioResponsableUid: actor.uid,
      zonaGeografica:            'CASCO_URBANO',
    },

    detalle: {
      asunto:       datos.asunto.trim(),
      descripcion:  datos.descripcion.trim(),
      numeroFolios: datos.numeroFolios,
      // Si el campo viene vacío o con solo espacios → null.
      // NUNCA undefined → genera: "Unsupported field value: undefined"
      // en detalle.anexosDescripcion al llamar a setDoc().
      anexosDescripcion: datos.anexosDescripcion.trim() || null,
    },

    archivos: exitosos.map((a, i) => ({
      nombre:    a.nombre,
      url:       a.url,
      path:      a.path,
      tipo:      a.tipo,
      tamanioKB: a.tamanioKB,
      orden:     i + 1,
    })),

    trazabilidad: [
      {
        fecha:       ahora.toISOString(),
        accion:      'RADICACION',
        actorUid:    actor.uid,
        actorNombre: actor.nombre,
        nota:        `Radicado por ${actor.nombre} · Canal: ${datos.medioRecepcion}`,
      },
    ],
  };

  // Capa de defensa final: sanitizeFirestoreData garantiza que ningún campo
  // llegue como `undefined` aunque se añadan atributos nuevos en el futuro.
  const radicadoSeguro = sanitizeFirestoreData(
    radicado as unknown as Record<string, unknown>,
  );

  await setDoc(doc(getDb(), 'ventanilla_radicados', radicadoId), radicadoSeguro);

  onProgress('Radicado registrado exitosamente.', 100);
  return { radicadoId, consecutivo };
}
