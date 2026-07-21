/**
 * scripts/laboratorio/alcaldia-sintetica.ts
 *
 * ALCALDÍA SINTÉTICA — generador masivo de datos coherentes para STAGE
 * (Fase 2 del Laboratorio Institucional de Calidad, ADR-0002).
 *
 * Crea ~30 radicados ficticios que nacen POR EL CAMINO REAL:
 *   1. POST /api/radicacion            → radicación pública (counter + trazabilidad)
 *   2. POST /api/auth/session          → sesión de funcionarios de laboratorio
 *   3. POST /api/radicados/:id/asignar → asignación/traslado real
 *   4. POST /api/radicados/:id/prorroga→ prórroga real
 *   5. POST /api/radicados/:id/resolver→ resolución real (cumplioTermino lo
 *      calcula el endpoint, nunca este script)
 *
 * La única escritura directa con Admin SDK es:
 *   - marcar `isTest: true` + metadata `laboratorio` (precedente:
 *     scripts/marcar-datos-prueba.ts), y
 *   - la RETRODATACIÓN de escenarios históricos (vencidos / al borde):
 *     se mueve control.fechaRadicado al pasado y se recalcula
 *     termino.fechaVencimiento con calcularFechaVencimiento() — la MISMA
 *     función que usa /api/radicacion — de modo que la coherencia de días
 *     hábiles colombianos es por construcción, no por copia.
 *
 * GUARDA ANTI-PRODUCCIÓN (ADR-0002): aborta si el service account apunta a
 * `ventanilla-unica-f31b1`. Además, antes de crear NADA, valida que el
 * servidor de localhost acepte una sesión de un usuario de laboratorio
 * (los usuarios .lab solo existen en stage → si el servidor estuviera
 * conectado a otro proyecto, /api/auth/session devolvería 401 y se aborta
 * sin haber escrito un solo documento).
 *
 * Determinismo: el "generador" es un roster ESTÁTICO de 30 escenarios
 * (la forma más fuerte de semilla fija). Sobre base limpia produce
 * siempre los mismos ciudadanos, tipos, destinos y consecutivos
 * (2..31, porque el radicado de auditoría 00000001 se preserva).
 * Las fechas se anclan al día de la corrida para que los estados
 * derivados (POR_VENCER / VENCIDO) sean reales en el panel.
 *
 * Uso:
 *   npx tsx scripts/laboratorio/alcaldia-sintetica.ts                 # siembra (aborta si ya hay datos de prueba)
 *   npx tsx scripts/laboratorio/alcaldia-sintetica.ts --limpiar       # borra SOLO isTest:true y vuelve a sembrar
 *   npx tsx scripts/laboratorio/alcaldia-sintetica.ts --solo-limpiar  # borra SOLO isTest:true y termina
 *
 * Requiere: .env.stage (FIREBASE_SERVICE_ACCOUNT + NEXT_PUBLIC_FIREBASE_API_KEY
 * + LAB_PASSWORD) y el servidor `npm run dev:stage` corriendo (LAB_BASE_URL,
 * por defecto http://localhost:3000).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Reutilización de la lógica real del dominio (prohibido duplicarla) ──
import {
  calcularFechaVencimiento,
  diasRestantesHabiles,
  type TipoSolicitudId,
} from '../../lib/tiempos-radicado';
import { formatearRadicadoInstitucional } from '../../lib/radicado-institucional';
import { areasParaDependencia } from '../../lib/catalogos/areas';
import type { CanalRespuesta, TenantId, TipoPresentacionPqrsd } from '../../src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   Configuración (parametrizable: hoy solo Simacota stage)
══════════════════════════════════════════════════════════════ */

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const RADICADO_PROTEGIDO = '1-110-2026-00000001'; // auditoría real de stage: intocable
const BASE_URL = process.env.LAB_BASE_URL ?? 'http://localhost:3000';
const ENV_STAGE = resolve('.env.stage');
const GENERADOR = 'alcaldia-sintetica';
const VERSION_GENERADOR = '1.0.0';

/** Correo institucional placeholder: bloqueado por debeNotificarCiudadano →
 *  nunca dispara SMTP ni alertas. */
const EMAIL_PLACEHOLDER = 'sin-correo@simacota.gov.co';

/* ══════════════════════════════════════════════════════════════
   Roster de escenarios (semilla estática del generador)
══════════════════════════════════════════════════════════════ */

interface CiudadanoFicticio {
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
}

interface Escenario {
  n: number;
  tipoSolicitudId: TipoSolicitudId;
  presentacion: TipoPresentacionPqrsd;
  canalRespuesta: CanalRespuesta;
  ciudadano?: CiudadanoFicticio; // ausente en ANONIMA
  descripcion: string;
  /** Retrodatación: días calendario fijos, u objetivo de días hábiles
   *  restantes al vencimiento (negativo = ya vencido). */
  retro?: { dias: number } | { objetivoHabiles: number };
  asignar?: { destino: TenantId; conArea?: boolean; conResponsable?: boolean };
  prorroga?: { dias: number; motivo: string };
  resolver?: { nota: string };
}

