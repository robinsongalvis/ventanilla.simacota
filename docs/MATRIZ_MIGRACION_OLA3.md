# Matriz de migración — Ola 3 (ADR-0046)

> Las §§1–5 conservan el inventario histórico previo a tocar código el
> 23-sep-2026. La implementación y el cierre técnico se documentan en §§6–7.
> La aceptación con sesión autenticada en Stage continúa pendiente.

**Regla de la ola.** Cada vista adopta el lenguaje visual del Tablero
(tokens `--tema-*`, jerarquía encabezado → indicadores → barra de trabajo →
chips → aviso → contenido) con las primitivas de `app/components/design-system/`.
El contenido, las métricas y las acciones salen de `construirContextoInterno`
(rol + dependencia + permisos). Sin diseños por secretaría o rol, sin quitar
funcionalidad y sin cambiar lógica de negocio, filtros ni permisos.

**Primitivas disponibles (Ola 2):** `Indicador`, `ChipFiltro`,
`PanelIndicadoresColapsable`, `BarraTrabajo`, `SuperficieTabla` +
`CabeceraTablaSticky`, `BotonTema`. Ya existentes: `SectionHeader`,
`StatusBadge`, `EmptyState`, `PriorityBanner`.

## 1. Las 15 vistas

`VistaActual` tiene 16 valores. Sin contar `TABLERO`, quedan 15: 14 con
pantalla y `RADICACION`, que no tiene ninguna (§2.15).

| # | Vista | Componente | Líneas | Acceso (rol · dependencia) | Alcance de datos |
|---|---|---|---|---|---|
| 1 | VENTANILLA | `VistaVentanilla` | 450 | ADMIN, RECEPCIONISTA | municipal |
| 2 | BANDEJA | `BandejaAsignacion` (dentro de `page.tsx`) | ~245 | ADMIN, RECEPCIONISTA | municipal, solo pendientes de asignar |
| 3 | SALIDAS | `VistaSalidas` | 237 | ADMIN, RECEPCIONISTA, CONTROL_INTERNO | libro 2-SAL completo |
| 4 | DEPENDENCIAS | `PanelCargaDependencias` | 269 | ADMIN, CONTROL_INTERNO, RECEPCIONISTA | municipal |
| 5 | MI_GESTION | `VistaMiGestion` | 334 | todos | **solo lo asignado al usuario** (privacidad v1) |
| 6 | REPORTES | `VistaReportes` (dentro de `page.tsx`) | ~295 | ADMIN, CONTROL_INTERNO, JEFE, RECEPCIONISTA | el del usuario; salidas solo si `verLibroSalidas` |
| 7 | ANALYTICS | `VistaAnalytics` | 360 | ADMIN, CONTROL_INTERNO, JEFE | `esAdmin ? todos : su dependencia` |
| 8 | ALERTAS | `VistaAlertas` | 290 | todos | `esAdmin ? todos : su dependencia` |
| 9 | ANTICIPACION_OPERATIVA | `VistaAnticipacionOperativa` | 414 | ADMIN, CONTROL_INTERNO | radicados + `ai_auditoria` |
| 10 | SUPERVISION_IA | `VistaSupervisionIA` | 342 | ADMIN, CONTROL_INTERNO | `ai_feedback`, `ai_auditoria`, `ai_logs` |
| 11 | CONTROL_INTERNO | `CentroControlInterno` + 6 paneles + `ControlInternoDashboard` | 1.598 | ADMIN, CONTROL_INTERNO | API `/api/interno/control/*` |
| 12 | APROBACIONES | `JefeAprobacionesPanel` | 324 | ADMIN, JEFE, CONTROL_INTERNO | API `/api/simi/juridico/*` |
| 13 | ADMINISTRACION | `VistaAdministracion` + `SimiGobernanzaPanel` | 1.002 | ADMIN | API `/api/admin/usuarios` |
| 14 | LICENCIAS | `VistaLicencias` + ruta `/interno/licencias/*` | 8.965 (módulo completo) | ADMIN, FUNCIONARIO de Planeación (el JEFE de Planeación **no**) | API `/api/licencias/*` |
| 15 | RADICACION | — (sin pantalla) | — | — | — |

## 2. Ficha por vista

Leyenda de la columna «DS»:

- **✓** ya la usa;
- **→** la adopta en la Ola 3;
- **△** la adopta, pero necesita un ajuste aditivo en la primitiva (§3).

