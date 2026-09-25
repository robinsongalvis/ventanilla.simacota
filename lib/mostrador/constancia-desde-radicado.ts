import type { VentanillaRadicado } from '@/src/types/ventanilla';

/**
 * Sprint Cierre del mostrador — reconstruir los datos de la constancia
 * a partir del documento del radicado.
 *
 * La constancia solo existía en la pantalla de éxito inmediatamente
 * después de radicar; si el ciudadano volvía otro día no había forma
 * de reimprimirla. Este helper arma las props de ComprobanteRadicado
 * desde el doc, respetando las marcas "no aporta" igual que el flujo
 * original (dato no aportado → null → la constancia no lo muestra).
 *
 * Función pura: sin React, sin Firestore.
 */

export interface DatosConstancia {
  radicadoId:          string;
  solicitanteNombre:   string;
  numeroDocumento:     string;
  tipoDocumento:       string;
  fechaRadicado:       string;
  horaRadicado:        string;
  medioRecepcion:      string;
  tipoTramite:         string;
  diasRespuesta:       number;
  unidad:              'HABILES' | 'CALENDARIO';
  asunto:              string;
  fechaVencimiento:    string;
  funcionarioNombre:   string;
  dependencia:         string;
  numeroFolios:        number;
  numeroAnexos:        number;
  mediosAnexos:        string | null;
  correoSolicitante:   string | null;
  telefonoSolicitante: string | null;
  canalRespuesta:      string | null;
}

export function datosConstanciaDesdeRadicado(r: VentanillaRadicado): DatosConstancia {
  const marcas = r.solicitante.datosNoAportados;

  return {
    radicadoId:        r.radicadoId,
    solicitanteNombre: r.solicitante.nombreCompleto,
    numeroDocumento:   r.solicitante.numeroDocumento,
    tipoDocumento:     r.solicitante.tipoDocumento,
    fechaRadicado:     r.control.fechaRadicado,
    horaRadicado:      r.control.horaRadicado,
    medioRecepcion:    r.control.medioRecepcion,
    tipoTramite:       r.termino?.tipoSolicitudNombre || 'Sin clasificar',
    diasRespuesta:     r.termino?.diasRespuesta ?? 0,
    unidad:            r.termino?.unidad ?? 'HABILES',
    asunto:            r.detalle?.asunto ?? '',
    fechaVencimiento:  r.termino?.fechaVencimiento ?? '',
    funcionarioNombre: r.clasificacion?.funcionarioResponsableNombre ?? 'No registrado',
    dependencia:       r.clasificacion?.oficinaDestino ?? 'VENTANILLA_UNICA',
    numeroFolios:      r.detalle?.numeroFolios ?? 0,
    numeroAnexos:      r.detalle?.numeroAnexos ?? 0,
    mediosAnexos:      r.detalle?.anexosDescripcion ?? null,
    // Igual que al radicar: si el solicitante no aportó el dato, la
    // constancia no lo muestra aunque el campo tenga valor residual.
    correoSolicitante:   marcas?.correo ? null : (r.solicitante.email ?? null),
    telefonoSolicitante: marcas?.telefono
      ? null
      : (r.solicitante.telefonoMovil ?? r.solicitante.telefono ?? null),
    canalRespuesta: r.canalRespuesta ?? null,
  };
}
