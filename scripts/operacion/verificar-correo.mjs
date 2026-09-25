/**
 * scripts/operacion/verificar-correo.mjs
 *
 * Comprueba que el buzón institucional PUEDE enviar, ANTES de que el sistema
 * dependa de él. Hasta ahora «el correo está configurado» era una afirmación:
 * las variables existían vacías en Vercel desde hacía ochenta días y nadie lo
 * notó porque nada lo comprobaba.
 *
 * DOS MODOS, y el que escribe hacia fuera es opt-in explícito:
 *   (sin flags)      Verifica la CONEXIÓN y la AUTENTICACIÓN contra el servidor
 *                    SMTP. No envía nada a nadie. Es el modo por defecto porque
 *                    el 90% de los fallos (host, puerto, contraseña, 2FA) se
 *                    detectan aquí sin molestar a ningún buzón.
 *   --enviar-a <correo>  Envía UN mensaje de prueba a esa dirección. Se exige
 *                    escribirla: nunca se deduce ni se usa un valor por defecto,
 *                    para que sea imposible mandar una prueba a un ciudadano.
 *
 * NUNCA imprime la contraseña, ni entera ni parcial.
 *
 * Uso:
 *   node scripts/operacion/verificar-correo.mjs
 *   node scripts/operacion/verificar-correo.mjs --enviar-a alguien@dominio.gov.co
 */
import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; }

/* El remitente NO es una preferencia: es el buzón que la alcaldía publica como
   oficial, y vive en DIRECTORIO_TENANTS (src/types/reglas-negocio.ts, «fuente
   única de verdad»). Notificar desde otra dirección significa que la respuesta
   del ciudadano cae en un buzón que nadie lee — y que el correo llega desde un
   remitente que no aparece en ninguna parte oficial, que es exactamente el
   perfil de un intento de suplantación.
   Se lee con expresión regular a propósito: este script es un .mjs suelto sin
   build, no puede importar TypeScript. Si el formato del archivo cambia, avisa
   en vez de fallar: es una comprobación de coherencia, no una guarda de
   seguridad. */
function emailOficialDeVentanilla() {
  try {
    const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const src = readFileSync(resolve(raiz, 'src/types/reglas-negocio.ts'), 'utf8');
    const bloque = src.split('VENTANILLA_UNICA:')[1];
    if (!bloque) return null;
    const m = bloque.slice(0, 400).match(/emailOficial:\s*'([^']+)'/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Extrae la dirección de un `Nombre <correo@dominio>` o la devuelve tal cual. */
function soloDireccion(v) {
  const m = String(v ?? '').match(/<([^>]+)>/);
  return (m ? m[1] : String(v ?? '')).trim().toLowerCase();
}
const destinatario = arg('--enviar-a');

const host = process.env.EMAIL_HOST;
const port = Number(process.env.EMAIL_PORT ?? 587);
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const from = process.env.EMAIL_FROM ?? user;

/* Diagnóstico de lo que FALTA, en una sola pasada. El mailer de la aplicación
   lanza un error genérico («configuración incompleta») que no dice cuál falta:
   quien lo lee a las 7 de la mañana no sabe por dónde empezar. */
const faltan = [];
if (!host) faltan.push('EMAIL_HOST');
if (!user) faltan.push('EMAIL_USER');
if (!pass) faltan.push('EMAIL_PASS');
if (faltan.length) {
  console.error(`⛔ Faltan variables: ${faltan.join(', ')}`);
  console.error('   Defínalas en .env.local (local) o en Vercel → Settings → Environment Variables (producción).');
  console.error('   Para Google Workspace: EMAIL_HOST=smtp.gmail.com · EMAIL_PORT=587 · EMAIL_PASS = contraseña de aplicación de 16 caracteres (NO la del usuario).');
  process.exit(1);
}
if (destinatario !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinatario)) {
  console.error(`⛔ --enviar-a no parece un correo: ${destinatario}`);
  process.exit(1);
}

console.log(`Servidor : ${host}:${port} (${port === 465 ? 'SSL' : 'STARTTLS'})`);
console.log(`Usuario  : ${user}`);
console.log(`Remitente: ${from}`);
console.log(`Clave    : ${pass.length} caracteres${pass.length === 16 ? ' (largo de contraseña de aplicación ✔)' : ' ⚠ Google espera 16 — si es la clave normal del usuario, fallará'}`);

