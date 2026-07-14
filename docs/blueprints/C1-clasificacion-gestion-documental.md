# Blueprint Arquitectónico — C1 · Clasificación y Gestión Documental

**Estado:** EN REVISIÓN → (ver §24 y Definition of Ready). **No autoriza
implementación** (ADR-0023). Rige la gobernanza vigente (ADR-0001, 0014–0023).

- **Capacidad / dominio:** C1 (D2) — ficha en
  [`PLAN_MAESTRO_EVOLUCION.md`](../PLAN_MAESTRO_EVOLUCION.md).
- **Iniciativas BM-\*:** BM-B02 (serie/subserie en el radicado), BM-B32 (completar
  retención/disposición), BM-B11 (reclasificación Hacienda), BM-B01 (formato — solo
  dependencia, no alcance de C1).
- **Versión / revisión:** v1 — 2026-07-14 — primer Blueprint, fundamentado en
  evidencia de código.

> **Método (exigido por el propietario):** cada decisión cita evidencia del repo.
> Se cuestiona toda decisión previa; no se conserva nada por inercia.

---

## A. Arquitectura funcional y de dominio

### 1. Arquitectura funcional detallada
La capacidad garantiza que **todo radicado, por cualquier canal, nazca clasificado
en su serie/subserie TRD y con su ciclo vital** (retención en archivo de gestión y
central + disposición final), y que pueda **reclasificarse** con trazabilidad.

Funcionalmente, tres sub-funciones:
1. **Clasificar al nacer:** al persistir un radicado se le estampa la *foto de
   serie* (`{codigo, nombre, fuente}`) derivada de `tipoSolicitud × oficinaDestino`.
2. **Completar ciclo vital:** el catálogo aporta retención/disposición por serie;
   se completan las 4 series que hoy no las tienen (BM-B32).
3. **Reclasificar:** cambiar la serie (o el tipo que la determina) deja evento
   auditable, sin reescribir la foto histórica de eventos previos.

**Evidencia del estado actual:**
- Catálogo con serie/subserie/retención/disposición ya tipado:
  `lib/catalogos/series-documentales.ts:47` (`SerieDocumentalDef`) y `:60`
  (`SERIES_VENTANILLA`).
- Derivación determinista: `sugerirSerieDocumental(tipo, destino)`
  (`series-documentales.ts:124`) — **función pura, server-safe**.
- Foto inmutable en el radicado: `src/types/ventanilla.ts:232` (`serieDocumental?`).
- **Brecha:** la foto se estampa **solo** en el flujo cliente de ventanilla
  (`lib/actions/radicarVentanilla.ts:303`); **ninguna ruta API la estampa**
  (grep en `app/api` → 0 coincidencias de `serieDocumental`).

### 2. Arquitectura lógica
- **Catálogo (dominio puro):** `lib/catalogos/series-documentales.ts` — sin IO;
  fuente de verdad de series/retención/disposición y de la derivación.
- **Asignación (dominio puro, reutiliza el catálogo):** `sugerirSerieDocumental` —
  única función que decide la serie. **Se invoca desde el servidor** en cada punto
  de persistencia (hoy solo desde el cliente).
- **Persistencia (por canal):** rutas API y acción cliente que crean el radicado.
- **Reclasificación (servicio):** ruta `app/api/radicados/[id]/reclasificar` (ya
  existe para tipo/dependencia; se extiende a serie).
- **Trazabilidad (transversal, D9):** eventos `CLASIFICACION_IA`/`RECLASIFICACION`
  ya definidos en `src/types/radicado.ts` (`AccionAuditoria`).

### 3. Límites del dominio (bounded context)
- **Dentro de C1:** clasificación **documental** (serie/subserie), ciclo vital
  (retención/disposición), reclasificación de serie, catálogo TRD de las series que
  **produce la ventanilla**.
- **Fuera de C1:**
  - **Enrutamiento a dependencia** (qué oficina resuelve) → pertenece a D1/D3;
    C1 solo *consume* el destino como entrada de la derivación de serie.
  - **Administrar el archivo central completo** de la entidad (~56 series/9
    dependencias) → NO es alcance; la ventanilla solo clasifica lo que produce
    (decisión validada; ADR-0019 no-imitación).
  - **Numeración legal / formato de radicado** (BM-B01) → D9.

