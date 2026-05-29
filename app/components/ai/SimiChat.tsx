'use client';

import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react';
import { useSimiNotifier } from '@/lib/store/simiContext';
import type {
  MensajeChat,
  EstadoSimi,
  ResultadoExtraccion,
  DatosExtraidos,
} from '@/src/types/simi';

/* ══════════════════════════════════════════════════════════════
   CONSTANTES DE VALIDACIÓN (Shift-Left — cliente)
══════════════════════════════════════════════════════════════ */

const SCAN_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const SCAN_MIME_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const SCAN_MIME_LABEL = 'JPG, PNG, WEBP o PDF';

/* ══════════════════════════════════════════════════════════════
   MENSAJE INICIAL DE SIMI
══════════════════════════════════════════════════════════════ */

const MENSAJE_BIENVENIDA: MensajeChat = {
  id: 'bienvenida',
  rol: 'assistant',
  contenido:
    '¡Hola! Soy **SIMI**, su asistente de la Ventanilla Única. ¿En qué le puedo ayudar hoy?\n\n' +
    'Recuerde que si tiene un documento físico, puede usar el botón **📎** para escanearlo ' +
    'y yo le ayudo a llenar el formulario rápidamente.',
  timestamp: Date.now(),
};

/* ══════════════════════════════════════════════════════════════
   FUNCIÓN UTILITARIA — FileReader → base64
   Separada del JSX para mantener el componente limpio.
══════════════════════════════════════════════════════════════ */

/**
 * Convierte un File a string base64 usando la File API nativa.
 * No usa Buffer de Node — seguro en entorno cliente.
 *
 * @throws Error si el FileReader falla (archivo corrupto, permisos, etc.)
 */
function leerArchivoComoBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const resultado = reader.result;
      if (typeof resultado !== 'string') {
        reject(new Error('FileReader devolvió un resultado inesperado.'));
        return;
      }
      // reader.result es "data:image/jpeg;base64,XXXXXX..."
      // Extraemos solo la parte base64 pura después de la coma
      const base64 = resultado.split(',')[1];
      if (!base64) {
        reject(new Error('No se pudo extraer el contenido base64 del archivo.'));
        return;
      }
      resolve(base64);
    };

    reader.onerror = () =>
      reject(new Error('Error al leer el archivo. Intente de nuevo.'));

    reader.readAsDataURL(archivo);
  });
}

/* ══════════════════════════════════════════════════════════════
   FUNCIÓN UTILITARIA — Formatear confirmación de extracción
══════════════════════════════════════════════════════════════ */

const ETIQUETAS_CAMPO: Record<keyof DatosExtraidos, string> = {
  nombre: 'Nombre',
  email: 'Correo electrónico',
  telefono: 'Teléfono',
  descripcion: 'Descripción / asunto',
};

function construirMensajeExtraccion(
  resultado: ResultadoExtraccion & { exito: true },
): string {
  const camposTexto = resultado.camposEncontrados
    .map((c) => `• **${ETIQUETAS_CAMPO[c]}**`)
    .join('\n');

  const lineas = [
    `¡Listo, sumercé! Encontré estos datos en su documento y los llené en el formulario:\n`,
    camposTexto,
  ];

  if (resultado.advertencia) {
    lineas.push(`\n⚠️ ${resultado.advertencia}`);
  }

  const faltantes = (
    Object.keys(ETIQUETAS_CAMPO) as Array<keyof DatosExtraidos>
  ).filter((c) => !resultado.camposEncontrados.includes(c));

  if (faltantes.length > 0) {
    const faltantesTexto = faltantes
      .map((c) => `**${ETIQUETAS_CAMPO[c]}**`)
      .join(', ');
    lineas.push(
      `\nLos campos ${faltantesTexto} no estaban visibles — por favor complételos manualmente.`,
    );
  }

  return lineas.join('\n');
}

/* ══════════════════════════════════════════════════════════════
   SUBCOMPONENTES PUROS
══════════════════════════════════════════════════════════════ */

/** Burbuja de mensaje individual con soporte a negritas e itálicas */
function BurbujaMensaje({ mensaje }: { readonly mensaje: MensajeChat }) {
  const esAsistente = mensaje.rol === 'assistant';
  return (
    <div
      className={[
        'flex flex-col max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed animate-fade-in-up',
        esAsistente
          ? 'self-start bg-slate-800/50 border border-white/[0.06] text-slate-200 rounded-tl-none'
          : 'self-end bg-indigo-600/90 text-white rounded-br-none ml-auto',
        mensaje.esExtraccion
          ? 'border-emerald-500/30 bg-emerald-950/40'
          : '',
      ].join(' ')}
    >
      <p
        dangerouslySetInnerHTML={{
          __html: mensaje.contenido
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/⚠️/g, '<span aria-label="advertencia">⚠️</span>')
            .replace(/\n/g, '<br />'),
        }}
      />
    </div>
  );
}