### 2.1 VENTANILLA — mostrador de atención al ciudadano

- **DS:**
  - ✓ `SectionHeader`, `EmptyState`, `StatusBadge`;
  - △ `BarraTrabajo` para la búsqueda protagonista (le falta `onEnter`);
  - △ `ChipFiltro` en lugar de `ChipFiltroHoy` (hoy el nombre accesible es «Filtrar trabajo de hoy: X (n)»; hay que conservarlo).
- **Conservar:**
  - `FilaTrabajoHoyItem` (riel de urgencia, hora, pendientes);
  - la lista de coincidencias (máx. 8);
  - `trabajoDeHoy`;
  - `coincideIdentidadFiltroRapido` (ADR-0012: la identidad reservada solo coincide por número).
- **Filtros:**
  - consulta por radicado, cédula o nombre (estado **propio**, no el del reducer del Tablero);
  - chips de «Trabajo de hoy»: Todos, PDF sin sellar, Datos incompletos, Correo fallido y Constancia sin enviar (cada uno solo si su conteo es mayor que 0).
- **Tablas:** ninguna; es una lista de filas-botón.
- **Acciones:**
  - Nueva radicación (`radicar`, única superficie dorada);
  - Registrar salida y Reparto del día (`registrarSalida`);
  - Búsqueda avanzada;
  - Abrir radicado;
  - Enter abre la coincidencia exacta.
- **Particularidades:**
  - no tiene KPIs a propósito: «¿Panorama? Eso vive en el Tablero»;
  - hex fijos (`VERDE_INST`, `DORADO`, rieles) por tokenizar.

### 2.2 BANDEJA — asignación de radicados

- **DS:**
  - △ `SuperficieTabla` + `CabeceraTablaSticky` (la primera columna es la casilla «seleccionar todos»: hace falta una columna de control);
  - → `EmptyState` para «Sin pendientes».
- **Conservar:**
  - el selector de dependencia por fila;
  - la barra de asignación masiva;
  - el skeleton de carga;
  - `nombreSolicitanteVisible` y `documentoSolicitanteVisible` (protección de identidad).
- **Filtros:** ninguno. No se agrega buscador: sería funcionalidad nueva.
- **Tabla:** ☐ · Radicado · Solicitante · Tipo · Días · Dependencia destino · Acción.
- **Acciones:**
  - Asignar → (por fila);
  - seleccionar todos;
  - Asignar N (masivo, con dependencia destino);
  - Limpiar selección.
- **Particularidades:**
  - la dependencia por defecto de cada fila es `DESPACHO_ALCALDE`;
  - la selección vive en el reducer global;
  - propuesta: moverla de `page.tsx` a su propio archivo, sin cambios, antes de migrarla.

### 2.3 SALIDAS — libro de correspondencia despachada

- **DS:**
  - ✓ `SectionHeader`, `EmptyState`;
  - → `BarraTrabajo` (buscador, contador «N salidas» y la acción Registrar salida como hijo).
- **Conservar:**
  - `SelloDespacho` (documento oficial, `isla-clara`);
  - el modal de constancia;
  - la fila de salida (tipo Respuesta u Oficio, medio y firmante).
- **Filtros:** búsqueda sin tildes por número, destinatario, entidad, asunto y radicado de entrada.
- **Tablas:** ninguna; es una lista.
- **Acciones:**
  - Registrar salida;
  - Ver oficio (descarga segura `/api/interno/archivo`);
  - Constancia (reimpresión);
  - Entrada {id} → abre el radicado.
- **Particularidades:**
  - el libro es inmutable;
  - ⚠ **brecha:** CONTROL_INTERNO ve el botón «Registrar salida», pero el manejador lo ignora (`puedeRegistrarSalida = false`). Se oculta con `permisos.registrarSalida` (§4.1).

### 2.4 DEPENDENCIAS — carga por dependencia

- **DS:**
  - ✓ `SectionHeader`;
  - △ `Indicador` para las 4 tarjetas (Con vencidos, Con alertas, Con actividad, Sin carga). Hoy **no son clicables**, así que hace falta una variante estática;
  - → `SuperficieTabla` + `CabeceraTablaSticky`.
- **Conservar:**
  - `FilaDependencia`, con barra de carga relativa;
  - `ChipEstado` navegable (PEND/PROC/PV/VENC). No es un filtro local: navega al Tablero. Se tokeniza y se conserva.
