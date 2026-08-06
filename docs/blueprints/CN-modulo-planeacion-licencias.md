# Blueprint — Módulo de Secretaría de Planeación: Expedientes de Licencia de Construcción

> **Estado: v1 REVISADO POR PANEL (Seguridad · UX · Gobierno Digital · Datos). Requiere REESCRITURA v2 antes de codear.** Los 4 veredictos entraron; hay hallazgos que reencuadran el diseño (ver §Revisión cruzada al final). Ninguno rechaza el módulo; todos son incorporables. Pendiente: aprobación del propietario de la decisión de fondo (hito de radicación) + validación jurídica y UX con la Secretaría de Planeación real, antes del ADR.
> Autor: Arquitecto Principal. Nivel 3 (módulo + colección + flujo + integración nuevos).

## 0. Principio rector y anclaje en lo existente

El objeto central NO es un radicado, es un **EXPEDIENTE** (agrupa todos los documentos y actuaciones de UN trámite de licencia). Planeación **gestiona el expediente antes** de que exista radicado; al final lo entrega a Ventanilla Única para radicación y respuesta al ciudadano.

**Reutiliza (no reinventa):**
| Pieza existente | Uso en el módulo |
|---|---|
| Modelo tenant (`tenantId = SEC_PLANEACION`) + aislamiento ADR-0007/0008 | Todo el módulo vive bajo el tenant de Planeación |
| Custom claims (`rol`, `tenantId`) + `users/{uid}` | Autorización de funcionarios |
| TRD `LICENCIA_CONSTRUCCION` (serie 22.01) | Número de expediente y clasificación documental |
| `consecutivo-legal.ts` (patrón H3, guard de identidad) | Consecutivo legal del expediente, sin huecos |
| Patrón `trazabilidad` (subcolección append-only, eventos tipados) | Historial de actuaciones |
| Radicación server-side (`api/radicacion/interna`, pieza angular) | Integración final con Ventanilla (punto 10) |
| Storage + magic-bytes + límites server-side | Gestión documental |
| Semáforo de términos / vencimientos del dashboard | Alertas de plazos legales |
| Invariante "IA sugiere / funcionario decide" (Principio 9) | Verificación de requisitos asistida, nunca automática |

## 1. Arquitectura del módulo

- **Escritura server-side (Admin SDK)**, igual que la pieza angular: endpoints en `app/api/planeacion/*` con gate de rol explícito, transacciones atómicas, y trazabilidad `tx.set` con id determinístico dentro de la misma tx (fail-closed, idempotente). El cliente **nunca** escribe el expediente directamente (cierra la clase de riesgo CR-1/CR-2 desde el diseño).
- **Colección raíz:** `planeacion_expedientes` (tenant-scoped). Subcolecciones: `documentos`, `actuaciones` (trazabilidad), `observaciones`.
- **Constructor puro compartido** del documento de expediente (como `construir-radicado.ts`): forma en disco estable, `null` explícito para campos no diligenciados (compatibilidad y auditoría).
- **Frontend:** rutas `app/planeacion/*` (bandeja + detalle de expediente), sólo visibles para roles de Planeación. React + estados; sigue el design system existente (sala de operaciones).
- **Integración con Ventanilla:** desacoplada por un endpoint server-side de "handoff" (punto 10), no por escritura cruzada de colecciones.

## 2. Modelo de datos

**`planeacion_expedientes/{expedienteId}`** (documento raíz):
- Identidad: `expedienteId` (UUID interno), `numeroExpediente` (consecutivo legal, formato derivado de TRD 22.01), `tenantId: 'SEC_PLANEACION'`.
- Solicitante: nombre, tipo/número de documento, contacto, `datosNoAportados` (null explícito).
- Predio: dirección, matrícula inmobiliaria, cédula catastral, área, uso del suelo.
- Trámite: `tipoLicencia` (construcción, ampliación, modificación…), `estado` (§3), `subEstado`.
- Asignación: `funcionarioAsignadoUid`, historial de reasignaciones (en actuaciones).
- Control/términos: `fechaRecepcion`, `terminoLegalDias`, `fechaVencimiento`, `suspensionesTermino[]` (cada subsanación suspende el término — Ley 1755), `prorrogas`.
- Enlace: `radicadoVentanillaId` (null hasta el handoff), `serieDocumental: '22.01'`.
- Auditoría: `creadoPor`, `creadoEn`, `actualizadoEn` (timestamps servidor).

**`.../documentos/{documentoId}`** — el documento LÓGICO (§6): `nombre`, `tipoDocumento` (según checklist de requisitos), `estadoRevision` (PENDIENTE/ACEPTADO/RECHAZADO), `versionActual`, `versiones[]` (metadata; los binarios en Storage).

