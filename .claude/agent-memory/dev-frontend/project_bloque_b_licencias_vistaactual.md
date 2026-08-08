---
name: bloque-b-licencias-vistaactual
description: Licencias integrada como VistaActual 'LICENCIAS' del panel interno (Bloque B, "la ventanita") — estructura, props aditivas y qué NO se tocó
metadata:
  type: project
---

Bloque B (encargo del propietario, 8-ago-2026): Licencias pasó de ser un
link de página completa a `/interno/licencias` a una pestaña REAL de
`VistaActual` (`'LICENCIAS'`, `lib/store/ventanillaStore.tsx`) dentro del
espacio de trabajo del panel interno, donde el funcionario de Planeación ya
ve sus radicados. Construido sobre `main` que ya traía el Bloque A completo
(checklist/documentos, handoff radicado⇄expediente — ver
[[project_bloque_a3_checklist_documentos]] y
[[project_bloque_a4_handoff_radicado_expediente]]).

**Estructura final:**
- `app/interno/dashboard/components/licencias/VistaLicencias.tsx` (nuevo) —
  monta `BandejaLicenciasClient`/`DetalleLicenciaClient` embebidos, con
  sub-pestañas locales "Bandeja"/"Libro consecutivo" (estado `subVista`) y
  navegación al detalle por estado local `expedienteSeleccionado` (NO por
  ruta). Patrón de sub-tabs reutilizado del propio `page.tsx` (pill toggle
  `role="tablist"`/`role="tab"`/`aria-selected`, línea ~3611 al momento de
  construir esto — buscar por `role="tablist"` si se movió).
- `BandejaLicenciasClient` y `DetalleLicenciaClient` ganaron props
  ADITIVAS opcionales: `onAbrirExpediente?: (id) => void` y `onVolver?: ()
  => void`. Sin ellas (ruta standalone `/interno/licencias`) el
  comportamiento es idéntico al de antes (`<Link>`). Con ellas, un helper
  interno (`EnlaceExpediente` en Bandeja, `VolverBandeja` con branch en
  Detalle) decide botón-con-callback vs. `<Link>`.
- `puedeVerLicencias` (helper en `page.tsx`, ~línea 319) pasó de "solo
  decide si aparece el link" a gatear también `puedeAccederVista(usuario,
  'LICENCIAS')` — mismo patrón que Analítica/Alertas.
- Badge "Planeación" que vivía en el link viejo ahora es un span
  condicional (`vista === 'LICENCIAS'`) dentro del loop de `items.map` de
  `SidebarNav`, con contraste distinto activo/inactivo (sobre dorado
  `#D4A017` el texto claro perdía legibilidad — se usa `rgba(20,83,45,.65)`
  cuando el ítem está activo).

**Lo que NO se tocó (a propósito, ruta standalone viva para deep-links):**
`app/interno/licencias/layout.tsx` (con `GuardModuloPlaneacion` y
`h-screen` — ese guard rompería la columna del panel, por eso
`VistaLicencias` NO lo usa; el gating ya lo da `puedeAccederVista`),
`app/interno/licencias/page.tsx`, `[expedienteId]/page.tsx`,
`libro-consecutivo/page.tsx`. Se corrigió (deviation menor, justificada)
el JSDoc de `LicenciasSidebar.tsx`, que afirmaba que integrar a
`VistaActual` "quedaba para Fase 3+" — ya no es cierto, se dejó explícito
que ambos caminos (standalone y embebido) comparten los mismos Client
Components.

**Tests:** sin precedente en el repo de testear la visibilidad de un ítem
de `SidebarNav` por rol (vive privado dentro de `page.tsx`, sin export,
5000+ líneas) — se siguió la salida que el propio encargo dejaba abierta:
un test de render de `VistaLicencias` (`__tests__/vista-licencias-
render.test.tsx`) cubriendo bandeja embebida, `onAbrirExpediente` abre
detalle, `onVolver` regresa, y la sub-pestaña libro consecutivo. Mock de
`useAuth` (patrón `guard-modulo-planeacion-render.test.tsx`) + mock de
`fetch` para `/api/licencias/expedientes` y `/api/licencias/expedientes/
{id}` (patrón `crear-desde-radicado-form.test.tsx`). Fixture de expediente
con `origen: 'RECONSTRUIDO'` a propósito — evita necesitar actuaciones/
fechas reales para que `proyeccion` sea `null` (sin depender del reloj del
sistema, sin flakiness).
