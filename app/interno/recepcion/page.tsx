'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { radicarSolicitud } from '@/lib/radicacion';
import type { UploadProgress } from '@/lib/storage';

/* ══════════════════════════════════════════════════════════════
   TIPOS TYPESCRIPT
══════════════════════════════════════════════════════════════ */

interface DatosCiudadanoFisico {
  nombre:   string;
  cedula:   string;
  email:    string;   // Puede ser vacío
  telefono: string;
}

interface ArchivoEscaneado {
  archivo:    File;
  id:         string;         // Key de React
  nombre:     string;
  tamanioKB:  number;
  tipo:       string;         // MIME type
  orden:      number;
  previewUrl?: string;        // Solo para imágenes
}

interface ErrorArchivo {
  nombre: string;
  razon:  string;
}


// Campos del formulario que tienen validación con touched
type CampoForm = 'nombre' | 'cedula' | 'email' | 'telefono' | 'descripcion';

/* ══════════════════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════════════════ */

const MAX_ARCHIVOS           = 10;
const MAX_BYTES_POR_ARCHIVO  = 10 * 1024 * 1024; // 10 MB
const MAX_BYTES_TOTAL        = 50 * 1024 * 1024; // 50 MB
const TIPOS_VALIDOS          = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const CEDULA_RE              = /^[0-9]{6,10}$/;
const EMAIL_RE               = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_DIGITS_RE          = /^3[0-9]{9}$/; // 10 dígitos colombianos

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */

