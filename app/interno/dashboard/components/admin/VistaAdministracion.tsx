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
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { BarraTrabajo } from '@/app/components/design-system/BarraTrabajo';
import type { IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';
import { Archive, Building2, FlaskConical, Plus, UserCheck, UserX } from 'lucide-react';

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

const LABEL_ROL: Record<RolInterno, string> = {
  ADMIN:            'Admin',
  RECEPCIONISTA:    'Recepcionista',
  FUNCIONARIO:      'Funcionario',
  JEFE_DEPENDENCIA: 'Jefe Dep.',
  CONTROL_INTERNO:  'Control Int.',
};

/** Mapeo de rol a tono de StatusBadge. */
const rolTono: Record<RolInterno, 'danger' | 'info' | 'success' | 'accent' | 'warning'> = {
  ADMIN:            'danger',
  RECEPCIONISTA:    'info',
  FUNCIONARIO:      'success',
  JEFE_DEPENDENCIA: 'accent',
  CONTROL_INTERNO:  'warning',
};

/** Mapeo de tipo de usuario a tono de StatusBadge. */
const tipoTono: Record<TipoUsuario, 'success' | 'info' | 'neutral'> = {
  INSTITUCIONAL: 'success',
  UAT:           'info',
  PRUEBA:        'neutral',
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
      const res = await fetch('/api/admin/usuarios?incluirArchivados=1', {
        credentials: 'include',
      });
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
      credentials: 'include',
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
        credentials: 'include',
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
  /* Ola 3 (ADR-0046): mismos cinco conteos con el Indicador del Tablero. */
  const resumen: IndicadorEstaticoProps[] = [
    { etiqueta: 'Activos',         valor: totalActivos,         tono: 'verde', Icono: UserCheck },
    { etiqueta: 'Institucionales', valor: totalInstitucionales, tono: 'verde', Icono: Building2 },
    { etiqueta: 'Prueba/UAT',      valor: totalPruebas,         tono: 'azul',  Icono: FlaskConical },
    { etiqueta: 'Inactivos',       valor: totalInactivos,       tono: 'gris',  Icono: UserX },
    { etiqueta: 'Archivados',      valor: totalArchivados,      tono: 'ambar', Icono: Archive },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* Header */}
      <SectionHeader
        titulo="Usuarios Internos"
        subtitulo={`${totalActivos} activo${totalActivos !== 1 ? 's' : ''}${totalInactivos > 0 ? ` · ${totalInactivos} inactivo${totalInactivos !== 1 ? 's' : ''}` : ''}${totalArchivados > 0 ? ` · ${totalArchivados} archivado${totalArchivados !== 1 ? 's' : ''}` : ''}`}
        indicador={<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Administración</span>}
        acciones={
          <BotonAccion variante="primaria" Icono={Plus} onClick={() => setShowModal(true)}>Crear usuario</BotonAccion>
        }
      />

      {/* Indicadores, barra de trabajo y acciones masivas (lenguaje del Tablero) */}
      <div className="shrink-0">
        <FilaTarjetas etiqueta="Resumen de usuarios" className="px-3 sm:px-4 lg:px-6">
          {resumen.map((i) => <TarjetaIndicador key={i.etiqueta} {...i} />)}
        </FilaTarjetas>

        <BarraTrabajo
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholder="Buscar por nombre, email, cargo o dependencia..."
          ariaLabel="Buscar usuarios internos"
          contador={`${filtrados.length} usuario${filtrados.length !== 1 ? 's' : ''}`}
          limpiable
        >
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)} aria-label="Filtrar por tipo de usuario" className="select-internal text-xs">
            <option value="TODOS">Tipo: todos</option>
            {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)} aria-label="Filtrar por estado" className="select-internal text-xs">
            <option value="TODOS">Estado: normal</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
            <option value="ARCHIVADOS">Archivados</option>
          </select>
          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as 'TODOS' | RolInterno)} aria-label="Filtrar por rol" className="select-internal text-xs">
            <option value="TODOS">Rol: todos</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={filtroTenant} onChange={(e) => setFiltroTenant(e.target.value as 'TODOS' | TenantId)} aria-label="Filtrar por dependencia" className="select-internal text-xs">
            <option value="TODOS">Dependencia: todas</option>
            {TENANTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </BarraTrabajo>

        <div className="flex flex-wrap gap-2 px-3 pt-2 sm:px-4 lg:px-6" role="group" aria-label="Acciones sobre los usuarios seleccionados">
          <button type="button" disabled={seleccionados.length === 0} onClick={() => aplicarMasivo('MARCAR_PRUEBA')}
            className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: 'var(--tema-fondo-eef2ff)', color: 'var(--tema-texto-4338ca)' }}>
            Marcar prueba ({seleccionados.length})
          </button>
          <button type="button" disabled={seleccionados.length === 0} onClick={() => aplicarMasivo('DESACTIVAR')}
            className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: 'var(--tema-fondo-f1f5f9)', color: 'var(--tema-texto-475569)' }}>
            Desactivar
          </button>
          <button type="button" disabled={seleccionados.length === 0} onClick={() => aplicarMasivo('ARCHIVAR')}
            className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: 'var(--tema-fondo-fef3c7)', color: 'var(--tema-texto-92400e)' }}>
            Archivar
          </button>
        </div>
      </div>

      {/* Mensajes globales */}
      {error && (
        <div role="alert" className="mx-3 mt-2 shrink-0 px-4 py-3 rounded-lg text-sm sm:mx-4 lg:mx-6" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}>
          {error}
        </div>
      )}
      {msgGlobal && (
        <div role={msgGlobal.tipo === 'ok' ? 'status' : 'alert'} className="mx-3 mt-2 shrink-0 px-4 py-3 rounded-lg text-sm flex items-center justify-between sm:mx-4 lg:mx-6"
             style={msgGlobal.tipo === 'ok'
               ? { background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }
               : { background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
          <span>{msgGlobal.texto}</span>
          <button type="button" onClick={() => setMsgGlobal(null)} aria-label="Cerrar mensaje" className="ml-3 shrink-0" style={{ color: 'var(--tema-texto-64748b)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 lg:px-6">
        {cargando ? (
          <div role="status" className="flex items-center justify-center gap-3 py-16" style={{ color: 'var(--tema-texto-64748b)' }}>
            <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
            <span className="text-sm">Cargando usuarios...</span>
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            titulo={busqueda ? 'Sin resultados' : 'No hay usuarios registrados'}
            descripcion={busqueda
              ? 'Intenta con otro término de búsqueda.'
              : 'Crea el primer usuario con el botón "Crear usuario".'}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-[var(--tema-fondo-ffffff)]">
            <table className="w-full text-left">
              <CabeceraTablaSticky
                control={<span className="sr-only">Selección</span>}
                columnas={['Nombre', 'Email', 'Cargo', 'Rol', 'Dependencia', 'Tipo', 'Último acceso', 'Estado', 'Acciones']}
              />
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.uid} className="micro-row"
                      style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                    <td className="px-2 py-2">
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
                    <td className="px-2 py-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--tema-texto-172033)' }}>{u.nombre}</p>
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-xs font-mono" style={{ color: 'var(--tema-texto-64748b)' }}>{u.email}</p>
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>{u.cargo || '—'}</p>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge tono={rolTono[u.rol] ?? 'neutral'} tamano="sm">
                        {LABEL_ROL[u.rol] ?? u.rol}
                      </StatusBadge>
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>{NOMBRES_TENANT[u.tenantId] ?? u.tenantId}</p>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge tono={tipoTono[u.tipoUsuario] ?? 'neutral'} tamano="sm">
                        {u.tipoUsuario}
                      </StatusBadge>
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>
                        {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleDateString('es-CO') : '—'}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge
                        tono={u.archivado ? 'warning' : u.activo ? 'success' : 'neutral'}
                        conPunto
                        tamano="sm"
                      >
                        {u.archivado ? 'Archivado' : u.activo ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </td>
                    {/* Acciones */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditando(u)}
                          type="button"
                          title="Editar usuario"
                          aria-label="Editar usuario"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--tema-texto-64748b)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-007049)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          type="button"
                          title={u.activo && !u.archivado ? 'Desactivar' : 'Activar'}
                          aria-label={u.activo && !u.archivado ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--tema-texto-64748b)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = u.activo && !u.archivado ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-008f5a)'; (e.currentTarget as HTMLElement).style.background = u.activo && !u.archivado ? 'var(--tema-fondo-fef2f2)' : 'var(--tema-fondo-f0fdf4)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}
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
                          type="button"
                          title="Restablecer contraseña"
                          aria-label="Restablecer contraseña"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--tema-texto-64748b)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-d97706)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-fffbeb)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => cambiarTipo(u, u.tipoUsuario === 'INSTITUCIONAL' ? 'PRUEBA' : 'INSTITUCIONAL')}
                          type="button"
                          title={u.tipoUsuario === 'INSTITUCIONAL' ? 'Marcar como prueba' : 'Marcar como institucional'}
                          aria-label={u.tipoUsuario === 'INSTITUCIONAL' ? 'Marcar como prueba' : 'Marcar como institucional'}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--tema-texto-64748b)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-4338ca)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-eef2ff)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182L11.16 3.66A2.25 2.25 0 009.568 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => archivarUsuario(u)}
                          type="button"
                          title="Archivar usuario"
                          aria-label="Archivar usuario"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--tema-texto-64748b)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-92400e)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-fef3c7)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}
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
          onCreado={async (mensaje) => {
            setShowModal(false);
            setMsgGlobal({ tipo: 'ok', texto: mensaje });
            await cargarUsuarios();
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
  onCreado: (mensaje: string) => void | Promise<void>;
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
        credentials: 'include',
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

      const mensaje = `${data.mensaje ?? 'Usuario creado exitosamente.'}${data.advertencia ? ` ${data.advertencia}` : ''}`;
      setExito(mensaje);

      setPassword('');
      await onCreado(mensaje);

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
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto bg-[var(--tema-fondo-ffffff)]"
           style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--tema-texto-007049)' }}>
              Administración
            </p>
            <h2 className="text-lg font-black" style={{ color: 'var(--tema-texto-172033)' }}>Crear usuario interno</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--tema-texto-94a3b8)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-172033)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCrear} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Nombre completo *
            </label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required
              placeholder="Juan Pérez García" className="input-obsidian" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Correo institucional *
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="jperez@simacota-santander.gov.co" className="input-obsidian" />
            {email.trim() && !emailInstitucional && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--tema-texto-b45309)' }}>
                Este correo no parece institucional. Confirme si desea continuar.
              </p>
            )}
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Cargo
            </label>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)}
              placeholder="Secretario General, Abogado Contratista..." className="input-obsidian" />
          </div>

          {/* Rol + Dependencia en grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
                Rol *
              </label>
              <select value={rol} onChange={(e) => setRol(e.target.value as RolInterno)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
                Dependencia *
              </label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value as TenantId)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {TENANTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Tipo de usuario *
            </label>
            <select value={tipoUsuario} onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)} className="select-internal w-full rounded-xl px-3 py-2.5">
              {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--tema-texto-172033)' }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Crear usuario activo
          </label>

          {/* Contraseña temporal */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Contraseña temporal *{' '}
              <span className="normal-case font-normal" style={{ color: 'var(--tema-texto-94a3b8)' }}>(min. 8 caracteres)</span>
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} placeholder="••••••••" className="input-obsidian" />
          </div>

          {/* Error / Éxito */}
          {error && (
            <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
              {error}
            </div>
          )}
          {exito && (
            <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }}>
              {exito}
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={guardando}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ color: 'var(--tema-texto-64748b)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-172033)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; }}
            >
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.97]"
              style={{ background: 'var(--tema-fondo-007049)', color: '#ffffff' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#006B45'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-007049)'; }}>
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
        credentials: 'include',
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
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto bg-[var(--tema-fondo-ffffff)]"
           style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--tema-texto-e5a31a)' }}>
              Editar usuario
            </p>
            <h2 className="text-lg font-black" style={{ color: 'var(--tema-texto-172033)' }}>{usuario.nombre}</h2>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--tema-texto-94a3b8)' }}>{usuario.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--tema-texto-94a3b8)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-172033)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-64748b)'; (e.currentTarget as HTMLElement).style.background = ''; }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>Nombre completo</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="input-obsidian" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>Cargo</label>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} className="input-obsidian" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>Rol</label>
              <select value={rol} onChange={(e) => setRol(e.target.value as RolInterno)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>Dependencia</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value as TenantId)} className="select-internal w-full rounded-xl px-3 py-2.5">
                {TENANTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tema-texto-64748b)' }}>Tipo de usuario</label>
            <select value={tipoUsuario} onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)} className="select-internal w-full rounded-xl px-3 py-2.5">
              {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {error && <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>{error}</div>}
          {exito && <div className="px-4 py-2.5 rounded-lg text-xs" style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }}>{exito}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={guardando}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ color: 'var(--tema-texto-64748b)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.97]"
              style={{ background: '#E5A31A', color: '#03402A' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#C98A0F'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#E5A31A'; }}>
              {guardando && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0, 112, 73,0.3)', borderTopColor: 'var(--tema-borde-007049)' }} />}
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
