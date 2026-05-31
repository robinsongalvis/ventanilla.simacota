'use client';

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

export type FiltroMIPG =
  | 'TODOS'
  | 'RADICADAS'
  | 'PRIORIDAD_MIPG'
  | 'ASIGNADAS'
  | 'EN_TERMINO'
  | 'POR_VENCER'
  | 'VENCIDAS'
  | 'DEVUELTAS_PRORROGA'
  | 'RESUELTOS_FUERA_TERMINO';

export type VistaActual =
  | 'TABLERO'
  | 'RADICACION'
  | 'VENTANILLA'
  | 'BANDEJA'
  | 'DEPENDENCIAS'
  | 'REPORTES'
  | 'ANALYTICS'    // Centro de Inteligencia Operativa — Fase 2
  | 'ALERTAS'      // Panel de Alertas Predictivas — Fase 2
  | 'SUPERVISION_IA' // Panel de Supervisión y Gobernanza de IA — Fase 3.5
  | 'ANTICIPACION_OPERATIVA'; // Anticipación Operativa y Análisis Predictivo — Fase 4.1


interface VentanillaState {
  radicadoSeleccionado: VentanillaRadicado | null;
  panelDerechoAbierto: boolean;
  drawerNuevoAbierto: boolean;
  filtroMIPG: FiltroMIPG;
  busqueda: string;
  tenantFiltro: TenantId | 'TODOS';
  vistaActual: VistaActual;
  seleccionMasiva: Set<string>;
  tenantMasivo: TenantId | '';
}

export type VentanillaAction =
  | { type: 'SELECCIONAR_RADICADO'; radicado: VentanillaRadicado }
  | { type: 'CERRAR_PANEL_DERECHO' }
  | { type: 'TOGGLE_DRAWER_NUEVO' }
  | { type: 'CERRAR_DRAWER_NUEVO' }
  | { type: 'SET_FILTRO_MIPG'; filtro: FiltroMIPG }
  | { type: 'SET_BUSQUEDA'; busqueda: string }
  | { type: 'SET_TENANT_FILTRO'; tenant: TenantId | 'TODOS' }
  | { type: 'SET_VISTA'; vista: VistaActual }
  | { type: 'SYNC_RADICADO_SELECCIONADO'; radicados: VentanillaRadicado[] }
  | { type: 'TOGGLE_SELECCION'; radicadoId: string }
  | { type: 'SELECCIONAR_TODOS'; radicadoIds: string[] }
  | { type: 'LIMPIAR_SELECCION' }
  | { type: 'SET_TENANT_MASIVO'; tenant: TenantId | '' };

/* ══════════════════════════════════════════════════════════════
   ESTADO INICIAL
══════════════════════════════════════════════════════════════ */

const ESTADO_INICIAL: VentanillaState = {
  radicadoSeleccionado: null,
  panelDerechoAbierto: false,
  drawerNuevoAbierto: false,
  filtroMIPG: 'TODOS',
  busqueda: '',
  tenantFiltro: 'TODOS',
  vistaActual: 'TABLERO',
  seleccionMasiva: new Set(),
  tenantMasivo: '',
};

/* ══════════════════════════════════════════════════════════════
   REDUCER
══════════════════════════════════════════════════════════════ */

function reducer(state: VentanillaState, action: VentanillaAction): VentanillaState {
  switch (action.type) {
    case 'SELECCIONAR_RADICADO':
      return {
        ...state,
        radicadoSeleccionado: action.radicado,
        panelDerechoAbierto: true,
        drawerNuevoAbierto: false,
      };
    case 'CERRAR_PANEL_DERECHO':
      return { ...state, radicadoSeleccionado: null, panelDerechoAbierto: false };
    case 'TOGGLE_DRAWER_NUEVO':
      return {
        ...state,
        drawerNuevoAbierto: !state.drawerNuevoAbierto,
        panelDerechoAbierto: state.drawerNuevoAbierto
          ? state.panelDerechoAbierto
          : false,
      };
    case 'CERRAR_DRAWER_NUEVO':
      return { ...state, drawerNuevoAbierto: false };
    case 'SET_FILTRO_MIPG':
      return { ...state, filtroMIPG: action.filtro };
    case 'SET_BUSQUEDA':
      return { ...state, busqueda: action.busqueda };
    case 'SET_TENANT_FILTRO':
      return { ...state, tenantFiltro: action.tenant };
    case 'SET_VISTA':
      return {
        ...state,
        vistaActual: action.vista,
        panelDerechoAbierto: false,
        drawerNuevoAbierto: false,
        seleccionMasiva: new Set(),
        tenantMasivo: '',
      };
    case 'SYNC_RADICADO_SELECCIONADO': {
      if (!state.radicadoSeleccionado) return state;
      const actualizado = action.radicados.find(
        (r) => r.radicadoId === state.radicadoSeleccionado!.radicadoId,
      );
      if (!actualizado) return state;
      return { ...state, radicadoSeleccionado: actualizado };
    }
    case 'TOGGLE_SELECCION': {
      const siguiente = new Set(state.seleccionMasiva);
      if (siguiente.has(action.radicadoId)) {
        siguiente.delete(action.radicadoId);
      } else {
        siguiente.add(action.radicadoId);
      }
      return { ...state, seleccionMasiva: siguiente };
    }
    case 'SELECCIONAR_TODOS': {
      const todosYaSeleccionados = action.radicadoIds.every((id) =>
        state.seleccionMasiva.has(id),
      );
      if (todosYaSeleccionados) {
        const sin = new Set(state.seleccionMasiva);
        action.radicadoIds.forEach((id) => sin.delete(id));
        return { ...state, seleccionMasiva: sin };
      }
      const con = new Set(state.seleccionMasiva);
      action.radicadoIds.forEach((id) => con.add(id));
      return { ...state, seleccionMasiva: con };
    }
    case 'LIMPIAR_SELECCION':
      return { ...state, seleccionMasiva: new Set(), tenantMasivo: '' };
    case 'SET_TENANT_MASIVO':
      return { ...state, tenantMasivo: action.tenant };
    default:
      return state;
  }
}

/* ══════════════════════════════════════════════════════════════
   CONTEXT
══════════════════════════════════════════════════════════════ */

interface ContextValue {
  state: VentanillaState;
  dispatch: Dispatch<VentanillaAction>;
}

const VentanillaContext = createContext<ContextValue | null>(null);

export function VentanillaProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, ESTADO_INICIAL);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <VentanillaContext.Provider value={value}>{children}</VentanillaContext.Provider>;
}

export function useVentanilla(): ContextValue {
  const ctx = useContext(VentanillaContext);
  if (!ctx) throw new Error('useVentanilla debe usarse dentro de <VentanillaProvider>');
  return ctx;
}