/** Indicador de escritura animado */
function IndicadorEscritura({ texto }: { readonly texto: string }) {
  return (
    <div className="self-start bg-slate-800/40 border border-white/[0.05] text-slate-400 rounded-2xl rounded-tl-none px-4 py-3 text-xs max-w-[88%] animate-fade-in-up">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">{texto}</span>
        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

/** Chip de archivo adjunto pendiente de escanear */
function ChipArchivo({
  nombre,
  onEliminar,
  disabled,
}: {
  readonly nombre: string;
  readonly onEliminar: () => void;
  readonly disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-medium max-w-full">
      {/* Icono clip */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
      </svg>
      <span className="truncate max-w-[140px]">{nombre}</span>
      {!disabled && (
        <button
          type="button"
          onClick={onEliminar}
          aria-label={`Quitar archivo ${nombre}`}
          className="text-indigo-400 hover:text-rose-400 transition-colors shrink-0 ml-0.5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

export function SimiChat() {
  const { notificarExtraccion } = useSimiNotifier();

  /* ── Estado ── */
  const [isOpen, setIsOpen]           = useState(false);
  const [mensajes, setMensajes]       = useState<MensajeChat[]>([MENSAJE_BIENVENIDA]);
  const [inputTexto, setInputTexto]   = useState('');
  const [estadoSimi, setEstadoSimi]   = useState<EstadoSimi>('IDLE');
  const [archivoScan, setArchivoScan] = useState<File | null>(null);

  /* ── Refs ── */
  const chatEndRef     = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const inputTextoRef  = useRef<HTMLInputElement>(null);

  /* ── Persistencia en sessionStorage ── */
  useEffect(() => {
    const guardado = sessionStorage.getItem('simi_v2_history');
    if (guardado) {
      try {
        const parseado = JSON.parse(guardado) as MensajeChat[];
        if (Array.isArray(parseado) && parseado.length > 0) {
          setMensajes(parseado);
        }
      } catch {
        /* silenciar error de parsing — no crítico */
      }
    }
  }, []);

  /* ── Scroll al último mensaje ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, estadoSimi]);

  /* ── Helper: agregar mensaje ── */
  const agregarMensaje = useCallback((parcial: Omit<MensajeChat, 'id' | 'timestamp'>) => {
    const nuevo: MensajeChat = {
      ...parcial,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    setMensajes((prev) => {
      const siguiente = [...prev, nuevo];
      sessionStorage.setItem('simi_v2_history', JSON.stringify(siguiente));
      return siguiente;
    });
    return nuevo;
  }, []);

  /* ══════════════════════════════════════════════════════════════
     HANDLER: ESCANEAR DOCUMENTO (Fase 2 — Shift-Left Validation)
  ══════════════════════════════════════════════════════════════ */

  /**
   * Ejecuta el flujo completo de extracción Vision AI:
   * 1. Valida tipo MIME y tamaño en cliente (Shift-Left)
   * 2. Convierte a base64 con FileReader
   * 3. Envía multipart/form-data a /api/ai/scan-doc
   * 4. Notifica al formulario padre si exito=true
   * 5. Muestra feedback en el chat (éxito o error)
   */
  const handleScanDoc = useCallback(async (archivo: File) => {
    /* ── Validación Shift-Left (antes de tocar la red) ── */
    if (!SCAN_MIME_PERMITIDOS.has(archivo.type)) {
      agregarMensaje({
        rol: 'assistant',
        contenido:
          `El archivo **"${archivo.name}"** no es compatible. ` +
          `Solo acepto ${SCAN_MIME_LABEL}. Intente con otra imagen o PDF.`,
      });
      setArchivoScan(null);
      return;
    }

    if (archivo.size > SCAN_MAX_BYTES) {
      const mb = (archivo.size / (1024 * 1024)).toFixed(1);
      agregarMensaje({
        rol: 'assistant',
        contenido:
          `El archivo pesa **${mb} MB** y supera el límite de 4 MB del escáner. ` +
          `Por favor, comprima la imagen o recorte el área del documento e intente de nuevo.`,
      });
      setArchivoScan(null);
      return;
    }

    /* ── Inicia escaneo ── */
    setEstadoSimi('ESCANEANDO');

    try {
      /* ── Lectura del archivo como base64 (función utilitaria pura) ── */
      const base64 = await leerArchivoComoBase64(archivo);

      /* ── Reconstruimos el File desde base64 para enviarlo como multipart ── */
      // Convertimos base64 → Blob → File para el FormData
      const byteString = atob(base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: archivo.type });
      const fileReconstruido = new File([blob], archivo.name, { type: archivo.type });

      /* ── Envío multipart/form-data ── */
      const formData = new FormData();
      formData.append('archivo', fileReconstruido);

      const response = await fetch('/api/ai/scan-doc', {
        method: 'POST',
        // NO fijar Content-Type — el browser lo establece con el boundary correcto
        body: formData,
      });

      const resultado = await response.json() as ResultadoExtraccion;

      /* ── Manejo del resultado discriminado ── */
      if (resultado.exito) {
        // 1. Notificar al formulario padre (a través del Context)
        notificarExtraccion(resultado.datos);

        // 2. Confirmar en el chat qué campos se llenaron
        agregarMensaje({
          rol: 'assistant',
          contenido: construirMensajeExtraccion(resultado),
          esExtraccion: true,
        });
      } else {
        // Mostrar el mensajeError del backend directamente en el chat
        agregarMensaje({
          rol: 'assistant',
          contenido: resultado.mensajeError,
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      console.error('[SimiChat] Error en handleScanDoc:', msg);
      agregarMensaje({
        rol: 'assistant',
        contenido:
          'El escáner de documentos no está disponible en este momento. ' +
          'Por favor, ingrese sus datos manualmente en el formulario o intente adjuntar el archivo nuevamente.',
      });
    } finally {
      setEstadoSimi('IDLE');
      setArchivoScan(null);
      // Limpiar el input nativo para permitir seleccionar el mismo archivo de nuevo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [agregarMensaje, notificarExtraccion]);

  /* ══════════════════════════════════════════════════════════════
     HANDLER: SELECCIÓN DE ARCHIVO
  ══════════════════════════════════════════════════════════════ */

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;

      // Guardamos el archivo en estado para mostrar el chip
      // El escaneo se dispara con el botón de envío (o automáticamente)
      setArchivoScan(archivo);

      // Auto-disparar el escaneo al seleccionar el archivo
      // (UX más fluida — el usuario no necesita presionar "enviar")
      void handleScanDoc(archivo);
    },
    [handleScanDoc],
  );

  /* ══════════════════════════════════════════════════════════════
     HANDLER: ENVÍO DE MENSAJE DE TEXTO
  ══════════════════════════════════════════════════════════════ */

  const handleEnviarTexto = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const texto = inputTexto.trim();
      if (!texto || estadoSimi !== 'IDLE') return;

      setInputTexto('');
      setEstadoSimi('CARGANDO');

      const mensajesConUsuario = [
        ...mensajes,
        {
          id: `usr_${Date.now()}`,
          rol: 'user' as const,
          contenido: texto,
          timestamp: Date.now(),
        },
      ];

      setMensajes(mensajesConUsuario);
      sessionStorage.setItem('simi_v2_history', JSON.stringify(mensajesConUsuario));

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: mensajesConUsuario.map((m) => ({
              role: m.rol,
              content: m.contenido,
            })),
            // No enviamos contextoFormulario desde el widget global — el form
            // maneja su propia integración a través del Context.
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as { role: string; content: string };
        agregarMensaje({ rol: 'assistant', contenido: data.content });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[SimiChat] Error en chat:', msg);
        agregarMensaje({
          rol: 'assistant',
          contenido:
            'No fue posible procesar su mensaje en este momento. ' +
            'Por favor, intente de nuevo o use el botón 📎 para escanear su documento.',
        });
      } finally {
        setEstadoSimi('IDLE');
        // Re-enfocar el input después de recibir respuesta
        setTimeout(() => inputTextoRef.current?.focus(), 100);
      }
    },
    [inputTexto, estadoSimi, mensajes, agregarMensaje],
  );

  /* ══════════════════════════════════════════════════════════════
     HANDLER: LIMPIAR HISTORIAL
  ══════════════════════════════════════════════════════════════ */

  const handleLimpiarHistorial = useCallback(() => {
    setMensajes([MENSAJE_BIENVENIDA]);
    sessionStorage.removeItem('simi_v2_history');
    setArchivoScan(null);
    setEstadoSimi('IDLE');
  }, []);

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */

  const estaOcupado = estadoSimi !== 'IDLE';
  const textoIndicador =
    estadoSimi === 'ESCANEANDO'
      ? 'Analizando documento, sumercé...'
      : 'SIMI está pensando';

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">

      {/* ── BOTÓN FLOTANTE ── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        aria-label={isOpen ? 'Cerrar asistente SIMI' : 'Abrir asistente SIMI'}
        aria-expanded={isOpen}
        aria-controls="simi-chat-panel"
        className={[
          'w-14 h-14 rounded-full flex items-center justify-center cursor-pointer',
          'transition-all duration-300 shadow-xl border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          isOpen
            ? 'bg-slate-900 border-white/10 hover:bg-slate-800 scale-95'
            : 'bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 border-indigo-400/35 hover:shadow-indigo-500/30 scale-100 hover:scale-[1.05]',
        ].join(' ')}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-slate-100">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
        )}
      </button>

      {/* ── PANEL DE CHAT ── */}
      {isOpen && (
        <div
          id="simi-chat-panel"
          role="dialog"
          aria-label="Asistente SIMI — Ventanilla Única de Simacota"
          className="absolute bottom-[4.5rem] right-0 w-[350px] sm:w-[390px] h-[520px] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-fade-in-up"
          style={{ background: 'rgba(10, 10, 11, 0.92)', backdropFilter: 'blur(24px)' }}
        >

          {/* ── Cabecera ── */}
          <div className="bg-slate-950/70 px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-inner relative shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.473M9.813 15.904L5.223 3.522a.75.75 0 01.02-.622.75.75 0 01.554-.424L20.25 6.075a.75.75 0 01.354 1.157L9.813 15.904z" />
                </svg>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-950" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-100">SIMI</p>
                <p className="text-[10px] text-slate-400">Agente IA · Simacota</p>
              </div>
            </div>

            {/* Badge escaneando */}
            {estadoSimi === 'ESCANEANDO' && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Escaneando</span>
              </div>
            )}

            <button
              onClick={handleLimpiarHistorial}
              title="Limpiar conversación"
              aria-label="Limpiar historial de conversación con SIMI"
              disabled={estaOcupado}
              className="text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* ── Área de Mensajes ── */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent' }}
          >
            {mensajes.map((msg) => (
              <BurbujaMensaje key={msg.id} mensaje={msg} />
            ))}

            {estaOcupado && <IndicadorEscritura texto={textoIndicador} />}

            <div ref={chatEndRef} />
          </div>

          {/* ── Barra de Entrada ── */}
          <form
            onSubmit={handleEnviarTexto}
            className="shrink-0 p-3 bg-slate-950/50 border-t border-white/[0.07] space-y-2"
          >
            {/* Chip de archivo adjunto */}
            {archivoScan && (
              <ChipArchivo
                nombre={archivoScan.name}
                disabled={estaOcupado}
                onEliminar={() => {
                  setArchivoScan(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            )}

            {/* Fila de input + botones */}
            <div className="flex items-center gap-2">

              {/* Input oculto de archivo */}
              <input
                ref={fileInputRef}
                type="file"
                id="simi-file-input"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                aria-hidden="true"
                onChange={handleFileChange}
                disabled={estaOcupado}
              />

              {/* Botón adjuntar (clip / escáner) */}
              <button
                type="button"
                aria-label="Adjuntar documento para que SIMI extraiga datos automáticamente"
                title={`Escanear documento (${SCAN_MIME_LABEL}, máx. 4 MB)`}
                onClick={() => fileInputRef.current?.click()}
                disabled={estaOcupado}
                className={[
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200',
                  'border focus-visible:ring-2 focus-visible:ring-indigo-500',
                  estaOcupado
                    ? 'opacity-30 cursor-not-allowed border-white/5 text-slate-600'
                    : 'border-white/10 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 cursor-pointer',
                ].join(' ')}
              >
                {/* Ícono clip */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>

              {/* Input de texto */}
              <input
                ref={inputTextoRef}
                type="text"
                id="simi-text-input"
                value={inputTexto}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInputTexto(e.target.value)}
                placeholder={
                  estadoSimi === 'ESCANEANDO'
                    ? 'Analizando documento...'
                    : 'Pregúntele a SIMI... o use 📎 para escanear'
                }
                disabled={estaOcupado}
                autoComplete="off"
                maxLength={500}
                aria-label="Mensaje para SIMI"
                className="flex-1 bg-slate-800/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />

              {/* Botón enviar texto */}
              <button
                type="submit"
                disabled={!inputTexto.trim() || estaOcupado}
                aria-label="Enviar mensaje a SIMI"
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors rounded-xl flex items-center justify-center shrink-0 text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>

            {/* Hint contextual */}
            <p className="text-[9px] text-slate-600 text-center leading-relaxed">
              📎 Adjunta tu cédula o carta para llenar el formulario automáticamente
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
