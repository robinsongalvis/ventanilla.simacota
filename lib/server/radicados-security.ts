import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { verificarMagicBytes } from '@/lib/seguridad/magic-bytes';
import type { InternalUserSession } from '@/lib/server/internal-auth';
import type { ResponsableFuncionario } from '@/lib/actions/asignarRadicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import { esEstadoCerrado } from '@/lib/radicado-estados';
import type {
  ArchivoRadicado,
  RespuestaOficial,
  TrazabilidadRadicado,
  VentanillaRadicado,
} from '@/src/types/ventanilla';

export class RadicadoActionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export async function getRadicadoOrFail(radicadoId: string): Promise<VentanillaRadicado> {
  const snap = await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).get();
  if (!snap.exists) {
    throw new RadicadoActionError('Radicado no encontrado.', 404);
  }
  return snap.data() as VentanillaRadicado;
}

export async function appendTrazabilidadAdmin(
  radicadoId: string,
  entrada: Omit<TrazabilidadRadicado, 'eventoId'>,
): Promise<void> {
  await getFirebaseAdminDb()
    .collection(`ventanilla_radicados/${radicadoId}/trazabilidad`)
    .add(removeUndefinedDeep({
      ...entrada,
      eventoId: `ev_${radicadoId}_${Date.now()}`,
    }));
}

export function assertNotClosed(radicado: VentanillaRadicado): void {
  // Fuente única de estados cerrados (OAT-05): incluye DESISTIDO. Antes se
  // codificaba ['RESUELTO','RECHAZADO'] y omitía DESISTIDO, dejando reabrible
  // (p. ej. prorrogable) un acto firme por desistimiento tácito.
  if (esEstadoCerrado(radicado.estadoActual)) {
    throw new RadicadoActionError('El radicado ya está cerrado y no permite esta acción.', 409);
  }
}

/** Motivo de rechazo de una solicitud de prórroga, o `null` si es válida. */
export interface RechazoProrroga {
  status: 400 | 409;
  mensaje: string;
}

/**
 * Control ejecutable de prórroga (ADR-0003 hallazgo H1; ADR-0012 hallazgo R6)
 * — Ley 1755/2015 art. 14, parágrafo: admite una única ampliación excepcional
 * cuyo nuevo plazo no podrá exceder del doble del término inicialmente
 * previsto, y exige informarla ANTES de que venza el término original.
 *
 * Se enforce en tres reglas independientes, evaluadas en este orden:
 * 1. Unicidad — ya existe al menos una prórroga aplicada.
 * 2. Tope — los días solicitados exceden el término base del tipo de
 *    solicitud (`diasProrroga === diasRespuesta` es la frontera válida).
 * 3. Temporalidad (R6) — el término original ya venció. Solo se evalúa si
 *    se recibe `fechaVencimiento`; si se omite, la regla no aplica (permite
 *    llamadas que no disponen de esa fecha, p. ej. tests de H1 previos a R6).
 *    Frontera: si `fechaVencimiento` es exactamente igual a `ahora`, se
 *    considera VENCIDO (rechaza) — "antes del vencimiento" excluye el
 *    instante mismo del vencimiento (decisión ADR-0012).
 *
 * Devuelve el primer motivo de rechazo, o `null` si la prórroga es válida.
 * Función pura: no accede a Firestore ni tiene efectos secundarios — el
 * endpoint debe invocarla ANTES de cualquier escritura para IMPEDIR (no
 * solo advertir) el estado inválido. `ahora` es inyectable (valor o fábrica)
 * para permitir tests deterministas, siguiendo el patrón de H1.
 */
