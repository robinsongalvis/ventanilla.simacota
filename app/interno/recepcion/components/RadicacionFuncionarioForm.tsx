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
import {
  MEDIOS_ANEXOS,
  componerDescripcionAnexos,
  toggleMedio,
} from '@/lib/recepcion/medios-anexos';
import type {
  CanalRespuesta,
  MedioRecepcion,
  OrigenIngreso,
  TipoDocumento,
  TipoEntrada,
  TipoPersona,
} from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';

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
  // Sprint Ventanilla Operativa 1 — origen y clasificación operativa
  origenIngreso: OrigenIngreso;
  tipoEntrada: TipoEntrada;
  // Sprint Radicación dirigida — dependencia a la que va dirigido.
  oficinaDestino: TenantId;

  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  // Sprint Ventanilla Operativa 1 — teléfonos separados
  telefonoMovil: string;
  telefonoFijo: string;
  direccion: string;
  // Sprint Ventanilla Operativa 1
  barrio: string;
  pais: string;
  departamento: string;
  municipio: string;
  medioRecepcion: MedioRecepcion;
  // Sprint Ventanilla Operativa 1 — canal por el que responderá la Alcaldía
  canalRespuesta: CanalRespuesta;
  tipoSolicitudId: TipoSolicitudId;
  asunto: string;
  descripcion: string;
  numeroFolios: number;
  // Sprint Ventanilla Operativa 1
  numeroAnexos: number;
  anexosDescripcion: string;
  observacionesAnexos: string;
  // Sprint Ventanilla Operativa 1 — marcas de datos no aportados
  noAportaDocumento: boolean;
  noAportaCorreo: boolean;
  noAportaTelefono: boolean;
  noAportaDireccion: boolean;
}

const ORIGEN_OPCIONES: [OrigenIngreso, string][] = [
  ['PQRSD_WEB_OFICIAL',           'Portal web oficial'],
  ['CORREO_INSTITUCIONAL',        'Correo institucional'],
  ['VENTANILLA_FISICA',           'Ventanilla física'],
  ['ENTREGA_PRESENCIAL',          'Entrega presencial'],
  ['OFICIO_EXTERNO',              'Oficio externo'],
  ['COMUNICACION_INSTITUCIONAL',  'Comunicación institucional'],
  ['OTRO',                        'Otro'],
];

const TIPO_ENTRADA_OPCIONES: [TipoEntrada, string][] = [
  ['PQRSD',                          'PQRSD'],
  ['CORRESPONDENCIA_RECIBIDA',       'Correspondencia recibida'],
  ['OFICIO_INSTITUCIONAL',           'Oficio institucional'],
  ['SOLICITUD_CIUDADANA',            'Solicitud ciudadana'],
  ['COMUNICACION_ENTIDAD_PUBLICA',   'Comunicación entidad pública'],
  ['COMUNICACION_INTERNA',           'Comunicación interna'],
  ['OTRO',                           'Otro'],
];

const TIPO_PERSONA_OPCIONES: [TipoPersona, string][] = [
  ['NATURAL',                    'Natural'],
  ['JURIDICA',                   'Jurídica'],
  ['ENTIDAD_PUBLICA',            'Entidad pública'],
  ['COMUNICACION_INSTITUCIONAL', 'Comunicación institucional'],
  ['NO_IDENTIFICADO',            'No identificado'],
];

interface Props {
  radicadoPreview: string;
  onSubmit?: (payload: FormState & { archivos: File[]; fechaVencimiento: string }) => Promise<void> | void;
  /** Sprint UI Radicación Rápida: id del <form> para disparar submit desde un botón externo (footer modal). */
  formId?: string;
  /** Sprint UI Radicación Rápida: ocultar el botón Submit interno cuando el contenedor pone su propio footer. */
  hideSubmitButton?: boolean;
}

/* Ventanilla Única primero (default de triage); las demás dependencias
   en el orden del directorio institucional. */
