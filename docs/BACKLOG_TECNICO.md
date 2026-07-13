# Backlog técnico priorizado — pausa de consolidación post-Ola 2

- **Fecha:** 13 de julio de 2026
- **Estado:** CONGELAMIENTO VIGENTE — este documento es un artefacto de
  planificación. **NO autoriza implementación.** La ejecución de cualquier ítem
  requiere el levantamiento del congelamiento por el propietario y el triaje de
  proporcionalidad del Principio 1 en el momento de arrancar.
- **Elaborado por:** product-owner (planificación bajo congelamiento).
- **Fuente de verdad de los riesgos:** `docs/REGISTRO_RIESGOS.md`. Este backlog
  ordena; el registro traza. Si divergen, manda el registro.
- **Regla de contexto:** **2E está fuera de este backlog.** Su plan se presenta
  al propietario únicamente después de cumplidas sus dos precondiciones:
  (1) branch protection activa en `main` y (2) validación de la ventana de
  180 días con la funcionaria.

## Criterio de ordenación

Prioridad declarada del propietario para esta etapa: **institucionalizar lo
construido**. En consecuencia:

1. **Primero, lo que fortalece la gobernanza de la compuerta de despliegue**
   (ADR-0013): mientras el veredicto de la compuerta tenga puntos ciegos, la
   evidencia de todo lo demás vale menos. Endurecer la compuerta multiplica el
   valor de cada cierre posterior (todos pasan por ella).
2. **Después, los riesgos abiertos por severidad**, con desempate
   normativo > operativo > escala > mantenibilidad.
3. En igualdad, gana el ítem que **reutiliza un control existente** (menor
   esfuerzo por unidad de riesgo eliminado).

**Supuesto declarado (Principio 13):** no existe medición de esfuerzo; los
tamaños S/M/L son estimaciones por analogía con trabajos comparables de las
Olas 1–2 (S ≈ media jornada con pruebas; M ≈ 1–2 jornadas; L > 2 jornadas o
requiere ADR e infraestructura). Se medirá en retrospectiva al ejecutar.

## Tabla resumen (orden recomendado)

| # | Ítem | Qué elimina/aporta (Principio 2) | Sev. registro | Triaje | Esfuerzo | Dependencias | Bloque |
|---|------|----------------------------------|---------------|--------|----------|--------------|--------|
| 1 | **R14** — la compuerta confía en "suite verde" sin verificar que los tests declarados corrieron | Elimina el punto ciego del veredicto: hoy un test eliminado, renombrado o con `.skip` deja la categoría verde con cero controles ejecutados | BAJA (punto ciego del gate) | 2 | **S** | Ninguna; conviene ANTES de #2 y #3 (ambos tocan el informe) | Gobernanza |
| 2 | **R15a** — `storage.rules` fuera de la compuerta | Cierra un hueco de cobertura del veredicto en una superficie S2-relevante (adjuntos) | BAJA (cobertura del gate) | 2 | **M** | Patrón de ADR-0007 (existe); hacerlo tras #1 para no retrabajar el informe | Gobernanza |
| 3 | **Deuda ADR-0013** — E2E de stage no corre en CI (input manual) | Elimina el último input humano del veredicto: el estado "amber por E2E no reciente" pasa de registro manual a verificación automática (criterio de éxito v2: menos trabajo humano) | Deuda declarada | **3** (integración nueva → ADR) | **L** | Decisión del propietario sobre credenciales de stage en CI (ver §Decisiones); tras #1 | Gobernanza |
| 4 | **R3** — hueco de consecutivo AGN si la subida de adjunto no completa | Elimina el riesgo normativo abierto de mayor severidad (integridad del consecutivo, Acuerdo AGN 060/2001) | MEDIA | **3** (cambio de flujo de radicación; ante la duda, el superior) | **M** | Ninguna | Riesgo normativo |
| 5 | **R4** — backdrop del modal "Resumen del día" intercepta clics | Elimina una interferencia operativa diaria sobre la usuaria principal | MEDIA (UX/operativo) | 2 | **S–M** | Ninguna; afinidad con #8 (mismo frente frontend) | Riesgo operativo |
| 6 | **R13** — cron `alertas-vencimiento` lee sin cota (O(N)) | Elimina el residual de escala de R11; reutiliza el patrón 2A y el presupuesto de rendimiento existente (ADR-0010/0011) | BAJA-MEDIA (escala) | 2 | **S** | `presupuesto-rendimiento.mjs` (existe) | Escala |
| 7 | **R12** — `ocultarIdentidad` duplica el predicado de reserva | Elimina una brecha normativa LATENTE y SILENCIOSA (Ley 1581 art. 4 f/g): si las dos definiciones divergen, ningún test lo detecta | BAJA (latente, normativamente sensible) | 2 | **S** | Ninguna | Mantenibilidad normativa |
| 8 | **R5** — confirmación "✓ Asignado" puede no mostrarse (carrera React ↔ listener) | Elimina una incertidumbre de feedback operativo; patrón de estabilización ya probado en E2E 01 | BAJA | 2 | **S** | Patrón E2E 01 (existe); afinidad con #5 | Riesgo operativo |
| 9 | **R7** — robustez ante `termino.diasRespuesta` ausente | Elimina un riesgo teórico de robustez (campo hoy requerido y siempre poblado) | BAJA (teórico) | 1 | **S** | Ninguna; afinidad con #4 (mismo dueño backend) | Robustez |
| — | **R15b** — categoría IA/SIMI en la compuerta | Cobertura del invariante "IA asistiva, nunca automática" en el veredicto | BAJA | 2 | S–M | **BLOQUEADO**: requiere que aterrice P-D (gobernanza de IA). Interim: el informe debe declarar la cobertura pendiente, no callarla | Gobernanza (diferido) |
| — | **R10** — variante B de enmascaramiento | — | BAJA | — | — | **EN DECISIÓN del propietario** — no priorizable por este backlog (ver §Decisiones) | Producto |