const ESCENARIOS: Escenario[] = [
  // ── PENDIENTES recientes (6) ──────────────────────────────────
  {
    n: 1, tipoSolicitudId: 'PETICION_GENERAL', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'María Alejandra Rueda Pico', email: 'maria.rueda.lab@example.com', telefono: '3000000001', direccion: 'Calle 4 # 3-21, barrio El Centro' },
    descripcion: 'Solicito el arreglo de las luminarias del parque principal y la calle 4 del barrio El Centro, llevan más de un mes apagadas y el sector queda completamente oscuro.',
  },
  {
    n: 2, tipoSolicitudId: 'PETICION_INFORMACION', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'José Delio Ardila Camacho', email: EMAIL_PLACEHOLDER, telefono: '3000000002' },
    descripcion: 'Solicito información sobre los requisitos y fechas de la convocatoria de mejoramiento de vivienda rural anunciada por la Alcaldía para las veredas del sector bajo.',
  },
  {
    n: 3, tipoSolicitudId: 'QUEJA', presentacion: 'ANONIMA', canalRespuesta: 'PRESENCIAL',
    descripcion: 'Presento queja por la atención despectiva recibida en una oficina de la Alcaldía el pasado viernes en la mañana; se atendió primero a personas que llegaron después.',
  },
  {
    n: 4, tipoSolicitudId: 'SUGERENCIA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Luz Marina Quiroga de Silva', email: EMAIL_PLACEHOLDER, telefono: '3000000004' },
    descripcion: 'Sugiero programar jornadas de atención descentralizada en el corregimiento del Bajo Simacota, muchos habitantes no pueden desplazarse hasta la cabecera municipal.',
  },
  {
    n: 5, tipoSolicitudId: 'FELICITACION', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Pedro Antonio Gualdrón Meza', email: EMAIL_PLACEHOLDER },
    descripcion: 'Felicito al equipo de la brigada de salud que visitó la vereda Santa Rosa el fin de semana, la atención fue oportuna y respetuosa con los adultos mayores.',
  },
  {
    n: 6, tipoSolicitudId: 'CONSULTA', presentacion: 'IDENTIFICADA', canalRespuesta: 'TELEFONO',
    ciudadano: { nombre: 'Carmen Cecilia Villamizar Rey', telefono: '3000000006' },
    descripcion: 'Consulto cuáles son los requisitos y el trámite para obtener una licencia de construcción de vivienda unifamiliar en el casco urbano del municipio.',
  },

  // ── AL BORDE DEL VENCIMIENTO (2, retrodatados) ────────────────
  {
    n: 7, tipoSolicitudId: 'PETICION_GENERAL', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Ramiro Suárez Landazábal', email: EMAIL_PLACEHOLDER, telefono: '3000000007' },
    descripcion: 'Solicito la expedición del certificado de estratificación de mi predio urbano ubicado en la carrera 5 con calle 6, requerido para un trámite bancario.',
    retro: { objetivoHabiles: 2 },
    asignar: { destino: 'SEC_PLANEACION' },
  },
  {
    n: 8, tipoSolicitudId: 'RECLAMO', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Blanca Inés Pinzón Cáceres', email: EMAIL_PLACEHOLDER, telefono: '3000000008' },
    descripcion: 'Reclamo por el cobro duplicado del impuesto predial del predio 010200150009000 en la factura del presente año; ya pagué el primer trimestre y volvió a llegar el cobro.',
    retro: { objetivoHabiles: 1 },
  },

  // ── VENCIDOS (3, retrodatados con fechas pasadas coherentes) ──
  {
    n: 9, tipoSolicitudId: 'PETICION_DOCUMENTOS', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Aníbal Rodríguez Chanagá', email: EMAIL_PLACEHOLDER, telefono: '3000000009' },
    descripcion: 'Solicito copia del convenio interadministrativo suscrito para el mantenimiento de las vías terciarias del municipio durante la vigencia anterior.',
    retro: { objetivoHabiles: -3 },
    asignar: { destino: 'SEC_GOBIERNO', conArea: true, conResponsable: true },
  },
  {
    n: 10, tipoSolicitudId: 'QUEJA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Yolanda Patricia Serrano Mantilla', email: EMAIL_PLACEHOLDER, telefono: '3000000010' },
    descripcion: 'Queja por el ruido excesivo de un establecimiento nocturno en la calle 3 que funciona hasta la madrugada entre semana sin control de las autoridades.',
    retro: { objetivoHabiles: -6 },
    asignar: { destino: 'SUB_INSPECCION_POLICIA_URBANA' },
  },
  {
    n: 11, tipoSolicitudId: 'DENUNCIA', presentacion: 'RESERVADA', canalRespuesta: 'PRESENCIAL',
    ciudadano: { nombre: 'Gustavo Adolfo Plata Ordóñez', telefono: '3000000011' },
    descripcion: 'Denuncio presuntas irregularidades en la ejecución de la obra de placa huella de la vereda El Guamo: los espesores no corresponden a lo contratado.',
    retro: { objetivoHabiles: -2 },
  },

  // ── ASIGNADOS vigentes (9) ────────────────────────────────────
  {
    n: 12, tipoSolicitudId: 'PETICION_GENERAL', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Rosa Elvira Barragán Toloza', email: 'rosa.barragan.lab@example.com', telefono: '3000000012' },
    descripcion: 'Solicito el mantenimiento urgente de la vía terciaria que comunica la vereda La Rochela con la cabecera, hay tres pasos críticos tras las últimas lluvias.',
    asignar: { destino: 'SEC_PLANEACION' },
  },
  {
    n: 13, tipoSolicitudId: 'PETICION_GENERAL', presentacion: 'IDENTIFICADA', canalRespuesta: 'DIRECCION_FISICA',
    ciudadano: { nombre: 'Hernán Darío Castellanos Rueda', telefono: '3000000013', direccion: 'Finca La Esperanza, vereda Santa Rosa' },
    descripcion: 'Solicito acompañamiento técnico de la UMATA para el manejo fitosanitario del cultivo de cacao de mi finca, se presenta afectación por monilia.',
    asignar: { destino: 'SEC_AGRICULTURA_UMATA' },
  },
  {
    n: 14, tipoSolicitudId: 'QUEJA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Marta Lucía Ayala Sanabria', email: EMAIL_PLACEHOLDER, telefono: '3000000014' },
    descripcion: 'Queja por error en la liquidación de la factura del impuesto predial: el avalúo catastral aplicado no corresponde al de mi predio según el certificado del IGAC.',
    asignar: { destino: 'SEC_HACIENDA' },
  },
  {
    n: 15, tipoSolicitudId: 'RECLAMO', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Jairo Enrique Ortiz Bohórquez', email: EMAIL_PLACEHOLDER, telefono: '3000000015' },
    descripcion: 'Reclamo porque solicité la actualización de mi encuesta del Sisbén hace más de dos meses y aún no se ha realizado la visita al hogar.',
    asignar: { destino: 'SUB_SISBEN' },
  },
  {
    n: 16, tipoSolicitudId: 'DENUNCIA', presentacion: 'ANONIMA', canalRespuesta: 'PRESENCIAL',
    descripcion: 'Denuncio una situación de presunto maltrato intrafamiliar que se presenta de manera recurrente en una vivienda de la vereda Santa Rosa; hay menores de edad involucrados.',
    asignar: { destino: 'SUB_COMISARIA' },
  },
  {
    n: 17, tipoSolicitudId: 'PETICION_INFORMACION', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Nubia Esperanza Carreño Vesga', email: EMAIL_PLACEHOLDER },
    descripcion: 'Solicito información sobre la fecha, lugar y mecanismo de participación de la próxima audiencia pública de rendición de cuentas de la administración municipal.',
    asignar: { destino: 'DESPACHO_ALCALDE' },
  },
  {
    n: 18, tipoSolicitudId: 'HABEAS_DATA', presentacion: 'RESERVADA', canalRespuesta: 'DIRECCION_FISICA',
    ciudadano: { nombre: 'Luis Alfonso Mendoza Prada', direccion: 'Carrera 6 # 5-14, casco urbano' },
    descripcion: 'Solicito la supresión de mis datos personales de la base de datos de un programa municipal en el que ya no participo, en ejercicio del derecho de habeas data.',
    asignar: { destino: 'SEC_GOBIERNO', conArea: true, conResponsable: true },
  },
  {
    n: 19, tipoSolicitudId: 'PETICION_GENERAL', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Gladys Rocío Uribe Angarita', email: EMAIL_PLACEHOLDER, telefono: '3000000019' },
    descripcion: 'Solicito control sobre los semovientes que permanecen sueltos en la vía que conduce al corregimiento, ya se han presentado dos accidentes de motociclistas.',
    asignar: { destino: 'SUB_INSPECCION_POLICIA_RURAL' },
  },
  {
    n: 20, tipoSolicitudId: 'SUGERENCIA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Wilson Ferney Solano Duarte', email: EMAIL_PLACEHOLDER, telefono: '3000000020' },
    descripcion: 'Sugiero ampliar los cupos del programa de alimentación del adulto mayor e incluir a los habitantes de las veredas más alejadas en la ruta de entrega.',
    asignar: { destino: 'SUB_PROGRAMAS' },
  },

  // ── PRÓRROGAS (2) ─────────────────────────────────────────────
  {
    n: 21, tipoSolicitudId: 'PETICION_DOCUMENTOS', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Ana Dolores Peñaloza de Rangel', email: EMAIL_PLACEHOLDER, telefono: '3000000021' },
    descripcion: 'Solicito copia íntegra del expediente de la licencia urbanística otorgada en 2019 para la construcción del salón comunal del barrio San Rafael.',
    asignar: { destino: 'SEC_PLANEACION' },
    prorroga: { dias: 10, motivo: 'Volumen de expedientes en el archivo central: se requiere búsqueda documental en archivo de gestión de vigencias anteriores.' },
  },
  {
    n: 22, tipoSolicitudId: 'CONSULTA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Édgar Orlando Ramírez Celis', email: EMAIL_PLACEHOLDER, telefono: '3000000022' },
    descripcion: 'Consulto el concepto de la administración sobre el uso temporal del espacio público del parque principal para ventas informales durante las ferias del municipio.',
    asignar: { destino: 'SEC_GOBIERNO', conResponsable: true },
    prorroga: { dias: 15, motivo: 'La consulta requiere concepto jurídico sobre el aprovechamiento del espacio público y revisión del plan de ferias.' },
  },

  // ── RESUELTOS en término (6, con historia retrodatada corta) ──
  {
    n: 23, tipoSolicitudId: 'PETICION_GENERAL', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Junta de Acción Comunal Vereda La Chirle', email: EMAIL_PLACEHOLDER, telefono: '3000000023' },
    descripcion: 'Solicitamos la inclusión de cinco adultos mayores de la vereda La Chirle en el programa de complemento nutricional de la vigencia actual.',
    retro: { dias: 6 },
    asignar: { destino: 'SEC_DESARROLLO_SOCIAL' },
    resolver: { nota: 'Se verificaron los requisitos de los cinco postulados y se incluyeron en el programa de complemento nutricional a partir del presente ciclo de entrega. Se informó a la JAC el cronograma.' },
  },
  {
    n: 24, tipoSolicitudId: 'PETICION_INFORMACION', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Fabio Nelson Duarte Amado', email: EMAIL_PLACEHOLDER, telefono: '3000000024' },
    descripcion: 'Solicito información sobre el procedimiento y costo para obtener el paz y salvo del impuesto predial de un predio rural que voy a escriturar.',
    retro: { dias: 4 },
    asignar: { destino: 'SEC_HACIENDA' },
    resolver: { nota: 'Se informó al peticionario el procedimiento para la expedición del paz y salvo predial, los canales de pago habilitados y el costo vigente según la estampilla municipal.' },
  },
  {
    n: 25, tipoSolicitudId: 'QUEJA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Sandra Milena Toloza Ríos', email: EMAIL_PLACEHOLDER, telefono: '3000000025' },
    descripcion: 'Queja por la demora en la atención de la ventanilla de correspondencia el día de mercado: una sola persona atendiendo y filas de más de una hora.',
    retro: { dias: 8 },
    asignar: { destino: 'SEC_GOBIERNO', conResponsable: true },
    resolver: { nota: 'Se revisó el esquema de atención de los días de mercado y se dispuso apoyo adicional en ventanilla entre las 7:00 y las 12:00. Se ofrecieron disculpas a la ciudadana.' },
  },
  {
    n: 26, tipoSolicitudId: 'RECLAMO', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Reinaldo Vargas Pabón', email: EMAIL_PLACEHOLDER, telefono: '3000000026' },
    descripcion: 'Reclamo porque en la entrega de insumos agrícolas del programa municipal recibí el kit incompleto: faltaron el fertilizante y la guadaña anunciados.',
    retro: { dias: 5 },
    asignar: { destino: 'SEC_AGRICULTURA_UMATA' },
    resolver: { nota: 'Se verificó el acta de entrega y se programó la entrega de los elementos faltantes del kit en la próxima jornada de la UMATA en la vereda, con constancia firmada.' },
  },
  {
    n: 27, tipoSolicitudId: 'PETICION_DOCUMENTOS', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Flor Alba Sierra de Prada', email: EMAIL_PLACEHOLDER, telefono: '3000000027' },
    descripcion: 'Solicito certificado de mi inclusión en el Registro Único de Víctimas municipal para presentar ante una entidad del orden departamental.',
    retro: { dias: 3 },
    asignar: { destino: 'SUB_VICTIMAS' },
    resolver: { nota: 'Se expidió la certificación solicitada con base en la información del enlace municipal de víctimas y quedó disponible para reclamo en la oficina; se orientó sobre la ruta departamental.' },
  },
  {
    n: 28, tipoSolicitudId: 'HABEAS_DATA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Camilo Andrés Rincón Vera', email: EMAIL_PLACEHOLDER, telefono: '3000000028' },
    descripcion: 'Solicito la corrección de mi número de teléfono y dirección en la base de datos de contribuyentes del municipio, aparecen datos desactualizados.',
    retro: { dias: 5 },
    asignar: { destino: 'SEC_GOBIERNO', conResponsable: true },
    resolver: { nota: 'Se actualizaron los datos de contacto del titular en la base de datos de contribuyentes conforme a los soportes aportados, en cumplimiento de la Ley 1581 de 2012.' },
  },

  // ── RESUELTOS fuera de término (2) ────────────────────────────
  {
    n: 29, tipoSolicitudId: 'DENUNCIA', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Orlando Gómez Santamaría', email: EMAIL_PLACEHOLDER, telefono: '3000000029' },
    descripcion: 'Denuncio la ocupación de la ronda de la quebrada con una construcción en material que puede represar el cauce en temporada de lluvias.',
    retro: { objetivoHabiles: -1 },
    asignar: { destino: 'SUB_RIESGOS_GRD' },
    resolver: { nota: 'Se realizó visita técnica de gestión del riesgo, se constató la ocupación parcial de la ronda hídrica y se remitió informe a la autoridad ambiental y a la Inspección para lo de su competencia.' },
  },
  {
    n: 30, tipoSolicitudId: 'RECLAMO', presentacion: 'IDENTIFICADA', canalRespuesta: 'CORREO',
    ciudadano: { nombre: 'Teresa de Jesús Ballesteros Niño', email: EMAIL_PLACEHOLDER, telefono: '3000000030' },
    descripcion: 'Reclamo porque el subsidio del programa municipal de adulto mayor del bimestre anterior no me fue pagado a pesar de estar activa en el listado.',
    retro: { objetivoHabiles: -4 },
    asignar: { destino: 'SEC_DESARROLLO_SOCIAL' },
    resolver: { nota: 'Se verificó con la entidad pagadora la novedad del bimestre: el giro fue reintegrado por inconsistencia en el documento. Se corrigió la novedad y el pago quedó incluido en el siguiente ciclo.' },
  },
];

