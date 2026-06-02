'use client';

/**
 * SimiJuridicoPanel — Panel jurídico-administrativo del asistente SIMI
 * Ventanilla Única Inteligente — Alcaldía de Simacota
 *
 * SIMI Jurídico apoya, orienta y advierte. No reemplaza al funcionario.
 * Toda respuesta es un borrador sujeto a revisión humana.
 */

import { useState } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';
import type {
  SimiModoJuridico,
  SimiJuridicoResponse,
  SimiAnalisisJuridico,
  SimiRevisionBorrador,
  SimiLenguajeClaro,
  ChecklistMipg,
  NormativaSugerida,
} from '@/src/types/simi-juridico';
import { LegalRiskBadge, RevisionJuridicaBanner } from './LegalRiskBadge';
import { MipgChecklistCard } from './MipgChecklistCard';
import { NormativeSourcesCard } from './NormativeSourcesCard';
import { RagSourcesPanel } from './RagSourcesPanel';
import type { RagSource } from '@/src/types/simi-rag';
import type { ApprovalFlowResult } from '@/src/types/simi-approval';

/* ══════════════════════════════════════════════════════════════
   MODOS DISPONIBLES
══════════════════════════════════════════════════════════════ */

interface ModoConfig {
  id:     SimiModoJuridico;
  label:  string;
  icono:  string;
  desc:   string;
  color:  string;
}

const MODOS: ModoConfig[] = [
  {
    id:    'analizar_solicitud',
    label: 'Analizar solicitud',
    icono: '🔍',
    desc:  'Clasifica la solicitud, identifica tipo, dependencia, términos, riesgo y checklist MIPG.',
    color: '#14532D',
  },
  {
    id:    'proyectar_respuesta',
    label: 'Proyectar respuesta',
    icono: '✍️',
    desc:  'Genera un borrador de respuesta institucional formal. Requiere revisión y aprobación.',
    color: '#14532D',
  },
  {
    id:    'revisar_borrador',
    label: 'Revisar borrador',
    icono: '⚖️',
    desc:  'Modo Abogado Revisor: evalúa un borrador antes de enviarlo.',
    color: '#166534',
  },
  {
    id:    'lenguaje_claro',
    label: 'Lenguaje claro',
    icono: '💬',
    desc:  'Convierte texto institucional a lenguaje ciudadano claro.',
    color: '#0369A1',
  },
  {
    id:    'riesgo_juridico',
    label: 'Riesgo jurídico',
    icono: '🚦',
    desc:  'Evalúa el nivel de riesgo jurídico-administrativo del caso.',
    color: '#B45309',
  },
  {
    id:    'checklist_mipg',
    label: 'Checklist MIPG',
    icono: '✅',
    desc:  'Verifica cumplimiento MIPG antes de enviar la respuesta.',
    color: '#14532D',
  },
  {
    id:    'fundamento_normativo',
    label: 'Fundamento normativo',
    icono: '📚',
    desc:  'Sugiere normas aplicables al caso (requiere validación humana).',
    color: '#14532D',
  },
  {
    id:    'traslado_competencia',
    label: 'Traslado competencia',
    icono: '🔄',
    desc:  'Genera borrador de traslado cuando la entidad no es competente.',
    color: '#B45309',
  },
  {
    id:    'solicitud_aclaracion',
    label: 'Pedir aclaración',
    icono: '❓',
    desc:  'Genera comunicación solicitando datos faltantes al ciudadano.',
    color: '#667085',
  },
  {
    id:    'datos_personales',
    label: 'Datos personales',
    icono: '🔒',
    desc:  'Detecta información personal o sensible en la solicitud o borrador.',
    color: '#DC2626',
  },
  {
    id:    'escalar_juridica',
    label: 'Escalar a jurídico',
    icono: '🚨',
    desc:  'Marca el caso como revisión jurídica obligatoria y genera instrucciones.',
    color: '#DC2626',
  },
];

/* ══════════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════════ */

