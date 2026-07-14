# Plan Maestro de Evolución de la Plataforma — Documento Rector

**Estado:** DISEÑO — rige la gobernanza vigente (ADR-0001, 0014–0022). **No
autoriza implementación.** Es el documento rector de la evolución: consolida, para
cada **capacidad institucional**, su ficha arquitectónica completa, su balance de
deuda/complejidad/valor neto y el mapa de relaciones. Solo cuando estén todas las
fichas y el mapa se decide la **primera capacidad**.

## Arquitectura documental (para no duplicar)

- **Este documento (rector):** fichas arquitectónicas por capacidad + mapa de
  relaciones. Responde *qué es cada capacidad y cómo se relaciona*.
- **[`ARQUITECTURA_FUNCIONAL_OBJETIVO.md`](ARQUITECTURA_FUNCIONAL_OBJETIVO.md):**
  la vista de arquitectura (10 dominios, diagrama, roadmap por fases). Responde
  *cómo encaja todo y en qué orden*.
- **[`BACKLOG_MAESTRO.md`](BACKLOG_MAESTRO.md):** inventario de iniciativas BM-*
  (las piezas). Responde *qué trabajo concreto alimenta cada capacidad*.

Las **capacidades** son la unidad de entrega; los **BM-*** son sus piezas. Cada
ficha referencia sus BM-*. Convención del balance: **VN = Valor Neto** (institución).

---

## C1 · Clasificación y Gestión Documental (dominio D2)  ·  BM-B02, B32, B11, B01

- **Propósito institucional:** que cada documento quede correctamente clasificado
  (serie/subserie TRD) y con su ciclo vital (retención/disposición), como exige el
  SGDEA.
- **Problema que resuelve:** hoy la clasificación es parcial (4 de 6 series sin
  retención/disposición) y manual; sin ciclo vital completo no hay gestión
  archivística válida.
- **Justificación:** **J1** (Ley 594/2000, AGN) · **J4** (evita corrección manual
  posterior) · **J5** (clasificación asistida por IA, ventaja sobre el referente).
- **Actores:** funcionario (clasifica), archivista (valida retención), SIMI
  (sugiere), ciudadano (indirecto).
- **Procesos impactados:** radicación (clasificación al nacer), reclasificación,
  transferencias documentales, respuesta (serie de la comunicación).
- **Reglas de negocio:** serie por tipo × destino; foto de serie inmutable;
  retención/disposición provienen de la TRD (no se inventan); reclasificar deja
  huella.
- **Reutiliza:** `lib/catalogos/series-documentales.ts` (serie/subserie/retención/
  disposición ya tipados), foto `SerieDocumentalAsignada`, SIMI de clasificación.
- **Reemplaza:** selección 100 % manual de serie.
- **Consolida:** clasificación de serie + sugerencia de dependencia + retención en
  un **flujo único "clasificar radicado"**.
- **Simplificaciones:** un paso en lugar de tres pantallas; catálogo tipado único.
- **Automatización SIMI:** sugiere serie/subserie y retención leyendo asunto + TRD;
  precarga. Decisión humana: validación archivística.
- **Modelo de datos:** evoluciona el catálogo existente + foto en el radicado. Sin
  colección nueva. Completar 4 catálogos sin retención (BM-B32).
- **APIs e integraciones:** interna con radicación (`app/api/radicacion`); sin
  integración externa. Futuro: interoperabilidad SGDEA (D10).
- **Dependencias:** funcional → D1 (nace en radicación); técnica → TRD aprobada
  (BM-B01/B02).
- **Riesgos:** TRD en borrador (mitigar con `FUENTE_TRD` versionada, ya previsto);
  sugerencia IA errónea (validación humana obligatoria).
- **Criterios de éxito medibles:** % radicados con serie válida; % con retención/
  disposición (meta 100 % de series catalogadas); cero reescrituras de histórico.
