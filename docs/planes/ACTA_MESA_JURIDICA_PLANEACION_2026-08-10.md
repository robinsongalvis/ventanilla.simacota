# Acta de insumos — Mesa de trabajo Jurídica + Planeación (10-ago-2026)

**Fuente:** organización de la transcripción de la reunión, entregada por el propietario el 10-ago-2026.
**Estatus probatorio:** insumo **verbal-relatado**. NO es el concepto escrito de Jurídica: registra la
posición de la mesa tal cual se expuso, sin adjudicar. Donde contradice el texto literal de la norma,
la contradicción se documenta y **nada se activa** hasta el concepto escrito (regla vigente desde
`respuestas-juridica-licencia-construccion.md` y ADR-0029, hueco ⚖️ 1).

---

## Transcripción del insumo (VERBATIM, sin edición)

### 1. Dinámica del Acta de Observaciones y Reinicio de Plazos

> El equipo técnico maneja una lógica de "reinicio" para proteger el tiempo de respuesta de la
> administración frente a los plazos del ciudadano:
>
> - Plazo de la Administración: Planeación cuenta originalmente con 45 días hábiles para dar
>   respuesta a la radicación inicial.
> - Emisión en el límite: Si el Ingeniero (Javi) agota todo su plazo y emite el Acta de
>   Observaciones exactamente en el día 45, el trámite entra en suspensión.
> - Plazo del Solicitante: El ciudadano tiene un término máximo de 30 días calendario/hábiles
>   para radicar sus subsanaciones.
> - El "Reinicio" según la mesa: Al momento en que el peticionario radique su respuesta a las
>   observaciones (por ejemplo, en el día 15 de su plazo), la administración vuelve a tener 45
>   días hábiles completos para revisar, tramitar las subsanaciones y dar una respuesta final.
>   No heredan un saldo de cero días.
> - Incumplimiento del Ciudadano: Si el peticionario radica sus documentos después de vencidos
>   sus 30 días de plazo, el sistema debe declarar la solicitud en situación de desistimiento y
>   proceder al archivo automático del expediente.

### 2. Tabla Matriz de Vigencias por Tipo de Licencia

> | Tipo / Modalidad de Licencia | Vigencia Inicial | Prórroga Permitida | Regla de Control Temporal para la Prórroga |
> |---|---|---|---|
> | Construcción (Obra Nueva) | 36 meses | 12 meses | Debe solicitarse obligatoriamente 1 mes antes del vencimiento. |
> | Urbanización | 36 meses | 12 meses | Debe solicitarse obligatoriamente 1 mes antes del vencimiento. |
> | Construcción (Otras Modalidades / Ampliación) | 24 meses | (Sujeto a regla general) | (Sujeto a regla general) |
> | Subdivisión (Urbana y Rural) | 12 meses (1 año) | No tiene | El sistema debe bloquear cualquier solicitud de prórroga. |
>
> Nota del caso planteado en la mesa: Si al ciudadano le faltan solo 8 días para que se le venza
> la licencia e intenta pedir la prórroga, el sistema debe rechazarla por extemporánea, ya que la
> mesa definió que el límite de solicitud es un mes antes.

### 3. Silencio Administrativo Positivo (SAP)

> - Activación: Si la Secretaría de Planeación cumple y agota los 45 días hábiles asignados (o los
>   45 días posteriores a la subsanación, según su interpretación) sin emitir ni notificar una
>   respuesta oficial, se configura el silencio administrativo positivo.
> - Efecto: La licencia queda aprobada automáticamente a favor del ciudadano.
> - Demostración de No Configuración: El sistema debe registrar de forma infalible que la
>   administración emitió y notificó la respuesta antes de que se cumpliera el último día del
>   plazo de los 45 días.

### 4. Roles, Firmas y Recursos (Contexto Simacota)

> Al no existir la figura de Curador Urbano en el municipio, la estructura operativa se define así:
>
> - Responsable Técnico y de Firma: El Ingeniero de Planeación (o el encargado asignado por temas
>   de salud) es el único que recibe, evalúa y firma las licencias.
> - Rol del Alcalde: La mesa enfatiza que "el Alcalde no tiene absolutamente nada que ver en eso",
>   lo que significa que el mandatario no interviene en la radicación, evaluación técnica ni firma
>   de la resolución que concede o niega la licencia.
> - Objetivo de Control del Sistema: El software debe llevar un control de tiempos impecable para
>   generar alertas preventivas, blindando al Ingeniero encargado ante posibles requerimientos u
>   objeciones de entes de control, especialmente de la Personería Municipal.

---

## Análisis contra la norma verificada (no adjudica — separa qué ratifica, qué contradice, qué falta)

### ✅ Qué RATIFICA la mesa (coincide con `INVESTIGACION_NORMATIVA_LICENCIAS.md`)

1. **Vigencias**: 36+12 obra nueva/urbanización; 24 otras modalidades; **subdivisión 12 meses
   IMPRORROGABLE con bloqueo de prórroga en el sistema** — coincide con el art. 2.2.6.1.2.4.1
   (par. 4). Nota: la mesa refuta de paso el error del borrador IA que decía "subdivisión 36 meses".
