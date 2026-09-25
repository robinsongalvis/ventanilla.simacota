/**
 * Plantillas oficiales base para el sistema PQRSD de la Alcaldía de Simacota.
 * Se cargan como seed en la colección plantillas_respuesta.
 */

import type { ResponseTemplate } from '@/src/types/simi-normograma';

type TemplateBase = Omit<ResponseTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;

export const BASE_TEMPLATES: TemplateBase[] = [
  {
    nombre:                    'Respuesta de fondo — general',
    dependencia:               'TODAS',
    tipo_solicitud:            'TODOS',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'bajo',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{dependencia}}', '{{fecha}}', '{{asunto}}', '{{funcionario}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
{{dependencia}}
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Respuesta a solicitud — Radicado {{radicadoId}}

Respetado(a) señor(a):

En atención a la solicitud radicada bajo el número {{radicadoId}}, relacionada con: {{asunto}}, nos permitimos dar respuesta de fondo:

[CUERPO DE LA RESPUESTA — Diligenciar según el caso específico]

Esperando haber atendido satisfactoriamente su solicitud y en cumplimiento del derecho fundamental de petición consagrado en la Ley 1755 de 2015, quedamos atentos a cualquier inquietud adicional.

Cordialmente,

{{funcionario}}
[Cargo]
{{dependencia}}
Alcaldía Municipal de Simacota

NOTA INTERNA: Borrador sujeto a revisión y aprobación del funcionario competente.`,
  },
  {
    nombre:                    'Solicitud de aclaración o información adicional',
    dependencia:               'TODAS',
    tipo_solicitud:            'TODOS',
    modo_simi:                 'solicitud_aclaracion',
    riesgo_aplicable:          'todos',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{dependencia}}', '{{fecha}}', '{{datosFaltantes}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
{{dependencia}}
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Solicitud de información complementaria — Radicado {{radicadoId}}

Respetado(a) señor(a):

Recibida su solicitud radicada bajo el número {{radicadoId}}, esta dependencia necesita información adicional para dar respuesta de fondo. Por lo anterior, respetuosamente le solicitamos:

{{datosFaltantes}}

Su solicitud continúa en trámite y será atendida una vez contemos con la información solicitada.

Cordialmente,

[Funcionario responsable]
[Cargo]
{{dependencia}}

NOTA INTERNA: Borrador sujeto a revisión. Esta comunicación no constituye respuesta de fondo.`,
  },
  {
    nombre:                    'Traslado por competencia',
    dependencia:               'TODAS',
    tipo_solicitud:            'TODOS',
    modo_simi:                 'traslado_competencia',
    riesgo_aplicable:          'todos',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{dependenciaDestino}}', '{{motivoTraslado}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Ventanilla Única
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Traslado por competencia — Radicado {{radicadoId}}

Respetado(a) señor(a):

En atención a la solicitud radicada bajo el número {{radicadoId}}, esta entidad informa que el asunto planteado corresponde a la competencia de: {{dependenciaDestino}}.

Motivo del traslado: {{motivoTraslado}}

De conformidad con el artículo 21 de la Ley 1755 de 2015, se procede a trasladar la solicitud dentro de los diez (10) días hábiles siguientes a su recepción, sin perjuicio de dar aviso al peticionario.

Cordialmente,

[Funcionario]
Ventanilla Única — Alcaldía de Simacota

NOTA INTERNA: Borrador sujeto a revisión. Validar competencia antes de ejecutar el traslado.`,
  },
  {
    nombre:                    'Respuesta negativa motivada',
    dependencia:               'TODAS',
    tipo_solicitud:            'TODOS',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'alto',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{dependencia}}', '{{fundamentoNegativa}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: true,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
{{dependencia}}
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Respuesta — Radicado {{radicadoId}}

Respetado(a) señor(a):

En atención a su solicitud, esta dependencia informa que no es posible acceder a lo peticionado, con fundamento en:

{{fundamentoNegativa}}

Esta decisión no es definitiva y puede ser objeto de los recursos de ley previstos en el Código de Procedimiento Administrativo y de lo Contencioso Administrativo (Ley 1437 de 2011).

Cordialmente,

[Funcionario]
[Cargo]
{{dependencia}}

⚠️ NOTA INTERNA: Este borrador requiere REVISIÓN JURÍDICA OBLIGATORIA antes de ser firmado y enviado. Toda respuesta negativa debe estar debidamente motivada y sustentada en norma vigente.`,
  },
  {
    nombre:                    'Respuesta con información pública',
    dependencia:               'TODAS',
    tipo_solicitud:            'Solicitud de información',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'bajo',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{informacion}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Entrega de información pública — Radicado {{radicadoId}}

Respetado(a) señor(a):

En cumplimiento de la Ley 1712 de 2014 de Transparencia y Acceso a la Información Pública Nacional, nos permitimos suministrar la información solicitada:

{{informacion}}

La información entregada es de carácter público. Si requiere información adicional, puede acceder a nuestro sitio web o comunicarse con la Ventanilla Única.

Cordialmente,

[Funcionario]
Alcaldía Municipal de Simacota`,
  },
  {
    nombre:                    'Respuesta con reserva legal',
    dependencia:               'TODAS',
    tipo_solicitud:            'Solicitud de información',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'alto',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{fundamentoReserva}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: true,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Información con reserva legal — Radicado {{radicadoId}}

Respetado(a) señor(a):

La información solicitada en el radicado {{radicadoId}} se encuentra bajo reserva legal, con fundamento en:

{{fundamentoReserva}}

De conformidad con los artículos 18 y 19 de la Ley 1712 de 2014, esta información no puede ser entregada al solicitante en las condiciones actuales.

Puede interponer los recursos de ley si considera que la reserva aplicada no es procedente.

⚠️ NOTA INTERNA: Requiere revisión jurídica antes de firmar.`,
  },
  {
    nombre:                    'Comunicación de visita técnica',
    dependencia:               'SEC_PLANEACION',
    tipo_solicitud:            'Solicitud de visita técnica',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'medio',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{fechaVisita}}', '{{direccion}}', '{{funcionarioVisita}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Secretaría de Planeación
Simacota, {{fechaVisita}}

Señor(a):
{{ciudadano}}

ASUNTO: Programación de visita técnica — Radicado {{radicadoId}}

Respetado(a) señor(a):

En atención a su solicitud, nos permitimos informar que la visita técnica al predio ubicado en {{direccion}} ha sido programada para el día {{fechaVisita}}.

El funcionario comisionado para la visita es: {{funcionarioVisita}}.

Por favor esté disponible en el lugar y tenga a mano los documentos pertinentes.

Cordialmente,

[Funcionario]
Secretaría de Planeación
Alcaldía Municipal de Simacota`,
  },
  {
    nombre:                    'Respuesta a queja ciudadana',
    dependencia:               'TODAS',
    tipo_solicitud:            'Queja',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'medio',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{hechos}}', '{{accionesTomadas}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Respuesta a queja — Radicado {{radicadoId}}

Respetado(a) señor(a):

Hemos recibido y analizado la queja presentada relacionada con: {{hechos}}.

Luego de la revisión interna correspondiente, se tomaron las siguientes acciones: {{accionesTomadas}}.

La Alcaldía Municipal de Simacota reafirma su compromiso con la prestación de servicios de calidad y agradece su contribución para la mejora continua institucional.

Cordialmente,

[Funcionario]
Alcaldía Municipal de Simacota`,
  },
  {
    nombre:                    'Respuesta a reclamo',
    dependencia:               'TODAS',
    tipo_solicitud:            'Reclamo',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'medio',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{motivoReclamo}}', '{{resolucion}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Respuesta a reclamo — Radicado {{radicadoId}}

Respetado(a) señor(a):

En relación con el reclamo presentado sobre: {{motivoReclamo}}, esta dependencia informa:

{{resolucion}}

Si no está de acuerdo con esta respuesta, podrá ejercer los recursos de ley previstos en la Ley 1437 de 2011.

Cordialmente,

[Funcionario]
Alcaldía Municipal de Simacota`,
  },
  {
    nombre:                    'Comunicación de trámite en curso',
    dependencia:               'TODAS',
    tipo_solicitud:            'TODOS',
    modo_simi:                 'proyectar_respuesta',
    riesgo_aplicable:          'bajo',
    variables:                 ['{{radicadoId}}', '{{ciudadano}}', '{{estadoTramite}}', '{{fechaEstimada}}', '{{fecha}}'],
    estado:                    'activa',
    version:                   '1.0',
    requiere_revision_juridica: false,
    contenido: `ALCALDÍA MUNICIPAL DE SIMACOTA
Simacota, {{fecha}}

Señor(a):
{{ciudadano}}

ASUNTO: Información sobre estado de trámite — Radicado {{radicadoId}}

Respetado(a) señor(a):

Le informamos que su solicitud radicada bajo el número {{radicadoId}} se encuentra actualmente en estado: {{estadoTramite}}.

Fecha estimada de respuesta definitiva: {{fechaEstimada}}.

Estaremos atentos a brindarle una respuesta de fondo dentro de los términos legales establecidos.

Cordialmente,

[Funcionario]
Ventanilla Única — Alcaldía Municipal de Simacota`,
  },
];

/**
 * Cargar plantillas base en Firestore para un tenant.
 * Solo ejecutar una vez por tenant (o si no existen plantillas).
 */
export async function seedBaseTemplates(
  tenantId: string,
  creadoPor: string,
): Promise<{ cargadas: number; errores: number }> {
  const { getFirebaseAdminDb } = await import('@/lib/firebase-admin');
  const db = getFirebaseAdminDb();
  const ahora = new Date().toISOString();

  let cargadas = 0;
  let errores = 0;

  for (const tpl of BASE_TEMPLATES) {
    try {
      await db.collection('plantillas_respuesta').add({
        ...tpl,
        tenantId,
        validado_por:     creadoPor,
        fecha_validacion: ahora,
        createdAt:        ahora,
        updatedAt:        ahora,
      });
      cargadas++;
    } catch {
      errores++;
    }
  }

  return { cargadas, errores };
}