const OPCIONES_DEPENDENCIA: [string, string][] = [
  ['VENTANILLA_UNICA', NOMBRES_TENANT.VENTANILLA_UNICA],
  ...(Object.entries(NOMBRES_TENANT) as [TenantId, string][])
    .filter(([id]) => id !== 'VENTANILLA_UNICA'),
];

const INITIAL_FORM: FormState = {
  origenIngreso: 'PQRSD_WEB_OFICIAL',
  tipoEntrada: 'PQRSD',
  oficinaDestino: 'VENTANILLA_UNICA',
  tipoPersona: 'NATURAL',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  nombreCompleto: '',
  email: '',
  telefono: '',
  telefonoMovil: '',
  telefonoFijo: '',
  direccion: '',
  barrio: '',
  pais: 'COLOMBIA',
  departamento: 'SANTANDER',
  municipio: 'Simacota',
  medioRecepcion: 'OFICIO_FISICO',
  canalRespuesta: 'CORREO',
  tipoSolicitudId: 'PETICION_INFORMACION',
  asunto: '',
  descripcion: '',
  numeroFolios: 0,
  numeroAnexos: 0,
  anexosDescripcion: '',
  observacionesAnexos: '',
  noAportaDocumento: false,
  noAportaCorreo: false,
  noAportaTelefono: false,
  noAportaDireccion: false,
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
  // Sprint Recepción fluida — chips de medios físicos entregados (CD, USB…).
  // La selección compone detalle.anexosDescripcion, campo ya existente.
  const [mediosAnexos, setMediosAnexos] = useState<string[]>([]);
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

      {/* ── Origen y tipo de entrada (Sprint Ventanilla Operativa 1) ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle eyebrow="Ingreso" title="Origen y tipo de entrada" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <SelectField
            label="Origen de ingreso"
            value={form.origenIngreso}
            onChange={(v) => update('origenIngreso', v as OrigenIngreso)}
            options={ORIGEN_OPCIONES}
          />
          <SelectField
            label="Tipo de entrada"
            value={form.tipoEntrada}
            onChange={(v) => update('tipoEntrada', v as TipoEntrada)}
            options={TIPO_ENTRADA_OPCIONES}
          />
        </div>
      </section>

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
          {/* Sprint Radicación dirigida — el radicado nace dirigido a una
              dependencia; la trazabilidad empieza aquí, no en el traslado. */}
          <SelectField
            label="Dependencia destino"
            value={form.oficinaDestino}
            onChange={(v) => update('oficinaDestino', v as TenantId)}
            options={OPCIONES_DEPENDENCIA}
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
            options={TIPO_PERSONA_OPCIONES}
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
            /* Fix recepción: si el ciudadano no aporta documento, el campo
               deja de ser obligatorio y se bloquea para que nunca queden
               cédula y marca "no aporta" al mismo tiempo. */
            required={!form.noAportaDocumento}
            disabled={form.noAportaDocumento}
          />
          <TextField
            label="Nombre / razón social"
            value={form.nombreCompleto}
            onChange={(v) => update('nombreCompleto', v)}
            required
            className="md:col-span-2 xl:col-span-2"
          />
          <TextField
            label="Correo electrónico"
            value={form.email}
            onChange={(v) => update('email', v)}
            type="email"
            className="xl:col-span-2"
          />
          <TextField
            label="Teléfono móvil"
            value={form.telefonoMovil}
            onChange={(v) => update('telefonoMovil', v)}
          />
          <TextField
            label="Teléfono fijo"
            value={form.telefonoFijo}
            onChange={(v) => update('telefonoFijo', v)}
          />
          <TextField
            label="Dirección"
            value={form.direccion}
            onChange={(v) => update('direccion', v)}
            className="md:col-span-2 xl:col-span-2"
          />
          <TextField
            label="Barrio"
            value={form.barrio}
            onChange={(v) => update('barrio', v)}
          />
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

      {/* ── Datos no aportados (Sprint Ventanilla Operativa 1) ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle
          eyebrow="Verificación"
          title="Datos no aportados por el solicitante"
        />
        <p className="text-xs mb-3" style={{ color: '#667085' }}>
          Marca solo cuando el documento realmente no aporta el dato.
          Evita registrar información inventada.
        </p>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <CheckboxField
            label="No aporta documento de identidad"
            checked={form.noAportaDocumento}
            onChange={(v) => {
              update('noAportaDocumento', v);
              // Al marcar, se limpia la identificación tecleada para no
              // guardar un número junto a la marca de "no aporta".
              if (v) update('numeroDocumento', '');
            }}
          />
          <CheckboxField
            label="No aporta correo electrónico"
            checked={form.noAportaCorreo}
            onChange={(v) => {
              update('noAportaCorreo', v);
              // Regla UX: si no aporta correo, cambiar canal si estaba en CORREO.
              if (v && form.canalRespuesta === 'CORREO') {
                update('canalRespuesta', 'PRESENCIAL');
              }
            }}
          />
          <CheckboxField
            label="No aporta teléfono"
            checked={form.noAportaTelefono}
            onChange={(v) => update('noAportaTelefono', v)}
          />
          <CheckboxField
            label="No aporta dirección"
            checked={form.noAportaDireccion}
            onChange={(v) => update('noAportaDireccion', v)}
          />
        </div>
      </section>

      {/* ── Medio de respuesta (Sprint Ventanilla Operativa 1) ── */}
      <section className={sectionCls} style={sectionStyle}>
        <SectionTitle
          eyebrow="Respuesta"
          title="Medio por el que se responderá al ciudadano"
        />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <SelectField
            label="Medio de respuesta"
            value={form.canalRespuesta}
            onChange={(v) => update('canalRespuesta', v as CanalRespuesta)}
            options={[
              ['CORREO',           form.noAportaCorreo ? 'Correo electrónico (no disponible — no aporta correo)' : 'Correo electrónico'],
              ['DIRECCION_FISICA', 'Dirección física'],
              ['PRESENCIAL',       'Presencial'],
              ['TELEFONO',         'Teléfono'],
            ]}
          />
          {form.noAportaCorreo && form.canalRespuesta === 'CORREO' && (
            <div
              className="rounded-md border px-3 py-2 text-xs"
              style={{ borderColor: '#EF4444', background: '#FEE2E2', color: '#991B1B' }}
              role="alert"
            >
              Si el solicitante no aporta correo electrónico, el medio de
              respuesta no puede ser correo.
            </div>
          )}
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
          <TextField
            label="Número de anexos"
            value={String(form.numeroAnexos)}
            onChange={(v) => update('numeroAnexos', Number(v.replace(/\D/g, '') || 0))}
          />
          <div className="md:col-span-2 xl:col-span-4">
            <span className={labelCls} style={labelStyle}>Medios entregados (si aplica)</span>
            <div className="flex flex-wrap gap-2">
              {MEDIOS_ANEXOS.map((medio) => {
                const activo = mediosAnexos.includes(medio);
                return (
                  <button
                    key={medio}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      const siguiente = toggleMedio(mediosAnexos, medio);
                      setMediosAnexos(siguiente);
                      update('anexosDescripcion', componerDescripcionAnexos(siguiente));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={activo
                      ? { background: '#EEF4EE', border: '1px solid #14532D', color: '#14532D' }
                      : { background: '#FFFFFF', border: '1px solid #D9E2D9', color: '#667085' }}
                  >
                    {medio}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label>
              <span className={labelCls} style={labelStyle}>Observaciones de anexos</span>
              <textarea
                value={form.observacionesAnexos}
                onChange={(e) => update('observacionesAnexos', e.target.value)}
                rows={2}
                className="input-internal"
                placeholder="Ej: CD viene con etiqueta manuscrita, fotos en sobre sellado…"
              />
            </label>
          </div>
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
  label, value, onChange, type = 'text', required, disabled, className = '',
}: {
  label: string; value: string; onChange: (value: string) => void;
  type?: string; required?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelCls} style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="input-internal disabled:opacity-50 disabled:cursor-not-allowed"
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

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors"
      style={{ border: '1px solid #D9E2D9', background: checked ? '#FEF3C7' : '#FFFFFF' }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4"
      />
      <span style={{ color: '#1F2933' }}>{label}</span>
    </label>
  );
}