const oficial = emailOficialDeVentanilla();
if (oficial === null) {
  console.log('⚠ No se pudo leer el correo oficial de DIRECTORIO_TENANTS — se omite la comprobación de coherencia.');
} else {
  const desajustes = [];
  if (soloDireccion(user) !== oficial.toLowerCase()) desajustes.push(`EMAIL_USER (${user})`);
  if (soloDireccion(from) !== oficial.toLowerCase()) desajustes.push(`EMAIL_FROM (${soloDireccion(from)})`);
  if (desajustes.length) {
    console.log(`⚠ NO coincide con el buzón oficial de Ventanilla Única (${oficial}):`);
    for (const d of desajustes) console.log(`    · ${d}`);
    console.log('  Notificar desde otra dirección deja las respuestas del ciudadano en un buzón que nadie lee.');
    console.log('  Si el buzón oficial cambió, actualice DIRECTORIO_TENANTS en src/types/reglas-negocio.ts.');
  } else {
    console.log(`✔ Coincide con el buzón oficial de Ventanilla Única (${oficial}).`);
  }
}
console.log('');

const transporter = nodemailer.createTransport({
  host, port, secure: port === 465, auth: { user, pass },
});

/* Traducción de los errores que de verdad salen, a lo que hay que hacer. Sin
   esto, un `EAUTH 535` manda a cualquiera a buscar en foros durante una hora. */
function esFalloDeConexion(err) {
  const cod = err?.code ?? '';
  const msg = String(err?.message ?? err);
  return cod === 'ECONNECTION' || cod === 'ETIMEDOUT' || /ENOTFOUND|ECONNREFUSED|EDNS/.test(cod + msg);
}

function explicar(err) {
  const cod = err?.code ?? '';
  const msg = String(err?.message ?? err);
  if (cod === 'EAUTH' || /535|Username and Password not accepted/i.test(msg)) {
    return ['Autenticación rechazada. Casi siempre es una de estas tres:',
      '  1. EMAIL_PASS es la contraseña normal del usuario. Google exige una CONTRASEÑA DE APLICACIÓN de 16 caracteres.',
      '  2. La cuenta no tiene verificación en dos pasos activada — sin ella Google no deja crear contraseñas de aplicación.',
      '  3. El administrador de Google Workspace tiene bloqueado el acceso SMTP. Se habilita en la consola de administración.'].join('\n');
  }
  if (cod === 'ECONNECTION' || cod === 'ETIMEDOUT' || /ENOTFOUND|ECONNREFUSED/.test(cod + msg)) {
    return 'No se pudo conectar. Revise EMAIL_HOST y EMAIL_PORT (587 con STARTTLS o 465 con SSL), o un cortafuegos que bloquee la salida SMTP.';
  }
  if (/self.signed|certificate/i.test(msg)) {
    return 'Problema de certificado TLS. NO lo resuelva desactivando la validación: eso deja las notificaciones a merced de un intermediario.';
  }
  return msg;
}

try {
  await transporter.verify();
  console.log('✔ Conexión y autenticación CORRECTAS. El servidor acepta a este usuario.');
} catch (err) {
  // El encabezado dice lo que PASÓ, no lo que se estaba intentando: llamar
  // «fallo de autenticación» a un servidor inalcanzable manda a revisar la
  // contraseña durante media hora cuando el problema es el host.
  console.error(esFalloDeConexion(err)
    ? '⛔ No se pudo CONECTAR con el servidor (ni se llegó a autenticar).\n'
    : '⛔ El servidor RECHAZÓ la autenticación.\n');
  console.error(explicar(err));
  process.exit(2);
}

if (!destinatario) {
  console.log('\nNo se envió ningún mensaje (modo por defecto).');
  console.log('Para la prueba de extremo a extremo: --enviar-a <su-correo>');
  process.exit(0);
}

try {
  const info = await transporter.sendMail({
    from,
    to: destinatario,
    subject: 'Prueba de buzón — Ventanilla Única de Simacota',
    text: [
      'Este es un mensaje de PRUEBA del sistema de Ventanilla Única de Simacota.',
      '',
      'Si lo está leyendo, el buzón institucional puede enviar notificaciones a la ciudadanía.',
      '',
      'No corresponde a ningún trámite y no requiere respuesta.',
    ].join('\n'),
  });
  console.log(`✔ Mensaje ENTREGADO al servidor. id: ${info.messageId}`);
  if (info.rejected?.length) console.log(`  ⚠ rechazados: ${info.rejected.join(', ')}`);
  console.log('\nCompruebe la bandeja de entrada — y también la carpeta de correo no deseado:');
  console.log('si llega a spam, el problema ya no es el buzón sino la reputación del dominio.');
} catch (err) {
  console.error('⛔ Autenticó pero NO pudo enviar.\n');
  console.error(explicar(err));
  process.exit(3);
}
