'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

export interface ComprobanteProps {
  radicadoId: string;
  solicitanteNombre: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fechaRadicado: string;
  horaRadicado: string;
  medioRecepcion: string;
  tipoTramite: string;
  diasRespuesta: number;
  unidad: 'HABILES' | 'CALENDARIO';
  asunto: string;
  fechaVencimiento: string;
  funcionarioNombre: string;
  dependencia: string;
  numeroFolios?: number;
  /** Sprint Recepción fluida — anexos físicos entregados. */
  numeroAnexos?: number;
  /** Sprint Recepción fluida — medios entregados ("CD, USB"), si aplica. */
  mediosAnexos?: string | null;
  /** Sprint Ventanilla Operativa 2 — dato del solicitante para
   *  imprimir en la constancia. Solo se muestra si viene con valor
   *  no vacío. Si `noAportaCorreo === true`, el caller debe pasar
   *  null / undefined y este componente no lo renderiza. */
  correoSolicitante?: string | null;
  telefonoSolicitante?: string | null;
  /** Sprint Ventanilla Operativa 2 — canal de respuesta elegido. */
  canalRespuesta?: string | null;
  /** Sprint Ventanilla Operativa 2 — callback para el botón
   *  "Nuevo registro" (limpia state y vuelve al formulario). */
  onNuevoRegistro?: () => void;
  /** Sprint Ventanilla Operativa 2 — callback opcional para
   *  disparar el envío por correo. Si es null/undefined, el botón
   *  no se renderiza. */
  onEnviarCorreo?: () => Promise<void> | void;
  /** Sprint Ventanilla Operativa 2 — estado del envío por correo,
   *  controlado por el padre. */
  enviandoCorreo?: boolean;
  estadoEnvio?: 'idle' | 'enviando' | 'enviado' | 'error';
  mensajeEnvioError?: string | null;
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

import { formatFechaColombia, formatFechaHoraColombia } from '@/lib/fecha-colombia';

function formatFecha(iso: string): string {
  return formatFechaColombia(iso);
}

const MEDIO_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  EMAIL: 'Correo Electrónico',
  WEB: 'Portal Web',
  OFICIO_FISICO: 'Oficio Físico',
  OFICIO: 'Oficio',
};

const CANAL_RESPUESTA_LABEL: Record<string, string> = {
  CORREO: 'Correo electrónico',
  PRESENCIAL: 'Presencial',
  TELEFONO: 'Teléfono',
  DIRECCION_FISICA: 'Dirección física',
};

const TENANT_LABEL: Record<string, string> = {
  DESPACHO_ALCALDE: 'Despacho del Alcalde',
  SEC_GOBIERNO: 'Secretaría de Gobierno',
  SUB_INSPECCION_POLICIA_URBANA: 'Inspección de Policía Urbana',
  SUB_INSPECCION_POLICIA_RURAL: 'Inspección de Policía Rural',
  SUB_COMISARIA: 'Comisaría de Familia',
  SUB_VICTIMAS: 'Unidad de Víctimas',
  SEC_PLANEACION: 'Secretaría de Planeación',
  SUB_SISBEN: 'SISBEN',
  SUB_RIESGOS_GRD: 'Gestión del Riesgo (GRD)',
  SEC_DESARROLLO_SOCIAL: 'Desarrollo Social',
  SUB_PROGRAMAS: 'Subprogramas Sociales',
  SEC_HACIENDA: 'Secretaría de Hacienda',
  SUB_HACIENDA_YARIGUIES: 'Hacienda Yariguíes',
  SEC_AGRICULTURA_UMATA: 'UMATA / Agricultura',
  VENTANILLA_UNICA: 'Ventanilla Única',
};

