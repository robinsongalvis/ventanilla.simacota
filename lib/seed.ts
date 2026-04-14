/**
 * lib/seed.ts
 * -----------
 * Populates Firestore with test radicados and user profile documents.
 *
 * HOW TO RUN
 * ----------
 * 1. Import and call seedRadicadosPrueba() from a temporary Next.js page or
 *    a standalone Node script (using the Firebase Admin SDK instead of this
 *    client SDK version).
 *
 * 2. Before running, create the two Auth accounts manually in the Firebase
 *    Console → Authentication → Users:
 *      admin@simacota.gov.co       (password: Admin2026!)
 *      gobierno@simacota.gov.co    (password: Gobierno2026!)
 *
 * 3. Copy the UIDs shown in the console and update ADMIN_UID / GOB_UID below.
 *
 * 4. Call from a one-off page:
 *      import { seedRadicadosPrueba } from '@/lib/seed';
 *      // inside a useEffect or Server Action:
 *      await seedRadicadosPrueba();
 */

import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db }                      from './firebase';
import type { Radicado }           from '../src/types/radicado';

/* ─────────────────────────────────────────────────────────────
   Replace with the actual UIDs after creating Auth accounts
───────────────────────────────────────────────────────────── */
const ADMIN_UID = 'REPLACE_WITH_ADMIN_UID';
const GOB_UID   = 'REPLACE_WITH_GOBIERNO_UID';

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function uid4(): string {
  return Array.from(
    { length: 4 },
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)]
  ).join('');
}

function radicadoId(offsetMs = 0): string {
  const d    = new Date(Date.now() - offsetMs);
  const date = d.toISOString().split('T')[0];
  const time = d.toTimeString().slice(0, 8).replace(/:/g, '');
  return `EXT-${date}-${time}-${uid4()}`;
}

