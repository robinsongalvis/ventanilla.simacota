import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { sanitizeFirestoreData } from '@/lib/firestore/removeUndefined';
import { sanitizeFilename } from '@/lib/server/radicados-security';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import {
  tiposPermitidosMagicBytes,
  verificarMagicBytes,
} from '@/lib/seguridad/magic-bytes';
import { validarReglasRadicacion } from '@/lib/seguridad/reglas-radicacion';
import {
  calcularFechaVencimiento,
  TIPOS_SOLICITUD,
  type TipoSolicitudId,
} from '@/lib/tiempos-radicado';
import { TIPOS_SOLICITUD_INTERNOS_IDS } from '@/lib/catalogos/tipos-solicitud';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import {
  construirClasificacionInicial,
  construirNotaRadicacion,
} from '@/lib/recepcion/clasificacion-inicial';
import { construirVentanillaRadicado } from '@/lib/recepcion/construir-radicado';
import {
  CAMPOS_RADICACION_INTERNA,
  type RespuestaRadicacionInternaError,
  type RespuestaRadicacionInternaOk,
} from '@/lib/recepcion/contrato-radicacion-interna';
import {
  confirmarConsecutivosLegales,
  leerConsecutivosLegales,
} from '@/lib/server/consecutivo-legal';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { logError } from '@/lib/logger';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';
import type { Prioridad, TenantId, TipoPresentacionPqrsd } from '@/src/types/radicado';
import type {
  ArchivoRadicado,
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

/* ══════════════════════════════════════════════════════════════
   POST /api/radicacion/interna

   Pieza angular (P2.1) — Fase 2. Ver:
     - docs/CRONOGRAMA_PIEZA_ANGULAR.md (§FASE 2 — criterios de éxito)
     - docs/blueprints/CN-pieza-angular-radicacion-interna.md (§M2)

   Mueve la radicación INTERNA (hoy client-side en
   `lib/actions/radicarVentanilla.ts`) a servidor (Admin SDK), clon
   estructural de `app/api/salidas/registrar/route.ts` y hermano de
   `app/api/radicacion/route.ts` (superficie pública): mismo patrón
   staging → transacción → finalize + helper canónico
   `consecutivo-legal`, con DOS mejoras exigidas por el blueprint para
   ESTA ruta:
     1. `tx.create` (no `tx.set`) para el documento del radicado:
        fail-closed ante id colisionante — nunca sobrescribe en
        silencio un radicado legal ya existente.
     2. La trazabilidad (`RADICACION` y, si aplica,
        `DATOS_NO_APORTADOS_MARCADOS`) se escribe con `tx.set` e id
        DETERMINÍSTICO **dentro** de la misma transacción — no
        `addDoc`/`.add()` post-commit. Si la tx aborta, NI el radicado
        NI el evento de trazabilidad quedan parciales (el invariante
        nuevo que esta pieza reclama cerrar).

   Kill-switch (Fase 2, OFF por defecto — ver
   `lib/recepcion/radicacion-interna-flag.ts`): esta ruta EXISTE pero el
   cliente todavía NO la llama. La producción no cambia de
   comportamiento hasta que dev-frontend conmute el caller en la Fase 3.

   Autorización: gate de rol EXPLÍCITO (no basta
   `requireActiveInternalUser`, que admite FUNCIONARIO/JEFE_DEPENDENCIA/
   CONTROL_INTERNO) — solo ADMIN o RECEPCIONISTA pueden radicar,
   replicando la regla `firestore.rules:143` (ver §Reimplementación de
   autorización del blueprint).

   Validación estricta de entrada: el body NUNCA aporta campos de
   ESTADO (estadoActual, consecutivo, radicadoId, esAnonimo,
   identidadReservada, tenantId, control.*, cumplioTermino…) — ninguno
   de esos nombres se lee de `formData` en este archivo; todos se
   DERIVAN server-side (ver `__tests__/radicacion-interna-anti-forja.test.ts`,
   que envía esos campos con valores hostiles y confirma que el doc final
   solo contiene los valores derivados). `tipoPresentacion` SÍ es entrada
   legítima (whitelist enum); de ella el constructor puro deriva
   `esAnonimo`/`identidadReservada`. `oficinaDestino` también es entrada
   legítima pero **acotada al catálogo institucional**
   (`DIRECTORIO_TENANTS`) — enruta, no autoriza.

   Sanitización: política **null explícito** (`sanitizeFirestoreData`),
   decisión del propietario para este endpoint NUEVO — ver golden
   `__tests__/fase2-golden-radicacion-interna-servidor.test.ts`.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(tiposPermitidosMagicBytes());
const CANALES_RESPUESTA = new Set<CanalRespuesta>([
  'CORREO',
  'PRESENCIAL',
  'TELEFONO',
  'DIRECCION_FISICA',
]);
const TIPOS_PRESENTACION = new Set<TipoPresentacionPqrsd>(['IDENTIFICADA', 'ANONIMA', 'RESERVADA']);
const TIPOS_PERSONA = new Set<TipoPersona>([
  'NATURAL',
  'JURIDICA',
  'ENTIDAD_PUBLICA',
  'COMUNICACION_INSTITUCIONAL',
  'NO_IDENTIFICADO',
]);
const TIPOS_DOCUMENTO = new Set<TipoDocumento>(['CC', 'CE', 'NIT', 'PASAPORTE', 'OTRO']);
const MEDIOS_RECEPCION = new Set<MedioRecepcion>([
  'OFICIO_FISICO',
  'EMAIL',
  'WEB',
  'PRESENCIAL',
  'VERBAL_PRESENCIAL',
  'VERBAL_TELEFONICO',
]);
const ORIGENES_INGRESO = new Set<OrigenIngreso>([
  'PQRSD_WEB_OFICIAL',
  'CORREO_INSTITUCIONAL',
  'VENTANILLA_FISICA',
  'ENTREGA_PRESENCIAL',
  'OFICIO_EXTERNO',
  'COMUNICACION_INSTITUCIONAL',
  'OTRO',
]);
const TIPOS_ENTRADA = new Set<TipoEntrada>([
  'PQRSD',
  'CORRESPONDENCIA_RECIBIDA',
  'OFICIO_INSTITUCIONAL',
  'SOLICITUD_CIUDADANA',
  'COMUNICACION_ENTIDAD_PUBLICA',
  'COMUNICACION_INTERNA',
  'OTRO',
]);
// Superset de la pública (TIPOS_PQRSD_CIUDADANO): recepción puede radicar
// cualquier tipo con `visibleInterno` (incluye los internos-only), no solo
// los que ve el ciudadano — verificado contra el catálogo (23/23 entradas
// tienen visibleInterno: true; visibleCiudadano es el subconjunto de 10).
const TIPOS_SOLICITUD_INTERNOS = new Set<string>(TIPOS_SOLICITUD_INTERNOS_IDS);
const TENANT_DEFAULT: TenantId = 'VENTANILLA_UNICA';

/** Rol único (recepción), volumen bajo — decisión de partida (Principio 13,
 *  sin métrica previa de radicación interna concurrente); ajustar con
 *  evidencia operativa. Clave por `uid` de sesión (no IP/XFF, ver hallazgo
 *  de memoria dev-backend sobre bypass de rate-limit por X-Forwarded-For). */
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

function badRequest(
  error: string,
  errores: string[] = [error],
): NextResponse<RespuestaRadicacionInternaError> {
  return NextResponse.json({ error, errores }, { status: 400 });
}

function campo(formData: FormData, nombre: string): string {
  const valor = formData.get(nombre);
  return typeof valor === 'string' ? valor.trim() : '';
}

function isTipoSolicitud(value: string): value is TipoSolicitudId {
  return TIPOS_SOLICITUD_INTERNOS.has(value);
}

function isTipoPresentacion(value: string): value is TipoPresentacionPqrsd {
  return TIPOS_PRESENTACION.has(value as TipoPresentacionPqrsd);
}

function isCanalRespuesta(value: string): value is CanalRespuesta {
  return CANALES_RESPUESTA.has(value as CanalRespuesta);
}

function isTipoPersona(value: string): value is TipoPersona {
  return TIPOS_PERSONA.has(value as TipoPersona);
}

function isTipoDocumento(value: string): value is TipoDocumento {
  return TIPOS_DOCUMENTO.has(value as TipoDocumento);
}

function isMedioRecepcion(value: string): value is MedioRecepcion {
  return MEDIOS_RECEPCION.has(value as MedioRecepcion);
}

function isOrigenIngreso(value: string): value is OrigenIngreso {
  return ORIGENES_INGRESO.has(value as OrigenIngreso);
}

function isTipoEntrada(value: string): value is TipoEntrada {
  return TIPOS_ENTRADA.has(value as TipoEntrada);
}

function isOficinaDestino(value: string): value is TenantId {
  return value in DIRECTORIO_TENANTS;
}

function validarArchivos(files: File[]): string[] {
  const errores: string[] = [];

  if (files.length > MAX_FILES) {
    errores.push(`Solo se permiten hasta ${MAX_FILES} archivos adjuntos.`);
  }

  files.forEach((file) => {
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      errores.push(`El archivo ${file.name} debe ser PDF, JPG, PNG, WEBP, DOCX, XLSX o PPTX.`);
    }
    if (file.size > MAX_FILE_SIZE) {
      errores.push(`El archivo ${file.name} supera el tamaño máximo de 5 MB.`);
    }
  });

  return errores;
}

