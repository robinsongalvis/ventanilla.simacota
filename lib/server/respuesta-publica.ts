import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { RespuestaOficialPublica } from '@/src/types/simi-citizen';

/* ══════════════════════════════════════════════════════════════
   buildRespuestaPublicaCiudadano — Sanitizador del payload público

   Función pura que toma un VentanillaRadicado completo y devuelve
   SOLO los campos que el ciudadano puede ver en /consulta. Filtra
   actorUid, actorNombre, archivoPath y cualquier metadata interna.

   Regla de exposición:
   - Devuelve `null` si el radicado NO está RESUELTO.
   - Devuelve `null` si no hay `respuestaOficial` persistida.
   - Devuelve `null` si la nota está vacía o solo contiene espacios.
   - En otro caso, devuelve el objeto sanitizado.

   Importante sobre anonimato:
   - Las solicitudes anónimas (`esAnonimo === true`) SÍ pueden ver la
     respuesta institucional. La privacidad protege la identidad del
     solicitante, NO la respuesta de la Alcaldía (que por naturaleza
     es un acto administrativo público).
   - Para presentaciones RESERVADAS aplica el mismo principio.
══════════════════════════════════════════════════════════════ */

export function buildRespuestaPublicaCiudadano(
  radicado: VentanillaRadicado,
  dependenciaNombre: string,
): RespuestaOficialPublica | null {
  if (radicado.estadoActual !== 'RESUELTO') return null;

  const ro = radicado.respuestaOficial;
  if (!ro) return null;

  const nota = ro.nota?.trim() ?? '';
  if (nota.length === 0) return null;

  return {
    nota,
    fecha:             ro.fecha,
    dependenciaNombre,
    tieneArchivo:      Boolean(ro.archivoPath),
  };
}
