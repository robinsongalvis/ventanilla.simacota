# Auditoría Arquitectónica y Validación — Línea Base Oficial

- **Fecha:** 2026-07-13
- **Estado:** **CERRADA como línea base oficial** por decisión del propietario. Congelamiento de implementación **vigente** — este documento no autoriza ningún cambio de código, configuración ni infraestructura.
- **Propietario:** Robinson David Galvis
- **Método:** auditoría externa (Arquitecto Principal) → refutación multidisciplinaria por 6 roles independientes (Fases 1–2) → revisión cruzada y consenso (Fases 3–5) → blast radius y priorización (Fases 6–7) → matriz de decisión y roadmap → Architecture Decision Review de cierre (6/6 roles).
- **Roles participantes:** arquitecto-principal (coordinación), seguridad, firestore-datos, dev-backend, gobierno-digital, devops, qa.
- **Regla de trabajo:** toda afirmación con evidencia verificable (archivo:línea); supuestos declarados; los especialistas intentaron **refutar** los hallazgos, no confirmarlos; ninguno validó su propio trabajo.

> **Vigencia del orden de ejecución:** cuando se levante el congelamiento, el trabajo comenzará siguiendo el orden del **Escenario B refinado** (§7), salvo que nueva evidencia objetiva justifique modificarlo (Regla Suprema, con constancia).

---

## 1. Resumen

La revisión confirma los **5 hallazgos** de la auditoría externa (H1–H5) y suma **8 hallazgos propios** de los especialistas (N1–N8). Se corrigieron **tres afirmaciones** de la auditoría original cuando la evidencia las desmintió (una a favor del sistema, dos en su contra). El consenso de cierre (ADR Review, 6/6) confirma el **Escenario B refinado** como orden de trabajo, sin nuevos hallazgos críticos verificados en la última revisión.

**Lectura arquitectónica de fondo:** las dos obligaciones más duras del sistema —reserva de identidad e integridad del consecutivo legal— descansan hoy en la **capa de aplicación y en transacciones de cliente**, no en la frontera de datos. No es el defecto de una función; es un patrón de frontera de confianza mal ubicada, repetido en varias rutas.

Confianza global: **ALTA** en lo técnico y arquitectónico; **MEDIA** en dos calificaciones que dependen de evidencia externa al repositorio (respaldos en GCP, estado de branch protection).

## 2. Hallazgos consolidados

### Confirmados de la auditoría externa

| # | Hallazgo | Veredicto | Confianza |
|---|---|---|---|
| **H1** | Identidad reservada llega en claro al cliente vía el stream en tiempo real | CONFIRMADO, con matices en ambos sentidos | ALTA |
| **H3** | Consecutivo legal no atómico (número consumido sin persistir el radicado) | CONFIRMADO y AMPLIADO (5 rutas, no 1) | ALTA |
| **H4** | La compuerta de despliegue agrega señales de CI; parte verifica hechos, parte declaraciones | PARCIAL (una parte refutada; R14 confirmado) | ALTA |
| **H5** | Preservación documental sin controles ejecutables | CONFIRMADO en repo (severidad condicionada a GCP) | MEDIA |
| **H2** | El "multi-tenant" aísla dependencias de una alcaldía, no municipios | CONFIRMADO como hecho; NO explotable hoy | ALTA |

**Detalle de evidencia:**

