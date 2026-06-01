'use client';

/**
 * PanelSimi — Asistente SIMI contextual por radicado.
 *
 * SIMI-1: 8 acciones rápidas + pregunta libre + advertencias + auditoría.
 * Visible para todos los roles. Capacidades varían según rol.
 * SIMI sugiere. El funcionario revisa. El funcionario aprueba.
 */

import { useState } from 'react';
import type { VentanillaRadicado }  from '@/src/types/ventanilla';
import type { UsuarioAutenticado }  from '@/lib/hooks/useAuth';
import type { RolInterno }          from '@/lib/hooks/useAuth';
import { NOMBRES_TENANT }           from '@/src/types/reglas-negocio';
import { diasRestantesHabiles }     from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   TIPOS Y CONSTANTES
══════════════════════════════════════════════════════════════ */

type AccionSimi =
  | 'RESUMIR_RADICADO'
  | 'EXPLICAR_ESTADO'
  | 'REVISAR_TERMINO'
  | 'SUGERIR_DEPENDENCIA'
  | 'SUGERIR_RESPUESTA'
  | 'VALIDAR_RESPUESTA'
  | 'GENERAR_BORRADOR_OFICIO'
  | 'RESUMIR_TRAZABILIDAD';

interface AccionRapida {
  accion: AccionSimi;
  label:  string;
  icono:  string;
  roles:  RolInterno[];
}

const ACCIONES_RAPIDAS: AccionRapida[] = [
  { accion: 'RESUMIR_RADICADO',        label: 'Resumir radicado',        icono: '📋', roles: ['ADMIN','RECEPCIONISTA','FUNCIONARIO','JEFE_DEPENDENCIA','CONTROL_INTERNO'] },
  { accion: 'EXPLICAR_ESTADO',          label: 'Explicar estado',         icono: '💡', roles: ['ADMIN','RECEPCIONISTA','FUNCIONARIO','JEFE_DEPENDENCIA','CONTROL_INTERNO'] },
  { accion: 'REVISAR_TERMINO',          label: 'Revisar término',         icono: '⏱️', roles: ['ADMIN','RECEPCIONISTA','FUNCIONARIO','JEFE_DEPENDENCIA','CONTROL_INTERNO'] },
  { accion: 'SUGERIR_DEPENDENCIA',      label: 'Sugerir dependencia',     icono: '🏛️', roles: ['ADMIN','RECEPCIONISTA'] },
  { accion: 'SUGERIR_RESPUESTA',        label: 'Sugerir respuesta',       icono: '✍️', roles: ['ADMIN','FUNCIONARIO'] },
  { accion: 'GENERAR_BORRADOR_OFICIO',  label: 'Generar borrador oficio', icono: '📄', roles: ['ADMIN','FUNCIONARIO'] },
  { accion: 'RESUMIR_TRAZABILIDAD',     label: 'Resumir trazabilidad',    icono: '📜', roles: ['ADMIN','JEFE_DEPENDENCIA','CONTROL_INTERNO'] },
  { accion: 'VALIDAR_RESPUESTA',        label: 'Validar respuesta',       icono: '✅', roles: ['ADMIN','FUNCIONARIO'] },
];

interface SimiResponse {
  ok:             boolean;
  accion:         string;
  resultado:      string;
  advertencias?:  string[];
  fuentesUsadas?: string[];
}

/* ══════════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════════ */

interface PanelSimiProps {
  radicado:       VentanillaRadicado;
  usuario:        UsuarioAutenticado;
  /** Para adoptar borrador de respuesta */
  onAdoptarRespuesta?: (texto: string) => void;
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE
══════════════════════════════════════════════════════════════ */

export function PanelSimi({ radicado, usuario, onAdoptarRespuesta }: PanelSimiProps) {
  const [cargando,   setCargando]   = useState(false);
  const [respuesta,  setRespuesta]  = useState<SimiResponse | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [pregunta,   setPregunta]   = useState('');
  const [borradorValidar, setBorradorValidar] = useState('');

  const dias       = diasRestantesHabiles(radicado.termino.fechaVencimiento);
  const depNombre  = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? radicado.clasificacion.oficinaDestino;
  const acciones   = ACCIONES_RAPIDAS.filter((a) => a.roles.includes(usuario.rol));

  async function ejecutarAccion(accion: AccionSimi, opts?: { mensaje?: string; borrador?: string }) {
    setCargando(true);
    setError(null);
    setRespuesta(null);

    try {
      const res = await fetch('/api/simi/radicado', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          radicadoId:         radicado.radicadoId,
          accion,
          mensajeUsuario:     opts?.mensaje || pregunta.trim() || undefined,
          respuestaBorrador:  opts?.borrador || borradorValidar.trim() || undefined,
        }),
      });

