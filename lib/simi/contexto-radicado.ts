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
    `- Asunto: ${sanitizarPiiTextoSimi(r.detalle.asunto)}`,
    `- Descripción: ${sanitizarPiiTextoSimi(r.detalle.descripcion)}`,
    `- Estado actual: ${r.estadoActual}`,
    `- Fecha de radicación: ${r.control.fechaRadicado}`,
    `- Fecha límite: ${r.termino.fechaVencimiento}`,
    `- Días restantes (hábiles): ${dias} (${estadoTermino})`,
    `- Canal de respuesta del ciudadano: ${r.canalRespuesta ?? 'No registrado'}`,
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
    lineasContexto.push('', 'RESPUESTA OFICIAL PREVIA:', sanitizarPiiTextoSimi(r.respuestaOficial.nota));
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
    ...trazaResumida.map((t) => `- ${t.fecha} · ${t.accion} · ${t.actorNombre} · ${sanitizarPiiTextoSimi(t.nota)}`),
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
