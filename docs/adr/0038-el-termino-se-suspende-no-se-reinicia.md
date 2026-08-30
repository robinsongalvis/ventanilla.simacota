# ADR-0038 — El término se SUSPENDE, no se reinicia: lo dice el artículo

- **Estado:** ACEPTADO
- **Fecha:** 30-ago-2026
- **Decide:** el propietario, sobre la norma
- **Relacionado:** ADR-0029 (cierra su «hueco 1»), ADR-0037 (correos de hitos), ADR-0033 §4.6-bis

---

## 1. Contexto — un hueco que no era hueco

El ADR-0029 declaró abierto el «hueco 1»: qué le pasa al término de 45 días
hábiles cuando hay un acta de observaciones y el ciudadano subsana. Sin respuesta,
el sistema hizo lo prudente: calcular **las dos hipótesis** —suspensión con
reanudación, y reinicio a cero— y alertar siempre sobre la más temprana, para
proteger a la Administración.

Ese doble cómputo se construyó entero: motor, panel con las dos fechas, alerta
conservadora, y una nota en pantalla que decía que la interpretación *«sigue
pendiente de concepto escrito de Jurídica»*. Hubo además una contradicción verbal
de Jurídica sobre este mismo punto, que es la razón por la que se exigió concepto
escrito (RN-5).

**La norma lo dice expresamente.** Decreto 1077 de 2015, artículo 2.2.6.1.2.2.4:

> «levantará **por una sola vez**, si a ello hubiere lugar, un acta de observaciones»
>
> «El solicitante contará con un plazo de **treinta (30) días hábiles** para dar respuesta»
>
> «Este plazo podrá ser ampliado, a solicitud de parte, hasta por un término
> adicional de **quince (15) días hábiles**»
>
> **«Durante este plazo se suspenderá el término para la expedición de la licencia»**
>
> si no se responde: «la solicitud **se entenderá desistida** y en consecuencia se
> procederá a archivar el expediente mediante acto administrativo»

**«Se suspenderá».** En derecho administrativo el término es preciso: suspender es
parar y continuar donde iba. Reiniciar exigiría decirlo, y no lo dice.

## 2. Decisión

> **El término de 45 días hábiles se SUSPENDE con la comunicación del acta de
> observaciones y se REANUDA donde se detuvo. No se reinicia a cero.**
>
> Fundamento: D.1077/2015 art. 2.2.6.1.2.2.4. No es una interpretación: es el
> texto.

En consecuencia:

1. **El doble cómputo se retira.** `calcularVencimientoDual` deja de ofrecer dos
   hipótesis; el cómputo pasa a ser `SUSPENSION_REANUDACION`, con su cita.
2. **El panel muestra UNA fecha**, no dos, y cita el artículo en vez de decir
   «pendiente de concepto».
3. **La prórroga de 15 días hábiles se implementa**, porque la norma la
   contempla. Hoy solo vive en el texto del correo al ciudadano
   (`lib/email/templates/aviso-acta-observaciones.ts`, que ya la nombra): **el
   correo promete algo que el reloj no sabe hacer**. El cómputo tiene que
   conocerla.
4. **El acta es única** («por una sola vez») — ya está implementado y ya cita
   este mismo artículo.
5. **El desistimiento por no responder** — ya está implementado y ya cita este
   mismo artículo.

## 3. La regla rectora, escrita

> **Si la norma lo dice, se cita el artículo y se implementa.** No hace falta que
> nadie lo dicte. La interpretación de un tercero se pide cuando la norma calla;
> cuando la norma habla, se lee.

Los tres niveles son norma y los tres sirven de fundamento: **nacional** (ley),
**reglamentario** (decreto, resolución) y **municipal** (acuerdo). Un requisito
fundado en el Acuerdo Municipal 026 está tan fundado como uno del Decreto 1077.

## 4. La lección de las 19 citas

**Este artículo estaba citado DIECINUEVE VECES en el código** antes de este ADR.
Se usaba para el acta única, para el desistimiento tácito, para el plazo de 30
días, y hasta para nombrar los quince días de prórroga en el correo al ciudadano.

**Todo el artículo estaba dentro del proyecto — menos la frase que resolvía el
hueco.** Se construyó un doble cómputo entero, con su alerta conservadora y su
nota de «pendiente de concepto», para una pregunta que el mismo artículo ya citado
contestaba en una línea.

Nadie lo leyó completo. Se citaban sus pedazos.

> ### Regla nueva, hermana de «leer primero uno hecho a mano»
>
> **Cuando una norma se cite en el código, se lee el artículo COMPLETO la primera
> vez, no solo la frase que se necesita.** Un artículo es una unidad de sentido;
> sus frases sueltas no lo son.