- **KPIs:** tasa de aceptación de la sugerencia IA sin corrección; % clasificación
  completa al radicar.
- **Costo de mantenimiento:** **bajo** — actualizar catálogo al aprobarse la TRD.
- **Impacto en arquitectura:** refuerza el núcleo documental; base para D3 y D4.
- **Crecimiento futuro:** habilita transferencias, eliminación reglada y
  reportes archivísticos.
- **Balance:** *Elimina deuda:* clasificación incompleta. *Genera deuda:* mínima
  (mantener catálogo). *Complejidad que incorpora:* baja (datos + prompt IA).
  *Complejidad que elimina:* selección manual dispersa. **VN: Alto** (cumplimiento
  + reutilización casi total).

## C2 · Respuesta y Comunicaciones (dominio D4)  ·  BM-B20, B21, B22, B23, B31

- **Propósito institucional:** un único dominio para toda comunicación (interna y
  externa) con numeración, plantilla, firma, notificación y acuse.
- **Problema que resuelve:** hoy oficios manuales y consecutivos por fuera; firma y
  respuesta viven en piezas dispersas (riesgo de numeración y de firma no trazable).
- **Justificación:** **J2** (necesidad operativa) · **J4** (elimina redacción en
  blanco y búsqueda de consecutivo) · **J1** (firma/trazabilidad, AGN).
- **Actores:** funcionario redactor, firmante autorizado, ciudadano/destinatario,
  SIMI.
- **Procesos impactados:** respuesta a PQRSD, comunicaciones internas, oficios de
  salida, circuito de firma, notificación.
- **Reglas de negocio:** consecutivo legal único (H3); firma solo por cargo
  autorizado (BM-B31); toda comunicación deja huella y acuse.
- **Reutiliza:** `lib/respuesta-oficial`, `lib/salidas` (+`ventanilla_salidas`),
  `simi_respuestas_firma`+`simi-digital-signature` (**firma ya iniciada**),
  `lib/email`+`lib/whatsapp`, `lib/server/consecutivo-legal` (H3).
- **Reemplaza:** oficios manuales sueltos y consecutivos fuera del sistema.
- **Consolida:** 4 features aisladas (respuesta, salida, firma, notificación) → **1
  dominio** con remitente/consecutivo/firma/notificación compartidos.
- **Simplificaciones:** un solo circuito de emisión; plantillas reutilizables.
- **Automatización SIMI:** genera borrador de respuesta/comunicación. Decisión
  humana: aprobación y firma.
- **Modelo de datos:** unifica respuesta + salida sobre el radicado; reutiliza
  colecciones de firma existentes; consecutivos por dependencia (BM-B21).
- **APIs e integraciones:** `app/api/salidas`, notificaciones email/WhatsApp;
  futuro: firma electrónica certificada (D10).
- **Dependencias:** funcional → D3 (nace del trámite), D2 (serie); técnica → H3
  cerrado, catálogo de firmantes (BM-B31).
- **Riesgos:** unicidad del consecutivo (helper H3 probado); firma no repudiable
  (validación normativa del circuito).
- **Criterios de éxito medibles:** % comunicaciones emitidas desde la plataforma;
  reprocesos por numeración → 0; % con firma trazable.
- **KPIs:** tiempo medio de emisión de un oficio; consecutivos manuales eliminados.
- **Costo de mantenimiento:** **medio** (menor que 4 features sueltas — favorece
  consolidar).
- **Impacto en arquitectura:** unifica un área hoy fragmentada; punto de mayor
  reducción de carga.
- **Crecimiento futuro:** habilita firma electrónica e interoperabilidad SGDEA sin
  rediseño.
- **Balance:** *Elimina deuda:* dispersión respuesta/salida/firma. *Genera deuda:*
  el dominio unificado (encapsulado). *Complejidad que incorpora:* media (circuito
  de firma). *Complejidad que elimina:* consecutivos y oficios manuales. **VN: Muy
  Alto.**