/** ID único para keys de React (no criptográfico) */
function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Formatea tamaño en KB a texto legible */
function formatTamanio(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Formatea número de teléfono visualmente: "310 000 0000" */
function formatearTelefono(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Valida un campo individual. Devuelve '' si válido, mensaje si inválido. */
function validarCampo(campo: CampoForm, valor: string): string {
  switch (campo) {
    case 'nombre':
      return valor.trim().length < 3
        ? 'Ingresa el nombre completo (mínimo 3 caracteres).'
        : '';
    case 'cedula':
      return !CEDULA_RE.test(valor.trim())
        ? 'Ingresa el número de cédula (6 a 10 dígitos).'
        : '';
    case 'email':
      // Email es opcional; si está vacío es válido
      return valor.trim() && !EMAIL_RE.test(valor.trim())
        ? 'Ingresa un correo electrónico válido o déjalo vacío.'
        : '';
    case 'telefono':
      return !TEL_DIGITS_RE.test(valor.replace(/\s/g, ''))
        ? 'Teléfono colombiano: 10 dígitos, debe comenzar por 3.'
        : '';
    case 'descripcion':
      return valor.trim().length < 10
        ? 'Describe el caso con al menos 10 caracteres.'
        : '';
    default:
      return '';
  }
}

function validarTodo(form: Record<CampoForm, string>): Record<CampoForm, string> {
  return {
    nombre:      validarCampo('nombre',      form.nombre),
    cedula:      validarCampo('cedula',      form.cedula),
    email:       validarCampo('email',       form.email),
    telefono:    validarCampo('telefono',    form.telefono),
    descripcion: validarCampo('descripcion', form.descripcion),
  };
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: FeedbackCampo
   (fuera del padre para evitar recreación en cada render)
══════════════════════════════════════════════════════════════ */

function FeedbackCampo({
  id,
  error,
  touched,
  valorOk,
}: {
  id: string;
  error: string;
  touched: boolean;
  valorOk: boolean;
}) {
  if (!touched) return null;
  if (error) {
    return (
      <p id={id} role="alert" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5">
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

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: ArchivoPreview
══════════════════════════════════════════════════════════════ */

function ArchivoPreview({
  archivo,
  onEliminar,
  isRemoving,
}: {
  archivo:    ArchivoEscaneado;
  onEliminar: (id: string) => void;
  isRemoving: boolean;
}) {
  const esPDF    = archivo.tipo === 'application/pdf';
  const esImagen = archivo.tipo.startsWith('image/');

  return (
    <div
      className={`
        flex items-center gap-3 rounded-xl border border-white/[0.07] p-3
        bg-slate-800/30 transition-all duration-200
        ${isRemoving ? 'file-animate-out pointer-events-none' : 'file-animate-in'}
      `}
    >
      {/* Thumbnail / Ícono — 64×80 px */}
      <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-700/40 flex items-center justify-center">
        {esImagen && archivo.previewUrl ? (
          <img
            src={archivo.previewUrl}
            alt={`Vista previa de ${archivo.nombre}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth={1.5} className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-[9px] font-bold text-rose-400 mt-1 tracking-wider">PDF</span>
          </div>
        )}
      </div>

      {/* Metadatos */}
      <div className="flex-1 min-w-0">
        {/* Badges: número de orden + tipo */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9px] font-bold text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
            #{archivo.orden}
          </span>
          <span
            className={`text-[9px] font-bold uppercase tracking-widest rounded px-1.5 py-0.5 ${
              esPDF
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-indigo-400 bg-indigo-500/10'
            }`}
          >
            {esPDF ? 'PDF' : 'IMG'}
          </span>
        </div>
        <p className="text-sm text-slate-200 font-medium truncate" title={archivo.nombre}>
          {archivo.nombre}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{formatTamanio(archivo.tamanioKB)}</p>
      </div>

      {/* Botón eliminar */}
      <button
        type="button"
        onClick={() => onEliminar(archivo.id)}
        aria-label={`Eliminar ${archivo.nombre}`}
        className="text-slate-600 hover:text-rose-400 transition-colors p-2 -mr-1 shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: BarraProgresoCarga
══════════════════════════════════════════════════════════════ */

function BarraProgresoCarga({ archivos }: { archivos: ArchivoEscaneado[] }) {
  const totalKB        = archivos.reduce((s, a) => s + a.tamanioKB, 0);
  const totalMB        = totalKB / 1024;
  const pctArchivos    = Math.min((archivos.length / MAX_ARCHIVOS) * 100, 100);
  const pctTamano      = Math.min((totalMB / (MAX_BYTES_TOTAL / (1024 * 1024))) * 100, 100);
  const maxPct         = Math.max(pctArchivos, pctTamano);

  const colorBarra =
    maxPct >= 90 ? 'bg-rose-500'
    : maxPct >= 70 ? 'bg-amber-500'
    : 'bg-indigo-500';

  return (
    <div className="space-y-3 pt-1">
      {/* Pista: cantidad de archivos */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Archivos</span>
          <span className={`text-[10px] font-bold tabular-nums ${maxPct >= 90 ? 'text-rose-400' : maxPct >= 70 ? 'text-amber-400' : 'text-slate-500'}`}>
            {archivos.length} / {MAX_ARCHIVOS}
          </span>
        </div>
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-400 ${colorBarra}`}
            style={{ width: `${pctArchivos}%` }}
          />
        </div>
      </div>

      {/* Pista: tamaño total */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Tamaño total</span>
          <span className={`text-[10px] font-bold tabular-nums ${maxPct >= 90 ? 'text-rose-400' : maxPct >= 70 ? 'text-amber-400' : 'text-slate-500'}`}>
            {totalMB.toFixed(1)} / 50 MB
          </span>
        </div>
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-400 ${colorBarra}`}
            style={{ width: `${pctTamano}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: IconoCheck (reutilizado de Fase 1)
══════════════════════════════════════════════════════════════ */

function IconoCheck() {
  return (
    <div className="animate-success-bounce">
      <svg viewBox="0 0 52 52" className="w-20 h-20" fill="none" aria-hidden="true">
        <circle cx="26" cy="26" r="25" stroke="#10B981" strokeWidth="2" className="svg-circle-draw" strokeLinecap="round" />
        <circle cx="26" cy="26" r="24" fill="rgba(16,185,129,0.10)" />
        <path d="M14 27 L22 35 L38 17" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="svg-check-draw" />
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: PantallaConfirmacion (adaptada para FÍSICO)
══════════════════════════════════════════════════════════════ */

interface DatosComprobante {
  nombre:       string;
  cedula:       string;
  telefono:     string;
  descripcion:  string;
  archivos:     string[];  // nombres de los archivos
  fechaStr:     string;    // Fecha ya formateada
}

function PantallaConfirmacion({
  radicadoId,
  totalArchivos,
  errores,
  datosComprobante,
  onNuevo,
}: {
  radicadoId:       string;
  totalArchivos:    number;
  errores:          string[];
  datosComprobante: DatosComprobante;
  onNuevo:          () => void;
}) {
  function imprimirComprobante() {
    window.print();
  }

  return (
    <>
      {/* ── Comprobante imprimible — oculto en pantalla, visible al imprimir ── */}
      <div id="comprobante-imprimir" className="hidden print:block text-black text-sm font-mono p-8">
        <div className="border-b border-black pb-3 mb-4">
          <p className="font-bold text-base">ALCALDÍA DE SIMACOTA</p>
          <p className="font-bold">VENTANILLA ÚNICA DIGITAL</p>
          <p className="font-bold">COMPROBANTE DE RADICACIÓN</p>
        </div>
        <p><strong>Número de radicado:</strong> {radicadoId}</p>
        <p><strong>Fecha:</strong> {datosComprobante.fechaStr}</p>
        <p><strong>Origen:</strong> Recepción Física</p>
        <div className="border-t border-black pt-3 mt-3">
          <p><strong>Ciudadano:</strong> {datosComprobante.nombre}</p>
          <p><strong>Cédula:</strong> {datosComprobante.cedula}</p>
          <p><strong>Teléfono:</strong> {datosComprobante.telefono}</p>
        </div>
        <div className="border-t border-black pt-3 mt-3">
          <p><strong>Documentos recibidos:</strong> {datosComprobante.archivos.length}</p>
          {datosComprobante.archivos.map((a, i) => (
            <p key={i} className="ml-4">{i + 1}. {a}</p>
          ))}
        </div>
        <div className="border-t border-black pt-3 mt-3">
          <p><strong>Descripción:</strong></p>
          <p className="mt-1 leading-relaxed">{datosComprobante.descripcion}</p>
        </div>
        <div className="border-t border-black pt-3 mt-3">
          <p>Conserve este comprobante.</p>
          <p>Consulte el estado en: /consulta</p>
        </div>
      </div>

      {/* ── Pantalla de éxito — oculta al imprimir ── */}
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up print:hidden">
        <div className="mb-8"><IconoCheck /></div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-3">
          Registro físico completado
        </p>
        <h2
          className="text-2xl font-black tracking-tighter text-slate-50 mb-3"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          Radicado registrado como recepción física
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-2">
          La solicitud fue radicada y será procesada por el sistema de IA (OCR + clasificación).
        </p>
        <p className="text-slate-500 text-xs mb-6">
          Origen:{' '}
          <span className="text-indigo-400 font-bold">FÍSICO (ESCÁNER)</span>
          {' '}—{' '}
          <span className="text-slate-400">{totalArchivos} documento{totalArchivos !== 1 ? 's' : ''} adjunto{totalArchivos !== 1 ? 's' : ''}</span>
        </p>

        {/* Advertencias parciales */}
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

        {/* Radicado ID */}
        <div
          className="w-full max-w-sm rounded-2xl border border-white/10 p-6 mb-6"
          style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Número de radicado
          </p>
          <p
            className="text-2xl font-black tracking-widest text-indigo-400 break-all"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {radicadoId}
          </p>
          <p className="text-slate-500 text-xs mt-3">
            Informe este número al ciudadano para seguimiento de su caso.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {/* Imprimir comprobante */}
          <button
            onClick={imprimirComprobante}
            className="w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider
              border border-emerald-500/40 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/10
              transition-all duration-300 flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Imprimir comprobante
          </button>

          {/* Registrar siguiente */}
          <button
            onClick={onNuevo}
            className="w-full py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-white
              bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400
              hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300"
          >
            Registrar siguiente solicitud
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — RecepcionFisica
══════════════════════════════════════════════════════════════ */

export default function RecepcionFisica() {
  /* ── Estado del formulario ── */
  const [form, setForm] = useState({
    nombre:        '',
    cedula:        '',
    email:         '',
    telefono:      '',
    descripcion:   '',
    notasInternas: '',
  });

  const [touched,  setTouched]  = useState<Partial<Record<CampoForm, true>>>({});
  const [errors,   setErrors]   = useState<Record<CampoForm, string>>({
    nombre: '', cedula: '', email: '', telefono: '', descripcion: '',
  });

  /* ── Estado de archivos ── */
  const [archivos,       setArchivos]       = useState<ArchivoEscaneado[]>([]);
  const [erroresArchivo, setErroresArchivo] = useState<ErrorArchivo[]>([]);
  const [errorSinArch,   setErrorSinArch]   = useState('');
  const [eliminando,     setEliminando]     = useState<Set<string>>(new Set());

  /* ── Drag & Drop ── */
  const [isDragging,  setIsDragging]  = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  /* ── UI ── */
  const [estado,      setEstado]      = useState<'formulario' | 'enviando' | 'confirmacion'>('formulario');
  const [radicadoId,  setRadicadoId]  = useState('');

  /* ── Progreso de envío ── */
  const [progresoMensaje,   setProgresoMensaje]   = useState('');
  const [progresoPct,       setProgresoPct]       = useState(0);
  const [progresosArchivos, setProgresosArchivos] = useState<UploadProgress[]>([]);
  const [erroresSubmit,     setErroresSubmit]     = useState<string[]>([]);

  /* ── Ref para cleanup de object URLs en unmount ── */
  const archivosRef = useRef(archivos);
  archivosRef.current = archivos;

  useEffect(() => {
    return () => {
      // Limpiar todos los object URLs al desmontar el componente
      archivosRef.current.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []); // Solo en unmount

  /* ══════════════════════════════════════════════
     HANDLERS DE CAMPOS
  ══════════════════════════════════════════════ */

  function handleChange(campo: keyof typeof form, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    // Actualizar error en tiempo real solo si el campo fue tocado
    if (touched[campo as CampoForm]) {
      setErrors((prev) => ({
        ...prev,
        [campo]: validarCampo(campo as CampoForm, valor),
      }));
    }
  }

  function handleBlur(campo: CampoForm) {
    setTouched((prev) => ({ ...prev, [campo]: true }));
    setErrors((prev) => ({ ...prev, [campo]: validarCampo(campo, form[campo]) }));
  }

  /* ══════════════════════════════════════════════
     HANDLERS DE ARCHIVOS
  ══════════════════════════════════════════════ */

  const procesarArchivos = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const incoming    = Array.from(fileList);
    const rechazados: ErrorArchivo[] = [];
    const nuevos:     ArchivoEscaneado[] = [];

    // Calcular tamaño total actual + pendiente
    const bytesActuales = archivosRef.current.reduce((s, a) => s + a.tamanioKB * 1024, 0);

    for (const file of incoming) {
      // 1. Cupo de archivos
      if (archivosRef.current.length + nuevos.length >= MAX_ARCHIVOS) {
        rechazados.push({ nombre: file.name, razon: `Máximo ${MAX_ARCHIVOS} archivos alcanzado.` });
        continue;
      }

      // 2. Tipo MIME
      if (!TIPOS_VALIDOS.has(file.type)) {
        const ext = file.name.split('.').pop() ?? 'desconocido';
        rechazados.push({ nombre: file.name, razon: `Tipo no permitido: .${ext}` });
        continue;
      }

      // 3. Tamaño individual
      if (file.size > MAX_BYTES_POR_ARCHIVO) {
        rechazados.push({
          nombre: file.name,
          razon:  `Archivo muy grande: ${(file.size / (1024 * 1024)).toFixed(1)} MB (máx 10 MB)`,
        });
        continue;
      }

      // 4. Tamaño total
      const bytesNuevos   = nuevos.reduce((s, a) => s + a.tamanioKB * 1024, 0);
      const bytesTotal    = bytesActuales + bytesNuevos + file.size;
      if (bytesTotal > MAX_BYTES_TOTAL) {
        rechazados.push({
          nombre: file.name,
          razon:  'El total de archivos superaría 50 MB.',
        });
        continue;
      }

      // ✓ Archivo válido
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined;

      nuevos.push({
        archivo:   file,
        id:        uid(),
        nombre:    file.name,
        tamanioKB: Math.round(file.size / 1024),
        tipo:      file.type,
        orden:     archivosRef.current.length + nuevos.length + 1,
        previewUrl,
      });
    }

    if (nuevos.length > 0) {
      setArchivos((prev) => [...prev, ...nuevos]);
      setErrorSinArch('');
    }
    setErroresArchivo(rechazados);
  }, []); // archivosRef es un ref, no una dep

  function iniciarEliminar(id: string) {
    setEliminando((prev) => new Set([...prev, id]));
    setTimeout(() => {
      const a = archivosRef.current.find((x) => x.id === id);
      if (a?.previewUrl) URL.revokeObjectURL(a.previewUrl);
      setArchivos((prev) => {
        const nuevaLista = prev
          .filter((x) => x.id !== id)
          .map((x, i) => ({ ...x, orden: i + 1 })); // Re-numerar
        return nuevaLista;
      });
      setEliminando((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setErroresArchivo([]); // Limpiar errores al eliminar
    }, 200); // Esperar el fade-out
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    procesarArchivos(e.dataTransfer.files);
  }, [procesarArchivos]);

  /* ══════════════════════════════════════════════
     SUBMIT
  ══════════════════════════════════════════════ */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Marcar todos los campos como tocados
    setTouched({ nombre: true, cedula: true, email: true, telefono: true, descripcion: true });
    const erroresFinal = validarTodo(form);
    setErrors(erroresFinal);

    // Verificar archivos obligatorios
    if (archivos.length === 0) {
      setErrorSinArch('Debe adjuntar al menos un documento escaneado.');
      document.getElementById('zona-drop')?.focus();
    }

    const hayErroresCampos = Object.values(erroresFinal).some((m) => m !== '');
    if (hayErroresCampos || archivos.length === 0) {
      // Llevar foco al primer campo con error
      if (hayErroresCampos) {
        const primerCampo = (Object.keys(erroresFinal) as CampoForm[])
          .find((k) => erroresFinal[k] !== '');
        if (primerCampo) document.getElementById(primerCampo)?.focus();
      }
      return;
    }

    setEstado('enviando');
    setProgresoMensaje('Iniciando radicación...');
    setProgresoPct(0);
    setProgresosArchivos([]);

    const res = await radicarSolicitud(
      {
        origen: 'FISICO_ESCANER',
        ciudadano: {
          nombre:   form.nombre.trim(),
          email:    form.email.trim().toLowerCase(),
          telefono: form.telefono.replace(/\s/g, ''),
          cedula:   form.cedula.trim(),
        },
        descripcion:    form.descripcion.trim(),
        notasInternas:  form.notasInternas.trim() || undefined,
        archivos:       archivos.map((a) => a.archivo),
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

  /* ── Reset completo ── */
  function resetFormulario() {
    // Limpiar object URLs antes de resetear
    archivos.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setForm({ nombre: '', cedula: '', email: '', telefono: '', descripcion: '', notasInternas: '' });
    setTouched({});
    setErrors({ nombre: '', cedula: '', email: '', telefono: '', descripcion: '' });
    setArchivos([]);
    setErroresArchivo([]);
    setErrorSinArch('');
    setEliminando(new Set());
    setEstado('formulario');
    setRadicadoId('');
    setProgresoMensaje('');
    setProgresoPct(0);
    setProgresosArchivos([]);
    setErroresSubmit([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /* ══════════════════════════════════════════════
     HELPERS DE CLASES
  ══════════════════════════════════════════════ */

  function inputCls(campo: CampoForm) {
    const base = 'w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-slate-50 text-sm ' +
      'placeholder:text-slate-500 transition-all duration-300 outline-none';
    const variantCls = touched[campo] && errors[campo]
      ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50'
      : 'border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50';
    return `${base} ${variantCls}`;
  }

  const isEnviando  = estado === 'enviando';
  const STAGGER     = [0, 70, 140, 210, 280, 350, 420];

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */

  return (
    <main
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse 70% 40% at 30% -5%, rgba(99,102,241,0.12) 0%, transparent 55%),
          #0A0A0B
        `,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
          radial-gradient(ellipse 70% 40% at 30% -5%, rgba(99,102,241,0.12) 0%, transparent 55%)
        `,
        backgroundSize: '8px 8px, 8px 8px, 100% 100%',
      }}
    >
      {/* ── Header interno ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-[20px] bg-[#0A0A0B]/75">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {/* Volver */}
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

          {/* Escudo */}
          <div className="w-8 h-8 rounded-lg border border-indigo-500/30 bg-indigo-500/15 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5.25-3.5 10.15-8 11.5C7.5 22.15 4 17.25 4 12V7l8-4z" />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-0.5">
              Alcaldía de Simacota — Módulo Interno
            </p>
            <p
              className="text-slate-100 text-sm font-black tracking-tight leading-none truncate"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Ventanilla de Recepción Física
            </p>
          </div>

          {/* Badge "USO INTERNO" */}
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 hidden sm:block">
              Uso Interno
            </span>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ── Pantalla de confirmación ── */}
        {estado === 'confirmacion' ? (
          <div
            className="rounded-2xl border border-l-4 border-white/10 border-l-indigo-500"
            style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
          >
            <PantallaConfirmacion
              radicadoId={radicadoId}
              totalArchivos={archivos.length}
              errores={erroresSubmit}
              datosComprobante={{
                nombre:      form.nombre.trim(),
                cedula:      form.cedula.trim(),
                telefono:    form.telefono.replace(/\s/g, ''),
                descripcion: form.descripcion.trim(),
                archivos:    archivos.map((a) => a.nombre),
                fechaStr:    new Date().toLocaleString('es-CO', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }),
              }}
              onNuevo={resetFormulario}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Encabezado de sección */}
            <div
              className="mb-8 field-animate"
              style={{ animationDelay: '0ms' }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/08 mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={1.5} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25m6-2.25h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  Digitalización de documento físico
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-50 mb-2"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Nueva Radicación Física
              </h1>
              <p className="text-slate-500 text-sm">
                Transcribe los datos del ciudadano y adjunta los documentos escaneados o fotografiados.
              </p>
            </div>

            {/* ── Grid dos columnas ── */}
            <div
              className="rounded-2xl border-l-4 border-indigo-500"
              style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)', border: '1px solid rgba(255,255,255,0.08)', borderLeftWidth: '4px', borderLeftColor: '#6366F1' }}
            >
              <div className="grid lg:grid-cols-[3fr_2fr] divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">

                {/* ════════════════════════════════════
                    COLUMNA IZQUIERDA — Datos ciudadano
                ════════════════════════════════════ */}
                <div className="p-6 sm:p-8 space-y-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 pb-2 border-b border-white/[0.06]">
                    Datos del ciudadano
                  </p>

                  {/* Nombre */}
                  <div className="field-animate" style={{ animationDelay: `${STAGGER[1]}ms` }}>
                    <label htmlFor="nombre" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Nombre completo *
                    </label>
                    <input
                      id="nombre"
                      type="text"
                      className={inputCls('nombre')}
                      placeholder="Nombre tal como aparece en la cédula"
                      value={form.nombre}
                      onChange={(e) => handleChange('nombre', e.target.value)}
                      onBlur={() => handleBlur('nombre')}
                      disabled={isEnviando}
                      autoComplete="off"
                      aria-describedby={errors.nombre ? 'err-nombre' : undefined}
                    />
                    <FeedbackCampo
                      id="err-nombre"
                      error={errors.nombre}
                      touched={!!touched.nombre}
                      valorOk={form.nombre.trim().length >= 3}
                    />
                  </div>

                  {/* Cédula + Email en grid */}
                  <div className="grid sm:grid-cols-2 gap-6 field-animate" style={{ animationDelay: `${STAGGER[2]}ms` }}>
                    {/* Cédula */}
                    <div>
                      <label htmlFor="cedula" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                        Cédula / Documento *
                      </label>
                      <input
                        id="cedula"
                        type="text"
                        inputMode="numeric"
                        className={inputCls('cedula')}
                        placeholder="Ej. 63451234"
                        value={form.cedula}
                        onChange={(e) => handleChange('cedula', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        onBlur={() => handleBlur('cedula')}
                        disabled={isEnviando}
                        maxLength={10}
                        aria-describedby={errors.cedula ? 'err-cedula' : undefined}
                      />
                      <FeedbackCampo
                        id="err-cedula"
                        error={errors.cedula}
                        touched={!!touched.cedula}
                        valorOk={CEDULA_RE.test(form.cedula)}
                      />
                    </div>

                    {/* Email (opcional) */}
                    <div>
                      <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                        Correo electrónico{' '}
                        <span className="text-slate-600 normal-case font-normal tracking-normal">(opcional)</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        className={inputCls('email')}
                        placeholder="Si tiene correo electrónico"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        onBlur={() => handleBlur('email')}
                        disabled={isEnviando}
                        autoComplete="off"
                        aria-describedby={errors.email ? 'err-email' : undefined}
                      />
                      <FeedbackCampo
                        id="err-email"
                        error={errors.email}
                        touched={!!touched.email}
                        valorOk={!form.email.trim() || EMAIL_RE.test(form.email.trim())}
                      />
                    </div>
                  </div>

                  {/* Teléfono con prefijo +57 */}
                  <div className="field-animate" style={{ animationDelay: `${STAGGER[3]}ms` }}>
                    <label htmlFor="telefono" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Teléfono WhatsApp *
                    </label>
                    <div
                      className={`flex rounded-xl overflow-hidden transition-all duration-300
                        ${touched.telefono && errors.telefono
                          ? 'ring-1 ring-rose-500/60 border border-rose-500'
                          : 'border border-white/10 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50'
                        }`}
                      style={{ background: 'rgba(30,41,59,0.50)' }}
                    >
                      {/* Prefijo +57 */}
                      <span className="px-3 flex items-center text-slate-400 text-sm bg-white/[0.03] border-r border-white/[0.08] select-none font-mono shrink-0">
                        +57
                      </span>
                      <input
                        id="telefono"
                        type="tel"
                        inputMode="numeric"
                        className="flex-1 bg-transparent px-4 py-3 text-slate-50 text-sm placeholder:text-slate-500 outline-none"
                        placeholder="310 000 0000"
                        value={form.telefono}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          handleChange('telefono', formatearTelefono(raw));
                        }}
                        onBlur={() => handleBlur('telefono')}
                        disabled={isEnviando}
                        autoComplete="tel"
                        aria-describedby={errors.telefono ? 'err-telefono' : undefined}
                      />
                    </div>
                    <FeedbackCampo
                      id="err-telefono"
                      error={errors.telefono}
                      touched={!!touched.telefono}
                      valorOk={TEL_DIGITS_RE.test(form.telefono.replace(/\s/g, ''))}
                    />
                  </div>

                  {/* Descripción del caso */}
                  <div className="field-animate" style={{ animationDelay: `${STAGGER[4]}ms` }}>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="descripcion" className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                        Descripción del caso *
                      </label>
                      <span className={`text-xs tabular-nums ${form.descripcion.length >= 10 ? 'text-emerald-500' : 'text-slate-600'}`}>
                        {form.descripcion.length}/800
                      </span>
                    </div>
                    <textarea
                      id="descripcion"
                      rows={4}
                      className={`${inputCls('descripcion')} resize-none`}
                      placeholder="Resume verbalmente lo que el ciudadano solicita. Ej: 'Solicita certificado de residencia para trámite de Familias en Acción'."
                      value={form.descripcion}
                      onChange={(e) => handleChange('descripcion', e.target.value.slice(0, 800))}
                      onBlur={() => handleBlur('descripcion')}
                      disabled={isEnviando}
                      aria-describedby={errors.descripcion ? 'err-descripcion' : undefined}
                    />
                    <FeedbackCampo
                      id="err-descripcion"
                      error={errors.descripcion}
                      touched={!!touched.descripcion}
                      valorOk={form.descripcion.trim().length >= 10}
                    />
                  </div>

                  {/* Notas internas (solo funcionario) */}
                  <div className="field-animate" style={{ animationDelay: `${STAGGER[5]}ms` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="notasInternas" className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                        Notas internas
                      </label>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                        Solo funcionario
                      </span>
                    </div>
                    <textarea
                      id="notasInternas"
                      rows={3}
                      className="w-full bg-amber-500/[0.04] border border-amber-500/20 rounded-xl px-4 py-3 text-slate-300 text-sm
                        placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30
                        transition-all duration-300 outline-none resize-none"
                      placeholder="Observaciones que solo verá el equipo interno. No se comparte con el ciudadano."
                      value={form.notasInternas}
                      onChange={(e) => handleChange('notasInternas', e.target.value.slice(0, 500))}
                      disabled={isEnviando}
                    />
                    <p className="mt-1.5 text-[10px] text-slate-600 flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      No visible para el ciudadano
                    </p>
                  </div>
                </div>

                {/* ════════════════════════════════════
                    COLUMNA DERECHA — Zona de archivos
                ════════════════════════════════════ */}
                <div className="p-6 sm:p-8 space-y-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 pb-2 border-b border-white/[0.06] flex items-center justify-between">
                    <span>Documentos escaneados *</span>
                    <span className="text-slate-600 normal-case font-normal tracking-normal text-[10px]">Mín. 1 requerido</span>
                  </p>

                  {/* ── Zona Drag & Drop ── */}
                  {archivos.length < MAX_ARCHIVOS && (
                    <div
                      id="zona-drop"
                      role="button"
                      tabIndex={0}
                      aria-label="Zona de carga. Arrastra documentos escaneados o haz clic para seleccionar."
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      className={[
                        'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer',
                        'transition-all duration-300 min-h-[180px] flex flex-col items-center justify-center gap-4',
                        isDragging
                          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                          : errorSinArch
                          ? 'border-rose-500/60 bg-rose-500/05 hover:border-rose-500/80'
                          : 'border-white/20 hover:border-indigo-500/50 hover:bg-white/[0.01]',
                        isEnviando ? 'pointer-events-none opacity-50' : '',
                      ].join(' ')}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={(e) => procesarArchivos(e.target.files)}
                        disabled={isEnviando}
                        aria-hidden="true"
                      />

                      {/* Ícono central */}
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                          isDragging
                            ? 'bg-indigo-500/25 text-indigo-400'
                            : errorSinArch
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-white/[0.05] text-slate-500'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
                        </svg>
                      </div>

                      <div className="pointer-events-none">
                        <p className="text-sm font-medium text-slate-300">
                          {isDragging ? 'Suelta aquí los documentos' : (
                            <>
                              Arrastre los documentos escaneados aquí o{' '}
                              <span className="text-indigo-400 underline underline-offset-2">haga clic para seleccionar</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-slate-600 mt-1.5">
                          PDF, JPG, PNG, WEBP — Máx. 10 MB por archivo · 50 MB total
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error: sin archivos */}
                  {errorSinArch && (
                    <p className="text-xs text-rose-400 flex items-center gap-1.5 -mt-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {errorSinArch}
                    </p>
                  )}

                  {/* Archivos rechazados */}
                  {erroresArchivo.length > 0 && (
                    <div className="space-y-1.5">
                      {erroresArchivo.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/08 px-3 py-2"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth={2} className="w-3.5 h-3.5 shrink-0 mt-0.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs text-rose-400 font-medium truncate">{err.nombre}</p>
                            <p className="text-[10px] text-rose-500/80">{err.razon}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setErroresArchivo((prev) => prev.filter((_, j) => j !== i))}
                            className="ml-auto text-rose-600 hover:text-rose-400 transition-colors shrink-0"
                            aria-label="Descartar error"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Barra de progreso */}
                  {archivos.length > 0 && (
                    <BarraProgresoCarga archivos={archivos} />
                  )}

                  {/* Lista de archivos con preview */}
                  {archivos.length > 0 && (
                    <div className="space-y-2">
                      {archivos.map((archivo) => (
                        <ArchivoPreview
                          key={archivo.id}
                          archivo={archivo}
                          onEliminar={iniciarEliminar}
                          isRemoving={eliminando.has(archivo.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Cupo restante */}
                  {archivos.length > 0 && archivos.length < MAX_ARCHIVOS && (
                    <p className="text-[10px] text-slate-600 text-center">
                      Puede agregar {MAX_ARCHIVOS - archivos.length} archivo{MAX_ARCHIVOS - archivos.length !== 1 ? 's' : ''} más
                    </p>
                  )}
                </div>
              </div>

              {/* ── Botón submit (barra inferior de la tarjeta) ── */}
              <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-4 border-t border-white/[0.06] space-y-3">
                {/* Barra de progreso — visible solo mientras se envía */}
                {isEnviando && (
                  <div className="rounded-xl border border-white/10 p-4 bg-slate-800/40">
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
                            <span className="truncate max-w-[200px]">{p.archivo}</span>
                            <span className="ml-auto tabular-nums text-slate-600">{p.porcentaje}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isEnviando}
                  className="w-full py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-white
                    bg-gradient-to-r from-indigo-600 to-indigo-500
                    hover:from-indigo-500 hover:to-indigo-400
                    hover:shadow-lg hover:shadow-indigo-500/25
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                    transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  {isEnviando ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 animate-spin-smooth">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Radicando solicitud física...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25m6-2.25h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
                      </svg>
                      Registrar Radicado Físico
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-5 mt-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
          Módulo Interno · Alcaldía de Simacota · Uso exclusivo funcionarios
        </p>
      </footer>
    </main>
  );
}
