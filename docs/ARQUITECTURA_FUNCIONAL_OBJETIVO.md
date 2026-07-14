# Arquitectura Funcional Objetivo (Target Functional Architecture)

**Estado:** DISEÑO — pendiente de validación del propietario. **No autoriza
implementación.** Rige la gobernanza vigente (ADR-0001, 0014–0021). Primero se
valida esta arquitectura; luego se decide **qué capacidad** se inicia.

**Propósito.** Pasar de un backlog de funcionalidades a una **plataforma por
capacidades institucionales**: dominios coherentes, sin módulos paralelos, con
máxima reutilización de lo ya construido. El objetivo no es copiar el referente,
sino una plataforma moderna, modular, mantenible y evolutiva.

---

## Parte A — Inventario de la plataforma actual (evidencia)

Lo que **ya existe** (base de reutilización; ninguna capacidad crea un módulo
paralelo si puede evolucionar sobre estos):

| Área existente | Evidencia en código | Qué cubre hoy |
|---|---|---|
| **Recepción / Radicación** | `lib/radicacion.ts`, `lib/radicado-institucional.ts`, `lib/recepcion/`, `app/radicacion`, `app/api/radicacion`, col. `ventanilla_radicados` | radicación dirigida, solicitante frecuente, numeración legal (H3) |
| **Consulta ciudadana** | `app/consulta`, `app/api/consulta`, `app/directorio` | consulta de estado; directorio |
| **Salidas** | `lib/salidas/`, `app/api/salidas`, col. `ventanilla_salidas` | oficios de salida, libro, constancia de despacho |
| **Planillas de reparto** | `lib/planillas/`, `app/api/planillas`, col. `ventanilla_planillas` | planilla del día, generación PDF |
| **Trámite interno / bandejas** | `lib/mi-gestion/`, `lib/mostrador/`, `lib/proxima-accion/`, `lib/traslado/` | bandejas del funcionario, próxima acción, traslado |
| **Respuesta oficial** | `lib/respuesta-oficial/`, col. `plantillas_respuesta` | plantillas y respuesta a PQRSD |
| **Firma (parcial, vía SIMI)** | `src/types/simi-digital-signature.ts`, `simi-firma.ts`, cols. `simi_respuestas_firma`, `simi_aprobaciones_respuesta`, `simi_borrador_versiones` | circuito de aprobación/firma de respuestas |
| **SIMI (IA transversal)** | `lib/ai/`, `lib/simi/`, `lib/simi-juridico/`, RAG/normograma, `lib/whatsapp` | copiloto, clasificación, borradores, alertas, jurídico |
| **Control interno** | `lib/control-interno/`, `src/types/simi-control-interno.ts` | patrones, control interno |
| **Reportes / KPIs / MIPG** | `lib/reportes/`, `lib/reportes-mipg/`, `lib/kpis-mipg/`, `lib/kpis-operativos/`, `app/interno/dashboard` | panel operativo, KPIs, MIPG |
| **Trazabilidad / auditoría** | `lib/trazabilidad/`, `lib/observabilidad/`, col. `trazabilidad`, `simi_*_auditoria` | huella auditable |
| **Seguridad / permisos / auth** | `lib/seguridad/`, `lib/permisos/`, `lib/auth-*`, cols. `users`, `seguridad_rate_limits` | multi-tenant, roles, rate-limit |
| **Catálogos** | `lib/catalogos/` (series/TRD, tipos, tiempos) | serie/subserie, retención, tipos PQRSD |
| **Notificaciones** | `lib/email/`, `lib/whatsapp/`, col. `simi_notificaciones` | correo y WhatsApp |

**Conclusión del inventario:** la siguiente generación es en su mayoría
**evolución sobre lo existente**, no construcción desde cero. Las mayores
oportunidades son de **consolidación** (unir salidas + respuesta + firma +
notificaciones en un solo dominio de Comunicaciones) y de **completar** ciclos ya
iniciados (clasificación con ciclo vital, bandejas, contingencia).

---

## Parte B — Dominios funcionales objetivo

Nueve dominios; **transversales** SIMI y Gobernanza atraviesan a todos.

```
                 ┌──────────────────── SIMI (IA transversal) ────────────────────┐
                 │        sugiere · clasifica · redacta · alerta (nunca decide)   │
   Ciudadano ─▶ D1 Recepción ─▶ D2 Clasificación ─▶ D3 Trámite ─▶ D4 Comunicaciones ─▶ Ciudadano
                 │                    │                 │              │
                 │              D5 Distribución    D6 Continuidad      │
                 │                 (planillas)      operativa          │
                 └─▶ D7 Servicio al Ciudadano (consulta/portal) ◀──────┘
                 └──────────── D9 Gobernanza · Seguridad · Trazabilidad (transversal) ───────────┘
                 ······················ D10 Integraciones (futuro) ······················
```