### 4. Entidades y agregados
- **Agregado raíz:** `Radicado` (colección `ventanilla_radicados`). C1 no crea
  agregados nuevos; añade/gobierna un **objeto de valor**.
- **Objeto de valor (inmutable):** `SerieDocumental = {codigo, nombre, fuente}`
  — la *foto* estampada al nacer (`ventanilla.ts:232`). Invariante: **no se
  reescribe** cuando cambia la TRD.
- **Entidad de catálogo:** `SerieDocumentalDef {cs, sub?, nombre,
  retencionGestionAnios?, retencionCentralAnios?, disposicionFinal?}`
  (`series-documentales.ts:47`). Fuente: TRD versionada (`FUENTE_TRD`).
- **Mapa de derivación:** `SERIE_POR_TIPO` (`series-documentales.ts:89`) y
  `CODIGO_TRD_DEPENDENCIA` (`:29`).

### 5. Eventos de negocio
- **`RadicadoClasificado`** (implícito en el evento `RADICACION`): el radicado nace
  con `serieDocumental`. Hoy no hay evento separado; se estampa dentro de la
  clasificación inicial.
- **`RadicadoReclasificado`**: al cambiar serie/tipo → `AccionAuditoria`
  `RECLASIFICACION` / `TIPO_SOLICITUD_RECLASIFICADO` (ya existen,
  `radicado.ts`). Consumidores: timeline (`TimelineAuditoria.tsx`), MIPG
  (`reportes-mipg/excel.ts`).
- **`SerieCatalogoActualizado`** (operativo, no en runtime): al aprobarse la TRD se
  actualiza `FUENTE_TRD` + entradas; los radicados históricos no cambian.

### 6. Reglas de negocio
1. **Serie = f(tipoSolicitud, oficinaDestino)** — determinista; ausencia de mapa ⇒
   "se clasifica en archivo" (`sugerirSerieDocumental` devuelve `null`).
2. **Foto inmutable:** una vez estampada, `serieDocumental` no se reescribe por
   cambios de catálogo (solo por reclasificación explícita y auditada).
3. **Retención/disposición provienen de la TRD**, nunca se inventan (BM-B32 las
   completa desde la TRD).
4. **Cobertura universal:** la regla aplica en **todos** los canales de entrada, no
   solo ventanilla (corrige la brecha actual).
5. **Reclasificar deja huella** (trazabilidad D9) y requiere decisión humana.
6. **Aislamiento por `tenantId`** se mantiene (invariante de producto).

### 7. Flujos principales y alternos
**Principal — clasificar al nacer (cualquier canal):**
1. Se arma el radicado (asunto, tipo, destino).
2. Al persistir, el servidor invoca `sugerirSerieDocumental(tipo, destino)`.
3. Si devuelve serie → se estampa `serieDocumental`; si `null` → se marca "se
   clasifica en archivo" (sin serie).
4. Se emite el evento de radicación con la nota de clasificación.

**Alterno A — tipo sin serie de ventanilla:** `serieDocumental = null`; el radicado
es válido (correspondencia informativa). Sin bloqueo.
**Alterno B — reclasificación:** funcionario cambia tipo/serie → ruta reclasificar
→ nueva foto + evento `RECLASIFICACION`; la histórica queda en la traza.
**Alterno C — TRD aprobada:** se actualiza el catálogo; nuevos radicados usan la
nueva `FUENTE_TRD`; históricos intactos.

## B. Contratos e interfaces

### 8. Actores
- **Funcionario de recepción/ventanilla** (clasifica al radicar; puede reclasificar).
- **Archivista** (valida retención/disposición del catálogo — proceso, no runtime).
- **SIMI** (opcional, sugiere; ver §15). **Ciudadano** (indirecto).
- **Sistema** (rutas API que persisten radicados por canal).

### 9. Permisos
- Estampar serie al nacer: cualquier canal autorizado a radicar (no añade permiso
  nuevo; ocurre en la persistencia existente).
