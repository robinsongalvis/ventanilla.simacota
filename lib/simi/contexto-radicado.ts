import type { TenantId } from '@/src/types/radicado';
import type {
  TrazabilidadRadicado,
  VentanillaRadicado,
} from '@/src/types/ventanilla';
import type { RolInterno } from '@/lib/hooks/useAuth';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { getTipoSolicitudById } from '@/lib/catalogos/tipos-solicitud';
import { sanitizarPiiTextoSimi } from '@/lib/seguridad/sanitizar-pii';
import { obtenerCompetencia } from './competencias-dependencias';
import { evaluarCompetenciaRadicado, type EvaluacionCompetencia } from './evaluar-competencia';

/* ══════════════════════════════════════════════════════════════
   Builder de contexto SIMI con sanitización por privacidad.

   Garantiza que el contexto que se envía al modelo NO contiene:
   - UID internos del funcionario o sistema.
   - archivoPath crudos (rutas privadas de Storage).
   - Identidad del solicitante cuando esAnonimo || RESERVADA.

   Devuelve dos formas del mismo contexto:
   - `meta`: objeto estructurado (útil para auditoría, logging y UI).
   - `bloqueTexto`: string ya formateado para inyectar en el prompt
     del modelo, con encabezados claros.
══════════════════════════════════════════════════════════════ */

const TRAZA_MAX_EVENTOS = 8;
const TRAZA_NOTA_MAX    = 80;

// H-16: delimitadores para marcar contenido no confiable (texto escrito por
// ciudadano o funcionario). El system prompt reitera que estos bloques son
// DATO, no instrucciones. Si el contenido los menciona literalmente, se
// escapan a `<<` / `>>` para evitar fugas.
const MARK_OPEN_CIUDADANO    = '<<<TEXTO_CIUDADANO_NO_CONFIABLE>>>';
const MARK_CLOSE_CIUDADANO   = '<<<FIN_TEXTO_CIUDADANO>>>';
const MARK_OPEN_FUNCIONARIO  = '<<<TEXTO_FUNCIONARIO_NO_CONFIABLE>>>';
const MARK_CLOSE_FUNCIONARIO = '<<<FIN_TEXTO_FUNCIONARIO>>>';

function escaparDelimitadores(texto: string): string {
  return texto.replace(/<{3,}/g, '<<').replace(/>{3,}/g, '>>');
}

function prepararContenidoNoConfiable(texto: string): string {
  return escaparDelimitadores(sanitizarPiiTextoSimi(texto));
}

export interface UsuarioSimi {
  rol:      RolInterno;
  tenantId: TenantId;
  nombre:   string;
}

export interface ContextoSimi {
  meta: {
    radicadoId:         string;
    tipoSolicitud:      string;
    tipoSolicitudId:    string;
    categoriaSolicitud: string;
    terminoDias:        number;
    tipoDias:           'HABILES' | 'CALENDARIO';
    dependenciaSugeridaTipo: string | null;
    requiereValidacionJuridica: boolean;
    heredadoSistemaActual: boolean;
    asunto:             string;
    descripcionResumen: string;
    estadoActual:       string;
    fechaRadicacion:    string;
    fechaLimite:        string;
    diasRestantes:      number;
    estadoTermino:      'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
    canalRespuesta:     string;
    dependenciaActual:  string;
    competenciasDependencia: string[];
    evaluacionCompetencia:   EvaluacionCompetencia;
    responsable:        string;
    esAnonimo:          boolean;
    esReservado:        boolean;
    tieneCorreo:        boolean;
    anexosCount:        number;
    tieneRespuestaPrevia: boolean;
    prorrogasAplicadas: number;
    usuario: {
      rol:        RolInterno;
      dependencia: string;
    };
  };
  trazabilidadResumida: { fecha: string; accion: string; actorNombre: string; nota: string }[];
  bloqueTexto: string;
}