## Detalle por ítem

### 1. R14 — Verificación de que los tests declarados por la compuerta existen y corren

- **Justificación (Principio 2):** elimina el riesgo de un veredicto verde
  falso. Hoy el mapeo normativo/observabilidad → "suite verde" no verifica que
  los 11 archivos de test declarados sigan existiendo, dentro del glob y sin
  `.skip`; el campo `evidencia` del informe es afirmación, no verificación.
  Verificado el 12 jul 2026 que hoy no ocurre — el control evita que ocurra
  mañana sin que nadie lo note.
- **Alcance orientativo:** control estático en `scripts/laboratorio/informe-despliegue.mjs`
  (existencia + no-`.skip` de cada test declarado por categoría) o piso de
  conteo de tests por categoría en vitest. La elección técnica es del
  arquitecto/devops, no de este documento.
- **Triaje estimado:** Nivel 2 (endurecimiento dentro del módulo del
  orquestador). **Esfuerzo:** S (supuesto: análogo a extender un script de CI
  existente, como en 2B).
- **Dependencias:** ninguna. Debe ir **antes** de R15a y de la deuda E2E-en-CI
  porque ambos modifican el mismo informe: hacerlo primero evita retrabajo.
- **Criterio de cierre objetivo:** existe un control en CI que pone la
  categoría (y el veredicto) en ROJO si un test declarado desaparece, sale del
  glob o queda en `.skip`. **Evidencia obligatoria (ciclo de hallazgos):**
  prueba por mutación — eliminar/renombrar/skipear un test declarado en una
  rama de prueba produce informe ROJO; restaurarlo lo devuelve a verde. Nota
  de actualización en ADR-0013 y cierre trazable de R14 en el registro.

### 2. R15a — `storage.rules` dentro de la compuerta

- **Justificación:** los adjuntos fueron un incidente ALTA real (S2); sus
  reglas de Storage hoy no tienen prueba de comportamiento ni categoría en el
  veredicto. Cierra un hueco de cobertura del gate en superficie sensible.
- **Alcance orientativo:** suite `rules-unit-testing` para `storage.rules` en
  el job `laboratorio-emulador` (patrón exacto de ADR-0007, incluida la
  política fila-por-regla) + su incorporación como insumo de la categoría de
  seguridad del informe.
- **Triaje estimado:** Nivel 2 (el patrón y la infraestructura ya existen).
  **Esfuerzo:** M (supuesto: análogo a la matriz inicial de ADR-0007).
- **Dependencias:** después de R14 (mismo informe). El emulador de Storage en
  CI puede requerir ajuste del job — si resultara integración nueva, el triaje
  sube a Nivel 3 al ejecutar.
- **Criterio de cierre objetivo:** matriz de pruebas de `storage.rules` verde
  en CI y consumida por el informe. **Evidencia:** mutación — voltear una
  regla de Storage a permisiva hace fallar la matriz y pone el informe en ROJO.
