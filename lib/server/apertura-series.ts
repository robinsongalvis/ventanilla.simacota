import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import { periodoColombia } from '@/lib/fecha-colombia';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import type { SerieConsecutivo } from '@/lib/server/consecutivo-legal';

/**
 * APERTURA DE UNA SERIE CONSECUTIVA — sincronizar la plataforma con el libro.
 *
 * POR QUÉ EXISTE, y por qué el número no es continuo con el libro de papel.
 *
 * El libro de correspondencia de la Alcaldía **avanza todos los días**: mientras
 * ventanilla siga radicando a mano, cualquier número que se fije por anticipado
 * queda viejo antes del primer trámite real. Si hoy el libro va en 1542, cuando
 * la plataforma arranque puede ir en 1550 o en 1600.
 *
 * Por eso la apertura NO se fija en el código ni con semanas de antelación: el
 * propietario consulta el libro el día del arranque y fija el punto entonces.
 *
 * Y por eso se abre POR ENCIMA del libro, con margen, no en el número
 * siguiente. Entre la consulta y el arranque puede que ventanilla radique algo
 * a mano; con margen ese radicado cabe sin chocar. La regla que lo justifica es
 * asimétrica y conviene tenerla escrita:
 *
 *     UN HUECO EN LA SERIE SE EXPLICA. UN DUPLICADO NO.
 *
 * Un hueco se documenta con un acta y se sostiene ante una auditoría. Dos
 * documentos distintos con el mismo número de radicado son dos expedientes que
 * se pisan, y eso no se arregla con una explicación.
 *
 * ACTO ÚNICO, NUNCA UN AJUSTE CONTINUO. Si el contador ya está por encima del
 * punto configurado, esta operación NO HACE NADA — no baja, no corrige, no
 * "sincroniza". Bajar un contador es emitir dos veces el mismo número, que es
 * exactamente lo que se viene a evitar.
 */

/** Lo que el propietario configura, sin desplegar, para abrir una serie. */
export interface AperturaConfigurada {
  /** Primer consecutivo que la plataforma emitirá. Se fija CON MARGEN sobre el libro. */
  desde: number;
  /** Quién lo autorizó — queda escrito en el contador para que el salto tenga dueño. */
  autorizadoPor: string;
  /** Acta o referencia que respalda la apertura. */
  referencia?: string;
}

export type DecisionApertura =
  | { accion: 'ABRIR'; veniaDe: number; nuevoUltimo: number }
  /** El contador ya está igual o por encima: no se toca. NO es un error. */
  | { accion: 'NADA'; motivo: string }
  /** La configuración no sirve: se rechaza sin escribir. */
  | { accion: 'RECHAZAR'; motivo: string };

/**
 * Decide qué hacer con una serie. Función PURA: sin Firestore, sin reloj.
 *
 * @param ultimoActual Valor de `counters/{serie}-{año}.ultimo` (0 si no existe).
 * @param config       Lo que el propietario configuró para esa serie.
 */
export function decidirApertura(
  serie: SerieConsecutivo,
  ultimoActual: number,
  config: AperturaConfigurada | undefined,
): DecisionApertura {
  if (!config) {
    return { accion: 'NADA', motivo: `La serie '${serie}' no tiene punto de apertura configurado.` };
  }
  if (!Number.isInteger(ultimoActual) || ultimoActual < 0) {
    return {
      accion: 'RECHAZAR',
      motivo: `El contador de '${serie}' tiene un valor inválido (${ultimoActual}). No se abre sobre un contador que no se entiende.`,
    };
  }
  if (!Number.isInteger(config.desde) || config.desde <= 0) {
    return {
      accion: 'RECHAZAR',
      motivo: `Punto de apertura inválido para '${serie}' (${config.desde}). Debe ser un entero positivo.`,
    };
  }
  if (!config.autorizadoPor?.trim()) {
    return {
      accion: 'RECHAZAR',
      motivo: `La apertura de '${serie}' no declara quién la autoriza. Un salto en la serie sin dueño es un salto que nadie puede explicar.`,
    };
  }

  /* `desde` es el PRIMER número a emitir, así que el contador debe quedar en
     `desde - 1`: la próxima emisión hace +1 y sale `desde`. Confundir esto
     desplaza la serie entera en uno, que es un error silencioso y caro. */
  const nuevoUltimo = config.desde - 1;

  if (nuevoUltimo <= ultimoActual) {
    return {
      accion: 'NADA',
      motivo:
        `El contador de '${serie}' ya está en ${ultimoActual}; abrir en ${config.desde} lo dejaría en ` +
        `${nuevoUltimo}, que no avanza. NO se toca: bajar un contador es emitir dos veces el mismo número.`,
    };
  }

  return { accion: 'ABRIR', veniaDe: ultimoActual, nuevoUltimo };
}

