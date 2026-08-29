import { INSTITUCION } from '@/lib/institucion';
import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   LA CONSTANCIA QUE EL CIUDADANO SE LLEVA EN LA MANO.

   El patrón es el de ventanilla: cuando se radica, se imprime un comprobante
   con el número. Aquí igual — cuando la funcionaria declara la radicación en
   legal y debida forma, queda este papel con el número del libro.

   ── POR QUÉ ES UN DOCUMENTO APARTE, Y NO UNA PÁGINA DEL EXPEDIENTE ───────

   Decisión tomada al construirlo. La constancia acredita un HECHO DE UNA
   FECHA: que ese día, con esos documentos, la Alcaldía declaró radicada la
   solicitud. Si viviera dentro del PDF del expediente, cada reimpresión
   traería el expediente tal como esté ESE día — y el papel dejaría de ser
   constancia de un momento para volverse una foto del presente. Un ciudadano
   que reimprime su constancia en noviembre debe recibir exactamente el mismo
   papel que se llevó en agosto.

   Por eso se construye SOLO a partir de lo que quedó escrito en la actuación
   de radicación, que es append-only: el mismo insumo produce siempre el mismo
   papel. Esta función es PURA — no lee la base de datos, no consulta el estado
   actual del expediente, no sabe qué día es hoy.

   ── LO QUE AFIRMA, Y LO QUE NO ───────────────────────────────────────────

   AFIRMA: que la solicitud quedó radicada en legal y debida forma, con qué
   número, desde qué día corre el plazo y cuándo vence. Los cuatro son hechos
   que ocurrieron y constan.

   NO AFIRMA: nada sobre el desenlace del trámite. No es una licencia, no
   anticipa una decisión, y lo dice.

   PROHIBIDO mencionar el silencio administrativo positivo — misma condición
   que rige las demás comunicaciones al ciudadano en este módulo.
══════════════════════════════════════════════════════════════ */

