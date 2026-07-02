import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { generarRadicadoInstitucional, type CanalRadicadoInstitucional } from '@/lib/radicado-institucional';
import { TIPOS_SOLICITUD, type TipoSolicitudId } from '@/lib/tiempos-radicado';
import { subirArchivos } from '@/lib/storage';
import { validarReglasRadicacion } from '@/lib/seguridad/reglas-radicacion';
import type {
  CanalRespuesta,
  DatosNoAportados,
  MedioRecepcion,
  OrigenIngreso,
  TipoDocumento,
  TipoEntrada,
  TipoPersona,
  TrazabilidadRadicado,
  VentanillaRadicado,
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

function algunNoAportado(d: DatosNoAportados): boolean {
  return Boolean(d.documento || d.telefono || d.correo || d.direccion);
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
  // Sprint 1.5 — reglas de negocio delegadas a lib/seguridad/reglas-radicacion.
  const errorRegla = validarReglasRadicacion({
    noAportaCorreo: datos.noAportaCorreo,
    canalRespuesta: datos.canalRespuesta,
  });
  if (errorRegla) {
    throw new RadicacionValidacionError(errorRegla);
  }

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
  // Sprint Ventanilla Operativa 1 — objeto de marcas "no aporta".
  const datosNoAportados: DatosNoAportados = {
    documento: datos.noAportaDocumento === true,
    telefono:  datos.noAportaTelefono  === true,
    correo:    datos.noAportaCorreo    === true,
    direccion: datos.noAportaDireccion === true,
  };
  const hayNoAportados = algunNoAportado(datosNoAportados);

  const radicado: VentanillaRadicado = {
    radicadoId,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: ahora.toISOString(),
    prioridad:    tipo.prioridadSugerida,
    canalRespuesta: datos.canalRespuesta ?? null,

    solicitante: {
      tipoPersona:     datos.tipoPersona,
      tipoDocumento:   datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento.trim(),
      nombreCompleto:  datos.nombreCompleto.trim(),
      // Campos opcionales: cadena vacía → null (NUNCA undefined)
      email:    datos.email.trim()     || null,
      telefono: datos.telefono.trim()  || null,
      telefonoMovil: (datos.telefonoMovil ?? '').trim() || null,
      telefonoFijo:  (datos.telefonoFijo  ?? '').trim() || null,
      direccion: datos.direccion.trim() || null,
      ubicacion: {
        pais:         datos.pais,
        departamento: datos.departamento,
        municipio:    datos.municipio,
        barrio:       (datos.barrio ?? '').trim() || null,
      },
      datosNoAportados: hayNoAportados ? datosNoAportados : undefined,
    },

    control: {
      radicadoId,
      consecutivo,
      fechaRadicado:  ahora.toISOString(),
      horaRadicado:   ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      medioRecepcion: datos.medioRecepcion,
      origen:         datos.medioRecepcion === 'WEB' ? 'WEB' : 'FISICO_ESCANER',
      origenIngreso:  datos.origenIngreso ?? 'PQRSD_WEB_OFICIAL',
      tipoEntrada:    datos.tipoEntrada   ?? 'PQRSD',
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
      numeroAnexos: datos.numeroAnexos ?? 0,
      observacionesAnexos: (datos.observacionesAnexos ?? '').trim() || null,
    },

    archivos: exitosos.map((a, i) => ({
      nombre:    a.nombre,
      url:       a.url,
      path:      a.path,
      tipo:      a.tipo,
      tamanioKB: a.tamanioKB,
      orden:     i + 1,
    })),

  };

  // Capa de defensa final: sanitizeFirestoreData garantiza que ningún campo
  // llegue como `undefined` aunque se añadan atributos nuevos en el futuro.
  const radicadoSeguro = sanitizeFirestoreData(
    radicado as unknown as Record<string, unknown>,
  );

  await setDoc(doc(getDb(), 'ventanilla_radicados', radicadoId), radicadoSeguro);
  await addDoc(
    collection(getDb(), 'ventanilla_radicados', radicadoId, 'trazabilidad'),
    {
      eventoId: `ev_${radicadoId}_RADICACION`,
      fecha: ahora.toISOString(),
      accion: 'RADICACION',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      nota: `Radicado por ${actor.nombre} · Canal: ${datos.medioRecepcion}`,
    } satisfies TrazabilidadRadicado,
  );

  // Sprint 1.5 — evento operativo cuando el solicitante no aportó datos.
  // No se muestra en la línea de tiempo pública (ver ACCIONES_PUBLICAS
  // en lib/seguridad/consulta-publica-radicado.ts).
  if (hayNoAportados) {
    await addDoc(
      collection(getDb(), 'ventanilla_radicados', radicadoId, 'trazabilidad'),
      {
        eventoId: `ev_${radicadoId}_DATOS_NO_APORTADOS`,
        fecha: ahora.toISOString(),
        accion: 'DATOS_NO_APORTADOS_MARCADOS',
        actorUid: actor.uid,
        actorNombre: actor.nombre,
        nota: construirNotaDatosNoAportados(datosNoAportados),
        metadata: {
          documento: datosNoAportados.documento === true,
          correo:    datosNoAportados.correo    === true,
          telefono:  datosNoAportados.telefono  === true,
          direccion: datosNoAportados.direccion === true,
        },
      } satisfies TrazabilidadRadicado,
    );
  }

  onProgress('Radicado registrado exitosamente.', 100);
  return { radicadoId, consecutivo };
}
