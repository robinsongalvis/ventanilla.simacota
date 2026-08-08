/**
 * Presentación del Libro Consecutivo — Bloque C ("el reemplazo del
 * Excel"). Funciones PURAS de mapeo/orden/exportación, sin fetch ni React:
 * `LibroConsecutivoClient.tsx` es el único caller, pero viven aparte para
 * que el generador de CSV (el dato más sensible: es lo que reemplaza el
 * archivo operativo real del ingeniero) se pueda probar con datos
 * sintéticos sin montar el componente — mismo patrón de extracción que
 * `presentacion-actuaciones.ts`/`presentacion-subtipos.ts`.
 *
 * Fuente del contrato de columnas: `docs/planes/
 * ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` (H1, glosario §10). El Excel
 * real de Planeación lleva: fecha solicitud, fecha resolución, No.
 * radicado (=numeroExpediente), propietario/solicitante, tipo de licencia,
 * No. de licencia, estado, correcciones — este módulo mapea esas mismas
 * columnas a los campos REALES que ya expone `GET /api/licencias/
 * expedientes` (`ExpedienteLicenciaDoc`), sin inventar ninguno que el
 * motor no tenga todavía (fecha de resolución/No. de licencia: H5, 0/202
 * llenos hoy — se muestran honestos como "—", nunca "TBD" ni una fecha
 * calculada).
 */

import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { ESTILOS_ESTADO_JURIDICO } from './estilos-estado-juridico';
import { nombreSubtipo } from './presentacion-subtipos';
import { formatFechaColombia, safeDate, TIMEZONE_COLOMBIA } from '@/lib/fecha-colombia';

/** Fila de presentación del Libro Consecutivo — una por expediente. */
export interface FilaLibroConsecutivo {
  id: string;
  /** Texto ya formateado (mono en pantalla) — `numeroExpediente.numero` o, a falta de él, el id del documento. */
  numeroExpediente: string;
  /** ISO 8601 — `creadoEn` del expediente (fecha de radicación en debida forma, no de recepción material — RN-6). */
  fechaRadicacion: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  /** Nombres legibles de los subtipos declarados, en el orden del expediente — p. ej. `['Licencia de construcción']`. */
  subtipos: string[];
  estadoJuridico: EstadoJuridicoLicencia;
  /** `actoFinal.numero` — `null` si el expediente aún no cierra (H5: hoy la норма, no la excepción). */
  numeroLicencia: string | null;
  /** ISO 8601 de `actoFinal.fechaFirmeza` — `null` si no hay (DF-6: dispara vigencias, casi siempre ausente hoy). */
  fechaFirmeza: string | null;
  esPrueba: boolean;
}

/**
 * Año (calendario Colombia, `America/Bogota`) en que un expediente se
 * radicó — deriva el selector de año del Libro a partir del dato real
 * (`creadoEn`), nunca de un campo `año` separado que pudiera desincronizarse.
 * `null` si `creadoEn` no es una fecha válida (dato corrupto: se excluye
 * del conteo por año en vez de agruparlo bajo un año inventado).
 */
export function añoRadicacionColombia(creadoEn: string): number | null {
  const fecha = safeDate(creadoEn);
  if (!fecha) return null;
  const texto = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_COLOMBIA, year: 'numeric' }).format(fecha);
  const año = Number(texto);
  return Number.isFinite(año) ? año : null;
}

/**
 * Años seleccionables del libro: los que tienen al menos un expediente,
 * más el año en curso (aunque todavía no tenga expedientes — el selector
 * siempre debe poder mostrar "Sin expedientes en {año actual}" el primer
 * día del año). Orden descendente (el año más reciente primero).
 */
export function añosDisponiblesLibro(
  expedientes: readonly Pick<ExpedienteLicenciaDoc, 'creadoEn'>[],
  añoActual: number = new Date().getFullYear(),
): number[] {
  const años = new Set<number>([añoActual]);
  for (const exp of expedientes) {
    const año = añoRadicacionColombia(exp.creadoEn);
    if (año !== null) años.add(año);
  }
  return [...años].sort((a, b) => b - a);
}

function numeroExpedienteTexto(exp: ExpedienteLicenciaDoc): string {
  return exp.numeroExpediente?.numero ?? exp.id;
}