interface SimiJuridicoPanelProps {
  radicado:            VentanillaRadicado;
  usuario:             UsuarioAutenticado;
  onAdoptarRespuesta?: (texto: string) => void;
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTES
══════════════════════════════════════════════════════════════ */

function AnalisisView({ analisis }: { analisis: SimiAnalisisJuridico }) {
  return (
    <div className="space-y-3">
      {/* Tipo y tema */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#94A3B8' }}>Tipo principal</p>
          <p className="text-xs font-bold" style={{ color: '#1F2933' }}>{analisis.tipoSolicitudPrincipal}</p>
        </div>
        {analisis.tiposSecundarios?.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Tipos secundarios</p>
            <div className="flex flex-wrap gap-1">
              {analisis.tiposSecundarios.map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                      style={{ background: '#F8FAF7', border: '1px solid #D9E2D9', color: '#667085' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#94A3B8' }}>Tema central</p>
          <p className="text-xs" style={{ color: '#667085' }}>{analisis.temaCentral}</p>
        </div>
      </div>

      {/* Dependencia y término */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Dependencia sugerida</p>
          <p className="text-[11px] font-bold" style={{ color: '#14532D' }}>{analisis.dependenciaSugerida}</p>
          {analisis.motivoDependencia && (
            <p className="text-[10px] mt-0.5 leading-snug" style={{ color: '#94A3B8' }}>{analisis.motivoDependencia}</p>
          )}
        </div>
        <div className="rounded-lg p-2.5" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Término probable</p>
          <p className="text-[11px] font-bold" style={{ color: '#1F2933' }}>{analisis.terminoProbable}</p>
          {analisis.fechaLimiteProbable && (
            <p className="text-[10px] mt-0.5" style={{ color: '#D97706' }}>Límite: {analisis.fechaLimiteProbable}</p>
          )}
        </div>
      </div>

      {/* Datos faltantes */}
      {analisis.datosFaltantes?.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-amber-700">Datos faltantes</p>
          <ul className="space-y-0.5">
            {analisis.datosFaltantes.map((d, i) => (
              <li key={i} className="text-[11px] text-amber-700">• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ruta interna */}
      {analisis.rutaInternaRecomendada && (
        <div className="rounded-lg p-3" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Ruta interna recomendada</p>
          <p className="text-[11px] leading-snug" style={{ color: '#1F2933' }}>{analisis.rutaInternaRecomendada}</p>
        </div>
      )}

      {/* Normas */}
      {analisis.fundamentosNormativos?.length > 0 && (
        <NormativeSourcesCard fuentes={analisis.fundamentosNormativos} />
      )}

      {/* Checklist */}
      {analisis.checklistMipg && (
        <MipgChecklistCard checklist={analisis.checklistMipg} />
      )}
    </div>
  );
}

function RevisionView({ revision, onAdoptar }: { revision: SimiRevisionBorrador; onAdoptar?: (t: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Diagnóstico</p>
        <p className="text-xs leading-relaxed" style={{ color: '#1F2933' }}>{revision.diagnostico}</p>
      </div>

      {revision.riesgosDetectados?.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-red-700">Riesgos detectados</p>
          {revision.riesgosDetectados.map((r, i) => (
            <p key={i} className="text-[11px] text-red-700 leading-snug">• {r}</p>
          ))}
        </div>
      )}

      {revision.mejorasSugeridas?.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#14532D' }}>Mejoras sugeridas</p>
          {revision.mejorasSugeridas.map((m, i) => (
            <p key={i} className="text-[11px] leading-snug" style={{ color: '#1F2933' }}>• {m}</p>
          ))}
        </div>
      )}

      {revision.versionMejorada && (
        <div className="space-y-2">
          <div className="rounded-xl bg-white p-3" style={{ border: '1px solid #D9E2D9' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#14532D' }}>Versión mejorada</p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2933' }}>
              {revision.versionMejorada}
            </p>
          </div>
          {onAdoptar && (
            <button onClick={() => onAdoptar(revision.versionMejorada!)}
              className="w-full py-2 rounded-lg text-white text-xs font-bold"
              style={{ background: '#14532D' }}>
              Adoptar versión mejorada
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg p-3" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Recomendación final</p>
        <p className="text-xs font-semibold" style={{ color: '#1F2933' }}>{revision.recomendacionFinal}</p>
      </div>

      {revision.checklistMipg && <MipgChecklistCard checklist={revision.checklistMipg} />}
    </div>
  );
}

function LenguajeClaroView({ resultado, onAdoptar }: { resultado: SimiLenguajeClaro; onAdoptar?: (t: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-3" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#14532D' }}>
          Versión en lenguaje claro
        </p>
        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2933' }}>
          {resultado.versionLenguajeClaro}
        </p>
      </div>

      {onAdoptar && (
        <button onClick={() => onAdoptar(resultado.versionLenguajeClaro)}
          className="w-full py-2 rounded-lg text-white text-xs font-bold"
          style={{ background: '#14532D' }}>
          Adoptar versión en lenguaje claro
        </button>
      )}

      {resultado.cambiosRealizados?.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#14532D' }}>Cambios realizados</p>
          {resultado.cambiosRealizados.map((c, i) => (
            <p key={i} className="text-[11px]" style={{ color: '#667085' }}>• {c}</p>
          ))}
        </div>
      )}

      {resultado.advertenciasPrecision?.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-amber-700">Advertencias de precisión</p>
          {resultado.advertenciasPrecision.map((a, i) => (
            <p key={i} className="text-[11px] text-amber-700">• {a}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

export function SimiJuridicoPanel({
  radicado,
  onAdoptarRespuesta,
}: SimiJuridicoPanelProps) {
  const [modoActivo, setModoActivo]       = useState<SimiModoJuridico | null>(null);
  const [cargando,   setCargando]         = useState(false);
  const [respuesta,  setRespuesta]        = useState<SimiJuridicoResponse | null>(null);
  const [error,      setError]            = useState<string | null>(null);
  const [borrador,   setBorrador]         = useState('');
  const [useRag,     setUseRag]           = useState(false);
  const [createApproval, setCreateApproval] = useState(false);
  const [fuentesRag, setFuentesRag]       = useState<RagSource[]>([]);
  const [approvalResult, setApprovalResult] = useState<ApprovalFlowResult | null>(null);

  const modoNecesitaBorrador = (m: SimiModoJuridico | null) =>
    m === 'revisar_borrador' || m === 'lenguaje_claro' || m === 'datos_personales';

  async function ejecutar(modo: SimiModoJuridico) {
    setModoActivo(modo);
    setCargando(true);
    setError(null);
    setRespuesta(null);

    try {
      const res = await fetch('/api/simi/juridico', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          radicadoId:     radicado.radicadoId,
          modo,
          textoSolicitud: radicado.detalle.descripcion || radicado.detalle.asunto,
          borrador:       borrador.trim() || undefined,
          useRag,
          createApproval,
        }),
      });

      const data = await res.json() as SimiJuridicoResponse & {
        error?: string;
        fuentesRag?: RagSource[];
        aprobacion?: ApprovalFlowResult;
        usedRag?: boolean;
      };

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRespuesta(data);
      if (data.fuentesRag) setFuentesRag(data.fuentesRag);
      if (data.aprobacion) setApprovalResult(data.aprobacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar SIMI Jurídico.');
    } finally {
      setCargando(false);
    }
  }

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="rounded-xl p-3" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">⚖️</span>
          <p className="text-xs font-bold" style={{ color: '#14532D' }}>SIMI Jurídico-Administrativo</p>
        </div>
        <p className="text-[10px] leading-snug" style={{ color: '#667085' }}>
          Módulo de apoyo para análisis, clasificación y proyección de respuestas PQRSD.
          Todo resultado es un borrador sujeto a revisión humana.
        </p>
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid #D9E2D9' }}>
          <p className="text-[9px] italic" style={{ color: '#94A3B8' }}>
            SIMI Jurídico analiza, orienta y advierte riesgos, pero no reemplaza la revisión,
            aprobación ni firma del funcionario competente.
          </p>
        </div>
      </div>

      {/* Área de borrador (cuando aplica) */}
      {modoNecesitaBorrador(modoActivo) && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>
            {modoActivo === 'revisar_borrador'
              ? 'Pega el borrador a revisar'
              : modoActivo === 'lenguaje_claro'
                ? 'Texto a convertir'
                : 'Texto a analizar'}
          </p>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={4}
            placeholder={
              modoActivo === 'revisar_borrador'
                ? 'Pega aquí el borrador de respuesta que SIMI revisará...'
                : modoActivo === 'lenguaje_claro'
                  ? 'Pega aquí el texto institucional a convertir...'
                  : 'Pega aquí el texto a analizar...'
            }
            className="input-internal resize-none w-full"
          />
        </div>
      )}

      {/* Opciones avanzadas RAG + Aprobación */}
      <div className="rounded-lg p-3 space-y-2" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Opciones avanzadas</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            onClick={() => setUseRag(!useRag)}
            className="w-9 h-5 rounded-full p-0.5 transition-all duration-200 shrink-0"
            style={{ background: useRag ? '#14532D' : '#D9E2D9' }}>
            <div className="w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                 style={{ transform: useRag ? 'translateX(16px)' : 'translateX(0)' }} />
          </button>
          <span className="text-[11px]" style={{ color: '#1F2933' }}>Usar base jurídica validada (RAG)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            onClick={() => setCreateApproval(!createApproval)}
            className="w-9 h-5 rounded-full p-0.5 transition-all duration-200 shrink-0"
            style={{ background: createApproval ? '#14532D' : '#D9E2D9' }}>
            <div className="w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                 style={{ transform: createApproval ? 'translateX(16px)' : 'translateX(0)' }} />
          </button>
          <span className="text-[11px]" style={{ color: '#1F2933' }}>Crear flujo de aprobación humana</span>
        </label>
        {useRag && (
          <p className="text-[9px] italic" style={{ color: '#94A3B8' }}>
            Las fuentes normativas deben estar validadas para citarse como fundamento.
          </p>
        )}
      </div>

      {/* Grid de modos */}
      {!modoActivo || !respuesta ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>
            Selecciona una acción jurídica
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  if (modoNecesitaBorrador(m.id) && !borrador.trim()) {
                    setModoActivo(m.id);
                    return; // Solo selecciona el modo, no ejecuta aún
                  }
                  void ejecutar(m.id);
                }}
                disabled={cargando}
                className="flex items-start gap-2 p-2.5 rounded-lg text-left transition-all duration-150 disabled:opacity-40 active:scale-[0.98]"
                style={{ border: '1px solid #D9E2D9', background: '#F8FAF7' }}
                onMouseEnter={(e) => { if (!cargando) { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; (e.currentTarget as HTMLElement).style.borderColor = '#14532D'; } }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; (e.currentTarget as HTMLElement).style.borderColor = '#D9E2D9'; }}
              >
                <span className="text-sm shrink-0 mt-0.5">{m.icono}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold leading-tight" style={{ color: '#1F2933' }}>{m.label}</p>
                  <p className="text-[9px] leading-snug mt-0.5" style={{ color: '#94A3B8' }}>{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Ejecutar si hay modo seleccionado que requiere borrador */}
          {modoActivo && modoNecesitaBorrador(modoActivo) && borrador.trim() && (
            <button
              onClick={() => void ejecutar(modoActivo)}
              disabled={cargando}
              className="mt-2 w-full py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40"
              style={{ background: '#14532D' }}>
              Ejecutar: {MODOS.find(m => m.id === modoActivo)?.label}
            </button>
          )}
        </div>
      ) : null}

      {/* Loading */}
      {cargando && (
        <div className="flex items-center justify-center gap-3 py-5 rounded-xl" style={{ background: '#EEF4EE' }}>
          <span className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
          <p className="text-xs animate-pulse" style={{ color: '#14532D' }}>
            SIMI Jurídico está analizando...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-3 text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <p className="font-bold">Error:</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Resultado */}
      {respuesta && !cargando && (
        <div className="space-y-3">
          {/* Header del resultado */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                {MODOS.find(m => m.id === respuesta.modo)?.icono}{' '}
                {MODOS.find(m => m.id === respuesta.modo)?.label}
              </p>
              {respuesta.nivelRiesgo && (
                <LegalRiskBadge nivel={respuesta.nivelRiesgo} pulse={true} />
              )}
            </div>
            <button
              onClick={() => { setRespuesta(null); setModoActivo(null); setFuentesRag([]); setApprovalResult(null); }}
              className="text-[10px] font-semibold transition-colors"
              style={{ color: '#94A3B8' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#667085'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
            >
              ← Volver
            </button>
          </div>

          {/* Advertencias */}
          {respuesta.advertencias?.length > 0 && (
            <div className="space-y-1.5">
              {respuesta.advertencias.map((adv, i) => (
                <div key={i} className="px-3 py-2 rounded-lg text-[11px]"
                     style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
                  ⚠️ {adv}
                </div>
              ))}
            </div>
          )}

          {/* Banner revisión jurídica obligatoria */}
          {respuesta.nivelRiesgo === 'alto' && <RevisionJuridicaBanner />}

          {/* Resultado según modo */}
          {respuesta.modo === 'analizar_solicitud' && (
            <AnalisisView analisis={respuesta.resultado as SimiAnalisisJuridico} />
          )}

          {(respuesta.modo === 'proyectar_respuesta' ||
            respuesta.modo === 'traslado_competencia' ||
            respuesta.modo === 'solicitud_aclaracion') && (
            <div className="space-y-2">
              <div className="rounded-xl bg-white p-3" style={{ border: '1px solid #D9E2D9' }}>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2933', fontFamily: 'inherit' }}>
                  {respuesta.resultado as string}
                </pre>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(respuesta.resultado as string)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{ border: '1px solid #D9E2D9', background: '#F8FAF7', color: '#667085' }}>
                  Copiar borrador
                </button>
                {onAdoptarRespuesta && respuesta.modo === 'proyectar_respuesta' && (
                  <button
                    onClick={() => onAdoptarRespuesta(respuesta.resultado as string)}
                    className="flex-1 py-2 rounded-lg text-white text-xs font-bold"
                    style={{ background: '#14532D' }}>
                    Adoptar borrador
                  </button>
                )}
              </div>
            </div>
          )}

          {respuesta.modo === 'revisar_borrador' && (
            <RevisionView
              revision={respuesta.resultado as SimiRevisionBorrador}
              onAdoptar={onAdoptarRespuesta}
            />
          )}

          {respuesta.modo === 'lenguaje_claro' && (
            <LenguajeClaroView
              resultado={respuesta.resultado as SimiLenguajeClaro}
              onAdoptar={onAdoptarRespuesta}
            />
          )}

          {respuesta.modo === 'riesgo_juridico' && (
            <div className="rounded-xl p-3" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
              <p className="text-xs leading-relaxed mb-2" style={{ color: '#1F2933' }}>
                {(respuesta.resultado as { mensaje: string }).mensaje}
              </p>
              {(respuesta.resultado as { factores: string[] }).factores?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Factores</p>
                  {(respuesta.resultado as { factores: string[] }).factores.map((f, i) => (
                    <p key={i} className="text-[11px]" style={{ color: '#667085' }}>• {f}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {respuesta.modo === 'checklist_mipg' && (
            <MipgChecklistCard checklist={respuesta.resultado as ChecklistMipg} />
          )}

          {respuesta.modo === 'fundamento_normativo' && (
            <NormativeSourcesCard fuentes={respuesta.resultado as NormativaSugerida[]} />
          )}

          {respuesta.modo === 'datos_personales' && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-700">Datos personales detectados</p>
              {(respuesta.resultado as { detectados: string[] }).detectados?.length > 0 ? (
                (respuesta.resultado as { detectados: string[] }).detectados.map((d, i) => (
                  <p key={i} className="text-[11px] text-red-700">• {d}</p>
                ))
              ) : (
                <p className="text-[11px]" style={{ color: '#667085' }}>No se detectaron datos personales o sensibles.</p>
              )}
              <p className="text-[10px] italic" style={{ color: '#DC2626' }}>
                {(respuesta.resultado as { advertencia: string }).advertencia}
              </p>
            </div>
          )}

          {respuesta.modo === 'escalar_juridica' && (
            <div className="rounded-xl p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-red-700">Instrucciones de escalamiento</p>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2933', fontFamily: 'inherit' }}>
                {(respuesta.resultado as { instrucciones: string }).instrucciones}
              </pre>
            </div>
          )}

          {/* Fuentes RAG usadas */}
          {fuentesRag.length > 0 && (
            <RagSourcesPanel
              fuentesValidadas={fuentesRag}
              fuentesPendientes={[]}
            />
          )}

          {/* Flujo de aprobación creado */}
          {approvalResult && (
            <div className="rounded-xl p-3" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#14532D' }}>
                Flujo de aprobación creado
              </p>
              <p className="text-xs font-semibold" style={{ color: '#1F2933' }}>{approvalResult.mensaje}</p>
              <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>ID: {approvalResult.approvalId}</p>
            </div>
          )}

          {/* Frase final obligatoria */}
          <p className="text-[10px] italic leading-relaxed pt-2" style={{ color: '#94A3B8', borderTop: '1px solid #EEF4EE' }}>
            {respuesta.fraseFinal}
          </p>
        </div>
      )}
    </div>
  );
}
