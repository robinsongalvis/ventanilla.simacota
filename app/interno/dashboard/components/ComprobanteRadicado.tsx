'use client';

import { useRef } from 'react';

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
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const MEDIO_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  EMAIL: 'Correo Electrónico',
  WEB: 'Portal Web',
  OFICIO_FISICO: 'Oficio Físico',
  OFICIO: 'Oficio',
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
}: ComprobanteProps) {
  const stylesInjected = useRef(false);

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

  return (
    <div className="space-y-3">
      {/* Botón visible solo en pantalla */}
      <button
        onClick={handleImprimir}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 print:hidden"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Imprimir Soporte
      </button>

      {/* Comprobante imprimible */}
      <div
        id="comprobante-ventanilla"
        className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-5 font-mono text-xs text-gray-800"
      >
        {/* Encabezado */}
        <div className="mb-4 border-b border-dashed border-gray-400 pb-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Alcaldía Municipal de Simacota
          </p>
          <p className="text-[10px] text-gray-400">Ventanilla Única de Atención al Ciudadano</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">
            Comprobante de Radicación
          </p>
        </div>

        {/* Número de radicado destacado */}
        <div className="mb-4 rounded border border-gray-800 bg-gray-50 px-3 py-2 text-center">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">N.° de Radicado</p>
          <p className="text-lg font-bold tracking-widest text-gray-900">{radicadoId}</p>
        </div>

        {/* Datos del radicado */}
        <table className="mb-3 w-full border-collapse text-[10px]">
          <tbody>
            <Row label="Fecha" value={formatFecha(fechaRadicado)} />
            <Row label="Hora" value={horaRadicado} />
            <Row label="Canal" value={MEDIO_LABEL[medioRecepcion] ?? medioRecepcion} />
            <Row label="Tipo de trámite" value={tipoTramite} />
            <Row label="Folios" value={String(numeroFolios)} />
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

        {/* Pie */}
        <p className="text-center text-[9px] leading-tight text-gray-500">
          Conserve este comprobante. Para seguimiento comuníquese al{' '}
          <span className="font-semibold">PBX 7267100</span> o al correo{' '}
          <span className="font-semibold">ventanilla@simacota-boyaca.gov.co</span>
        </p>
        <p className="mt-2 text-center text-[8px] text-gray-400">
          Generado: {new Date().toLocaleString('es-CO')}
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
