/* ══════════════════════════════════════════════════════════════
   Pieza angular (P2.1) — Fase 3: cliente de `POST /api/radicacion/interna`.

   Contraparte, del lado del navegador, del contrato en
   `lib/recepcion/contrato-radicacion-interna.ts`: arma el `FormData` con
   los MISMOS nombres de campo que lee el endpoint (single source of
   truth), hace el fetch y traduce la respuesta a `ResultadoRadicacion`
   (mismo tipo que ya devuelve la acción legada
   `lib/actions/radicarVentanilla.ts`, para que el caller —
   `app/interno/dashboard/page.tsx`— pueda bifurcar sin cambiar el shape
   que consume después del `await`).

   Mensajes de error: se leen del cuerpo JSON que ya devuelve el endpoint
   (siempre en español — ver `app/api/radicacion/interna/route.ts`) y se
   relanzan como `Error` para que el catch existente del dashboard
   (`err instanceof Error ? err.message : …`) los muestre tal cual, sin
   tocar ese componente.

   No recibe `ActorRadicacion`: a diferencia de la acción legada
   (cliente Firestore, sin sesión de servidor), este endpoint deriva el
   actor (`uid`, `nombre`, `rol`) de la cookie de sesión vía
   `requireActiveInternalUser()` — mandarlo en el body sería un campo de
   ESTADO que el endpoint ya ignora a propósito (ver contrato).
══════════════════════════════════════════════════════════════ */
import type { DatosRadicacionInstitucional, ResultadoRadicacion } from '@/lib/actions/radicarVentanilla';
import {
  CAMPOS_RADICACION_INTERNA,
  type RespuestaRadicacionInterna,
} from '@/lib/recepcion/contrato-radicacion-interna';

const ENDPOINT = '/api/radicacion/interna';

const MENSAJE_ERROR_RED = 'Error de red al radicar la solicitud. Intenta nuevamente.';
const MENSAJE_ERROR_GENERICO = 'No fue posible radicar la solicitud. Intenta nuevamente o comunícate con soporte.';

function agregarCampo(formData: FormData, nombre: string, valor: string | number | boolean | undefined): void {
  if (valor === undefined) return;
  formData.append(nombre, String(valor));
}

/** Arma el `FormData` del POST a partir del mismo payload que hoy recibe
 *  `radicarInstitucionalmente` — exportada para que el test del cliente
 *  pueda verificar campo por campo sin repetir los nombres a mano. */
export function construirFormDataRadicacionInterna(datos: DatosRadicacionInstitucional): FormData {
  const formData = new FormData();
  const C = CAMPOS_RADICACION_INTERNA;

  agregarCampo(formData, C.tipoSolicitudId, datos.tipoSolicitudId);
  agregarCampo(formData, C.tipoPresentacion, datos.tipoPresentacion);
  agregarCampo(formData, C.canalRespuesta, datos.canalRespuesta);
  agregarCampo(formData, C.tipoPersona, datos.tipoPersona);
  agregarCampo(formData, C.tipoDocumento, datos.tipoDocumento);
  agregarCampo(formData, C.medioRecepcion, datos.medioRecepcion);
  agregarCampo(formData, C.origenIngreso, datos.origenIngreso);
  agregarCampo(formData, C.tipoEntrada, datos.tipoEntrada);
  agregarCampo(formData, C.oficinaDestino, datos.oficinaDestino);
  agregarCampo(formData, C.nombreCompleto, datos.nombreCompleto);
  agregarCampo(formData, C.numeroDocumento, datos.numeroDocumento);
  agregarCampo(formData, C.email, datos.email);
  agregarCampo(formData, C.telefono, datos.telefono);
  agregarCampo(formData, C.telefonoMovil, datos.telefonoMovil);
  agregarCampo(formData, C.telefonoFijo, datos.telefonoFijo);
  agregarCampo(formData, C.direccion, datos.direccion);
  agregarCampo(formData, C.pais, datos.pais);
  agregarCampo(formData, C.departamento, datos.departamento);
  agregarCampo(formData, C.municipio, datos.municipio);
  agregarCampo(formData, C.barrio, datos.barrio);
  agregarCampo(formData, C.asunto, datos.asunto);
  agregarCampo(formData, C.descripcion, datos.descripcion);
  agregarCampo(formData, C.numeroFolios, datos.numeroFolios);
  agregarCampo(formData, C.numeroAnexos, datos.numeroAnexos);
  agregarCampo(formData, C.anexosDescripcion, datos.anexosDescripcion);
  agregarCampo(formData, C.observacionesAnexos, datos.observacionesAnexos);
  agregarCampo(formData, C.areaResponsable, datos.areaResponsable);
  agregarCampo(formData, C.noAportaDocumento, datos.noAportaDocumento);
  agregarCampo(formData, C.noAportaCorreo, datos.noAportaCorreo);
  agregarCampo(formData, C.noAportaTelefono, datos.noAportaTelefono);
  agregarCampo(formData, C.noAportaDireccion, datos.noAportaDireccion);
  datos.archivos.forEach((archivo) => formData.append(C.archivos, archivo));

  return formData;
}

/** Traduce una respuesta NO-ok del endpoint al mensaje en español que debe
 *  ver la funcionaria. `errores` (400) lista cada validación incumplida;
 *  el resto de estados solo trae `error`. */
async function leerMensajeError(response: Response): Promise<string> {
  try {
    const cuerpo = (await response.json()) as Partial<RespuestaRadicacionInterna>;
    if ('errores' in cuerpo && Array.isArray(cuerpo.errores) && cuerpo.errores.length > 0) {
      return cuerpo.errores.join(' ');
    }
    if ('error' in cuerpo && typeof cuerpo.error === 'string' && cuerpo.error) {
      return cuerpo.error;
    }
  } catch {
    // Cuerpo no-JSON o vacío — se usa el mensaje genérico de abajo.
  }
  return MENSAJE_ERROR_GENERICO;
}

/**
 * Pieza angular (P2.1), Fase 3 — camino nuevo del kill-switch
 * (`USA_RADICACION_INTERNA_SERVER`). Mismo contrato de entrada/salida que
 * `radicarInstitucionalmente` (sin `actor`, ver cabecera) para que
 * `app/interno/dashboard/page.tsx` pueda bifurcar con un cambio mínimo.
 */
export async function radicarInternaCliente(
  datos: DatosRadicacionInstitucional,
  onProgress: (mensaje: string, pct: number) => void = () => {},
): Promise<ResultadoRadicacion> {
  onProgress('Enviando la solicitud al servidor…', 50);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, { method: 'POST', body: construirFormDataRadicacionInterna(datos) });
  } catch {
    throw new Error(MENSAJE_ERROR_RED);
  }

  if (!response.ok) {
    throw new Error(await leerMensajeError(response));
  }

  const cuerpo = (await response.json()) as RespuestaRadicacionInterna;
  if (!('ok' in cuerpo) || !cuerpo.ok) {
    throw new Error(MENSAJE_ERROR_GENERICO);
  }

  onProgress('Radicado guardado.', 90);
  return { radicadoId: cuerpo.radicadoId, consecutivo: cuerpo.consecutivo };
}