## C3 · Trámite y Gestión Interna (dominio D3)  ·  BM-B24, B25, B26, B17, B05, B15, B16

- **Propósito institucional:** que cada radicado avance por bandejas claras, con
  términos legales visibles, hasta su cierre.
- **Problema que resuelve:** seguimiento de términos y de "radicados sin dueño" hoy
  es manual/frágil.
- **Justificación:** **J1** (términos Ley 1755) · **J4** (menos seguimiento manual)
  · **J2** (operación diaria).
- **Actores:** funcionario, jefe de dependencia, SIMI.
- **Procesos impactados:** asignación/reasignación, bandejas, control de términos,
  devoluciones.
- **Reglas de negocio:** término legal por tipo; override justificado (BM-B15);
  devolución con motivo; asignación notificada (BM-B17).
- **Reutiliza:** `lib/mi-gestion`, `lib/mostrador`, `lib/proxima-accion`,
  `lib/traslado`, `lib/tiempos-radicado`.
- **Reemplaza:** seguimiento manual de vencimientos.
- **Consolida:** bandejas Prioridad/Sin-Término/Devueltas en **un modelo único** de
  bandejas sobre el estado del radicado.
- **Simplificaciones:** una vista de bandejas coherente; catálogo de tipos ampliado
  (BM-B16).
- **Automatización SIMI:** sugiere dependencia competente; alertas predictivas de
  vencimiento. Decisión humana: asignación/reasignación.
- **Modelo de datos:** estado y bandeja sobre `ventanilla_radicados` (existe); sin
  colección nueva.
- **APIs e integraciones:** `app/api/dependencias` (asignación), notificaciones.
- **Dependencias:** funcional → D2 (competencia por clasificación); técnica →
  trazabilidad D9.
- **Riesgos:** cálculo de términos (ya existe base `tiempos-radicado`; probar
  festivos/prórrogas).
- **Criterios de éxito medibles:** % dentro de término; reducción de radicados sin
  asignar.
- **KPIs:** tiempo medio de asignación; % vencimientos evitados por alerta.
- **Costo de mantenimiento:** **medio** (reglas de términos evolucionan con norma).
- **Impacto en arquitectura:** cierra el flujo troncal D1→D2→D3→D4.
- **Crecimiento futuro:** base para SLA por serie y tableros predictivos.
- **Balance:** *Elimina deuda:* seguimiento manual. *Genera deuda:* reglas de
  términos a mantener. *Incorpora:* modelo de bandejas. *Elimina:* vistas ad-hoc.
  **VN: Alto.**

## C4 · Recepción y Radicación (dominio D1)  ·  BM-B14, B03, B10

- **Propósito institucional:** que todo documento entre una sola vez, bien
  identificado y con número legal, por cualquier canal.
- **Problema que resuelve:** captura manual repetida; canales no unificados; imagen
  fiel y atención preferencial incompletas.
- **Justificación:** **J1** (imagen fiel AGN, atención preferencial) · **J3**
  (radicar más rápido) · **J4** (precarga).
- **Actores:** ciudadano, recepcionista/ventanilla, funcionario.
- **Procesos impactados:** radicación presencial/web/verbal/correo; digitalización.
- **Reglas de negocio:** radicado dirigido (nace con destino); numeración legal
  110 radicadora; solicitante frecuente; imagen fiel.
- **Reutiliza:** `lib/radicacion`, `lib/radicado-institucional`, `lib/recepcion`,
  solicitante frecuente, H3.
- **Reemplaza:** nada (evoluciona).
- **Consolida:** un punto de captura para todos los canales.
- **Simplificaciones:** precarga y OCR reducen tecleo.
- **Automatización SIMI:** OCR extrae datos del escaneo; sugiere tipo/serie/destino;
  precarga solicitante. Decisión humana: radicar.
