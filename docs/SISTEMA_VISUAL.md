# Sistema visual base — Ventanilla Única Digital

> Documento vivo. Las secciones 1.1–1.5 conservan el inventario histórico
> levantado el 23-sep-2026; la sección 2 documenta la implementación actual
> de la arquitectura visual compartida de **ADR-0046**. Referencia UX/UI: el Tablero
> (ADR-0044) y el tema claro/oscuro (ADR-0043, ADR-0045).

## 1. Inventario de partida (23-sep-2026; histórico)

### 1.1 Roles (`RolInterno`, `lib/hooks/useAuth.ts`)

| Rol | Alcance de datos hoy | Fuente |
|---|---|---|
| `ADMIN` | Municipal (todas las dependencias, filtrable) | `puedeVerTodosLosTenants` |
| `CONTROL_INTERNO` | Municipal | `puedeVerTodosLosTenants` |
| `RECEPCIONISTA` (Ventanilla) | Municipal | `puedeVerTodosLosTenants` |
| `JEFE_DEPENDENCIA` | Su dependencia (`usuario.tenantId`) | `useVentanillaRadicados` |
| `FUNCIONARIO` | Su dependencia; chip «Solo los míos» para lo asignado a él | `useVentanillaRadicados` |

El acotamiento de datos ya es contextual en la capa de datos
(`useVentanillaRadicados` → `where('clasificacion.oficinaDestino', '==', …)`),
y las reglas de Firestore lo hacen cumplir en el servidor. **La interfaz no es
la barrera de seguridad:** ocultar un botón es presentación; la autorización
real vive en las reglas y en las API.

### 1.2 Dependencias (`TenantId`, `src/types/radicado.ts`)

15 dependencias en `DIRECTORIO_TENANTS` (nombre oficial en `NOMBRES_TENANT`):
Ventanilla Única, Despacho del Alcalde, Secretarías de Gobierno, Planeación,
Desarrollo Social, Hacienda y Agricultura (UMATA), Comisaría de Familia,
Inspecciones de Policía (urbana y Yariguíes), Enlace de Víctimas, SISBEN,
Gestión del Riesgo, Programas y Hacienda Yariguíes.

> **Jurídica no es una dependencia ni un rol.** Hoy solo existe como estado
> del flujo SIMI («Pendientes jurídica», «Escalados jurídica»). Una vista
> «Jurídica» exige decidir antes qué es (ver ADR-0046 §5).

### 1.3 Vistas y permisos (`puedeAccederVista`, hoy en `lib/permisos/contexto-interno.ts`)

| Vista (`VistaActual`) | Componente | Roles con acceso |
|---|---|---|
| TABLERO | rama propia en `page.tsx` | todos |
| BANDEJA / VENTANILLA | `BandejaAsignacion` / `VistaVentanilla` | ADMIN, RECEPCIONISTA |
| SALIDAS | `VistaSalidas` | ADMIN, RECEPCIONISTA, CONTROL_INTERNO |
| DEPENDENCIAS | `PanelCargaDependencias` | roles municipales |
| MI_GESTION | `VistaMiGestion` | todos |
| REPORTES | `VistaReportes` | ADMIN, CONTROL_INTERNO, JEFE, RECEPCIONISTA |
| ANALYTICS | `VistaAnalytics` | ADMIN, CONTROL_INTERNO, JEFE |
| ALERTAS | `VistaAlertas` | todos |
| SUPERVISION_IA / ANTICIPACION_OPERATIVA | `VistaSupervisionIA` / `VistaAnticipacionOperativa` | ADMIN, CONTROL_INTERNO |
| CONTROL_INTERNO | `CentroControlInterno` | ADMIN, CONTROL_INTERNO |
| APROBACIONES | `JefeAprobacionesPanel` | ADMIN, JEFE, CONTROL_INTERNO |
| ADMINISTRACION | `VistaAdministracion` | ADMIN |
| LICENCIAS | `VistaLicencias` (+ ruta `/interno/licencias`) | ADMIN, FUNCIONARIO de Planeación |
| — | `/interno/recepcion` | Recepción (formulario de radicación) |