- Reclasificar: rol con permiso sobre el radicado de su `tenantId` (reutiliza el
  control de `reclasificar/route.ts` y `lib/permisos`).
- Editar el catálogo TRD: administrativo (fuera de runtime; cambio de código +
  deploy, como hoy).

### 10. APIs
- **Reutiliza** `app/api/radicados/[radicadoId]/reclasificar/route.ts` (extiende su
  payload para incluir serie, o deriva la serie del nuevo tipo/destino
  automáticamente — preferido: derivar, para no duplicar la regla).
- **No requiere endpoint nuevo** para clasificar al nacer: se integra en las rutas
  de creación existentes (`app/api/radicacion`, `dependencias/registro-expres`,
  etc.) llamando a la función pura.
- Contrato de la derivación (ya existe): `sugerirSerieDocumental(tipo, destino) →
  {codigo, nombre, fuente} | null`. Idempotente y sin efectos.

### 11. Integraciones
- **Internas:** D1 (radicación, provee tipo/destino), D3 (competencia usa el
  destino), D9 (trazabilidad).
- **Externas:** ninguna. Futuro (D10): interoperabilidad SGDEA exportaría la serie
  ya estampada.

### 12. Modelo de datos
- **Sin colección nueva.** Se usa `serieDocumental` en `ventanilla_radicados`
  (`ventanilla.ts:232`) — ya existe.
- **Completar catálogo (BM-B32):** añadir `retencionGestionAnios`,
  `retencionCentralAnios`, `disposicionFinal` a las 4 series que hoy no las tienen
  (`LICENCIA_CONSTRUCCION`, `LICENCIA_SUBDIVISION`, `PROCESO_VERBAL_ABREVIADO`,
  `DECLARACIONES_TRIBUTARIAS`) con valores extraídos de la TRD.
- **Índices:** ninguno nuevo requerido (la serie es lectura por documento, no filtro
  masivo hoy; si se pide "bandeja por serie", se evaluará un índice en su Blueprint).
- **Homogeneización:** hoy dos modelos conviven (`src/types/radicado.ts` con
  `ClasificacionIA`; `src/types/ventanilla.ts` con `clasificacion.serieDocumental`).
  C1 **no** unifica los modelos (fuera de alcance; ver §24 y riesgo R3); solo
  asegura que **ambos** caminos de creación estampen la serie.

## C. Reutilización vs. construcción

### 13. Reutilización de componentes existentes
- `lib/catalogos/series-documentales.ts` — catálogo + `sugerirSerieDocumental`
  (**el corazón ya existe**).
- `lib/recepcion/clasificacion-inicial.ts` — punto donde se compone la clasificación
  al nacer (`construirClasificacionInicial`).
- `app/api/radicados/[radicadoId]/reclasificar/route.ts` — patrón de reclasificación.
- `lib/permisos`, `lib/trazabilidad`, `AccionAuditoria` — permisos y huella.
- UI: `RadicacionFuncionarioForm.tsx:214` y `labelSerieDocumental` — ya muestran la
  serie; se reutiliza el label en las demás vistas.

### 14. Componentes nuevos (solo si son estrictamente necesarios)
- **Ninguno mayor.** Único elemento nuevo: un **punto de invocación server-side
  compartido** que llame a `sugerirSerieDocumental` en cada ruta de creación que hoy
  no lo hace. Puede ser una línea en cada ruta o un helper delgado
  `estamparSerieAlCrear(datos)` que envuelva la función pura. **Justificación:** hoy
  la regla vive solo en el cliente de ventanilla; centralizar su invocación evita
  divergencia entre canales. No es un módulo nuevo: es cableado de lógica existente.

## D. Impactos transversales

### 15. Impacto sobre SIMI
- **Decisión de diseño (revisión crítica):** la serie se mantiene **determinista**
  (tipo×destino). El clasificador IA existente (`lib/ai/prompts/classifier.ts`)
  clasifica **dependencia**, no serie, y para las ~6 series de ventanilla una regla
  explícita es más simple, auditable y barata que un modelo. **No se añade IA a la
  serie ahora.**
