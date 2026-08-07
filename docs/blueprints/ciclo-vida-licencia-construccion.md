# Ciclo de vida — Licencia de Construcción (insumo de diseño del motor)

> Insumo de diseño para la **fase de resolución** del motor de expedientes ([ADR-0026](../adr/0026-motor-generico-expedientes-administrativos.md) **D1**: la resolución es específica del trámite y se implementa **en código** con revisión de Gobierno Digital, **no** es configurable por datos).
>
> Fuentes: **documentos reales** de la Alcaldía (Resolución LC + Licencia + oficio de prórroga, sin datos personales — Ley 1581), respuestas **operativas** de la Secretaría de Planeación (ago-2026) y el **insumo de investigación normativa del 6-ago-2026** (Decreto 1077/2015 arts. 2.2.6.1.2.3.1, 2.2.6.1.2.2.4, 2.2.6.1.2.4.1-4.2; CPACA arts. 17, 84-85; Decretos 1783/2021 y 74/2025; conceptos Minvivienda).
>
> ⚖️ **Estado:** el insumo normativo resolvió las contradicciones previas **a nivel de investigación**, pero él mismo advierte que **no es un concepto jurídico oficial** y que la Oficina Jurídica debe **ratificar el texto consolidado vigente** de cada artículo antes de programar reglas. Los valores legales van a **configuración parametrizada**, nunca hardcodeados.

## Secuencia del trámite (fase de resolución) — modelo corregido

1. **Revisión previa** de completitud por Planeación (checklist `F-PGD-009`).
2. **Radicación en legal y debida forma** en Ventanilla → **arranca el término de 45 días hábiles**.
3. **Evaluación técnica.** Si hay observaciones → **acta de observaciones y correcciones** (art. 2.2.6.1.2.2.4) → **SUSPENDE el término** y abre subsanación del solicitante: **30 días hábiles + 15 de prórroga** a solicitud de parte.
   - **Subsana** → el término **se REANUDA** (mismo radicado, mismo expediente — no se reinicia).
   - **No subsana** → **desistimiento tácito** (art. 17 CPACA + art. 2.2.6.1.2.3.1) → **archivo por acto administrativo** (admite recurso de reposición). Para continuar, el interesado presenta **nueva solicitud = NUEVO radicado = nuevo término de 45 días**.
4. **RESOLUCIÓN LC** (aprueba/niega) — debe **expedirse Y NOTIFICARSE** antes de agotar el término neto.
5. **Notificación** — interesado, vecinos, edicto/publicación.
6. **Ejecutoria** — recursos (reposición/apelación) **10 días**; sin recurso → **en firme**.
7. **Expedición de la LICENCIA** (certificado).
8. **Vigencia** + **prórroga** (antes del vencimiento) o, ya vencida, **revalidación** (figura separada).

> 🔑 **Reconciliación de las versiones previas:** la práctica descrita por Planeación ("se reinicia con nueva radicación") corresponde al **camino del desistimiento** (paso 3b), no al mecanismo general: dentro del radicado el término **se suspende y reanuda**. Y la preferencia del ingeniero ("mantener el mismo radicado") **es exactamente lo que la norma prescribe** mientras el solicitante subsana dentro de la ventana — el radicado nuevo solo aparece tras el archivo. Ambas visiones quedan satisfechas por el modelo legal.

## Decisión de modelamiento del propietario (6-ago-2026)

1. **Modelo DUAL transitorio por bandera de configuración por proceso:** `LEGACY` (esquema actual: reinicio materializado con **nuevo radicado**) → objetivo final: **MISMO radicado** con reinicio del término. Los procesos existentes conservan su esquema.
2. **Semántica del evento de cambio: REINICIO a cero** (+45 hábiles desde el evento), declarada operativamente.
3. **Sin tope de reinicios** ("sí o sí se ayuda al ciudadano") — consistente con la investigación (no hay tope legal); el trámite nunca queda sin vencimiento activo.
4. **Competencia:** Secretario/Subsecretario de Planeación, sin delegación del Alcalde — consistente.
5. Calendario de **días hábiles con festivos de Colombia** — consistente (reutiliza `festivosColombia` + fix RS-1).

