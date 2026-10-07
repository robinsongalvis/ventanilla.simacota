/** ADR 0043: configuración versionada de esta entrega, no una variable secreta. */
export const CONTINGENCIA_STORAGE_ACTIVA = true;

export const MENSAJE_SOPORTES_PENDIENTES =
  'Radicado creado con soportes pendientes de digitalización. Storage no disponible: conserve los originales en la custodia registrada.';

export type EstadoAdjuntos = 'PENDIENTE_STORAGE' | 'COMPLETO';
export type TipoCustodiaSoportes = 'FISICA_EN_VENTANILLA' | 'CORREO_INSTITUCIONAL';

/** Inventario confirmado por recepción; nunca contiene bytes ni credenciales. */
export interface SoportesPendientesInput {
  descripcion: string;
  cantidad: number;
  custodiaTipo: TipoCustodiaSoportes;
  custodiaReferencia: string;
  confirmacionCustodia: boolean;
}

interface RegistroGestionAdjuntos {
  version: 1;
  soportesPendientes: SoportesPendientesInput;
  registradoPor: { uid: string; nombre: string };
  registradoEn: string;
}

/** Estado ortogonal al trámite administrativo. El inventario original se conserva. */
export type GestionAdjuntosRadicado = RegistroGestionAdjuntos & (
  | { estado: 'PENDIENTE_STORAGE' }
  | {
    estado: 'COMPLETO';
    regularizacion: {
      archivoPath: string;
      sha256: string;
      generation: string;
      completadoEn: string;
      completadoPor: { uid: string; nombre: string };
      confirmacionIntegridad: true;
    };
  }
);

export type ValidacionSoportesPendientes =
  | { ok: true; soportes: SoportesPendientesInput }
  | { ok: false; error: string };

/** Valida entrada multipart no confiable y reconstruye solo sus campos permitidos. */
export function validarSoportesPendientes(raw: string): ValidacionSoportesPendientes {
  // unknown es intencional en el límite JSON externo: no confiamos en un cast de entrada.
  let valor: unknown;
  try { valor = JSON.parse(raw); } catch {
    return { ok: false, error: 'Registra el inventario y la custodia de los soportes pendientes.' };
  }
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, error: 'El inventario de soportes pendientes no es válido.' };
  }
  const datos = valor as Record<string, unknown>;
  const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';
  const referencia = typeof datos.custodiaReferencia === 'string' ? datos.custodiaReferencia.trim() : '';
  if (descripcion.length < 10 || descripcion.length > 2000) {
    return { ok: false, error: 'Describe los soportes pendientes entre 10 y 2000 caracteres.' };
  }
  if (typeof datos.cantidad !== 'number' || !Number.isInteger(datos.cantidad) || datos.cantidad < 1 || datos.cantidad > 1000) {
    return { ok: false, error: 'La cantidad de soportes pendientes debe estar entre 1 y 1000.' };
  }
  if (datos.custodiaTipo !== 'FISICA_EN_VENTANILLA' && datos.custodiaTipo !== 'CORREO_INSTITUCIONAL') {
    return { ok: false, error: 'Selecciona custodia física en ventanilla o correo institucional.' };
  }
  if (referencia.length < 5 || referencia.length > 500) {
    return { ok: false, error: 'Identifica la ubicación de custodia entre 5 y 500 caracteres, sin contraseñas ni enlaces privados.' };
  }
  if (datos.confirmacionCustodia !== true) {
    return { ok: false, error: 'Debes confirmar que conservas los originales para su posterior digitalización.' };
  }
  return {
    ok: true,
    soportes: {
      descripcion,
      cantidad: datos.cantidad,
      custodiaTipo: datos.custodiaTipo,
      custodiaReferencia: referencia,
      confirmacionCustodia: true,
    },
  };
}