function iso(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

const H  = 3_600_000;
const D  = 86_400_000;

/* ─────────────────────────────────────────────────────────────
   8 Radicados de prueba (cubre todas las combinaciones del spec)
───────────────────────────────────────────────────────────── */
function buildRadicados(): Radicado[] {
  return [
    /* 1 — ROJO + PENDIENTE + WEB + CASCO_URBANO → SEC_GOBIERNO */
    {
      radicadoId:  radicadoId(2 * H),
      origen:      'WEB',
      fechaCreacion: iso(2 * H),
      estadoActual: 'PENDIENTE',
      prioridad:   'ROJO',
      ciudadano:   { nombre: 'María García López',   email: 'maria.garcia@gmail.com',   telefono: '3101234567' },
      clasificacionIA: {
        oficinaDestino: 'SEC_GOBIERNO',
        emailOficial:   'gobierno@simacota.gov.co',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    'Solicita resolución urgente de conflicto de linderos con vecino colindante en predio urbano. Riesgo de violencia declarado.',
        mensajeOriginal: 'Tengo un problema grave con mi vecino por los linderos de mi terreno...',
      },
      archivos:  [],
      auditoria: [{ fecha: iso(2 * H), accion: 'RADICACION', actor: 'Portal Web', nota: 'Radicación inicial vía web.' }],
    },

    /* 2 — ROJO + PENDIENTE + FISICO_ESCANER + ZONA_YARIGUIES → SUB_INSPECCION_POLICIA_RURAL */
    {
      radicadoId:  radicadoId(5 * H),
      origen:      'FISICO_ESCANER',
      fechaCreacion: iso(5 * H),
      estadoActual: 'PENDIENTE',
      prioridad:   'ROJO',
      ciudadano:   { nombre: 'Carlos Rincón Pérez',  email: '',                          telefono: '3157654321' },
      clasificacionIA: {
        oficinaDestino: 'SUB_INSPECCION_POLICIA_RURAL',
        emailOficial:   'policia.rural@simacota.gov.co',
        zonaGeografica: 'ZONA_YARIGUIES',
        resumenCaso:    'Denuncia sobre amenazas a líderes comunales en vereda Yariguíes. Solicita presencia policial inmediata.',
        mensajeOriginal: 'Estoy siendo amenazado por grupos al margen de la ley en la vereda...',
      },
      archivos:  [{ nombre: 'denuncia_escaneada.pdf', url: '' }],
      auditoria: [{ fecha: iso(5 * H), accion: 'RADICACION', actor: 'Recepción Física', nota: 'Radicación presencial con documento adjunto.' }],
    },

    /* 3 — NARANJA + EN_REVISION + WEB + CASCO_URBANO → SUB_COMISARIA */
    {
      radicadoId:  radicadoId(1 * D),
      origen:      'WEB',
      fechaCreacion: iso(1 * D),
      estadoActual: 'EN_REVISION',
      prioridad:   'NARANJA',
      ciudadano:   { nombre: 'Luisa Fernanda Mora',  email: 'lfmora@hotmail.com',        telefono: '3209876543' },
      clasificacionIA: {
        oficinaDestino: 'SUB_COMISARIA',
        emailOficial:   'comisaria@simacota.gov.co',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    'Solicita medida de protección por situación de violencia intrafamiliar. Requiere orientación jurídica urgente.',
        mensajeOriginal: 'Mi esposo me agredió físicamente anoche y necesito protección...',
      },
      archivos:  [],
      auditoria: [
        { fecha: iso(1 * D),            accion: 'RADICACION', actor: 'Portal Web',    nota: 'Radicación inicial.' },
        { fecha: iso(1 * D - 2 * H),    accion: 'EN_REVISION', actor: 'Comisaría', nota: 'Documentación en proceso de revisión.' },
      ],
    },

    /* 4 — AMARILLO + EN_PROCESO + WEB + ZONA_YARIGUIES → SEC_AGRICULTURA_UMATA */
    {
      radicadoId:  radicadoId(2 * D),
      origen:      'WEB',
      fechaCreacion: iso(2 * D),
      estadoActual: 'EN_PROCESO',
      prioridad:   'AMARILLO',
      ciudadano:   { nombre: 'Hernando Suárez Díaz', email: 'hsuarez@gmail.com',        telefono: '3145558899' },
      clasificacionIA: {
        oficinaDestino: 'SEC_AGRICULTURA_UMATA',
        emailOficial:   'umata@simacota.gov.co',
        zonaGeografica: 'ZONA_YARIGUIES',
        resumenCaso:    'Solicita asistencia técnica agropecuaria para cultivo de cacao en 4 hectáreas. Requiere visita de extensionista.',
        mensajeOriginal: 'Tengo 4 hectáreas de cacao y necesito orientación técnica para mejorar la producción...',
      },
      archivos:  [],
      auditoria: [
        { fecha: iso(2 * D),          accion: 'RADICACION', actor: 'Portal Web', nota: 'Radicación inicial.' },
        { fecha: iso(2 * D - 4 * H),  accion: 'EN_PROCESO', actor: 'UMATA',      nota: 'Visita técnica programada.' },
      ],
    },

    /* 5 — ROJO + RESUELTO + FISICO_ESCANER + CASCO_URBANO → SEC_PLANEACION */
    {
      radicadoId:  radicadoId(3 * D),
      origen:      'FISICO_ESCANER',
      fechaCreacion: iso(3 * D),
      estadoActual: 'RESUELTO',
      prioridad:   'ROJO',
      ciudadano:   { nombre: 'Pedro Antonio Vargas', email: 'pedro.vargas@yahoo.com',   telefono: '3187772233' },
      clasificacionIA: {
        oficinaDestino: 'SEC_PLANEACION',
        emailOficial:   'planeacion@simacota.gov.co',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    'Solicitud urgente de licencia de construcción para reparación estructural de vivienda afectada por deslizamiento.',
        mensajeOriginal: 'Mi casa quedó con daños estructurales por el deslizamiento de tierra y necesito la licencia urgente...',
      },
      archivos:  [{ nombre: 'fotos_danos.pdf', url: '' }, { nombre: 'formulario_licencia.pdf', url: '' }],
      auditoria: [
        { fecha: iso(3 * D),         accion: 'RADICACION', actor: 'Recepción Física', nota: 'Radicación presencial.' },
        { fecha: iso(3 * D - 6 * H), accion: 'EN_PROCESO', actor: 'Planeación',       nota: 'Visita técnica realizada.' },
        { fecha: iso(3 * D - 1 * D), accion: 'RESUELTO',   actor: 'Planeación',       nota: 'Licencia otorgada. Radicado cerrado.' },
      ],
    },

    /* 6 — NARANJA + DEVUELTO + WEB + CASCO_URBANO → SUB_SISBEN */
    {
      radicadoId:  radicadoId(4 * D),
      origen:      'WEB',
      fechaCreacion: iso(4 * D),
      estadoActual: 'DEVUELTO',
      prioridad:   'NARANJA',
      ciudadano:   { nombre: 'Rosa Elena Cárdenas',  email: 'rcardenas@gmail.com',      telefono: '3162223344' },
      clasificacionIA: {
        oficinaDestino: 'SUB_SISBEN',
        emailOficial:   'sisben@simacota.gov.co',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    'Solicitud de actualización de encuesta SISBEN por cambio de condiciones socioeconómicas del hogar. Documentación incompleta.',
        mensajeOriginal: 'Quiero actualizar mi SISBEN porque mis condiciones económicas han cambiado mucho...',
      },
      archivos:  [],
      auditoria: [
        { fecha: iso(4 * D),         accion: 'RADICACION', actor: 'Portal Web', nota: 'Radicación inicial.' },
        { fecha: iso(4 * D - 2 * H), accion: 'DEVUELTO',   actor: 'SISBEN',    nota: 'Se devuelve por falta de copia de cédula y recibo de servicios.' },
      ],
    },

    /* 7 — AMARILLO + PENDIENTE + WEB + ZONA_YARIGUIES → SUB_VICTIMAS */
    {
      radicadoId:  radicadoId(6 * D),
      origen:      'WEB',
      fechaCreacion: iso(6 * D),
      estadoActual: 'PENDIENTE',
      prioridad:   'AMARILLO',
      ciudadano:   { nombre: 'Yolanda Pinto Torres', email: 'ypinto@gmail.com',         telefono: '3114445566' },
      clasificacionIA: {
        oficinaDestino: 'SUB_VICTIMAS',
        emailOficial:   'victimas@simacota.gov.co',
        zonaGeografica: 'ZONA_YARIGUIES',
        resumenCaso:    'Víctima del conflicto armado solicita inclusión en el registro único de víctimas y orientación sobre reparación colectiva.',
        mensajeOriginal: 'Soy víctima del desplazamiento forzado y quiero saber cómo incluirme en el RUV...',
      },
      archivos:  [],
      auditoria: [{ fecha: iso(6 * D), accion: 'RADICACION', actor: 'Portal Web', nota: 'Radicación inicial.' }],
    },

    /* 8 — ROJO + EN_PROCESO + FISICO_ESCANER + CASCO_URBANO → DESPACHO_ALCALDE */
    {
      radicadoId:  radicadoId(30 * H),
      origen:      'FISICO_ESCANER',
      fechaCreacion: iso(30 * H),
      estadoActual: 'EN_PROCESO',
      prioridad:   'ROJO',
      ciudadano:   { nombre: 'Asociación Campesinos Simacota', email: 'asocampe@gmail.com', telefono: '3198887766' },
      clasificacionIA: {
        oficinaDestino: 'DESPACHO_ALCALDE',
        emailOficial:   'alcalde@simacota.gov.co',
        zonaGeografica: 'CASCO_URBANO',
        resumenCaso:    'Derecho de petición de la Asociación Campesina solicitando audiencia pública sobre presupuesto participativo 2026.',
        mensajeOriginal: 'En nombre de la Asociación Campesina solicitamos audiencia pública urgente...',
      },
      archivos:  [{ nombre: 'derecho_peticion.pdf', url: '' }],
      auditoria: [
        { fecha: iso(30 * H),         accion: 'RADICACION', actor: 'Recepción Física', nota: 'Radicación presencial en despacho.' },
        { fecha: iso(30 * H - 3 * H), accion: 'EN_PROCESO', actor: 'Despacho Alcalde', nota: 'Audiencia agendada para el 20 de abril de 2026.' },
      ],
    },
  ];
}

/* ─────────────────────────────────────────────────────────────
   Public functions
───────────────────────────────────────────────────────────── */

/** Writes 8 test radicados to Firestore. */
export async function seedRadicadosPrueba(): Promise<void> {
  const radicados = buildRadicados();

  for (const r of radicados) {
    await setDoc(doc(db, 'radicados', r.radicadoId), r);
    console.log(`[seed] ✓ Radicado: ${r.radicadoId}`);
  }

  console.log('[seed] 8 radicados de prueba escritos en Firestore.');
}

/**
 * Writes user profile documents to Firestore.
 * You must first create the Auth accounts in the Firebase Console
 * and replace ADMIN_UID / GOB_UID at the top of this file.
 */
export async function seedUsuariosPrueba(): Promise<void> {
  await setDoc(doc(db, 'users', ADMIN_UID), {
    nombre:   'Administrador',
    email:    'admin@simacota.gov.co',
    rol:      'ADMIN',
    tenantId: 'DESPACHO_ALCALDE',
  });
  console.log('[seed] ✓ Usuario admin escritos en Firestore.');

  await setDoc(doc(db, 'users', GOB_UID), {
    nombre:   'Secretaría de Gobierno',
    email:    'gobierno@simacota.gov.co',
    rol:      'FUNCIONARIO',
    tenantId: 'SEC_GOBIERNO',
  });
  console.log('[seed] ✓ Usuario gobierno escrito en Firestore.');

  console.log('[seed] Perfiles de usuario listos.');
}

/** Convenience: seeds everything in one call. */
export async function seedTodo(): Promise<void> {
  await seedRadicadosPrueba();
  await seedUsuariosPrueba();
}
