import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { calcularSemaforo } from '@/app/interno/dashboard/components/mipg/SemaforoTermino';
import { nombreSolicitanteVisible, numeroDocumentoVisible } from '@/lib/seguridad/identidad-protegida';

/* ══════════════════════════════════════════════════════════════
   Exportaciones MIPG — CSV técnico (lo filtrado en pantalla) y Excel
   institucional (histórico, generado en el servidor con el alcance del rol).

   Ola 3 (ADR-0046): trasladadas SIN cambios desde
   `app/interno/dashboard/page.tsx`. Las usan Reportes y la búsqueda
   avanzada del panel; vivir aquí evita duplicarlas.
══════════════════════════════════════════════════════════════ */

/* ── Helper: exportación CSV MIPG ──────────────────────────────
   14 columnas que cubren los 8 requisitos MIPG de trazabilidad.
   BOM UTF-8 (﻿) para que Excel colombiano abra tildes y ñ sin problemas.
─────────────────────────────────────────────────────────────── */
export function exportarCSVMIPG(radicados: VentanillaRadicado[]): void {
  const headers = [
    'N° Radicado',                    // Req 1 (identificación)
    'Fecha Radicación',               // Req 1
    'Hora Radicación',                // Req 1
    'Medio Recepción',                // Req 1
    'Solicitante',                    // contexto ciudadano
    'Documento',                      // identificación
    'Tipo Solicitud',                 // clasificación MIPG
    'Forma Presentación PQRSD',
    'Solicitud Anónima',
    'Identidad Reservada',
    'Canal Respuesta',
    'Dependencia Asignada',           // Req 2
    // Req 3 — Responsable funcional (MIPG-2)
    'Responsable UID',
    'Responsable Nombre',
    'Responsable Email',
    'Responsable Rol',
    'Responsable Cargo',
    'Fecha Asignación Responsable',
    'Estado Actual',                  // ciclo de vida
    'Respuesta',                      // Req 4 (primeros 300 chars)
    'Fecha Respuesta',                // Req 5
    'Oficio Adjunto',                 // Req 6
    'Fecha Vencimiento',              // Req 8 (término legal)
    'Días Restantes',                 // MIPG-3: calculado en tiempo de exportación
    'Estado Término',                 // MIPG-3: EN_TERMINO | POR_VENCER | VENCIDO | RESUELTO
    'Días Vencido',                   // MIPG-3: solo cuando < 0
    'Prórrogas Aplicadas',            // Req 8
    'Cumplió Término MIPG',          // Req 8 — dato auditoriable
    'Trazabilidad',                   // Req 7 — confirmación de subcollección
  ];

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = radicados.map((r) => { const sem = calcularSemaforo(r); return [
    r.radicadoId,
    r.control.fechaRadicado,
    r.control.horaRadicado,
    r.control.medioRecepcion,
    nombreSolicitanteVisible(r, r.solicitante.nombreCompleto),
    numeroDocumentoVisible(r, r.solicitante.numeroDocumento),
    r.termino.tipoSolicitudNombre,
    r.tipoPresentacion ?? (r.esAnonimo ? 'ANONIMA' : 'IDENTIFICADA'),
    r.esAnonimo ? 'Sí' : 'No',
    r.identidadReservada ? 'Sí' : 'No',
    r.canalRespuesta ?? 'No registrado',
    NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino,
    // Req 3 — MIPG-2: responsable funcional con backward compat
    r.clasificacion.funcionarioResponsableUid    ?? '—',
    r.clasificacion.funcionarioResponsableNombre ?? 'No registrado (ver trazabilidad)',
    r.clasificacion.funcionarioResponsableEmail  ?? '—',
    r.clasificacion.funcionarioResponsableRol    ?? '—',
    r.clasificacion.funcionarioResponsableCargo  ?? '—',
    r.clasificacion.fechaAsignacionResponsable   ?? '—',
    r.estadoActual,
    (r.respuestaOficial?.nota ?? '—').substring(0, 300),
    r.respuestaOficial?.fecha ?? '—',
    r.respuestaOficial?.archivoNombre ? `Sí — ${r.respuestaOficial.archivoNombre}` : 'No',
    r.termino.fechaVencimiento,
    String(sem.diasRestantes),
    sem.estado,
    sem.diasRestantes < 0 ? String(Math.abs(sem.diasRestantes)) : '0',
    String(r.termino.prorrogasAplicadas ?? 0),
    r.cumplioTermino === true  ? 'Sí — dentro del término' :
    r.cumplioTermino === false ? 'No — fuera del término'  : 'Pendiente',
    'Ver subcollección trazabilidad en Firebase',
  ].map(esc).join(','); });

  const csv = [headers.map(esc).join(','), ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `MIPG_Radicados_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function descargarExcelMipg(filtros?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const hayFiltros = filtros && Object.values(filtros).some((v) => v !== '' && v !== null && v !== undefined);
    const res = await fetch('/api/reportes/mipg/excel', {
      method: 'POST',
      credentials: 'include',
      ...(hayFiltros
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filtros }) }
        : {}),
    });
    if (!res.ok) {
      // Lee como texto y trata de parsear JSON si aplica. Si el server
      // devolvió HTML (p. ej. 500 sin handler) lo muestra recortado.
      const raw = await res.text().catch(() => '');
      let parsed: { error?: string; detalle?: string } | null = null;
      try { parsed = JSON.parse(raw) as { error?: string; detalle?: string }; } catch { /* no-json */ }
      const msg = parsed?.detalle
        ? `${parsed.error ?? 'Error'} (${parsed.detalle})`
        : parsed?.error ?? raw.slice(0, 200) ?? `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    // Verifica Content-Type antes de descargar para no entregar un HTML
    // como si fuera xlsx.
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('spreadsheetml')) {
      return { ok: false, error: `Respuesta inesperada del servidor (content-type: ${ct || 'desconocido'}). Revise logs del backend.` };
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      return { ok: false, error: 'El servidor devolvió un archivo vacío. Revise logs del backend.' };
    }
    const cd = res.headers.get('content-disposition') ?? '';
    const m  = cd.match(/filename="([^"]+)"/);
    const filename = m?.[1] ?? `Reporte_MIPG_Simacota_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