export function validarProrroga(params: {
  prorrogasAplicadas: number | undefined;
  diasProrroga: number;
  diasRespuesta: number;
  /** ISO string del vencimiento vigente del término. Omitir desactiva R6. */
  fechaVencimiento?: string;
  /** Reloj inyectable para tests deterministas. Por defecto, `new Date()`. */
  ahora?: Date | (() => Date);
}): RechazoProrroga | null {
  const { diasProrroga, diasRespuesta, fechaVencimiento } = params;
  const prorrogasAplicadas = params.prorrogasAplicadas ?? 0;

  if (prorrogasAplicadas >= 1) {
    return {
      status: 409,
      mensaje: 'Este radicado ya tiene una prórroga aplicada. La Ley 1755/2015 (art. 14) solo permite una ampliación excepcional del término.',
    };
  }

  if (diasProrroga > diasRespuesta) {
    return {
      status: 400,
      mensaje: `Los días de prórroga (${diasProrroga}) superan el tope legal: el nuevo plazo no puede exceder el doble del término inicial (${diasRespuesta} días, Ley 1755/2015 art. 14).`,
    };
  }

  if (fechaVencimiento) {
    const ahora = typeof params.ahora === 'function' ? params.ahora() : (params.ahora ?? new Date());
    const vencimiento = new Date(fechaVencimiento);
    if (vencimiento.getTime() <= ahora.getTime()) {
      return {
        status: 409,
        mensaje: 'El término original ya venció: la Ley 1755/2015 (art. 14, parágrafo) exige informar la ampliación del término ANTES de su vencimiento, no después.',
      };
    }
  }

  return null;
}

export function buildResponsableSnapshot(responsable?: ResponsableFuncionario | null): Record<string, unknown> {
  if (!responsable) return {};

  return {
    'clasificacion.funcionarioResponsableUid': responsable.uid,
    'clasificacion.funcionarioResponsableNombre': responsable.nombre,
    'clasificacion.funcionarioResponsableEmail': responsable.email,
    'clasificacion.funcionarioResponsableRol': responsable.rol,
    ...(responsable.cargo ? { 'clasificacion.funcionarioResponsableCargo': responsable.cargo } : {}),
    'clasificacion.fechaAsignacionResponsable': new Date().toISOString(),
  };
}

export function buildResponsableMetadata(responsable?: ResponsableFuncionario | null): Record<string, unknown> {
  if (!responsable) return {};

  return {
    funcionarioResponsableUid: responsable.uid,
    funcionarioResponsableNombre: responsable.nombre,
    funcionarioResponsableEmail: responsable.email,
    funcionarioResponsableRol: responsable.rol,
    ...(responsable.cargo ? { funcionarioResponsableCargo: responsable.cargo } : {}),
  };
}

export function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.\- ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'archivo.pdf';
}

export async function uploadRespuestaPdfAdmin(
  file: File,
  radicadoId: string,
): Promise<ArchivoRadicado> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new RadicadoActionError('FIREBASE_STORAGE_BUCKET no configurado.', 400);
  }

  if (file.type !== 'application/pdf') {
    throw new RadicadoActionError('El oficio de respuesta debe ser un PDF.', 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new RadicadoActionError('El PDF supera el tamaño máximo permitido de 10 MB.', 400);
  }

  const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const path = `respuestas/${radicadoId}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // H-N01: verificar firma real del PDF (Content-Type es falsificable).
  if (!verificarMagicBytes(buffer, 'application/pdf')) {
    throw new RadicadoActionError('El oficio de respuesta no es un PDF válido.', 400);
  }

  await getFirebaseAdminStorage()
    .bucket(bucketName)
    .file(path)
    .save(buffer, {
      resumable: false,
      metadata: { contentType: 'application/pdf' },
    });

  return {
    nombre: file.name,
    url: '',
    path,
    tipo: 'application/pdf',
    tamanioKB: Math.max(1, Math.round(file.size / 1024)),
    orden: 1,
  };
}

/**
 * Construye el objeto RespuestaOficial persistido en el documento del radicado.
 *
 * Se persiste SIEMPRE que el funcionario haya escrito una `nota` válida,
 * independientemente de si adjuntó un PDF firmado. Las respuestas sin PDF
 * son legítimas (consultas administrativas, respuestas verbales formalizadas,
 * etc.) y deben quedar visibles para el ciudadano y en el CSV MIPG.
 */
export function buildRespuestaOficial(
  archivo: ArchivoRadicado | null,
  nota: string,
  ahora: string,
  usuario: InternalUserSession,
): RespuestaOficial | null {
  const notaLimpia = nota?.trim() ?? '';
  if (notaLimpia.length === 0) return null;

  return {
    archivoPath:   archivo?.path ?? null,
    archivoNombre: archivo?.nombre ?? null,
    nota:          notaLimpia,
    fecha:         ahora,
    actorUid:      usuario.uid,
    actorNombre:   usuario.nombre,
  };
}

export function nombreTenant(tenantId: TenantId): string {
  return NOMBRES_TENANT[tenantId] ?? tenantId;
}