- **Modelo de datos:** `ventanilla_radicados` (existe); radicado externo (BM-B14)
  como variante controlada.
- **APIs e integraciones:** `app/api/radicacion`, `app/api/public`; futuro GOV.CO.
- **Dependencias:** funcional → D2 (clasificación al nacer); técnica → H3, storage.
- **Riesgos:** radicado externo vs. unicidad (intersecta H3 — controlar).
- **Criterios de éxito medibles:** % radicados con datos completos al primer
  intento; % con clasificación sugerida aceptada.
- **KPIs:** tiempo medio de radicación; % por canal.
- **Costo de mantenimiento:** **bajo-medio**.
- **Impacto en arquitectura:** puerta de entrada del flujo troncal.
- **Crecimiento futuro:** radicación GOV.CO / Carpeta Ciudadana.
- **Balance:** *Elimina deuda:* captura duplicada. *Genera deuda:* OCR (dependencia
  IA). *Incorpora:* OCR. *Elimina:* tecleo manual. **VN: Alto.**

## C5 · Distribución física — Planillas (dominio D5)  ·  BM-B18, B19, B06, B07

- **Propósito institucional:** control completo de la entrega física de documentos.
- **Problema que resuelve:** control de entregas y "radicados sin planilla" manual.
- **Justificación:** **J2** (operación) · **J1** (custodia/trazabilidad AGN).
- **Actores:** ventanilla, mensajería, receptor.
- **Procesos impactados:** armado de planilla, entrega, custodia, reimpresión,
  anulación.
- **Reglas de negocio:** una planilla del día; solo la funcionaria registra; firma
  de recibido; entregas parciales ruedan al día siguiente.
- **Reutiliza:** `lib/planillas`, `ventanilla_planillas`.
- **Reemplaza:** control manual de entregas.
- **Consolida:** ciclo de vida único de planilla (armar/reimprimir/entregar/anular).
- **Simplificaciones:** detección automática de radicados sin planilla (BM-B19).
- **Automatización SIMI:** detecta pendientes de planilla. Decisión humana: firma de
  recibido.
- **Modelo de datos:** `ventanilla_planillas` (existe) + estado de entrega.
- **APIs e integraciones:** `app/api/planillas`; escaneo de planilla firmada.
- **Dependencias:** funcional → D1/D4 (documentos a distribuir); técnica →
  numeración de planilla.
- **Riesgos:** custodia física fuera del sistema (mitigar con escaneo firmado).
- **Criterios de éxito medibles:** % documentos con entrega registrada; radicados
  sin planilla → 0.
- **KPIs:** tiempo de armado; % entregas con firma escaneada.
- **Costo de mantenimiento:** **bajo**.
- **Impacto en arquitectura:** soporte del trámite; cierra la trazabilidad física.
- **Crecimiento futuro:** ruteo y acuse digital de entrega.
- **Balance:** *Elimina deuda:* control manual. *Genera deuda:* mínima. *Incorpora:*
  ciclo de estados. *Elimina:* planillas sueltas. **VN: Medio-Alto.**

## C6 · Continuidad operativa (dominio D6)  ·  BM-B08, B09

- **Propósito institucional:** operar aun con falla del sistema y regularizar sin
  perder trazabilidad.
- **Problema que resuelve:** ante caída no hay modo degradado reglado.
- **Justificación:** **J2** (continuidad del servicio) · **J1** (no perder
  radicación legal).
- **Actores:** ventanilla, funcionario, ciudadano.
- **Procesos impactados:** radicación en contingencia, cola de regularización.
- **Reglas de negocio:** todo lo capturado en contingencia se regulariza con
  trazabilidad; aviso al ciudadano al restablecer.
- **Reutiliza:** D1 (radicación), D9 (trazabilidad).
- **Reemplaza:** registro en papel sin control.
- **Consolida:** un "modo contingencia" coherente (falla → diferido → preferencial).
- **Simplificaciones:** cola única de regularización.
- **Automatización SIMI:** mínima (modo degradado). Decisión humana: verificación al
  regularizar.
