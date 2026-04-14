'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { submitRadicacion } from '@/src/lib/webhook';
import type { FormRadicacionData } from '@/src/types/radicado';

/* ─── Tipos internos ─── */
type FormState = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';

interface FieldErrors {
  nombre?: string;
  email?: string;
  telefono?: string;
  descripcion?: string;
  archivo?: string;
}

/* ─── Validación ─── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE   = /^[3][0-9]{9}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function validate(data: FormRadicacionData): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.nombre.trim() || data.nombre.trim().length < 3)
    errors.nombre = 'Ingresa tu nombre completo (mínimo 3 caracteres).';
  if (!EMAIL_RE.test(data.email.trim()))
    errors.email = 'Ingresa un correo electrónico válido.';
  if (!TEL_RE.test(data.telefono.replace(/\s/g, '')))
    errors.telefono = 'Ingresa un celular colombiano válido (10 dígitos, comienza por 3).';
  if (data.descripcion.trim().length < 20)
    errors.descripcion = 'Describe tu solicitud con al menos 20 caracteres.';
  if (data.archivo) {
    if (!ALLOWED_TYPES.includes(data.archivo.type))
      errors.archivo = 'Solo se permiten archivos PDF, JPG, PNG o WEBP.';
    else if (data.archivo.size > MAX_FILE_BYTES)
      errors.archivo = 'El archivo no puede superar los 5 MB.';
  }
  return errors;
}

/* ─── Subcomponentes pequeños ─── */
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-label text-slate-400 text-[11px] mb-2 block">
      {children}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-rose-400 text-xs flex items-center gap-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {msg}
    </p>
  );
}