- **R15b (categoría IA):** queda **bloqueado** hasta que aterrice P-D
  (gobernanza de IA). Mientras tanto, el cierre de R15a debe dejar el informe
  **declarando** la cobertura IA como pendiente (amber documentado, no
  silencio) — un hueco declarado no es un punto ciego.

### 3. Deuda ADR-0013 — E2E de stage automatizado en CI

- **Justificación:** es el último eslabón manual del veredicto: hoy el
  resultado del E2E se registra a mano y el orquestador confía en ese
  registro. Automatizarlo elimina trabajo humano recurrente y el riesgo de
  registro desactualizado (criterio de éxito v2: más autonomía, menos
  intervención humana).
- **Alcance orientativo:** job de CI (programado o pre-deploy) que ejecuta
  Playwright contra stage con credenciales gestionadas como secretos; el
  informe consume el resultado automáticamente, verificando correspondencia
  de SHA.
- **Triaje estimado:** **Nivel 3** — integración nueva (credenciales de stage
  en CI, superficie de secretos) → exige ADR propio con revisión de seguridad
  ANTES de codear. ADR-0013 lo difirió explícitamente por riesgo/coste; ese
  juicio sigue vigente hasta que el ADR nuevo lo supere.
- **Esfuerzo:** L (supuesto: infraestructura + ADR + revisión de seguridad; sin
  medición previa de trabajos análogos en este repo).
- **Dependencias:** (a) decisión del propietario sobre credenciales de stage
  en CI (§Decisiones); (b) después de R14. Complementa —no sustituye— la
  branch protection, que es acción administrativa del propietario.
- **Criterio de cierre objetivo:** el informe de despliegue obtiene el estado
  del E2E sin intervención humana y marca amber/rojo por sí solo cuando falta
  corrida reciente contra el SHA candidato. **Evidencia:** una corrida real en
  CI referenciada por el informe sin registro manual + mutación (un E2E
  forzado a rojo degrada el veredicto).

### 4. R3 — Consecutivo AGN atómico respecto a la persistencia del radicado

- **Justificación:** es el riesgo abierto de mayor severidad (MEDIA) con
  anclaje normativo directo: un hueco en el consecutivo compromete la
  integridad exigida por el Acuerdo AGN 060/2001. El incremento hoy no es
  atómico respecto a la persistencia cuando la subida del adjunto no completa.
- **Alcance orientativo:** rediseño del orden transaccional en
  `lib/radicado-institucional.ts` / `lib/actions/radicarVentanilla.ts`
  (transacción o compensación). El diseño concreto es del arquitecto.
- **Triaje estimado:** **Nivel 3** — modifica el flujo de radicación, el
  corazón del sistema; ante la duda entre niveles se aplica el superior →
  ADR corto. **Esfuerzo:** M.
- **Dependencias:** ninguna. Paralelizable con el bloque de gobernanza
  (dueños distintos: dev-backend vs devops/qa). Afinidad con R7 (mismo dueño).
- **Criterio de cierre objetivo:** control automatizado que simula el fallo de
  la subida y verifica la invariante "sin hueco" (o el consecutivo no se
  consume, o el radicado persiste). **Evidencia:** el test reproduce el hueco
  en ROJO sobre el comportamiento actual (Principio 13: reproducir antes de
  corregir) y queda verde tras la corrección; permanece en la suite como
  control de regresión.

### 5. R4 — Backdrop del modal "Resumen del día"

- **Justificación:** severidad MEDIA operativa sobre la usuaria principal: un
  fetch asíncrono abre el modal en cualquier momento y su backdrop intercepta
  el clic de lo que la funcionaria esté haciendo. La simplicidad operativa es
  la prioridad de producto declarada.
- **Triaje estimado:** Nivel 2 (frontend, dentro del módulo del panel).
  **Esfuerzo:** S–M.
- **Dependencias:** ninguna. Afinidad con R5 (mismo frente frontend y misma
  familia de carreras asíncronas): conviene ejecutarlos como par.
- **Criterio de cierre objetivo:** E2E que reproduce la interceptación
  (interacción en curso + apertura del modal) en ROJO antes del fix y verde
  después; queda en la suite. **Evidencia:** corrida del E2E en CI/stage.
- **Nota de producto:** no requiere sesión previa con la funcionaria — es un
  defecto reproducible, no una decisión de UX nueva. Si la solución propuesta
  cambiara el comportamiento del resumen diario (p. ej. dejar de abrirse
  solo), eso SÍ se valida con ella antes.

