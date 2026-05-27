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
   MAPEO DE CANAL
══════════════════════════════════════════════════════════════ */

function mapCanal(medio: MedioRecepcion): CanalRadicadoInstitucional {
  if (medio === 'WEB')          return 'WEB';
  if (medio === 'EMAIL')        return 'EMAIL';
  if (medio === 'PRESENCIAL')   return 'PRESENCIAL';
  return 'OFICIO';
}

/* ══════════════════════════════════════════════════════════════
   ACCIÓN PRINCIPAL
══════════════════════════════════════════════════════════════ */

/**
 * Crea un VentanillaRadicado completo en la colección `ventanilla_radicados`.
 * Pasos: genera ID → sube archivos → escribe documento Firestore.
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

  const radicado: VentanillaRadicado = {
    radicadoId,
    estadoActual: 'PENDIENTE',
    prioridad:    tipo.prioridadSugerida,

    solicitante: {
      tipoPersona:     datos.tipoPersona,
      tipoDocumento:   datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento.trim(),
      nombreCompleto:  datos.nombreCompleto.trim(),
      email:           datos.email.trim()    || undefined,
      telefono:        datos.telefono.trim() || undefined,
      direccion:       datos.direccion.trim()|| undefined,
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
      tipoSolicitudId:   datos.tipoSolicitudId,
      tipoSolicitudNombre: tipo.nombre,
      diasRespuesta:     tipo.diasRespuesta,
      unidad:            tipo.unidad,
      fechaVencimiento:  datos.fechaVencimiento,
      prorrogasAplicadas: 0,
    },

    clasificacion: {
      oficinaDestino:              'VENTANILLA_UNICA',
      funcionarioResponsableUid:   actor.uid,
      zonaGeografica:              'CASCO_URBANO',
    },

    detalle: {
      asunto:            datos.asunto.trim(),
      descripcion:       datos.descripcion.trim(),
      numeroFolios:      datos.numeroFolios,
      anexosDescripcion: datos.anexosDescripcion.trim() || undefined,
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

  await setDoc(doc(getDb(), 'ventanilla_radicados', radicadoId), radicado);

  onProgress('Radicado registrado exitosamente.', 100);
  return { radicadoId, consecutivo };
}
