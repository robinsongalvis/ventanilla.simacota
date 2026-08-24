/* ══════════════════════════════════════════════════════════════
   Radicación interna — camino ÚNICO por el servidor.

   Hasta el 24-ago-2026 aquí vivía el kill-switch USA_RADICACION_INTERNA_SERVER
   con la bifurcación al camino legado de cliente. El PR-C lo retiró: con las
   reglas de cliente cerradas (#217 desplegado), la rama OFF ya no era un
   rollback sino una TRAMPA — habría fallado contra las reglas dejando estado
   parcial. Revertir el cutover hoy es una decisión con ADR (código + reglas),
   no un flag.

   Se conserva este módulo (y no un import directo en el caller) para que el
   punto de entrada de la radicación interna siga siendo uno solo.
══════════════════════════════════════════════════════════════ */
import type {
  ActorRadicacion,
  DatosRadicacionInstitucional,
  ResultadoRadicacion,
} from '@/lib/actions/radicarVentanilla';
import { radicarInternaCliente } from '@/lib/recepcion/radicar-interna-cliente';

export async function radicarSegunFlag(
  datos: DatosRadicacionInstitucional,
  _actor: ActorRadicacion,
  onProgress?: (mensaje: string, pct: number) => void,
): Promise<ResultadoRadicacion> {
  return radicarInternaCliente(datos, onProgress);
}