- SIMI **puede** (opcional, futuro) proponer el *tipo* cuando el ciudadano no lo
  precisa; como el tipo alimenta la serie, la mejora llega sin tocar C1. Invariante:
  IA sugiere, funcionario decide (Principio 9).

### 16. Impacto sobre seguridad
- Nulo en superficie: no expone endpoints nuevos ni datos personales adicionales.
  Reclasificar respeta permisos por `tenantId` (control existente).

### 17. Impacto sobre auditoría
- Refuerza auditoría: cada radicado queda con serie trazable; reclasificaciones
  emiten `RECLASIFICACION`. Mejora la evidencia MIPG (la serie ya aparece en
  `reportes-mipg/excel.ts`).

### 18. Impacto sobre rendimiento
- Despreciable: `sugerirSerieDocumental` es O(1) en memoria (lookup en objetos
  const). Sin consultas adicionales a Firestore. Sin índices nuevos.

### 19. Impacto sobre mantenibilidad
- **Mejora neta:** una sola fuente de verdad (el catálogo) invocada desde todos los
  canales elimina la divergencia actual (regla presente solo en el cliente). Menos
  ramas de comportamiento por canal.

## E. Ejecución

### 20. Riesgos
- **R1 — TRD en borrador.** Mitigación: `FUENTE_TRD` versionada ya prevista;
  actualizar catálogo al aprobarse; foto inmutable protege históricos. *(Bajo.)*
- **R2 — Valores de retención mal transcritos (BM-B32).** Mitigación: extraer de la
  TRD y **validación archivística** antes de dar por buena la carga. *(Medio.)*
- **R3 — Modelo dual `radicado.ts`/`ventanilla.ts`.** Riesgo de estampar en un
  camino y no en otro. Mitigación: inventariar **todas** las rutas de creación y
  cubrirlas; test que falle si un canal crea sin intentar clasificar. *(Medio.)*
- **R4 — Tipos sin serie que sí deberían tenerla.** Mitigación: revisar
  `SERIE_POR_TIPO` con la funcionaria/archivo. *(Bajo.)*

### 21. Estrategia de migración
- **Radicados históricos sin `serieDocumental`:** NO se reescriben (foto inmutable);
  se deja `null` = "se clasifica en archivo". Opcional (futuro, su propio Blueprint):
  un backfill *read-only-first* que proponga serie a históricos y la aplique solo con
  validación humana. **No** es requisito de C1.
- **Catálogo (BM-B32):** cambio de código + deploy; sin migración de datos.

### 22. Estrategia de pruebas
- **Unitarias:** `sugerirSerieDocumental` (casos tipo×destino, `null`, sub-serie);
  completar casos para las 4 series de BM-B32. (Ya hay base de tests del catálogo.)
- **Integración (por canal):** cada ruta de creación estampa serie cuando aplica —
  **test que recorra todas las rutas de creación** y falle si alguna omite la
  clasificación (cubre R3).
- **Regresión probada por mutación** (ADR-0015): revertir la invocación en un canal
  debe poner el test en rojo.
- **Reclasificación:** cambiar tipo/serie emite evento y actualiza foto sin borrar
  la traza previa.

### 23. Estrategia de despliegue
- **Flag** `clasificacion_universal` para activar el estampado en las rutas API sin
  afectar el flujo de ventanilla (que ya lo hace).
- **Rollout** gradual por canal; **rollback** = desactivar flag (los radicados
  siguen naciendo válidos, solo sin serie, como hoy).
- **Observabilidad:** contador de radicados creados con/ sin serie por canal
  (detecta canales no cubiertos en producción).

## F. Análisis crítico obligatorio (ADR-0023 §3)

1. **¿Qué simplificamos?** Un solo mecanismo de clasificación (la función pura
   existente) invocado en todos los canales, en lugar de una regla que hoy vive solo
   en el cliente de ventanilla.
2. **¿Qué eliminamos?** La divergencia por canal (radicados que nacen sin serie
   según por dónde entren). No se elimina código; se elimina *inconsistencia*.
