'use client';

/**
 * VistaAdministracion — Módulo de gestión de usuarios internos.
 * Visible únicamente para ADMIN.
 *
 * Fase A: Crear + listar usuarios.
 * Fase B (futuro): Editar, desactivar, reset password, dependencias.
 */

import { useCallback, useEffect, useState }  from 'react';
import { DIRECTORIO_TENANTS, NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { TenantId }                      from '@/src/types/radicado';
import type { RolInterno }                    from '@/lib/hooks/useAuth';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

interface UsuarioInterno {
  uid:                string;
  nombre:             string;
  email:              string;
  cargo:              string;
  rol:                RolInterno;
  tenantId:           TenantId;
  activo:             boolean;
  archivado:          boolean;
  tipoUsuario:        TipoUsuario;
  esPrueba:           boolean;
  ultimoAcceso:       string | null;
  fechaCreacion:      string | null;
  fechaActualizacion: string | null;
}

type TipoUsuario = 'INSTITUCIONAL' | 'UAT' | 'PRUEBA';
type FiltroTipo = 'TODOS' | TipoUsuario;
type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS' | 'ARCHIVADOS';

/* ══════════════════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════════════════ */

const ROLES: { value: RolInterno; label: string }[] = [
  { value: 'ADMIN',             label: 'Administrador' },
  { value: 'RECEPCIONISTA',     label: 'Recepcionista' },
  { value: 'FUNCIONARIO',       label: 'Funcionario' },
  { value: 'JEFE_DEPENDENCIA',  label: 'Jefe de Dependencia' },
  { value: 'CONTROL_INTERNO',   label: 'Control Interno' },
];

const TENANTS = (Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => ({
  value: id,
  label: NOMBRES_TENANT[id],
}));

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: 'INSTITUCIONAL', label: 'Institucional' },
  { value: 'UAT',           label: 'UAT' },
  { value: 'PRUEBA',        label: 'Prueba' },
];

const DOMINIOS_INSTITUCIONALES = ['@simacota-santander.gov.co', '@simacota.gov.co'];

const BADGE_ROL: Record<RolInterno, string> = {
  ADMIN:            'bg-purple-50  text-purple-800 border-purple-200',
  RECEPCIONISTA:    'bg-green-50   text-green-800  border-green-200',
  FUNCIONARIO:      'bg-sky-50     text-sky-800    border-sky-200',
  JEFE_DEPENDENCIA: 'bg-amber-50   text-amber-800  border-amber-200',
  CONTROL_INTERNO:  'bg-rose-50    text-rose-800   border-rose-200',
};

const LABEL_ROL: Record<RolInterno, string> = {
  ADMIN:            'Admin',
  RECEPCIONISTA:    'Recepcionista',
  FUNCIONARIO:      'Funcionario',
  JEFE_DEPENDENCIA: 'Jefe Dep.',
  CONTROL_INTERNO:  'Control Int.',
};

const BADGE_TIPO: Record<TipoUsuario, string> = {
  INSTITUCIONAL: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  UAT:           'bg-indigo-50  text-indigo-800  border-indigo-200',
  PRUEBA:        'bg-slate-100  text-slate-700   border-slate-200',
};

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

