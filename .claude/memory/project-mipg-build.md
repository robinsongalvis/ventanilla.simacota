---
name: project-mipg-build
description: Archivos creados y reescritos en la sesión de construcción del módulo MIPG h-screen 3 columnas
metadata:
  type: project
---

Sesión completada 2026-05-27. Se implementó el "Sistema Unificado Ventanilla MIPG".

**NUEVOS:**
- `lib/store/ventanillaStore.tsx` — React Context + useReducer. Estado: radicado seleccionado, panel derecho, filtro MIPG activo, drawer, búsqueda, tenantFiltro, vistaActual.
- `lib/hooks/useVentanillaRadicados.ts` — onSnapshot a `ventanilla_radicados`, filtro por tenant en servidor.
- `lib/actions/radicarVentanilla.ts` — Acción completa: genera ID → sube archivos Storage → escribe VentanillaRadicado en Firestore.

**REESCRITOS:**
- `app/interno/dashboard/page.tsx` — Layout h-screen 3 columnas: SidebarNav (210px) | Métricas MIPG clickeables + TablaRadicados (flex-1) | PanelDerecho 4 tabs (420px slide).

**TABS del panel derecho:**
1. Información — datos completos solicitante + archivos con links
2. Traslado — selector tenant + funcionario + updateDoc Firestore
3. Trazabilidad — timeline inmutable de TrazabilidadRadicado[]
4. Prórroga/Respuesta — devolver | prorroga (extiende fecha) | resolver (cierra caso)

**MÉTRICAS MIPG (6 tarjetas clickeables → filtran tabla):**
Radicadas [Verde] · Prioridad MIPG [Rojo estrella] · Asignadas [Azul] · Por Vencer [Naranja] · Vencidas [Rojo] · Devueltas/Prórroga [Ocre]

**Why:** Reemplazar dashboard de tarjetas por SPA operacional MIPG sin scroll global.
**How to apply:** El drawer de Radicación Rápida usa `RadicacionFuncionarioForm` + `radicarInstitucionalmente`. Índice Firestore requerido: `clasificacion.oficinaDestino ASC | control.fechaRadicado DESC`.