3. **¿Qué consolidamos?** La derivación de serie en una única fuente de verdad
   (`series-documentales.ts`) usada por creación y reclasificación.
4. **¿Qué reutilizamos?** Prácticamente todo: catálogo, función de derivación,
   punto de clasificación inicial, ruta de reclasificación, trazabilidad, label de
   UI. **Componente nuevo: solo el cableado server-side.**
5. **¿Qué evitamos construir?** IA para la serie (innecesaria para ~6 series);
   colección nueva; modelo de datos nuevo; endpoint nuevo; backfill obligatorio de
   históricos; y el archivo central completo de la entidad.
6. **¿Existe una alternativa aún más simple?** Sí se evaluó: (a) estampar en cada
   ruta con una línea vs. (b) un helper `estamparSerieAlCrear`. Se prefiere (b) por
   un único punto de verdad, pero es **una envoltura mínima**, no un módulo. No se
   encontró alternativa más simple que siga cubriendo todos los canales.
7. **¿Qué ocurrirá en 5 años si esto permanece?** El catálogo será el único lugar a
   tocar cuando cambie la TRD; la foto inmutable garantiza históricos coherentes; la
   clasificación determinista seguirá siendo auditable y barata. Si algún día se
   necesitara clasificación semántica de serie, se conecta SIMI *detrás de la misma
   función* sin cambiar los llamadores. **La decisión envejece bien.**

### 24. Veredicto del análisis crítico
- [x] **Sin oportunidad de mayor simplificación estructural** en el alcance de C1:
  la solución es "invocar lo que ya existe en todos los canales + completar datos".
- [ ] *Nota de mejora fuera de alcance (no bloquea C1, no se conserva por inercia):*
  el modelo dual `radicado.ts`/`ventanilla.ts` y el nombre `clasificacionIA` (que
  hoy guarda datos deterministas, no IA) son **deuda real**. **Propuesta:**
  documentarlos como candidatos a un ADR de unificación de modelo cuando se aborde
  D9/D3; **no** se tocan en C1 (su coste supera el valor dentro de esta capacidad —
  Valor Neto). Trazabilidad: registrar en BACKLOG (nueva deuda técnica) y referenciar
  aquí.

*Resultado: el bucle de re-revisión **no se dispara** para el alcance de C1. Las
mejoras detectadas se derivan como deuda trazable, no se arrastran por inercia.*

## G. Definition of Ready (ADR-0023 §5) — no es autorización

- [x] Blueprint completo (todas las secciones).
- [x] **Cuatro Preguntas (ADR-0021):** (1) problema real: clasificación parcial por
  canal, evidenciada — sí · (2) mejor solución: reutilizar la función pura en todos
  los canales, sin IA ni módulos — sí · (3) valor>complejidad: reutiliza casi todo,
  complejidad mínima — sí · (4) largo plazo: única fuente de verdad, envejece bien —
  sí.
- [x] **Valor Neto (ADR-0020):** Alto (cumplimiento SGDEA + consistencia) con
  complejidad casi nula. Favorable.
- [x] **Análisis crítico** superado sin disparar el bucle; mejoras derivadas como
  deuda trazable.

**C1 queda como CANDIDATA a implementación.** La implementación requiere
**autorización expresa** del propietario y la **liberación del Bloque 2** (cierre de
H3 con CI + barrida y validación de la funcionaria). Este Blueprint **no** autoriza
código.

## H. Hallazgos Arquitectónicos Transversales (OAT)

Detectada durante este análisis (registro canónico en
[`../OAT_REGISTRO.md`](../OAT_REGISTRO.md)). **No autoriza cambios.**

| OAT | Título | Prioridad | Momento recomendado |
|---|---|---|---|
| [OAT-01](../OAT_REGISTRO.md#oat-01) | Unificar el modelo del radicado (dual `radicado.ts`/`ventanilla.ts` + `clasificacionIA` con datos deterministas) | Media | Al abordar D9/D3 |

*(Registrada además como deuda BM-D11; C1 no la aborda por Valor Neto — su coste
supera el valor dentro de esta capacidad.)*