**`.../actuaciones/{eventoId}`** — trazabilidad append-only (§7): `tipo`, `actorUid`, `actorNombre`, `actorRol`, `etapa`, `fechaServidor`, `detalle`, `documentoRef?`.

**`.../observaciones/{observacionId}`** — subsanaciones/requisitos (§8): `tipo` (REQUISITO_FALTANTE / OBSERVACION_TECNICA), `descripcion`, `requisitoRef`, `estado` (ABIERTA/SUBSANADA/VENCIDA), `plazoDias`, `fechaLimite`, `creadaPor`.

## 3. Estados del trámite (máquina de estados)

```
RECIBIDO
  → EN_REVISION_REQUISITOS
       ⇄ SUBSANACION_SOLICITADA   (suspende término; al recibir vuelve a revisión)
  → EXPEDIENTE_COMPLETO
  → EN_ESTUDIO_TECNICO
  → ESTUDIO_FINALIZADO   (con resultado: VIABLE / NO_VIABLE / CONDICIONADO)
  → LISTO_PARA_VENTANILLA
  → ENVIADO_A_VENTANILLA   (terminal en Planeación; radicado creado en Ventanilla)
```
Cada transición declara: **rol autorizado**, **precondiciones** (p. ej. "no pasar a COMPLETO con observaciones ABIERTAS"), y **evento de trazabilidad obligatorio**. Ninguna transición sin actor identificado. Transiciones inválidas rechazadas server-side (fail-closed).

## 4. Flujo completo del expediente

1. **Recepción** (Planeación): funcionario crea el expediente, adjunta la solicitud y documentos iniciales → estado RECIBIDO, consecutivo asignado, evento `EXPEDIENTE_RECIBIDO`.
2. **Asignación**: jefe/asignador asigna a un funcionario técnico → `EXPEDIENTE_ASIGNADO`.
3. **Revisión de requisitos**: contra un **checklist configurable** por tipo de licencia; IA puede sugerir faltantes (nunca decide). Estado EN_REVISION_REQUISITOS.
4. **Subsanación** (si faltan): se crea observación con plazo; se notifica al ciudadano; **el término legal se suspende**. Al recibir lo faltante → nueva versión de documento + evento, vuelve a revisión.
5. **Expediente completo**: sin observaciones abiertas → EXPEDIENTE_COMPLETO.
6. **Estudio técnico**: EN_ESTUDIO_TECNICO → concepto técnico (documento) → ESTUDIO_FINALIZADO con resultado.
7. **Listo para Ventanilla**: el funcionario marca LISTO_PARA_VENTANILLA (precondición: estudio finalizado + expediente completo).
8. **Handoff a Ventanilla** (§10): se crea el radicado; expediente → ENVIADO_A_VENTANILLA, enlazado.

## 5. Bandeja de trabajo (UX)

- **Vista tipo sala de operaciones** (reusa el estilo del dashboard interno): columnas/tabs por estado — *Nuevos · En revisión · En subsanación · En estudio · Listos para Ventanilla · Enviados*.
- **Filtros:** por funcionario ("Solo los míos" / todos), por tipo de licencia, por vencimiento.
- **Semáforo de términos** (reusa el patrón de vencimientos): en término / por vencer / vencido; los suspendidos por subsanación se marcan aparte.
- **KPIs**: expedientes activos, en subsanación, por vencer, listos. "SIMI propone, usted decide" — sugerencias asistidas, acción humana.
- **Detalle del expediente:** cabecera (solicitante, predio, estado, término), pestañas *Documentos · Requisitos/Observaciones · Actuaciones (historial) · Estudio técnico*. Botón de acción según estado (con confirmación y anti-doble-submit).

## 6. Gestión documental con versionado (anti-pérdida)

- Cada **documento lógico** tiene **N versiones inmutables**. Subir un reemplazo crea `v(n+1)`; **nunca se sobrescribe ni se borra** una versión previa.
- Storage: `expedientes/{expedienteId}/{documentoId}/v{n}/{archivo}` — reglas `create` server-side, `delete: if false`.
- Por versión: `hash` (integridad), `subidoPor`, `fechaServidor`, `estadoRevision`, `motivoRechazo?`. Magic-bytes + límites reutilizados.
- **Garantía de no pérdida:** append-only en Firestore y Storage; el `hash` permite detectar corrupción; la trazabilidad registra cada carga.

## 7. Historial y trazabilidad (quién, qué, cuándo, en qué etapa)

- Subcolección `actuaciones` **append-only** (reglas: `create` server-side; `update`/`delete: if false`, idéntico a la trazabilidad de radicados).
- Cada evento: actor (uid + nombre + rol capturados server-side, no del cliente), timestamp de servidor, etapa, tipo tipado, y referencia al documento/observación afectada.
- Vista cronológica en el detalle. Responde en todo momento: **qué acción, quién la hizo, cuándo, y en qué etapa estaba el expediente**.