- **Filtros:** no tiene propios; navega al Tablero con `SET_TENANT_FILTRO` y `SET_FILTRO_MIPG`.
- **Tabla:** Dependencia · Total · Estado de carga · Carga relativa · (acción).
- **Acciones:**
  - Ver → (Tablero filtrado por dependencia);
  - chip de celda → Tablero filtrado por dependencia y estado.
- **Particularidades:** el conteo del chip coincide exactamente con las filas visibles en el Tablero (test existente).

### 2.5 MI_GESTION — desempeño personal

- **DS:**
  - ✓ `SectionHeader`, `StatusBadge`, `EmptyState`;
  - △ `Indicador` para las 5 tarjetas con riel (variante estática; «Tiempo promedio» es decimal o «—», así que el valor debe aceptar texto).
- **Conservar:**
  - la barra de cumplimiento con zonas (60/85) y el marcador;
  - Atiende primero;
  - Respondidos por semana;
  - Tu semana (7 días);
  - Mis pendientes.
- **Filtros:** ninguno.
- **Tablas:** ninguna.
- **Acciones:** abrir radicado (desde Atiende primero y Mis pendientes).
- **Particularidades:**
  - privacidad: cada quien ve **solo lo suyo**, también el ADMIN;
  - hex fijos y una concatenación alfa (`'#63992255'`) por pasar a tokens y `color-mix`.

### 2.6 REPORTES — indicadores MIPG

- **DS:**
  - → `ChipFiltro` para los presets de período (ya usan `aria-pressed`);
  - △ `Indicador` para las 10 tarjetas (estáticas, con valor «—» posible);
  - → `SuperficieTabla` + `CabeceraTablaSticky` para «Por dependencia»;
  - → `PriorityBanner` para el aviso «MIPG Req. 8».
- **Conservar:**
  - el encabezado institucional de impresión y `PRINT_STYLES_REPORTE`;
  - el bloque «Correspondencia de salida»;
  - las exportaciones.
- **Filtros:**
  - preset de período (`ETIQUETA_PRESET`);
  - select de dependencia (Todas y las 15).
- **Tabla:** Dependencia · Total · Pendientes · En trámite · Resueltos · Vencidas.
- **Acciones:**
  - Imprimir / PDF;
  - Exportar Excel MIPG (histórico, 8 hojas; el servidor aplica el alcance por rol);
  - CSV técnico (lo filtrado).
- **Particularidades:**
  - la sección de salidas solo aparece con `verLibroSalidas`;
  - ⚠ el JEFE ve el select con las 15 dependencias, aunque sus datos ya vienen acotados a la suya: elegir otra muestra 0 (§4.2).

### 2.7 ANALYTICS — Centro de Inteligencia Operativa

- **DS:**
  - ✓ `SectionHeader` (vía `SeccionTitulo`);
  - → `ChipFiltro` para el período (30/60/90/180 d);
  - △ `Indicador` para los 6 KPIs (estáticos, valor con texto: «%», «d», nombre de dependencia).
- **Conservar:**
  - `BarraProgreso`, `AnilloSvg`;
  - el ranking por dependencia;
  - los tipos frecuentes;
  - las zonas (Casco urbano, Rural, Yariguíes).
- **Filtros:** período.
- **Tablas:** ninguna (ranking con barras).
- **Acciones:** cambiar el período.
- **Particularidades:** ⚠ el alcance usa `esAdmin`, así que CONTROL_INTERNO, con alcance municipal, ve la analítica **solo de su dependencia** (§4.3).

### 2.8 ALERTAS — alertas predictivas

- **DS:**
  - → `SectionHeader` en lugar del encabezado propio;
  - → `StatusBadge` para niveles y contadores;
  - → `EmptyState` para «Sin alertas activas».
- **Conservar:**
  - `TarjetaAlerta` (barra de severidad);
  - `GrupoAlertas`;
  - `contarAlertasActivas` (badge del menú).
- **Filtros:** ninguno (período fijo de 30 días).
- **Tablas:** ninguna.
- **Acciones:** Ver radicado.
- **Particularidades:**
  - ⚠ mismo alcance por `esAdmin` que Analítica: RECEPCIONISTA y CONTROL_INTERNO ven solo su dependencia, y lo mismo pasa con el badge del menú (§4.3);
  - la nota técnica visible al usuario («severityScore = … Fase 3 predictiva ready») usa lenguaje no institucional (§4.4).