Acciones por permiso al levantar el inventario: `puedeRadicar` (Nuevo radicado), registro de salida,
reparto, «Registro exprés» (no CONTROL_INTERNO), selector de dependencia
(solo roles municipales), modo solo lectura (JEFE, CONTROL_INTERNO).

**Estado actual:** la lógica de permisos de interfaz está centralizada en
`lib/permisos/contexto-interno.ts`; `page.tsx` y `GuardModuloPlaneacion`
consumen ese mismo contrato. Las reglas de Firestore y las API siguen siendo
la barrera de autorización.

### 1.4 Armazón (shell)

| Pieza al 23-sep | Dashboard | Licencias (`/interno/licencias`) |
|---|---|---|
| Menú lateral | `SidebarNav` (en `page.tsx`) | `LicenciasSidebar` (**segundo menú**) |
| Barra móvil | `MobileTopBar` (en `page.tsx`) | `LicenciasTopBarMovil` (**segunda barra**) |
| Encabezado de escritorio | `EncabezadoPantalla` (en `page.tsx`) | cabeceras propias por página |
| Tema | `<html data-tema>` desde `app/interno/layout.tsx` | ídem |

El contenido de Licencias ya se compartía: `VistaLicencias` reutilizaba
`BandejaLicenciasClient`, `DetalleLicenciaClient` y `LibroConsecutivoClient`.
El armazón duplicado fue retirado en el cierre técnico de la Ola 3: las rutas
legacy redirigen a la vista canónica dentro del dashboard y conservan el guard.

### 1.5 Componentes visuales — duplicación medida

| Patrón | Implementaciones al 23-sep | Dónde |
|---|---|---|
| Tarjeta de indicador (KPI) | **11** | `KpiCard` ×5 (Analytics, Anticipación, SupervisiónIA, ControlInternoDashboard, PqrsdDeadlineDashboard), `MetricCard` ×2 (design-system, QualityMetricsPanel), `TarjetaKPI`, `TarjetaKpiLibro`, `TarjetaResumen`, `TarjetaResumenTablero` |
| Chip de filtro | **4** | `ChipFiltro` (Tablero), `ChipFiltro` (ChecklistRequisitos), `ChipFiltroHoy` (Ventanilla), `ChipFiltroLibro` (Licencias) |
| Chip/badge de estado | **4** | `StatusBadge` (design-system), `ChipEstado` ×3 (Dependencias, Licencias, EventoTimeline) |
| Encabezado de sección | **5** | `SectionHeader`, `SeccionTitulo`, `SectionTitle`, `Seccion` ×2 |
| Estado vacío | **2** | `EmptyState`, `EstadoVacio` |
| Buscador | **9 archivos** con input propio | Tablero, Salidas, Administración, Licencias ×5, búsqueda avanzada |
| Tabla | **16 tablas** en 15 archivos | cada una con su cabecera sticky/scroll propio o sin él |
| Panel colapsable | 1 en uso (`PanelIndicadoresColapsable`) + `CollapsibleSection` sin uso | |

**Código muerto identificado en el inventario:** `TarjetaMIPGGrande`, `MetricsSummary` (tiene
test de contraste), `CollapsibleSection`, `SearchToolbar`.

Al levantar el inventario, `app/interno/dashboard/page.tsx` tenía **5.711 líneas**: contenía armazón,
permisos, Tablero, tabla, panel de detalle, drawer y dos vistas completas.

## 2. Qué quedó compartido y qué permanece por módulo

### 2.1 Global (una sola implementación, contenido por props)

