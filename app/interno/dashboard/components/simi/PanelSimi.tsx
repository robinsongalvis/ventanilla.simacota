'use client';

/**
 * PanelSimi — Asistente SIMI contextual por radicado.
 * SIMI sugiere. El funcionario revisa. El funcionario aprueba.
 */

import { useState } from 'react';
import type { VentanillaRadicado }  from '@/src/types/ventanilla';
import type { UsuarioAutenticado }  from '@/lib/hooks/useAuth';
import type { RolInterno }          from '@/lib/hooks/useAuth';
import { NOMBRES_TENANT }           from '@/src/types/reglas-negocio';
import { diasRestantesHabiles }     from '@/lib/tiempos-radicado';

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

interface PanelSimiProps {
  radicado:           VentanillaRadicado;
  usuario:            UsuarioAutenticado;
  onAdoptarRespuesta?: (texto: string) => void;
}

export function PanelSimi({ radicado, usuario, onAdoptarRespuesta }: PanelSimiProps) {
  const [cargando,         setCargando]         = useState(false);
  const [respuesta,        setRespuesta]        = useState<SimiResponse | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [pregunta,         setPregunta]         = useState('');
  const [borradorValidar,  setBorradorValidar]  = useState('');

  const dias      = diasRestantesHabiles(radicado.termino.fechaVencimiento);
  const depNombre = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? radicado.clasificacion.oficinaDestino;
  const acciones  = ACCIONES_RAPIDAS.filter((a) => a.roles.includes(usuario.rol));

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

  /* ── Clases de estado de término ── */
  const terminoStyle = dias < 0
    ? { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }
    : { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' };
  const terminoLabel = dias < 0
    ? `Este radicado está VENCIDO hace ${Math.abs(dias)} días hábiles.`
    : dias === 0 ? 'Este radicado VENCE HOY.'
    : `Este radicado vence en ${dias} día(s) hábil(es).`;

  return (
    <div className="space-y-4">

      {/* Header contextual */}
      <div className="rounded-xl p-4" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🤖</span>
          <div>
            <p className="text-xs font-bold" style={{ color: '#14532D' }}>
              SIMI — Asistente de {depNombre}
            </p>
            <p className="text-[10px]" style={{ color: '#667085' }}>
              Rol: {usuario.rol} ·{' '}
              {estaResuelto
                ? 'Caso cerrado'
                : dias < 0
                  ? `Vencido hace ${Math.abs(dias)}d`
                  : dias <= 2
                    ? `Vence en ${dias}d`
                    : `${dias}d restantes`}
            </p>
          </div>
        </div>

        {!estaResuelto && dias <= 2 && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold" style={terminoStyle}>
            {terminoLabel}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>
          Acciones rápidas
        </p>
        <div className="grid grid-cols-2 gap-2">
          {acciones.map((a) => (
            <button
              key={a.accion}
              onClick={() => ejecutarAccion(a.accion)}
              disabled={cargando}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all duration-150 disabled:opacity-40 active:scale-[0.98]"
              style={{ border: '1px solid #D9E2D9', background: '#F8FAF7', color: '#1F2933' }}
              onMouseEnter={(e) => { if (!cargando) { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; (e.currentTarget as HTMLElement).style.borderColor = '#14532D'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; (e.currentTarget as HTMLElement).style.borderColor = '#D9E2D9'; }}
            >
              <span className="text-sm shrink-0">{a.icono}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Validar borrador */}
      {(usuario.rol === 'FUNCIONARIO' || usuario.rol === 'ADMIN') && !estaResuelto && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>
            Validar borrador de respuesta
          </p>
          <textarea
            value={borradorValidar}
            onChange={(e) => setBorradorValidar(e.target.value)}
            rows={3}
            placeholder="Pega aquí tu borrador de respuesta para que SIMI lo revise..."
            className="input-internal resize-none w-full"
          />
          <button
            onClick={() => ejecutarAccion('VALIDAR_RESPUESTA', { borrador: borradorValidar })}
            disabled={cargando || !borradorValidar.trim()}
            className="mt-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 disabled:opacity-40"
            style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}
            onMouseEnter={(e) => { if (!cargando) (e.currentTarget as HTMLElement).style.background = '#D9E2D9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
          >
            Validar con SIMI
          </button>
        </div>
      )}

      {/* Pregunta libre */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>
          Pregunta libre
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !cargando && pregunta.trim() && ejecutarAccion('RESUMIR_RADICADO', { mensaje: pregunta })}
            placeholder="Pregúntale a SIMI sobre este radicado..."
            className="flex-1 input-internal"
          />
          <button
            onClick={() => ejecutarAccion('RESUMIR_RADICADO', { mensaje: pregunta })}
            disabled={cargando || !pregunta.trim()}
            className="px-3 py-2 rounded-xl text-white text-xs font-bold transition-all duration-150 disabled:opacity-40 shrink-0 active:scale-95"
            style={{ background: '#14532D' }}
            onMouseEnter={(e) => { if (!cargando) (e.currentTarget as HTMLElement).style.background = '#166534'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
          >
            {cargando ? '...' : 'Enviar'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {cargando && (
        <div className="flex items-center justify-center gap-3 py-5 rounded-xl" style={{ background: '#EEF4EE' }}>
          <span className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
          <p className="text-xs animate-pulse" style={{ color: '#14532D' }}>SIMI está analizando...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
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
                <div key={i} className="px-3 py-2 rounded-lg text-xs"
                     style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
                  ⚠️ {adv}
                </div>
              ))}
            </div>
          )}

          {/* Respuesta principal */}
          <div className="rounded-xl p-4 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                SIMI — {respuesta.accion.replace(/_/g, ' ')}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(respuesta.resultado)}
                  className="p-1 rounded transition-colors"
                  title="Copiar al portapapeles"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#14532D'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                </button>
                {onAdoptarRespuesta && (respuesta.accion === 'SUGERIR_RESPUESTA' || respuesta.accion === 'GENERAR_BORRADOR_OFICIO') && (
                  <button
                    onClick={() => onAdoptarRespuesta(respuesta.resultado)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold transition-colors"
                    style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#D9E2D9'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
                    title="Usar como respuesta"
                  >
                    Adoptar
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto"
                 style={{ color: '#1F2933' }}>
              {respuesta.resultado}
            </div>
          </div>

          {/* Fuentes */}
          {respuesta.fuentesUsadas && (
            <p className="text-[10px]" style={{ color: '#94A3B8' }}>
              Fuentes: {respuesta.fuentesUsadas.join(' · ')}
            </p>
          )}

          {/* Disclaimer MIPG */}
          <p className="text-[10px] italic leading-relaxed" style={{ color: '#94A3B8' }}>
            SIMI genera sugerencias para revisión del funcionario.
            Toda respuesta oficial requiere aprobación humana antes de ser enviada al ciudadano.
          </p>
        </div>
      )}

      {/* Documentos adjuntos */}
      {radicado.archivos.length > 0 && (
        <div className="pt-3" style={{ borderTop: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>
            Documentos adjuntos ({radicado.archivos.length})
          </p>
          <div className="space-y-1">
            {radicado.archivos.map((a, i) => (
              <div key={i}
                   className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                   style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
                <span className="text-xs">📎</span>
                <span className="text-xs truncate flex-1" style={{ color: '#667085' }}>{a.nombre}</span>
                <span className="text-[10px]" style={{ color: '#94A3B8' }}>{a.tamanioKB} KB</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-1.5 italic" style={{ color: '#94A3B8' }}>
            Análisis documental con IA disponible en SIMI-2.
          </p>
        </div>
      )}
    </div>
  );
}
