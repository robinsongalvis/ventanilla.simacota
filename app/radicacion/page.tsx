'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { radicarSolicitud } from '@/lib/radicacion';
import type { UploadProgress } from '@/lib/storage';

/* ══════════════════════════════════════════════════════════════
   TIPOS TYPESCRIPT
══════════════════════════════════════════════════════════════ */

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  descripcion: string;
}

type CampoForm = keyof FormData;


/* ══════════════════════════════════════════════════════════════
   CONSTANTES DE VALIDACIÓN
══════════════════════════════════════════════════════════════ */

const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE        = /^3[0-9]{9}$/;
const MAX_ARCHIVOS  = 3;
const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB
const TIPOS_VALIDOS = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validarCampo(campo: CampoForm, valor: string): string {
  switch (campo) {
    case 'nombre':
      if (!valor.trim() || valor.trim().length < 3)
        return 'Ingresa tu nombre completo (mínimo 3 caracteres).';
      return '';
    case 'email':
      if (!EMAIL_RE.test(valor.trim()))
        return 'Ingresa un correo electrónico válido.';
      return '';
    case 'telefono':
      if (!TEL_RE.test(valor.replace(/\s/g, '')))
        return 'Celular colombiano: 10 dígitos, debe comenzar por 3.';
      return '';
    case 'descripcion':
      if (valor.trim().length < 20)
        return 'Describe tu solicitud con al menos 20 caracteres.';
      return '';
    default:
      return '';
  }
}

function validarTodo(form: FormData): Record<CampoForm, string> {
  return {
    nombre:      validarCampo('nombre',      form.nombre),
    email:       validarCampo('email',       form.email),
    telefono:    validarCampo('telefono',    form.telefono),
    descripcion: validarCampo('descripcion', form.descripcion),
  };
}

/* ══════════════════════════════════════════════════════════════
   SUBCOMPONENTES PUROS
══════════════════════════════════════════════════════════════ */

function IconoCheck() {
  return (
    <div className="animate-success-bounce">
      <svg viewBox="0 0 52 52" className="w-20 h-20" fill="none" aria-hidden="true">
        <circle cx="26" cy="26" r="25" stroke="#10B981" strokeWidth="2" className="svg-circle-draw" strokeLinecap="round" />
        <circle cx="26" cy="26" r="24" fill="rgba(16,185,129,0.12)" />
        <path d="M14 27 L22 35 L38 17" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="svg-check-draw" />
      </svg>
    </div>
  );
}

