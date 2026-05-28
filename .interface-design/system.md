# Obsidian Kinetic — Sistema de Diseño

**Producto:** Panel de Gestión Ventanilla Única · Alcaldía de Simacota  
**Dirección:** Dark government tool. Preciso, institucional, denso pero legible.  
**Firma:** Left-border colored accent (`border-l-4`) — lomo de carpeta física de expediente.

---

## Intent

**Quién:** Funcionarios municipales que operan el sistema todo el día en escritorio.  
**Qué deben hacer:** Gestionar, asignar y responder radicados de ciudadanos.  
**Cómo debe sentirse:** Frío y formal, como un registro físico bien organizado. Sin decoración.

---

## Superficies (depth model)

| Capa | Color | Usado para |
|---|---|---|
| Canvas / Sidebar | `#0A0A0B` (`--bg-base`) | Fondo principal, sidebar |
| Panel derecho | `#0D1117` | Panel detalle / drawers |
| Elevado | `rgba(255,255,255,0.04–0.06)` | Cards, inputs |

Regla: mismo fondo para sidebar y canvas. El sidebar se separa con `border-r border-white/[0.07]`, no con color distinto.

---

## Tokens de color

```css
--focus-ring: 0 0 0 2px rgba(99,102,241,0.40);
```

**Acento de autoridad:** Indigo (`indigo-500` / `#6366f1`)  
**Texto:** slate-50 → slate-200 → slate-400 → slate-500 → slate-600 → slate-700  
**Bordes:** `border-white/[0.07]` (separadores) · `border-white/10` (cards) · `border-white/[0.04]` (filas tabla)

### Semántica de alerta (rose/amber/emerald/indigo)
| Tono | Uso | Clases base |
|---|---|---|
| rose | Vencido, crítico | `bg-rose-500/20 text-rose-300 border-rose-500/30` |
| amber | Por vencer, advertencia | `bg-amber-500/20 text-amber-300 border-amber-500/30` |
| emerald | Resuelto, ok | `bg-emerald-500/20 text-emerald-300 border-emerald-500/30` |
| indigo | Pendiente, normal | `bg-indigo-500/20 text-indigo-300 border-indigo-500/30` |
| sky | En proceso | `bg-sky-500/20 text-sky-300 border-sky-500/30` |
| slate | Inactivo, sin carga | `bg-slate-500/20 text-slate-300 border-slate-500/30` |

---

## Estrategia de profundidad

**Borders-only.** Sin sombras. Para herramienta técnica densa.  
- Bordes de separación: `border-white/[0.07]`  
- Bordes de cards: `border-white/10`  
- Bordes de filas: `border-white/[0.04]`  
- Focus ring: `focus-visible:ring-2 focus-visible:ring-[color]/50`

---

## Espaciado

Base unit: **4px** (Tailwind default).  
Padding interno de cards/secciones: `px-4 py-3` (denso) · `px-5 py-4` (headers).  
Gap entre elementos de una fila: `gap-2` / `gap-3`.  
Gap entre secciones: `gap-4` / `gap-5`.

---

## Tipografía

| Nivel | Clases |
|---|---|
| H1 / headline | `font-headline text-2xl text-slate-50` (Manrope 800, tight tracking) |
| Section title | `text-base font-black text-slate-50` |
| Section label | `text-[10px] font-bold uppercase tracking-widest text-slate-600` |
| Table headers | `text-[10px] font-bold uppercase tracking-widest text-slate-400` |
| Body primario | `text-sm text-slate-200` |
| Body secundario | `text-xs text-slate-400` |
| Metadata | `text-[10px] text-slate-500` / `text-[10px] font-mono text-slate-600` |
| Números destacados | `text-2xl font-black tabular-nums` / `text-xl font-black tabular-nums` |

---

## Estados de interacción (todos los elementos interactivos)

```
hover:bg-white/[0.05]   — shift sutil de fondo
active:scale-[0.95–0.99] — feedback táctil de pulsación
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]/50
transition-all duration-150
```

---

## Clases utilitarias (globals.css)

| Clase | Descripción |
|---|---|
| `.glass-card` | Cards login/modal con backdrop-blur |
| `.bg-obsidian-gradient` | Fondo login (radial indigo glow) |
| `.input-obsidian` | Input grande para formularios de login |
| `.input-internal` | Input compacto para formularios de dashboard |
| `.select-internal` | `<select>` estilizado con border/focus/hover consistentes |
| `.btn-primary` | CTA indigo con gradiente y lift en hover |
| `.btn-ghost` | Botón secundario ghost |
| `.font-headline` | Manrope 800, tight tracking |
| `.font-label` | DM Sans 700 uppercase |

---

## Componente: Tarjeta de métrica (`border-l-4` spine)