- **Modelo de datos:** cola de radicación diferida sobre `ventanilla_radicados`.
- **APIs e integraciones:** local/offline; sincroniza al restablecer.
- **Dependencias:** funcional → D1; técnica → D9.
- **Riesgos:** duplicados al sincronizar (control de idempotencia).
- **Criterios de éxito medibles:** % documentos de contingencia regularizados; cero
  pérdidas.
- **KPIs:** tiempo de regularización.
- **Costo de mantenimiento:** **bajo**.
- **Impacto en arquitectura:** robustez; no altera el flujo normal.
- **Crecimiento futuro:** operación offline ampliada.
- **Balance:** *Elimina deuda:* papel sin control. *Genera deuda:* lógica de sync.
  *Incorpora:* cola diferida. *Elimina:* improvisación. **VN: Medio.**

## C7 · Servicio al Ciudadano (dominio D7)  ·  BM-B28, consulta / PQRSD verbal

- **Propósito institucional:** que el ciudadano radique, consulte y sea notificado
  con transparencia.
- **Problema que resuelve:** consulta limitada; notificación no proactiva.
- **Justificación:** **J3** (mejora directa al ciudadano) · **J5** (transparencia).
- **Actores:** ciudadano, ventanilla.
- **Procesos impactados:** consulta de estado, notificación, radicación verbal.
- **Reglas de negocio:** consulta por radicado/cédula; no exponer datos reservados;
  notificación conforme a Ley 1437.
- **Reutiliza:** `app/consulta`, `app/directorio`, `lib/whatsapp`/`email`.
- **Reemplaza:** nada.
- **Consolida:** un canal claro de estado + ayuda in-app (BM-B28).
- **Simplificaciones:** autoservicio de consulta.
- **Automatización SIMI:** asistente ciudadano informativo (nunca decide). Decisión
  humana: la respuesta oficial.
- **Modelo de datos:** lectura sobre el radicado; sin colección nueva relevante.
- **APIs e integraciones:** `app/api/consulta`, `app/api/public`; futuro Carpeta
  Ciudadana / GOV.CO (D10).
- **Dependencias:** funcional → D3/D4 (estado y respuesta); técnica → seguridad D9.
- **Riesgos:** exposición de datos personales (control estricto D9).
- **Criterios de éxito medibles:** % consultas resueltas en autoservicio;
  notificaciones entregadas.
- **KPIs:** satisfacción; consultas presenciales evitadas.
- **Costo de mantenimiento:** **bajo-medio**.
- **Impacto en arquitectura:** cara externa; se apoya en D10 para crecer.
- **Crecimiento futuro:** portal ciudadano autenticado; Carpeta Ciudadana.
- **Balance:** *Elimina deuda:* consulta limitada. *Genera deuda:* superficie
  pública (seguridad). *Incorpora:* notificación proactiva. *Elimina:* consultas
  presenciales. **VN: Alto** (cara al ciudadano).

## C8 · Inteligencia SIMI (dominio D8 — transversal)

- **Propósito institucional:** asistir cada dominio (clasificar, redactar, alertar,
  controlar) sin decidir por el funcionario.
- **Problema que resuelve:** trabajo manual repetitivo y falta de anticipación.
- **Justificación:** **J4** (reduce carga) · **J5** (ventaja competitiva; el
  referente no tiene IA) · **J3** (respuestas más rápidas).
- **Actores:** todos los funcionarios; SIMI como copiloto.
- **Procesos impactados:** transversal (clasificación, respuesta, trámite, control
  interno, consulta).
- **Reglas de negocio:** **IA sugiere / funcionario decide** (Principio 9); toda
  sugerencia auditable; nunca decisiones administrativas automáticas.
- **Reutiliza:** `lib/ai`, `lib/simi`, `lib/simi-juridico`, RAG/normograma,
  aprobaciones/versiones (`simi_*`).