### 2.9 ANTICIPACION_OPERATIVA — análisis predictivo

- **DS:**
  - △ `Indicador` para 4 KPIs estáticos;
  - → `SuperficieTabla` + `CabeceraTablaSticky` para el ranking (filas clicables).
- **Conservar:**
  - Hotspots territoriales;
  - Deriva de tendencias semánticas;
  - Auditoría predictiva (explicabilidad);
  - `orquestarReportePredictivo`.
- **Filtros:** ninguno.
- **Tabla:** Consecutivo · Asunto · Plazo hábiles · Prob. vencimiento.
- **Acciones:** seleccionar un radicado para ver la explicación. Es solo lectura: la IA sugiere, nadie decide aquí.
- **Particularidades:**
  - el envoltorio en `page.tsx` usa `bg-[var(--tema-fondo-0e0e10)]/40`, un resto del tema oscuro antiguo;
  - usa `animate-bounce` en el indicador de alza.

### 2.10 SUPERVISION_IA — gobernanza de IA

- **DS:**
  - △ `Indicador` para 4 KPIs estáticos;
  - → `SuperficieTabla` + `CabeceraTablaSticky` para los logs;
  - → `PriorityBanner` para el estado de salud y las alertas de deriva;
  - → `StatusBadge` para Gemini o Fallback.
- **Conservar:** `EstadoModuloIA`, indicadores **de solo lectura** de los feature flags (PT-7: no son interruptores, no deben parecerlo).
- **Filtros:** ninguno.
- **Tabla:** Endpoint · Latencia · Modo · Estado · Fecha / Hora.
- **Acciones:** ninguna.
- **Particularidades:**
  - emojis en el estado («🔴 IA DEGRADADA»);
  - el mismo envoltorio oscuro que Anticipación.

### 2.11 CONTROL_INTERNO — Centro de Control Interno

- **DS:**
  - ✓ `SectionHeader`;
  - △ pestañas: 6 pestañas propias; primitiva candidata, §3;
  - △ `Indicador` para el Panorama y los 8 `KpiCard` del histórico;
  - → `SuperficieTabla` + `CabeceraTablaSticky` para Alertas (8 col.), Hallazgos (8), Planes (7) y Dependencias (12);
  - → `EmptyState` en lugar del `EstadoVacio` local;
  - → `PriorityBanner` en lugar de `Aviso`.
- **Conservar:**
  - los formularios de hallazgo y de plan de mejora;
  - la leyenda del semáforo;
  - el reporte por rango de fechas;
  - `ControlInternoDashboard` (MIPG histórico, dentro de `<details>`).
- **Filtros:**
  - Alertas: dependencia y nivel;
  - Reportes: desde y hasta.
- **Acciones:**
  - Alertas: Marcar revisada, Descartar;
  - Hallazgos: Registrar hallazgo, Observar, Cerrar;
  - Planes: Crear plan, Aprobar, Marcar incumplido;
  - Reportes: Generar reporte;
  - Actualizar.
- **Particularidades:** norma del módulo: «nunca modifica respuestas oficiales ni cambia el estado de un radicado». Los dos dashboards (nuevo e histórico) se conservan.

### 2.12 APROBACIONES — flujo SIMI Jurídico (la «Jurídica» acordada)

- **DS:**
  - △ `Indicador` para 5 estadísticas estáticas;
  - → `StatusBadge` del sistema de diseño en lugar del `StatusBadge` **local homónimo**;
  - → `EmptyState`.
- **Conservar:**
  - la tarjeta de caso con historial;
  - el formulario de devolución con motivo obligatorio.
- **Filtros:**
  - estado (7 valores);
  - riesgo (bajo, medio, alto);
  - Actualizar.
- **Acciones, por estado y rol:**
  - Aprobar: JEFE en «pendiente jefe»; ADMIN en «pendiente jefe» o «pendiente jurídica»;
  - Escalar a jurídica: JEFE o ADMIN;
  - Marcar listo para envío: ADMIN;
  - Devolver con motivo;
  - CONTROL_INTERNO: solo lectura.
- **Particularidades:**
  - «Jurídica» son **estados del flujo**, no un rol ni una dependencia (decisión del propietario);
  - las reglas por estado y rol son reglas del flujo y se quedan en el componente;
  - un humano aprueba siempre (Principio 9).

