import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { ChecklistMipg, NivelRiesgoJuridico } from '@/src/types/simi-juridico';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

/**
 * Sprint SIMI copiloto (Fase 1) — la lógica pura del copiloto.
 *
 * SIMI se presenta como un colega experto con un repertorio corto y
 * predecible: Entiende, Redacta, Verifica, Aprende. Este helper arma
 * lo que el copiloto "entiende" del caso a partir del análisis que ya
 * vive en el radicado (sin llamar a la IA), la config de las tres
 * salidas del botón estrella (respuesta / resumen / argumentación) y
 * la normalización de las credenciales (riesgo, checklist MIPG) que
 * acompañan cada borrador — lo que convierte "texto de IA" en un
 * borrador confiable.
 *
 * Principio sagrado intacto: SIMI sugiere; la persona revisa, aprueba
 * y firma. El único camino de salida es la pestaña Responder.
 *
 * Funciones puras: sin React, sin Firestore, sin fetch. `ahora` inyectable.
 */

/* ── Lo que Simi entiende del caso (Entiende) ── */

export interface EntendimientoCaso {
  /** Resumen en lenguaje humano de lo que pide el ciudadano. */
  resumen:        string;
  /** "Petición general · 15d hábiles" — para el chip. */
  chipTramite:    string;
  /** Días hábiles restantes; negativo si venció. */
  diasRestantes:  number;
  /** Confianza de la clasificación (0–100); null si no hay análisis. */
  confianzaPct:   number | null;
  /** Dependencia que la IA sugirió, legible; null sin análisis. */
  dependenciaSugerida: string | null;
  /** True si el radicado ya trae análisis de IA. */
  tieneAnalisis:  boolean;
}

export function resumirEntendimiento(
  radicado: VentanillaRadicado,
  ahora: Date = new Date(),
): EntendimientoCaso {
  const analisis = radicado.analisisIa ?? null;
  const dias = radicado.termino?.fechaVencimiento
    ? diasRestantesHabiles(radicado.termino.fechaVencimiento, ahora)
    : 0;

  const tipoNombre = radicado.termino?.tipoSolicitudNombre?.trim() || 'Solicitud';
  const dr = radicado.termino?.diasRespuesta;
  const unidad = radicado.termino?.unidad === 'CALENDARIO' ? 'calendario' : 'hábiles';
  const chipTramite = dr ? `${tipoNombre} · ${dr}d ${unidad}` : tipoNombre;

  const resumen = analisis?.resumenEjecutivo?.trim()
    || radicado.detalle?.descripcion?.trim()
    || radicado.detalle?.asunto?.trim()
    || 'Sin descripción registrada.';

  const conf = analisis?.confianzaClasificacion;
  const confianzaPct = typeof conf === 'number' && conf >= 0 && conf <= 1
    ? Math.round(conf * 100)
    : null;

  const depSug = analisis?.dependenciaSugerida
    ? (NOMBRES_TENANT[analisis.dependenciaSugerida] ?? analisis.dependenciaSugerida)
    : null;

  return {
    resumen,
    chipTramite,
    diasRestantes: dias,
    confianzaPct,
    dependenciaSugerida: depSug,
    tieneAnalisis: Boolean(analisis),
  };
}

/* ── Las tres salidas del botón estrella (Redacta) ── */

export type SalidaCopiloto = 'RESPUESTA' | 'RESUMEN' | 'ARGUMENTACION';

export interface SalidaConfig {
  id:      SalidaCopiloto;
  label:   string;
  /** Qué produce, en una línea, para el funcionario. */
  ayuda:   string;
  /** Modo del endpoint /api/simi/juridico que la respalda. */
  modo:    'proyectar_respuesta' | 'analizar_solicitud' | 'fundamento_normativo';
  /** true = su salida es un borrador adoptable en Responder. */
  adoptable: boolean;
}

const SALIDAS: SalidaConfig[] = [
  {
    id: 'RESPUESTA',
    label: 'Respuesta jurídica',
    ayuda: 'Borrador formal con fundamento normativo y checklist MIPG.',
    modo: 'proyectar_respuesta',
    adoptable: true,
  },
  {
    id: 'RESUMEN',
    label: 'Resumen del caso',
    ayuda: 'Un resumen breve para el jefe, el comité o tu propia lectura.',
    modo: 'analizar_solicitud',
    adoptable: false,
  },
  {
    id: 'ARGUMENTACION',
    label: 'Argumentación',
    ayuda: 'Los puntos de sustento y las normas aplicables antes de redactar.',
    modo: 'fundamento_normativo',
    adoptable: false,
  },
];

/** Salidas disponibles para el rol: Recepción/Funcionario/Admin redactan;
 *  Jefe y Control Interno se quedan con resumen y argumentación (lectura). */
export function salidasParaRol(rol: RolInterno): SalidaConfig[] {
  const puedeRedactar = rol === 'ADMIN' || rol === 'RECEPCIONISTA' || rol === 'FUNCIONARIO';
  return SALIDAS.filter((s) => s.id !== 'RESPUESTA' || puedeRedactar);
}

/* ── Credenciales del borrador (Verifica) ── */

export interface CheckMipg {
  label: string;
  ok:    boolean;
}

export interface ResumenChecklist {
  items:    CheckMipg[];
  /** Cuántos de los criterios objetivos están en verde. */
  cumplidos: number;
  total:     number;
  /** true si todos los criterios objetivos pasan. */
  todoEnVerde: boolean;
  /** SIMI marcó que el caso necesita ojo de un abogado. */
  requiereRevisionJuridica: boolean;
}

/** Normaliza el checklist MIPG a items legibles + conteo, ocultando
 *  las banderas internas del cálculo (revisión jurídica, observaciones). */
export function resumirChecklist(c: ChecklistMipg): ResumenChecklist {
  const items: CheckMipg[] = [
    { label: 'Identifica al peticionario', ok: c.claridad === true },
    { label: 'Responde de fondo',          ok: c.respuestaFondo === true },
    { label: 'Dentro del término',         ok: c.oportunidad === true },
    { label: 'Es competente',              ok: c.competencia === true },
    { label: 'Trazabilidad completa',      ok: c.trazabilidad === true },
    { label: 'Protege datos personales',   ok: c.proteccionDatos === true },
    { label: 'Gestión documental',         ok: c.gestionDocumental === true },
  ];
  const cumplidos = items.filter((i) => i.ok).length;
  return {
    items,
    cumplidos,
    total: items.length,
    todoEnVerde: cumplidos === items.length,
    requiereRevisionJuridica: c.requiereRevisionJuridica === true,
  };
}

export interface RiesgoResumen {
  label: string;
  tono:  'VERDE' | 'AMBAR' | 'ROJO';
}

/** Riesgo jurídico legible para el chip del borrador. */
export function resumirRiesgo(nivel: NivelRiesgoJuridico | null | undefined): RiesgoResumen | null {
  if (!nivel) return null;
  switch (nivel) {
    case 'bajo':  return { label: 'Riesgo jurídico bajo',  tono: 'VERDE' };
    case 'medio': return { label: 'Riesgo jurídico medio', tono: 'AMBAR' };
    case 'alto':  return { label: 'Riesgo jurídico alto',  tono: 'ROJO' };
  }
}