export function VistaAdministracion() {
  const [usuarios,    setUsuarios]    = useState<UsuarioInterno[]>([]);
  const [cargando,    setCargando]    = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [editando,    setEditando]    = useState<UsuarioInterno | null>(null);
  const [busqueda,    setBusqueda]    = useState('');
  const [filtroTipo,  setFiltroTipo]  = useState<FiltroTipo>('TODOS');
  const [filtroEstado,setFiltroEstado]= useState<FiltroEstado>('TODOS');
  const [filtroRol,   setFiltroRol]   = useState<'TODOS' | RolInterno>('TODOS');
  const [filtroTenant,setFiltroTenant]= useState<'TODOS' | TenantId>('TODOS');
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [msgGlobal,   setMsgGlobal]   = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  /* ── Cargar usuarios ────────────────────────────────────── */
  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/usuarios?incluirArchivados=1');
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { usuarios: UsuarioInterno[] };
      setUsuarios(data.usuarios);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  /* ── Acciones rápidas (toggle activo, reset password) ──── */
  async function patchUsuario(uid: string, body: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/admin/usuarios/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; mensaje?: string };
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  async function toggleActivo(u: UsuarioInterno) {
    setMsgGlobal(null);
    try {
      await patchUsuario(u.uid, { activo: !u.activo, ...(u.archivado && !u.activo ? { archivado: false } : {}) });
      setMsgGlobal({ tipo: 'ok', texto: u.activo ? `${u.nombre} desactivado.` : `${u.nombre} activado.` });
      cargarUsuarios();
    } catch (err) {
      setMsgGlobal({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error' });
    }
  }

  async function cambiarTipo(u: UsuarioInterno, tipoUsuario: TipoUsuario) {
    setMsgGlobal(null);
    try {
      await patchUsuario(u.uid, { tipoUsuario });
      setMsgGlobal({ tipo: 'ok', texto: `${u.nombre} marcado como ${tipoUsuario.toLowerCase()}.` });
      cargarUsuarios();
    } catch (err) {
      setMsgGlobal({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error' });
    }
  }

  async function archivarUsuario(u: UsuarioInterno) {
    const motivo = window.prompt(`Motivo para archivar a ${u.nombre}:`, 'Usuario de prueba/UAT archivado');
    if (motivo === null) return;
    setMsgGlobal(null);
    try {
      await patchUsuario(u.uid, { archivado: true, motivo });
      setMsgGlobal({ tipo: 'ok', texto: `${u.nombre} archivado correctamente.` });
      cargarUsuarios();
    } catch (err) {
      setMsgGlobal({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error' });
    }
  }

  async function aplicarMasivo(accion: 'MARCAR_PRUEBA' | 'ARCHIVAR' | 'DESACTIVAR') {
    if (seleccionados.length === 0) return;
    const ok = window.confirm(`Esta acción afectará ${seleccionados.length} usuario(s). ¿Desea continuar?`);
    if (!ok) return;
    setMsgGlobal(null);
    try {
      for (const uid of seleccionados) {
        if (accion === 'MARCAR_PRUEBA') await patchUsuario(uid, { tipoUsuario: 'PRUEBA' });
        if (accion === 'ARCHIVAR') await patchUsuario(uid, { archivado: true, motivo: 'Acción masiva desde Administración' });
        if (accion === 'DESACTIVAR') await patchUsuario(uid, { activo: false });
      }
      setSeleccionados([]);
      setMsgGlobal({ tipo: 'ok', texto: 'Acción masiva aplicada correctamente.' });
      cargarUsuarios();
    } catch (err) {
      setMsgGlobal({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error en acción masiva.' });
    }
  }

  async function resetPassword(u: UsuarioInterno) {
    setMsgGlobal(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${u.uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'reset-password' }),
      });
      const data = await res.json() as { ok?: boolean; mensaje?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMsgGlobal({ tipo: 'ok', texto: data.mensaje ?? `Se envió enlace de restablecimiento a ${u.email}.` });
    } catch (err) {
      setMsgGlobal({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error' });
    }
  }

  /* ── Filtrado local ─────────────────────────────────────── */
  const filtrados = usuarios
    .filter((u) => {
      if (filtroTipo !== 'TODOS' && u.tipoUsuario !== filtroTipo) return false;
      if (filtroEstado === 'ACTIVOS' && (!u.activo || u.archivado)) return false;
      if (filtroEstado === 'INACTIVOS' && (u.activo || u.archivado)) return false;
      if (filtroEstado === 'ARCHIVADOS' && !u.archivado) return false;
      if (filtroEstado === 'TODOS' && u.archivado) return false;
      if (filtroRol !== 'TODOS' && u.rol !== filtroRol) return false;
      if (filtroTenant !== 'TODOS' && u.tenantId !== filtroTenant) return false;
      return true;
    })
    .filter((u) => {
      if (!busqueda.trim()) return true;
        const q = busqueda.toLowerCase();
        return u.nombre.toLowerCase().includes(q)
          || u.email.toLowerCase().includes(q)
          || u.cargo.toLowerCase().includes(q)
          || NOMBRES_TENANT[u.tenantId]?.toLowerCase().includes(q);
    });

  /* ── Estadísticas rápidas ──────────────────────────────── */
  const totalActivos   = usuarios.filter((u) => u.activo && !u.archivado).length;
  const totalInactivos = usuarios.filter((u) => !u.activo && !u.archivado).length;
  const totalArchivados = usuarios.filter((u) => u.archivado).length;
  const totalInstitucionales = usuarios.filter((u) => u.tipoUsuario === 'INSTITUCIONAL' && !u.archivado).length;
  const totalPruebas = usuarios.filter((u) => u.tipoUsuario !== 'INSTITUCIONAL' && !u.archivado).length;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAF7' }}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-6 bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#14532D' }}>
              Administración
            </p>
            <h1 className="text-xl font-black" style={{ fontFamily: 'var(--font-manrope)', color: '#1F2933' }}>
              Usuarios Internos
            </h1>
            <p className="text-xs font-semibold mt-1" style={{ color: '#14532D' }}>
              Matriz UAT por Roles
            </p>
            <p className="text-xs mt-1" style={{ color: '#667085' }}>
              {totalActivos} activo{totalActivos !== 1 ? 's' : ''}
              {totalInactivos > 0 && <> · {totalInactivos} inactivo{totalInactivos !== 1 ? 's' : ''}</>}
              {totalArchivados > 0 && <> · {totalArchivados} archivado{totalArchivados !== 1 ? 's' : ''}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.97]"
            style={{ background: '#14532D' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Crear usuario
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
          {[
            ['Activos', totalActivos, '#DCFCE7', '#166534'],
            ['Institucionales', totalInstitucionales, '#ECFDF5', '#047857'],
            ['Prueba/UAT', totalPruebas, '#EEF2FF', '#4338CA'],
            ['Inactivos', totalInactivos, '#F1F5F9', '#475569'],
            ['Archivados', totalArchivados, '#FEF3C7', '#92400E'],
          ].map(([label, valor, bg, color]) => (
            <div key={String(label)} className="rounded-xl px-3 py-2" style={{ background: String(bg), border: '1px solid rgba(15,23,42,0.08)' }}>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: String(color) }}>{label}</p>
              <p className="text-lg font-black" style={{ color: String(color) }}>{valor}</p>
            </div>
          ))}
        </div>

        {/* Buscador + filtros */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email, cargo o dependencia..."
            className="w-full md:col-span-2 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={{ background: '#F8FAF7', border: '1px solid #D9E2D9', color: '#1F2933' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#14532D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,83,45,0.15)'; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = '#D9E2D9'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)} className="select-internal rounded-xl px-3 py-2.5">
            <option value="TODOS">Tipo: todos</option>
            {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)} className="select-internal rounded-xl px-3 py-2.5">
            <option value="TODOS">Estado: normal</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
            <option value="ARCHIVADOS">Archivados</option>
          </select>
          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as 'TODOS' | RolInterno)} className="select-internal rounded-xl px-3 py-2.5">
            <option value="TODOS">Rol: todos</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={filtroTenant} onChange={(e) => setFiltroTenant(e.target.value as 'TODOS' | TenantId)} className="select-internal rounded-xl px-3 py-2.5 md:col-span-2">
            <option value="TODOS">Dependencia: todas</option>
            {TENANTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <button type="button" disabled={seleccionados.length === 0} onClick={() => aplicarMasivo('MARCAR_PRUEBA')}
              className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40" style={{ background: '#EEF2FF', color: '#4338CA' }}>
              Marcar prueba ({seleccionados.length})
            </button>
            <button type="button" disabled={seleccionados.length === 0} onClick={() => aplicarMasivo('DESACTIVAR')}
              className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40" style={{ background: '#F1F5F9', color: '#475569' }}>
              Desactivar
            </button>
            <button type="button" disabled={seleccionados.length === 0} onClick={() => aplicarMasivo('ARCHIVAR')}
              className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40" style={{ background: '#FEF3C7', color: '#92400E' }}>
              Archivar
            </button>
          </div>
        </div>
      </div>

      {/* Mensajes globales */}
      {error && (
        <div className="mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          {error}
        </div>
      )}
      {msgGlobal && (
        <div className="mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between"
             style={msgGlobal.tipo === 'ok'
               ? { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }
               : { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <span>{msgGlobal.texto}</span>
          <button onClick={() => setMsgGlobal(null)} className="ml-3 shrink-0" style={{ color: '#94A3B8' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="px-4 sm:px-6 py-4">
        {cargando ? (
          <div className="flex items-center justify-center gap-3 py-16" style={{ color: '#667085' }}>
            <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
            <span className="text-sm">Cargando usuarios...</span>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">👤</p>
            <p className="font-bold" style={{ color: '#667085' }}>
              {busqueda ? 'Sin resultados' : 'No hay usuarios registrados'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              {busqueda
                ? 'Intenta con otro término de búsqueda.'
                : 'Crea el primer usuario con el botón "Crear usuario".'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
                  {['', 'Nombre', 'Email', 'Cargo', 'Rol', 'Dependencia', 'Tipo', 'Último acceso', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.uid} className="transition-colors"
                      style={{ borderBottom: '1px solid #EEF4EE' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(u.uid)}
                        onChange={(e) => {
                          setSeleccionados((prev) => e.target.checked
                            ? [...prev, u.uid]
                            : prev.filter((id) => id !== u.uid));
                        }}
                        aria-label={`Seleccionar ${u.nombre}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#1F2933' }}>{u.nombre}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono" style={{ color: '#667085' }}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs" style={{ color: '#667085' }}>{u.cargo || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${BADGE_ROL[u.rol] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {LABEL_ROL[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs" style={{ color: '#667085' }}>{NOMBRES_TENANT[u.tenantId] ?? u.tenantId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${BADGE_TIPO[u.tipoUsuario] ?? BADGE_TIPO.INSTITUCIONAL}`}>
                        {u.tipoUsuario}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs" style={{ color: '#667085' }}>
                        {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleDateString('es-CO') : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.activo && !u.archivado ? 'text-green-700' : ''}`}
                            style={u.archivado ? { color: '#92400E' } : !u.activo ? { color: '#94A3B8' } : {}}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.archivado ? 'bg-amber-500' : u.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {u.archivado ? 'Archivado' : u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditando(u)}
                          title="Editar usuario"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: '#94A3B8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#14532D'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          title={u.activo && !u.archivado ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: '#94A3B8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = u.activo && !u.archivado ? '#DC2626' : '#16A34A'; (e.currentTarget as HTMLElement).style.background = u.activo && !u.archivado ? '#FEF2F2' : '#F0FDF4'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          {u.activo && !u.archivado ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => resetPassword(u)}
                          title="Restablecer contraseña"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: '#94A3B8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#D97706'; (e.currentTarget as HTMLElement).style.background = '#FFFBEB'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => cambiarTipo(u, u.tipoUsuario === 'INSTITUCIONAL' ? 'PRUEBA' : 'INSTITUCIONAL')}
                          title={u.tipoUsuario === 'INSTITUCIONAL' ? 'Marcar como prueba' : 'Marcar como institucional'}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: '#94A3B8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#4338CA'; (e.currentTarget as HTMLElement).style.background = '#EEF2FF'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182L11.16 3.66A2.25 2.25 0 009.568 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => archivarUsuario(u)}
                          title="Archivar usuario"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: '#94A3B8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#92400E'; (e.currentTarget as HTMLElement).style.background = '#FEF3C7'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632A2.25 2.25 0 0117.379 20.25H6.621a2.25 2.25 0 01-2.246-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear Usuario */}
      {showModal && (
        <ModalCrearUsuario
          onClose={() => setShowModal(false)}
          onCreado={() => {
            setShowModal(false);
            cargarUsuarios();
          }}
        />
      )}

      {/* Modal Editar Usuario (Fase B) */}
      {editando && (
        <ModalEditarUsuario
          usuario={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            setMsgGlobal({ tipo: 'ok', texto: `${editando.nombre} actualizado.` });
            cargarUsuarios();
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL: Crear Usuario
══════════════════════════════════════════════════════════════ */

function ModalCrearUsuario({
  onClose,
  onCreado,
}: {
  onClose:  () => void;
  onCreado: () => void;
}) {
  const [nombre,   setNombre]   = useState('');
  const [email,    setEmail]    = useState('');
  const [cargo,    setCargo]    = useState('');
  const [rol,      setRol]      = useState<RolInterno>('FUNCIONARIO');
  const [tenantId, setTenantId] = useState<TenantId>('VENTANILLA_UNICA');
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>('INSTITUCIONAL');
  const [activo, setActivo] = useState(true);
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [exito,    setExito]    = useState<string | null>(null);
  const emailInstitucional = DOMINIOS_INSTITUCIONALES.some((dominio) => email.trim().toLowerCase().endsWith(dominio));

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setGuardando(true);

    try {
      const res = await fetch('/api/admin/usuarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre: nombre.trim(),
          email:  email.trim().toLowerCase(),
          cargo:  cargo.trim(),
          rol,
          tenantId,
          tipoUsuario,
          activo,
          password,
        }),
      });

      const data = await res.json() as { ok?: boolean; mensaje?: string; error?: string; advertencia?: string | null };

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setExito(`${data.mensaje ?? 'Usuario creado exitosamente.'}${data.advertencia ? ` ${data.advertencia}` : ''}`);

      // Limpiar formulario después de 1.5s y cerrar
      setTimeout(() => {
        onCreado();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto bg-white"
           style={{ border: '1px solid #D9E2D9' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#14532D' }}>
              Administración
            </p>
            <h2 className="text-lg font-black" style={{ color: '#1F2933' }}>Crear usuario interno</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all" style={{ color: '#94A3B8' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1F2933'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCrear} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
              Nombre completo *
            </label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required
              placeholder="Juan Pérez García" className="input-obsidian" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
              Correo institucional *
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="jperez@simacota-santander.gov.co" className="input-obsidian" />
            {email.trim() && !emailInstitucional && (
              <p className="text-[11px] mt-1" style={{ color: '#B45309' }}>
                Este correo no parece institucional. Confirme si desea continuar.
              </p>
            )}
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
              Cargo
            </label>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)}
              placeholder="Secretario General, Abogado Contratista..." className="input-obsidian" />
          </div>

          {/* Rol + Dependencia en grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
                Rol *
              </label>
              <select value={rol} onChange={(e) => setRol(e.target.value as RolInterno)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
                Dependencia *
              </label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value as TenantId)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {TENANTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
              Tipo de usuario *
            </label>
            <select value={tipoUsuario} onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)} className="select-internal w-full rounded-xl px-3 py-2.5">
              {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#1F2933' }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Crear usuario activo
          </label>

          {/* Contraseña temporal */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
              Contraseña temporal *{' '}
              <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(min. 8 caracteres)</span>
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} placeholder="••••••••" className="input-obsidian" />
          </div>

          {/* Error / Éxito */}
          {error && (
            <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {error}
            </div>
          )}
          {exito && (
            <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
              {exito}
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={guardando}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ color: '#667085' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; (e.currentTarget as HTMLElement).style.color = '#1F2933'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#667085'; }}
            >
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.97]"
              style={{ background: '#14532D', color: '#ffffff' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}>
              {guardando && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
              {guardando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL: Editar Usuario (Fase B)
══════════════════════════════════════════════════════════════ */

function ModalEditarUsuario({
  usuario,
  onClose,
  onGuardado,
}: {
  usuario:    UsuarioInterno;
  onClose:    () => void;
  onGuardado: () => void;
}) {
  const [nombre,    setNombre]    = useState(usuario.nombre);
  const [cargo,     setCargo]     = useState(usuario.cargo);
  const [rol,       setRol]       = useState<RolInterno>(usuario.rol);
  const [tenantId,  setTenantId]  = useState<TenantId>(usuario.tenantId);
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>(usuario.tipoUsuario);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [exito,     setExito]     = useState<string | null>(null);

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setGuardando(true);

    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.uid}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre: nombre.trim(),
          cargo:  cargo.trim(),
          rol,
          tenantId,
          tipoUsuario,
        }),
      });

      const data = await res.json() as { ok?: boolean; mensaje?: string; error?: string; cambios?: string[] };

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const cambiosTexto = data.cambios?.length
        ? ` (${data.cambios.join(', ')})`
        : '';
      setExito(`${data.mensaje ?? 'Actualizado.'}${cambiosTexto}`);

      setTimeout(() => onGuardado(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto bg-white"
           style={{ border: '1px solid #D9E2D9' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#D4A017' }}>
              Editar usuario
            </p>
            <h2 className="text-lg font-black" style={{ color: '#1F2933' }}>{usuario.nombre}</h2>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#94A3B8' }}>{usuario.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all" style={{ color: '#94A3B8' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1F2933'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Nombre completo</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="input-obsidian" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Cargo</label>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} className="input-obsidian" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Rol</label>
              <select value={rol} onChange={(e) => setRol(e.target.value as RolInterno)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Dependencia</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value as TenantId)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {TENANTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Tipo de usuario</label>
            <select value={tipoUsuario} onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)} className="select-internal w-full rounded-xl px-3 py-2.5">
              {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {error && <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>{error}</div>}
          {exito && <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>{exito}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={guardando}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ color: '#667085' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.97]"
              style={{ background: '#D4A017', color: '#14532D' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#B8860B'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#D4A017'; }}>
              {guardando && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(20,83,45,0.3)', borderTopColor: '#14532D' }} />}
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