      const data = await res.json() as SimiResponse & { error?: string };

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRespuesta(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con SIMI.');
    } finally {
      setCargando(false);
    }
  }

  const estaResuelto = radicado.estadoActual === 'RESUELTO' || radicado.estadoActual === 'RECHAZADO';

  return (
    <div className="space-y-4">
      {/* Header contextual */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🤖</span>
          <div>
            <p className="text-xs font-bold text-indigo-400">SIMI — Asistente de {depNombre}</p>
            <p className="text-[10px] text-slate-500">
              Rol: {usuario.rol} · {estaResuelto ? 'Caso cerrado' : dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : dias <= 2 ? `Vence en ${dias}d` : `${dias}d restantes`}
            </p>
          </div>
        </div>
        {/* Advertencia de vencimiento */}
        {!estaResuelto && dias <= 2 && (
          <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-semibold ${
            dias < 0
              ? 'bg-red-500/10 border border-red-500/30 text-red-300'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
          }`}>
            {dias < 0 ? `Este radicado está VENCIDO hace ${Math.abs(dias)} días hábiles.` : dias === 0 ? 'Este radicado VENCE HOY.' : `Este radicado vence en ${dias} día(s) hábil(es).`}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Acciones rápidas</p>
        <div className="grid grid-cols-2 gap-2">
          {acciones.map((a) => (
            <button
              key={a.accion}
              onClick={() => ejecutarAccion(a.accion)}
              disabled={cargando}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.07] bg-slate-900/40 hover:bg-slate-800/60 hover:border-indigo-500/30 text-xs text-slate-300 transition-all disabled:opacity-40 text-left"
            >
              <span className="text-sm shrink-0">{a.icono}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Validar respuesta (solo si el funcionario tiene borrador) */}
      {(usuario.rol === 'FUNCIONARIO' || usuario.rol === 'ADMIN') && !estaResuelto && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Validar borrador de respuesta</p>
          <textarea
            value={borradorValidar}
            onChange={(e) => setBorradorValidar(e.target.value)}
            rows={3}
            placeholder="Pega aquí tu borrador de respuesta para que SIMI lo revise..."
            className="w-full bg-slate-800/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all"
          />
          <button
            onClick={() => ejecutarAccion('VALIDAR_RESPUESTA', { borrador: borradorValidar })}
            disabled={cargando || !borradorValidar.trim()}
            className="mt-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
          >
            Validar con SIMI
          </button>
        </div>
      )}

      {/* Pregunta libre */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Pregunta libre</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !cargando && pregunta.trim() && ejecutarAccion('RESUMIR_RADICADO', { mensaje: pregunta })}
            placeholder="Pregúntale a SIMI sobre este radicado..."
            className="flex-1 bg-slate-800/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
          <button
            onClick={() => ejecutarAccion('RESUMIR_RADICADO', { mensaje: pregunta })}
            disabled={cargando || !pregunta.trim()}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-40 shrink-0"
          >
            {cargando ? '...' : 'Enviar'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {cargando && (
        <div className="flex items-center justify-center gap-3 py-6">
          <span className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-500 animate-pulse">SIMI está analizando...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-300">
          <p className="font-bold">Error de SIMI:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Resultado */}
      {respuesta && (
        <div className="space-y-3">
          {/* Advertencias */}
          {respuesta.advertencias && respuesta.advertencias.length > 0 && (
            <div className="space-y-1">
              {respuesta.advertencias.map((adv, i) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  ⚠️ {adv}
                </div>
              ))}
            </div>
          )}

          {/* Respuesta principal */}
          <div className="bg-slate-900/50 border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                Respuesta SIMI — {respuesta.accion.replace(/_/g, ' ')}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(respuesta.resultado)}
                  className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors"
                  title="Copiar al portapapeles"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                </button>
                {onAdoptarRespuesta && (respuesta.accion === 'SUGERIR_RESPUESTA' || respuesta.accion === 'GENERAR_BORRADOR_OFICIO') && (
                  <button
                    onClick={() => onAdoptarRespuesta(respuesta.resultado)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                    title="Usar como respuesta"
                  >
                    Adoptar
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
              {respuesta.resultado}
            </div>
          </div>

          {/* Fuentes */}
          {respuesta.fuentesUsadas && (
            <p className="text-[10px] text-slate-700">
              Fuentes: {respuesta.fuentesUsadas.join(' · ')}
            </p>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-slate-700 italic leading-relaxed">
            SIMI genera sugerencias para revisión del funcionario.
            Toda respuesta oficial requiere aprobación humana antes de ser enviada al ciudadano.
          </p>
        </div>
      )}

      {/* Documentos disponibles (preview para SIMI-2) */}
      {radicado.archivos.length > 0 && (
        <div className="border-t border-white/[0.07] pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
            Documentos adjuntos ({radicado.archivos.length})
          </p>
          <div className="space-y-1">
            {radicado.archivos.map((a, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/30 border border-white/[0.05]">
                <span className="text-xs">📎</span>
                <span className="text-xs text-slate-400 truncate flex-1">{a.nombre}</span>
                <span className="text-[10px] text-slate-600">{a.tamanioKB} KB</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-700 mt-1.5 italic">
            Análisis documental con IA disponible en SIMI-2.
          </p>
        </div>
      )}
    </div>
  );
}