### 6. R13 — Acotar el cron `alertas-vencimiento`

- **Justificación:** residual directo de R11 (resuelto): última lectura O(N)
  conocida, hoy catalogada como DEUDA_DECLARADA/BATCH en el presupuesto de
  rendimiento. Eliminarla completa la garantía de escala y reutiliza dos
  controles existentes (patrón 2A + presupuesto ADR-0011).
- **Alcance orientativo:** `limit` + `where(estado activo)` en
  `app/api/cron/alertas-vencimiento/route.ts`, según ADR-0010 §2.1.
- **Triaje estimado:** Nivel 2. **Esfuerzo:** S (supuesto: análogo a acotar
  búsqueda-avanzada, ya ejecutado en 2A).
- **Dependencias:** `scripts/laboratorio/presupuesto-rendimiento.mjs` (existe).
- **Criterio de cierre objetivo:** la ruta sale de DEUDA_DECLARADA/BATCH y
  queda bajo el presupuesto de rendimiento: una regresión a O(N) hace fallar
  CI. **Evidencia:** mutación (retirar el `limit` → CI rojo) + conteo de
  documentos leídos antes/después (la señal de observabilidad de ADR-0011 ya
  lo emite).

### 7. R12 — Fuente única del predicado de identidad reservada

- **Justificación:** deuda DRY sobre un **predicado de cumplimiento**
  (Ley 1581 art. 4 f/g): `lib/busqueda/filtros-radicado.ts` duplica el
  criterio de `lib/seguridad/identidad-protegida.ts`. Hoy son idénticos; si
  divergen, la brecha sería silenciosa — ningún test la detectaría. Es el
  mismo modo de fallo que R9 cerró en la otra dirección.
- **Alcance orientativo:** importar el predicado compartido + control que
  impida la reaparición de una definición paralela (test de equivalencia
  sobre matriz de casos, o verificación estática de que no existe segunda
  definición — la elección es técnica).
- **Triaje estimado:** Nivel 2 (refactor pequeño, pero toca un predicado
  normativo → revisión cruzada de gobierno-digital al cerrar). **Esfuerzo:** S.
- **Dependencias:** ninguna.
- **Criterio de cierre objetivo:** una sola definición del criterio de reserva
  en el código de servidor y un control en CI que falle si se introduce una
  divergencia. **Evidencia:** mutación (inyectar una divergencia → test rojo)
  + concepto breve de gobierno-digital confirmando equivalencia de
  comportamiento.

### 8. R5 — Confirmación "✓ Asignado" estable

- **Justificación:** carrera estado local React ↔ listener Firestore; misma
  clase que el toast estabilizado en E2E 01, cuyo patrón ya está probado.
  Severidad BAJA: la asignación sí ocurre, lo que falla es el feedback.
- **Triaje estimado:** Nivel 2. **Esfuerzo:** S.
- **Dependencias:** patrón de estabilización de `e2e/01-ciclo-dorado.spec.ts`.
  Ejecutar junto con R4 (mismo frente).
- **Criterio de cierre objetivo:** aserción automatizada (E2E o test de
  componente) de que la confirmación se muestra tras asignar. **Evidencia:**
  repeticiones verdes consecutivas (declarar N; supuesto: N=3, como se hizo
  al fijar E2E 01).

### 9. R7 — Robustez ante `termino.diasRespuesta` ausente

- **Justificación:** riesgo teórico (campo hoy requerido y siempre poblado);
  se cierra por higiene de robustez, no por urgencia. Es el ítem de menor
  valor marginal del backlog — va último a propósito.
- **Triaje estimado:** Nivel 1 (defensa puntual + test; justificación en el
  commit). **Esfuerzo:** S.
- **Dependencias:** ninguna. Afinidad con R3 (mismo dueño backend): puede
  cerrarse en el mismo frente de trabajo.
- **Criterio de cierre objetivo:** test unitario del caso "campo ausente" con
  comportamiento definido (fallback documentado o rechazo explícito con
  mensaje en español). **Evidencia:** el test en la suite.

## Decisiones que quedan en manos del propietario

Formuladas para responderse con sí/no o entre opciones concretas:

1. **R10 — variante B del enmascaramiento (EN DECISIÓN, dueño: product-owner
   informa, propietario decide).** La variante A vigente es CONFORME y
   conservadora; no hay urgencia normativa. Pregunta de decisión:
   *"¿Debe el funcionario responsable de un trámite poder ver la identidad
   reservada del solicitante?"*
   - **Opción 1 — No:** se mantiene la variante A; R10 pasa a RIESGO ACEPTADO
     con firma y motivo en el registro. Costo: cero.
   - **Opción 2 — Sí:** antes de diseñar, se valida con la funcionaria si la
     necesidad es real (¿alguna vez no pudo tramitar por no ver la
     identidad?). No hay evidencia registrada de esa necesidad — sin esa
     validación, la recomendación del product-owner es la Opción 1. Si la
     necesidad se confirma, el propietario define los cuatro parámetros:
     **quién** revela (¿solo el responsable asignado?), **condición**
     (¿necesidad del trámite declarada?), **traza** (¿evento de auditoría
     obligatorio?) y **alcance** (¿solo la vista de detalle?).
2. **Credenciales de stage en CI (habilita el ítem #3).** *"¿Autoriza usted
   almacenar credenciales de stage como secretos de CI para automatizar el
   E2E, previa revisión de seguridad en ADR?"* Sí → el ítem #3 arranca con su
   ADR. No → el ítem #3 sale del backlog y el registro manual del E2E queda
   como deuda aceptada por diseño en ADR-0013.
3. **Branch protection en `main` (acción administrativa, no de desarrollo).**
   Pieza 1 de ADR-0013 y precondición de 2E; requiere permisos de admin en
   GitHub, por eso es acción del propietario, no ítem de este backlog.
   *"¿Confirma la activación de branch protection con los TRES checks del
   workflow como requeridos: `validate` (Build & Security Gates),
   `laboratorio-emulador` (Laboratorio - Emulador Firestore (Fase 1)) e
   `informe-despliegue` (Compuerta de despliegue — Informe de gobernanza
   (ADR-0013, 2D))?"*
   (Corrección de revisión cruzada 2026-07-13: la versión anterior omitía
   `informe-despliegue`. Sin ese check requerido, un veredicto ROJO originado
   en el input E2E registrado —único caso en que ese job es el único en
   rojo— no bloquearía el merge. Nombres visibles exactos y conciliación con
   el texto literal de ADR-0013 en `docs/GOBERNANZA.md` §3.4.)

## Qué NO está en este backlog y por qué

- **2E:** fuera por regla de contexto. Sus dos precondiciones (branch
  protection + validación de la ventana de 180 días con la funcionaria) deben
  cumplirse antes de siquiera presentar su plan al propietario.
- **R15b (categoría IA de la compuerta):** listado pero bloqueado — depende de
  P-D (gobernanza de IA). Crear la categoría antes de que exista el control
  que la alimente sería un semáforo vacío.
- **Candidatas post-congelamiento del registro** (unificar mecanismo de
  subida, unificar defaults de tipo, higiene `isTest` en `ventanilla_salidas`,
  comentario desactualizado del Registro exprés): son mejoras, no riesgos;
  siguen registradas en `docs/REGISTRO_RIESGOS.md` §Candidatas y se evaluarán
  al levantarse el congelamiento, después de este backlog.
- **APM y dashboards de observabilidad** (deuda declarada de ADR-0005): sin
  evidencia de necesidad operativa hoy; la señal existente alimenta el
  presupuesto y el informe. YAGNI hasta que un incidente o una métrica lo
  justifique.
- **Cualquier feature nueva de producto** (planilla de reparto, circuito de
  firma, PQRSD verbal, etc.): pertenecen a la hoja de ruta de producto, no a
  este backlog técnico de consolidación; varios exigen sesión previa con la
  funcionaria como precondición bloqueante.

## Criterios de éxito del bloque de consolidación (cuando se levante el congelamiento)

1. Los ítems 1–2 cerrados con evidencia por mutación: la compuerta ya no
   puede quedar verde con controles ausentes ni con `storage.rules` sin
   verificar.
2. Cada cierre cumple el ciclo obligatorio del registro: ningún ítem se marca
   RESUELTO sin control automatizado capaz de detectar su regresión, enlazado
   en su fila de `docs/REGISTRO_RIESGOS.md`.
3. Las tres preguntas de §Decisiones tienen respuesta registrada del
   propietario (aunque la respuesta sea "no" o "después").
4. Cero ítems nuevos entran a ejecución sin pasar por este orden o sin
   justificar explícitamente por qué lo saltan (Regla Suprema: constancia de
   una línea).
