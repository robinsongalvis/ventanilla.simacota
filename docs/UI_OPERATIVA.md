# UI Operativa — Bandeja de Radicados

**Sprint:** UI Bandeja Operativa · **Estado:** Aplicado en preoperación.

Este documento describe la distribución del espacio del dashboard interno
(`/interno/dashboard`) tras el sprint de UI. **No** modifica reglas de negocio,
seguridad, roles, APIs ni cálculos MIPG — son ajustes de layout, CSS/Tailwind y
responsividad.

## Diagnóstico previo

El layout ya tenía la cadena correcta de flex/overflow:

```
<main className="flex h-[100dvh] overflow-hidden">           ← raíz
  SidebarNav (shrink-0)
  <div className="flex-1 flex flex-col overflow-hidden">     ← columna central
    SemáforoPQRSD (shrink-0)
    TarjetasMIPG  (shrink-0)
    PanelOperacionDependencia (shrink-0)
    TablaRadicados (flex-1 flex flex-col overflow-hidden min-h-0)
      Toolbar (shrink-0)
      Tabla wrapper (flex-1 overflow-y-auto overflow-x-auto)
        <table className="md:min-w-[920px]">
```

Sin embargo, los **tres bloques de KPI** (semáforo + 8 tarjetas + bandeja
operativa con sub-tarjetas y "siguiente atención") consumían demasiada altura
natural en pantallas medianas (1280×720, portátiles institucionales típicos),
dejando la tabla con muy poco espacio útil.

## Cambios aplicados

### 1. Cadena flex reforzada

Se añadió `min-h-0` también al contenedor central:

```diff
- <div className="flex-1 flex flex-col overflow-hidden min-w-0">
+ <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
```

Esto evita que en ciertos navegadores el hijo `flex-1` (TablaRadicados) reciba
una altura calculada mayor a la pantalla y se quede sin scroll interno.

### 2. KPIs compactos con persistencia

- `TarjetasMIPG` y `PanelOperacionDependencia` aceptan `modoCompacto?: boolean`.
- En modo compacto:
  - Padding vertical pasa de `py-3` a `py-1.5`.
  - Números de KPI bajan de `text-2xl` a `text-base`.
  - Labels secundarios bajan de `text-[10px]` a `text-[9px]`.
  - Se oculta la tarjeta de **Siguiente atención sugerida**.
  - Se oculta el **Semáforo PQRSD**.
- Botón **Contraer indicadores / Expandir indicadores** en la barra de KPIs.
- Preferencia persistida en `localStorage` con la clave `indicadoresModo` por
  el hook `lib/hooks/useIndicadoresModo.ts`.

### 3. Encabezado de tabla sticky reforzado

Antes el background sticky estaba en el `<tr>`, lo que dejaba bordes visibles
al hacer scroll en algunos navegadores. Se movió el background al `<th>`
directamente con `box-shadow: 0 1px 0 rgba(20,83,45,0.08)` para reforzar la
separación visual.

```diff
- <thead className="sticky top-0 z-10">
-   <tr style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
-     <th className="...">...</th>
+ <thead className="sticky top-0 z-20">
+   <tr style={{ borderBottom: '1px solid #D9E2D9' }}>
+     <th style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9', boxShadow: '0 1px 0 rgba(20,83,45,0.08)' }}>...</th>
```

### 4. Scroll horizontal controlado

El wrapper de la tabla mantiene `overflow-x-auto overflow-y-auto`. La tabla
sigue con `md:min-w-[920px]` para garantizar legibilidad en escritorio. En
viewport `sm` (640px–767px) la tabla NO fuerza `min-width` para evitar scroll
horizontal en tabletas. En `< sm` el render usa **tarjetas** (`sm:hidden`) y no
depende de la tabla.

### 5. Vista móvil

Las tarjetas móviles ya existían (`sm:hidden flex-1 overflow-y-auto`). No
requirieron cambios.

## Cómo activar el modo compacto

1. Iniciar sesión en `/interno/login`.
2. En el dashboard, sobre la fila de tarjetas MIPG, presionar
   **Contraer indicadores**.
3. La preferencia se guarda en el navegador y se aplica automáticamente al
   volver a entrar.

## Qué NO se tocó

- `useVentanillaRadicados` (hook que consume Firestore).
- Reglas de Firestore (`firestore.rules`).
- Endpoints `/api/*` y cálculo MIPG.
- Lógica de roles y permisos.
- Búsqueda histórica avanzada (Sprint 2) — sigue funcionando igual.
- Panel derecho (PanelDerecho) — sigue abriéndose en `xl` sin afectar scroll.