- **Reemplaza:** nada (potencia lo demás).
- **Consolida:** un motor de IA para todos los dominios (no IA por módulo).
- **Simplificaciones:** una capa de sugerencia común.
- **Automatización SIMI:** *es* la capacidad de automatización; se despliega dentro
  de cada fase.
- **Modelo de datos:** colecciones `simi_*` (auditoría, borradores, firma,
  notificaciones).
- **APIs e integraciones:** `app/api/ai`, `app/api/simi`; Gemini; WhatsApp.
- **Dependencias:** transversal; se apoya en D9 (auditoría).
- **Riesgos:** alucinación/decisión indebida (mitigado por validación humana +
  auditoría).
- **Criterios de éxito medibles:** % sugerencias aceptadas; cero decisiones
  automáticas sobre actos administrativos.
- **KPIs:** reducción de tiempo por tarea asistida.
- **Costo de mantenimiento:** **medio-alto** (modelos/prompts evolucionan).
- **Impacto en arquitectura:** ventaja central; capa transversal.
- **Crecimiento futuro:** RAG normativo ampliado; asistente ciudadano.
- **Balance:** *Elimina deuda:* tareas manuales. *Genera deuda:* mantenimiento de
  prompts/modelos. *Incorpora:* dependencia de IA. *Elimina:* trabajo repetitivo.
  **VN: Muy Alto** (diferenciador).

## C9 · Gobernanza, Seguridad y Trazabilidad (dominio D9 — transversal)

- **Propósito institucional:** que todo sea aislado por tenant, auditable y medible.
- **Problema que resuelve:** garantizar aislamiento, huella y cumplimiento MIPG;
  saldar la deuda de catálogo de colecciones.
- **Justificación:** **J1** (protección de datos, aislamiento, AGN) · **J2**
  (operación segura).
- **Actores:** administrador, auditor, todos los funcionarios (bajo permisos).
- **Procesos impactados:** transversal (auth, permisos, numeración legal,
  trazabilidad, reportes).
- **Reglas de negocio:** aislamiento por `tenantId` (invariante); toda acción con
  huella; numeración legal sin huérfanos (H3).
- **Reutiliza:** `lib/seguridad`, `lib/permisos`, `lib/auth-*`, `lib/trazabilidad`,
  `lib/observabilidad`, `lib/reportes-mipg`, `lib/server/consecutivo-legal`.
- **Reemplaza:** nada.
- **Consolida:** catálogo único de colecciones (hoy `src/types/firestore-schema.ts`
  declara 2 de ~15 reales → deuda a saldar).
- **Simplificaciones:** un catálogo canónico de colecciones e índices.
- **Automatización SIMI:** detección de patrones de control interno; KPIs
  predictivos. Decisión humana: acciones de control.
- **Modelo de datos:** `users`, `trazabilidad`, `seguridad_rate_limits`, `counters`,
  `simi_*_auditoria`.
- **APIs e integraciones:** `app/api/auth`, `app/api/reportes`, `app/api/cron`;
  observabilidad (Sentry).
- **Dependencias:** transversal; base de todos los dominios.
- **Riesgos:** fuga entre tenants (control estricto en reglas); H3 no cerrado (CI +
  barrida pendientes).
- **Criterios de éxito medibles:** cero fugas entre tenants; 100 % acciones con
  huella; H3 cerrado.
- **KPIs:** cobertura de auditoría; incidentes de seguridad.
- **Costo de mantenimiento:** **medio**.
- **Impacto en arquitectura:** cimiento; habilita D10 (identidad/seguridad).
- **Crecimiento futuro:** interoperabilidad y firma electrónica certificada.
- **Balance:** *Elimina deuda:* catálogo de colecciones incompleto; consecutivo
  fantasma (H3). *Genera deuda:* mínima. *Incorpora:* detector fantasma. *Elimina:*
  puntos ciegos de auditoría. **VN: Muy Alto** (base de confianza).

