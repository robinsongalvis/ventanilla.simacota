'use client';

/**
 * NormogramaPanel — Panel de administración del normograma jurídico.
 * Solo visible para ADMIN.
 */

import { useState, useEffect, useCallback } from 'react';
import type { NormativeDocument, NormativeDocumentStatus, NormativeDocumentType } from '@/src/types/simi-normograma';
import { NormativeValidationBadge } from './NormativeValidationBadge';

const TIPOS: NormativeDocumentType[] = [
  'Ley', 'Decreto', 'Resolución', 'Acuerdo', 'Circular',
  'Manual', 'Procedimiento', 'TRD', 'Política', 'Acto administrativo',
  'Concepto', 'Jurisprudencia', 'Constitución', 'Otro',
];

const ESTADOS: NormativeDocumentStatus[] = [
  'vigente', 'parcialmente_vigente', 'pendiente_verificacion',
  'interna_validada', 'interna_no_validada', 'derogada',
];

interface FormDoc {
  titulo:          string;
  tipo_norma:      NormativeDocumentType;
  numero:          string;
  anio:            string;
  entidad_emisora: string;
  estado:          NormativeDocumentStatus;
  resumen:         string;
  palabras_clave:  string;  // CSV
  fuente:          string;
  url_fuente:      string;
  coleccion:       'normatividad_municipal' | 'normatividad_nacional';
}

const FORM_INICIAL: FormDoc = {
  titulo: '', tipo_norma: 'Ley', numero: '', anio: '', entidad_emisora: '',
  estado: 'pendiente_verificacion', resumen: '', palabras_clave: '',
  fuente: '', url_fuente: '', coleccion: 'normatividad_nacional',
};

export function NormogramaPanel() {
  const [docs,       setDocs]       = useState<(NormativeDocument & { id: string })[]>([]);
  const [cargando,   setCargando]   = useState(false);
  const [guardando,  setGuardando]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [exito,      setExito]      = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState<FormDoc>(FORM_INICIAL);
  const [colActual,  setColActual]  = useState<'normatividad_nacional' | 'normatividad_municipal'>('normatividad_nacional');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/simi/normograma?coleccion=${colActual}&limite=50`);
      const data = await res.json() as { docs?: NormativeDocument[] };
      setDocs((data.docs ?? []) as (NormativeDocument & { id: string })[]);
    } catch {
      setError('Error al cargar documentos.');
    } finally {
      setCargando(false);
    }
  }, [colActual]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true); setError(null); setExito(null);
    try {
      const body = {
        ...form,
        palabras_clave: form.palabras_clave.split(',').map((s) => s.trim()).filter(Boolean),
        coleccion: form.coleccion,
      };
      const res = await fetch('/api/simi/normograma', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; mensaje?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      setExito(data.mensaje ?? 'Documento guardado.');
      setForm(FORM_INICIAL); setShowForm(false); void cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(docId: string, nuevoEstado: NormativeDocumentStatus) {
    try {
      await fetch(`/api/simi/normograma/${docId}?coleccion=${colActual}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      void cargar();
    } catch { /* silenciar */ }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Administración</p>
          <h2 className="text-base font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
            Normograma Jurídico
          </h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
          style={{ background: '#14532D' }}>
          {showForm ? 'Cancelar' : '+ Cargar norma'}
        </button>
      </div>

      {/* Selector de colección */}
      <div className="flex gap-2">
        {(['normatividad_nacional', 'normatividad_municipal'] as const).map((col) => (
          <button key={col} onClick={() => setColActual(col)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={colActual === col
              ? { background: '#14532D', color: '#fff' }
              : { background: '#F8FAF7', border: '1px solid #D9E2D9', color: '#667085' }}>
            {col === 'normatividad_nacional' ? '🏛️ Nacional' : '🏘️ Municipal'}
          </button>
        ))}
      </div>

      {/* Mensajes */}
      {error && <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>{error}</div>}
      {exito && <div className="rounded-lg p-3 text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>{exito}</div>}

      {/* Formulario */}
      {showForm && (
        <form onSubmit={guardar} className="rounded-xl bg-white p-4 space-y-3" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Nuevo documento normativo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Título *</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required className="input-obsidian" placeholder="Ej. Ley 1755 de 2015 — Derecho de Petición" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Tipo *</label>
              <select value={form.tipo_norma} onChange={(e) => setForm({ ...form, tipo_norma: e.target.value as NormativeDocumentType })}
                className="select-internal w-full">
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Estado *</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as NormativeDocumentStatus })}
                className="select-internal w-full">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Número</label>
              <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="input-obsidian" placeholder="1755" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Año</label>
              <input value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })}
                className="input-obsidian" placeholder="2015" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Entidad emisora *</label>
              <input value={form.entidad_emisora} onChange={(e) => setForm({ ...form, entidad_emisora: e.target.value })}
                required className="input-obsidian" placeholder="Congreso de Colombia / Alcaldía de Simacota" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Resumen</label>
              <textarea value={form.resumen} onChange={(e) => setForm({ ...form, resumen: e.target.value })}
                rows={3} className="input-internal resize-none w-full" placeholder="Descripción breve para búsquedas RAG..." />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>
                Palabras clave <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(separadas por coma)</span>
              </label>
              <input value={form.palabras_clave} onChange={(e) => setForm({ ...form, palabras_clave: e.target.value })}
                className="input-obsidian" placeholder="petición, PQRSD, derecho, ciudadano" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Fuente</label>
              <input value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })}
                className="input-obsidian" placeholder="Secretaría del Senado" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>Colección</label>
              <select value={form.coleccion} onChange={(e) => setForm({ ...form, coleccion: e.target.value as typeof form.coleccion })}
                className="select-internal w-full">
                <option value="normatividad_nacional">Nacional</option>
                <option value="normatividad_municipal">Municipal</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-sm" style={{ color: '#667085' }}>Cancelar</button>
            <button type="submit" disabled={guardando}
              className="px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: '#14532D' }}>
              {guardando ? 'Guardando...' : 'Guardar norma'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de documentos */}
      {cargando ? (
        <div className="text-center py-8" style={{ color: '#94A3B8' }}>
          <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto mb-2"
               style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
          Cargando normograma...
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-white" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-2xl mb-2">📚</p>
          <p className="font-bold" style={{ color: '#1F2933' }}>Sin documentos cargados</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Cargue normas para mejorar el análisis RAG de SIMI</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
                  {['Documento', 'Tipo', 'Estado', 'Fuente', 'Acción'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #EEF4EE' }}>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <p className="font-medium truncate" style={{ color: '#1F2933' }}>{doc.titulo}</p>
                      {doc.numero && <p style={{ color: '#94A3B8' }}>N.° {doc.numero} / {doc.anio}</p>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: '#667085' }}>{doc.tipo_norma}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <NormativeValidationBadge estado={doc.estado} />
                    </td>
                    <td className="px-3 py-2.5 max-w-[120px]">
                      <p className="truncate" style={{ color: '#94A3B8' }}>{doc.fuente ?? '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {doc.estado === 'pendiente_verificacion' && (
                        <button onClick={() => cambiarEstado(doc.id!, 'interna_validada')}
                          className="text-[10px] font-bold px-2 py-1 rounded"
                          style={{ background: '#EEF4EE', color: '#14532D', border: '1px solid #D9E2D9' }}>
                          Validar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
