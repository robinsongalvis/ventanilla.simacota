'use client';

/**
 * PanelSimi — Copiloto SIMI del caso (Sprint SIMI copiloto, Fase 1).
 *
 * SIMI se presenta como un colega experto con un repertorio corto y
 * predecible — Entiende, Redacta, Verifica, Aprende — en una sola
 * vista, sin sub-pestañas ni jerga. El botón estrella proyecta una
 * respuesta jurídica con fundamento normativo, checklist MIPG y nivel
 * de riesgo; sus otras dos salidas son el resumen y la argumentación.
 *
 * Principio sagrado intacto: SIMI sugiere; la persona revisa, aprueba
 * y firma. El único camino de salida es "Usar como base en Responder".
 */

import { useMemo, useState } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';
import type {
  SimiJuridicoResponse,
  SimiModoJuridico,
  SimiAnalisisJuridico,
  SimiLenguajeClaro,
  NormativaSugerida,
} from '@/src/types/simi-juridico';
import {
  resumirEntendimiento,
  salidasParaRol,
  resumirChecklist,
  resumirRiesgo,
  type SalidaCopiloto,
  type ResumenChecklist,
  type RiesgoResumen,
} from '@/lib/simi/copiloto';
import { NormativeSourcesCard } from './NormativeSourcesCard';

const VERDE = '#14532D';
const DORADO = '#F7D154';

const TONO_CHIP: Record<'VERDE' | 'AMBAR' | 'ROJO', { bg: string; fg: string }> = {
  VERDE: { bg: '#EAF3DE', fg: '#27500A' },
  AMBAR: { bg: '#FAEEDA', fg: '#854F0B' },
  ROJO:  { bg: '#FCEBEB', fg: '#791F1F' },
};

/* Herramientas secundarias — disponibles, no gritando. */
const HERRAMIENTAS: { modo: SimiModoJuridico; label: string; necesitaBorrador: boolean }[] = [
  { modo: 'lenguaje_claro',       label: 'Lenguaje claro para el ciudadano', necesitaBorrador: true },
  { modo: 'solicitud_aclaracion', label: 'Pedir aclaración al ciudadano',    necesitaBorrador: false },
  { modo: 'traslado_competencia', label: 'Traslado por competencia',         necesitaBorrador: false },
  { modo: 'datos_personales',     label: 'Revisar datos personales',         necesitaBorrador: true },
];

interface ResultadoCopiloto {
  salida:       SalidaCopiloto;
  adoptable:    boolean;
  texto:        string;
  riesgo:       RiesgoResumen | null;
  checklist:    ResumenChecklist | null;
  fundamentos:  NormativaSugerida[];
  advertencias: string[];
}

interface PanelSimiProps {
  radicado:            VentanillaRadicado;
  usuario:             UsuarioAutenticado;
  onAdoptarRespuesta?: (texto: string) => void;
}