## C10 · Integraciones (dominio D10 — futuro, no construir aún)

- **Propósito institucional:** interoperar con el ecosistema estatal cuando exista
  demanda real.
- **Justificación:** **J1/J3** cuando se active (GOV.CO, Carpeta Ciudadana, firma
  electrónica, interoperabilidad SGDEA).
- **Reutiliza:** multi-tenant + foto de serie + identidad (D9/D2/D1 ya **no cierran
  puertas**).
- **Regla:** no se construye por especulación (YAGNI); se activa por demanda.
- **Balance:** *VN diferido* — su valor aparece cuando exista el requisito; mientras
  tanto, el diseño solo debe **no cerrar puertas**.

---

## Mapa de relaciones entre capacidades

Notación: **⤳ habilita · ∥ paralelo posible · ⊕ implementar juntas · ⏸ aplazable
sin afectar arquitectura.**

| Capacidad | Habilita (⤳) | Paralelo (∥) | Juntas (⊕) | Aplazable (⏸) |
|---|---|---|---|---|
| **C1 Clasificación (D2)** | C2, C3 (competencia y serie correctas) | C4 (radicación) | — | BM-B32 (solo completa datos) |
| **C2 Comunicaciones (D4)** | C7 (respuesta al ciudadano) | C5 (planillas) | firma+cargos (BM-B23⊕B31) | consecutivos por dependencia si urge |
| **C3 Trámite (D3)** | C2 (nace del trámite), C7 (estado) | C5 | bandejas B24⊕B25⊕B26 | override de días (BM-B15) |
| **C4 Recepción (D1)** | C1 (clasifica al nacer), C6 | C5, C7 | — | radicado externo (BM-B14) |
| **C5 Distribución (D5)** | — | C2, C3, C4 | — | ⏸ toda ella (soporte) |
| **C6 Continuidad (D6)** | — | C7 | B08⊕B09 | ⏸ hasta robustez operativa |
| **C7 Ciudadano (D7)** | — | C5, C6 | — | portal autenticado ⏸ (depende D10) |
| **C8 SIMI (D8)** | potencia C1/C2/C3/C4/C7 | — | evoluciona **dentro** de cada fase | — |
| **C9 Gobernanza (D9)** | habilita **todas** y a D10 | — | evoluciona **dentro** de cada fase | catálogo colecciones ⏸ (deuda acotada) |
| **C10 Integraciones (D10)** | — | — | — | ⏸ hasta demanda real |

**Lecturas del mapa:**
- **Cadena crítica:** C4 → **C1** → C3 → **C2** (entrada → clasificación → trámite
  → comunicación). C1 y C2 son los cuellos de valor.
- **Transversales, no fases:** C8 (SIMI) y C9 (Gobernanza) se construyen **dentro**
  de cada capacidad, no como etapa aparte.
- **Paralelizable:** C5 (Distribución) puede avanzar en paralelo a C2/C3 sin
  bloquear el troncal.
- **Aplazable sin daño arquitectónico:** C5, C6, y C10; y dentro de cada capacidad,
  las piezas marcadas ⏸.
- **Candidata natural a primera capacidad:** **C1 (Clasificación)** — habilita a C3
  y C2, reutiliza casi todo, esfuerzo bajo, cumplimiento normativo; ficha completa
  ya disponible (aquí y en la TFA, Parte F).

---

## Gobernanza

Documento **rector de diseño**, no autorización. Mantiene vigentes ADR-0001 y
0014–0022. Secuencia acordada: **validar las fichas y el mapa → elegir la primera
capacidad → superar las Cuatro Preguntas (ADR-0021) → autorización expresa →
desarrollo.** El Bloque 2 sigue congelado hasta CI + barrida (H3) y validación de
la funcionaria. Ninguna capacidad inicia por este documento.
