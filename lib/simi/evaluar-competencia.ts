import type { TenantId } from '@/src/types/radicado';
import { obtenerCompetencia, COMPETENCIAS_DEPENDENCIAS } from './competencias-dependencias';

/* ══════════════════════════════════════════════════════════════
   evaluarCompetenciaRadicado — Función pura

   Evalúa si la dependencia actualmente asignada al radicado parece
   competente para responderlo. NO toma decisiones; sirve como input
   para SIMI y para que el funcionario decida si reasignar.

   Heurística simple:
   - Se construye un texto de búsqueda con asunto + descripción +
     tipo de solicitud (lowercased, sin acentos).
   - Se cuenta:
       hitsActual         = matches contra temasFrecuentes de la
                            dependencia asignada.
       hitsNoCompetente   = matches contra noEsCompetentePara de la
                            dependencia asignada.
       hitsPorDependencia = matches contra temasFrecuentes de cada
                            otra dependencia.
   - Resultado:
       ALTO   si hitsActual ≥ 2 y ninguna otra dependencia tiene más hits.
       MEDIO  si hitsActual ≥ 1 o si la actual gana por margen pequeño.
       BAJO   si hitsActual === 0 y alguna otra dependencia tiene hits.
       DUDOSO si el texto es muy pobre (< 20 chars de descripción) o
              ninguna dependencia obtiene hits.
   - Si hay match con `noEsCompetentePara`, baja al menos a MEDIO y
     marca `requiereEscalamiento: true`.
   - Si hay match con `requiereRevisionJuridicaCuando`, marca
     `requiereRevisionJuridica: true`.

   Esta función NO reemplaza el juicio humano; el funcionario siempre
   decide. Devuelve además `razon` legible para que SIMI o el panel
   puedan mostrarla.
══════════════════════════════════════════════════════════════ */

export interface EntradaEvaluacion {
  dependenciaActual: TenantId;
  asunto:            string;
  descripcion:       string;
  tipoSolicitudNombre?: string;
}

export type NivelConfianza = 'ALTO' | 'MEDIO' | 'BAJO';

export interface EvaluacionCompetencia {
  esCompetente:             boolean | 'DUDOSO';
  nivelConfianza:           NivelConfianza | 'DUDOSO';
  razon:                    string;
  dependenciaActual:        TenantId;
  dependenciaSugerida?:     TenantId;
  requiereEscalamiento:     boolean;
  requiereRevisionJuridica: boolean;
  advertencias:             string[];
}