/** Lo que se escribe en el contador al abrir — el salto queda con su historia. */
export interface RegistroApertura {
  /** Valor que tenía el contador antes de la apertura. */
  veniaDe: number;
  /** Primer consecutivo que se emitirá tras la apertura. */
  abiertoEn: number;
  fecha: string;
  autorizadoPor: string;
  referencia?: string;
  /**
   * Por qué el número NO es continuo con el libro de papel. Se guarda en el
   * DATO y no solo en un acta: dentro de un año alguien verá el salto en la
   * serie, y la explicación debe estar donde está el salto.
   */
  motivoDelSalto: string;
}

export const MOTIVO_DEL_SALTO =
  'El libro de correspondencia avanza a diario mientras ventanilla radica a mano, ' +
  'así que cualquier número fijado por anticipado queda desactualizado antes del ' +
  'primer trámite real. La serie se abre POR ENCIMA del libro, con margen, para ' +
  'que un radicado manual hecho entre la consulta y el arranque no choque: un ' +
  'hueco en la serie se explica con acta, un duplicado no se arregla.';

export function construirRegistroApertura(
  decision: Extract<DecisionApertura, { accion: 'ABRIR' }>,
  config: AperturaConfigurada,
  ahoraIso: string,
): RegistroApertura {
  return {
    veniaDe: decision.veniaDe,
    abiertoEn: decision.nuevoUltimo + 1,
    fecha: ahoraIso,
    autorizadoPor: config.autorizadoPor.trim(),
    ...(config.referencia ? { referencia: config.referencia } : {}),
    motivoDelSalto: MOTIVO_DEL_SALTO,
  };
}

/* ══════════════════════════════════════════════════════════════
   Apertura única de la serie de radicados de contingencia.

   A diferencia del helper histórico de arriba —útil para dry-runs y otras
   series— este contrato representa un ACTO INMUTABLE: una vez confirmado no
   existe una operación de «ajuste». Repetir exactamente el mismo primer
   número es idempotente; intentar otro queda bloqueado.
══════════════════════════════════════════════════════════════ */

export const PRIMER_NUMERO_CONTINGENCIA_SUGERIDO = 1745;
export const AUTORIZADO_POR_APERTURA_CONTINGENCIA =
  'Secretaría de Gobierno de Simacota — instrucción de contingencia comunicada el 29-sep-2026';
export const REFERENCIA_APERTURA_CONTINGENCIA =
  'docs/actas/ACTA_APERTURA_CONTINGENCIA_RADICADOS_2026-09-29.md';

/**
 * Tope defensivo de la verificación histórica previa a la apertura.
 *
 * La apertura es un acto administrativo único y el volumen actual está muy
 * por debajo de esta cota. Aun así, ambas colecciones crecen con el histórico:
 * alcanzar el techo significa que la barrida dejó de poder demostrar que está
 * viendo el universo completo. En ese caso se falla cerrado y se exige revisar
 * la estrategia (índice/migración o paginación) antes de abrir la serie.
 */
export const TECHO_LECTURA_APERTURA = 1000;

const CAMPOS_CONTROL_APERTURA = [
  'consecutivo',
  'control.consecutivo',
  'control.fechaRadicado',
  'control.radicadoId',
] as const;

export interface ActorAperturaSerie {
  uid: string;
  nombre: string | null;
  rol: 'ADMIN';
  tenantId: string;
}