**Relación entre dominios:** el flujo troncal es D1→D2→D3→D4 (entrada →
clasificación → trámite → respuesta), con D5 (distribución física) y D6
(continuidad) como soportes del trámite, D7 como cara al ciudadano, y D8/D9
transversales. D10 se apoya en D9 (identidad/seguridad) y D7 (canal ciudadano).

| Dominio | Tipo | Principal/Secundario | Estado base |
|---|---|---|---|
| **D1 Recepción y Radicación** | troncal | Principal | Evoluciona (existe) |
| **D2 Clasificación y Gestión Documental** | troncal | Principal | Evoluciona (existe parcial) |
| **D3 Trámite y Gestión Interna** | troncal | Principal | Evoluciona (existe) |
| **D4 Respuesta y Comunicaciones** | troncal | Principal | Consolida (piezas dispersas) |
| **D5 Distribución física (planillas)** | soporte | Secundario | Evoluciona (existe) |
| **D6 Continuidad operativa** | soporte | Secundario | Nuevo (sobre D1) |
| **D7 Servicio al Ciudadano** | cara externa | Secundario | Evoluciona (existe consulta) |
| **D8 Inteligencia SIMI** | transversal | Principal | Evoluciona (existe fuerte) |
| **D9 Gobernanza/Seguridad/Trazabilidad** | transversal | Principal | Evoluciona (existe) |
| **D10 Integraciones** | externa | Futuro | No construir aún |

---

## Parte C — Ficha por dominio (objetivo · alcance · actores · capacidades · reutiliza/reemplaza/simplifica/innova · dependencias · SIMI · criterios de éxito)

### D1 · Recepción y Radicación
- **Objetivo:** que todo documento entre una sola vez, bien identificado y con su número legal, por cualquier canal.
- **Alcance:** ventanilla presencial, web ciudadana, verbal, correo; radicado dirigido; solicitante frecuente; imagen fiel.
- **Actores:** ciudadano, recepcionista/ventanilla, funcionario.
- **Capacidades:** radicación multicanal · radicación dirigida (existe) · solicitante frecuente (existe) · radicado pre-generado externo (BM-B14) · digitalización imagen fiel (BM-B03) · atención preferencial (BM-B10).
- **Reutiliza:** `lib/radicacion`, numeración legal H3, solicitante frecuente. **Reemplaza:** nada. **Simplifica:** un solo punto de captura para todos los canales. **Innova:** OCR/precarga con SIMI; radicación verbal guiada.
- **Dependencias:** D2 (clasificación al nacer), D9 (numeración/seguridad).
- **SIMI:** propone tipo, serie y dependencia; extrae datos del escaneo (OCR); precarga solicitante. Decisión humana: radicar.
- **Criterios de éxito:** % radicados con datos completos al primer intento; tiempo medio de radicación; % con clasificación sugerida aceptada.

### D2 · Clasificación y Gestión Documental
- **Objetivo:** que cada radicado nazca clasificado (serie/subserie) y con su ciclo vital (retención/disposición), conforme a la TRD.
- **Alcance:** catálogo TRD, clasificación asistida, retención/disposición, reclasificación.
- **Actores:** funcionario, archivista (validación), SIMI.
- **Capacidades:** clasificación serie/subserie asistida (BM-B02) · retención/disposición completas (BM-B32) · reclasificación Hacienda y otras (BM-B11).
- **Reutiliza:** `lib/catalogos/series-documentales.ts` (ya modela serie/subserie/retención/disposición) + foto inmutable de serie. **Reemplaza:** selección 100% manual de serie. **Simplifica:** un flujo único "clasificar radicado" (serie+dependencia+retención en un paso). **Innova:** SIMI sugiere la clasificación TRD; el referente no lo tiene.
- **Dependencias:** D1 (nace en la radicación); TRD aprobada (BM-B01/B02).
- **SIMI:** sugiere serie/subserie y retención leyendo asunto + TRD. Decisión humana: validación archivística.
- **Criterios de éxito:** % radicados con serie válida; % con retención/disposición; % de sugerencias IA aceptadas sin corrección.

