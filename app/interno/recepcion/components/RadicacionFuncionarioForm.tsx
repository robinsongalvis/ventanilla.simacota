'use client';

import { useMemo, useRef, useState } from 'react';
import {
  LISTA_TIPOS_SOLICITUD,
  calcularFechaVencimiento,
  type TipoSolicitudId,
} from '@/lib/tiempos-radicado';
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

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function RadicacionFuncionarioForm({ radicadoPreview, onSubmit }: Props) {
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <ReadOnlyField label="Numero radicado" value={radicadoPreview} />
          <ReadOnlyField label="Fecha y hora" value={formatDateTime(fechaRadicado)} />
          <SelectField
            label="Medio"
            value={form.medioRecepcion}
            onChange={(v) => update('medioRecepcion', v as MedioRecepcion)}
            options={[
              ['OFICIO_FISICO', 'Oficio fisico'],
              ['EMAIL', 'Email'],
              ['WEB', 'Web'],
              ['PRESENCIAL', 'Presencial'],
            ]}
          />
          <ReadOnlyField
            label="Vencimiento"
            value={new Date(vencimiento.fechaVencimiento).toLocaleDateString('es-CO')}
          />
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <SectionTitle eyebrow="Solicitante" title="Datos del solicitante" />
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField
            label="Tipo persona"
            value={form.tipoPersona}
            onChange={(v) => update('tipoPersona', v as TipoPersona)}
            options={[
              ['NATURAL', 'Natural'],
              ['JURIDICA', 'Juridica'],
            ]}
          />
          <SelectField
            label="Tipo documento"
            value={form.tipoDocumento}
            onChange={(v) => update('tipoDocumento', v as TipoDocumento)}
            options={[
              ['CC', 'Cedula'],
              ['CE', 'Cedula extranjeria'],
              ['NIT', 'NIT'],
              ['PASAPORTE', 'Pasaporte'],
              ['OTRO', 'Otro'],
            ]}
          />
          <TextField label="Identificacion" value={form.numeroDocumento} onChange={(v) => update('numeroDocumento', v)} required />
          <TextField label="Nombre / razon social" value={form.nombreCompleto} onChange={(v) => update('nombreCompleto', v)} required className="md:col-span-1" />
          <TextField label="Correo electronico" value={form.email} onChange={(v) => update('email', v)} type="email" />
          <TextField label="Telefono" value={form.telefono} onChange={(v) => update('telefono', v)} />
          <TextField label="Direccion" value={form.direccion} onChange={(v) => update('direccion', v)} className="md:col-span-2" />
          <TextField label="Pais" value={form.pais} onChange={(v) => update('pais', v.toUpperCase())} />
          <TextField label="Departamento" value={form.departamento} onChange={(v) => update('departamento', v.toUpperCase())} />
          <div className="relative md:col-span-2">
            <TextField label="Municipio" value={form.municipio} onChange={(v) => update('municipio', v)} />
            {form.municipio && municipiosFiltrados.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-slate-950 shadow-xl">
                {municipiosFiltrados.slice(0, 5).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update('municipio', m)}
                    className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <SectionTitle eyebrow="Clasificacion" title="Terminos y detalle de la solicitud" />
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField
            label="Tipo solicitud / doc"
            value={form.tipoSolicitudId}
            onChange={(v) => update('tipoSolicitudId', v as TipoSolicitudId)}
            options={LISTA_TIPOS_SOLICITUD.map((t) => [
              t.id,
              `${t.nombre} - ${t.diasRespuesta} dias ${t.unidad.toLowerCase()}`,
            ])}
            className="md:col-span-2"
          />
          <ReadOnlyField label="Dias respuesta" value={`${vencimiento.diasRespuesta} ${vencimiento.unidad.toLowerCase()}`} />
          <TextField
            label="Numero folios"
            value={String(form.numeroFolios)}
            onChange={(v) => update('numeroFolios', Number(v.replace(/\D/g, '') || 0))}
          />
          <TextField label="Asunto" value={form.asunto} onChange={(v) => update('asunto', v)} required className="md:col-span-4" />
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Descripcion</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => update('descripcion', e.target.value)}
              rows={4}
              className="input-internal"
              required
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <SectionTitle eyebrow="Anexos" title="Archivos y soportes" />
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border border-dashed p-5 text-center transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/20 bg-slate-950/40'
          }`}
        >
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <p className="text-sm font-semibold text-slate-200">Arrastra PDFs o imagenes aqui</p>
          <p className="mt-1 text-xs text-slate-500">Maximo 10 archivos para esta primera version</p>
        </div>
        {archivos.length > 0 && (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {archivos.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setArchivos((prev) => prev.filter((_, i) => i !== index))} className="text-rose-300 hover:text-rose-200">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
        >
          {guardando ? 'Radicando...' : 'Registrar radicado'}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">{eyebrow}</p>
      <h2 className="text-base font-black text-slate-100">{title}</h2>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
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
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
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
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