2. **Prórroga con antelación mínima** ("1 mes antes", caso de los 8 días rechazado por
   extemporáneo): coincide en dirección con el registro verificado ("radicar ≥30 días hábiles
   antes"). Queda una imprecisión de unidad: ¿"1 mes" o "30 días hábiles"? → al concepto escrito.
3. **SAP se evita NOTIFICANDO antes del vencimiento** (no basta emitir): coincide con CPACA y con
   el modelo (el sistema ya registra `fechaNotificacion` y exige `fechaFirmeza` para cerrar).
4. **45 días HÁBILES** para la administración: ratifica el registro del 6-ago.

### ⚠️ Qué CONTRADICE el texto literal de la norma (hueco ⚖️ 1 — SIGUE ABIERTO)

**El "reinicio de 45 días completos" tras la subsanación.** El art. 2.2.6.1.2.2.4 (D.1783/2021
art. 19) dice literalmente *"se suspenderá… se reanudará"* (remanente), concordante con concepto
MinVivienda 2022EE0054113. La mesa sostiene lo contrario (45 completos, "no heredan un saldo").
Es la SEGUNDA ratificación verbal del "reinicio" (la primera: 6-ago). **Riesgo concreto que el
concepto escrito debe resolver — y que es el blindaje que la propia mesa pide:** el cálculo del
SAP diverge entre las dos lecturas. Si el sistema computa con "reinicio" y un ente de control
(la Personería que la mesa menciona) computa con el texto literal, el SAP puede haberse
configurado SIN que la administración lo advierta — licencias aprobadas por silencio sin saberlo.
El control de tiempos "impecable" que la mesa exige es imposible de garantizar con la
interpretación en contradicción del texto, salvo que Jurídica la respalde POR ESCRITO con su
base legal. Mientras tanto: política dual sin default (como está), y la operación segura es
mostrar ambas fechas y alertar sobre la MÁS TEMPRANA.

### ❓ Qué queda AMBIGUO (precisar en el concepto escrito o con la mesa)

1. Plazo del ciudadano: la propia transcripción dice "30 días **calendario/hábiles**" sin decidir.
   (La norma: 30 días hábiles, ampliables 15.)
2. Unidad de la antelación de prórroga: "1 mes" vs "30 días hábiles" (≈6 semanas de diferencia).
3. **Firma**: la mesa dice que firma el **Ingeniero** ("el único que recibe, evalúa y firma");
   el registro del 6-ago decía **Secretario o Subsecretario** de Planeación, sin delegación del
   Alcalde. ¿El Ingeniero ES el Subsecretario/encargado, o firma por otra figura? Define el
   `actorRol` del acto final en el sistema.

### ❌ Qué NO respondió la mesa

1. **Apelación (hueco ⚖️ 4)**: "el Alcalde no tiene absolutamente nada que ver" se refirió a la
   EXPEDICIÓN (radicación/evaluación/firma). La pregunta de RECURSOS quedó sin respuesta:
   *si el ciudadano apela la decisión, ¿quién la resuelve? ¿o solo procede reposición?*
   El borrador IA decía "apelación ante el Alcalde" — la mesa parece apuntar lo contrario, pero
   no lo dijo. Una línea escrita de Jurídica lo cierra.
2. **Los bloqueadores de la migración NO son jurídicos y siguen abiertos con el ingeniero**:
   P4′ (qué hito jurídico es "TERMINADO"/"REVISADO"/sin estado), `LCR VISR`/`LRC` (1 registro
   c/u), y la **fuente de cédulas** de los solicitantes (decisión del propietario pendiente).

### 🔒 Implicación de invariante (no negociable, Principio 9)

"Archivo **automático** del expediente" por desistimiento: el sistema **NUNCA declara ni archiva
automáticamente**. El desistimiento es un acto administrativo (con recurso de reposición). Lo que
el sistema SÍ hará: detectar el vencimiento, alertar, y dejar preparado el proyecto de acto para
que el funcionario decida y firme — mismo patrón "el sistema propone, el funcionario decide" de
todo el proyecto. Esto además blinda al Ingeniero: cada archivo queda con acto firmado y trazable.

---

## Qué sigue

1. Concepto escrito de Jurídica (la guía en lenguaje sencillo ya está entregada al propietario:
   `Guia-preguntas-Juridica-licencias.docx`); con él se activa la política del término que
   corresponda, las vigencias como regla ejecutable y los recursos de las notificaciones.
2. Con el ingeniero (no requiere a Jurídica): P4′, `LCR VISR`/`LRC`, cédulas, correcciones del
   libro (25-0037 y 6 fechas).
3. Propuesta técnica disponible sin esperar el concepto (autorización del propietario): mostrar
   ambas fechas de vencimiento (suspensión/reinicio) y alertar sobre la más temprana; bloqueo de
   prórroga en subdivisión; alertas preventivas de término.