- **H1** — Para `tipoPresentacion=RESERVADA`, el nombre real (y **email, teléfono, dirección**; documento en la ruta interna) se persiste en claro: `app/api/radicacion/route.ts:355,376-378`; `lib/actions/radicarVentanilla.ts:240-249`. El stream entrega el documento completo al navegador: `lib/hooks/useVentanillaRadicados.ts:118-128`. Las reglas autorizan el documento entero a 5 roles (3 cross-tenant): `firestore.rules:131-140`. Firestore no filtra campos en lectura (limitación de plataforma). El enmascaramiento existe solo en presentación (`lib/seguridad/identidad-protegida.ts`).
- **H3** — El consecutivo se consume antes de subir archivos y persistir el radicado, fuera de una transacción única: `lib/actions/radicarVentanilla.ts:197 → 200-202 → 332`. Confirmado en STAGE ("consecutivos fantasma"): `docs/laboratorio/FASE2_BITACORA.md:524-538`.
- **H4** — Categorías derivadas de variables `OUTCOME_*`; normativo y observabilidad reutilizan `OUTCOME_TEST`: `scripts/laboratorio/informe-despliegue.mjs:158,170,195`. `requiereAceptacion` en amber sin mecanismo que la registre: `:247`. `OUTCOME_SONDA` se exporta (`ci.yml:84,147`) pero el informe **no lo consume**. R14 registrado: `docs/REGISTRO_RIESGOS.md:22`.
- **H5** — Sin scripts de backup/restore/export en el repo; `docs/disaster-recovery.md` es declarativo; el runbook cita `MAINTENANCE_MODE`, inexistente en el código (N7).
- **H2** — Sin dimensión municipal: `grep municipioId|entidadId|alcaldiaId` = 0; `CODIGO_OFICINA_RADICADORA='110'` constante (`lib/radicado-institucional.ts:23`); `municipio: 'Simacota'` hardcodeado (`app/api/radicacion/route.ts:379-383`). No explotable hoy porque no existe un segundo municipio.

### Correcciones a la auditoría original (transparencia)

1. **H1 "solo en presentación" — corregido a favor del sistema.** Existen **7 superficies con enmascaramiento server-side real**: consulta pública por lista positiva + token hasheado (`lib/seguridad/consulta-publica-radicado.ts`), SIMI que no envía identidad al modelo ni de identificados (`lib/simi/contexto-radicado.ts:180-192`), planilla, PDF oficial, reportes MIPG (`lib/reportes-mipg/sanitizar.ts`), notificaciones, y búsqueda avanzada (`lib/busqueda/filtros-radicado.ts:379-407`). La exposición es específica del **stream `useVentanillaRadicados`**, no del sistema entero.
2. **H1 alcance — corregido en contra.** No es solo el nombre: también email, teléfono, dirección y documento.
3. **H3 contraste — corregido.** No es "interna defectuosa vs. rutas Admin atómicas": **ninguna de las 5 rutas productivas** persiste el documento dentro de la transacción del contador (radicación ciudadana, interna, exprés, salidas, planillas). La lógica del consecutivo está **cuadruplicada** con SDKs distintos.
4. **H4 "sin atadura verificada al SHA" — refutado.** El orquestador **sí verifica** la atadura al SHA: verde solo si coincide, JSON corrupto → rojo, ausencia de señal → nunca verde (`informe-despliegue.mjs:137-138,131,82-83,120`).

### Hallazgos propios de los especialistas (N1–N8)

| # | Hallazgo | Sev. | Rol(es) |
|---|---|---|---|
| **N1** | `counters` escribible por cliente sin validar contenido (`firestore.rules:208-211`): retroceso + `set` Admin SDK = **sobrescritura silenciosa de radicado legal** o **número repetido sin subsanación normativa** | ALTA (pérdida de dato) | firestore, seguridad, gobierno-digital |
| **N2** | `app/api/ai/copilot/route.ts:85` lee toda `ventanilla_radicados` por invocación — regresión viva de la disciplina R11 | MEDIA-ALTA | firestore |
| **N3** | Validación de magic bytes solo en la ruta ciudadana (`route.ts:334-345`); la radicación interna sube directo desde el cliente | MEDIA | seguridad |
| **N4** | `create` desde cliente solo valida `radicadoId` (`firestore.rules:143-144`) → forjar `estadoActual`, `cumplioTermino`, `isTest` | MEDIA-ALTA | seguridad |
| **N5** | 17 de ~93 archivos de test usan `readFileSync + toContain` (asserts de texto, frágiles ante refactor) | BAJA (mantenibilidad) | qa |
| **N6** | `ci.yml` sin `permissions:`, usa `npm install` (no `npm ci`), actions por tag mutable; deploy fuera del pipeline | MEDIA | devops |
| **N7** | El runbook de restauración cita `MAINTENANCE_MODE`, inexistente en el código | MEDIA | devops |
| **N8** | Archivos huérfanos en Storage y evento fundacional de trazabilidad no garantizado (radicado sin evento de nacimiento) | BAJA-MEDIA | firestore |

