# ADR-0046 — Sistema visual base y contenido por contexto de usuario

- **Estado:** ACEPTADO — Olas 1–3 implementadas; Ola 4 y la validación autenticada en Stage están pendientes.
- **Fecha:** 23-sep-2026.
- **Inventario de soporte:** `docs/SISTEMA_VISUAL.md`.
- **Relacionado:** ADR-0032 (sistema de diseño interno), ADR-0043/0044/0045.

## 1. Contexto

El propietario pide que el Tablero rediseñado sea el **sistema visual de toda
la plataforma**: mismo lenguaje en todas las vistas y roles, con contenido que
se adapta a `rol + dependencia + permisos + vista`, sin interfaces paralelas
por dependencia y sin cambiar lógica de negocio.

El inventario muestra que el lenguaje visual ya es común en paleta, tema y
encabezado (ADR-0044/0045), pero la **implementación está duplicada**:
- 11 tarjetas de indicador;
- 4 chips de filtro;
- 4 chips de estado;
- 2 menús laterales;
- 9 buscadores propios.

Además, la lógica de permisos de interfaz está repartida en funciones locales
de un `page.tsx` de 5.711 líneas.

## 2. Decisión

1. **Un contexto, calculado una vez.** `lib/permisos/contexto-interno.ts`
   exporta `construirContextoInterno(usuario)`, una función pura que devuelve
   rol, dependencia, alcance (`MUNICIPAL` | `DEPENDENCIA`), permisos de acción
   y vistas permitidas. Reúne las funciones `puede*` que hoy están dispersas,
   con **la misma lógica**. Una matriz de tests rol × vista × acción fija que
   el resultado es idéntico al actual.
2. **Un armazón.** `SidebarNav` + `EncabezadoPantalla` + `MobileTopBar`,
   alimentados por el contexto del dashboard. Licencias vive en ese mismo
   armazón; sus rutas legacy redirigen a la dirección canónica y se retiraron
   `LicenciasSidebar`/`LicenciasTopBarMovil`.
3. **Primitivas compartidas** en `app/components/design-system/`, extraídas
   del Tablero: `SectionHeader`, `PanelIndicadoresColapsable`, `Pestanas`,
   `PanelPestana`, `Indicador`, `TarjetaIndicador`, `FilaTarjetas`,
   `ChipFiltro`, `BarraTrabajo`, `SuperficieTabla`, `CabeceraTablaSticky`,
   `PriorityBanner`, `StatusBadge`, `EmptyState`, `BotonAccion` y `BotonTema`.
4. **Los módulos conservan su dominio**: columnas, detalle, reloj legal,
   checklist, documentos oficiales y gráficas. Solo dejan de reimplementar las
   primitivas.
5. **La interfaz nunca es la barrera de seguridad.** Ocultar acciones sin
   permiso es obligatorio, pero la autorización sigue en las reglas de
   Firestore y en las API. Ningún permiso nuevo se decide en el cliente.

## 3. Plan progresivo (cada ola se puede publicar sola)

| Ola | Alcance | Cambio visible | Estado |
|---|---|---|---|
| 1 | `construirContextoInterno` + matriz de tests; `page.tsx`, el menú y el guard de Licencias lo consumen | ninguno | **hecha** |
| 2 | Primitivas extraídas del Tablero (`Indicador`, `ChipFiltro`, `PanelIndicadoresColapsable`, `BarraTrabajo`, `SuperficieTabla`/`CabeceraTablaSticky`); el Tablero las consume | ninguno (HTML idéntico byte a byte en 14 escenarios) | **hecha** |
| 3 | Migración de las demás vistas a las primitivas, en orden de uso: Mi gestión, Alertas, Licencias → Ventanilla, Bandeja, Salidas → Control Interno, Analítica, Supervisión IA, Anticipación → Administración, Reportes, Dependencias, Aprobaciones. Incluye el armazón único (menú y barra móvil también en Licencias) | cada vista adopta la jerarquía del Tablero | **implementación cerrada el 24-sep**; falta aceptación autenticada en Stage. Estado detallado en `docs/MATRIZ_MIGRACION_OLA3.md` §7 |
| 4 | Retirar código muerto (`TarjetaMIPGGrande`, `MetricsSummary`, `CollapsibleSection`, `SearchToolbar`) y los duplicados sustituidos | ninguno | pendiente |

Regla de cada ola: sin cambios de lógica, contadores ni filtros; tests
existentes en verde; revisión visual con al menos un usuario de cada rol
afectado. La Ola 3 tiene cierre técnico, pero no aceptación operativa hasta
completar esa revisión autenticada en Stage.

## 4. Consecuencias

- **Positivas:**
  - un cambio de estilo se hace en un solo lugar;
  - una dependencia o un rol nuevo solo añade datos al contexto, no pantallas;
  - `page.tsx` se reduce;
  - los permisos de interfaz quedan en un solo lugar con tests.
- **Costo:** las olas 3 y 4 tocan muchas vistas. Por eso van por olas y no de
  golpe.

## 5. Decisiones del propietario (23-sep-2026)

1. **Jurídica = vista del flujo actual.** Es una vista o filtro de los
   radicados en revisión jurídica dentro del flujo SIMI existente. No se crean
   dependencia ni rol nuevos.
2. **FUNCIONARIO arranca como hoy:** toda su dependencia, con el chip «Solo
   los míos». No cambia el comportamiento por defecto.

## 6. Decisiones del propietario (23-sep-2026, segunda ronda)