### 2.13 ADMINISTRACION — usuarios internos y gobernanza SIMI

- **DS:**
  - ✓ `SectionHeader`, `StatusBadge`, `EmptyState`;
  - → `BarraTrabajo` (buscador; los 4 selects como hijos);
  - △ `SuperficieTabla` + `CabeceraTablaSticky` (la columna de casillas necesita la columna de control).
- **Conservar:**
  - `ModalCrearUsuario`, `ModalEditarUsuario`;
  - las acciones masivas;
  - `SimiGobernanzaPanel` (Normograma, Plantillas, Métricas, Pruebas E2E).
- **Filtros:**
  - búsqueda por nombre, email, cargo o dependencia;
  - tipo;
  - estado (Activos, Inactivos, Archivados);
  - rol;
  - dependencia.
- **Acciones:**
  - Nuevo usuario;
  - Editar;
  - Activar o desactivar;
  - masivas: Marcar prueba, Desactivar, Archivar.
- **Particularidades:**
  - ⚠ **brecha:** `SimiGobernanzaPanel` usa `hidden xl:flex`, así que por debajo de 1.280 px el ADMIN **no puede llegar** a Normograma, Plantillas ni Pruebas E2E (§4.5);
  - los roles CONTROL_INTERNO y JEFE en la pestaña «Métricas» del panel son inalcanzables (la vista es solo ADMIN): se documentan y se retiran en la Ola 4.

### 2.14 LICENCIAS — licencias urbanísticas (Planeación)

- **DS:**
  - △ pestañas: Bandeja y Libro consecutivo;
  - △ `Indicador` en lugar de `TarjetaKPI` (×3) y `TarjetaKpiLibro` (×4);
  - → `ChipFiltro` en lugar de `ChipFiltroLibro`;
  - → `BarraTrabajo` en lugar de `BuscadorRapidoLibro`;
  - △ `CabeceraTablaSticky` (el libro fija anchos por columna con `Th ancho`);
  - → `EmptyState`.
- **Conservar:**
  - `ChipEstadoJuridico` (semántica jurídica D.1077/2015);
  - `CabeceraExpediente`, `CabeceraTermino` (reloj legal);
  - `PanelTerminoDual`, `PanelVigilanciaTermino`, `PanelVigenciaActo`;
  - `ChecklistRequisitos`, `PanelQueSigue`, `PanelDesistimientoSemicontrolado`;
  - `EventoTimeline`;
  - los 6 modales (radicar solicitud, crear desde radicado, debida forma, actuación, prórroga, vincular radicado);
  - la impresión y el CSV del libro.
- **Filtros:**
  - Bandeja: búsqueda;
  - Libro:
    - año;
    - búsqueda;
    - chips: Todos, En trámite, Por vencer, Vencidos, Históricos incompletos, Colisiones (este último solo si es mayor que 0).
- **Tablas:**
  - Bandeja: Expediente · Solicitante · Subtipos · Estado jurídico · Vence · Creado;
  - Libro: N.° expediente · Apertura · Fecha radicación · Solicitante · Tipo · Estado · Vence · Vigencia hasta · N.° licencia.
- **Acciones:**
  - Crear desde radicado;
  - Recibir solicitud →;
  - abrir expediente;
  - Exportar CSV;
  - Imprimir;
  - en el detalle, las actuaciones que habilita `puedeTransicionar` (motor de estados): acta, respuesta, ejecutoria, prórroga, desistimiento.
- **Particularidades:**
  - **dos armazones** para el mismo contenido: la pestaña del panel y la ruta `/interno/licencias`, con `LicenciasSidebar`, `LicenciasTopBarMovil` y `GuardModuloPlaneacion`;
  - la Ola 3 unifica el armazón **conservando los deep-links** `/interno/licencias/{id}` y la impresión.

### 2.15 RADICACION — valor sin pantalla

- `VistaActual = 'RADICACION'` no se renderiza en ninguna rama; cae al Tablero.
- La radicación real son superposiciones compartidas del panel:
  - `DrawerNuevoRadicado`;
  - `RegistroExpresModal`;
  - `RegistrarSalidaModal`;
  - `PanelReparto`;
  - `BusquedaAvanzadaPanel`;
  - `ResumenDiarioModal`.