> ⚠️ **Tensión jurídica NO resuelta (gate para cablear la semántica):** el punto 2 ("reinicia a cero, no se suspende/reanuda") **contradice el mecanismo normativo investigado** (el acta de observaciones **SUSPENDE** y el término **se REANUDA** al subsanar — art. 2.2.6.1.2.2.4; el reinicio solo aparece tras desistimiento→archivo→nueva solicitud — art. 2.2.6.1.2.3.1 + CPACA art. 17). Además, "mismo radicado + reinicio a cero" es la configuración **más expuesta al SAP** si Jurídica no la respalda por escrito (un solicitante podría alegar que el término de la radicación original nunca se suspendió válidamente y venció). **Resolución de diseño:** el motor implementa **ambas semánticas** (`SUSPENDE_REANUDA` | `REINICIA_A_CERO`) tras bandera; **ninguna se cablea a producción** hasta la ratificación expresa de Jurídica (oficio §2.4).

## Los relojes

| Reloj | Inicio | Duración | Comportamiento | Estado |
|---|---|---|---|---|
| **R1 · Término para resolver** | **Radicación en legal y debida forma** | **45 días HÁBILES** (art. 2.2.6.1.2.3.1; concepto Minvivienda) — resuelve la contradicción hábiles/corridos a favor de **hábiles** | **Acta de observaciones → SUSPENDE** (subsanación 30 hábiles + 15 prórroga); pago de expensas → suspende (30 hábiles); citación a vecinos → suspende. No subsana → **desistimiento + archivo → nuevo radicado = nuevo término**. **Sin tope legal de reinicios** (no bloquear; **trazar** radicados sucesivos por predio/proyecto) | ⏳ ratificación Jurídica del texto consolidado |
| **R2 · Ejecutoria** | Notificación de la resolución | **10 días** de recursos | Firme si no hay recurso | Observado en documentos reales |
| **R3 · Vigencia de la licencia** | Firmeza / expedición | Ver tabla de vigencias abajo | **Prórroga**: solicitarla **a más tardar 30 días HÁBILES antes** del vencimiento. **Revalidación**: tras el vencimiento (figura separada) | ⏳ ratificación Jurídica (texto consolidado por fecha del expediente) |

### Tabla de vigencias (Decreto 1783/2021 — verificar texto consolidado)

| Tipo | Vigencia | Prórroga | Total |
|---|---|---|---|
| Urbanización / parcelación / **construcción obra nueva** | **36 meses** | **12 meses** (1 vez) | **48 meses** |
| Construcción en otras modalidades (p. ej. **ampliación**) e intervención de espacio público | **24 meses** | 12 meses (1 vez) | 36 meses |
| Urbanización/parcelación en saneamiento · Subdivisión | 12 meses | No prorrogable | 12 meses |

> **Transitorio (Decreto 74/2025):** habilitó una **segunda prórroga** (12 meses) y amplió la ventana de revalidación, con **solicitudes hasta el 30-jun-2026** — fecha **ya vencida** para solicitudes nuevas, pero aplicable a expedientes que la ejercieron. → **Parametrizar por fecha**, no asumir un régimen único.

### Revalidación (la figura detrás de los "6 meses" — NO codificar "6 meses")

- Es un **acto administrativo nuevo** para terminar la obra con **licencia ya vencida** (art. 2.2.6.1.2.4.2). No es prórroga ni extensión automática.
- **Se solicita expresamente** dentro de la ventana de gracia: **2 meses** tras el vencimiento en el texto base (D. 1783/2021); ampliada transitoriamente por D. 74/2025. La cifra "6 meses" corresponde a **versiones anteriores** del régimen → la ventana va a **configuración**, resuelta por fecha, ratificada por Jurídica.
- Requisitos: **avance de obra ≥ 50%** (estructura/urbanismo) con soporte; Formulario Único; licencia anterior; certificado de libertad reciente; cuadro de áreas ejecutado/pendiente. La obra revalidada se sujeta a las **normas vigentes al momento de la nueva solicitud**.
- **Modelado:** trámite **separado** con su **propio radicado y máquina de estados**, vinculado a la licencia "padre"; habilitado solo si (i) licencia vencida, (ii) dentro de la ventana, (iii) avance ≥50% registrado.