/* ══════════════════════════════════════════════════════════════
   Entorno y guardas
══════════════════════════════════════════════════════════════ */

function cargarEnvStage(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(ENV_STAGE, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

const env = cargarEnvStage();
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as { project_id: string };

/* ── GUARDA ANTI-PRODUCCIÓN (innegociable) ── */
if (sa.project_id === PROYECTO_PROD) {
  console.error('⛔ GUARDA: este script NO puede ejecutarse contra producción. Abortado.');
  process.exit(1);
}
if (!env.LAB_PASSWORD) {
  console.error('⛔ Falta LAB_PASSWORD en .env.stage (corre antes seed-funcionarios-stage.mjs).');
  process.exit(1);
}
if (!env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.error('⛔ Falta NEXT_PUBLIC_FIREBASE_API_KEY en .env.stage.');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount),
  projectId: sa.project_id,
});
const db = getFirestore();

/* ══════════════════════════════════════════════════════════════
   Sesiones de laboratorio (Firebase Auth REST + /api/auth/session)
══════════════════════════════════════════════════════════════ */

interface SesionLab {
  uid: string;
  email: string;
  cookie: string; // valor de __session
}

async function signInRest(email: string): Promise<{ idToken: string; localId: string }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: env.LAB_PASSWORD, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`Sign-in REST falló para ${email}: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { idToken: string; localId: string };
  return data;
}

function extraerCookieSesion(res: Response): string {
  const setCookies: string[] = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ?? '').split(/,(?=\s*\w+=)/);
  for (const c of setCookies) {
    const match = c.match(/^__session=([^;]+)/);
    if (match) return match[1];
  }
  throw new Error('No se recibió cookie __session del servidor.');
}

async function crearSesion(email: string): Promise<SesionLab> {
  let { idToken, localId } = await signInRest(email);
  let res = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (res.status === 409) {
    // claims sincronizados por el servidor → reintentar con token fresco
    ({ idToken, localId } = await signInRest(email));
    res = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  }
  if (!res.ok) {
    throw new Error(
      `El servidor en ${BASE_URL} rechazó la sesión de ${email} (HTTP ${res.status}). ` +
      '¿Está corriendo `npm run dev:stage` y conectado al proyecto stage?',
    );
  }
  return { uid: localId, email, cookie: extraerCookieSesion(res) };
}

/* ══════════════════════════════════════════════════════════════
   Acciones por el camino real (HTTP contra el servidor stage)
══════════════════════════════════════════════════════════════ */

let contadorIp = 0;

async function radicarPorApi(esc: Escenario): Promise<string> {
  const form = new FormData();
  form.set('tipoSolicitudId', esc.tipoSolicitudId);
  form.set('tipoPresentacion', esc.presentacion);
  form.set('canalRespuesta', esc.canalRespuesta);
  form.set('descripcion', esc.descripcion);
  if (esc.presentacion !== 'ANONIMA' && esc.ciudadano) {
    form.set('nombre', esc.ciudadano.nombre);
    if (esc.ciudadano.email) form.set('email', esc.ciudadano.email);
    if (esc.ciudadano.telefono) form.set('telefono', esc.ciudadano.telefono);
    if (esc.ciudadano.direccion) form.set('direccion', esc.ciudadano.direccion);
  }

  contadorIp += 1;
  const res = await fetch(`${BASE_URL}/api/radicacion`, {
    method: 'POST',
    body: form,
    // IP sintética única por solicitud: evita el rate limit del endpoint
    // público (8/min por IP) SIN tocar su código. Solo válido en laboratorio.
    headers: { 'x-forwarded-for': `10.77.0.${contadorIp}` },
  });
  const data = await res.json() as { exito: boolean; radicadoId?: string; errores?: string[] };
  if (!res.ok || !data.exito || !data.radicadoId) {
    throw new Error(`Escenario ${esc.n}: radicación falló (HTTP ${res.status}): ${JSON.stringify(data.errores ?? data)}`);
  }
  return data.radicadoId;
}

async function postConSesion(
  path: string,
  sesion: SesionLab,
  body: BodyInit,
  contentType?: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      cookie: `__session=${sesion.cookie}`,
      ...(contentType ? { 'content-type': contentType } : {}),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`POST ${path} falló (HTTP ${res.status}): ${await res.text()}`);
  }
}

/* ══════════════════════════════════════════════════════════════
   Retrodatación coherente (Admin SDK + lógica real reutilizada)
══════════════════════════════════════════════════════════════ */

/** Fecha de radicación en el pasado: `dias` atrás, a las 09:30 locales. */
function fechaRetro(dias: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(9, 30, 0, 0);
  return fecha;
}

/**
 * Busca cuántos días calendario hay que retroceder la radicación para que
 * HOY falten exactamente `objetivo` días hábiles al vencimiento (negativo
 * = vencido hace |objetivo| días hábiles). Usa las MISMAS funciones de
 * término legal que producción.
 */
function buscarDiasRetro(tipoSolicitudId: TipoSolicitudId, objetivo: number): number {
  for (let d = 0; d <= 120; d += 1) {
    const calc = calcularFechaVencimiento(fechaRetro(d), tipoSolicitudId);
    if (diasRestantesHabiles(calc.fechaVencimiento) === objetivo) return d;
  }
  throw new Error(`No fue posible retrodatar ${tipoSolicitudId} a ${objetivo} días hábiles restantes.`);
}

async function retrodatarRadicado(radicadoId: string, esc: Escenario): Promise<void> {
  if (!esc.retro) return;
  const dias = 'dias' in esc.retro ? esc.retro.dias : buscarDiasRetro(esc.tipoSolicitudId, esc.retro.objetivoHabiles);
  const fecha = fechaRetro(dias);
  const calc = calcularFechaVencimiento(fecha, esc.tipoSolicitudId);
  const iso = fecha.toISOString();

  await db.doc(`ventanilla_radicados/${radicadoId}`).update({
    'control.fechaRadicado': iso,
    'control.horaRadicado': fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }),
    'termino.fechaVencimiento': calc.fechaVencimiento,
    ultimaActualizacion: iso,
    'laboratorio.retrodatadoDias': dias,
  });

  // La huella de RADICACION acompaña a la fecha retrodatada.
  const snap = await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`)
    .where('accion', '==', 'RADICACION').get();
  await Promise.all(snap.docs.map((docu) => docu.ref.update({ fecha: iso })));
}