El propietario entrega una **imagen de referencia visual oficial** (la
Bandeja de trámites de Planeación) para toda la plataforma. Frente al Tablero
de ese momento, la imagen añade una fila de tarjetas grandes (Vencidos, Por
vencer, Sin asignar, Radicados, Asignados) que ADR-0044 había sustituido por
chips. Se le preguntó y decidió:

3. **Tarjetas de resumen, compactas y de solo lectura.** Se adoptan las
   tarjetas de la imagen, con altura moderada para priorizar la tabla. Las
   tarjetas **muestran** el estado y los chips **filtran**: ninguna tarjeta
   filtra ni lleva `aria-pressed`. Los chips y sus acciones no cambian. El
   patrón se aplica donde esos indicadores son el resumen de la vista.
   - Primitiva nueva `TarjetaIndicador` + `FilaTarjetas`
     (`app/components/design-system/TarjetaIndicador.tsx`), con los tonos de
     `Indicador`. Con `onAbrir` es un botón que **lleva** a la vista donde se
     gestiona ese estado (sin filtrar en sitio).
   - En el Tablero la fila usa la misma fuente que los chips
     (`construirIndicadoresTablero`), así que las cifras coinciden. «Minimizar
     paneles» y el detalle abierto la ocultan. Se mantienen los tonos
     semánticos existentes (Radicados gris, Sin asignar ámbar): «color =
     estado», no el verde y el naranja de la imagen.
   - Enmienda la jerarquía de ADR-0044 §3 (ver su §5).
4. **Ventanilla es el centro operativo de la recepción.** La vista Ventanilla
   reúne, sin flujos nuevos:
   - el estado de la operación en tarjetas (Radicados hoy, Por asignar, Datos
     incompletos, Con errores, Por vencer). Cada cifra sale del mismo filtro
     que el Tablero aplica al llegar, y la tarjeta lleva ahí (o a la Bandeja);
   - todas sus herramientas (Libro de salidas, Reparto del día, Registrar
     salida, Nueva radicación, Búsqueda avanzada), cada una con su permiso;
   - el mostrador de siempre (búsqueda y Trabajo de hoy).

## 7. Armazón único de Licencias (24-sep-2026, cierre de la Ola 3)

**Decisión.** Licencias vive solo dentro del panel interno, con el mismo menú,
encabezado, barra móvil y selector de tema que el resto. Se retiran
`LicenciasSidebar` y `LicenciasTopBarMovil`.

**Dirección canónica.**
`/interno/dashboard?vista=licencias[&expediente={id}|&seccion=libro]`.

- Única fuente: `app/interno/licencias/rutas-licencias.ts` (`urlLicencias`,
  `leerDestinoLicencias`).
- La vista se deriva de la dirección, y navegar escribe en ella: los enlaces
  directos, la recarga y atrás/adelante funcionan. Entrar desde el menú
  escribe la dirección; salir hacia otra vista la limpia (con `replace`).

**Enlaces que ya existían.** `/interno/licencias`, `/interno/licencias/{id}`
y `/interno/licencias/libro-consecutivo` siguen funcionando: redirigen con
`replace` a la dirección canónica. El layout del módulo conserva
`GuardModuloPlaneacion`, así que quien no tiene acceso ve la tarjeta de acceso
restringido, como antes. Los enlaces internos (chip del expediente vinculado,
modales de creación, panel del libro) apuntan ya a la dirección canónica y no
recargan el panel.

**Impresión.** Mientras Licencias está montada (clase `licencias-impresion`),
las reglas de `globals.css` §5 quitan del papel el armazón de pantalla
(`data-armazon="pantalla"`) y dejan fluir la cadena de contenedores del panel
en varias hojas. Van acotadas con `:has()`: Reportes, constancias y sellos
imprimen una hoja con su propio mecanismo, y soltar su cadena les añadiría
hojas en blanco.

**Enlaces directos a través del login.** Quien abre sin sesión una dirección
con parámetros (`?vista=licencias&expediente=…`, `?radicadoId=…`) vuelve
exactamente ahí después de iniciar sesión. `proxy.ts` y el layout interno
guardan ruta y parámetros en `next`. Con sesión, el login respeta ese `next`
en vez de ir siempre al Tablero.

La validación es única, `lib/auth/destino-tras-login.ts`:
- trabaja sobre la URL ya resuelta (`..`, `%2e%2e`, `\`);
- solo admite destinos de `/interno/` que no sean la página de login.

La revisión de seguridad lo aprobó después de corregir una redirección abierta
por segmentos `..`.

**Sin permiso.** La dirección canónica no monta Licencias ni un instante para
quien no tiene acceso: se limpia la dirección y no se piden sus datos.

**Encabezado.** El título de pantalla (h1 «Licencias») es el del encabezado
común. La Bandeja y el Libro usan el subencabezado del panel
(`SectionHeader`), con los mismos textos y acciones. La cabecera del
expediente pasa a h2, con el mismo aspecto.

## 8. Decisiones del propietario para la vista Ventanilla (24-sep-2026)

El propietario entregó un diseño de «Ventanilla · Recepción». Decidió:

1. **Se aplica después de cerrar la Ola 3**, como paso aparte.
2. **La vista Ventanilla es la bandeja completa**: municipal, con tabla, chips
   y tarjetas del Tablero, y las herramientas de recepción en su encabezado.
   Sustituye al mostrador como contenido principal de la vista.
3. **Sin elementos nuevos.** No hay paginación, buscador en la barra
   superior, avatar ni alerta agregada. Se mantienen el scroll continuo, la
   búsqueda propia de la vista, el usuario en el menú y la alerta contextual
   existente. Se prioriza el espacio de los radicados y se evita duplicar
   controles o información.
4. **El mostrador («Trabajo de hoy») se conserva** como panel colapsable
   bajo la tabla.
