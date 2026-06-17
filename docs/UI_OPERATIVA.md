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

---

# Radicación Rápida — Modal centrado

**Sprint:** UI Radicación Rápida.

## Diagnóstico previo

`DrawerNuevoRadicado` se renderizaba como **drawer lateral** pegado a la derecha:

```
<div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl ..."/>
```

No estaba centrado, no tenía `max-height`, los botones de acción vivían dentro
del formulario (no había footer fijo) y los inputs/selects usaban paddings
ligeramente distintos lo que provocaba alturas desiguales en la grilla.

## Cambios aplicados

### 1. Modal centrado con backdrop blur

`DrawerNuevoRadicado` ahora renderiza:

```
<div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4"
     role="dialog" aria-modal="true" aria-labelledby aria-describedby>
  <button className="absolute inset-0 bg-black/45 backdrop-blur-md animate-modal-overlay" />
  <div className="relative w-full bg-white flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-modal-panel"
       style={{ maxWidth: 'min(1120px, calc(100vw - 24px))',
                maxHeight: 'calc(100dvh - 24px)' }}>
    <header className="shrink-0 ..."/>
    <div    className="flex-1 min-h-0 overflow-y-auto ..."/>
    <footer className="shrink-0 ..."/>
  </div>
</div>
```

- Centrado horizontal y vertical.
- `max-width: min(1120px, calc(100vw - 24px))` (max-w-5xl en dispositivos
  grandes, sin desbordar en pequeños).
- `max-height: calc(100dvh - 24px)` para asegurar márgenes en cualquier zoom.
- Backdrop `bg-black/45 backdrop-blur-md`.
- Animaciones `animate-modal-overlay` y `animate-modal-panel`
  (≤ 180ms, definidas en `globals.css`).

### 2. Header / Body / Footer

- **Header** (shrink-0): título, subtítulo, botón cerrar con
  `aria-label="Cerrar modal de radicación rápida"`.
- **Body** (`flex-1 min-h-0 overflow-y-auto`): el formulario hace scroll dentro
  del modal, no afecta al dashboard de fondo.
- **Footer** (shrink-0): botones **Cancelar** y **Registrar radicado**. El
  segundo dispara el submit del form vía atributo `form="rad-rapida-form"`.

### 3. Scroll del body bloqueado

Mientras el modal está abierto se aplica `document.body.style.overflow = 'hidden'` en `useEffect`. Al desmontar se restaura el valor anterior. Esto impide el scroll accidental del dashboard detrás.

### 4. Inputs y selects con altura consistente

En `app/globals.css`:

```css
.input-internal { min-height: 2.5rem; line-height: 1.4; }
.select-internal { min-height: 2.5rem; line-height: 1.4; width: 100%; }
```

Inputs y selects ahora comparten `min-height: 2.5rem` y `line-height: 1.4`. Los
campos de solo-lectura (ReadOnlyField) ya tenían padding propio que ahora
coincide visualmente.

### 5. Grilla uniforme

`RadicacionFuncionarioForm` ahora usa:

```
grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4
```

para las tres secciones (Datos de recepción, Solicitante, Clasificación).
Campos largos reciben `col-span`:

- **Nombre / razón social** → `md:col-span-2 xl:col-span-2`
- **Correo electrónico** → `xl:col-span-2`
- **Dirección** → `md:col-span-2 xl:col-span-3`
- **Municipio** → `md:col-span-2 xl:col-span-2`
- **Tipo solicitud** → `md:col-span-2 xl:col-span-2`
- **Asunto / Descripción** → `md:col-span-2 xl:col-span-4`
- **Alerta jurídica** → `md:col-span-2 xl:col-span-4`

En móvil (`< md`) toda la grilla queda en una columna; en tablet (`md`) en dos;
en escritorio (`xl`) en cuatro.

### 6. Soporte de submit externo

`RadicacionFuncionarioForm` ahora acepta:

- `formId?: string` — id que se aplica al `<form>` para que un botón externo
  pueda dispararlo con `form="..."`.
- `hideSubmitButton?: boolean` — oculta el botón Submit interno cuando el
  contenedor pone su propio footer.

### 7. Accesibilidad

- `role="dialog"` y `aria-modal="true"` en el contenedor.
- `aria-labelledby="rad-rapida-title"` y `aria-describedby="rad-rapida-subtitle"`.
- Botón cerrar con `aria-label`.
- ESC cierra el modal (listener registrado en el mismo `useEffect`).
- Focus rings visibles con `focus-visible:ring-2 focus-visible:ring-emerald-700/30`.

### 8. Responsive

- Móvil (< sm): padding lateral 12px, grilla 1 col, footer apilado
  (`flex-col-reverse`).
- Tablet (`sm`–`md`): padding lateral 16px, grilla 2 col.
- Escritorio (`xl`): grilla 4 col, footer en fila con botones a la derecha.

## Qué NO se tocó