/* ══════════════════════════════════════════════════════════════
   Limpieza (SOLO isTest:true; jamás el radicado de auditoría)
══════════════════════════════════════════════════════════════ */

/**
 * Adopta huérfanos: si una corrida anterior fue interrumpida en la ventana no
 * atómica entre la radicación por API y la marca `isTest`, quedan documentos
 * sintéticos sin marca que la limpieza normal (query `isTest == true`) no
 * reconocería.
 *
 * LÍMITE DEL MECANISMO (revisión dev-backend, MEDIA): un huérfano, por
 * definición, NO tiene ningún campo de laboratorio (la marca es justo lo que
 * faltó escribir), y el endpoint público de radicación no acepta campos
 * arbitrarios — así que no hay un identificador dedicado propio que buscar.
 * La única señal disponible es el contenido que este generador sí controla.
 * Por eso la identificación es HEURÍSTICA: se exige la conjunción de
 *   (1) sin `isTest` y sin `laboratorio`,
 *   (2) `control.origen === 'WEB'` y `control.medioRecepcion === 'WEB'`
 *       (todo huérfano nuestro nace por el flujo público WEB), y
 *   (3) `detalle.descripcion` idéntica byte a byte a uno de los 30 textos
 *       del roster (párrafos sintéticos largos y únicos).
 * Un falso positivo requeriría que un radicado ciudadano real, entrado por WEB
 * y aún sin gestionar, tuviera una descripción idéntica a una de las nuestras:
 * despreciable, pero no imposible en teoría. Nunca toca el radicado protegido.
 */