### D3 · Trámite y Gestión Interna
- **Objetivo:** que cada radicado avance por bandejas claras, con términos legales visibles, hasta su cierre.
- **Alcance:** bandejas, asignación/reasignación, términos, devoluciones.
- **Actores:** funcionario, jefe de dependencia, SIMI.
- **Capacidades:** bandejas Prioridad/Sin-Término/Devueltas (BM-B25/B24/B26) · asignación + correo de asignación (BM-B17) · reasignación/traslado (existe) · términos legales y override (BM-B05/B15).
- **Reutiliza:** `lib/mi-gestion`, `lib/mostrador`, `lib/proxima-accion`, `lib/traslado`, `lib/tiempos-radicado`. **Reemplaza:** seguimiento manual de términos. **Simplifica:** un modelo único de bandejas sobre el estado del radicado. **Innova:** alertas predictivas SIMI de vencimiento.
- **Dependencias:** D2 (clasificación define competencia), D9 (trazabilidad).
- **SIMI:** sugiere dependencia competente y prioriza por vencimiento. Decisión humana: asignación/reasignación.
- **Criterios de éxito:** % dentro de término; tiempo medio de asignación; reducción de radicados "sin dueño".

### D4 · Respuesta y Comunicaciones  *(consolidación mayor)*
- **Objetivo:** un único dominio para toda comunicación (interna y externa), con numeración, plantilla, firma, notificación y acuse.
- **Alcance:** respuesta a PQRSD, comunicaciones internas, oficios de salida, circuito de firma, notificaciones.
- **Actores:** funcionario redactor, firmante autorizado, ciudadano/destinatario, SIMI.
- **Capacidades:** Motor de Comunicaciones internas (BM-B20/B21/B22) · circuito de firma + cargos autorizados (BM-B23/B31) · respuesta oficial (existe) · salidas/oficio (existe) · notificaciones (existe).
- **Reutiliza:** `lib/respuesta-oficial`, `lib/salidas`, `simi_respuestas_firma`+`simi-digital-signature` (firma ya iniciada), `lib/email`+`lib/whatsapp`, numeración legal H3. **Reemplaza:** oficios manuales sueltos y consecutivos por fuera. **Simplifica:** 4 features aisladas → 1 dominio (remitente/consecutivo/firma/notificación compartidos). **Innova:** SIMI redacta borrador; firma electrónica preparada.
- **Dependencias:** D3 (nace del trámite), D9 (numeración/firma trazable), D2 (serie de la comunicación).
- **SIMI:** genera borrador de respuesta/comunicación. Decisión humana: aprobación y firma.
- **Criterios de éxito:** % comunicaciones emitidas desde la plataforma; tiempo medio de emisión; % con firma trazable; reprocesos por numeración (→0).

### D5 · Distribución física (planillas)
- **Objetivo:** control completo de la entrega física de documentos.
- **Alcance:** planilla del día, ciclo de vida (reimprimir/entregar/anular), radicados sin planilla, custodia.
- **Actores:** ventanilla, mensajería, receptor.
- **Capacidades:** ciclo completo de planilla (BM-B18) · radicados sin planilla (BM-B19) · custodia y escaneo firmado (BM-B06/B07).
- **Reutiliza:** `lib/planillas`, col. `ventanilla_planillas`. **Reemplaza:** control manual de entregas. **Simplifica:** un ciclo único de planilla. **Innova:** detección automática de radicados sin planilla.
- **Dependencias:** D1/D4 (documentos a distribuir), D9 (numeración de planilla).
- **SIMI:** detecta radicados pendientes de planilla. Decisión humana: firma de recibido.
- **Criterios de éxito:** % documentos con entrega registrada; radicados sin planilla (→0); tiempo de armado de planilla.

### D6 · Continuidad operativa
- **Objetivo:** operar aun con falla del sistema y regularizar sin perder trazabilidad.
- **Alcance:** modo contingencia, registro diferido, atención preferencial en contingencia.
- **Actores:** ventanilla, funcionario, ciudadano.
- **Capacidades:** modo contingencia (BM-B08) · radicación diferida (BM-B09) · preferencial (BM-B10, compartida con D1).
- **Reutiliza:** D1 (radicación), D9 (trazabilidad). **Reemplaza:** el registro en papel sin control. **Simplifica:** un solo "modo contingencia" coherente. **Innova:** cola de regularización con aviso al ciudadano al restablecer.
- **Dependencias:** D1, D9.
- **SIMI:** ninguna crítica (modo degradado). Decisión humana: verificación al regularizar.
- **Criterios de éxito:** % documentos de contingencia regularizados; tiempo de regularización; cero pérdidas.