**Ya disponibles (Ola 2):** `Indicador` (+ `TONOS_INDICADOR`), `ChipFiltro`,
`PanelIndicadoresColapsable`, `BarraTrabajo`, `SuperficieTabla`,
`CabeceraTablaSticky`, `BotonTema`, `PriorityBanner`, `StatusBadge`,
`EmptyState`, en `app/components/design-system/`.

**Añadidas en la Ola 3:** `BotonAccion` (primaria, secundaria y destacada, la
dorada solo para recibir al ciudadano), `Pestanas` + `PanelPestana`, y
`TarjetaIndicador` + `FilaTarjetas` (referencia visual oficial, ADR-0046 §6).

**Regla de indicadores:** las tarjetas (`TarjetaIndicador`) muestran el estado
y nunca filtran. Los chips (`ChipFiltro`) filtran. `Indicador` en fila queda
para los paneles colapsables del Tablero, donde cada indicador sí es un
filtro. Contrato fijado en
`__tests__/design-system-primitivas-render.test.tsx` (incluye que ninguna
conoce radicados, filtros MIPG ni roles). Contexto de permisos:
`lib/permisos/contexto-interno.ts` (Ola 1).


| Capa | Componente | Sustituye a |
|---|---|---|
| Contexto | `construirContextoInterno(usuario)` → rol, dependencia, alcance, permisos, vistas | funciones `puede*` dispersas |
| Armazón | `SidebarNav`, `EncabezadoPantalla` y `MobileTopBar` en el dashboard; las rutas legacy de Licencias redirigen al armazón común | `LicenciasSidebar` y `LicenciasTopBarMovil` retirados |
| Estructura | `SectionHeader`, `PanelIndicadoresColapsable`, `Pestanas` y `PanelPestana` | franjas blancas ad hoc, `SeccionTitulo`, `CollapsibleSection` |
| Indicadores | `Indicador`, `TarjetaIndicador` y `FilaTarjetas` | las tarjetas KPI duplicadas |
| Filtros | `ChipFiltro`, `BarraTrabajo` (buscador + acciones) | 4 chips y 9 buscadores |
| Estados | `StatusBadge` extendido | 3 `ChipEstado` |
| Datos | `SuperficieTabla` y `CabeceraTablaSticky` (contenedor, sin definir columnas) | contenedores de tabla repetidos |
| Avisos | `PriorityBanner`, `EmptyState` | `EstadoVacio` |
| Tema | `BotonTema`, tokens `--tema-*` | — |

### 2.2 Específico de cada módulo (se queda, pero consume las primitivas)

- Columnas y filas de `TablaRadicados`, `PanelDerecho` (detalle y respuesta).
- Licencias: `CabeceraExpediente`, `CabeceraTermino` (reloj legal),
  `ChecklistRequisitos`, `PanelTerminoDual`, libro consecutivo.
- `PanelReparto`, formularios de radicación, `BusquedaAvanzadaPanel`.
- Documentos oficiales (`isla-clara`): sellos y comprobante.
- Gráficas de Analítica, `SemaforoTermino` (regla de negocio del término).

## 3. Contenido contextual

La misma pantalla, con distinto contenido según
`rol + dependencia + permisos + vista`:

| Contexto | Título | Radicados | Métricas | Acciones |
|---|---|---|---|---|
| ADMIN | «Vista municipal» o dependencia filtrada | todas | Semáforo global + resumen | todas |
| CONTROL_INTERNO | «Vista municipal» | todas (solo lectura) | Semáforo + control | sin radicar |
| RECEPCIONISTA | «Ventanilla · Vista municipal» | todas | recepción y reparto | radicar, salidas, reparto |
| JEFE_DEPENDENCIA | nombre de su dependencia | su dependencia (solo lectura) | de su dependencia | aprobaciones |
| FUNCIONARIO | nombre de su dependencia | su dependencia + «Solo los míos» | de su dependencia | responder asignados |
| FUNCIONARIO de Planeación | «Secretaría de Planeación» | ídem + Licencias | ídem + licencias | ídem + expedientes |