- **Ola 3:** solo coherencia de tokens en esas superposiciones; ya comparten tema.
- **Ola 4:** retirar el valor `RADICACION`, verificando antes que no se persista ni se use en deep-links. `puedeAccederVista` hoy lo deja abierto (test existente).

## 3. Ajustes aditivos a las primitivas (paso 0 de la Ola 3)

La matriz muestra patrones que las primitivas de la Ola 2 aún no cubren. Cada
ajuste es **aditivo y opcional**: el HTML del Tablero debe seguir idéntico
byte a byte. El arnés de 14 escenarios de la Ola 2 se reactiva para
comprobarlo.

| Ajuste | Lo necesitan | Motivo |
|---|---|---|
| `Indicador` estático: sin `onClick` se pinta como `<div>`, no como botón; `valor: number \| string`; `Icono` opcional | Dependencias, Mi gestión, Reportes, Analítica, Anticipación, Supervisión IA, Control Interno, Aprobaciones, Licencias | Un botón que no hace nada sería una acción falsa |
| `BarraTrabajo`: `onEnter?` y `ariaLabel?` | Ventanilla | Enter abre la coincidencia exacta |
| `CabeceraTablaSticky`: columna de control inicial (casilla) y anchos opcionales | Bandeja, Administración, Libro consecutivo | Selección masiva; anchos fijos del libro |
| `ChipFiltro`: `ariaLabel?` | Ventanilla | Conservar el nombre accesible actual |
| **Primitiva nueva `Pestanas`** (segmentadas, `role="tablist"`) | Control Interno (6), Licencias (2), Gobernanza SIMI (4) | Tres implementaciones hoy; el Tablero no la tiene (§4.6) |

## 4. Decisiones que necesito del propietario

1. **Salidas y CONTROL_INTERNO.** Ocultar «Registrar salida» cuando falta `permisos.registrarSalida`. Hoy el botón está visible y no hace nada. *Recomendado: sí* (cumple «nunca mostrar acciones no autorizadas»; no cambia permisos).
2. **Reportes y JEFE.** Ocultar el select de dependencia cuando el alcance es DEPENDENCIA (`filtrarPorDependencia = false`), como ya hace el Tablero. *Recomendado: sí.*
3. **Alcance de Analítica y Alertas.** Hoy usan `esAdmin`, así que CONTROL_INTERNO y RECEPCIONISTA ven solo su dependencia, en contra de su alcance municipal. Cambiarlo **sí cambia datos visibles** (y el badge del menú). *Recomendado:* dejarlo fuera de la Ola 3 (que es visual) y tratarlo como corrección aparte, con su propio test.
4. **Textos técnicos visibles** («severityScore… Fase 3 predictiva ready», emojis de estado). *Recomendado:* reemplazarlos por lenguaje institucional equivalente, sin quitar información.
5. **Gobernanza SIMI por debajo de 1.280 px.** Hacerla alcanzable en todos los tamaños; por ejemplo, como pestaña de Administración, que hoy la esconde. *Recomendado: sí* (hoy es funcionalidad inaccesible).
6. **Primitiva `Pestanas`.** No existe en el Tablero. ¿Se autoriza crearla a partir de las 3 implementaciones actuales? *Recomendado: sí;* la alternativa es tokenizar cada una por separado.
7. **Mover `BandejaAsignacion` y `VistaReportes` fuera de `page.tsx`** (5.711 líneas), sin cambios, antes de migrarlas. *Recomendado: sí.*

## 5. Orden propuesto

Por uso y riesgo, cada tramo verificado antes del siguiente:

| Tramo | Contenido |
|---|---|
| 0 | Ajustes aditivos (§3), con el arnés byte a byte del Tablero |
| A | Mi gestión, Alertas, Dependencias: las de más uso y menor riesgo |
| B | Ventanilla, Bandeja, Salidas: operación diaria de Recepción |
| C | Reportes, Analítica, Anticipación, Supervisión IA: lectura e indicadores |
| D | Control Interno, Aprobaciones, Administración: formularios y flujos |
| E | Licencias y armazón único: el de más superficie y con deep-links |

Verificación de cada vista:

- tests existentes en verde;
- test de render del contrato por rol (qué ve y qué no ve cada rol);
- revisión de contraste AA en claro y oscuro;
- ningún texto, conteo ni acción desaparece: se compara el inventario de acciones de esta matriz antes y después.