function clasificarTermino(diasRestantes: number): 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' {
  if (diasRestantes < 0) return 'VENCIDO';
  if (diasRestantes <= 2) return 'POR_VENCER';
  return 'VIGENTE';
}

function resumirNota(nota: string | undefined | null): string {
  if (!nota) return '';
  return nota.length > TRAZA_NOTA_MAX ? `${nota.slice(0, TRAZA_NOTA_MAX - 1)}…` : nota;
}

function debeOcultarIdentidad(r: VentanillaRadicado): boolean {
  return r.esAnonimo === true
      || r.tipoPresentacion === 'ANONIMA'
      || r.tipoPresentacion === 'RESERVADA'
      || r.identidadReservada === true;
}

export function construirContextoSimi(params: {
  radicado:     VentanillaRadicado;
  trazabilidad: TrazabilidadRadicado[];
  usuario:      UsuarioSimi;
}): ContextoSimi {
  const { radicado: r, trazabilidad, usuario } = params;

  const dias            = diasRestantesHabiles(r.termino.fechaVencimiento);
  const estadoTermino   = clasificarTermino(dias);
  const dependencia     = NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino;
  const ocultarIdentidad = debeOcultarIdentidad(r);
  const competencia     = obtenerCompetencia(r.clasificacion.oficinaDestino);
  const definicionTipo  = getTipoSolicitudById(r.termino.tipoSolicitudId);
  const requiereValidacion = definicionTipo?.requiereValidacionJuridica === true;
  const heredadoSistema    = definicionTipo?.heredadoSistemaActual === true;
  const dependenciaSugeridaTipo = definicionTipo?.dependenciaSugerida
    ? NOMBRES_TENANT[definicionTipo.dependenciaSugerida] ?? definicionTipo.dependenciaSugerida
    : null;

  const evaluacion = evaluarCompetenciaRadicado({
    dependenciaActual: r.clasificacion.oficinaDestino,
    asunto:            r.detalle.asunto,
    descripcion:       r.detalle.descripcion,
    tipoSolicitudNombre: r.termino.tipoSolicitudNombre,
  });

  // Trazabilidad sanitizada (recorta nota, omite metadata interna)
  const trazaResumida = trazabilidad
    .slice(-TRAZA_MAX_EVENTOS)
    .map((t) => ({
      fecha:       t.fecha.slice(0, 16).replace('T', ' '),
      accion:      String(t.accion),
      actorNombre: t.actorNombre ?? 'Sistema',
      nota:        resumirNota(t.nota),
    }));

  // Construcción del bloque textual para inyectar al prompt
  const lineasContexto = [
    'CONTEXTO DEL RADICADO',
    `- Número: ${r.radicadoId}`,
    `- Tipo de solicitud (PQRSD): ${r.termino.tipoSolicitudNombre} (${r.termino.diasRespuesta} días ${r.termino.unidad.toLowerCase()})`,
    `- Tipo ID catálogo: ${r.termino.tipoSolicitudId}`,
    `- Categoría: ${definicionTipo?.categoria ?? 'NO_REGISTRADA'}`,
    `- Dependencia sugerida por catálogo: ${dependenciaSugeridaTipo ?? 'No definida'}`,
    `- Requiere validación jurídica: ${requiereValidacion ? 'Sí' : 'No'}`,
    `- Heredado del sistema actual: ${heredadoSistema ? 'Sí' : 'No'}`,
    ...(heredadoSistema || requiereValidacion
      ? ['- ADVERTENCIA: Este tipo fue heredado del sistema actual y requiere validación jurídica/institucional antes de usarse como criterio definitivo.']
      : []),
    /* ADR-0040: bajo reserva de identidad, el TEXTO LIBRE no viaja al modelo.
       El sanitizador declara que no detecta nombres ni direcciones — un
       «Yo, Juan García, de la matrícula 300-12345…» escrito por un solicitante
       reservado llegaba íntegro a un tercero. La omisión es total y declarada:
       una sanitización «reforzada» prometería una detección que no existe.
       La heurística local de competencia (arriba) sí sigue usando el texto:
       es código propio, no sale de la entidad. */
    ...(ocultarIdentidad
      ? [
          '- Asunto y descripción: OMITIDOS por reserva de identidad del solicitante '
          + '(Ley 1581/2012 art. 4 lit. f) — el texto libre puede identificarlo. '
          + 'No pidas ese contenido ni intentes inferirlo.',
        ]
      : [
          `- Asunto (contenido escrito por el ciudadano):`,
          MARK_OPEN_CIUDADANO,
          prepararContenidoNoConfiable(r.detalle.asunto),
          MARK_CLOSE_CIUDADANO,
          `- Descripción (contenido escrito por el ciudadano):`,
          MARK_OPEN_CIUDADANO,
          prepararContenidoNoConfiable(r.detalle.descripcion),
          MARK_CLOSE_CIUDADANO,
        ]),
    `- Estado actual: ${r.estadoActual}`,
    `- Fecha de radicación: ${r.control.fechaRadicado}`,
    `- Fecha límite: ${r.termino.fechaVencimiento}`,
    `- Días restantes (hábiles): ${dias} (${estadoTermino})`,
    /* Issue #300 (decisión del propietario, 1-sep-2026): bajo reserva, el
       canal tampoco se declara — decirle «CORREO» al modelo es metadato de
       contacto de un solicitante cuya identidad la ley protege. Solo en el
       prompt: la radicación no se toca (RESERVADA conserva sus datos para la
       entidad — la reserva protege frente a terceros, no frente a ella), y
       `meta.canalRespuesta` sigue intacto porque no viaja al modelo (alimenta
       UI y auditoría). Mismo patrón del ADR-0040: omisión total y declarada. */
    ...(ocultarIdentidad
      ? ['- Canal de respuesta: OMITIDO por reserva de identidad del solicitante — no lo pidas ni lo infieras.']
      : [`- Canal de respuesta del ciudadano: ${r.canalRespuesta ?? 'No registrado'}`]),
    `- Dependencia actual: ${dependencia}`,
    `- Es anónimo: ${r.esAnonimo === true ? 'Sí' : 'No'}`,
    `- Identidad reservada: ${r.identidadReservada === true || r.tipoPresentacion === 'RESERVADA' ? 'Sí' : 'No'}`,
    `- Anexos: ${r.archivos.length}`,
    `- Prórrogas aplicadas: ${r.termino.prorrogasAplicadas}`,
    `- Tiene respuesta oficial registrada: ${r.respuestaOficial ? 'Sí' : 'No'}`,
  ];

  if (ocultarIdentidad) {
    lineasContexto.push('- Solicitante: ANÓNIMO / RESERVADO — no menciones identidad, no inventes datos personales.');
  } else {
    // H-11: ciudadano identificado, pero NO se envían nombre ni correo al modelo.
    // SIMI sólo necesita saber que hay una persona identificada (para diferenciarlo
    // del caso anónimo) y, si aplica, que existe un canal de correo registrado.
    lineasContexto.push(
      '- Solicitante: persona ciudadana identificada (datos personales omitidos por privacidad — no inventes nombre ni correo).',
    );
    if (r.solicitante.email) {
      lineasContexto.push('- Canal de respuesta: correo electrónico registrado.');
    }
  }

  if (r.clasificacion.funcionarioResponsableNombre) {
    lineasContexto.push(`- Responsable funcional: ${r.clasificacion.funcionarioResponsableNombre}`);
  } else {
    lineasContexto.push('- Responsable funcional: No asignado.');
  }

  if (r.respuestaOficial?.nota) {
    lineasContexto.push(
      '',
      'RESPUESTA OFICIAL PREVIA (contenido escrito por un funcionario):',
      MARK_OPEN_FUNCIONARIO,
      prepararContenidoNoConfiable(r.respuestaOficial.nota),
      MARK_CLOSE_FUNCIONARIO,
    );
  }

  const lineasCompetencia = [
    '',
    `COMPETENCIA DE LA DEPENDENCIA (${dependencia})`,
    competencia
      ? `- Ámbito general:\n  - ${competencia.competenciasGenerales.join('\n  - ')}`
      : '- Sin matriz de competencias configurada para esta dependencia.',
    '',
    'EVALUACIÓN AUTOMÁTICA DE COMPETENCIA',
    `- Nivel: ${evaluacion.nivelConfianza}`,
    `- Razón: ${evaluacion.razon}`,
    evaluacion.dependenciaSugerida ? `- Dependencia sugerida: ${NOMBRES_TENANT[evaluacion.dependenciaSugerida] ?? evaluacion.dependenciaSugerida}` : '- Dependencia sugerida: ninguna',
    `- Requiere escalamiento: ${evaluacion.requiereEscalamiento ? 'Sí' : 'No'}`,
    `- Requiere revisión jurídica: ${evaluacion.requiereRevisionJuridica ? 'Sí' : 'No'}`,
  ];

  const lineasTrazabilidad = [
    '',
    `TRAZABILIDAD RECIENTE (últimos ${trazaResumida.length} eventos)`,
    ...trazaResumida.flatMap((t) => [
      `- ${t.fecha} · ${t.accion} · ${t.actorNombre} · nota (contenido escrito por un funcionario):`,
      MARK_OPEN_FUNCIONARIO,
      prepararContenidoNoConfiable(t.nota),
      MARK_CLOSE_FUNCIONARIO,
    ]),
  ];

  const lineasUsuario = [
    '',
    'USUARIO QUE CONSULTA',
    `- Rol: ${usuario.rol}`,
    `- Dependencia: ${NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId}`,
  ];

  const bloqueTexto = [
    ...lineasContexto,
    ...lineasCompetencia,
    ...lineasTrazabilidad,
    ...lineasUsuario,
  ].join('\n');

  return {
    meta: {
      radicadoId:        r.radicadoId,
      tipoSolicitud:     r.termino.tipoSolicitudNombre,
      tipoSolicitudId:   r.termino.tipoSolicitudId,
      categoriaSolicitud: definicionTipo?.categoria ?? 'NO_REGISTRADA',
      terminoDias:       r.termino.diasRespuesta,
      tipoDias:          r.termino.unidad,
      dependenciaSugeridaTipo,
      requiereValidacionJuridica: requiereValidacion,
      heredadoSistemaActual: heredadoSistema,
      asunto:            r.detalle.asunto,
      descripcionResumen: r.detalle.descripcion.length > 220
        ? `${r.detalle.descripcion.slice(0, 219)}…`
        : r.detalle.descripcion,
      estadoActual:      r.estadoActual,
      fechaRadicacion:   r.control.fechaRadicado,
      fechaLimite:       r.termino.fechaVencimiento,
      diasRestantes:     dias,
      estadoTermino,
      canalRespuesta:    r.canalRespuesta ?? 'No registrado',
      dependenciaActual: dependencia,
      competenciasDependencia: competencia?.competenciasGenerales ?? [],
      evaluacionCompetencia: evaluacion,
      responsable:       r.clasificacion.funcionarioResponsableNombre ?? 'No asignado',
      esAnonimo:         r.esAnonimo === true,
      esReservado:       r.tipoPresentacion === 'RESERVADA' || r.identidadReservada === true,
      tieneCorreo:       Boolean(r.solicitante.email),
      anexosCount:       r.archivos.length,
      tieneRespuestaPrevia: Boolean(r.respuestaOficial?.nota?.trim()),
      prorrogasAplicadas: r.termino.prorrogasAplicadas,
      usuario: {
        rol:        usuario.rol,
        dependencia: NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId,
      },
    },
    trazabilidadResumida: trazaResumida,
    bloqueTexto,
  };
}