/** Registro inmutable embebido en `counters/radicados-{año}.apertura`. */
export interface AperturaUnicaRadicados {
  version: 1;
  estado: 'BLOQUEADA';
  serie: 'radicados';
  anio: number;
  veniaDe: number;
  /** Alias canónico que consumen los guards históricos de counters. */
  abiertoEn: number;
  primerNumero: number;
  ultimoInicial: number;
  fecha: string;
  fechaHoraBogota: string;
  autorizadoPor: string;
  referencia: string;
  auditoriaId: string;
  actorUid: string;
  actorNombre: string | null;
  actorRol: 'ADMIN';
  tenantId: string;
}

export interface AuditoriaAperturaUnicaRadicados {
  accion: 'APERTURA_SERIE_RADICADOS_CONFIRMADA';
  actorUid: string;
  actorNombre: string | null;
  actorRol: 'ADMIN';
  tenantId: string;
  fecha: string;
  fechaHoraBogota: string;
  referencia: string;
  metadata: {
    serie: 'radicados';
    anio: number;
    anterior: number;
    primerNumero: number;
    nuevoUltimo: number;
    estado: 'BLOQUEADA';
    proximoRadicado: string;
  };
}

export interface EstadoAperturaRadicados {
  ok: true;
  anio: number;
  ultimo: number;
  proximoRadicado: string;
  openingAlreadyExists: boolean;
  primerNumeroSugerido: number;
  apertura?: AperturaUnicaRadicados;
}

export class AperturaSerieRadicadosError extends Error {
  readonly status: 400 | 409;