async function adoptarHuerfanos(): Promise<number> {
  const descripcionesRoster = new Set(ESCENARIOS.map((e) => e.descripcion));
  const snap = await db.collection('ventanilla_radicados').get();
  let adoptados = 0;
  for (const docu of snap.docs) {
    if (docu.id === RADICADO_PROTEGIDO) continue;
    if (docu.get('isTest') === true || docu.get('laboratorio') !== undefined) continue;
    const origenWeb = docu.get('control.origen') === 'WEB' && docu.get('control.medioRecepcion') === 'WEB';
    if (!origenWeb) continue;
    if (descripcionesRoster.has(String(docu.get('detalle.descripcion')))) {
      await docu.ref.update({
        isTest: true,
        laboratorio: { generador: GENERADOR, version: VERSION_GENERADOR, huerfanoAdoptado: true },
      });
      adoptados += 1;
    }
  }
  if (adoptados > 0) console.log(`♻ ${adoptados} radicados huérfanos de corridas interrumpidas adoptados al namespace ${GENERADOR}.`);
  return adoptados;
}

async function limpiar(): Promise<void> {
  await adoptarHuerfanos();
  // Namespaced por generador (decisión de arquitecto, 2026-07-10): --limpiar
  // borra SOLO documentos de ESTE generador (`laboratorio.generador ==
  // GENERADOR`), nunca todo `isTest`. Así el laboratorio es multi-auditor:
  // no destruye fixtures de otros generadores (p.ej. `playwright-e2e` de QA)
  // ni el radicado protegido 00000001 (que no tiene el campo).
  const snap = await db.collection('ventanilla_radicados')
    .where('laboratorio.generador', '==', GENERADOR).get();
  let borrados = 0;
  for (const docu of snap.docs) {
    if (docu.id === RADICADO_PROTEGIDO) {
      console.warn(`⚠ ${RADICADO_PROTEGIDO} está protegido: no se toca.`);
      continue;
    }
    await db.recursiveDelete(docu.ref); // documento + subcolección trazabilidad
    borrados += 1;
  }

  // Reset del contador anual al máximo consecutivo restante para que la
  // resiembra reproduzca los mismos radicadoIds (determinismo).
  //
  // Atómico (revisión dev-backend, MEDIA): el escaneo de la colección y la
  // escritura del contador van en una MISMA runTransaction, con las lecturas
  // antes de la escritura (patrón de app/api/radicacion/route.ts). El read-set
  // de la transacción es toda la colección `ventanilla_radicados`: si una
  // radicación concurrente crea un documento (o toca el contador) entre la
  // lectura y el commit, Firestore invalida el read-set, aborta y reintenta,
  // recalculando `maximo` sobre el estado real. Así nunca se baja el contador
  // por debajo de un consecutivo ya entregado → sin colisión de radicadoId.
  // A escala de laboratorio (decenas de docs) el read-set completo es barato.
  const anio = new Date().getFullYear();
  const counterRef = db.doc(`counters/radicados-${anio}`);
  const maximo = await db.runTransaction(async (transaction) => {
    const restantes = await transaction.get(db.collection('ventanilla_radicados'));
    let max = 0;
    for (const docu of restantes.docs) {
      const consecutivo = Number((docu.get('control.consecutivo') as unknown) ?? 0);
      if (consecutivo > max) max = consecutivo;
    }
    transaction.set(counterRef, {
      anio,
      ultimo: max,
      actualizadoEn: new Date().toISOString(),
    }, { merge: true });
    return max;
  });

  console.log(`🧹 Limpieza: ${borrados} radicados de prueba eliminados; counters/radicados-${anio}.ultimo = ${maximo}.`);
}