### D7 · Servicio al Ciudadano
- **Objetivo:** que el ciudadano radique, consulte y sea notificado con transparencia.
- **Alcance:** consulta de estado (existe), portal ciudadano, notificaciones al ciudadano, PQRSD verbal.
- **Actores:** ciudadano, ventanilla.
- **Capacidades:** consulta por radicado/cédula (existe) · notificación de estado · portal ampliado · (futuro) autenticación ciudadana.
- **Reutiliza:** `app/consulta`, `lib/whatsapp`/`email`. **Reemplaza:** nada. **Simplifica:** un canal claro de estado. **Innova:** notificación proactiva; base para Carpeta Ciudadana.
- **Dependencias:** D3/D4 (estado y respuesta), D10 (integraciones).
- **SIMI:** asistente ciudadano (informativo, nunca decide). Decisión humana: la respuesta oficial.
- **Criterios de éxito:** % consultas resueltas en autoservicio; satisfacción; notificaciones entregadas.

### D8 · Inteligencia SIMI (transversal)
- **Objetivo:** asistir cada dominio (clasificar, redactar, alertar, controlar) sin decidir por el funcionario.
- **Alcance:** clasificación, borradores, alertas predictivas, control interno, RAG normograma.
- **Reutiliza:** `lib/ai`, `lib/simi`, `lib/simi-juridico`, aprobaciones/versiones. **Innova:** ventaja competitiva central; el referente no tiene IA.
- **Invariante:** IA sugiere / funcionario decide (Principio 9). Toda sugerencia es auditable (D9).
- **Criterios de éxito:** % sugerencias aceptadas; reducción de tiempo por tarea asistida; cero decisiones automáticas sobre actos administrativos.

### D9 · Gobernanza, Seguridad y Trazabilidad (transversal)
- **Objetivo:** que todo sea aislado por tenant, auditable y medible.
- **Alcance:** multi-tenant, roles/permisos, numeración legal (H3), trazabilidad, reportes MIPG, observabilidad.
- **Reutiliza:** `lib/seguridad`, `lib/permisos`, `lib/trazabilidad`, `lib/observabilidad`, `lib/reportes-mipg`, `lib/server/consecutivo-legal`. **Simplifica:** catálogo único de colecciones (hoy `firestore-schema.ts` declara 2 de ~15 → deuda a saldar). **Innova:** detector de consecutivos fantasma; KPIs predictivos.
- **Criterios de éxito:** cero fugas entre tenants; 100% acciones con huella; H3 cerrado (CI + barrida).

### D10 · Integraciones (futuro — no construir aún)
- **Objetivo:** interoperar con el ecosistema estatal cuando exista demanda real.
- **Alcance:** GOV.CO, Carpeta Ciudadana, firma electrónica certificada, interoperabilidad SGDEA.
- **Regla:** el modelo multi-tenant + foto de serie + identidad ya **no cierran puertas**; no se construye por especulación (YAGNI).

---

## Parte D — Plan Maestro reorganizado por capacidad

| Dominio | Iniciativas del Plan Maestro |
|---|---|
| **D1 Recepción** | BM-B14, BM-B03, BM-B10 |
| **D2 Clasificación** | BM-B02, BM-B32, BM-B11, BM-B01 (formato/numeración) |
| **D3 Trámite** | BM-B24, BM-B25, BM-B26, BM-B17, BM-B05, BM-B15, BM-B16 |
| **D4 Comunicaciones** | BM-B20, BM-B21, BM-B22, BM-B23, BM-B31 |
| **D5 Distribución** | BM-B18, BM-B19, BM-B06, BM-B07 |
| **D6 Continuidad** | BM-B08, BM-B09 |
| **D7 Ciudadano** | BM-B28 (ayuda), consulta/PQRSD verbal |
| **D9 Gobernanza** | BM-D01…D10 (deuda/seguridad/CI), catálogo de colecciones |

*(La tabla no autoriza nada; ordena el backlog por capacidad, no por fecha de
descubrimiento.)*

---

## Parte E — Roadmap de evolución por capacidades

Cada fase entrega **valor funcional completo** (una capacidad institucional
utilizable), no funcionalidades sueltas. El orden sigue valor + reutilización +
dependencias, no el orden del backlog.

- **Fase 0 — Cierre de Bloque 2 (precondición, no es capacidad nueva).** H3
  (CI + barrida en producción), branch protection, validación de la funcionaria
  (ventana 180 días). Descongela el desarrollo.
