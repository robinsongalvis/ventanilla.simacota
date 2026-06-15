import { INSTITUCION } from '@/lib/institucion';
import type { RolInterno } from '@/lib/hooks/useAuth';

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