/** Normaliza para búsquedas: minúsculas + sin diacríticos. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function contarMatches(texto: string, frases: string[]): number {
  let n = 0;
  for (const frase of frases) {
    const needle = normalizar(frase);
    if (needle.length < 3) continue;
    if (texto.includes(needle)) n += 1;
  }
  return n;
}

export function evaluarCompetenciaRadicado(
  entrada: EntradaEvaluacion,
): EvaluacionCompetencia {
  const { dependenciaActual, asunto, descripcion, tipoSolicitudNombre = '' } = entrada;
  const competenciaActual = obtenerCompetencia(dependenciaActual);

  const textoSinNormalizar = `${asunto} ${descripcion} ${tipoSolicitudNombre}`.trim();
  const texto = normalizar(textoSinNormalizar);

  const advertencias: string[] = [];
  let requiereRevisionJuridica = false;

  // Caso 1 — sin matriz para la dependencia actual
  if (!competenciaActual) {
    return {
      esCompetente: 'DUDOSO',
      nivelConfianza: 'DUDOSO',
      razon: `No existe matriz de competencias para la dependencia "${dependenciaActual}". Se recomienda validar manualmente.`,
      dependenciaActual,
      requiereEscalamiento: false,
      requiereRevisionJuridica: false,
      advertencias: ['Dependencia sin matriz de competencias configurada.'],
    };
  }

  // Caso 2 — información muy pobre para evaluar
  if (descripcion.trim().length < 20) {
    return {
      esCompetente: 'DUDOSO',
      nivelConfianza: 'DUDOSO',
      razon: 'La descripción del radicado es demasiado corta para evaluar competencia con razonable certeza. Se recomienda revisión humana.',
      dependenciaActual,
      requiereEscalamiento: false,
      requiereRevisionJuridica: false,
      advertencias: ['Información insuficiente para clasificación automática.'],
    };
  }

  // Conteo de matches
  const hitsActual       = contarMatches(texto, competenciaActual.temasFrecuentes);
  const hitsNoCompetente = contarMatches(texto, competenciaActual.noEsCompetentePara);

  // Revisión jurídica
  if (competenciaActual.requiereRevisionJuridicaCuando) {
    const hitsJuridica = contarMatches(texto, competenciaActual.requiereRevisionJuridicaCuando);
    if (hitsJuridica > 0) {
      requiereRevisionJuridica = true;
      advertencias.push('La solicitud sugiere riesgo jurídico — recomendable validación con asesoría jurídica antes de responder.');
    }
  }

  // Mejor dependencia alternativa
  let mejorAlternativa: { tenantId: TenantId; hits: number } | null = null;
  for (const [tid, comp] of Object.entries(COMPETENCIAS_DEPENDENCIAS) as [TenantId, typeof competenciaActual][]) {
    if (tid === dependenciaActual) continue;
    const h = contarMatches(texto, comp.temasFrecuentes);
    if (h > 0 && (mejorAlternativa === null || h > mejorAlternativa.hits)) {
      mejorAlternativa = { tenantId: tid, hits: h };
    }
  }

  // Decisión de nivel
  let nivelConfianza: NivelConfianza | 'DUDOSO' = 'DUDOSO';
  let esCompetente: boolean | 'DUDOSO' = 'DUDOSO';
  let razon = '';
  let dependenciaSugerida: TenantId | undefined;
  let requiereEscalamiento = false;

  if (hitsNoCompetente > 0) {
    // Conflicto explícito — siempre escalable
    esCompetente = false;
    nivelConfianza = 'BAJO';
    requiereEscalamiento = true;
    razon = `La solicitud incluye temas que la dependencia "${competenciaActual.nombre}" declara que NO son de su competencia (${hitsNoCompetente} coincidencia${hitsNoCompetente === 1 ? '' : 's'}).`;
    if (mejorAlternativa) {
      dependenciaSugerida = mejorAlternativa.tenantId;
    } else if (competenciaActual.debeEscalarA && competenciaActual.debeEscalarA.length > 0) {
      dependenciaSugerida = competenciaActual.debeEscalarA[0];
    }
  } else if (hitsActual >= 2 && (!mejorAlternativa || mejorAlternativa.hits <= hitsActual)) {
    esCompetente = true;
    nivelConfianza = 'ALTO';
    razon = `La solicitud encaja claramente con los temas frecuentes de "${competenciaActual.nombre}" (${hitsActual} coincidencias).`;
  } else if (hitsActual >= 1 || (mejorAlternativa && mejorAlternativa.hits <= hitsActual + 1)) {
    esCompetente = true;
    nivelConfianza = 'MEDIO';
    razon = mejorAlternativa
      ? `La dependencia "${competenciaActual.nombre}" coincide parcialmente, pero "${COMPETENCIAS_DEPENDENCIAS[mejorAlternativa.tenantId].nombre}" también podría ser competente. Recomendable validar con el jefe de dependencia.`
      : `La dependencia "${competenciaActual.nombre}" coincide parcialmente con la solicitud. Se recomienda revisión humana.`;
    if (mejorAlternativa) dependenciaSugerida = mejorAlternativa.tenantId;
  } else if (mejorAlternativa) {
    esCompetente = false;
    nivelConfianza = 'BAJO';
    requiereEscalamiento = true;
    razon = `La solicitud no encaja con los temas frecuentes de "${competenciaActual.nombre}", pero sí con "${COMPETENCIAS_DEPENDENCIAS[mejorAlternativa.tenantId].nombre}" (${mejorAlternativa.hits} coincidencia${mejorAlternativa.hits === 1 ? '' : 's'}). Se sugiere reasignación.`;
    dependenciaSugerida = mejorAlternativa.tenantId;
  } else {
    esCompetente = 'DUDOSO';
    nivelConfianza = 'DUDOSO';
    razon = `No se detectaron coincidencias con los temas frecuentes de ninguna dependencia. Se recomienda revisión humana por Ventanilla Única.`;
    advertencias.push('No fue posible evaluar competencia automáticamente.');
  }

  // Advertencias específicas de la dependencia
  for (const a of competenciaActual.advertencias) advertencias.push(a);

  return {
    esCompetente,
    nivelConfianza,
    razon,
    dependenciaActual,
    dependenciaSugerida,
    requiereEscalamiento,
    requiereRevisionJuridica,
    advertencias,
  };
}
