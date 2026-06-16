/* ══════════════════════════════════════════════════════════════
   Cliente para reclasificar el tipo de solicitud de un radicado.
   Solo disponible para RECEPCIONISTA y ADMIN.
══════════════════════════════════════════════════════════════ */

export interface ReclasificarTipoSolicitudInput {
  radicadoId: string;
  tipoSolicitudId: string;
  motivo?: string;
}

export interface ReclasificarTipoSolicitudResultado {
  ok: true;
  radicadoId: string;
  tipoAnteriorId?: string;
  tipoAnteriorNombre?: string;
  tipoNuevoId: string;
  tipoNuevoNombre: string;
  diasRespuesta: number;
  unidad: 'HABILES' | 'CALENDARIO';
  fechaVencimiento: string;
  advertenciaTerminoMenor: boolean;
  requiereValidacionJuridica: boolean;
}

export async function reclasificarTipoSolicitud(
  input: ReclasificarTipoSolicitudInput,
): Promise<ReclasificarTipoSolicitudResultado> {
  const response = await fetch(
    `/api/radicados/${encodeURIComponent(input.radicadoId)}/reclasificar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tipoSolicitudId: input.tipoSolicitudId,
        motivo: input.motivo,
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as
    | (ReclasificarTipoSolicitudResultado & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok || !data || !('ok' in data)) {
    const message = (data && 'error' in data ? data.error : undefined) ?? 'No fue posible reclasificar el radicado.';
    throw new Error(message);
  }
  return data;
}