/* ══════════════════════════════════════════════════════════════
   Verificación con evidencia (Principio 13)
══════════════════════════════════════════════════════════════ */

interface RadicadoLeido {
  id: string;
  estadoActual: string;
  tipoSolicitudId: string;
  tipoPresentacion?: string;
  oficinaDestino: string;
  consecutivo: number;
  fechaRadicado: string;
  fechaVencimiento: string;
  prorrogasAplicadas: number;
  cumplioTermino?: boolean | null;
  respuestaFecha?: string;
  eventosTrazabilidad: number;
  tieneEventoRadicacion: boolean;
}

async function verificar(): Promise<boolean> {
  // Leemos TODA la colección una vez: los documentos propios se filtran por
  // `laboratorio.generador == GENERADOR`; el resto (QA `playwright-e2e`, el
  // radicado protegido, etc.) solo se usa para EXPLICAR huecos de consecutivo
  // sin contaminar los conteos ni marcar falsos errores.
  const todos = await db.collection('ventanilla_radicados').get();
  const mios = todos.docs.filter((d) => d.get('laboratorio.generador') === GENERADOR);
  const ajenosPorConsecutivo = new Map<number, string>();
  for (const d of todos.docs) {
    if (d.get('laboratorio.generador') === GENERADOR) continue;
    const c = Number((d.get('control.consecutivo') as unknown) ?? 0);
    if (c > 0) ajenosPorConsecutivo.set(c, String(d.get('laboratorio.generador') ?? d.id));
  }

  const radicados: RadicadoLeido[] = [];
  for (const docu of mios) {
    const traz = await docu.ref.collection('trazabilidad').get();
    radicados.push({
      id: docu.id,
      estadoActual: String(docu.get('estadoActual')),
      tipoSolicitudId: String(docu.get('termino.tipoSolicitudId')),
      tipoPresentacion: docu.get('tipoPresentacion') as string | undefined,
      oficinaDestino: String(docu.get('clasificacion.oficinaDestino')),
      consecutivo: Number(docu.get('control.consecutivo')),
      fechaRadicado: String(docu.get('control.fechaRadicado')),
      fechaVencimiento: String(docu.get('termino.fechaVencimiento')),
      prorrogasAplicadas: Number(docu.get('termino.prorrogasAplicadas') ?? 0),
      cumplioTermino: docu.get('cumplioTermino') as boolean | null | undefined,
      respuestaFecha: docu.get('respuestaOficial.fecha') as string | undefined,
      eventosTrazabilidad: traz.size,
      tieneEventoRadicacion: traz.docs.some((e) => e.get('accion') === 'RADICACION'),
    });
  }

  radicados.sort((a, b) => a.consecutivo - b.consecutivo);
  const errores: string[] = [];
  const intercalados: string[] = []; // notas informativas, NO errores

  // 1. Contigüidad SOLO sobre mis consecutivos. Un salto puede deberse a:
  //    (a) radicados de terceros intercalados (QA u otro generador) → nota
  //        informativa: mis datos están completos, solo comparto el rango; o
  //    (b) un consecutivo realmente ausente (ningún doc lo ocupa) → error:
  //        perdí un radicado propio.
  for (let i = 1; i < radicados.length; i += 1) {
    const anterior = radicados[i - 1].consecutivo;
    const actual = radicados[i].consecutivo;
    for (let n = anterior + 1; n < actual; n += 1) {
      const duenoAjeno = ajenosPorConsecutivo.get(n);
      if (duenoAjeno) {
        intercalados.push(`consecutivo ${n} tomado por tercero (${duenoAjeno}) entre ${radicados[i - 1].id} y ${radicados[i].id}`);
      } else {
        errores.push(`consecutivo ${n} ausente entre ${radicados[i - 1].id} y ${radicados[i].id} (radicado propio perdido)`);
      }
    }
  }
  for (const r of radicados) {
    const esperado = formatearRadicadoInstitucional(r.consecutivo, new Date(r.fechaRadicado));
    if (r.id !== esperado) errores.push(`${r.id}: id no coincide con formato canónico ${esperado}`);
    if (!r.tieneEventoRadicacion) errores.push(`${r.id}: sin evento RADICACION en trazabilidad`);
    if (r.eventosTrazabilidad === 0) errores.push(`${r.id}: subcolección trazabilidad vacía`);
  }

  // 2. Vencimientos: recalculados con la MISMA lógica de días hábiles
  for (const r of radicados) {
    const base = calcularFechaVencimiento(new Date(r.fechaRadicado), r.tipoSolicitudId).fechaVencimiento;
    if (r.prorrogasAplicadas === 0) {
      if (r.fechaVencimiento !== base) {
        errores.push(`${r.id}: vencimiento ${r.fechaVencimiento} ≠ recalculado ${base}`);
      }
    } else if (new Date(r.fechaVencimiento) <= new Date(base)) {
      errores.push(`${r.id}: prórroga aplicada pero el vencimiento no es posterior al término base`);
    }
  }

  // 3. Coherencia de cumplioTermino en resueltos
  for (const r of radicados) {
    if (r.estadoActual === 'RESUELTO') {
      if (typeof r.cumplioTermino !== 'boolean' || !r.respuestaFecha) {
        errores.push(`${r.id}: resuelto sin cumplioTermino/respuestaOficial`);
      } else {
        const esperado = new Date(r.respuestaFecha) <= new Date(r.fechaVencimiento);
        if (r.cumplioTermino !== esperado) {
          errores.push(`${r.id}: cumplioTermino=${r.cumplioTermino} incoherente con fechas`);
        }
      }
    } else if (typeof r.cumplioTermino === 'boolean') {
      errores.push(`${r.id}: cumplioTermino escrito sin estar resuelto`);
    }
  }

  // 4. Resumen ejecutivo
  const contar = (fn: (r: RadicadoLeido) => string): Record<string, number> => {
    const acc: Record<string, number> = {};
    for (const r of radicados) acc[fn(r)] = (acc[fn(r)] ?? 0) + 1;
    return acc;
  };
  const activos = radicados.filter((r) => r.estadoActual !== 'RESUELTO');
  const vencidos = activos.filter((r) => diasRestantesHabiles(r.fechaVencimiento) < 0);
  const porVencer = activos.filter((r) => {
    const d = diasRestantesHabiles(r.fechaVencimiento);
    return d >= 0 && d <= 2;
  });

  console.log('\n══════════ ALCALDÍA SINTÉTICA — RESUMEN DE VERIFICACIÓN ══════════');
  console.log(`Generador: ${GENERADOR} (namespace propio) · radicados propios: ${radicados.length}`);
  console.log(`Consecutivos propios: ${radicados[0]?.consecutivo} → ${radicados[radicados.length - 1]?.consecutivo}`);
  console.log('Por estado persistido:', contar((r) => r.estadoActual));
  console.log('Por tipo de solicitud:', contar((r) => r.tipoSolicitudId));
  console.log('Por presentación:', contar((r) => r.tipoPresentacion ?? 'IDENTIFICADA'));
  console.log('Por oficina destino:', contar((r) => r.oficinaDestino));
  console.log(`Término (derivado hoy): ${vencidos.length} vencidos, ${porVencer.length} por vencer (≤2 días hábiles).`);
  console.log('cumplioTermino:', contar((r) => String(r.cumplioTermino ?? 'null')));

  if (intercalados.length > 0) {
    console.log(`\nℹ ${intercalados.length} consecutivo(s) de terceros intercalados en mi rango (esperado si otro auditor escribe en stage; NO es fallo):`);
    for (const n of intercalados) console.log('  ·', n);
  }

  if (errores.length > 0) {
    console.error(`\n✗ ${errores.length} inconsistencias:`);
    for (const e of errores) console.error('  -', e);
    return false;
  }
  console.log('\n✔ Verificación: datos propios completos y contiguos (salvo intercalados de terceros), trazabilidad presente y vencimientos coherentes con días hábiles colombianos.');
  return true;
}