/* ══════════════════════════════════════════════════════════════
   ESTILOS DE IMPRESIÓN (inyectados una sola vez via <style>)
══════════════════════════════════════════════════════════════ */

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #comprobante-ventanilla,
  #comprobante-ventanilla * { visibility: visible !important; }
  #comprobante-ventanilla {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    background: white !important;
    z-index: 99999 !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  @page {
    size: half-letter portrait;
    margin: 12mm 10mm;
  }
}
`;

/* ══════════════════════════════════════════════════════════════
   COMPONENTE
══════════════════════════════════════════════════════════════ */

export function ComprobanteRadicado({
  radicadoId,
  solicitanteNombre,
  numeroDocumento,
  tipoDocumento,
  fechaRadicado,
  horaRadicado,
  medioRecepcion,
  tipoTramite,
  diasRespuesta,
  unidad,
  asunto,
  fechaVencimiento,
  funcionarioNombre,
  dependencia,
  numeroFolios = 0,
  numeroAnexos = 0,
  mediosAnexos = null,
  correoSolicitante = null,
  telefonoSolicitante = null,
  canalRespuesta = null,
  onNuevoRegistro,
  onEnviarCorreo,
  enviandoCorreo = false,
  estadoEnvio = 'idle',
  mensajeEnvioError = null,
}: ComprobanteProps) {
  const stylesInjected = useRef(false);
  const [mostrarCopiado, setMostrarCopiado] = useState(false);

  function handleImprimir() {
    if (!stylesInjected.current) {
      const tag = document.createElement('style');
      tag.id = 'comprobante-print-styles';
      tag.textContent = PRINT_STYLES;
      document.head.appendChild(tag);
      stylesInjected.current = true;
    }
    window.print();
  }

  async function handleCopiarConsulta() {
    try {
      await navigator.clipboard.writeText(INSTITUCION.consultaUrl);
      setMostrarCopiado(true);
      setTimeout(() => setMostrarCopiado(false), 2000);
    } catch {
      // Sin fallback ruidoso: si clipboard falla, el usuario ve el link en pantalla.
    }
  }

  const puedeEnviarCorreo =
    typeof onEnviarCorreo === 'function' && Boolean(correoSolicitante);

  return (
    <div className="space-y-3">
      {/* Botones de acción (pantalla) */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          onClick={handleImprimir}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: '#14532D' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir constancia
        </button>

        {puedeEnviarCorreo && (
          <button
            onClick={() => { void onEnviarCorreo?.(); }}
            disabled={enviandoCorreo || estadoEnvio === 'enviado'}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: '#14532D', color: '#14532D', background: 'white' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {estadoEnvio === 'enviando' || enviandoCorreo
              ? 'Enviando…'
              : estadoEnvio === 'enviado'
                ? 'Enviada al solicitante ✓'
                : `Enviar por correo a ${correoSolicitante}`}
          </button>
        )}

        {onNuevoRegistro && (
          <button
            onClick={onNuevoRegistro}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all active:scale-95"
            style={{ borderColor: '#D9E2D9', color: '#667085', background: 'white' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            Nuevo registro
          </button>
        )}
      </div>

      {/* Mensaje de error de envío (pantalla) */}
      {estadoEnvio === 'error' && mensajeEnvioError && (
        <div
          role="alert"
          className="rounded-lg border px-3 py-2 text-xs print:hidden"
          style={{ borderColor: '#FECACA', background: '#FEF2F2', color: '#B91C1C' }}
        >
          {mensajeEnvioError}
        </div>
      )}

      {/* Comprobante imprimible */}
      <div
        id="comprobante-ventanilla"
        className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-5 font-mono text-xs text-gray-800"
      >
        {/* Encabezado con logo institucional */}
        <div className="mb-4 border-b border-dashed border-gray-300 pb-3">
          <div className="flex items-center justify-center gap-3">
            <Image
              src={INSTITUCION.logo}
              alt={`Escudo de la ${INSTITUCION.nombre}`}
              width={44}
              height={44}
              className="shrink-0"
              priority
            />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                {INSTITUCION.nombre}
              </p>
              <p className="text-[10px] text-gray-500">{INSTITUCION.sistema}</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700">
            Comprobante de Radicación
          </p>
        </div>

        {/* Número de radicado destacado */}
        <div className="mb-4 rounded-lg px-3 py-2 text-center" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: '#667085' }}>N.° de Radicado</p>
          <p className="text-lg font-bold tracking-widest" style={{ color: '#14532D' }}>{radicadoId}</p>
        </div>

        {/* Datos del radicado */}
        <table className="mb-3 w-full border-collapse text-[10px]">
          <tbody>
            <Row label="Fecha" value={formatFecha(fechaRadicado)} />
            <Row label="Hora" value={horaRadicado} />
            <Row label="Canal" value={MEDIO_LABEL[medioRecepcion] ?? medioRecepcion} />
            <Row label="Tipo de trámite" value={tipoTramite} />
            <Row label="Folios" value={String(numeroFolios)} />
            {numeroAnexos > 0 && (
              <Row
                label="Anexos"
                value={`${numeroAnexos}${mediosAnexos ? ` (${mediosAnexos})` : ''}`}
              />
            )}
            {canalRespuesta && (
              <Row
                label="Medio de respuesta"
                value={CANAL_RESPUESTA_LABEL[canalRespuesta] ?? canalRespuesta}
              />
            )}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-gray-300" />

        {/* Datos del solicitante */}
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-gray-500">
          Datos del solicitante
        </p>
        <table className="mb-3 w-full border-collapse text-[10px]">
          <tbody>
            <Row label="Nombre" value={solicitanteNombre} />
            <Row label={tipoDocumento} value={numeroDocumento} />
            {correoSolicitante && <Row label="Correo" value={correoSolicitante} />}
            {telefonoSolicitante && <Row label="Teléfono" value={telefonoSolicitante} />}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-gray-300" />

        {/* Asunto y plazos */}
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-gray-500">
          Asunto
        </p>
        <p className="mb-3 text-[10px] leading-tight text-gray-700">{asunto}</p>

        <table className="mb-3 w-full border-collapse text-[10px]">
          <tbody>
            <Row
              label="Plazo respuesta"
              value={`${diasRespuesta} días ${unidad === 'HABILES' ? 'hábiles' : 'calendario'}`}
            />
            <Row label="Fecha límite" value={formatFecha(fechaVencimiento)} />
            <Row label="Dependencia" value={TENANT_LABEL[dependencia] ?? dependencia} />
            <Row label="Funcionario" value={funcionarioNombre} />
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-gray-300" />

        {/* Consulta pública */}
        <div className="mb-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-gray-500">
            Consulta pública
          </p>
          <p className="mb-1 text-[10px] leading-tight text-gray-700">
            Consulte el estado en:{' '}
            <span className="break-all font-semibold" style={{ color: '#14532D' }}>
              {INSTITUCION.consultaUrl}
            </span>
          </p>
          <button
            onClick={handleCopiarConsulta}
            className="text-[9px] font-semibold uppercase tracking-widest print:hidden"
            style={{ color: '#166534' }}
            type="button"
          >
            {mostrarCopiado ? '✓ Copiado' : 'Copiar enlace'}
          </button>
        </div>

        <div className="my-2 border-t border-dashed border-gray-300" />

        {/* Pie */}
        <p className="text-center text-[9px] leading-tight text-gray-500">
          Este documento constituye acuse de recibo. Conserve este comprobante.
          Para seguimiento comuníquese al{' '}
          <span className="font-semibold">{INSTITUCION.telefono}</span> o al correo{' '}
          <span className="font-semibold">{INSTITUCION.correo}</span>.
        </p>
        <p className="mt-2 text-center text-[8px] text-gray-400">
          Generado: {formatFechaHoraColombia(new Date())}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILA DE TABLA INTERNA
══════════════════════════════════════════════════════════════ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="align-top">
      <td className="w-28 py-0.5 pr-2 font-semibold text-gray-500">{label}:</td>
      <td className="py-0.5 text-gray-800">{value}</td>
    </tr>
  );
}
