/**
 * lib/constancias/constancia-ejecutoria.ts
 *
 * LA CONSTANCIA DE EJECUTORIA. Puro: recibe los hechos de la cadena de cierre y
 * devuelve el documento. No lee Firestore ni calcula plazos por su cuenta.
 *
 * Es el documento que el sistema tiene que poder sustentar —el modelo es el
 * acta real que Planeación tiene de archivo— y por eso se DERIVA de las
 * actuaciones, no se redacta a mano: cada dato que afirma está respaldado por
 * un acto registrado con su fecha y su actor.
 *
 * ── SE NIEGA A EMITIRSE SI LA CADENA NO ESTÁ COMPLETA ─────────────────────
 *
 * Una constancia de ejecutoria afirma que un acto está en firme. Emitirla con
 * la cadena a medias sería certificar un hecho que no consta — el mismo defecto
 * que la constancia de radicación evita negándose cuando no hay actuación.
 */

export interface HechosEjecutoria {
  numeroExpediente: string;
  solicitanteNombre: string;
  /** Qué decidió el acto: concedida, negada o archivada por desistimiento. */
  sentido: 'CONCEDIDA' | 'NEGADA' | 'DESISTIDA';
  numeroResolucion: string;
  fechaResolucion: string;
  fechaNotificacion: string;
  modoNotificacion: 'PERSONAL' | 'AVISO' | 'ELECTRONICA';
  motivoFirmeza: 'PLAZO_VENCIDO_SIN_RECURSOS' | 'RECURSOS_RESUELTOS' | 'RENUNCIA_EXPRESA';
  fechaFirmeza: string;
  funcionarioNombre: string;
  expedidaEn: string;
}

const SENTIDO: Record<HechosEjecutoria['sentido'], string> = {
  CONCEDIDA: 'concedió la licencia solicitada',
  NEGADA: 'negó la licencia solicitada',
  DESISTIDA: 'declaró el desistimiento y ordenó el archivo de la solicitud',
};

const MODO: Record<HechosEjecutoria['modoNotificacion'], string> = {
  PERSONAL: 'personalmente',
  AVISO: 'por aviso',
  ELECTRONICA: 'por medio electrónico aceptado por el interesado',
};

/**
 * El motivo se dice CON SU FUNDAMENTO. Una constancia que afirma la firmeza sin
 * decir por cuál de los tres caminos del art. 87 llegó no se puede contrastar.
 */
const MOTIVO: Record<HechosEjecutoria['motivoFirmeza'], string> = {
  PLAZO_VENCIDO_SIN_RECURSOS:
    'por haber transcurrido el término para interponer recursos sin que se hubiere interpuesto ' +
    'alguno (Ley 1437 de 2011, art. 87, numeral 1)',
  RECURSOS_RESUELTOS:
    'por haberse resuelto los recursos interpuestos (Ley 1437 de 2011, art. 87, numeral 2)',
  RENUNCIA_EXPRESA:
    'por renuncia expresa del interesado al término de ejecutoria (Ley 1437 de 2011, art. 87, numeral 3)',
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildConstanciaEjecutoriaHtml(h: HechosEjecutoria): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Constancia de ejecutoria — ${escapeHtml(h.numeroExpediente)}</title>
<style>
  @page { size: letter; margin: 2.5cm; }
  @media print { .no-imprimir { display: none; } }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1F2933; line-height: 1.6; max-width: 18cm; margin: 0 auto; padding: 1cm; }
  .encabezado { text-align: center; border-bottom: 2px solid #14532D; padding-bottom: 12px; margin-bottom: 28px; }
  .encabezado p { margin: 2px 0; }
  .entidad { font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: #14532D; }
  h1 { font-size: 16px; text-align: center; letter-spacing: 2px; text-transform: uppercase; margin: 28px 0; }
  .cuerpo p { text-align: justify; margin: 0 0 14px; }
  .numero { font-family: 'Courier New', monospace; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 22px 0; font-size: 13px; }
  td { border-bottom: 1px solid #D9E2D9; padding: 7px 4px; vertical-align: top; }
  td:first-child { width: 38%; color: #5A6B5D; }
  .firma { margin-top: 56px; }
  .firma .linea { border-top: 1px solid #1F2933; width: 62%; padding-top: 5px; }
  .pie { margin-top: 32px; font-size: 11px; color: #5A6B5D; border-top: 1px solid #D9E2D9; padding-top: 10px; }
</style>
</head>
<body>
  <div class="encabezado">
    <p class="entidad">Alcaldía Municipal de Simacota</p>
    <p class="entidad">Secretaría de Planeación</p>
  </div>

  <h1>Constancia de ejecutoria</h1>

  <div class="cuerpo">
    <p>
      La Secretaría de Planeación del Municipio de Simacota <strong>HACE CONSTAR</strong> que la
      Resolución <span class="numero">${escapeHtml(h.numeroResolucion)}</span> del
      ${escapeHtml(fecha(h.fechaResolucion))}, por la cual se
      ${escapeHtml(SENTIDO[h.sentido])} dentro del expediente
      <span class="numero">${escapeHtml(h.numeroExpediente)}</span>, presentado por
      <strong>${escapeHtml(h.solicitanteNombre)}</strong>, fue notificada
      ${escapeHtml(MODO[h.modoNotificacion])} el ${escapeHtml(fecha(h.fechaNotificacion))}.
    </p>
    <p>
      El referido acto administrativo se encuentra <strong>EN FIRME</strong> desde el
      ${escapeHtml(fecha(h.fechaFirmeza))}, ${escapeHtml(MOTIVO[h.motivoFirmeza])}.
    </p>

    <table>
      <tr><td>Expediente</td><td class="numero">${escapeHtml(h.numeroExpediente)}</td></tr>
      <tr><td>Solicitante</td><td>${escapeHtml(h.solicitanteNombre)}</td></tr>
      <tr><td>Resolución</td><td class="numero">${escapeHtml(h.numeroResolucion)}</td></tr>
      <tr><td>Fecha de la resolución</td><td>${escapeHtml(fecha(h.fechaResolucion))}</td></tr>
      <tr><td>Fecha de notificación</td><td>${escapeHtml(fecha(h.fechaNotificacion))}</td></tr>
      <tr><td>En firme desde</td><td>${escapeHtml(fecha(h.fechaFirmeza))}</td></tr>
    </table>

    <p>
      Se expide la presente constancia el ${escapeHtml(fecha(h.expedidaEn))}, a solicitud del
      interesado.
    </p>
  </div>

  <div class="firma">
    <div class="linea">
      <strong>${escapeHtml(h.funcionarioNombre)}</strong><br/>
      Secretaría de Planeación · Alcaldía Municipal de Simacota
    </div>
  </div>

  <p class="pie">
    Documento generado por la Ventanilla Única Digital a partir de las actuaciones registradas en el
    expediente. Cada hecho aquí certificado corresponde a un acto con su fecha y su responsable.
  </p>
</body>
</html>`;
}