- **Fase 1 — Clasificación y Gestión Documental (D2).** Todo radicado nace bien
  clasificado con ciclo vital. *Por qué primero:* alto valor normativo, reutiliza
  el catálogo existente, habilita trámite y comunicaciones correctos. Depende de
  D1 (ya existe).
- **Fase 2 — Respuesta y Comunicaciones (D4).** El mayor salto de reducción de
  carga; consolida 4 piezas dispersas y reutiliza la firma ya iniciada en SIMI.
- **Fase 3 — Trámite y Bandejas (D3).** Bandejas claras + asignación asistida +
  términos. Cierra el flujo troncal.
- **Fase 4 — Distribución (D5) + Continuidad (D6).** Ciclo de planilla completo y
  modo contingencia; robustez operativa.
- **Fase 5 — Servicio al Ciudadano (D7).** Portal/consulta ampliada y
  notificación proactiva.
- **Fase 6 — Integraciones (D10).** Solo cuando exista demanda real.

*(SIMI (D8) y Gobernanza (D9) no son fases: evolucionan **dentro de cada fase**.)*

Cada fase, antes de codificar, exige la ficha completa de la capacidad (Parte F) y
superar las Cuatro Preguntas (ADR-0021). **Ninguna fase queda autorizada por este
documento.**

---

## Parte F — Ficha completa de la Capacidad 1 (ejemplo listo para decidir)

**Capacidad: Clasificación y Gestión Documental (D2)** — desarrollada al nivel que
exige la regla 3 antes de escribir código. Sirve de plantilla para las demás.

- **Objetivo:** que todo radicado nazca con serie/subserie correcta y ciclo vital
  (retención/disposición) conforme a la TRD, con SIMI sugiriendo y el funcionario
  validando.
- **Alcance:** clasificación en radicación y reclasificación posterior; catálogo
  TRD completo para las series que la ventanilla produce; retención/disposición.
  *Fuera de alcance:* administrar el archivo central completo de la entidad.
- **Actores:** funcionario (clasifica/valida), archivista (valida retención),
  SIMI (sugiere), ciudadano (indirecto).
- **Procesos involucrados:** radicar → SIMI sugiere serie+dependencia+retención →
  funcionario confirma → foto inmutable en el radicado → (si aplica) reclasificar
  con trazabilidad.
- **Reglas de negocio:** la serie se fija por tipo × destino (existe
  `sugerirSerieDocumental`); la foto de serie es inmutable (no reescribe histórico);
  retención/disposición provienen de la TRD, no se inventan; reclasificar deja
  huella (D9).
- **Modelo de datos:** evoluciona `lib/catalogos/series-documentales.ts`
  (serie/subserie/retención/disposición ya tipados) + la foto `SerieDocumentalAsignada`
  en el radicado (ya existe). Completar los 4 catálogos sin retención (BM-B32). Sin
  colección nueva.
- **Integraciones:** ninguna externa; interna con D1 (radicación) y D3 (competencia).
- **Riesgos + mitigación:** TRD aún en borrador → mantener `FUENTE_TRD` y actualizar
  al aprobarse (ya previsto); sugerencia IA errónea → validación humana obligatoria.
- **Dependencias:** D1 (existe); TRD aprobada (BM-B01/B02) para el catálogo completo.
- **Reutilización:** catálogo y foto de serie existentes; SIMI de clasificación.
- **Automatización SIMI:** sugerir serie/subserie/retención leyendo asunto+TRD;
  precargar. Decisión humana: validación archivística.
- **Criterios de éxito:** % radicados con serie válida (meta alta); % con
  retención/disposición (meta 100% de las series catalogadas); % sugerencias IA
  aceptadas sin corrección; cero reescrituras de clasificación histórica.
- **Cuatro Preguntas:** (1) problema real: clasificación incompleta hoy — sí ·
  (2) mejor solución: evolucionar el catálogo existente + IA, sin módulo paralelo —
  sí · (3) valor>complejidad: reutiliza casi todo, esfuerzo bajo-medio — sí ·
  (4) largo plazo: base normativa SGDEA y habilita trámite correcto — sí.

---

## Gobernanza

Este documento es **diseño**, no autorización. Mantiene vigentes ADR-0001 y
0014–0021. La secuencia acordada: **validar esta arquitectura → elegir la primera
capacidad → construir su ficha completa (si falta) → superar las Cuatro Preguntas →
autorización expresa → desarrollo**. El Bloque 2 permanece congelado hasta sus dos
evidencias (CI + barrida) y la validación de la funcionaria.