/* ─── Pantalla de éxito ─── */
function SuccessScreen({ radicadoId, onNew }: { radicadoId: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
      {/* Ícono animado */}
      <div className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-8 animate-pulse-glow">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={1.5} className="w-10 h-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <p className="font-label text-emerald-400 mb-3 text-[11px]">Radicación exitosa</p>
      <h2 className="font-headline text-3xl text-slate-50 mb-4">¡Tu solicitud fue recibida!</h2>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-8">
        La inteligencia artificial clasificará tu caso y lo asignará a la dependencia correcta
        en los próximos minutos. Recibirás respuesta por WhatsApp.
      </p>

      {/* Número de radicado */}
      <div className="glass-card px-8 py-5 mb-8 text-center">
        <p className="font-label text-slate-500 text-[10px] mb-2">Número de radicado</p>
        <p className="font-headline text-2xl text-indigo-400 tracking-wider">{radicadoId}</p>
        <p className="text-slate-500 text-xs mt-2">Guarda este código para hacer seguimiento</p>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <button onClick={onNew} className="btn-primary px-6 py-3 text-sm">
          Radicar otra solicitud
        </button>
        <Link
          href="/"
          className="px-6 py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

/* ─── Componente principal ─── */
export default function FormRadicacion() {
  const [formState, setFormState] = useState<FormState>('IDLE');
  const [radicadoId, setRadicadoId] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<FormRadicacionData>({
    nombre: '',
    email: '',
    telefono: '',
    descripcion: '',
    archivo: null,
  });

  function update(field: keyof FormRadicacionData, value: string | File | null) {
    setData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo al editar
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleFile(file: File | null) {
    update('archivo', file);
    if (file) {
      const err: FieldErrors = {};
      if (!ALLOWED_TYPES.includes(file.type)) err.archivo = 'Solo PDF, JPG, PNG o WEBP.';
      else if (file.size > MAX_FILE_BYTES) err.archivo = 'El archivo no puede superar los 5 MB.';
      if (err.archivo) setErrors((prev) => ({ ...prev, archivo: err.archivo }));
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(data);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      // Scroll al primer error
      const firstErrorKey = Object.keys(fieldErrors)[0];
      document.getElementById(firstErrorKey)?.focus();
      return;
    }
    setErrors({});
    setFormState('LOADING');
    try {
      const result = await submitRadicacion(data);
      setRadicadoId(result.radicadoId);
      setFormState('SUCCESS');
    } catch {
      setFormState('ERROR');
    }
  }

  function resetForm() {
    setData({ nombre: '', email: '', telefono: '', descripcion: '', archivo: null });
    setErrors({});
    setFormState('IDLE');
    setRadicadoId('');
  }

  /* ── Pantalla de éxito ── */
  if (formState === 'SUCCESS') {
    return <SuccessScreen radicadoId={radicadoId} onNew={resetForm} />;
  }

  const isLoading = formState === 'LOADING';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">

      {/* Error global */}
      {formState === 'ERROR' && (
        <div className="glass-card border border-rose-500/30 bg-rose-500/10 p-4 flex gap-3 items-start animate-fade-in-up">
          <svg viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth={1.5} className="w-5 h-5 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-rose-400 font-semibold text-sm">No pudimos procesar tu solicitud</p>
            <p className="text-slate-400 text-xs mt-1">
              Verifica tu conexión e inténtalo nuevamente.{' '}
              <button
                type="button"
                onClick={() => setFormState('IDLE')}
                className="text-rose-400 hover:text-rose-300 underline"
              >
                Reintentar
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── Fila: Nombre ── */}
      <div>
        <FieldLabel htmlFor="nombre">Nombre completo *</FieldLabel>
        <input
          id="nombre"
          type="text"
          className={`input-obsidian${errors.nombre ? ' error' : ''}`}
          placeholder="Ej. Carlos Andrés Pérez Gómez"
          value={data.nombre}
          onChange={(e) => update('nombre', e.target.value)}
          disabled={isLoading}
          autoComplete="name"
        />
        <FieldError msg={errors.nombre} />
      </div>

      {/* ── Fila: Email + Teléfono ── */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <FieldLabel htmlFor="email">Correo electrónico *</FieldLabel>
          <input
            id="email"
            type="email"
            className={`input-obsidian${errors.email ? ' error' : ''}`}
            placeholder="correo@ejemplo.com"
            value={data.email}
            onChange={(e) => update('email', e.target.value)}
            disabled={isLoading}
            autoComplete="email"
          />
          <FieldError msg={errors.email} />
        </div>
        <div>
          <FieldLabel htmlFor="telefono">Celular (WhatsApp) *</FieldLabel>
          <input
            id="telefono"
            type="tel"
            className={`input-obsidian${errors.telefono ? ' error' : ''}`}
            placeholder="3100000000"
            value={data.telefono}
            onChange={(e) => update('telefono', e.target.value)}
            disabled={isLoading}
            autoComplete="tel"
            maxLength={10}
          />
          <FieldError msg={errors.telefono} />
        </div>
      </div>

      {/* ── Descripción ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel htmlFor="descripcion">Descripción de la solicitud *</FieldLabel>
          <span className="font-label text-slate-600 text-[10px]">
            {data.descripcion.length}/1000
          </span>
        </div>
        <textarea
          id="descripcion"
          rows={5}
          className={`input-obsidian resize-none${errors.descripcion ? ' error' : ''}`}
          placeholder="Describe con detalle tu solicitud. Si es de una vereda rural (ej. Yariguíes), indícalo para un mejor enrutamiento..."
          value={data.descripcion}
          onChange={(e) => update('descripcion', e.target.value.slice(0, 1000))}
          disabled={isLoading}
        />
        <FieldError msg={errors.descripcion} />
      </div>

      {/* ── Adjunto (Drag & Drop) ── */}
      <div>
        <FieldLabel htmlFor="archivo">Documento adjunto (opcional)</FieldLabel>
        <div
          role="button"
          tabIndex={0}
          aria-label="Zona de carga de archivos"
          className={[
            'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.02]',
            isLoading ? 'pointer-events-none opacity-50' : '',
          ].join(' ')}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            id="archivo"
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            disabled={isLoading}
          />

          {data.archivo ? (
            /* Archivo seleccionado */
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-slate-200 text-sm font-medium truncate max-w-xs">{data.archivo.name}</p>
                <p className="text-slate-500 text-xs">{(data.archivo.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="ml-2 text-slate-500 hover:text-rose-400 transition-colors"
                aria-label="Quitar archivo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            /* Zona de drop vacía */
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="text-slate-300 text-sm font-medium">
                  Arrastra tu archivo aquí o{' '}
                  <span className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                    selecciona uno
                  </span>
                </p>
                <p className="text-slate-600 text-xs mt-1">PDF, JPG, PNG, WEBP — máx. 5 MB</p>
              </div>
            </div>
          )}
        </div>
        <FieldError msg={errors.archivo} />
      </div>

      {/* ── Submit ── */}
      <div className="pt-2">
        <button
          type="submit"
          className="btn-primary w-full py-4 text-base"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 animate-spin-smooth">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Radicando solicitud...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              Enviar Solicitud
            </>
          )}
        </button>
        <p className="text-slate-600 text-xs text-center mt-4">
          Al enviar, aceptas que tus datos sean tratados conforme a la política de privacidad
          de la Alcaldía Municipal de Simacota.
        </p>
      </div>
    </form>
  );
}