## 6. Estado al cierre de la sesión del 23-sep-2026

Decisiones del propietario de esta fecha: ADR-0046 §6 (tarjetas de resumen de
la referencia visual oficial y Ventanilla como centro operativo). Las
decisiones §4.1, §4.2, §4.4, §4.5, §4.6 y §4.7 se aplicaron. §4.3 quedó fuera
de la ola (ver la corrección más abajo).

### 6.1 Vistas

| Vista | Estado | Tarjetas de resumen |
|---|---|---|
| Tablero | fila de tarjetas de solo lectura entre chips y alerta; chips sin cambios | Vencidos, Por vencer, Sin asignar, Radicados, Asignados |
| Ventanilla | **centro operativo**: tarjetas que llevan a Bandeja o Tablero filtrado, más todas las herramientas de recepción, más el mostrador | Radicados hoy, Por asignar, Datos incompletos, Con errores, Por vencer |
| Bandeja, Salidas | migradas (grupo B) | — |
| Mi gestión, Dependencias | migradas (grupo A) | sí |
| Reportes, Anticipación, Supervisión IA | migradas (grupo C) | sí |
| Alertas, Analítica | migradas en esta sesión (§2.7, §2.8) | Analítica sí |
| Control Interno, Aprobaciones, Administración | migradas (grupo D); la verificación visual quedó hecha en esta sesión | sí |
| Licencias (contenido) | pestañas, tarjetas, chips y botones del sistema de diseño | Bandeja (3) y Libro (4) |
| Licencias (armazón, E2) | **hecho el 24-sep** (ver §7 y ADR-0046 §7) | — |

### 6.2 Evidencia

- Suite completa, `tsc` y `eslint` (0 errores) en verde.
- Arnés de inventario: 47 escenarios, sin acciones ni palabras perdidas,
  salvo los cambios aprobados que registra `CAMBIOS_APROBADOS`.
- Chrome sobre render controlado, sin sesión autenticada de Stage, en claro y
  oscuro, a 360, 768, 1024 y 1440 px: 372 de 376
  combinaciones sin desborde ni fallos de contraste. Las 4 restantes son
  falsos positivos: «Ver →» de Dependencias, oculto hasta el hover y visible
  con el foco del teclado.

### 6.3 Corrección a §4.3 (medida, no supuesta)

- **Analítica no está afectada.** En `useAnalytics` el alcance por `esAdmin`
  solo filtra las alertas, que Analítica no pinta. Sus indicadores usan los
  radicados que ya entrega el stream acotado por rol.
- **El contador del menú ya es municipal:** usa `veTodosTenants`.
- **Solo la vista Alertas** usa `esAdmin`. Por eso, para RECEPCIONISTA y
  CONTROL_INTERNO, el contador del menú (municipal) y la vista (solo su
  dependencia) no coinciden. La corrección cambia datos visibles; queda como
  cambio aparte, con su test (`__tests__/ola3-alertas-analitica-contexto.test.tsx`
  fija hoy el comportamiento actual).

### 6.4 Pendientes identificados al 23-sep y resolución

1. **Resuelto en §7: E2 — armazón único de Licencias.** `/interno/licencias/*` usa el mismo
   menú, la misma barra móvil y el mismo encabezado del panel, conservando los
   deep-links y la impresión del libro. Junto con esto van el buscador
   (`BuscadorRapidoLibro` a `BarraTrabajo`, que necesita `aria-controls` y un
   anuncio `aria-live`), las cabeceras de tabla y los encabezados de página
   (hoy `h1` propio, necesario mientras la ruta independiente no tenga el
   encabezado común).
2. **Resuelto en §7: cierre técnico de la ola.**
   - Quitar los `export /* TEMP-OLA3 */` de `page.tsx`: **impiden
     `next build`**, porque Next.js no admite exportaciones propias en una
     página.
   - Borrar los arneses temporales `__tests__/zz-ola3-*.test.tsx`.
   - Escribir la retrospectiva.
3. **Resuelto en §7: deuda encontrada (anterior a la ola).** La tabla del Tablero usaba
   `--tema-texto-94a3b8` como texto: 34 usos en `page.tsx`, 2,56:1 en claro,
   por debajo de AA. Pasarlos a `--tema-texto-64748b` es un cambio visible en
   el Tablero y exige renovar la línea base de equivalencia.
