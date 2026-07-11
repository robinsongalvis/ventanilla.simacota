# Concepto normativo — Fase 2 del Laboratorio

**Rol emisor:** Especialista en Gobierno Digital y normatividad colombiana
**Fecha:** 2026-07-10
**Alcance:** verificación normativa de dos hallazgos del auditor funcional Playwright en STAGE.
**Restricción de fase:** arquitectura CONGELADA (ADR-0002). Este documento es concepto
normativo; NO propone ni implementa cambios de código. Alimenta el backlog priorizado.
**Método:** cada afirmación fue verificada contra el código real del worktree (no asumida) y
cada artículo citado fue contrastado con fuente oficial (Función Pública / Secretaría del Senado).

---

## HALLAZGO 1 — Prórroga sin límite de unicidad

### 1. Concepto: **NO CUMPLE**

La Ley 1755 de 2015 admite **una sola** ampliación excepcional del término, y esa ampliación
tiene un techo: el nuevo plazo **no puede exceder del doble del inicialmente previsto**. El
sistema permite aplicar prórrogas sucesivas sin límite de número ni verificación del techo del
doble, lo que habilita incumplir el término legal de forma encubierta (el radicado luce "en
plazo" mientras el vencimiento se corre indefinidamente).

### Verificación en el código
- `app/api/radicados/[radicadoId]/prorroga/route.ts` (líneas 57-74): tras `getRadicadoOrFail`
  llama `assertNotClosed(radicado)` y luego **incrementa** `termino.prorrogasAplicadas` en +1
  sin comparar contra ningún máximo, y suma `diasProrroga` a `fechaVencimiento`.
- `lib/server/radicados-security.ts` (líneas 44-48): `assertNotClosed` solo veta estados
  `RESUELTO` y `RECHAZADO`. El estado `PRORROGA` no está vetado → un radicado ya prorrogado
  admite otra prórroga.
- Validación de entrada (líneas 53-55): `diasProrroga` se acota a 1-30 días, pero ese rango es
  fijo y **no se ata al término base** del tipo de petición ni al techo del doble.
- Búsqueda global de `prorrogasAplicadas` (grep): se **lee** en panorama, riesgos, reportes y
  contexto SIMI, pero **en ningún punto se usa como guarda** que bloquee una segunda prórroga.
  El único lugar que la escribe es este endpoint (línea 71).

### 2. Análisis por norma

| Norma y artículo | Exigencia | Estado en el sistema | Brecha |
|---|---|---|---|
| **Ley 1755 de 2015, art. 14, parágrafo** (sustituye el Título II del CPACA, Ley 1437/2011) | Cuando excepcionalmente no sea posible resolver en el plazo, la autoridad debe informar al interesado **antes** del vencimiento, expresar los motivos y señalar un plazo razonable que **"no podrá exceder del doble del inicialmente previsto"**. La norma contempla **una** ampliación, no una cadena de prórrogas. | El endpoint captura motivo y notifica, pero permite N prórrogas y no valida el techo del doble. | **Alta.** Permite superar el máximo legal (una ampliación, tope = doble del término inicial) sin control. |
| **Ley 1755 de 2015, art. 14** (términos base) | Regla general **15 días hábiles**; documentos/información **10 días hábiles**; consultas **30 días hábiles**. El "doble" se calcula sobre el término que corresponda. | `diasProrroga` es un 1-30 fijo, desligado del término base. Ni el back ni una guarda verifican que el total ≤ doble del término aplicable. | **Media-alta.** Aun con una sola prórroga, 30 días sobre una petición de 15 puede exceder el doble (15+15=30 sería el tope; 30 de prórroga lo respeta al límite, pero sobre peticiones de 10 días lo supera). |
| **Ley 1437 de 2011 (CPACA), art. 3 num. 1 (debido proceso) y principio de celeridad** | Los términos son perentorios y de obligatorio cumplimiento; su ampliación es reglada y excepcional. | Ampliación no reglada (ilimitada). | **Media.** Refuerza la severidad del anterior. |

> Nota de precisión: el parágrafo del art. 14 fija el techo temporal (doble) y su carácter
> excepcional; **no enuncia literalmente la palabra "una sola vez"**. La unicidad se deriva de
> que la norma habla de *un* plazo adicional razonable con tope, no de prórrogas encadenadas —
> criterio pacífico en doctrina de Función Pública y jurisprudencia de tutela. Se cita como
> interpretación fundada, no como texto literal.

### 3. Severidad normativa: **ALTA**
Habilita el incumplimiento encubierto del término perentorio del derecho fundamental de petición
(art. 23 C.P.). El riesgo jurídico concreto es tutela por vulneración del derecho de petición y
eventual responsabilidad disciplinaria del servidor (mora injustificada).

### 4. Lo que la norma exige y el sistema NO garantiza hoy
1. Que la prórroga sea **única** por radicado (bloquear la segunda).
2. Que el nuevo vencimiento **no exceda el doble del término inicial** correspondiente al tipo de
   petición (15/10/30 días hábiles según art. 14).
3. (Ya cubierto) Que se informe al interesado antes del vencimiento con los motivos — el endpoint
   sí captura motivo y notifica.

---

## HALLAZGO 2 — Identidad reservada inconsistente entre vistas internas

### 1. Concepto: **CUMPLE PARCIALMENTE**

La captura y el enmascaramiento existen en varios frentes (mostrador de Ventanilla, consulta
pública, reportes MIPG, sugerencias de solicitante frecuente, planillas), pero la identidad
reservada se muestra **en texto plano** a cualquier funcionario con acceso al dashboard, tanto en
la **Bandeja de Asignación** como en el **panel de detalle** — sin control por rol ni por
necesidad de conocer. La reserva se protege frente a terceros/público, pero no se aplica el
principio de acceso restringido *dentro* de la entidad.

### Verificación en el código
- **Sí protege** — `app/interno/dashboard/components/ventanilla/VistaVentanilla.tsx`:
  `identidadProtegida(r)` (línea 76) devuelve true si `identidadReservada` o `esAnonimo`; la fila
  del mostrador muestra `'Identidad protegida'` en vez del nombre (línea 249).
- **Sí protege** — capas server/reporte: `lib/mostrador/trabajo-de-hoy.ts` (la fila nunca
  incluye el nombre), `lib/seguridad/consulta-publica-radicado.ts` (líneas 178-180),
  `lib/reportes-mipg/sanitizar.ts` y `excel.ts` (enmascaran), `lib/recepcion/sugerencias-solicitante.ts`
  (línea 52 excluye reservados).
- **NO protege** — `app/interno/dashboard/page.tsx`:
  - Panel de detalle del funcionario, línea 2494: `<FilaInfo label="Nombre completo" value={radicado.solicitante.nombreCompleto} />` sin condicionar por identidad protegida; el bloque
    también expone documento (2493), correo/teléfono/dirección (2498-2500).
  - Bandeja de Asignación, línea 4290: muestra `nombreCompleto` y además `tipoDocumento`/`numeroDocumento` (4292) en texto plano.
  - Otras filas de lista: 1495, 1585, 2223 exponen `nombreCompleto` sin la guarda `identidadProtegida`.
  - Exportaciones del dashboard (3687) incluyen el nombre; verificar si esa ruta debe enmascarar
    igual que los reportes MIPG.

Conclusión de verificación: la lógica de enmascaramiento **existe y es correcta donde se aplica**,
pero **no está aplicada de forma transversal** en las vistas internas de gestión del dashboard.

### 2. Análisis por norma

| Norma y artículo | Exigencia | Estado en el sistema | Brecha |
|---|---|---|---|
| **Ley 1581 de 2012, art. 4 lit. f — acceso y circulación restringida** | Los datos personales solo pueden estar disponibles para los titulares o **terceros autorizados**; el conocimiento debe ser **restringido**. | Nombre y documento reservados visibles a todo funcionario con dashboard. | **Media-alta.** No hay restricción de acceso por autorización/necesidad. |
| **Ley 1581 de 2012, art. 4 lit. g — seguridad** | Medidas técnicas, humanas y administrativas para evitar **consulta o uso no autorizado**. | No hay control de rol/necesidad de conocer sobre el dato reservado en vistas internas. | **Media-alta.** |
| **Ley 1581 de 2012, art. 4 lit. h — confidencialidad** | Todas las personas que intervienen en el tratamiento deben garantizar la **confidencialidad**. | La reserva se rompe visualmente para roles que no la necesitan. | **Media.** |
| **Ley 1712 de 2014, art. 18 (información pública clasificada)** | Puede reservarse el acceso a información que afecte el derecho a la intimidad y los datos personales (habilita la figura de reserva). | Da sustento a la reserva; el sistema la ofrece pero no la hace efectiva internamente. | Sustento, no brecha propia. |
| **Ley 1755 de 2015 (derecho de petición) + reserva del denunciante (Ley 1474 de 2011)** | En denuncias/quejas con identidad reservada, la reserva protege al ciudadano frente a represalias; el acceso debe limitarse a quien tramita. | Visible a todos los internos. | **Media-alta** cuando el reservado es un denunciante. |

> Nota de precisión: la Ley 1581/2012 **no clasifica automáticamente** todo dato de identidad
> como "dato sensible" (art. 5). Un nombre/cédula es dato personal ordinario; su reserva aquí es
> una decisión del titular/entidad que activa el deber de acceso restringido. Por eso el concepto
> es "cumple parcialmente" y no "no cumple": el dato se captura y se protege en el perímetro
> externo; falta el control interno por rol/necesidad de conocer.

### 3. Severidad normativa: **MEDIA-ALTA**
No es exposición pública (los reportes y la consulta ciudadana sí enmascaran), sino ruptura del
principio de acceso restringido dentro de la entidad. El riesgo escala a **ALTA** cuando el
radicado con identidad reservada corresponde a un denunciante (represalias) — caso frecuente en
Comisaría de Familia e Inspección de Policía.

---

## Acciones requeridas (ordenadas por riesgo jurídico)

> Requisitos normativos, NO implementación. Bajo congelamiento (ADR-0002) su ejecución la decide
> el coordinador/PO; aquí se indica el rol técnico que las ejecutaría cuando se desbloqueen.

1. **[Riesgo ALTO — Hallazgo 1] Guarda de unicidad de prórroga.**
   Requisito: bloquear una segunda prórroga sobre el mismo radicado (rechazar si
   `prorrogasAplicadas >= 1`). **Rol: dev-backend** (endpoint `prorroga/route.ts` +
   posible ampliación de `assertNotClosed`/nueva guarda en `radicados-security.ts`).

2. **[Riesgo ALTO — Hallazgo 1] Tope del "doble del término inicial".**
   Requisito: validar que la nueva `fechaVencimiento` no exceda el doble del término base según
   tipo de petición (15/10/30 días hábiles, calendario colombiano). **Rol: dev-backend.**

3. **[Riesgo MEDIA-ALTA — Hallazgo 2] Enmascarar identidad reservada en vistas internas de gestión.**
   Requisito: aplicar la guarda `identidadProtegida` (ya existente en `VistaVentanilla`) al panel
   de detalle (page.tsx ~2493-2500) y a la Bandeja de Asignación (~4290-4292), sustituyendo
   nombre/documento por "Identidad protegida" salvo para roles con necesidad de conocer.
   **Rol: dev-frontend** (reutiliza lógica ya existente; NO crear nueva).

4. **[Riesgo MEDIA — Hallazgo 2] Definir política de "necesidad de conocer" por rol.**
   Requisito: decidir qué rol (p. ej. funcionario responsable del trámite) puede revelar la
   identidad reservada y bajo qué traza. Es decisión de producto con base normativa (acceso
   restringido); **NO** es refactor. Requiere ADR por tocar flujo/seguridad (Principio 1, nivel 3).
   **Rol: PO + dev-backend** para el control de autorización; **dev-frontend** para el revelado
   controlado.

5. **[Riesgo BAJO — Hallazgo 2] Revisar rutas de exportación del dashboard (page.tsx ~3687).**
   Requisito: confirmar que la exportación aplica el mismo enmascaramiento que los reportes MIPG.
   **Rol: dev-backend/dev-frontend** según dónde se arme el export.

---

## Fuentes

- **Ley 1755 de 2015**, art. 14 y su parágrafo — Términos para resolver las distintas modalidades
  de peticiones; ampliación excepcional que "no podrá exceder del doble del inicialmente previsto".
  Verificado en Función Pública y Secretaría del Senado.
  https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65334
- **Ley 1437 de 2011 (CPACA)**, art. 3 — principios (debido proceso, celeridad); carácter
  perentorio de los términos.
- **Constitución Política**, art. 23 — derecho fundamental de petición.
- **Ley 1581 de 2012**, art. 4 lit. f (acceso y circulación restringida), lit. g (seguridad),
  lit. h (confidencialidad); art. 5 (datos sensibles, para delimitar que un nombre/cédula es dato
  ordinario). Verificado en Secretaría del Senado y Función Pública.
  http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html
- **Decreto 1377 de 2013** — reglamenta la Ley 1581 (deber de seguridad y medidas). Citado por
  pertinencia; no se transcribe artículo puntual.
- **Ley 1712 de 2014**, art. 18 — información pública clasificada (sustento de la figura de reserva).
- **Ley 1474 de 2011 (Estatuto Anticorrupción)** — reserva de identidad del denunciante. Citada
  como marco; el numeral exacto de reserva del denunciante debe confirmarse antes de usarse como
  cita literal en un acto administrativo.

### Salvedades de precisión (declaradas, no asumidas)
- La **unicidad** de la prórroga se sustenta por interpretación fundada del parágrafo del art. 14
  (un plazo adicional con tope = doble), no por texto literal "una sola vez".
- El numeral exacto de la **reserva del denunciante** en la Ley 1474/2011 no se cita como artículo
  específico aquí; se recomienda verificarlo si se requiere en documento vinculante.

---

## H1 — Remediación verificada (2026-07-10)

**Rol:** revisión cruzada de conformidad normativa (gobierno-digital). dev-backend implementó bajo
excepción controlada al congelamiento (ADR-0003); esta sección es la validación independiente —
nadie valida su propio trabajo. Solo lectura de código, sin cambios.

### Veredicto de conformidad: **CONFORME** (dentro del alcance H1: unicidad + tope)

El control ejecutable satisface la Ley 1755/2015 art. 14 para las dos reglas que originaron el
hallazgo. El estado de H1 pasa de **NO CUMPLE** (severidad ALTA) a **CONFORME / remediado**.

### Verificación en el código (leído, no asumido)
| Artefacto | Qué verifiqué | Resultado |
|---|---|---|
| `lib/server/radicados-security.ts` (líneas 50-94) | `validarProrroga` es función pura; unicidad `prorrogasAplicadas >= 1` → 409; tope `diasProrroga > diasRespuesta` → 400; frontera `===` permitida; unicidad evaluada **antes** del tope. | Correcto |
| `app/api/radicados/[radicadoId]/prorroga/route.ts` (líneas 65-74) | Invoca `validarProrroga` tras `getRadicadoOrFail` y **antes** de la escritura (línea 81); ante rechazo hace `return` con el `status`/`mensaje`. IMPIDE, no advierte. | Correcto |
| `src/types/ventanilla.ts` (125), `radicarVentanilla.ts` (273), `api/radicacion/route.ts` (397), `registro-expres.ts` (143) | `termino.diasRespuesta` es campo requerido y se **puebla en los tres caminos de creación**. El tope no queda huérfano. | Correcto |
| `__tests__/prorroga-validacion.test.ts` (6 casos) | Cubre: 1ª válida; `undefined`→0; 2ª rechazada 409; tope excedido 400; frontera `===` válida; precedencia unicidad-sobre-tope. | Cobertura suficiente del validador |
| `e2e/09-prorroga-con-notificacion.spec.ts` | Invertido: 1ª aplica (200, contador→1, vencimiento recalculado, traza); 2ª **rechazada 409**, mensaje cita la norma, contador **permanece en 1** verificado por lectura del documento real. | Correcto |

### Análisis normativo de la remediación
| Regla del art. 14 (parágrafo) | Cómo la enforce el control | Conformidad |
|---|---|---|
| Ampliación **única** | Rechazo 409 si `prorrogasAplicadas >= 1` | **Conforme** |
| Nuevo plazo **≤ doble del término inicial** | Con una sola prórroga permitida y `diasProrroga ≤ diasRespuesta`, el término total = base + prórroga ≤ 2× base | **Conforme** |
| Nota calendario vs. hábiles (ADR-0003 §Interpretación) | `diasProrroga` se suma como días **calendario**; `diasRespuesta` es **hábiles**. N días calendario abarcan ≤ wall-clock que N días hábiles, luego el guard es **más estricto** que el tope legal y nunca lo excede. | Argumento sólido; conservador |

### Mensajes de rechazo (claridad + cita normativa)
- 409 (unicidad): "Este radicado ya tiene una prórroga aplicada. La Ley 1755/2015 (art. 14) solo
  permite una ampliación excepcional del término." — **cita correcta y clara** para el funcionario.
- 400 (tope): "Los días de prórroga (X) superan el tope legal: el nuevo plazo no puede exceder el
  doble del término inicial (Y días, Ley 1755/2015 art. 14)." — **cita correcta y clara**.

### Criterio de cierre 2 del ADR (conformidad demostrada por pruebas): **SATISFECHO**
Los 6 unitarios del validador cubren ambas reglas y su precedencia; el E2E 09 demuestra el rechazo
end-to-end con verificación de solo lectura del documento (`prorrogasAplicadas` permanece en 1). La
conformidad de unicidad + tope queda demostrada por pruebas automatizadas de regresión.
*(El criterio de cierre 3 — sin regresión sobre los 15 E2E — es evidencia de QA, fuera de mi
alcance normativo; no lo certifico aquí.)*

### Brechas residuales (fuera del alcance H1; NO bloquean su cierre)
1. **Timing "antes del vencimiento" no verificado.** El parágrafo del art. 14 exige informar al
   interesado *antes del vencimiento del término*. El control valida unicidad y tope, pero **no
   impide aplicar la prórroga cuando el término original ya venció**. Severidad **media-baja**
   (la notificación sí se intenta). Es una regla distinta a las que motivaron H1; se recomienda
   registrarla como ítem propio del backlog, no reabrir H1. **Rol futuro: dev-backend.**
2. **Robustez ante `diasRespuesta` ausente (legado).** Si un radicado careciera de `diasRespuesta`,
   `diasProrroga > undefined` es `false` y el tope no dispararía. Hoy el campo es requerido y se
   puebla en todos los caminos de creación, por lo que el riesgo es **bajo/teórico**; se anota como
   observación de robustez, no como brecha activa. **Rol futuro: dev-backend.**

**Conclusión:** la remediación de H1 es **conforme** al art. 14 en unicidad y tope, con conformidad
demostrada por pruebas. H1 puede marcarse **RESUELTO** en `docs/REGISTRO_RIESGOS.md`. Las dos
observaciones residuales son ítems nuevos y de menor severidad; no justifican mantener H1 abierto.
Referencia de decisión: **ADR-0003** (`docs/adr/0003-control-de-prorroga-ley-1755.md`).
