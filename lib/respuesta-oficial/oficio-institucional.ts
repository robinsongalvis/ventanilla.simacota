import { INSTITUCION } from '@/lib/institucion';
import type { RolInterno } from '@/lib/hooks/useAuth';
import { identidadProtegida, type RadicadoConReserva } from '@/lib/seguridad/identidad-protegida';

/* ══════════════════════════════════════════════════════════════
   buildOficioInstitucional — Generador de respuesta tipo oficio

   Función PURA que produce el texto formal de la respuesta oficial
   con estructura institucional (encabezado, ciudad/fecha, destinatario,
   asunto, referencia al radicado, cuerpo, cierre, firma).

   Reglas de privacidad:
   - Radicados anónimos o con presentación 'ANONIMA' → destinatario
     genérico ("Solicitante"), sin nombre, correo ni dirección.
   - Radicados con identidad reservada → mismo tratamiento que anónimo
     en el texto público; los datos solo viven en el dashboard interno.
   - Identificados → nombre y correo/dirección si están disponibles.

   Reglas de contenido:
   - SIMI puede llamar a esta función para producir un BORRADOR.
   - El funcionario siempre edita y aprueba antes de resolver.
   - El cuerpo (`cuerpoRespuesta`) se inserta tal cual.
   - Si no se provee cuerpo, se inserta un marcador claro para que el
     funcionario lo reemplace.
══════════════════════════════════════════════════════════════ */

const PLACEHOLDER_CUERPO = '[Escribe aquí la respuesta de fondo a la solicitud del ciudadano. Sé claro, específico y completo.]';

const ROL_LABEL_DEFAULT: Record<RolInterno, string> = {
  ADMIN:            'Administrador del Sistema',
  RECEPCIONISTA:    'Recepcionista de Ventanilla Única',
  FUNCIONARIO:      'Funcionario',
  JEFE_DEPENDENCIA: 'Jefe de Dependencia',
  CONTROL_INTERNO:  'Control Interno',
};

export interface OficioFuncionario {
  nombre: string;
  /** Cargo formal del funcionario. Si falta, se usa el label del rol. */
  cargo?: string | null;
  /** Rol institucional — se usa como fallback de cargo. */
  rol?: RolInterno;
}

export interface OficioCiudadano {
  nombre?:    string | null;
  correo?:    string | null;
  direccion?: string | null;
  esAnonimo?: boolean;
  /** `tipoPresentacion === 'ANONIMA' | 'RESERVADA'` también se tratan como anónimo en el texto. */
  reservado?: boolean;
}

/* ══════════════════════════════════════════════════════════════
   EL MAPEO RADICADO → CIUDADANO DEL OFICIO (issue #301).

   Hasta el 31-ago-2026 este mapeo vivía inline en el dashboard, y reconocía
   DOS marcadores de cuatro: `tipoPresentacion === 'RESERVADA'` e
   `identidadReservada`. El JSDoc de `reservado` (arriba) prometía que ANONIMA
   también se trataba como anónimo — y el llamador nunca lo mapeó. Un radicado
   ANONIMA con `esAnonimo` ausente habría impreso nombre, correo y dirección
   REALES en el papel que se le entrega al ciudadano. No ocurría por accidente
   de las rutas de radicación, no por diseño.

   La corrección NO añade una quinta copia del criterio: reutiliza el canónico
   `identidadProtegida` (lib/seguridad/identidad-protegida.ts, ADR-0006), que
   enumera los cuatro marcadores. La consolidación de las copias restantes es
   el issue #294 (ADR aparte) — esto solo cierra la salida al papel.
══════════════════════════════════════════════════════════════ */

/** Lo que el mapeo necesita del radicado — estructural, para no acoplarse. */
export type RadicadoParaOficio = RadicadoConReserva & {
  solicitante?: {
    nombreCompleto?: string | null;
    email?: string | null;
    direccion?: string | null;
  } | null;
};

/** Construye el `ciudadano` del oficio desde el radicado, con el criterio
 *  CANÓNICO de reserva — los cuatro marcadores, no dos. */
export function ciudadanoOficioDesdeRadicado(r: RadicadoParaOficio): OficioCiudadano {
  return {
    nombre:    r.solicitante?.nombreCompleto,
    correo:    r.solicitante?.email ?? undefined,
    direccion: r.solicitante?.direccion ?? undefined,
    esAnonimo: r.esAnonimo === true,
    reservado: identidadProtegida(r),
  };
}

export interface OficioInput {
  radicadoId:       string;
  /** ISO o Date. Se formatea como "15 de junio de 2026". */
  fecha:            string | Date;
  ciudadano:        OficioCiudadano;
  /** Nombre oficial de la dependencia que responde. */
  dependencia:      string;
  funcionario:      OficioFuncionario;
  /** Cuerpo de la respuesta. Si vacío, se inserta un placeholder editable. */
  cuerpoRespuesta?: string;
}

function formatearFechaInstitucional(fecha: string | Date): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) {
    // Fallback razonable en caso de fecha inválida
    return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('es-CO', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  });
}

function debeOcultarIdentidad(c: OficioCiudadano): boolean {
  return c.esAnonimo === true || c.reservado === true;
}

function lineasDestinatario(c: OficioCiudadano): string[] {
  if (debeOcultarIdentidad(c)) {
    return ['Señor(a)', 'Solicitante'];
  }

  const lineas = ['Señor(a)'];
  const nombre = c.nombre?.trim();
  if (nombre) {
    lineas.push(nombre);
  } else {
    lineas.push('Solicitante');
  }

  const contacto = c.correo?.trim() || c.direccion?.trim();
  if (contacto) lineas.push(contacto);

  return lineas;
}

function resolverCargo(f: OficioFuncionario): string {
  const cargo = f.cargo?.trim();
  if (cargo) return cargo;
  if (f.rol && ROL_LABEL_DEFAULT[f.rol]) return ROL_LABEL_DEFAULT[f.rol];
  return 'Funcionario';
}

export function buildOficioInstitucional(input: OficioInput): string {
  const fechaFmt = formatearFechaInstitucional(input.fecha);
  const destinatario = lineasDestinatario(input.ciudadano);
  const cargo = resolverCargo(input.funcionario);
  const cuerpo = (input.cuerpoRespuesta?.trim() || PLACEHOLDER_CUERPO);
  const ciudad = `${INSTITUCION.municipio}, ${INSTITUCION.departamento}`;

  return [
    `${ciudad}, ${fechaFmt}`,
    '',
    ...destinatario,
    '',
    `Asunto: Respuesta a solicitud radicada No. ${input.radicadoId}`,
    '',
    'Cordial saludo,',
    '',
    `En atención a la solicitud presentada mediante radicado No. ${input.radicadoId}, recibida a través de la ${INSTITUCION.sistema} de la ${INSTITUCION.nombre}, nos permitimos dar respuesta en los siguientes términos:`,
    '',
    cuerpo,
    '',
    'De esta manera, se brinda respuesta clara, completa y de fondo a su solicitud.',
    '',
    'Atentamente,',
    '',
    input.funcionario.nombre,
    cargo,
    input.dependencia,
    INSTITUCION.nombre,
  ].join('\n');
}

export { PLACEHOLDER_CUERPO };