## 3. La piedra angular

Corregir **H3 correctamente** —radicación interna a servidor con Admin SDK dentro de una transacción única— cierra o mitiga **N1, N3, N4 y N8** como subproductos. Un solo movimiento arquitectónico resuelve cinco hallazgos, cuatro de ellos de integridad.

**Advertencia de implementación (dev-backend), que debe conocerse antes de ejecutar:** copiar el patrón de `app/api/radicacion/route.ts` **no basta** — esa ruta **también** tiene el hueco (es Admin SDK pero no atómica). La corrección atómica (transacción única que incluya el `setDoc`, o asignar el consecutivo solo cuando el radicado esté garantizado) debe ser **tarea explícita**, no subproducto asumido; y la duplicación del helper solo se resuelve **centralizándolo en las 4 rutas a la vez**.

## 4. Matriz de decisión

Escalas: Prob./Impacto/Regresión/Retorno = Alto/Medio/Bajo · Costo/Esfuerzo = S/M/L. Estimaciones de esfuerzo/duración **por analogía con las Olas 1–2** (supuesto declarado: no hay métrica de velocidad; reversibles y a re-medir).

| # | Prob. | Impacto | Costo | Beneficio | Dependencia | Esfuerzo | Regresión | Retorno arq. |
|---|---|---|---|---|---|---|---|---|
| H3 | Alta | Alto | M | Alto | comparte superficie con H1, N1 | M | Medio-Alto | Alto |
| N1 | Baja-Media | Alto | S | Alto | se cierra dentro de H3 | S | Medio | Alto |
| H1 | Media | Alto (Ley 1581) | L | Alto | rutas de H3 + decisión R10 | L | Alto | Alto |
| N2 | Alta | Medio | S | Medio | independiente | S | Bajo | Medio |
| N4 | Baja-Media | Medio-Alto | M | Alto | se cierra si radicación interna→server | M | Medio | Alto |
| N3 | Media | Medio | S-M | Medio | ligado a H3 | S-M | Bajo | Medio |
| N8 | Media | Bajo-Medio | S-M | Medio | mitigado por la tx atómica de H3 | S-M | Bajo | Medio |
| H4 (+R14) | Media | Medio | M | Medio-Alto | independiente | M | Bajo prod / Medio pipeline | Medio-Alto |
| H5 | ? (gated GCP) | Alto (Ley 594) | M-L | Alto | verificación GCP previa | M-L | Bajo | Alto |
| N7 | Alta (si se restaura) | Medio | S | Medio | parte de H5 | S | Bajo | Bajo-Medio |
| N6 | Baja | Medio | S | Medio | independiente | S | Bajo | Medio |
| N5 | Alta (ante refactor) | Bajo | M | Medio | bloqueado por entorno emulador | M-L | Bajo | Medio |

## 5. Roadmap — tres escenarios

- **A — Riesgo mínimo:** H3+N1+N2. ~1 ola. Residual: H1 (incumplimiento Ley 1581 abierto), H4, H5. **No apto como referente** todavía.
- **B — Equilibrado (recomendado):** A + H1 (con reevaluación de R10) + H4 + N6/N7. ~2–3 olas. Residual: H5(b), N5, tenancy. **Apto para la operación institucional de Simacota.**
- **C — Máxima calidad:** B + H5 completo + N5 + ADR de tenancy municipal y matriz de aislamiento municipal (condición de entrada de 2E). ~4–6 olas. **Apto como referente multi-municipal.**

## 6. ADR Review de cierre — consenso (6/6)