export function PanelSimi({ radicado, usuario, onAdoptarRespuesta }: PanelSimiProps) {
  const entiende = useMemo(() => resumirEntendimiento(radicado), [radicado]);
  const salidas  = useMemo(() => salidasParaRol(usuario.rol), [usuario.rol]);
  const salidaPrincipal = salidas[0];

  const [cargando,   setCargando]   = useState<SalidaCopiloto | SimiModoJuridico | null>(null);
  const [resultado,  setResultado]  = useState<ResultadoCopiloto | null>(null);
  const [herramienta, setHerramienta] = useState<{ modo: SimiModoJuridico; texto: string } | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [pregunta,   setPregunta]   = useState('');
  const [borrHerr,   setBorrHerr]   = useState('');

  const estaResuelto = radicado.estadoActual === 'RESUELTO' || radicado.estadoActual === 'RECHAZADO';

  async function llamarJuridico(modo: SimiModoJuridico, borrador?: string): Promise<SimiJuridicoResponse> {
    const res = await fetch('/api/simi/juridico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        radicadoId: radicado.radicadoId,
        modo,
        textoSolicitud: radicado.detalle.descripcion || radicado.detalle.asunto,
        borrador: borrador?.trim() || undefined,
        // La base jurídica validada se usa siempre que exista — decisión
        // del sistema, no una casilla técnica para el funcionario.
        useRag: true,
      }),
    });
    const data = await res.json().catch(() => null) as (SimiJuridicoResponse & { error?: string }) | null;
    if (!res.ok || !data) throw new Error(data?.error ?? `No fue posible conectar con Simi (HTTP ${res.status}).`);
    return data;
  }

  /* Botón estrella — la salida elegida, con credenciales cuando aplica. */
  async function proyectar(salida: SalidaCopiloto) {
    setCargando(salida);
    setError(null);
    setResultado(null);
    setHerramienta(null);
    try {
      if (salida === 'RESPUESTA') {
        // Un solo paso para el funcionario: borrador + credenciales en paralelo.
        const [proy, ana] = await Promise.all([
          llamarJuridico('proyectar_respuesta'),
          llamarJuridico('analizar_solicitud'),
        ]);
        const analisis = ana.resultado as SimiAnalisisJuridico;
        setResultado({
          salida: 'RESPUESTA',
          adoptable: true,
          texto: String(proy.resultado ?? ''),
          riesgo: resumirRiesgo(proy.nivelRiesgo ?? analisis?.nivelRiesgo),
          checklist: analisis?.checklistMipg ? resumirChecklist(analisis.checklistMipg) : null,
          fundamentos: analisis?.fundamentosNormativos ?? [],
          advertencias: proy.advertencias ?? [],
        });
      } else if (salida === 'RESUMEN') {
        const ana = await llamarJuridico('analizar_solicitud');
        const a = ana.resultado as SimiAnalisisJuridico;
        const texto = [
          `Tipo: ${a.tipoSolicitudPrincipal}`,
          `Tema: ${a.temaCentral}`,
          `Término probable: ${a.terminoProbable}`,
          a.rutaInternaRecomendada ? `Ruta interna: ${a.rutaInternaRecomendada}` : '',
        ].filter(Boolean).join('\n');
        setResultado({
          salida: 'RESUMEN', adoptable: false, texto,
          riesgo: resumirRiesgo(a.nivelRiesgo),
          checklist: a.checklistMipg ? resumirChecklist(a.checklistMipg) : null,
          fundamentos: [], advertencias: ana.advertencias ?? [],
        });
      } else {
        const fn = await llamarJuridico('fundamento_normativo');
        setResultado({
          salida: 'ARGUMENTACION', adoptable: false,
          texto: 'Normas aplicables al caso — revisa su vigencia antes de citarlas.',
          riesgo: resumirRiesgo(fn.nivelRiesgo),
          checklist: null,
          fundamentos: (fn.resultado as NormativaSugerida[]) ?? [],
          advertencias: fn.advertencias ?? [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simi no pudo completar la tarea.');
    } finally {
      setCargando(null);
    }
  }

  /* Herramientas secundarias — resultado en texto simple. */
  async function usarHerramienta(modo: SimiModoJuridico, necesitaBorrador: boolean) {
    if (necesitaBorrador && !borrHerr.trim()) return;
    setCargando(modo);
    setError(null);
    setResultado(null);
    setHerramienta(null);
    try {
      const r = await llamarJuridico(modo, necesitaBorrador ? borrHerr : undefined);
      let texto = '';
      if (modo === 'lenguaje_claro') {
        texto = (r.resultado as SimiLenguajeClaro).versionLenguajeClaro;
      } else if (modo === 'datos_personales') {
        const d = r.resultado as { detectados: string[]; advertencia: string };
        texto = d.detectados?.length
          ? `Datos personales detectados:\n${d.detectados.map((x) => `· ${x}`).join('\n')}\n\n${d.advertencia}`
          : `No se detectaron datos personales o sensibles.\n\n${d.advertencia}`;
      } else {
        texto = String(r.resultado ?? '');
      }
      setHerramienta({ modo, texto });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simi no pudo completar la herramienta.');
    } finally {
      setCargando(null);
    }
  }

  async function preguntar() {
    if (!pregunta.trim()) return;
    setCargando('RESUMEN');
    setError(null);
    setResultado(null);
    setHerramienta(null);
    try {
      const res = await fetch('/api/simi/radicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radicadoId: radicado.radicadoId, accion: 'RESUMIR_RADICADO', mensajeUsuario: pregunta.trim() }),
      });
      const data = await res.json() as { ok: boolean; resultado: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Simi no pudo responder tu pregunta.');
      setHerramienta({ modo: 'analizar_solicitud', texto: data.resultado });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simi no pudo responder tu pregunta.');
    } finally {
      setCargando(null);
    }
  }

  const trabajando = cargando !== null;

  return (
    <div className="space-y-4">
      {/* ── Header del copiloto ── */}
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: VERDE }} aria-hidden="true">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill={DORADO}>
            <path d="M12 2l1.6 5.2L19 8.8l-4.2 3.1L16.4 17 12 13.9 7.6 17l1.6-5.1L5 8.8l5.4-.6L12 2z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight" style={{ color: '#12261A' }}>Simi · copiloto del caso</p>
          <p className="text-[11.5px]" style={{ color: '#7A8B7F' }}>Analiza y proyecta borradores. Tú revisas, apruebas y firmas.</p>
        </div>
      </div>

      {/* ── Lo que Simi entiende ── */}
      <div className="rounded-xl bg-white px-3.5 py-3" style={{ border: '1px solid #E3EAE3' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#5F8A6E' }}>
          Lo que Simi entiende de este caso
        </p>
        <p className="text-[12.5px] leading-relaxed mb-2" style={{ color: '#3A4551' }}>{entiende.resumen}</p>
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[10.5px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#EEF2F5', color: '#3A4551' }}>
            {entiende.chipTramite}
          </span>
          {entiende.confianzaPct !== null && (
            <span className="text-[10.5px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#E6F1FB', color: '#0C447C' }}>
              Confianza {entiende.confianzaPct}%
            </span>
          )}
          {entiende.dependenciaSugerida && (
            <span className="text-[10.5px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#EEF2F5', color: '#3A4551' }}>
              Sugiere: {entiende.dependenciaSugerida}
            </span>
          )}
        </div>
      </div>

      {/* ── Botón estrella + salidas ── */}
      {!estaResuelto && (
        <div>
          <button
            type="button"
            onClick={() => proyectar(salidaPrincipal.id)}
            disabled={trabajando}
            className="w-full rounded-[10px] px-4 py-3 text-center transition-opacity disabled:opacity-60"
            style={{ background: VERDE, color: '#fff' }}
          >
            <p className="text-[13.5px] font-bold flex items-center justify-center gap-2">
              {cargando === salidaPrincipal.id
                ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Simi está trabajando…</>
                : <>Proyectar {salidaPrincipal.label.toLowerCase()}</>}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#C0DD97' }}>{salidaPrincipal.ayuda}</p>
          </button>
          {salidas.length > 1 && (
            <div className="flex gap-2 mt-2">
              {salidas.slice(1).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => proyectar(s.id)}
                  disabled={trabajando}
                  title={s.ayuda}
                  className="flex-1 text-[11.5px] font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: '#fff', border: '1px solid #D9E2D9', color: '#475569' }}
                >
                  {cargando === s.id ? 'Trabajando…' : s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pregunta libre ── */}
      <div className="flex gap-2">
        <input
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !trabajando) void preguntar(); }}
          placeholder="Pregúntale algo sobre este caso…"
          className="flex-1 input-internal"
        />
        <button
          type="button"
          onClick={() => void preguntar()}
          disabled={trabajando || !pregunta.trim()}
          className="shrink-0 px-4 rounded-xl text-white text-xs font-bold disabled:opacity-40"
          style={{ background: VERDE }}
        >
          Enviar
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="px-3.5 py-2.5 rounded-xl text-xs" style={{ background: '#FCEBEB', border: '1px solid #F09595', color: '#791F1F' }}>
          {error}
        </div>
      )}

      {/* ── Resultado del copiloto — con credenciales a la vista ── */}
      {resultado && (
        <div className="rounded-xl bg-white p-3.5" style={{ border: '1px solid #E3EAE3' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#854F0B' }}>
              Borrador de apoyo — no es la respuesta oficial
            </p>
            {resultado.riesgo && (
              <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background: TONO_CHIP[resultado.riesgo.tono].bg, color: TONO_CHIP[resultado.riesgo.tono].fg }}>
                {resultado.riesgo.label}
              </span>
            )}
          </div>

          {resultado.texto && (
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap mb-3" style={{ color: '#1F2933' }}>
              {resultado.texto}
            </p>
          )}

          {resultado.fundamentos.length > 0 && (
            <div className="mb-3">
              <NormativeSourcesCard fuentes={resultado.fundamentos} />
            </div>
          )}

          {resultado.checklist && (
            <div className="mb-3 flex gap-x-4 gap-y-1 flex-wrap">
              {resultado.checklist.items.map((c) => (
                <span key={c.label} className="text-[11px] flex items-center gap-1" style={{ color: c.ok ? '#3B6D11' : '#94A3B8' }}>
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={c.ok ? 'M4.5 12.75l6 6 9-13.5' : 'M6 18L18 6M6 6l12 12'} />
                  </svg>
                  {c.label}
                </span>
              ))}
            </div>
          )}

          {resultado.checklist?.requiereRevisionJuridica && (
            <p className="text-[11px] mb-3 px-3 py-2 rounded-lg" style={{ background: '#FAEEDA', color: '#633806' }}>
              Simi recomienda que un abogado revise este caso antes de responder.
            </p>
          )}

          {resultado.advertencias.map((a, i) => (
            <p key={i} className="text-[11px] mb-2 px-3 py-1.5 rounded-lg" style={{ background: '#FAEEDA', color: '#633806' }}>{a}</p>
          ))}

          <div className="flex gap-2 flex-wrap">
            {resultado.adoptable && onAdoptarRespuesta && (
              <button
                type="button"
                onClick={() => onAdoptarRespuesta(resultado.texto)}
                className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                style={{ background: VERDE }}
              >
                Usar como base en Responder
              </button>
            )}
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(resultado.texto)}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg"
              style={{ border: '1px solid #D9E2D9', color: '#475569' }}
            >
              Copiar
            </button>
            <button
              type="button"
              onClick={() => setResultado(null)}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg"
              style={{ border: '1px solid #D9E2D9', color: '#94A3B8' }}
            >
              Descartar
            </button>
          </div>
          <p className="text-[10.5px] italic mt-2.5" style={{ color: '#94A3B8' }}>
            Simi sugiere. La respuesta oficial la revisa, aprueba y firma el funcionario.
          </p>
        </div>
      )}

      {/* ── Resultado de una herramienta secundaria ── */}
      {herramienta && (
        <div className="rounded-xl bg-white p-3.5" style={{ border: '1px solid #E3EAE3' }}>
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2933' }}>{herramienta.texto}</p>
          {onAdoptarRespuesta && herramienta.modo === 'lenguaje_claro' && (
            <button
              type="button"
              onClick={() => onAdoptarRespuesta(herramienta.texto)}
              className="mt-2.5 text-[12px] font-bold px-4 py-2 rounded-lg text-white"
              style={{ background: VERDE }}
            >
              Usar como base en Responder
            </button>
          )}
        </div>
      )}

      {/* ── Más herramientas (plegado) ── */}
      {!estaResuelto && (
        <details className="rounded-xl bg-white px-3.5 py-2.5" style={{ border: '1px solid #E3EAE3' }}>
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest" style={{ color: '#5F8A6E' }}>
            Más herramientas
          </summary>
          <div className="mt-2.5 space-y-2">
            <textarea
              value={borrHerr}
              onChange={(e) => setBorrHerr(e.target.value)}
              rows={2}
              placeholder="Pega aquí un texto si vas a usar Lenguaje claro o Revisar datos personales…"
              className="input-internal resize-none w-full text-xs"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HERRAMIENTAS.map((h) => (
                <button
                  key={h.modo}
                  type="button"
                  onClick={() => void usarHerramienta(h.modo, h.necesitaBorrador)}
                  disabled={trabajando || (h.necesitaBorrador && !borrHerr.trim())}
                  className="text-[11.5px] font-medium px-3 py-2 rounded-lg text-left transition-colors disabled:opacity-40"
                  style={{ border: '1px solid #D9E2D9', background: '#F8FAF7', color: '#3A4551' }}
                >
                  {cargando === h.modo ? 'Trabajando…' : h.label}
                </button>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* ── Documentos adjuntos ── */}
      {radicado.archivos.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#5F8A6E' }}>
            Documentos adjuntos ({radicado.archivos.length})
          </p>
          {radicado.archivos.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1" style={{ background: '#F8FAF7', border: '1px solid #E3EAE3' }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              <span className="text-xs truncate flex-1" style={{ color: '#667085' }}>{a.nombre}</span>
              <span className="text-[10px]" style={{ color: '#94A3B8' }}>{a.tamanioKB} KB</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