## 8. Observaciones y subsanación

- **Checklist de requisitos** configurable por tipo de licencia (catálogo, como la TRD).
- Observación = solicitud de subsanación con **plazo legal**; al crearse, **suspende el término** del expediente y registra la suspensión.
- Notifica al ciudadano (reusa el canal de notificación existente; IA/funcionario autoriza el envío — nunca automático).
- Al recibir la subsanación: nueva versión del documento + evento + reanudación del término. Observación → SUBSANADA. Si vence el plazo → VENCIDA (posible desistimiento, según norma).

## 9. Notificaciones internas entre dependencias

- **Eventos de dominio** que disparan notificaciones: subsanación solicitada (→ ciudadano), expediente listo (→ Ventanilla), reasignación (→ funcionario).
- **Bandeja de notificaciones internas** por tenant; Ventanilla recibe aviso cuando un expediente queda LISTO. Reusa el patrón de notificaciones/resumen del sistema.
- Toda notificación deja rastro en trazabilidad (enviada/fallida/reintentada).

## 10. Integración con Ventanilla Única (handoff "Listo para Ventanilla")

- Al marcar **LISTO_PARA_VENTANILLA**, un endpoint server-side de handoff **crea el radicado en Ventanilla** reutilizando el flujo de **radicación interna** (la pieza angular: `tx.create` del radicado + trazabilidad determinística en la misma tx). Lleva: solicitante, predio, serie 22.01, referencia del expediente y documentos finales (o su enlace).
- **Enlace bidireccional:** `expediente.radicadoVentanillaId` ↔ `radicado.expedientePlaneacionId`. El expediente pasa a ENVIADO_A_VENTANILLA.
- **Anti-pérdida / idempotencia:** id determinístico del handoff dentro de la tx → un reintento no duplica el radicado. Si el handoff falla, el expediente NO avanza (fail-closed) y queda reintentar.
- Ventanilla continúa su procedimiento (gestión administrativa, respuesta al ciudadano) con su propio flujo ya existente.

## Invariantes de producto (no negociables)

Aislamiento por `tenantId`; IA sugiere / funcionario decide; datos personales protegidos (Ley 1581); **expediente digital único** (una sola fuente por trámite); trazabilidad completa e inmutable; términos legales respetados (Ley 1755); documentos nunca se pierden.

## Próximos pasos (proceso del proyecto)

1. **Revisión cruzada** de este blueprint: seguridad (aislamiento, datos personales), firestore-datos (shape, índices, reglas), gobierno-digital (AGN/TRD, Ley 1755, licencias urbanísticas Ley 388), ux-ui (bandeja y detalle).
2. Incorporar observaciones → **ADR** de la decisión.
3. Estimación de impacto y plan por fases (Fase 0 golden si toca datos compartidos, endpoints server-side, bandeja, integración) — igual que la pieza angular.
4. Validación con la funcionaria/Secretaría de Planeación (Principio 13) antes de codear.

---

# REVISIÓN CRUZADA v1 → cambios para v2 (23-jul-2026)

Panel de 4 especialistas sobre el blueprint. Veredictos: Gobierno Digital **CON OBSERVACIONES**, Datos **CON OBSERVACIONES**, Seguridad **CON HALLAZGOS (2 altos)**, UX **CON OBSERVACIONES**. Confirmado correcto el supuesto central: en municipio sin curador (Simacota, 6ª cat.), **Planeación es competente para expedir** (Ley 388 art. 99).

## A. NORMATIVO (Gobierno Digital) — reencuadra el diseño
1. **🔴 DECISIÓN DE FONDO — hito de radicación INVERTIDO.** El término legal de **45 días hábiles** (Decreto 1077 art. 2.2.6.1.2.3.1) arranca en la **recepción** ("radicación en legal y debida forma"), NO en el handoff final. El §10 v1 pone el radicado al final → legalmente incorrecto. **Reconciliación a validar con el propietario/Planeación:** probablemente hay DOS radicaciones — de ENTRADA al recibir (constancia al ciudadano, arranca término) y de SALIDA al final (la resolución que se entrega). El "pasa a Ventanilla" del proceso descrito sería la radicación de SALIDA/gestión de la respuesta, no el nacimiento del radicado de entrada.
2. **🔴 Silencio administrativo POSITIVO (ausente):** vencer el término = licencia CONCEDIDA por ministerio de la ley (Ley 388 art. 99). Estado y alerta de riesgo jurídico máximo, distinto de mora PQRSD.
3. **Resolución motivada (acto administrativo CPACA):** el desenlace es una resolución con notificación (arts. 67-69) y recursos (reposición/apelación), no solo VIABLE/NO_VIABLE (que pasa a estado interno previo).
4. **Base legal de subsanación corregida:** rige el Decreto 1077 (acta de observaciones, **30 hábiles + prórroga 15**), no la Ley 1755 art. 17 citada en v1. `plazoDias` → 30/15 hábiles.
5. **Citación a vecinos colindantes (ausente):** ventana de 5 días hábiles antes de conceder, con trazabilidad.
6. **TRD 22.01 A VALIDAR:** confirmar el código convalidado real de Simacota y la retención (vigencia licencia ~24m). Serie mapea a dependencia 120 = SEC_PLANEACION.