  constructor(status: 400 | 409, message: string) {
    super(message);
    this.name = 'AperturaSerieRadicadosError';
    this.status = status;
  }
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function isoValido(valor: unknown): valor is string {
  return textoNoVacio(valor) && Number.isFinite(Date.parse(valor));
}

/** Fecha ISO con offset institucional. Colombia no observa DST. */
export function fechaHoraBogotaIso(fecha: Date): string {
  if (!Number.isFinite(fecha.getTime())) {
    throw new AperturaSerieRadicadosError(400, 'La fecha de apertura no es válida.');
  }
  const desplazada = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  return desplazada.toISOString().replace('Z', '-05:00');
}

/**
 * Parsea el registro completo. Cualquier campo ausente vuelve la apertura
 * inválida: una serie legal no continúa sobre una autorización ambigua.
 */
export function leerAperturaUnicaRadicados(
  valor: unknown,
  anioEsperado: number,
): AperturaUnicaRadicados | null {
  if (!esRegistro(valor)) return null;
  if (
    valor.version !== 1
    || valor.estado !== 'BLOQUEADA'
    || valor.serie !== 'radicados'
    || valor.anio !== anioEsperado
    || !Number.isSafeInteger(valor.veniaDe)
    || (valor.veniaDe as number) < 0
    || !Number.isSafeInteger(valor.primerNumero)
    || (valor.primerNumero as number) <= (valor.veniaDe as number)
    || valor.abiertoEn !== valor.primerNumero
    || valor.ultimoInicial !== (valor.primerNumero as number) - 1
    || !isoValido(valor.fecha)
    || !textoNoVacio(valor.fechaHoraBogota)
    || !/^-?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-05:00$/.test(valor.fechaHoraBogota)
    || !textoNoVacio(valor.autorizadoPor)
    || !textoNoVacio(valor.referencia)
    || !textoNoVacio(valor.auditoriaId)
    || valor.auditoriaId.includes('/')
    || !textoNoVacio(valor.actorUid)
    || (valor.actorNombre !== null && typeof valor.actorNombre !== 'string')
    || valor.actorRol !== 'ADMIN'
    || !textoNoVacio(valor.tenantId)
  ) return null;

  return valor as unknown as AperturaUnicaRadicados;
}

export function auditoriaCoincideConApertura(
  valor: unknown,
  apertura: AperturaUnicaRadicados,
): valor is AuditoriaAperturaUnicaRadicados {
  if (!esRegistro(valor) || !esRegistro(valor.metadata)) return false;
  return valor.accion === 'APERTURA_SERIE_RADICADOS_CONFIRMADA'
    && valor.actorUid === apertura.actorUid
    && valor.actorNombre === apertura.actorNombre
    && valor.actorRol === apertura.actorRol
    && valor.tenantId === apertura.tenantId
    && valor.fecha === apertura.fecha
    && valor.fechaHoraBogota === apertura.fechaHoraBogota
    && valor.referencia === apertura.referencia
    && valor.metadata.serie === 'radicados'
    && valor.metadata.anio === apertura.anio
    && valor.metadata.anterior === apertura.veniaDe
    && valor.metadata.primerNumero === apertura.primerNumero
    && valor.metadata.nuevoUltimo === apertura.ultimoInicial
    && valor.metadata.estado === 'BLOQUEADA';
}

function leerUltimoCounter(valor: unknown): number {
  if (!Number.isSafeInteger(valor) || (valor as number) < 0 || valor === Number.MAX_SAFE_INTEGER) {
    throw new AperturaSerieRadicadosError(
      409,
      'El contador actual es inválido. La serie permanece bloqueada hasta revisar su integridad.',
    );
  }
  return valor as number;
}

function anioDeIdRadicado(id: string): number | null {
  const coincidencia = id.match(/(?:^|-)(\d{4})(?:\d{2})?(?:-|$)/);
  return coincidencia ? Number(coincidencia[1]) : null;
}

function consecutivoDeDocumento(doc: QueryDocumentSnapshot<DocumentData>): number | null {
  const datos = doc.data();
  const control = esRegistro(datos.control) ? datos.control : undefined;
  const declarado = control?.consecutivo ?? datos.consecutivo;
  if (Number.isSafeInteger(declarado) && (declarado as number) >= 0) return declarado as number;
  const ultimoSegmento = doc.id.match(/(?:^|-)0*(\d+)$/)?.[1];
  if (!ultimoSegmento) return null;
  const numero = Number(ultimoSegmento);
  return Number.isSafeInteger(numero) ? numero : null;
}

function anioDeDocumento(doc: QueryDocumentSnapshot<DocumentData>): number | null {
  const datos = doc.data();
  const control = esRegistro(datos.control) ? datos.control : undefined;
  const fecha = control?.fechaRadicado;
  if (typeof fecha === 'string') {
    const parsed = new Date(fecha);
    if (Number.isFinite(parsed.getTime())) return periodoColombia(parsed).anio;
  }
  const radicadoId = typeof control?.radicadoId === 'string' ? control.radicadoId : doc.id;
  return anioDeIdRadicado(radicadoId);
}

function buscarColisionDesde(
  docs: QueryDocumentSnapshot<DocumentData>[],
  anio: number,
  primerNumero: number,
  etiqueta: 'documento' | 'reserva',
): string | null {
  for (const doc of docs) {
    const anioDoc = anioDeDocumento(doc);
    if (anioDoc !== anio) continue;
    const consecutivo = consecutivoDeDocumento(doc);
    if (consecutivo === null) {
      return `Existe ${etiqueta} del año ${anio} cuyo consecutivo no se puede verificar (${doc.id}).`;
    }
    if (consecutivo >= primerNumero) {
      return `Existe ${etiqueta} del año ${anio} con consecutivo ${consecutivo}, igual o posterior al primer número solicitado.`;
    }
  }
  return null;
}

function construirEstado(
  anio: number,
  ultimo: number,
  fecha: Date,
  apertura?: AperturaUnicaRadicados,
): EstadoAperturaRadicados {
  return {
    ok: true,
    anio,
    ultimo,
    proximoRadicado: formatearRadicadoInstitucional(ultimo + 1, fecha),
    openingAlreadyExists: Boolean(apertura),
    primerNumeroSugerido: apertura?.primerNumero
      ?? Math.max(PRIMER_NUMERO_CONTINGENCIA_SUGERIDO, ultimo + 1),
    ...(apertura ? { apertura } : {}),
  };
}

async function validarAuditoriaPersistida(
  db: Firestore,
  apertura: AperturaUnicaRadicados,
): Promise<void> {
  const snap = await db.doc(`admin_auditoria/${apertura.auditoriaId}`).get();
  if (!snap.exists || !auditoriaCoincideConApertura(snap.data(), apertura)) {
    throw new AperturaSerieRadicadosError(
      409,
      'La apertura existente no tiene una auditoría íntegra. La serie permanece bloqueada.',
    );
  }
}

/** Lectura administrativa. No modifica counters ni auditoría. */
export async function obtenerEstadoAperturaRadicados(
  db: Firestore,
  fecha = new Date(),
): Promise<EstadoAperturaRadicados> {
  const { anio } = periodoColombia(fecha);
  const snap = await db.doc(`counters/radicados-${anio}`).get();
  const ultimo = leerUltimoCounter(snap.exists ? snap.data()?.ultimo : 0);
  const valorApertura = snap.exists ? snap.data()?.apertura : undefined;
  if (valorApertura === undefined) return construirEstado(anio, ultimo, fecha);

  const apertura = leerAperturaUnicaRadicados(valorApertura, anio);
  if (!apertura || ultimo < apertura.ultimoInicial) {
    throw new AperturaSerieRadicadosError(
      409,
      'La apertura existente está incompleta o es incoherente. La serie permanece bloqueada.',
    );
  }
  await validarAuditoriaPersistida(db, apertura);
  return construirEstado(anio, ultimo, fecha, apertura);
}

export interface SolicitudAperturaUnicaRadicados {
  db: Firestore;
  primerNumero: number;
  actor: ActorAperturaSerie;
  fecha?: Date;
}

export interface ResultadoAperturaUnicaRadicados extends EstadoAperturaRadicados {
  idempotente: boolean;
}

async function validarAuditoriaEnTransaccion(
  tx: Transaction,
  db: Firestore,
  apertura: AperturaUnicaRadicados,
): Promise<void> {
  const snap = await tx.get(db.doc(`admin_auditoria/${apertura.auditoriaId}`));
  if (!snap.exists || !auditoriaCoincideConApertura(snap.data(), apertura)) {
    throw new AperturaSerieRadicadosError(
      409,
      'La apertura existente no tiene una auditoría íntegra. La serie permanece bloqueada.',
    );
  }
}

/**
 * Confirma la apertura una sola vez. Contador, bloqueo y auditoría se escriben
 * en una única transacción. No crea reserva ni documento de radicado: el
 * primer número solo se consume cuando una radicación real se confirma.
 */
export async function abrirSerieRadicadosUnaVez({
  db,
  primerNumero,
  actor,
  fecha = new Date(),
}: SolicitudAperturaUnicaRadicados): Promise<ResultadoAperturaUnicaRadicados> {
  if (!Number.isSafeInteger(primerNumero) || primerNumero <= 0) {
    throw new AperturaSerieRadicadosError(400, 'El primer número debe ser un entero seguro mayor que cero.');
  }
  if (actor.rol !== 'ADMIN') {
    throw new AperturaSerieRadicadosError(409, 'Solo un usuario ADMIN puede abrir la serie.');
  }

  const { anio } = periodoColombia(fecha);
  const fechaIso = fecha.toISOString();
  const fechaBogota = fechaHoraBogotaIso(fecha);
  const counterRef = db.doc(`counters/radicados-${anio}`);
  // El id se obtiene una sola vez, fuera del callback reintentable. Crear una
  // referencia no escribe; evita que un retry produzca identidades distintas.
  const auditoriaRef = db.collection('admin_auditoria').doc();

  return db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const ultimo = leerUltimoCounter(counterSnap.exists ? counterSnap.data()?.ultimo : 0);
    const valorApertura = counterSnap.exists ? counterSnap.data()?.apertura : undefined;

    if (valorApertura !== undefined) {
      const existente = leerAperturaUnicaRadicados(valorApertura, anio);
      if (!existente || ultimo < existente.ultimoInicial) {
        throw new AperturaSerieRadicadosError(
          409,
          'La apertura existente está incompleta o es incoherente. La serie permanece bloqueada.',
        );
      }
      await validarAuditoriaEnTransaccion(tx, db, existente);
      if (existente.primerNumero !== primerNumero) {
        throw new AperturaSerieRadicadosError(
          409,
          `La serie ya fue abierta y bloqueada en ${existente.primerNumero}; no puede reabrirse en ${primerNumero}.`,
        );
      }
      return { ...construirEstado(anio, ultimo, fecha, existente), idempotente: true };
    }

    if (primerNumero <= ultimo) {
      throw new AperturaSerieRadicadosError(
        409,
        `El primer número ${primerNumero} debe ser mayor que el contador vigente ${ultimo}.`,
      );
    }

    // Una apertura ocurre una sola vez y hoy el universo es pequeño. La
    // verificación dentro de la MISMA transacción también cubre registros
    // históricos con máscaras antiguas o campos incompletos: ante ambigüedad
    // se bloquea, nunca se supone que un número está libre. La proyección trae
    // solo los campos necesarios (el id siempre forma parte del snapshot) y el
    // techo impide convertir este acto único en una lectura O(N) silenciosa.
    const [radicadosSnap, reservasSnap] = await Promise.all([
      tx.get(
        db.collection('ventanilla_radicados')
          .select(...CAMPOS_CONTROL_APERTURA)
          .limit(TECHO_LECTURA_APERTURA),
      ),
      tx.get(
        db.collection('unicidad_radicados')
          .select(...CAMPOS_CONTROL_APERTURA)
          .limit(TECHO_LECTURA_APERTURA),
      ),
    ]);
    if (
      radicadosSnap.size === TECHO_LECTURA_APERTURA
      || reservasSnap.size === TECHO_LECTURA_APERTURA
    ) {
      throw new AperturaSerieRadicadosError(
        409,
        'La verificación histórica alcanzó su techo de lectura y no puede demostrar que la serie esté libre. '
          + 'La serie permanece bloqueada hasta revisar el histórico.',
      );
    }
    const colisionDocumento = buscarColisionDesde(
      radicadosSnap.docs,
      anio,
      primerNumero,
      'documento',
    );
    const colisionReserva = buscarColisionDesde(
      reservasSnap.docs,
      anio,
      primerNumero,
      'reserva',
    );
    const colision = colisionDocumento ?? colisionReserva;
    if (colision) {
      throw new AperturaSerieRadicadosError(409, `${colision} La serie no fue abierta.`);
    }

    const apertura: AperturaUnicaRadicados = {
      version: 1,
      estado: 'BLOQUEADA',
      serie: 'radicados',
      anio,
      veniaDe: ultimo,
      abiertoEn: primerNumero,
      primerNumero,
      ultimoInicial: primerNumero - 1,
      fecha: fechaIso,
      fechaHoraBogota: fechaBogota,
      autorizadoPor: AUTORIZADO_POR_APERTURA_CONTINGENCIA,
      referencia: REFERENCIA_APERTURA_CONTINGENCIA,
      auditoriaId: auditoriaRef.id,
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      actorRol: actor.rol,
      tenantId: actor.tenantId,
    };
    const proximoRadicado = formatearRadicadoInstitucional(primerNumero, fecha);
    const auditoria: AuditoriaAperturaUnicaRadicados = {
      accion: 'APERTURA_SERIE_RADICADOS_CONFIRMADA',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      actorRol: actor.rol,
      tenantId: actor.tenantId,
      fecha: fechaIso,
      fechaHoraBogota: fechaBogota,
      referencia: REFERENCIA_APERTURA_CONTINGENCIA,
      metadata: {
        serie: 'radicados',
        anio,
        anterior: ultimo,
        primerNumero,
        nuevoUltimo: primerNumero - 1,
        estado: 'BLOQUEADA',
        proximoRadicado,
      },
    };

    tx.set(counterRef, {
      ultimo: primerNumero - 1,
      anio,
      actualizadoEn: fechaIso,
      apertura,
    }, { merge: true });
    tx.create(auditoriaRef, auditoria);

    return {
      ...construirEstado(anio, primerNumero - 1, fecha, apertura),
      idempotente: false,
    };
  });
}