/**
 * Filas del Libro para UN año: filtra por `año` (RN Excel: "una hoja por
 * año") y ordena ASCENDENTE por número de expediente — el orden físico de
 * un libro consecutivo, folio 1 primero. `localeCompare` con `numeric:
 * true` para que el consecutivo de 4 dígitos ordene correctamente incluso
 * si algún día conviven longitudes distintas (p. ej. el prefijo `DEMO-`).
 */
export function construirFilasLibroConsecutivo(
  expedientes: readonly ExpedienteLicenciaDoc[],
  año: number,
): FilaLibroConsecutivo[] {
  return expedientes
    .filter((exp) => añoRadicacionColombia(exp.creadoEn) === año)
    .map((exp) => ({
      id: exp.id,
      numeroExpediente: numeroExpedienteTexto(exp),
      fechaRadicacion: exp.creadoEn,
      solicitanteNombre: exp.solicitanteNombre,
      solicitanteDocumento: exp.solicitanteDocumento,
      subtipos: (exp.subtipos ?? []).map(nombreSubtipo),
      estadoJuridico: exp.estadoJuridico,
      numeroLicencia: exp.actoFinal?.numero ?? null,
      fechaFirmeza: exp.actoFinal?.fechaFirmeza ?? null,
      esPrueba: exp.esPrueba === true,
    }))
    .sort((a, b) => a.numeroExpediente.localeCompare(b.numeroExpediente, 'es', { numeric: true }));
}

/** Nombre de archivo del CSV exportado — `libro-consecutivo-licencias-{año}.csv`. */
export function nombreArchivoCsvLibroConsecutivo(año: number): string {
  return `libro-consecutivo-licencias-${año}.csv`;
}

const ENCABEZADOS_CSV = [
  'N. EXPEDIENTE',
  'FECHA RADICACION',
  'SOLICITANTE',
  'DOCUMENTO',
  'SUBTIPOS',
  'ESTADO JURIDICO',
  'N. LICENCIA',
  'FECHA FIRMEZA',
  'PRUEBA',
] as const;

/**
 * Escapa UN campo para CSV separado por `;` (estándar regional es-CO, el
 * que Excel abre sin pedir "convertir texto en columnas"). Se citan los
 * campos que contienen el separador, comillas o salto de línea — el resto
 * queda tal cual, más legible al abrir el archivo en un editor de texto.
 */
function celdaCsv(valor: string): string {
  if (/[;"\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/**
 * Genera el texto completo del CSV del Libro Consecutivo — FUNCIÓN PURA
 * (sin `Blob`/`URL.createObjectURL`: eso es responsabilidad del
 * componente, esto solo arma texto). Recibe las filas YA filtradas por año
 * (`construirFilasLibroConsecutivo`) — el año en sí solo lo necesita el
 * nombre del archivo (`nombreArchivoCsvLibroConsecutivo`), no el contenido.
 * Mismas columnas que la tabla en pantalla, más `PRUEBA` en texto plano
 * (el chip de pantalla no sobrevive a un CSV) — ver JSDoc del módulo.
 *
 * BOM (`﻿`) al inicio: sin él, Excel en Windows abre el archivo
 * asumiendo Latin-1 y corrompe tildes/eñes de los nombres de solicitantes.
 * Separador `;` y salto de línea `\r\n`: convención regional es-CO/Excel.
 */
export function generarCsvLibroConsecutivo(filas: readonly FilaLibroConsecutivo[]): string {
  const encabezado = ENCABEZADOS_CSV.join(';');
  const filasTexto = filas.map((f) => {
    const celdas = [
      f.numeroExpediente,
      formatFechaColombia(f.fechaRadicacion),
      f.solicitanteNombre,
      f.solicitanteDocumento,
      f.subtipos.join(', '),
      ESTILOS_ESTADO_JURIDICO[f.estadoJuridico].label,
      f.numeroLicencia ?? '—',
      f.fechaFirmeza ? formatFechaColombia(f.fechaFirmeza) : '—',
      f.esPrueba ? 'SI' : 'NO',
    ];
    return celdas.map(celdaCsv).join(';');
  });
  return '﻿' + [encabezado, ...filasTexto].join('\r\n');
}
