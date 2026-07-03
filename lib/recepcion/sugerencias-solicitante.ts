import type { TipoDocumento, VentanillaRadicado } from '@/src/types/ventanilla';

/**
 * Sprint Solicitante frecuente — directorio de ciudadanos que ya han
 * radicado, para autocompletar la Radicación Rápida.
 *
 * Se deriva de los radicados que YA están en memoria (onSnapshot del
 * dashboard): cero lecturas nuevas, cero colecciones nuevas, y el pool
 * hereda el alcance por rol del hook. El sistema sugiere; la
 * funcionaria selecciona y verifica — nunca se autollena.
 *
 * Protecciones (parámetros aprobados):
 *  - anónimos, identidad reservada y tipoPresentacion ≠ IDENTIFICADA se
 *    excluyen al construir el directorio (no es un filtro de UI);
 *  - dedupe por número de documento; el radicado MÁS RECIENTE manda;
 *  - LIMITACIÓN v1: sin número de documento no entran al directorio;
 *  - las marcas datosNoAportados NO se copian (son por-radicación);
 *  - en el dropdown el documento va enmascarado ("CC ····1226").
 *
 * Funciones puras: sin React, sin Firestore.
 */

export interface SolicitanteConocido {
  nombreCompleto:       string;
  tipoDocumento:        TipoDocumento;
  numeroDocumento:      string;
  /** Para el dropdown: "CC ····1226" — el dato completo solo se llena al seleccionar. */
  documentoEnmascarado: string;
  email:                string | null;
  telefonoMovil:        string | null;
  telefonoFijo:         string | null;
  direccion:            string | null;
  /** ISO de la radicación más reciente que aportó estos datos. */
  ultimaRadicacion:     string;
  /** Nombre sin tildes y en minúsculas, precalculado para buscar. */
  nombreNormalizado:    string;
}

export const MIN_CONSULTA = 3;
export const MAX_SUGERENCIAS = 5;

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** "CC ····1226" — solo los últimos 4 dígitos visibles en pantalla. */
export function enmascararDocumento(tipoDocumento: string, numeroDocumento: string): string {
  return `${tipoDocumento} ····${numeroDocumento.slice(-4)}`;
}

function esIdentificado(r: VentanillaRadicado): boolean {
  if (r.esAnonimo === true || r.identidadReservada === true) return false;
  // Ausente = identificada (radicados históricos previos al campo).
  return !r.tipoPresentacion || r.tipoPresentacion === 'IDENTIFICADA';
}

export function construirDirectorio(radicados: VentanillaRadicado[]): SolicitanteConocido[] {
  const porDocumento = new Map<string, { fila: SolicitanteConocido; fechaMs: number }>();

  for (const r of radicados) {
    if (!esIdentificado(r)) continue;

    const s = r.solicitante;
    const doc = (s?.numeroDocumento ?? '').trim();
    // Limitación v1: el dedupe es por documento; sin él no hay entrada.
    if (!doc || !s.nombreCompleto?.trim()) continue;

    const fechaIso = r.control?.fechaRadicado ?? '';
    const ms = new Date(fechaIso).getTime();
    const fechaMs = Number.isNaN(ms) ? 0 : ms;

    const previo = porDocumento.get(doc);
    if (previo && previo.fechaMs >= fechaMs) continue;

    porDocumento.set(doc, {
      fechaMs,
      fila: {
        nombreCompleto:       s.nombreCompleto,
        tipoDocumento:        s.tipoDocumento,
        numeroDocumento:      doc,
        documentoEnmascarado: enmascararDocumento(s.tipoDocumento, doc),
        email:                s.email ?? null,
        // El campo legacy `telefono` alimenta el móvil como fallback.
        telefonoMovil:        s.telefonoMovil ?? s.telefono ?? null,
        telefonoFijo:         s.telefonoFijo ?? null,
        direccion:            s.direccion ?? null,
        ultimaRadicacion:     fechaIso,
        nombreNormalizado:    normalizar(s.nombreCompleto),
      },
    });
  }

  return [...porDocumento.values()].map((v) => v.fila);
}

/**
 * Coincidencias para el dropdown: por nombre (sin tildes, subcadena) o
 * por prefijo del documento. Vacío bajo 3 caracteres; máximo 5.
 */
export function buscarSolicitantes(
  directorio: SolicitanteConocido[],
  consulta: string,
): SolicitanteConocido[] {
  const q = consulta.trim();
  if (q.length < MIN_CONSULTA) return [];

  const qDoc = q.toLowerCase();
  const qNombre = normalizar(q);

  return directorio
    .filter((s) =>
      s.numeroDocumento.toLowerCase().startsWith(qDoc)
      || s.nombreNormalizado.includes(qNombre))
    .slice(0, MAX_SUGERENCIAS);
}