## B. DATOS — corrige garantías que el código real NO tiene
7. **Atomicidad real (corrige §1/§7/§10):** en el código real la **trazabilidad se escribe post-commit, NO atómica** (deuda N8 declarada en registro-expres). El blueprint debe dejar de afirmar "todo en la tx, fail-closed".
8. **Idempotencia del handoff por GUARD, no por id determinístico:** el `radicadoId` sale del consecutivo (no es determinístico). El handoff correcto = `runTransaction` cross-collection que (a) lee el expediente y **verifica `radicadoVentanillaId == null`** (guard real), (b) consume consecutivo, (c) `tx.set` del radicado, (d) `tx.update` del expediente con el enlace + estado. Reintento seguro; concurrentes serializan. Trazabilidad y copia de Storage quedan best-effort post-commit (N8, documentado).
9. **`SerieConsecutivo`** (`consecutivo-legal.ts:32`) es unión cerrada → añadir `'expedientes'`; contador `counters/expedientes-{año}` (global anual, el helper tolera contador ausente); definir formato explícito del `numeroExpediente` en el ADR.
10. **5 índices compuestos** enumerados (tenantId+estado+fechaVencimiento; +funcionario; por tipo; recientes). **AVISO: no existe gate `verificar:indices`** (solo `presupuesto:rendimiento`) → un índice faltante NO falla en CI, falla en prod con FAILED_PRECONDITION. Enumerarlos antes del frontend.
11. **Reglas leen `get(users).tenantId`, no el token** — seguir ese patrón real.

## C. SEGURIDAD — 2 altos + medios
12. **🔴 Regla de lectura del expediente:** definir explícita — solo roles de Planeación + `resource.data.tenantId == userTenant()`. **Excluir a Recepcionista/Ventanilla** del interior del expediente (solo ven el radicado tras handoff). Subcolecciones gatean por el tenant del padre.
13. **🔴 Storage:** NO heredar `allow create: if signedIn()`; carga server-side + `read: if false` + endpoint de descarga que valide `tenant == expediente.tenantId` (anti-IDOR sobre planos/escrituras).
14. **`create/update/delete: if false`** en raíz Y las 3 subcolecciones (más estricto que radicados; cierra la clase R8/ADR-0008 por diseño).
15. Hash de integridad **server-side** y validado al recuperar; precondiciones de transición releídas **dentro de la tx**; PII (matrícula/catastral/cédula) minimizada hacia IA/logs; anti-forja en el handoff (el radicado deriva estado/consecutivo/actor server-side; el expediente solo aporta campos whitelisted).

## D. UX — arquitectura correcta, 5 specs por cerrar
16. **Búsqueda por predio/matrícula/cédula catastral/solicitante** (crítica, ausente) — reusar `BusquedaAvanzadaPanel`.
17. **4º estado visual SUSPENDIDO** (slate + ícono pausa, con texto además de color) — distinto de vencido/en-término.
18. **Timeline persistente** (panel lateral, no una pestaña más) — reusar `TimelineAuditoria`.
19. **Versionado = un renglón por documento LÓGICO** (versión vigente + estado), anteriores colapsadas, nunca botón "eliminar".
20. **Modal irreversible "Listo para Ventanilla"** (enumera consecuencias + checklist de precondiciones visible + manejo de fallo de handoff). Dorado solo en "Nuevo expediente" y "Enviar a Ventanilla".
21. **Corrección de consistencia:** el design system "oscuro" documentado está DESACTUALIZADO; el panel real es tema claro → verificar contra `VistaMiGestion`/`page.tsx`, no la memoria.
22. **Validar el flujo con el funcionario real de Planeación** (no Laura/recepción; ese usuario no está caracterizado) ANTES de codear — bloqueante, no cosmético (Principio 13).

## Estado y próximos pasos
- **v2 del blueprint** incorpora A-D. La reescritura espera la **decisión del propietario sobre el hito de radicación (A.1)** — es la que más cambia el diseño.
- Validación jurídica (numerales exactos D.1077, jerarquía de recursos, acto de designación de competencia del alcalde, TRD real) y UX con la Secretaría de Planeación.
- Luego: ADR + estimación de impacto + plan por fases.