**Todos los especialistas confirman el Escenario B.** Sin nuevos hallazgos críticos verificados. Ajustes convergentes adoptados en el "B refinado":

- **Branch protection al primer bloque** (devops): sin ella, la compuerta "es reporte, no control" — un `exit 1` no bloquea si `main` acepta merges. Coste casi nulo.
- **H5(a) sube de C a B** (gobierno-digital, corroborado por devops): el plan de preservación + expediente exportable es **incumplimiento instrumental actual** de la Ley 594 art. 46 y "la primera pregunta del AGN"; la capa (b) —transferencia SGDEA— queda en C.
- **R14 de BAJA a MEDIA, integrado en H4** (qa + devops): cerrar H4 sin R14 deja el mismo punto ciego con otro nombre.
- **N1 reclasificado como riesgo de pérdida de dato** (firestore + gobierno-digital), no de higiene de reglas.

**Preocupaciones de juicio (declaradas NO verificadas — a revisar al levantar el congelamiento, no bloquean el cierre):** ausencia de auditoría de *lectura* de identidad (seguridad); reintento de formulario que consuma doble consecutivo (backend); ausencia de invariante `consecutivo ↔ documento` (firestore); ausencia de prueba arquitectónica que impida lecturas directas futuras de `solicitante.*` (qa); posible segunda brecha 1581 en la captura, deber de informar art. 12 (gobierno-digital).

**Qué observaría primero una revisión técnica nacional** (convergencia de los 6): (1) consecutivo legal ejecutándose desde el navegador; (2) identidad reservada dependiente de la disciplina del cliente; (3) expediente electrónico y su preservación (AGN); (4) entrega y operación — deploy sin gobernar y recuperación sin demostrar (devops).

## 7. Escenario B refinado — orden de trabajo consensuado

1. **Primer bloque (integridad + control):** H3+N1 (radicación atómica server-side, con la advertencia de §3) · branch protection aplicada · N2 (acotar copilot).
2. **Segundo bloque (seguridad + cumplimiento):** H1 (con reevaluación previa de R10) · H5(a) (plan de preservación + expediente exportable).
3. **Tercer bloque (gobernanza):** H4 con R14 integrado · N6/N7.
4. **Queda en C:** H5(b) transferencia SGDEA · N5 · tenancy municipal (condición de entrada de 2E).
5. **Límite conocido a declarar en el ADR de cierre de la fase:** el deploy vive fuera de la gobernanza del pipeline (cerrarlo es Ola 3).

**Prerrequisito transversal (ADR-0014):** cada bloque se cierra con evidencia objetiva de mejora en mantenibilidad, auditabilidad, escalabilidad y gobernanza, y con control de regresión probado por mutación (ciclo obligatorio de hallazgos).

## 8. Decisiones reservadas al propietario (pendientes)

1. Adoptar el "B refinado" (con H5(a) y branch protection dentro) o mantener H5 entero en C.
2. Reevaluar la aceptación de riesgo R10 (premisa incompleta reconocida por gobierno-digital).
3. Verificación GCP (export programado + una restauración de prueba) — desbloquea la severidad de H5.
4. Restricción de diseño de H1: fix aditivo (subcolección/reglas) vs. estructural (mover del modelo).
5. Modelo de tenancy de 2E (solo si se elige C): proyecto por municipio vs. dimensión `municipioId`.
6. Visibilidad del repositorio (público al momento de esta auditoría) e integración de la rama a `main`.

## 9. Estado y trazabilidad

- **Congelamiento vigente.** Ningún cambio de código, configuración o infraestructura autorizado.
- **Precondiciones para levantar el congelamiento** (sin cambios): branch protection aplicada + validación operativa de la ventana de 180 días con la funcionaria.
- Los hallazgos no se incorporan al `docs/REGISTRO_RIESGOS.md` ni al `docs/BACKLOG_TECNICO.md` en esta etapa por decisión del propietario (primero consolidar la línea base). Su incorporación formal y la eventual formalización del orden del Escenario B como ADR quedan como pasos posteriores, sujetos a autorización.