- `RadicacionFuncionarioForm.handleSubmit` y `radicarInstitucionalmente` — la
  lógica de radicación queda intacta.
- API `POST /api/radicacion`, generación de consecutivo, cálculo de
  vencimiento, validaciones funcionales.
- Reglas Firestore, SIMI, MIPG, notificaciones.
- ComprobanteRadicado y el estado de éxito tras radicar.

---

# Home / Login — Profundidad institucional y hover premium

**Sprint:** UI Premium Institucional.

Sigue al Sprint Rebranding Institucional: la home y el login quedaron sobre
fondo claro, pero se sentían planos y el texto blanco del logo se perdía sobre
fondo claro. Este sprint agrega profundidad sin saturar, microinteracciones
hover con el degradado de "Digital" y arregla el header en modo claro.

## Paleta final (tokens)

Tokens declarados en `app/globals.css` (`:root`), disponibles vía
`var(--token)`:

| Token | Valor | Uso |
|---|---|---|
| `--brand-forest`        | `#0F3D2E` | Texto/números institucionales sobre claro |
| `--brand-green`         | `#14532D` | Botón primario y acción principal |
| `--brand-green-action`  | `#047857` | Acentos verdes vivos, eyebrows |
| `--brand-green-soft`    | `#DFF5E8` | Fondo de badges y pills suaves |
| `--brand-gold`          | `#D4A017` | Acento dorado (solo bordes/glow/gradient) |
| `--brand-gold-soft`     | `#FFF6D8` | Fondo cálido muy sutil |
| `--bg-institutional`    | `#F7FAF6` | Base clara con leve tinte verde |
| `--bg-institutional-warm` | `#FBFAF4` | Esquina cálida del fondo |
| `--text-primary-2`      | `#172033` | Texto principal sobre claro |
| `--text-secondary-2`    | `#506176` | Texto secundario sobre claro |
| `--border-soft`         | `#D9E7DD` | Bordes suaves de cards |
| `--border-accent`       | `#B8D8C2` | Bordes acentuados (hover, badges) |
| `--gradient-digital`    | `linear-gradient(90deg, #047857 → #16A34A → #D4A017)` | Gradiente protagonista |
| `--gradient-digital-soft` | gradient verde+oro a baja opacidad | Overlay hover en cards/botones |
| `--shadow-institutional-sm/-md/-glow` | sombras suaves verdes | Profundidad y hover |

## Uso del gradiente Digital

- **Texto del headline**: clase `.text-gradient-digital` se aplica solo a la
  palabra "Digital".
- **Hover de botón primario**: `.btn-institucional-primary::after` con el
  gradient se cross-fade sobre el verde institucional al pasar el mouse.
- **Hover de botón secundario y cards**: `--gradient-digital-soft` como overlay
  a baja opacidad. No invade el contenido ni cambia el color de los textos.
- **Subrayado del navbar**: `.link-gradient-underline::after` traza una línea
  de 2px con el gradiente al hover, animada con scaleX (220ms).

## Hover states

| Elemento | Cómo se siente |
|---|---|
| **Radicar mi Solicitud** | Lift de -1px, sombra glow verde, gradient verde→dorado emerge |
| **Consultar radicado**   | Lift de -1px, borde verde más vivo, overlay gradient soft |
| **Navbar (Directorio, Consultar, Acceso funcionarios)** | Texto en `--brand-forest`, subrayado gradient se anima |
| **Cards stats / Cómo funciona** | Lift de -2px, borde acentuado, glow soft y overlay gradient muy sutil |
| **¿Cómo funciona?** (enlace) | Subrayado gradient idéntico al del navbar |

Todas las animaciones duran 200–220ms y respetan
`prefers-reduced-motion: reduce` (se conserva el cambio de color/borde,
desactiva translate/transition).

## Corrección del header en modo claro

`InstitucionalHeader` ahora dibuja, en `theme="light"`, un **wrapper verde
institucional con sombra suave** alrededor del PNG del logo. Esto resuelve
visualmente el problema de que el archivo gráfico oficial trae texto blanco
interno: el fondo verde dentro del recuadro deja el texto perfectamente
legible **sin retocar el archivo gráfico original** y sin afectar el sidebar
oscuro del dashboard ni la constancia impresa, que siguen usando `theme="dark"`
por defecto.

Eyebrow, título y subtítulo del header en modo claro usan los tokens
`--brand-green-action`, `--brand-forest` y `--text-secondary-2`.

## Qué NO se tocó

- Tokens viejos (`--color-primary`, `--shadow-soft`, etc.) — los premium se
  agregan en paralelo para no romper consumidores existentes (sidebar,
  dashboard, constancia).
- `bg-obsidian-gradient`, sidebar interno, `ComprobanteRadicado`, `SelloRadicado`.
- Open Graph y metadata: la imagen `/og-image.png` y la URL absoluta del Sprint
  anterior siguen funcionando igual.
- Lógica de login, sesión, radicación, consulta, dashboard, SIMI, MIPG.
