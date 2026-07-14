# Registro de Oportunidades Arquitectónicas Transversales (OAT)

**Rol:** Chief Software Architect. **Estado:** diseño/visión — **ninguna OAT
autoriza cambios.** Propósito: construir la visión arquitectónica de largo plazo y
evitar que decisiones locales limiten la evolución global. Las OAT se **detectan
durante los Blueprints** y se registran aquí de forma canónica; cada Blueprint las
enlaza en su sección "Hallazgos Arquitectónicos Transversales".

**Esquema por OAT:** problema · evidencia en código · impacto en la plataforma ·
capacidades afectadas · beneficios · riesgos · complejidad · prioridad · momento
recomendado · relación con ADR/BM.

**Regla:** una OAT no se implementa dentro del Blueprint que la detecta; se aborda
en su propio momento, con su propio diseño y autorización, respetando la gobernanza
(ADR-0001, 0014–0023).

| OAT | Título | Prioridad | Origen | Momento |
|---|---|---|---|---|
| [OAT-01](#oat-01) | Unificar el modelo del radicado (dual + `clasificacionIA` deshonesto) | Media | C1 | Al abordar D9/D3 |
| [OAT-02](#oat-02) | Consolidar los dos tracks de salida en un agregado "Comunicación" | Alta | C2 | Tras C2 en producción |
| [OAT-03](#oat-03) | Unificar el vocabulario de "canal de envío" | Media-Baja | C2 | Junto con OAT-02 |
| [OAT-04](#oat-04) | Unificar la fuente de verdad de la TRD (código subset ↔ dato del Archivo) | Media | C11 | Después de C11-Nivel 1 |
| [OAT-05](#oat-05) | Centralizar la definición de "estados activos" (≥3 copias del set) | Media | BM-B33 | Antes/junto a BM-B33 |

---

## OAT-01
**Unificar el modelo del radicado (dual + campo `clasificacionIA` con datos deterministas)**

- **Problema:** conviven dos modelos del radicado y un campo mal nombrado que induce
  a error de diseño.
- **Evidencia:** `src/types/radicado.ts` define `ClasificacionIA` (usada por el
  camino admin/ciudadano); `src/types/ventanilla.ts` define
  `clasificacion.serieDocumental` (camino ventanilla). El campo `clasificacionIA`
  guarda datos **deterministas/manuales** (ver `sugerirDependencia`, "SIN IA,
  decisión aprobada", `lib/recepcion/sugerir-dependencia.ts:8`), no salida de IA.
- **Impacto:** riesgo de estampar campos en un camino y no en otro (ver Blueprint C1
  §12/R3); confusión conceptual; frena la evolución de clasificación y trámite.
- **Capacidades afectadas:** C1 (D2), C3 (D3), C4 (D1), C9 (D9).
- **Beneficios:** una sola forma canónica del radicado; menos ramas por canal;
  nombres honestos; base limpia para D9.
- **Riesgos:** refactor de un tipo central usado en muchos sitios; migración de
  lectura de históricos.
- **Complejidad:** M-L. **Prioridad:** Media.
- **Momento recomendado:** al abordar D9/D3 (no dentro de C1).
- **Relación:** BM-D11; candidato a ADR de unificación de modelo. Detectada en
  Blueprint C1 §24.
- **Actualización (implementación C1, 2026-07-14):** se confirmó que
  `lib/radicacion.ts` (builder del modelo `clasificacionIA`) **no está importado en
  ningún módulo** (`grep` de imports → 0) → **código muerto probable**. Por eso C1
  no lo sella. Candidato a eliminación dentro de esta OAT (verificar que ninguna
  regla de Firestore ni carga dinámica dependa de él antes de borrar).

## OAT-02
**Consolidar los dos "tracks de salida" en un único agregado de dominio "Comunicación"**

- **Problema:** dos subsistemas distintos describen el mismo hecho del mundo real
  —"documento firmado que sale, amarrado a un radicado, por un canal"—: el flujo de
  **respuesta al ciudadano** (IA→aprobación→firma→envío) y el **libro de salidas**
  (oficios). Además, las **comunicaciones internas** (BM-B20) serían un tercer
  camino de la misma forma.
- **Evidencia:**
  - Track ciudadano: `simi_aprobaciones_respuesta` (`src/types/simi-approval.ts`,
    `ApprovalFlow`: borrador→revisión jefe/jurídica→aprobado→listo→enviado) +
    `simi_respuestas_firma` (`src/types/simi-firma.ts`, `RespuestaFirma`:
    pendiente_firma→firmado→enviado_ciudadano→notificado→cerrado, con hash, PDF,
    firma digital, canal).
  - Track oficios: `ventanilla_salidas` (`src/types/salida.ts`, `SalidaOficial`:
    consecutivo H3, `RESPUESTA`/`OFICIO_INDEPENDIENTE`, firmante, medioEnvío, PDF).
  - Numeración ya unificada en H3 (`lib/salidas/...` y
    `app/api/salidas/registrar/route.ts` usan `leerConsecutivosLegales`).
- **Impacto:** duplicación de modelo de "salida"; dos lugares para firma, canal,
  PDF y trazabilidad; dificulta un "Motor de Comunicaciones" coherente y los
  reportes unificados.
- **Capacidades afectadas:** C2 (D4), C3 (D3), C7 (D7), C9 (D9).
- **Beneficios:** un solo agregado `Comunicación` (respuesta ciudadana / oficio
  externo / comunicación interna como variantes) → una firma, un canal, una
  trazabilidad, un reporte; máxima reutilización; el "Motor de Comunicaciones"
  pleno.
- **Riesgos:** refactor de un flujo **maduro y sensible** (aprobación jurídica,
  firma); requiere migración cuidada y pruebas fuertes.
- **Complejidad:** L. **Prioridad:** Alta (define el norte de D4).
- **Momento recomendado:** **después** de entregar C2 (comunicaciones internas) en
  producción y con métricas; no antes (evita refactor especulativo — ADR-0020).
- **Relación:** BM-B20/B22/B23; ADR-0019 (consolidación), ADR-0021 (mapa de
  capacidades). Detectada en Blueprint C2.

## OAT-03
**Unificar el vocabulario de "canal de envío / medio de notificación"**

- **Problema:** tres enumeraciones distintas modelan el mismo concepto (canal por el
  que sale/llega una comunicación).
- **Evidencia:** `CanalRespuesta = 'CORREO'|'PRESENCIAL'|'TELEFONO'|
  'DIRECCION_FISICA'` (`src/types/radicado.ts`); `MedioEnvioSalida =
  'CORREO'|'FISICO'|'MENSAJERO'|'PRESENCIAL'` (`src/types/salida.ts`); `CanalEnvio =
  'email'|'fisico'|'whatsapp'|'portal'|'otro'` (`src/types/simi-firma.ts`).
- **Impacto:** mapeos ad-hoc entre modelos; reportes de canal inconsistentes;
  fricción al añadir un canal (hay que tocar varios enums).
- **Capacidades afectadas:** C2 (D4), C7 (D7), C9 (D9 reportes).
- **Beneficios:** un catálogo único de canales; reportes coherentes; añadir canal en
  un solo lugar.
- **Riesgos:** bajo; mapear valores legados a la nueva taxonomía.
- **Complejidad:** S-M. **Prioridad:** Media-Baja.
- **Momento recomendado:** junto con OAT-02 (misma zona del código).
- **Relación:** ADR-0020 (simplificación/valor neto). Detectada en Blueprint C2.

## OAT-04
**Unificar la fuente de verdad de la TRD (código subset de la ventanilla ↔ dato completo del Archivo)**

- **Problema:** tras C11-Nivel 1 coexisten dos representaciones de la TRD: el
  subconjunto en código que usa la ventanilla (`lib/catalogos/series-documentales.ts`,
  ~6 series) y el catálogo completo en dato que administra el Archivo
  (`trd_catalogo`, ~56 series).
- **Evidencia:** `series-documentales.ts` (constante en código, hot-path de
  radicación) vs. la nueva colección `trd_catalogo` (Blueprint C11).
- **Impacto:** riesgo de divergencia entre lo que clasifica la ventanilla y lo que
  el Archivo considera vigente.
- **Capacidades afectadas:** C1 (D2), C11 (Archivo).
- **Beneficios:** una sola fuente de verdad; la ventanilla lee la disposición/retención
  confirmada por el Archivo; menos mantenimiento.
- **Riesgos:** tocar el hot-path de radicación; requiere caché + fallback para no
  añadir latencia ni acoplar la radicación a una lectura remota.
- **Complejidad:** M. **Prioridad:** Media.
- **Momento recomendado:** **después** de C11-Nivel 1 (cuando el `trd_catalogo` esté
  poblado y validado por el Archivo).
- **Relación:** ADR-0019/0020; Blueprints C1 y C11. Detectada en Blueprint C11.

## OAT-05
**Centralizar la definición de "estados activos" del radicado**

- **Problema:** el set de estados activos está **duplicado** (misma lista literal) en
  varios módulos; añadir un estado (p. ej. `EN_SUBSANACION` de BM-B33) obliga a tocar
  cada copia, con riesgo de inconsistencia.
- **Evidencia:** `ESTADOS_ACTIVOS` repetido en
  `lib/kpis-operativos/filtrar-por-kpi-operativo.ts:19`,
  `lib/kpis-operativos/calcular-kpis-operativos.ts:23`,
  `lib/proxima-accion/calcular-proxima-accion.ts:39`; variantes en
  `lib/reportes/filtrar-por-preset.ts` y `lib/reportes-mipg/indicadores.ts`.
  `estadoActual` se consume en ~54 archivos.
- **Impacto:** cada nuevo estado o cambio de semántica se replica a mano; fuente de bugs.
- **Capacidades afectadas:** C3 (Trámite/BM-B33), KPIs/reportes, control interno.
- **Beneficios:** una sola fuente de la máquina de estados (activos/cerrados/derivados);
  añadir un estado se hace en un lugar; menos regresiones.
- **Riesgos:** bajo; refactor mecánico con `tsc` de respaldo.
- **Complejidad:** S. **Prioridad:** Media.
- **Momento recomendado:** **antes o junto a** BM-B33 (reduce su ripple del estado nuevo).
- **Relación:** ADR-0020 (simplificación). Detectada en Blueprint BM-B33.
