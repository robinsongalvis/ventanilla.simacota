'use client';

import { useMemo, useRef, useState } from 'react';
import {
  calcularFechaVencimiento,
  type TipoSolicitudId,
} from '@/lib/tiempos-radicado';
import {
  getTiposSolicitudInternos,
  getTipoSolicitudById,
} from '@/lib/catalogos/tipos-solicitud';
import type { MedioRecepcion, TipoDocumento, TipoPersona } from '@/src/types/ventanilla';

const MUNICIPIOS_SANTANDER = [
  'Simacota',
  'Bucaramanga',
  'Barrancabermeja',
  'Socorro',
  'San Gil',
  'Velez',
  'El Carmen de Chucuri',
  'Puerto Parra',
  'Hato',
  'Palmas del Socorro',
];

interface FormState {
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  direccion: string;
  pais: string;
  departamento: string;
  municipio: string;
  medioRecepcion: MedioRecepcion;
  tipoSolicitudId: TipoSolicitudId;
  asunto: string;
  descripcion: string;
  numeroFolios: number;
  anexosDescripcion: string;
}

interface Props {
  radicadoPreview: string;
  onSubmit?: (payload: FormState & { archivos: File[]; fechaVencimiento: string }) => Promise<void> | void;
  /** Sprint UI Radicación Rápida: id del <form> para disparar submit desde un botón externo (footer modal). */
  formId?: string;
  /** Sprint UI Radicación Rápida: ocultar el botón Submit interno cuando el contenedor pone su propio footer. */
  hideSubmitButton?: boolean;
}

const INITIAL_FORM: FormState = {
  tipoPersona: 'NATURAL',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  nombreCompleto: '',
  email: '',
  telefono: '',
  direccion: '',
  pais: 'COLOMBIA',
  departamento: 'SANTANDER',
  municipio: 'Simacota',
  medioRecepcion: 'OFICIO_FISICO',
  tipoSolicitudId: 'PETICION_INFORMACION',
  asunto: '',
  descripcion: '',
  numeroFolios: 0,
  anexosDescripcion: '',
};

import { formatFechaHoraColombia } from '@/lib/fecha-colombia';

function formatDateTime(date: Date): string {
  return formatFechaHoraColombia(date);
}

/* ── Estilos compartidos ─────────────────────────────────────── */
const sectionCls = 'rounded-xl bg-white p-4 space-y-1';
const sectionStyle = { border: '1px solid #D9E2D9', boxShadow: '0 1px 2px rgba(20,83,45,0.05)' };
const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';
const labelStyle = { color: '#667085' };