function bucketStorage() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('FIREBASE_STORAGE_BUCKET no configurado.');
  }
  return getFirebaseAdminStorage().bucket(bucketName);
}

/** H3: sube a un directorio de STAGING, antes de consumir el consecutivo —
 *  un fallo aquí no crea radicado ni gasta número (idéntico a
 *  `api/radicacion/route.ts` y `api/salidas/registrar/route.ts`). */
async function guardarEnStorage(file: File, path: string): Promise<void> {
  const buffer = Buffer.from(await file.arrayBuffer());
  await bucketStorage().file(path).save(buffer, {
    resumable: false,
    metadata: { contentType: file.type || 'application/octet-stream' },
  });
}

/** H3: mueve de staging a la ruta final tras confirmar la transacción.
 *  Storage no es transaccional con Firestore (N8, deuda declarada): un
 *  fallo aquí deja el radicado válido y el adjunto pendiente. */
async function moverEnStorage(origen: string, destino: string): Promise<void> {
  await bucketStorage().file(origen).move(destino);
}

function algunNoAportado(d: DatosNoAportados): boolean {
  return Boolean(d.documento || d.telefono || d.correo || d.direccion);
}

function jsonAuthError(error: InternalAuthError): NextResponse<RespuestaRadicacionInternaError> {
  return NextResponse.json({ error: error.message }, { status: error.status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const inicioOperacion = Date.now();
  let radicadoIdActual: string | null = null;
  let tenantActual: string = TENANT_DEFAULT;
  let rolActual = 'DESCONOCIDO';

  try {
    // ── Autorización ──
    // requireActiveInternalUser() NO basta: admite FUNCIONARIO/
    // JEFE_DEPENDENCIA/CONTROL_INTERNO además de ADMIN/RECEPCIONISTA.
    // El gate de rol EXPLÍCITO replica la regla que hoy protege el
    // `create` de ventanilla_radicados (firestore.rules:143) — sin él,
    // un FUNCIONARIO podría radicar internamente (regresión de authz).
    const usuario = await requireActiveInternalUser();
    rolActual = usuario.rol;
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA') {
      return NextResponse.json({ error: 'Su rol no puede radicar.' }, { status: 403 });
    }

    const limited = checkRateLimit(`radicacion-interna:${usuario.uid}`, RATE_LIMIT);
    if (limited) {
      return NextResponse.json(
        { error: 'Has realizado varias solicitudes en poco tiempo. Espera un momento e intenta nuevamente.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(limited.retryAfterSeconds),
            'X-RateLimit-Limit': String(RATE_LIMIT.maxRequests),
          },
        },
      );
    }

    // ── Lectura + validación estricta del body ──
    // Deliberadamente NO se lee del body ningún campo de ESTADO:
    // estadoActual, cumplioTermino, consecutivo, radicadoId, control.*,
    // prorrogasAplicadas, fechaVencimiento, tenantId, esAnonimo,
    // identidadReservada. Todos se derivan server-side. `tipoPresentacion`
    // SÍ es entrada legítima (recepción elige ANONIMA/RESERVADA).
    const formData = await request.formData();

    const tipoSolicitudIdRaw = campo(formData, CAMPOS_RADICACION_INTERNA.tipoSolicitudId);
    if (!isTipoSolicitud(tipoSolicitudIdRaw)) {
      return badRequest('Tipo de solicitud no válido.');
    }

    const tipoPresentacionRaw = campo(formData, CAMPOS_RADICACION_INTERNA.tipoPresentacion) || 'IDENTIFICADA';
    if (!isTipoPresentacion(tipoPresentacionRaw)) {
      return badRequest('Tipo de presentación no válido.');
    }

    const canalRespuestaRaw = campo(formData, CAMPOS_RADICACION_INTERNA.canalRespuesta);
    if (canalRespuestaRaw && !isCanalRespuesta(canalRespuestaRaw)) {
      return badRequest('Canal de respuesta no válido.');
    }

    const tipoPersonaRaw = campo(formData, CAMPOS_RADICACION_INTERNA.tipoPersona);
    if (!isTipoPersona(tipoPersonaRaw)) {
      return badRequest('Tipo de persona no válido.');
    }

    const tipoDocumentoRaw = campo(formData, CAMPOS_RADICACION_INTERNA.tipoDocumento);
    if (!isTipoDocumento(tipoDocumentoRaw)) {
      return badRequest('Tipo de documento no válido.');
    }

    const medioRecepcionRaw = campo(formData, CAMPOS_RADICACION_INTERNA.medioRecepcion);
    if (!isMedioRecepcion(medioRecepcionRaw)) {
      return badRequest('Medio de recepción no válido.');
    }

    const origenIngresoRaw = campo(formData, CAMPOS_RADICACION_INTERNA.origenIngreso);
    if (origenIngresoRaw && !isOrigenIngreso(origenIngresoRaw)) {
      return badRequest('Origen de ingreso no válido.');
    }

    const tipoEntradaRaw = campo(formData, CAMPOS_RADICACION_INTERNA.tipoEntrada);
    if (tipoEntradaRaw && !isTipoEntrada(tipoEntradaRaw)) {
      return badRequest('Tipo de entrada no válido.');
    }

    const oficinaDestinoRaw = campo(formData, CAMPOS_RADICACION_INTERNA.oficinaDestino);
    if (oficinaDestinoRaw && !isOficinaDestino(oficinaDestinoRaw)) {
      return badRequest('La dependencia destino no existe en el catálogo institucional.');
    }
    const oficinaDestino: TenantId = oficinaDestinoRaw
      ? (oficinaDestinoRaw as TenantId)
      : TENANT_DEFAULT;
    tenantActual = oficinaDestino;

    const nombreCompleto = campo(formData, CAMPOS_RADICACION_INTERNA.nombreCompleto);
    const numeroDocumento = campo(formData, CAMPOS_RADICACION_INTERNA.numeroDocumento);
    const email = campo(formData, CAMPOS_RADICACION_INTERNA.email).toLowerCase();
    const telefono = campo(formData, CAMPOS_RADICACION_INTERNA.telefono).replace(/\s/g, '');
    const telefonoMovil = campo(formData, CAMPOS_RADICACION_INTERNA.telefonoMovil).replace(/\s/g, '');
    const telefonoFijo = campo(formData, CAMPOS_RADICACION_INTERNA.telefonoFijo).replace(/\s/g, '');
    const direccion = campo(formData, CAMPOS_RADICACION_INTERNA.direccion);
    const pais = campo(formData, CAMPOS_RADICACION_INTERNA.pais) || 'Colombia';
    const departamento = campo(formData, CAMPOS_RADICACION_INTERNA.departamento) || 'Santander';
    const municipio = campo(formData, CAMPOS_RADICACION_INTERNA.municipio) || 'Simacota';
    const barrio = campo(formData, CAMPOS_RADICACION_INTERNA.barrio);
    const asunto = campo(formData, CAMPOS_RADICACION_INTERNA.asunto);
    const descripcion = campo(formData, CAMPOS_RADICACION_INTERNA.descripcion);
    const numeroFolios = Number(campo(formData, CAMPOS_RADICACION_INTERNA.numeroFolios)) || 0;
    const numeroAnexos = Number(campo(formData, CAMPOS_RADICACION_INTERNA.numeroAnexos)) || 0;
    const anexosDescripcion = campo(formData, CAMPOS_RADICACION_INTERNA.anexosDescripcion);
    const observacionesAnexos = campo(formData, CAMPOS_RADICACION_INTERNA.observacionesAnexos);
    const areaResponsable = campo(formData, CAMPOS_RADICACION_INTERNA.areaResponsable);
    const noAportaDocumento = campo(formData, CAMPOS_RADICACION_INTERNA.noAportaDocumento) === 'true';
    const noAportaCorreo = campo(formData, CAMPOS_RADICACION_INTERNA.noAportaCorreo) === 'true';
    const noAportaTelefono = campo(formData, CAMPOS_RADICACION_INTERNA.noAportaTelefono) === 'true';
    const noAportaDireccion = campo(formData, CAMPOS_RADICACION_INTERNA.noAportaDireccion) === 'true';
    const files = formData.getAll(CAMPOS_RADICACION_INTERNA.archivos).filter((v): v is File => v instanceof File && v.size > 0);

    const esAnonimo = tipoPresentacionRaw === 'ANONIMA';

    const errorReglas = validarReglasRadicacion({
      noAportaCorreo,
      canalRespuesta: canalRespuestaRaw ? (canalRespuestaRaw as CanalRespuesta) : undefined,
    });

    const errores: string[] = [];
    if (!esAnonimo && nombreCompleto.length < 3) {
      errores.push('Registra el nombre completo del solicitante.');
    }
    if (!esAnonimo && numeroDocumento.length === 0 && !noAportaDocumento) {
      errores.push('Registra el número de documento del solicitante o marca que no lo aportó.');
    }
    if (asunto.length === 0) {
      errores.push('El asunto es obligatorio.');
    }
    if (descripcion.length === 0) {
      errores.push('La descripción es obligatoria.');
    }
    if (canalRespuestaRaw === 'CORREO' && !email) {
      errores.push('El correo electrónico es obligatorio para recibir respuesta por correo.');
    }
    if (canalRespuestaRaw === 'CORREO' && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errores.push('El correo electrónico no tiene un formato válido.');
    }
    if (canalRespuestaRaw === 'TELEFONO' && !telefono && !telefonoMovil && !telefonoFijo) {
      errores.push('El teléfono es obligatorio cuando el canal de respuesta es telefónico.');
    }
    if (canalRespuestaRaw === 'DIRECCION_FISICA' && !direccion) {
      errores.push('La dirección física es obligatoria para notificación por correspondencia.');
    }
    if (errorReglas) errores.push(errorReglas);
    errores.push(...validarArchivos(files));

    if (errores.length > 0) {
      return badRequest('La solicitud tiene datos pendientes por corregir.', errores);
    }

    // H-08: firma binaria real — el Content-Type y la extensión son
    // falsificables por el cliente.
    const erroresMagicBytes: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!verificarMagicBytes(buffer, file.type)) {
        erroresMagicBytes.push(`El archivo ${file.name} no tiene una firma válida para su tipo declarado.`);
      }
    }
    if (erroresMagicBytes.length > 0) {
      return badRequest('La solicitud tiene datos pendientes por corregir.', erroresMagicBytes);
    }

    // ── Derivación server-side (nunca del body) ──
    const ahora = new Date();
    const tipoSolicitud = TIPOS_SOLICITUD[tipoSolicitudIdRaw];
    const termino = calcularFechaVencimiento(ahora, tipoSolicitudIdRaw);
    const datosNoAportados: DatosNoAportados = {
      documento: noAportaDocumento,
      telefono: noAportaTelefono,
      correo: noAportaCorreo,
      direccion: noAportaDireccion,
    };
    const hayNoAportados = algunNoAportado(datosNoAportados);
    const origen = medioRecepcionRaw === 'WEB' ? 'WEB' : 'FISICO_ESCANER';
    // Condición del arquitecto (PdC 1): timeZone explícita — Vercel corre en
    // UTC; el cliente legado corría en el navegador, ya en hora de Bogotá.
    const horaRadicado = ahora.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });

    // H3 (Bloque 2): staging → transacción → finalize.
    // 1) Adjuntos a STAGING antes de consumir el consecutivo: un fallo de
    //    subida no crea radicado ni gasta número.
    const db = getFirebaseAdminDb();
    const requestId = randomUUID();
    const preparados = files.map((file, index) => ({
      file,
      orden: index + 1,
      filename: `${Date.now()}_${index + 1}_${sanitizeFilename(file.name)}`,
      tipo: file.type || 'application/octet-stream',
      tamanioKB: Math.max(1, Math.round(file.size / 1024)),
    }));
    await Promise.all(preparados.map((p) =>
      guardarEnStorage(p.file, `radicados/_pendientes/${requestId}/${p.filename}`),
    ));

    // 2) Consecutivo + documento + trazabilidad en UNA transacción (atómico).
    //    Dentro del callback SOLO cómputo puro y tx.*: ningún I/O de Storage.
    const { radicadoId, consecutivo, archivos } = await db.runTransaction(async (tx) => {
      // Se conserva el ARREGLO devuelto por leer (misma referencia que exige
      // confirmarConsecutivosLegales por identidad) — pasar uno nuevo hace
      // fallar la transacción con 500 (P0 ya vivido en api/radicacion y
      // salidas/registrar).
      const pendientesRadicado = await leerConsecutivosLegales(tx, db, ahora, [
        { serie: 'radicados', formatear: formatearRadicadoInstitucional },
      ]);
      const [consecRadicado] = pendientesRadicado;
      const radicadoId = consecRadicado.documentoId;
      const consecutivo = consecRadicado.consecutivo;
      const archivos: ArchivoRadicado[] = preparados.map((p) => ({
        nombre: p.file.name,
        url: '',
        path: `radicados/${radicadoId}/${p.filename}`,
        tipo: p.tipo,
        tamanioKB: p.tamanioKB,
        orden: p.orden,
      }));

      const radicado: VentanillaRadicado = sanitizeFirestoreData(
        construirVentanillaRadicado({
          radicadoId,
          consecutivo,
          ahora,
          prioridad: tipoSolicitud.prioridadSugerida as Prioridad,
          tipoPresentacion: tipoPresentacionRaw,
          canalRespuesta: canalRespuestaRaw ? (canalRespuestaRaw as CanalRespuesta) : null,
          solicitante: {
            tipoPersona: tipoPersonaRaw,
            tipoDocumento: tipoDocumentoRaw,
            numeroDocumento: numeroDocumento || '',
            nombreCompleto: nombreCompleto || (esAnonimo ? 'Ciudadano anonimo' : ''),
            email: email || null,
            telefono: telefono || null,
            telefonoMovil: telefonoMovil || null,
            telefonoFijo: telefonoFijo || null,
            direccion: direccion || null,
            ubicacion: {
              pais,
              departamento,
              municipio,
              barrio: barrio || null,
            },
            datosNoAportados: hayNoAportados ? datosNoAportados : undefined,
          },
          control: {
            medioRecepcion: medioRecepcionRaw,
            origen,
            horaRadicado,
            origenIngreso: origenIngresoRaw ? (origenIngresoRaw as OrigenIngreso) : 'PQRSD_WEB_OFICIAL',
            tipoEntrada: tipoEntradaRaw ? (tipoEntradaRaw as TipoEntrada) : 'PQRSD',
          },
          termino: {
            tipoSolicitudId: tipoSolicitudIdRaw,
            tipoSolicitudNombre: tipoSolicitud.nombre,
            diasRespuesta: termino.diasRespuesta,
            unidad: termino.unidad,
            fechaVencimiento: termino.fechaVencimiento,
          },
          clasificacionBase: construirClasificacionInicial(oficinaDestino, usuario.uid),
          areaResponsable: areaResponsable || undefined,
          detalle: {
            asunto,
            descripcion,
            numeroFolios,
            anexosDescripcion: anexosDescripcion || null,
            numeroAnexos,
            observacionesAnexos: observacionesAnexos || null,
          },
          archivos,
        }) as unknown as Record<string, unknown>,
      ) as unknown as VentanillaRadicado;

      const eventoRadicacion: TrazabilidadRadicado = {
        eventoId: `ev_${radicadoId}_RADICACION`,
        fecha: ahora.toISOString(),
        accion: 'RADICACION',
        actorUid: usuario.uid,
        actorNombre: usuario.nombre,
        oficinaDestino,
        nota: construirNotaRadicacion(usuario.nombre, medioRecepcionRaw, oficinaDestino),
      };

      confirmarConsecutivosLegales(tx, ahora, pendientesRadicado);

      // Documento del radicado: `tx.create` — fail-closed ante id
      // colisionante (jamás sobrescribe en silencio un radicado legal ya
      // existente). Trazabilidad: `tx.set` con id DETERMINÍSTICO, DENTRO
      // de la misma tx (idempotente ante reintento de la transacción; si
      // esta tx aborta, ni el radicado ni el evento quedan parciales).
      tx.create(db.doc(`ventanilla_radicados/${radicadoId}`), radicado);
      tx.set(
        db.doc(`ventanilla_radicados/${radicadoId}/trazabilidad/ev_${radicadoId}_RADICACION`),
        sanitizeFirestoreData(eventoRadicacion as unknown as Record<string, unknown>),
      );

      if (hayNoAportados) {
        const eventoNoAportados: TrazabilidadRadicado = {
          eventoId: `ev_${radicadoId}_DATOS_NO_APORTADOS`,
          fecha: ahora.toISOString(),
          accion: 'DATOS_NO_APORTADOS_MARCADOS',
          actorUid: usuario.uid,
          actorNombre: usuario.nombre,
          oficinaDestino,
          nota: `El solicitante no aportó: ${[
            datosNoAportados.documento && 'documento',
            datosNoAportados.correo && 'correo',
            datosNoAportados.telefono && 'teléfono',
            datosNoAportados.direccion && 'dirección',
          ].filter(Boolean).join(', ')}.`,
          metadata: {
            documento: datosNoAportados.documento === true,
            correo: datosNoAportados.correo === true,
            telefono: datosNoAportados.telefono === true,
            direccion: datosNoAportados.direccion === true,
          },
        };
        tx.set(
          db.doc(`ventanilla_radicados/${radicadoId}/trazabilidad/ev_${radicadoId}_DATOS_NO_APORTADOS`),
          sanitizeFirestoreData(eventoNoAportados as unknown as Record<string, unknown>),
        );
      }

      return { radicadoId, consecutivo, archivos };
    });
    radicadoIdActual = radicadoId;

    // 3) Finalize: mover adjuntos de staging a su ruta final (post-commit;
    //    el radicado ya es válido — un fallo de move NO crea fantasma; N8
    //    lo concilia luego, deuda declarada).
    await Promise.all(preparados.map((p) =>
      moverEnStorage(
        `radicados/_pendientes/${requestId}/${p.filename}`,
        `radicados/${radicadoId}/${p.filename}`,
      ).catch((error) => logError({ radicadoId, modulo: 'radicacion-interna/finalize-adjunto', error })),
    ));

    registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'ok',
      latenciaMs: Date.now() - inicioOperacion,
      radicadoId,
      actorRol: usuario.rol,
      tenant: oficinaDestino,
    });

    const respuestaOk: RespuestaRadicacionInternaOk = {
      ok: true,
      radicadoId,
      consecutivo,
      archivosSubidos: archivos.length,
    };
    return NextResponse.json(respuestaOk);
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return jsonAuthError(error);
    }
    registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'error',
      latenciaMs: Date.now() - inicioOperacion,
      radicadoId: radicadoIdActual,
      actorRol: rolActual,
      tenant: tenantActual,
      error,
    });
    logError({ radicadoId: radicadoIdActual ?? '', modulo: 'radicacion-interna', error });
    return NextResponse.json(
      { error: 'No fue posible radicar la solicitud. Intenta nuevamente o comunícate con soporte.' },
      { status: 500 },
    );
  }
}
