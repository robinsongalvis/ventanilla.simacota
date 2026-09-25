import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';

/**
 * Sprint Traslado claro — el formulario entiende tu intención.
 *
 * El tab de traslado mezclaba dos gestos distintos bajo un mismo botón
 * "Confirmar traslado": mover el caso a otra dependencia y ponerle
 * persona dentro de la misma. Este helper deduce cuál de los dos es,
 * arma el label del botón y anuncia las consecuencias ANTES del clic —
 * el mismo patrón de la caja "qué va a pasar" de Responder.
 *
 * Función pura: sin React, sin Firestore.
 */

export type IntencionCambio = 'TRASLADO' | 'ASIGNACION' | 'AREA' | 'SIN_CAMBIOS';

export interface EntradaCambio {
  dependenciaActual: TenantId;
  dependenciaNueva:  TenantId;
  /** Nombre del responsable registrado hoy (null si el caso no tiene persona). */
  responsableActual: string | null;
  /** Nombre elegido en el formulario (null si no se eligió a nadie). */
  responsableNuevo:  string | null;
  /** True si el uid elegido difiere del registrado. */
  responsableCambia: boolean;
  /** Nombre legible del área elegida (null si quedó sin área). */
  areaNueva:  string | null;
  /** True si el área elegida difiere de la registrada. */
  areaCambia: boolean;
}

export interface ResumenCambio {
  intencion:     IntencionCambio;
  botonLabel:    string;
  /** AMBAR = el caso se mueve; VERDE = cambio interno; GRIS = nada. */
  tono:          'AMBAR' | 'VERDE' | 'GRIS';
  tituloCaja:    string | null;
  consecuencias: string[];
  puedeConfirmar: boolean;
}

function nombre(t: TenantId): string {
  return NOMBRES_TENANT[t] ?? t;
}

export function resumirCambio(e: EntradaCambio): ResumenCambio {
  const actual = nombre(e.dependenciaActual);
  const nueva  = nombre(e.dependenciaNueva);

  // 1 · Cambió la dependencia → esto ES un traslado.
  if (e.dependenciaNueva !== e.dependenciaActual) {
    const consecuencias = [`El caso sale de ${actual} y pasa a ${nueva}`];
    if (e.responsableNuevo) {
      consecuencias.push(`${e.responsableNuevo} queda como responsable en ${nueva}`);
    } else if (e.responsableActual) {
      consecuencias.push(`${e.responsableActual} deja de ser responsable; ${nueva} asignará a su persona`);
    } else {
      consecuencias.push(`${nueva} asignará a su persona al recibirlo`);
    }
    if (e.areaNueva) consecuencias.push(`Lo trabajará el área ${e.areaNueva}`);
    consecuencias.push('Se avisa al ciudadano por correo y todo queda en la Historia');
    return {
      intencion: 'TRASLADO',
      botonLabel: `Trasladar a ${nueva}`,
      tono: 'AMBAR',
      tituloCaja: 'Esto es un traslado — qué va a pasar',
      consecuencias,
      puedeConfirmar: true,
    };
  }

  // 2 · Misma dependencia + persona distinta → esto es una asignación.
  if (e.responsableNuevo && e.responsableCambia) {
    const consecuencias = [
      `${e.responsableNuevo} queda responsable del caso`,
      'Le aparecerá en su Mi gestión con su término',
    ];
    if (e.areaNueva) consecuencias.push(`Área: ${e.areaNueva}`);
    consecuencias.push('Quedará registrado en la Historia');
    return {
      intencion: 'ASIGNACION',
      botonLabel: `Asignar a ${e.responsableNuevo}`,
      tono: 'VERDE',
      tituloCaja: 'Esto es una asignación — qué va a pasar',
      consecuencias,
      puedeConfirmar: true,
    };
  }

  // 3 · Solo cambió el área.
  if (e.areaCambia && e.areaNueva) {
    return {
      intencion: 'AREA',
      botonLabel: `Guardar área: ${e.areaNueva}`,
      tono: 'VERDE',
      tituloCaja: 'Cambio de área — qué va a pasar',
      consecuencias: [`El caso queda en el área ${e.areaNueva} de ${actual}`],
      puedeConfirmar: true,
    };
  }

  // 4 · Nada por hacer: el botón lo dice y se apaga.
  return {
    intencion: 'SIN_CAMBIOS',
    botonLabel: 'Sin cambios por aplicar',
    tono: 'GRIS',
    tituloCaja: null,
    consecuencias: [],
    puedeConfirmar: false,
  };
}