export function RadicacionFuncionarioForm({ radicadoPreview, onSubmit, formId, hideSubmitButton = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fechaRadicado = useMemo(() => new Date(), []);

  const vencimiento = useMemo(
    () => calcularFechaVencimiento(fechaRadicado, form.tipoSolicitudId),
    [fechaRadicado, form.tipoSolicitudId],
  );

  const municipiosFiltrados = MUNICIPIOS_SANTANDER.filter((m) =>
    m.toLowerCase().includes(form.municipio.toLowerCase()),
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const nuevos = Array.from(files).filter((file) =>
      file.type === 'application/pdf' || file.type.startsWith('image/'),
    );
    setArchivos((prev) => [...prev, ...nuevos].slice(0, 10));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onSubmit?.({
        ...form,
        archivos,
        fechaVencimiento: vencimiento.fechaVencimiento,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="space-y-5"
    >

      {/* ── Bloque radicado ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle eyebrow="Radicado" title="Datos de recepción" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Número radicado" value={radicadoPreview} />
          <ReadOnlyField label="Fecha y hora"    value={formatDateTime(fechaRadicado)} />
          <SelectField
            label="Medio de recepción"
            value={form.medioRecepcion}
            onChange={(v) => update('medioRecepcion', v as MedioRecepcion)}
            options={[
              ['OFICIO_FISICO', 'Oficio físico'],
              ['EMAIL', 'Email'],
              ['WEB', 'Web'],
              ['PRESENCIAL', 'Presencial'],
            ]}
          />
          <ReadOnlyField
            label="Fecha vencimiento"
            value={formatFechaHoraColombia(vencimiento.fechaVencimiento, { fallback: '—' })}
          />
        </div>
      </section>

      {/* ── Datos solicitante ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle eyebrow="Solicitante" title="Datos del solicitante" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Tipo persona"
            value={form.tipoPersona}
            onChange={(v) => update('tipoPersona', v as TipoPersona)}
            options={[
              ['NATURAL',  'Natural'],
              ['JURIDICA', 'Jurídica'],
            ]}
          />
          <SelectField
            label="Tipo documento"
            value={form.tipoDocumento}
            onChange={(v) => update('tipoDocumento', v as TipoDocumento)}
            options={[
              ['CC',         'Cédula'],
              ['CE',         'Cédula extranjeríca'],
              ['NIT',        'NIT'],
              ['PASAPORTE',  'Pasaporte'],
              ['OTRO',       'Otro'],
            ]}
          />
          <TextField
            label="Identificación"
            value={form.numeroDocumento}
            onChange={(v) => update('numeroDocumento', v)}
            required
          />
          <TextField
            label="Nombre / razón social"
            value={form.nombreCompleto}
            onChange={(v) => update('nombreCompleto', v)}
            required
            className="md:col-span-2 xl:col-span-2"
          />
          <TextField label="Correo electrónico" value={form.email}    onChange={(v) => update('email', v)}    type="email" className="xl:col-span-2" />
          <TextField label="Teléfono"            value={form.telefono} onChange={(v) => update('telefono', v)} />
          <TextField label="Dirección"           value={form.direccion} onChange={(v) => update('direccion', v)} className="md:col-span-2 xl:col-span-3" />
          <TextField label="País"          value={form.pais}         onChange={(v) => update('pais', v.toUpperCase())} />
          <TextField label="Departamento"  value={form.departamento} onChange={(v) => update('departamento', v.toUpperCase())} />
          <div className="relative md:col-span-2 xl:col-span-2">
            <TextField label="Municipio" value={form.municipio} onChange={(v) => update('municipio', v)} />
            {form.municipio && municipiosFiltrados.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl shadow-lg bg-white"
                   style={{ border: '1px solid #D9E2D9' }}>
                {municipiosFiltrados.slice(0, 5).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update('municipio', m)}
                    className="block w-full px-3 py-2 text-left text-xs transition-colors"
                    style={{ color: '#1F2933' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Clasificación ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle eyebrow="Clasificación" title="Términos y detalle de la solicitud" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Tipo solicitud / doc"
            value={form.tipoSolicitudId}
            onChange={(v) => update('tipoSolicitudId', v as TipoSolicitudId)}
            options={getTiposSolicitudInternos().map((t) => {
              const unidad = t.tipoDias === 'HABILES' ? 'hábiles' : 'calendario';
              const validacion = t.requiereValidacionJuridica ? ' · Validar jurídicamente' : '';
              return [
                t.id,
                `${t.nombre} · ${t.categoria} · ${t.terminoDias} días ${unidad}${validacion}`,
              ];
            })}
            className="md:col-span-2 xl:col-span-2"
          />
          <ReadOnlyField
            label="Días de respuesta"
            value={`${vencimiento.diasRespuesta} ${vencimiento.unidad.toLowerCase()}`}
          />
          <TextField
            label="Número de folios"
            value={String(form.numeroFolios)}
            onChange={(v) => update('numeroFolios', Number(v.replace(/\D/g, '') || 0))}
          />
          {getTipoSolicitudById(form.tipoSolicitudId)?.requiereValidacionJuridica && (
            <div
              className="md:col-span-2 xl:col-span-4 rounded-md border px-3 py-2 text-xs"
              style={{ borderColor: '#FBBF24', background: '#FEF3C7', color: '#92400E' }}
              role="alert"
            >
              <strong>Validación jurídica pendiente:</strong>{' '}
              Este tipo fue heredado del sistema actual o tiene tratamiento especial.
              Confirme con el área jurídica antes de cerrar el radicado.
            </div>
          )}
          <TextField
            label="Asunto"
            value={form.asunto}
            onChange={(v) => update('asunto', v)}
            required
            className="md:col-span-2 xl:col-span-4"
          />
          <div className="md:col-span-2 xl:col-span-4">
            <label>
              <span className={labelCls} style={labelStyle}>Descripción</span>
              <textarea
                value={form.descripcion}
                onChange={(e) => update('descripcion', e.target.value)}
                rows={4}
                className="input-internal"
                required
              />
            </label>
          </div>
        </div>
      </section>

      {/* ── Anexos ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle eyebrow="Anexos" title="Archivos y soportes" />
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className="rounded-lg border border-dashed p-5 text-center transition-colors cursor-pointer"
          style={dragging
            ? { borderColor: '#14532D', background: '#EEF4EE' }
            : { borderColor: '#D9E2D9', background: '#F8FAF7' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <svg className="w-6 h-6 mx-auto mb-2" style={{ color: '#94A3B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm font-semibold" style={{ color: '#1F2933' }}>Arrastra PDFs o imágenes aquí</p>
          <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>Máximo 10 archivos · PDF, JPG, PNG, WebP</p>
        </div>
        {archivos.length > 0 && (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {archivos.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                style={{ border: '1px solid #D9E2D9', background: '#F8FAF7' }}
              >
                <span className="truncate" style={{ color: '#1F2933' }}>{file.name}</span>
                <button
                  type="button"
                  onClick={() => setArchivos((prev) => prev.filter((_, i) => i !== index))}
                  className="ml-2 shrink-0 text-red-500 hover:text-red-700 transition-colors text-[11px] font-semibold"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Submit interno (oculto cuando el contenedor pone su propio footer) ── */}
      {!hideSubmitButton && (
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all disabled:opacity-60 active:scale-[0.98]"
            style={{ background: '#14532D' }}
            onMouseEnter={(e) => { if (!guardando) (e.currentTarget as HTMLElement).style.background = '#166534'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
          >
            {guardando && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {guardando ? 'Radicando...' : 'Registrar radicado'}
          </button>
        </div>
      )}
    </form>
  );
}

/* ── Sub-componentes de UI ──────────────────────────────────── */

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>{eyebrow}</p>
      <h2 className="text-base font-black" style={{ color: '#1F2933' }}>{title}</h2>
    </div>
  );
}

function TextField({
  label, value, onChange, type = 'text', required, className = '',
}: {
  label: string; value: string; onChange: (value: string) => void;
  type?: string; required?: boolean; className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelCls} style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="input-internal"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options, className = '',
}: {
  label: string; value: string; onChange: (value: string) => void;
  options: [string, string][]; className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelCls} style={labelStyle}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-internal w-full"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelCls} style={labelStyle}>{label}</p>
      <p
        className="rounded-lg px-3 py-2 text-sm font-semibold"
        style={{ border: '1px solid #D9E2D9', background: '#EEF4EE', color: '#1F2933' }}
      >
        {value}
      </p>
    </div>
  );
}