## Silencio administrativo positivo (SAP) — reglas para el sistema

Se configura si la autoridad **no resuelve NI notifica** dentro de los 45 días hábiles **netos** (descontadas suspensiones válidas) — arts. 84-85 CPACA + art. 2.2.6.1.2.3.1. Condiciones jurisprudenciales: **(a)** que no haya existido **ningún pronunciamiento** (el acta de observaciones ya es pronunciamiento y suspende → no hay SAP); **(b)** que lo pedido sea **viable urbanísticamente** (el SAP no legaliza lo que viola el POT).

| Regla | Implementación |
|---|---|
| Reloj neto en días hábiles | Solo hábiles desde radicación en debida forma; excluir sábados/domingos/festivos (calendario colombiano) |
| Suspensiones automáticas | Acta de observaciones (30+15 hábiles del solicitante); comprobantes de expensas/impuestos (30 hábiles); reanudar al recibir respuesta |
| Alertas tempranas | **60% / 80% / 90%** del término neto disponible |
| Control de notificación | El sistema controla la fecha de **NOTIFICACIÓN**, no solo la de firma |
| Trazabilidad probatoria | Cada evento con fecha/hora y actor (radicación, acta, respuesta, reanudación, decisión, notificación) — permite **demostrar** que no se configuró SAP |

## ⚠️ Hallazgo de diseño — la alerta "1 mes antes" llega TARDE

Planeación pidió alertar **1 mes antes** del vencimiento de la licencia para que el titular pida la prórroga. Pero la prórroga debe solicitarse **a más tardar 30 días HÁBILES antes** del vencimiento (~6 semanas calendario). Una alerta a 1 mes calendario llegaría **cuando la ventana de prórroga ya cerró**. Diseño propuesto: **alerta principal ≥2 meses antes** del vencimiento (parametrizable) + recordatorio antes del cierre real de la ventana + alerta post-vencimiento para la ventana de **revalidación**. → Validar con Planeación.

## Estructura de los documentos que el motor deberá generar

### Resolución LC (acto administrativo)
- **Encabezado:** entidad, "RESOLUCIÓN", Nº LC, fecha, paginación (N de M).
- **Marco legal:** Art. 99 Ley 388/1997; Decretos 1077/2015, 1783/2021, 2218/2015, 097/2006, 1469/2010; Acuerdo Municipal 013/2003 (EOT); Resolución 0463/2017 (Formulario Único).
- **CONSIDERANDO** · **RESUELVE** (aprobar; vigencia; normas propias; cuadro de áreas; conceder; responsables; responsabilidad civil; notificación a interesado+vecinos; sellamiento; NSR-10/EOT; prohibiciones; recursos 10 días; aislamientos).
- **CONSTANCIA DE EJECUTORIA** (notificación, firmeza, ejecutoria).
- **Firma** del Secretario de Planeación e Infraestructura (o **Subsecretario**). **Competencia propia de Planeación — el Alcalde no interviene** (confirmado por Planeación; citar acto interno de funciones si existe).
- Además: **acta de observaciones** (art. 2.2.6.1.2.2.4) y **acto de archivo por desistimiento** (con recurso de reposición) — salidas intermedias que el motor también genera.