4. **Pendiente: Ola 4.**
   - Retirar el código muerto.
   - Evaluar retirar `Indicador` en fila fuera de los paneles colapsables.

`TarjetaKPI`, `TarjetaKpiLibro` y `ChipFiltroLibro` ya se retiraron en esta
sesión: quedaron sin uso.

## 7. Cierre de la Ola 3 (24-sep-2026)

Pedido del propietario: cerrar los pendientes técnicos y de consistencia, sin
cambios visuales nuevos.

1. **Arneses retirados.** Se quitaron los `export /* TEMP-OLA3 */` de
   `page.tsx` y se borraron `__tests__/zz-ola3-*.test.tsx`. `page.tsx` solo
   exporta `dynamic` y la página.
2. **Armazón único de Licencias:** ver ADR-0046 §7.
   - Pruebas: `__tests__/licencias-armazon-unico.test.tsx`.
   - Sustituye a `licencias-layout-scroll.test.tsx`, cuyo objeto (la cadena de
     scroll del layout propio) ya no existe.
3. **Contraste del Tablero.** Se cambiaron 44 textos en `#94A3B8` (2,56:1) por
   `#64748B`, el gris secundario de la paleta, en:
   - `page.tsx` (34);
   - `PqrsdDeadlineDashboard` (4);
   - `ResumenEjecutivoRadicado` (4);
   - `BusquedaAvanzadaPanel` (1);
   - `PriorityBanner` (1).

   Quedan en `#94A3B8` solo dos adornos que no son texto: la lupa del buscador
   y el punto de la insignia neutra. Guardián:
   `__tests__/tablero-contraste-aa.test.ts`.
4. **Contador de Alertas: corrección funcional separada.**
   - Una sola definición de alerta: `calcularAlertasPredictivas`, en
     `useAnalytics.ts`.
   - Un solo alcance: `alcanceAlertas` = `veTodosTenants`, el de la bandeja.
   - Vista y contador cuentan sobre el mismo stream.

   Cambios visibles:
   - Recepción ve en la vista las alertas del municipio, igual que su
     contador.
   - La vista ya no descarta los radicados de más de 30 días: un vencido
     antiguo aparece en la lista, como ya aparecía en el contador.

   Archivos:
   - `analytics/useAnalytics.ts`;
   - `analytics/VistaAlertas.tsx`;
   - el bloque `<VistaAlertas` de `page.tsx`;
   - pruebas en `__tests__/alertas-alcance-contador.test.tsx`;
   - ajustes en `vista-alertas-render`, `alertas-ver-radicado` y
     `ola3-alertas-analitica-contexto`.

### 7.1 Revisión cruzada (Principio 5) y correcciones

**QA: aprobado con observaciones.** Enlace directo sin sesión: el `next` del
login perdía los parámetros. Se corrigió con `lib/auth/destino-tras-login.ts`,
que usan `proxy.ts`, el layout interno y el formulario. Pruebas en
`__tests__/destino-tras-login.test.ts`.

**Seguridad: rechazado y luego aprobado.** El primer helper validaba el texto
crudo y permitía salir del panel con `..`. Ahora valida la URL resuelta. Se
verificó con 20 036 entradas aleatorias sin ninguna violación.

**UX/UI: aprobado con observaciones.**

Corregido:
- H1: aviso del vigía en oscuro;
- H2: desborde a 360 px en Anticipación y Supervisión IA;
- H3: campana de la barra móvil;
- H4: contraste del detalle de Licencias;
- H5: gris secundario sobre tintes (ADR-0044 §6);
- H6: armazón común;
- H7: solicitante del Libro;
- H8: dirección canónica sin permiso;
- H9: h1 en la barra móvil;
- H12: tonos -600 a -700.

Límite conocido: el checklist del detalle a 768 px parte dos palabras largas.
Resolverlo es decidir el diseño de esa tabla en tableta.

Para después, sin cambios en este cierre:
- H10: tamaño del h2 del expediente frente al h1;
- H11: insignias claras de Licencias en oscuro;
- H13: «Ver →» visible solo al pasar el cursor;
- números de expediente y de radicado partidos por los guiones;
- `tabpanel` en las pestañas del expediente.

**Verificación en la app real con sesión: pendiente.** `LAB_PASSWORD` no existe
en `.env.stage`. Las revisiones usaron el render completo de `page.tsx` en
Chrome y comprobaciones sin sesión contra el servidor de stage.