export interface ConstanciaRadicacionLicenciaParams {
  /** El número del libro de ventanilla, en forma canónica. El que vale. */
  numeroRadicado: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  tipoDocumento: string;
  /** P. ej. "licencia de construcción — obra nueva". */
  descripcionTramite: string;
  /** ISO — día desde el que corre el plazo (el ancla). */
  desdeCuandoCorreElPlazo: string;
  /** ISO — fecha de vencimiento proyectada (la conservadora). `null` si no se pudo proyectar. */
  venceEl: string | null;
  /** Cuántos requisitos aplicaban al caso y se verificaron. */
  requisitosVerificados: number;
  /** Quién declaró la radicación. Consta en el papel: el acto tiene autor. */
  funcionarioNombre: string;
  /** ISO — instante en que se expidió esta constancia (= la radicación). */
  expedidaEn: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Nombre del archivo cuando se descarga o se guarda. */
export function nombreArchivoConstancia(numeroRadicado: string): string {
  return `constancia-radicacion-${numeroRadicado}.html`;
}

/**
 * Documento imprimible, autocontenido y sin dependencias externas.
 *
 * Se entrega como HTML con estilos de impresión —no como PDF— por la misma
 * razón que el comprobante de ventanilla: la funcionaria lo abre y pulsa
 * imprimir, sin instalar nada y sin que el servidor tenga que componer un PDF.
 * El navegador ya sabe hacerlo, y el resultado en papel es el mismo.
 */
export function buildConstanciaRadicacionLicenciaHtml(p: ConstanciaRadicacionLicenciaParams): string {
  const desde = formatFechaLargaColombia(p.desdeCuandoCorreElPlazo);
  const vence = p.venceEl ? formatFechaLargaColombia(p.venceEl) : null;
  const expedida = formatFechaLargaColombia(p.expedidaEn);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Constancia de radicación · ${escapeHtml(p.numeroRadicado)}</title>
<style>
  :root{ --tinta:#16201A; --suave:#4C5952; --verde:#14532D; --linea:#DFE4DA; }
  *{box-sizing:border-box}
  body{
    margin:0; padding:2rem 1.25rem; background:#FBFAF7; color:var(--tinta);
    font-family:Georgia,"Times New Roman",serif; font-size:16px; line-height:1.6;
  }
  .hoja{max-width:70ch;margin:0 auto;background:#fff;border:1px solid var(--linea);padding:2.25rem 2rem}
  .rotulo{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    font-size:.66rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--suave);margin:0;
  }
  h1{font-size:1.5rem;margin:.5rem 0 0;letter-spacing:-.01em;color:var(--verde)}
  header{border-bottom:3px double var(--linea);padding-bottom:1.1rem;margin-bottom:1.4rem}
  .numero{
    border:2px solid var(--verde);border-radius:4px;padding:.9rem 1.1rem;margin:1.2rem 0;
    text-align:center;
  }
  .numero .rotulo{color:var(--verde)}
  .numero strong{
    display:block;margin-top:.3rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
    font-size:1.5rem;letter-spacing:.02em;font-variant-numeric:tabular-nums;
  }
  table{width:100%;border-collapse:collapse;font-size:.94rem;margin:1.1rem 0}
  td{padding:.35rem 0;vertical-align:top}
  td:first-child{color:var(--suave);width:14rem}
  .plazo{background:#F4F8F4;border-left:3px solid var(--verde);padding:.9rem 1.1rem;margin:1.2rem 0;font-size:.95rem}
  .plazo strong{color:var(--verde)}
  footer{border-top:1px solid var(--linea);margin-top:1.6rem;padding-top:1rem;font-size:.78rem;color:var(--suave);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.55}
  .imprimir{
    display:block;margin:1.5rem auto 0;padding:.6rem 1.4rem;font-size:.9rem;cursor:pointer;
    background:var(--verde);color:#fff;border:0;border-radius:4px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  }
  @media print{
    body{background:#fff;padding:0;font-size:11.5pt}
    .hoja{border:0;max-width:none;padding:0}
    .imprimir{display:none}
  }
</style>
</head>
<body>
<div class="hoja">

  <header>
    <p class="rotulo">${escapeHtml(INSTITUCION.nombre)} · Secretaría de Planeación</p>
    <h1>Constancia de radicación en legal y debida forma</h1>
  </header>

  <p>
    La Secretaría de Planeación hace constar que la solicitud de
    <strong>${escapeHtml(p.descripcionTramite)}</strong> presentada por
    <strong>${escapeHtml(p.solicitanteNombre)}</strong>
    (${escapeHtml(p.tipoDocumento)} ${escapeHtml(p.solicitanteDocumento)})
    quedó <strong>radicada en legal y debida forma</strong>, una vez verificada
    la totalidad de la documentación exigida.
  </p>

  <div class="numero">
    <p class="rotulo">Número de radicado</p>
    <strong>${escapeHtml(p.numeroRadicado)}</strong>
  </div>

  <table>
    <tr><td>Solicitante</td><td>${escapeHtml(p.solicitanteNombre)}</td></tr>
    <tr><td>Documento</td><td>${escapeHtml(p.tipoDocumento)} ${escapeHtml(p.solicitanteDocumento)}</td></tr>
    <tr><td>Trámite</td><td>${escapeHtml(p.descripcionTramite)}</td></tr>
    <tr><td>Requisitos verificados</td><td>${p.requisitosVerificados}</td></tr>
    <tr><td>Declarada por</td><td>${escapeHtml(p.funcionarioNombre)}</td></tr>
    <tr><td>Fecha de expedición</td><td>${escapeHtml(expedida)}</td></tr>
  </table>

  <div class="plazo">
    <p style="margin:0">
      El término legal para resolver <strong>corre desde el ${escapeHtml(desde)}</strong>
      ${vence ? `y vence el <strong>${escapeHtml(vence)}</strong>` : ''}
      (cuarenta y cinco días hábiles, artículo 2.2.6.1.2.3.1 del Decreto 1077 de 2015).
      Ese término puede suspenderse o prorrogarse en los casos que la ley prevé; si ocurre,
      se le comunicará.
    </p>
  </div>

  <p style="font-size:.93rem">
    Esta constancia acredita la radicación de la solicitud. <strong>No constituye la licencia
    ni anticipa la decisión</strong> que la Secretaría adopte sobre ella.
  </p>

  <footer>
    ${escapeHtml(INSTITUCION.nombre)} · ${escapeHtml(INSTITUCION.municipio)}, ${escapeHtml(INSTITUCION.departamento)}<br/>
    Documento generado automáticamente el día de la radicación. Conserve el número
    <strong>${escapeHtml(p.numeroRadicado)}</strong> para cualquier consulta.
  </footer>

  <button class="imprimir" onclick="window.print()">Imprimir constancia</button>
</div>
</body>
</html>`;
}