La hermana mayor de esta regla nació el 29-ago-2026 leyendo la Licencia de
Subdivisión 2026-001: *cuando el sistema vaya a producir un documento que hoy se
hace a mano, leer primero uno hecho a mano*. Las dos dicen lo mismo desde dos
lados: **el original completo antes que el fragmento cómodo.**

## 5. Todo evento que mueva el plazo se ve y se avisa

**Una sola fuente, dos salidas. Nunca dos cálculos.**

Cualquier evento que altere el cómputo —el acta que suspende, la respuesta que
reanuda, la prórroga de 15 días del ciudadano, una prórroga del término de
decisión— debe:

1. **Reflejarse solo en el reloj.** El ingeniero abre el expediente y el reloj
   dice la verdad de hoy: cuánto queda, si está pausado, de quién es el turno,
   hasta cuándo. Sin que nadie recalcule nada a mano.
2. **Disparar solo el correo al ciudadano.** Sin que ningún funcionario tenga que
   acordarse.

El criterio de clasificación ya vive en un solo sitio
(`lib/motor-expedientes/semaforo-termino.ts`, extraído el 29-ago-2026 justo para
esto): la pantalla y el correo lo consultan, ninguno lo repite. Este ADR extiende
esa regla a los eventos que mueven el plazo.

### 5.1 El reloj detenido se VE

Ya implementado (29-ago-2026): con el término suspendido, la tarjeta muestra el
reloj parado —anillo a trazos, símbolo de pausa, de quién es el turno— en vez de
desaparecer. Desaparecer decía «aquí no hay nada», que es lo mismo que decía para
un expediente sin ancla, y son situaciones opuestas.

**Sin cuenta atrás, y es deliberado:** cuántos días quedaban al congelarse depende
de la serie de eventos, y el servidor todavía no manda ese dato. Cuando el cómputo
único lo calcule, la tarjeta podrá decir «le quedan N de 45» con fundamento.
Hasta entonces: antes no darlo que darlo inventado.

## 6. PRECONDICIÓN: sin destinatario no hay avisos automáticos

**Verificada en código, no supuesta.**

El expediente de licencias guardaba `solicitanteNombre` y `solicitanteDocumento` y
nada más. La decisión de comunicar lo decía literal: *«no se copia email al
expediente, proyección mínima D2»*. Un expediente sin radicado vinculado **no
tenía a quién escribirle, nunca, por diseño**.

> **El correo sale perfecto hacia nadie.**

Por eso la captura del contacto (punto 6 del encargo) es **PRECONDICIÓN** de los
avisos automáticos de este ADR, no una prioridad paralela. Construir el envío
automático sobre expedientes sin destinatario sería fabricar otra vez la familia
«construido e inalcanzable».

**Estado de la precondición:** cerrada el 30-ago-2026 —resolutor con precedencia,
captura obligatoria en el formulario, aviso en pantalla cuando no hay
destinatario— y probada. La precedencia vive en un solo sitio
(`lib/motor-expedientes/destinatario-expediente.ts`): el radicado manda siempre;
sin radicado manda la captura propia; y **sin correo en el radicado NO se cae a la
captura**, porque eso serían dos fuentes disfrazadas de una.

## 7. Consecuencias

- **El panel deja de mostrar dos fechas.** La funcionaria ve una, con su artículo.
  Se acaba la pregunta «¿y cuál de las dos es?».
- **Se retira la alerta conservadora** como mecanismo: existía para protegerse de
  una incertidumbre que ya no hay. La fecha única ES la exigente.
- **Cuatro sitios cambian**: el motor (`termino.ts`), el panel, el vigía y los
  correos. Por eso esto es un ADR y no un commit.
- **Se acepta un costo:** si algún día un concepto de autoridad competente
  contradijera esta lectura, habría que volver. Se asume, porque el texto es
  explícito y la alternativa —seguir calculando dos hipótesis para una pregunta
  resuelta— es peor.

## 8. Lo que este ADR NO decide

- **Cuántos días quedaban al suspender.** El cómputo tiene que derivarlo de la
  serie de eventos; el diseño de ese cálculo es implementación, no decisión.
- **Si Planeación usa la prórroga.** El sistema la implementa porque la norma la
  contempla; que se conceda o no es operativo.
- **Los requisitos del checklist.** La auditoría
  (`docs/licencias/auditoria-requisitos-checklist.md`) es documento de análisis:
  ningún requisito se toca hasta que el propietario lo consulte con la ingeniera
  de Planeación.

## Fuentes

- Decreto 1077 de 2015, art. 2.2.6.1.2.2.4 (redacción del D.1783/2021 art. 19)
- Ley 1437 de 2011 (CPACA) art. 87 — firmeza
- ADR-0029 (hueco 1, que este cierra) · ADR-0037 · ADR-0033 §4.6-bis