function PantallaConfirmacion({
  radicadoId,
  errores,
  onNueva,
}: {
  radicadoId: string;
  errores:    string[];
  onNueva:    () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiarRadicado() {
    navigator.clipboard.writeText(radicadoId).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in-up">
      <div className="mb-8">
        <IconoCheck />
      </div>

      <h2
        className="text-2xl font-black tracking-tighter text-slate-50 mb-3"
        style={{ fontFamily: 'var(--font-manrope)' }}
      >
        Solicitud radicada exitosamente
      </h2>
      <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-8">
        Su solicitud fue recibida y será clasificada por el sistema de IA.
        Recibirá respuesta por WhatsApp en los próximos días hábiles.
      </p>

      {errores.length > 0 && (
        <div className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">Advertencias</p>
          <ul className="space-y-1">
            {errores.map((e, i) => (
              <li key={i} className="text-xs text-amber-300/80 leading-relaxed">• {e}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6 mb-6"
        style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Número de radicado</p>
        <p className="text-2xl font-black tracking-widest text-indigo-400 break-all" style={{ fontFamily: 'var(--font-manrope)' }}>
          {radicadoId}
        </p>
        <p className="text-slate-500 text-xs mt-3 leading-relaxed">
          Conserve este número para hacer seguimiento de su caso.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={copiarRadicado}
          className="w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300
            border border-indigo-500/40 text-indigo-400 hover:border-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center gap-2"
        >
          {copiado ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              ¡Copiado!
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
              Copiar número de radicado
            </>
          )}
        </button>

        <Link
          href={`/consulta?id=${radicadoId}`}
          className="w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-white text-center
            bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400
            hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300"
        >
          Consultar estado de mi solicitud
        </Link>

        <button
          onClick={onNueva}
          className="w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-slate-400
            border border-white/10 hover:border-white/20 hover:text-slate-200 transition-all duration-300"
        >
          Radicar otra solicitud
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

export default function PortalCiudadano() {
  const [form, setForm] = useState<FormData>({
    nombre: '', email: '', telefono: '', descripcion: '',
  });

  const [touched, setTouched] = useState<Partial<Record<CampoForm, true>>>({});
  const [errors, setErrors] = useState<Record<CampoForm, string>>({
    nombre: '', email: '', telefono: '', descripcion: '',
  });

  const [archivos, setArchivos] = useState<File[]>([]);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [estado, setEstado] = useState<'formulario' | 'enviando' | 'confirmacion'>('formulario');
  const [radicadoId, setRadicadoId] = useState('');
  const [progresoMensaje, setProgresoMensaje] = useState('');
  const [progresoPct, setProgresoPct] = useState(0);
  const [progresosArchivos, setProgresosArchivos] = useState<UploadProgress[]>([]);
  const [erroresSubmit, setErroresSubmit] = useState<string[]>([]);

  function handleChange(campo: CampoForm, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (touched[campo]) {
      setErrors((prev) => ({ ...prev, [campo]: validarCampo(campo, valor) }));
    }
  }

  function handleBlur(campo: CampoForm) {
    setTouched((prev) => ({ ...prev, [campo]: true }));
    setErrors((prev) => ({ ...prev, [campo]: validarCampo(campo, form[campo]) }));
  }

  function procesarArchivos(nuevos: FileList | null) {
    if (!nuevos) return;
    const lista = Array.from(nuevos);
    const disponible = MAX_ARCHIVOS - archivos.length;

    if (disponible <= 0) {
      setErrorArchivo(`Máximo ${MAX_ARCHIVOS} archivos permitidos.`);
      return;
    }

    const validos: File[] = [];
    const rechazados: string[] = [];

    for (const archivo of lista.slice(0, disponible)) {
      if (!TIPOS_VALIDOS.has(archivo.type)) {
        rechazados.push(`"${archivo.name}": tipo no permitido (solo PDF, JPG, PNG).`);
      } else if (archivo.size > MAX_BYTES) {
        rechazados.push(`"${archivo.name}": supera 5 MB.`);
      } else {
        validos.push(archivo);
      }
    }

    if (validos.length > 0) setArchivos((prev) => [...prev, ...validos]);
    setErrorArchivo(rechazados.length > 0 ? rechazados[0] : '');
  }

  function eliminarArchivo(index: number) {
    setArchivos((prev) => prev.filter((_, i) => i !== index));
    setErrorArchivo('');
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    procesarArchivos(e.dataTransfer.files);
  }, [archivos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    setTouched({ nombre: true, email: true, telefono: true, descripcion: true });
    const erroresFinal = validarTodo(form);
    setErrors(erroresFinal);

    const hayErrores = Object.values(erroresFinal).some((msg) => msg !== '');
    if (hayErrores) {
      const primerCampo = (Object.keys(erroresFinal) as CampoForm[]).find((k) => erroresFinal[k] !== '');
      if (primerCampo) document.getElementById(primerCampo)?.focus();
      return;
    }

    setEstado('enviando');
    setProgresoMensaje('Iniciando radicación...');
    setProgresoPct(0);
    setProgresosArchivos([]);

    const res = await radicarSolicitud(
      {
        origen: 'WEB',
        ciudadano: {
          nombre:   form.nombre.trim(),
          email:    form.email.trim().toLowerCase(),
          telefono: form.telefono.replace(/\s/g, ''),
        },
        descripcion: form.descripcion.trim(),
        archivos,
      },
      (mensaje, pct, progresos) => {
        setProgresoMensaje(mensaje);
        setProgresoPct(pct);
        if (progresos) setProgresosArchivos(progresos);
      },
    );

    setErroresSubmit(res.errores);
    setRadicadoId(res.radicadoId);
    setEstado('confirmacion');
  }

  function resetFormulario() {
    setForm({ nombre: '', email: '', telefono: '', descripcion: '' });
    setTouched({});
    setErrors({ nombre: '', email: '', telefono: '', descripcion: '' });
    setArchivos([]);
    setErrorArchivo('');
    setEstado('formulario');
    setRadicadoId('');
    setProgresoMensaje('');
    setProgresoPct(0);
    setProgresosArchivos([]);
    setErroresSubmit([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function inputClass(campo: CampoForm) {
    const base =
      'w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-slate-50 placeholder:text-slate-500 ' +
      'transition-all duration-300 outline-none text-sm';
    const error = touched[campo] && errors[campo]
      ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
      : 'border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
    return `${base} ${error}`;
  }

  const STAGGER = [0, 90, 180, 270, 360, 450];

  return (
    <main
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 80%, rgba(244,63,94,0.05) 0%, transparent 50%),
          #0A0A0B
        `,
      }}
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-[20px] bg-[#0A0A0B]/70">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center
              text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all duration-200 shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>

          <div className="w-8 h-8 rounded-lg border border-indigo-500/30 bg-indigo-500/15 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5.25-3.5 10.15-8 11.5C7.5 22.15 4 17.25 4 12V7l8-4z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 leading-none mb-0.5">
              Alcaldía de Simacota
            </p>
            <p className="text-slate-200 text-sm font-black tracking-tight leading-none truncate" style={{ fontFamily: 'var(--font-manrope)' }}>
              Ventanilla Única Digital
            </p>
          </div>

          <nav className="ml-auto hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            <Link href="/" className="hover:text-slate-400 transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-slate-400">Radicar solicitud</span>
          </nav>
        </div>
      </header>

      {/* ── Contenido principal ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {estado === 'confirmacion' ? (
          <div
            className="rounded-2xl border border-white/10"
            style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
          >
            <PantallaConfirmacion radicadoId={radicadoId} errores={erroresSubmit} onNueva={resetFormulario} />
          </div>
        ) : (
          <>
            <div className="text-center mb-10 field-animate" style={{ animationDelay: '0ms' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Portal ciudadano</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-50 mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                Radica tu Solicitud
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
                Completa el formulario. El sistema lo clasificará con IA y lo enviará
                a la dependencia correcta de la Alcaldía.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6"
              style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
            >
              {/* ─ Nombre ─ */}
              <div className="field-animate" style={{ animationDelay: `${STAGGER[1]}ms` }}>
                <label htmlFor="nombre" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Nombre completo *
                </label>
                <input
                  id="nombre"
                  type="text"
                  className={inputClass('nombre')}
                  placeholder="Ej. Carlos Andrés Pérez Gómez"
                  value={form.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  onBlur={() => handleBlur('nombre')}
                  disabled={estado === 'enviando'}
                  autoComplete="name"
                  aria-describedby={errors.nombre ? 'error-nombre' : undefined}
                  aria-invalid={!!errors.nombre}
                />
                <FeedbackCampo id="error-nombre" error={errors.nombre} touched={!!touched.nombre} valorOk={form.nombre.trim().length >= 3} />
              </div>

              {/* ─ Email + Teléfono ─ */}
              <div className="grid sm:grid-cols-2 gap-6 field-animate" style={{ animationDelay: `${STAGGER[2]}ms` }}>
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Correo electrónico *
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={inputClass('email')}
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    disabled={estado === 'enviando'}
                    autoComplete="email"
                    aria-describedby={errors.email ? 'error-email' : undefined}
                    aria-invalid={!!errors.email}
                  />
                  <FeedbackCampo id="error-email" error={errors.email} touched={!!touched.email} valorOk={EMAIL_RE.test(form.email.trim())} />
                </div>

                <div>
                  <label htmlFor="telefono" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Celular WhatsApp *
                  </label>
                  <input
                    id="telefono"
                    type="tel"
                    className={inputClass('telefono')}
                    placeholder="3100000000"
                    value={form.telefono}
                    onChange={(e) => handleChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onBlur={() => handleBlur('telefono')}
                    disabled={estado === 'enviando'}
                    autoComplete="tel"
                    maxLength={10}
                    inputMode="numeric"
                    aria-describedby={errors.telefono ? 'error-telefono' : undefined}
                    aria-invalid={!!errors.telefono}
                  />
                  <FeedbackCampo id="error-telefono" error={errors.telefono} touched={!!touched.telefono} valorOk={TEL_RE.test(form.telefono)} />
                </div>
              </div>

              {/* ─ Descripción ─ */}
              <div className="field-animate" style={{ animationDelay: `${STAGGER[3]}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="descripcion" className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Descripción de la solicitud *
                  </label>
                  <span className={`text-xs tabular-nums ${form.descripcion.length >= 20 ? 'text-emerald-500' : 'text-slate-600'}`}>
                    {form.descripcion.length}/1 000
                  </span>
                </div>
                <textarea
                  id="descripcion"
                  rows={5}
                  className={`${inputClass('descripcion')} resize-none`}
                  placeholder="Describe con detalle tu solicitud. Si es de una vereda rural (ej. zona Yariguíes), indícalo para un mejor enrutamiento..."
                  value={form.descripcion}
                  onChange={(e) => handleChange('descripcion', e.target.value.slice(0, 1000))}
                  onBlur={() => handleBlur('descripcion')}
                  disabled={estado === 'enviando'}
                  aria-describedby={errors.descripcion ? 'error-descripcion' : undefined}
                  aria-invalid={!!errors.descripcion}
                />
                <FeedbackCampo id="error-descripcion" error={errors.descripcion} touched={!!touched.descripcion} valorOk={form.descripcion.trim().length >= 20} />
              </div>

              {/* ─ Archivos adjuntos ─ */}
              <div className="field-animate" style={{ animationDelay: `${STAGGER[4]}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Archivos adjuntos <span className="text-slate-600 normal-case tracking-normal font-normal">(opcional — máx. {MAX_ARCHIVOS})</span>
                  </p>
                  <span className="text-xs text-slate-600 tabular-nums">{archivos.length}/{MAX_ARCHIVOS}</span>
                </div>

                {archivos.length < MAX_ARCHIVOS && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Zona de carga de archivos. Haz clic o arrastra archivos aquí."
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={[
                      'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300',
                      isDragging
                        ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                        : 'border-white/20 hover:border-indigo-500/50 hover:bg-white/[0.02]',
                      estado === 'enviando' ? 'pointer-events-none opacity-50' : '',
                    ].join(' ')}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => procesarArchivos(e.target.files)}
                      disabled={estado === 'enviando'}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col items-center gap-3 pointer-events-none">
                      <div className={[
                        'w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300',
                        isDragging ? 'bg-indigo-500/25 text-indigo-400' : 'bg-white/[0.04] text-slate-500',
                      ].join(' ')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">
                          Arrastra aquí o{' '}
                          <span className="text-indigo-400 underline underline-offset-2">selecciona archivos</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-1">PDF, JPG, PNG — máx. 5 MB por archivo</p>
                      </div>
                    </div>
                  </div>
                )}

                {errorArchivo && (
                  <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    {errorArchivo}
                  </p>
                )}

                {archivos.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {archivos.map((archivo, i) => (
                      <li key={`${archivo.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 bg-slate-800/30">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                          {archivo.type === 'application/pdf' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm font-medium truncate">{archivo.name}</p>
                          <p className="text-slate-500 text-xs">{formatBytes(archivo.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => eliminarArchivo(i)}
                          aria-label={`Eliminar ${archivo.name}`}
                          className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                          disabled={estado === 'enviando'}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ─ Submit ─ */}
              <div className="pt-2 field-animate" style={{ animationDelay: `${STAGGER[5]}ms` }}>
                {estado === 'enviando' && (
                  <div className="mb-4 rounded-xl border border-white/10 p-4 bg-slate-800/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">{progresoMensaje}</span>
                      <span className="text-xs font-bold tabular-nums text-indigo-400">{progresoPct}%</span>
                    </div>
                    <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progresoPct}%` }}
                      />
                    </div>
                    {progresosArchivos.length > 0 && (
                      <ul className="space-y-1.5">
                        {progresosArchivos.map((p, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                            {p.estado === 'completado' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2.5} className="w-3.5 h-3.5 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : p.estado === 'error' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} className="w-3.5 h-3.5 shrink-0 animate-spin-smooth">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                            )}
                            <span className="truncate max-w-[160px]">{p.archivo}</span>
                            <span className="ml-auto tabular-nums text-slate-600">{p.porcentaje}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={estado === 'enviando'}
                  className="w-full py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-white
                    bg-gradient-to-r from-indigo-600 to-indigo-500
                    hover:from-indigo-500 hover:to-indigo-400
                    hover:shadow-lg hover:shadow-indigo-500/25
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                    transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  {estado === 'enviando' ? (
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
                  Al enviar, tus datos serán tratados conforme a la Ley 1581 de 2012 (Habeas Data)
                  y la política de privacidad de la Alcaldía Municipal de Simacota.
                </p>
              </div>
            </form>

            {/* ── Info complementaria ── */}
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <div
                className="rounded-2xl border border-white/[0.07] p-4 flex gap-3 items-start field-animate"
                style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(25px)', animationDelay: `${STAGGER[5] + 80}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1">Tiempo de respuesta</p>
                  <p className="text-slate-400 text-xs leading-relaxed">Máximo 15 días hábiles según la Ley 1437 de 2011 (CPACA).</p>
                </div>
              </div>

              <div
                className="rounded-2xl border border-white/[0.07] p-4 flex gap-3 items-start field-animate"
                style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(25px)', animationDelay: `${STAGGER[5] + 160}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">Atención presencial</p>
                  <p className="text-slate-400 text-xs leading-relaxed">Calle 4 # 4-28, Simacota, Santander. Lun–Vie 8 am – 12 pm / 2–6 pm.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-white/[0.06] py-6 text-center mt-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
          Alcaldía Municipal de Simacota · Santander · Sistema de Ventanilla Única Digital
        </p>
      </footer>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUBCOMPONENTE: Feedback de campo
══════════════════════════════════════════════════════════════ */

function FeedbackCampo({ id, error, touched, valorOk }: { id: string; error: string; touched: boolean; valorOk: boolean }) {
  if (!touched) return null;

  if (error) {
    return (
      <p id={id} className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5" role="alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {error}
      </p>
    );
  }

  if (valorOk) {
    return (
      <p id={id} className="mt-1.5 text-xs text-emerald-500 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Correcto
      </p>
    );
  }

  return null;
}