/* ══════════════════════════════════════════════════════════════
   Orquestación
══════════════════════════════════════════════════════════════ */

async function sembrar(): Promise<void> {
  // Pre-flight 1: no doble siembra (idempotencia explícita), namespaced por
  // generador. Solo bloquea si YA existen datos de ESTE generador — la
  // presencia de fixtures de otros auditores (p.ej. `playwright-e2e`) no
  // impide sembrar. Adopta primero posibles huérfanos de corridas
  // interrumpidas para que también cuenten como datos propios existentes.
  await adoptarHuerfanos();
  const existentes = await db.collection('ventanilla_radicados')
    .where('laboratorio.generador', '==', GENERADOR).limit(1).get();
  if (!existentes.empty) {
    console.error(`⛔ Ya existen radicados del generador ${GENERADOR} en stage. Usa --limpiar para regenerarlos.`);
    process.exit(1);
  }

  // Pre-flight 2: el servidor local debe ser el de STAGE. Los usuarios .lab
  // solo existen en stage: si el servidor apunta a otro proyecto, la sesión
  // falla ANTES de crear cualquier radicado.
  console.log(`▶ Autenticando funcionarios de laboratorio contra ${BASE_URL} (${sa.project_id})…`);
  const recepcionista = await crearSesion('recepcionista.lab@simacota.gov.co');
  const funcionario = await crearSesion('funcionario.lab@simacota.gov.co');
  const adminLab = await crearSesion('admin.lab@simacota.gov.co');
  console.log('✔ Sesiones activas: recepcionista, funcionario (SEC_GOBIERNO) y admin.');

  const responsableGobierno = {
    uid: funcionario.uid,
    nombre: 'Funcionario Lab',
    email: funcionario.email,
    rol: 'FUNCIONARIO',
    cargo: 'Profesional Universitario',
  };

  for (const esc of ESCENARIOS) {
    // 1. Nacimiento por el camino real
    const radicadoId = await radicarPorApi(esc);

    // 2. Marca de laboratorio (precedente: scripts/marcar-datos-prueba.ts)
    await db.doc(`ventanilla_radicados/${radicadoId}`).update({
      isTest: true,
      laboratorio: { generador: GENERADOR, version: VERSION_GENERADOR, escenario: esc.n },
    });

    // 3. Retrodatación coherente (solo escenarios históricos)
    await retrodatarRadicado(radicadoId, esc);

    // 4. Gestión por el camino real
    if (esc.asignar) {
      const areaId = esc.asignar.conArea
        ? areasParaDependencia(esc.asignar.destino).filter((a) => !a.transversal)[0]?.areaId ?? null
        : null;
      await postConSesion(`/api/radicados/${radicadoId}/asignar`, recepcionista, JSON.stringify({
        tenantDestino: esc.asignar.destino,
        ...(areaId ? { areaId } : {}),
        ...(esc.asignar.conResponsable ? { responsable: responsableGobierno } : {}),
      }), 'application/json');
    }

    if (esc.prorroga) {
      const sesion = esc.asignar?.destino === 'SEC_GOBIERNO' ? funcionario : adminLab;
      await postConSesion(`/api/radicados/${radicadoId}/prorroga`, sesion, JSON.stringify({
        motivo: esc.prorroga.motivo,
        diasProrroga: esc.prorroga.dias,
      }), 'application/json');
    }

    if (esc.resolver) {
      const sesion = esc.asignar?.destino === 'SEC_GOBIERNO' ? funcionario : adminLab;
      const form = new FormData();
      form.set('nota', esc.resolver.nota);
      await postConSesion(`/api/radicados/${radicadoId}/resolver`, sesion, form);
    }

    console.log(`✨ [${String(esc.n).padStart(2, '0')}/30] ${radicadoId} · ${esc.tipoSolicitudId}${esc.asignar ? ` → ${esc.asignar.destino}` : ''}${esc.resolver ? ' · RESUELTO' : ''}${esc.prorroga ? ' · PRORROGA' : ''}`);
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  if (args.has('--solo-limpiar')) {
    await limpiar();
    process.exit(0);
  }
  if (args.has('--limpiar')) {
    await limpiar();
  }

  await sembrar();
  const ok = await verificar();
  process.exit(ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('⛔ Alcaldía Sintética falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
