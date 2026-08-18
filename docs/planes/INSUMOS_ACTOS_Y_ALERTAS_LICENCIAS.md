# Insumos rescatados — Estructura de actos administrativos y alertas de licencias

> **Qué es este documento.** Rescate de los aportes del **PR #158** (rama
> `docs/insumos-y-diseno-fase2`, archivo `docs/blueprints/ciclo-vida-licencia-construccion.md`),
> cerrado por superado en todo lo demás. El triaje de agosto de 2026 verificó que estas
> tres secciones tienen **cobertura cero en `main`** y son el insumo exacto de la fase
> que aún falta construir: la **generación de actos administrativos** (resolución,
> licencia/certificado, constancias) del módulo de licencias.
>
> **Procedencia del contenido:** ingeniería inversa de **documentos reales** de la
> Alcaldía (Resolución LC + Licencia + oficio de prórroga, sin datos personales —
> Ley 1581), respuestas operativas de la Secretaría de Planeación (ago-2026) y la
> investigación normativa del 6-ago-2026 (Decreto 1077/2015 arts. 2.2.6.1.2.3.1,
> 2.2.6.1.2.2.4, 2.2.6.1.2.4.1-4.2; CPACA arts. 17, 84-85; Decretos 1783/2021 y
> 74/2025; conceptos Minvivienda).
>
> **Qué NO es.** No es un contrato congelado ni un blueprint aprobado: es un insumo
> de diseño. Los valores legales van a **configuración parametrizada**, nunca
> hardcodeados, y las materias marcadas ⚖️ en el ADR-0029 (efecto de la subsanación
> sobre el término — hueco 1; SAP — hueco 2; segunda instancia — hueco 4) siguen
> bloqueadas hasta el concepto escrito de Jurídica. Donde `main` ya materializó o
> matizó algo de lo aquí descrito, la sección
> [Verificación contra `main`](#verificación-contra-main-18-ago-2026) lo anota.

---

## 1. Estructura de los documentos que el motor deberá generar

*(Copia fiel del PR #158 — `docs/blueprints/ciclo-vida-licencia-construccion.md`.)*

### Resolución LC (acto administrativo)

- **Encabezado:** entidad, "RESOLUCIÓN", Nº LC, fecha, paginación (N de M).
- **Marco legal:** Art. 99 Ley 388/1997; Decretos 1077/2015, 1783/2021, 2218/2015,
  097/2006, 1469/2010; Acuerdo Municipal 013/2003 (EOT); Resolución 0463/2017
  (Formulario Único).
- **CONSIDERANDO** · **RESUELVE** (aprobar; vigencia; normas propias; cuadro de áreas;
  conceder; responsables; responsabilidad civil; notificación a interesado+vecinos;
  sellamiento; NSR-10/EOT; prohibiciones; recursos 10 días; aislamientos).
- **CONSTANCIA DE EJECUTORIA** (notificación, firmeza, ejecutoria).
- **Firma** del Secretario de Planeación e Infraestructura (o **Subsecretario**).
  **Competencia propia de Planeación — el Alcalde no interviene** (confirmado por
  Planeación; citar acto interno de funciones si existe).
- Además: **acta de observaciones** (art. 2.2.6.1.2.2.4) y **acto de archivo por
  desistimiento** (con recurso de reposición) — salidas intermedias que el motor
  también genera.

### Licencia (certificado)

- Encabezado + "LICENCIA" · Nº · fecha inicio/**vencimiento** · expedidor · predio ·
  **cuadro de áreas** · titulares y profesionales (matrícula) · **OBSERVACIONES**
  estándar · firma + "Elaboró".

---

## 2. Silencio administrativo positivo (SAP) — escalera de alertas y control

*(Copia fiel del PR #158.)*

Se configura si la autoridad **no resuelve NI notifica** dentro de los 45 días hábiles
**netos** (descontadas suspensiones válidas) — arts. 84-85 CPACA + art. 2.2.6.1.2.3.1.
Condiciones jurisprudenciales: **(a)** que no haya existido **ningún pronunciamiento**
(el acta de observaciones ya es pronunciamiento y suspende → no hay SAP); **(b)** que
lo pedido sea **viable urbanísticamente** (el SAP no legaliza lo que viola el POT).

| Regla | Implementación |
|---|---|
| Reloj neto en días hábiles | Solo hábiles desde radicación en debida forma; excluir sábados/domingos/festivos (calendario colombiano) |
| Suspensiones automáticas | Acta de observaciones (30+15 hábiles del solicitante); comprobantes de expensas/impuestos (30 hábiles); reanudar al recibir respuesta |
| Alertas tempranas | **60% / 80% / 90%** del término neto disponible |
| Control de notificación | El sistema controla la fecha de **NOTIFICACIÓN**, no solo la de firma |
| Trazabilidad probatoria | Cada evento con fecha/hora y actor (radicación, acta, respuesta, reanudación, decisión, notificación) — permite **demostrar** que no se configuró SAP |

---

## 3. Alerta de prórroga — hallazgo de diseño: la alerta "1 mes antes" llega TARDE

*(Copia fiel del PR #158.)*

Planeación pidió alertar **1 mes antes** del vencimiento de la licencia para que el
titular pida la prórroga. Pero la prórroga debe solicitarse **a más tardar 30 días
HÁBILES antes** del vencimiento (~6 semanas calendario). Una alerta a 1 mes calendario
llegaría **cuando la ventana de prórroga ya cerró**. Diseño propuesto: **alerta
principal ≥2 meses antes** del vencimiento (parametrizable) + recordatorio antes del
cierre real de la ventana + alerta post-vencimiento para la ventana de
**revalidación**. → Validar con Planeación.

---

## Verificación contra `main` (18-ago-2026)

Cada afirmación de las secciones rescatadas que roza código o decisiones que `main` ya
tiene, contrastada al momento del rescate (base: `origin/main` @ `4353a7d`). Sin
inventar: solo lo observado en los archivos citados.

### Sobre la sección 1 (estructura de documentos)

- **Cobertura cero confirmada.** Nada en `main` describe la anatomía de la Resolución
  LC ni del certificado, y nada los genera. Lo más cercano:
  `lib/motor-expedientes/estados-licencia.ts` modela los estados
  `NOTIFICADA → EN_FIRME` (CPACA art. 87) y exige `actoFinal.fechaFirmeza` para cerrar
  un expediente REAL (DF-6, ADR-0029) — es decir, `main` ya registra *que* el acto
  existe, se notifica y queda en firme, pero no *cómo es* el documento. Esta sección
  es el insumo para esa pieza faltante.
- El detalle de requisitos de intake (cuadro de áreas en planos, matrículas
  profesionales, etc.) sí existe en
  `lib/motor-expedientes/definiciones/licencia-construccion-parcial.ts`, pero como
  requisitos de **entrada**, no como estructura del acto de **salida**.

### Sobre la sección 2 (SAP: escalera 60/80/90 y control)

- **La escalera 60%/80%/90% no existe en `main`** (búsqueda en `docs/`, `lib/`,
  `app/`): sigue siendo diseño pendiente.
- **Lo que `main` sí tiene hoy** (`lib/motor-expedientes/termino.ts` +
  `lib/server/expedientes-licencias.ts`): un cómputo **dual** del vencimiento
  (`REINICIO_A_CERO` | `SUSPENSION_REANUDACION`, sin política por defecto) con una
  única `fechaAlertaConservadora` = la más temprana de ambas proyecciones. Es una
  *fecha* de alerta conservadora, no una escalera porcentual — la escalera rescatada
  la complementa, no la duplica.
- **Matiz importante:** la fila "Suspensiones automáticas" da por sentada la semántica
  suspende/reanuda. En `main` esa semántica es exactamente el **⚖️ hueco 1 del
  ADR-0029** (bloqueado hasta concepto escrito de Jurídica): `termino.ts` implementa
  ambas políticas sin activar ninguna, y los eventos DF-7 relacionados
  (p. ej. `ENTREGA_DOCUMENTOS_PAGO` — los "comprobantes de expensas" de la tabla) se
  reconocen pero son **INERTES** en el cómputo. El propio SAP es el **hueco 2**. La
  tabla rescatada describe el destino, no el estado actual: nada de ella debe
  cablearse antes de resolver esos huecos.
- La premisa "30+15 hábiles" del régimen de subsanación de licencias ya está
  materializada en `main` como reloj **parametrizado** por régimen
  (`lib/motor-expedientes/subsanacion-regimen.ts`, D5/ADR-0026) — coherente con la
  tabla. (Ojo: `lib/server/subsanacion.ts`, el reloj Ley 1755 de PQRSD, sigue siendo
  una pieza distinta; el PR #158 ya advertía no mezclarlos.)
- "Control por fecha de NOTIFICACIÓN, no solo firma": parcialmente materializado — la
  máquina de estados distingue `NOTIFICADA` de la expedición y la firmeza, pero no
  existe el control/alertado sistemático sobre esa fecha que la tabla propone.

### Sobre la sección 3 (alerta de prórroga)

- **El esquema de alertas propuesto (≥2 meses + recordatorio + post-vencimiento para
  revalidación) no existe en `main`**: no hay ninguna alerta previa al vencimiento de
  la vigencia. Sigue siendo diseño pendiente y aún debe validarse con Planeación.
- **Lo que `main` sí tiene hoy** (`lib/motor-expedientes/vigencias.ts`, activado
  10-ago-2026): `validarSolicitudProrroga` con antelación mínima
  `radicarDiasHabilesAntesMin: 30` (días **hábiles**, el dato con fuente documental
  verificada) y la ventana de revalidación de 2 meses como dato
  (`revalidacion.ventanaMesesTrasVencimiento: 2`). Es la *validación* al recibir la
  solicitud; la *alerta proactiva* de esta sección es la pieza que falta.
- **Divergencia declarada que afecta la aritmética del hallazgo:** el hallazgo asume
  "30 días HÁBILES ≈ 6 semanas". `vigencias.ts` registra una **discrepancia abierta**
  sobre la unidad: el registro normativo verificado dice 30 **hábiles**, pero el
  10-ago-2026 el propietario dictó "T-30 días **calendario**" y la mesa dijo "1 mes"
  — ninguna lectura verbal coincide con el dato verificado ni entre sí. `main`
  implementa el dato verificado (30 hábiles) con la unidad parametrizada a la espera
  del concepto de Jurídica. Consecuencia para el diseño de la alerta: si Jurídica
  fijara "30 calendario", la ventana sería ~4.3 semanas (no ~6) y el margen del
  hallazgo cambia de magnitud, aunque su conclusión cualitativa (una alerta a 1 mes
  llega tarde o justo al cierre de la ventana) se mantiene. La alerta debe calcularse
  **desde el parámetro**, nunca desde una constante.

---

*Rescatado el 18-ago-2026 del PR #158 durante el triaje de PRs antiguos. Documento de
origen: `docs/blueprints/ciclo-vida-licencia-construccion.md` (rama
`docs/insumos-y-diseno-fase2`). El resto de ese PR quedó superado por el ADR-0029, la
mesa Jurídica+Planeación del 10-ago-2026 y el motor de expedientes ya construido en
`main`, y no se rescata.*