Patrón de la firma visual del proyecto. Aparece en:
- Fila de métricas MIPG (TarjetasMIPG)
- Resumen del Panel de Carga por Dependencia

```tsx
// Estado inactivo
className="shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border border-l-4
           bg-slate-900/40
           border-t-white/[0.08] border-r-white/[0.08] border-b-white/[0.08]
           {border-l-COLOR}
           hover:bg-slate-800/60 hover:-translate-y-px
           transition-all duration-200"

// Estado activo
className="... bg-slate-800/80 border-t-white/15 border-r-white/15 border-b-white/15"
```

Estructura interna:
```tsx
<span className="text-2xl font-black leading-none tabular-nums {text-COLOR}">{valor}</span>
<span className="text-[10px] font-bold uppercase tracking-widest mt-0.5 {text-COLOR} opacity-70">{label}</span>
```

---

## Componente: Tabla densa

Patrón usado en TablaRadicados, BandejaAsignacion, PanelCargaDependencias.

```tsx
// Contenedor
<div className="flex-1 overflow-y-auto overflow-x-auto">
  <table className="w-full text-sm">
    <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm">
      <tr className="border-b border-white/[0.07]">
        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
          {header}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors group">
        <td className="px-4 py-3">{content}</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Spine semántico en filas de tabla (firma del proyecto)

```tsx
// En <tr>: border-l-4 + color semántico por estado de urgencia
<tr className={`border-b border-white/[0.04] border-l-4 ${SPINE_CLS[alertaTono]} ...`}>
```

Mapa de colores de spine (AlertaTono):
```ts
const SPINE_CLS = {
  rose:   'border-l-rose-500',   // vencidos > 0
  amber:  'border-l-amber-500',  // porVencer > 0
  indigo: 'border-l-indigo-500', // activo sin urgencia
  slate:  'border-l-slate-700',  // sin carga
};
```

---

## Componente: Panel de Carga por Dependencia

Archivo: `app/interno/dashboard/components/dependencias/PanelCargaDependencias.tsx`  
Hook: `useCargaDependencias.ts` — derivación client-side desde radicados ya cargados en store.

**Layout:** `flex-1 flex flex-col overflow-hidden min-h-0`  
1. Header con título + indicador "Tiempo real" (punto verde `animate-pulse`)
2. Franja de 4 tarjetas resumen (Con vencidos / Con alertas / Con actividad / Sin carga)
3. Tabla densa de 16 dependencias ordenadas por urgencia

**Chips de estado inline:**
```tsx
// Solo se renderizan si valor > 0
<ChipEstado valor={dep.pendientes} label="PEND" cls="bg-indigo-500/20 text-indigo-300 border-indigo-500/30" />
<ChipEstado valor={dep.enProceso}  label="PROC" cls="bg-sky-500/20 text-sky-300 border-sky-500/30" />
<ChipEstado valor={dep.porVencer}  label="PV"   cls="bg-amber-500/20 text-amber-300 border-amber-500/30" />
<ChipEstado valor={dep.vencidos}   label="VENC" cls="bg-rose-500/20 text-rose-300 border-rose-500/30" />
```

**Barra de carga:**
```tsx
<div className="h-1 bg-slate-800 rounded-full overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-500 ${BARRA_CLS[dep.alertaTono]}`}
       style={{ width: `${dep.cargaRelativa}%` }} />
</div>
```
`cargaRelativa` = porcentaje respecto al tenant con más radicados (máx = 100%).

**Acción hover-reveal:**
```tsx
className="... opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
```
Al click: `SET_TENANT_FILTRO` + `SET_FILTRO_MIPG('TODOS')` + `SET_VISTA('TABLERO')`.

---

## Indicador tiempo real

Patrón para indicar sincronización live con Firestore:

```tsx
<span className="flex items-center gap-1.5 text-[10px] text-slate-600">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
  Tiempo real
</span>
```

---

## Orden de urgencia (sort pattern)

Para listas donde la urgencia es la prioridad de visualización:
```ts
.sort((a, b) => {
  if (b.vencidos  !== a.vencidos)  return b.vencidos  - a.vencidos;
  if (b.porVencer !== a.porVencer) return b.porVencer - a.porVencer;
  return b.total - a.total;
})
```

---

## Integración de vistas en DashboardInterior

El `vistaActual` controla qué se renderiza en la columna central:

```tsx
{vistaActual === 'REPORTES'     ? <VistaReportes />          :
 vistaActual === 'BANDEJA'      ? <BandejaAsignacion />      :
 vistaActual === 'DEPENDENCIAS' ? <PanelCargaDependencias /> :
 /* default TABLERO / VENTANILLA */
 <>
   <TarjetasMIPG />
   <TablaRadicados />
 </>
}
```

Vistas que ocultan el panel derecho: `'BANDEJA'` y `'DEPENDENCIAS'`.