### Licencia (certificado)
- Encabezado + "LICENCIA" · Nº · fecha inicio/**vencimiento** · expedidor · predio · **cuadro de áreas** · titulares y profesionales (matrícula) · **OBSERVACIONES** estándar · firma + "Elaboró".

## Parámetros para el motor (configuración, NO constantes)

```
termino.dias                      = 45
termino.unidad                    = HABILES        # investigación (D.1077 + Minvivienda); ⏳ ratificar Jurídica
termino.hito                      = RADICACION_EN_LEGAL_Y_DEBIDA_FORMA   # tras verificar completitud ✅
termino.semanticaCambio           = REINICIA_A_CERO | SUSPENDE_REANUDA   # bandera. Decisión operativa 6-ago = REINICIA_A_CERO; norma investigada = SUSPENDE_REANUDA (acta, art. 2.2.6.1.2.2.4). ⏳ la ratificación de Jurídica decide cuál se ACTIVA — ninguna a prod antes
radicado.modelo                   = LEGACY_NUEVO_RADICADO | MISMO_RADICADO   # bandera por proceso (decisión 6-ago: dual transitorio; objetivo = MISMO_RADICADO)
subsanacion.dias                  = 30 HABILES     # + 15 de prórroga a solicitud de parte (aplica en semántica SUSPENDE_REANUDA)
suspension.expensas_dias          = 30 HABILES
desistimiento                     = NO_SUBSANA → archivo por acto (recurso de reposición) → nueva solicitud = NUEVO radicado = nuevo término
reinicios.tope                    = SIN_TOPE_LEGAL # no bloquear; trazar radicados sucesivos por predio/proyecto
sap.alertas                       = {60%, 80%, 90%} del término neto
sap.control                       = fecha de NOTIFICACION (no solo firma)
vigencia.obra_nueva               = 36m + prórroga única 12m = 48m       # D.1783/2021
vigencia.otras_modalidades        = 24m + 12m = 36m
vigencia.saneamiento_subdivision  = 12m, no prorrogable
prorroga.solicitarAntesDe         = 30 días HABILES antes del vencimiento
prorroga.segunda_transitoria      = D.74/2025 (solicitudes hasta 30-jun-2026, YA VENCIDA para nuevas) → resolver por fecha
alerta.previaVencimiento          = ≥2 MESES antes (parametrizable)      # "1 mes" llega tarde para la prórroga — ver hallazgo
revalidacion.ventana              = 2 meses base (D.1783/2021) / ampliada por D.74/2025 → POR FECHA, ⏳ ratificar; NO codificar "6 meses"
revalidacion.avanceMinimo         = 50%
revalidacion.tramite              = SEPARADO, radicado propio, vinculado a licencia padre
```

## Mapeo a ADR-0026 (qué implica para el motor)

- **Valida el diseño D5:** el régimen de subsanación de licencias (**30+15 días hábiles**, suspende/reanuda) es **distinto** del de Ley 1755 (1 mes calendario, PQRSD) — exactamente la razón por la que `RegimenSubsanacion` es parametrizado y **no** se reutiliza el reloj PQRSD.
- **Deuda #3 (§A2):** el consumidor genérico de `terminos {días, unidad}` opera con unidad **HÁBILES** y debe soportar **suspensión/reanudación con término neto** — requisito nuevo identificado. No cablear hasta la ratificación.
- **Radicados sucesivos:** el expediente (D3) enlaza **uno o más radicados en el tiempo** (desistimiento → nueva solicitud). El consecutivo legal no se ve afectado (cada radicación consume serie normalmente; guard D9 vigente).
- **Revalidación** = **Definición de Trámite adicional** en intake + desenlace propio en resolución (D9: trámite nuevo sin tocar el núcleo).
- **Precondición restante para construir la resolución:** **ratificación por escrito de la Oficina Jurídica** del texto consolidado (el propio insumo la exige). Los valores viven en configuración parametrizada para absorber la ratificación sin re-desplegar.
- **⚠️ Riesgo operativo VIGENTE detectado (verificación 6-ago):** la ruta de subsanación actual (`lib/server/subsanacion.ts` + plantillas de email) aplica **Ley 1755 (1 mes, ventana de 10 días)** a *cualquier* radicado, y `LICENCIA_CONSTRUCCION` es radicable hoy — un requerimiento sobre una licencia citaría **plazos y fundamento legal incorrectos**. Mitigación en tarea aparte (parametrizar régimen por tipo o bloquear el caso especial); no depende de la ratificación para mitigarse.
