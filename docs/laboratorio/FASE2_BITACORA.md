# Fase 2 — Laboratorio Institucional de Calidad · Bitácora

Registro de decisiones y evidencia de la Fase 2 (ADR-0002). Cada rol añade su
sección; el coordinador consolida.

---

## Consolidación (coordinador) — 2026-07-10

Primer ciclo de delegación real de la Fase 2. Tres roles produjeron y se
revisaron entre sí sin pisarse: `firestore-datos` (Alcaldía Sintética) →
revisado por `dev-backend` (aprobó con condiciones, 2 MEDIA corregidas) →
decisión de coordinación (namespacing por generador) → reentrega verificada.
En paralelo, `qa` (auditor Playwright, 6/6 escenarios verdes + 1 `fixme`
justificado).

**Verificación de integración del coordinador (independiente, Principio 13):**

- `npx tsc --noEmit` → exit 0.
- `npx eslint scripts/laboratorio/alcaldia-sintetica.ts e2e/` → exit 0 **tras
  corregir un fallo que habría roto el CI**: la regla `react-hooks/rules-of-hooks`
  daba falso positivo sobre el parámetro `use` de los fixtures de Playwright.
  Corregido en `eslint.config.mjs` con un override acotado a `e2e/**`
  (arreglo permanente, no supresión inline). Es el valor concreto del paso de
  consolidación: ningún agente lo detectó porque cada uno linteó solo lo suyo.
- `npx vitest run` → 822/822 en 100 archivos. Confirma que la exclusión de
  `e2e/**` en `vitest.config.mts` no rompió la colección de la suite unitaria.

**Pendiente por salvaguarda de permisos (correcto):** el barrido retroactivo de
3 radicados huérfanos de QA (`marcar-retroactivo.mjs`) fue denegado tanto al
agente `qa` como al coordinador por el clasificador de permisos, porque es una
mutación sobre stage compartido sin consentimiento directo del propietario. No
se sorteó. Queda como acción del propietario (`node e2e/marcar-retroactivo.mjs`)
o autorización explícita. Impacto nulo: son 3 radicados sintéticos de ruido.

**Hallazgos que salen a backlog/seguimiento (congelamiento vigente):** CORS de
Storage en stage (ALTA, bloquea adjuntos — devops), `x-forwarded-for` sin proxy
de confianza en producción (MEDIA seguridad — chip `task_93ec61ec`), hueco de
consecutivo AGN cuando la subida de adjunto no completa (MEDIA — dev-backend),
y 2 hallazgos UX de carrera (modal "Resumen del día", confirmación de asignación).

---

## Alcaldía Sintética (firestore-datos)

**Entregable:** `scripts/laboratorio/alcaldia-sintetica.ts` — generador masivo
de datos coherentes para STAGE (`ventanilla-simacota-stage`). Corrida
verificada el 2026-07-10.

### Decisión principal: los radicados nacen por el camino real (opción b)

Se evaluaron las dos vías del encargo:

- **(a) Importar servicios de dominio desde el script.** Descartada para la
  creación/gestión: la lógica vigente de radicación pública NO vive en un
  servicio de `lib/` importable — vive dentro de los route handlers
  (`app/api/radicacion/route.ts`, `asignar`, `prorroga`, `resolver`), que
  dependen de `next/headers` (cookies de sesión) y del ciclo request/response.
  Los módulos `lib/radicacion.ts` y `lib/acciones/resolver-radicado.ts` están
  marcados DEPRECATED en el propio código; usarlos habría generado datos con
  el shape viejo (colección `radicados`, sin counter institucional).
- **(b) API routes del servidor `npm run dev:stage` en localhost:3000.**
  ELEGIDA. Cada radicado pasa por `POST /api/radicacion` (counter transaccional
  `counters/radicados-{año}`, término legal, evento RADICACION) y su gestión
  por `asignar` / `prorroga` / `resolver` con sesiones reales de los
  funcionarios de laboratorio (Firebase Auth REST con `LAB_PASSWORD` →
  `POST /api/auth/session` → cookie `__session`). `cumplioTermino` lo calcula
  el endpoint de resolver, nunca el script.

La opción (a) SÍ se usa donde es legítima: el script importa y reutiliza
`calcularFechaVencimiento` / `diasRestantesHabiles` (`lib/tiempos-radicado.ts`),
`formatearRadicadoInstitucional` (`lib/radicado-institucional.ts`),
`DIRECTORIO_TENANTS` (`src/types/reglas-negocio.ts`) y `areasParaDependencia`
(`lib/catalogos/areas.ts`). Cero duplicación de la lógica de días hábiles.

### Qué se reutilizó

| Pieza | Fuente |
|---|---|
| Guarda anti-producción + parseo `.env.stage` | patrón de `scripts/laboratorio/seed-funcionarios-stage.mjs` |
| Marca `isTest: true` | precedente de `scripts/marcar-datos-prueba.ts` |
| Término legal (días hábiles + festivos Colombia) | `lib/tiempos-radicado.ts` (misma función que usa `/api/radicacion`) |
| Formato canónico del radicado | `lib/radicado-institucional.ts` |
| Directorio de dependencias y catálogo de áreas | `src/types/reglas-negocio.ts`, `lib/catalogos/areas.ts` |
| Usuarios de laboratorio y sus roles | seed de Fase 1 (recepcionista asigna, funcionario SEC_GOBIERNO resuelve, admin el resto) |

### Determinismo y ciclo de vida

- El "generador con semilla" es un **roster estático de 30 escenarios** (la
  forma más fuerte de semilla fija): mismos ciudadanos ficticios, tipos,
  presentaciones, destinos y textos en cada corrida. Las fechas se anclan al
  día de la corrida para que POR_VENCER/VENCIDO (estados derivados en lectura,
  no persistidos — ver `lib/reportes-mipg/estado-termino.ts`) sean reales.
- **`--limpiar` es namespaced por generador** (decisión de arquitecto,
  2026-07-10): borra SOLO documentos con
  `laboratorio.generador === 'alcaldia-sintetica'` (con `recursiveDelete` para
  arrastrar la subcolección `trazabilidad`) — ya NO todo `isTest`. **No toca
  fixtures de otros generadores** (p.ej. `playwright-e2e` de QA) **ni el
  radicado protegido `1-110-2026-00000001`** (que no tiene el campo; además
  hay guarda explícita por id). Esto vuelve el laboratorio multi-auditor: cada
  generador es dueño de su espacio en stage y varios auditores pueden trabajar
  en paralelo sin pisarse — dirección "activo estratégico multi-municipio".
  Luego resetea `counters/radicados-{año}.ultimo` al máximo consecutivo
  restante (de TODA la colección, incluidos docs de terceros, para nunca
  colisionar) de modo que la resiembra no deje huecos propios. **Reset
  atómico** (revisión dev-backend, MEDIA):
  el escaneo del máximo y la escritura del contador van en una MISMA
  `runTransaction` (lecturas antes de escritura, patrón de
  `app/api/radicacion/route.ts`). El read-set es toda la colección: si una
  radicación concurrente crea un documento o toca el contador entre la lectura
  y el commit, Firestore invalida el read-set y reintenta, recalculando el
  máximo — así nunca se baja el contador por debajo de un consecutivo ya
  entregado (sin colisión de radicadoId).
- Doble siembra bloqueada, también namespaced: sin `--limpiar`, el script
  aborta solo si ya hay datos de ESTE generador; la presencia de fixtures de
  otros auditores no impide sembrar.
- **Crash-safety:** existe una ventana no atómica entre la radicación por API
  y la marca `isTest` (el endpoint público no acepta ese campo, y no se
  modificó a propósito). Una corrida interrumpida se detectó en pruebas y se
  resolvió con `adoptarHuerfanos()`. **Límite del mecanismo** (revisión
  dev-backend, MEDIA — se eligió matizar en vez de un identificador dedicado):
  un huérfano, por definición, NO tiene ningún campo de laboratorio (la marca
  es justo lo que faltó escribir) y el endpoint público no acepta campos
  arbitrarios, así que no existe un identificador propio que buscar sin
  ensuciar el shape real. La identificación es por tanto HEURÍSTICA y exige la
  conjunción de: (1) sin `isTest` ni `laboratorio`, (2) `control.origen` y
  `control.medioRecepcion` == `WEB`, y (3) `detalle.descripcion` idéntica byte
  a byte a uno de los 30 textos del roster. Un falso positivo requeriría un
  radicado ciudadano real por WEB, sin gestionar, con una descripción idéntica
  a una de las nuestras: despreciable, pero no literalmente imposible. Nunca
  toca el radicado protegido.

### Retrodatación coherente (único uso de Admin SDK sobre datos de negocio)

Los escenarios históricos (vencidos, al borde, resueltos con historia) se
crean por el API y luego se retrodatan: `control.fechaRadicado` se mueve al
pasado y `termino.fechaVencimiento` se **recalcula con
`calcularFechaVencimiento()`** — la misma función de producción — de modo que
la coherencia de días hábiles es por construcción. La huella RADICACION de la
trazabilidad acompaña la fecha. Para "resuelto fuera de término" el orden es
retrodatar → asignar → resolver, de forma que `cumplioTermino: false` lo
calcula el endpoint real con fechas reales. El doc queda con
`laboratorio.retrodatadoDias` como constancia.

### Contenido sembrado (verificado, acotado por `laboratorio.generador`)

- 30 radicados propios (`laboratorio.generador === 'alcaldia-sintetica'`),
  10 tipos PQRSD ciudadanos (todos), 26 identificados / 2 anónimos / 2
  identidad reservada, 13 dependencias destino + 8 pendientes en Ventanilla,
  2 con área responsable y responsable funcional (SEC_GOBIERNO).
- Estados persistidos: 8 PENDIENTE, 12 ASIGNADO, 2 PRORROGA, 8 RESUELTO
  (6 `cumplioTermino: true`, 2 `false`). Derivados hoy: 3 VENCIDOS,
  2 POR_VENCER (≤2 días hábiles).
- Verificación automática al final de cada corrida (Principio 13), **acotada
  al namespace propio** (`laboratorio.generador === 'alcaldia-sintetica'`):
  id == formato canónico, evento RADICACION presente en cada trazabilidad,
  vencimiento == recálculo con días hábiles colombianos (y posterior al
  término base en prorrogados), `cumplioTermino` coherente con
  `respuestaOficial.fecha`. La **contigüidad se comprueba solo sobre mis
  consecutivos**: un salto se explica leyendo toda la colección — si el número
  faltante lo ocupa un tercero (otro generador), es **nota informativa**
  (comparto rango, mis datos están completos); si no lo ocupa nadie, es
  **error** (radicado propio perdido). Exit code ≠ 0 solo por errores reales.
- **Medición real (2026-07-10, tras el namespacing):** corrida `--limpiar`
  con exit 0 — 30/30 radicados propios, distribución 8/12/2/8, 3 vencidos /
  2 por vencer, `cumplioTermino` {null:22, true:6, false:2}. El verificador
  reportó 3 consecutivos de `playwright-e2e` (QA) intercalados en mi rango
  como **nota informativa, no fallo**. `--solo-limpiar` dejó: 0 propios,
  **19 fixtures `playwright-e2e` de QA intactas**, 3 docs QA sin namespace
  intactos, y el protegido `00000001` intacto (RESUELTO, `isTest` nunca
  marcado, 5 eventos). El namespacing del borrado quedó demostrado.

### Decisiones de privacidad y correo

- Ciudadanos 100 % ficticios; sin números de documento (el flujo público real
  tampoco los captura — coherencia con el camino real).
- Correo de los identificados: placeholder institucional
  `sin-correo@simacota.gov.co`, que `debeNotificarCiudadano` bloquea → cero
  intentos SMTP y cero contaminación de alertas. Excepción deliberada: los
  escenarios 1 y 12 usan `@example.com` para ejercitar el camino
  `NOTIFICACION_CORREO_FALLIDA` + `alertaNotificacionFallida` (stage no tiene
  `EMAIL_HOST`, el fallo es inmediato y queda trazado — dato operativo real
  de contingencia para el panel).

### Reglas e índices

Sin cambios en `firestore.rules`, `storage.rules` ni `firestore.indexes.json`:
no hay colecciones nuevas ni consultas nuevas de cliente. Las consultas del
script (`isTest ==`, `accion ==`) son de campo único (índice automático) y van
por Admin SDK. Por eso no se corrió dry-run de reglas: no hay nada que validar.

### Limitaciones declaradas

1. **Sin archivos adjuntos**: ningún radicado sintético tiene PDF/imagen, así
   que los flujos de sellado, descarga autorizada y constancia con adjunto no
   tienen insumo. Ampliación natural de una iteración futura (subir PDFs
   ficticios por el mismo endpoint).
2. **Rate limit del endpoint público**: se evita con un `x-forwarded-for`
   sintético único por solicitud (10.77.0.N). Solo válido contra el dev server
   de laboratorio; en producción hay proxy confiable delante.
3. El determinismo de consecutivos asume base limpia **y sin escrituras
   concurrentes de terceros** durante la corrida (ver hallazgo abajo).
4. `MedioRecepcion` es siempre `WEB` (el único camino público real). Radicación
   presencial/verbal sintética requeriría sesiones sobre los endpoints internos
   de mostrador — iteración futura si el laboratorio la necesita.
5. Dirección estratégica ("municipio funcional en minutos"): el roster, la URL
   base (`LAB_BASE_URL`) y el directorio de destinos son los únicos puntos a
   parametrizar; no se añadió abstracción multi-municipio especulativa (YAGNI).

### Impacto declarado fuera de mi área (pensamiento sistémico)

- **HALLAZGO para QA / coordinación:** durante las corridas aparecieron en
  stage radicados creados por el *auditor funcional QA*
  ("Prueba automatizada del auditor funcional QA…") en dos modos: unos **sin
  `isTest: true`** (consecutivos 32, 42) y otros **con `isTest: true` pero sin
  `laboratorio.generador`**. No los toqué (no son míos), pero rompen dos
  convenciones del laboratorio: (1) todo dato de prueba debe nacer marcado o
  marcarse inmediatamente, y (2) impiden resetear el contador y ensucian los
  conteos del panel. Recomendación: que QA marque sus radicados con
  `isTest: true` **y** `laboratorio.generador` al crearlos.
- **DOS RIESGOS SISTÉMICOS de "QA comparte stage" — RESUELTOS con namespacing
  por `laboratorio.generador`** (aprobado por el arquitecto 2026-07-10 como
  reproducibilidad/calidad de un activo del laboratorio, no scope creep; cada
  generador es dueño de su espacio en stage → laboratorio multi-auditor):
  1. `--limpiar` ya NO borra todo `isTest`, sino solo
     `laboratorio.generador === 'alcaldia-sintetica'` → no destruye las
     fixtures de QA (`playwright-e2e`) ni el protegido. **Cambio de contrato
     documentado** arriba en "Determinismo y ciclo de vida".
  2. La verificación y los conteos se filtran por `laboratorio.generador`; los
     consecutivos de terceros intercalados se reportan como nota informativa,
     no como error. QA confirmó que marca sus radicados con
     `laboratorio: { generador: 'playwright-e2e' }`, así que ambos namespaces
     conviven de forma coherente.
- **dev-backend:** los radicados sintéticos ejercitan sus endpoints tal cual
  (nada que cambiar); los escenarios 1 y 12 dejan `alertaNotificacionFallida`
  a propósito — no es un bug del backend, es la ausencia de SMTP en stage.
- **dev-frontend / ux-ui:** el panel operativo de stage ahora tiene semáforo
  completo (vencidos, por vencer, prórrogas, resueltos fuera de término) para
  validar visualizaciones sin datos reales.
- **seguridad:** el script maneja `LAB_PASSWORD` y el service account solo
  desde `.env.stage` (nunca los imprime); la guarda anti-producción aborta por
  `project_id` y, además, la sesión de laboratorio falla contra cualquier
  servidor que no sea stage antes de escribir nada.

### Cómo operar

```bash
npm run dev:stage                                              # prerequisito
npx tsx scripts/laboratorio/alcaldia-sintetica.ts              # siembra
npx tsx scripts/laboratorio/alcaldia-sintetica.ts --limpiar    # regenera
npx tsx scripts/laboratorio/alcaldia-sintetica.ts --solo-limpiar
```

---

## Revisión cruzada del seed (dev-backend)

**Veredicto: APROBADO CON CONDICIONES.**

Revisión como consumidor real del backend de `scripts/laboratorio/alcaldia-sintetica.ts`
(786 líneas). Metodología: lectura línea a línea contrastada contra
`app/api/radicacion/route.ts`, `app/api/radicados/[radicadoId]/{asignar,prorroga,resolver}/route.ts`,
`lib/tiempos-radicado.ts`, `lib/server/internal-auth.ts` y `lib/server/radicados-security.ts`;
más una verificación de solo lectura contra stage (Admin SDK, script temporal
eliminado tras usarlo, sin escritura ni `--limpiar`) que contrastó 6 radicados
sintéticos reales contra el recálculo con la función de producción.

### Hallazgos

1. **[MEDIA] Reset del contador anual no es transaccional** —
   `alcaldia-sintetica.ts:554-567`. `limpiar()` calcula `maximo` a partir de un
   `.get()` de `ventanilla_radicados` y luego hace un `.set({ merge: true })`
   sobre `counters/radicados-{año}` en una operación separada, no envuelta en
   `runTransaction`. Si entre esas dos llamadas otro proceso radica por el
   endpoint público real (que sí usa `runTransaction` en
   `app/api/radicacion/route.ts:178-197`), el reset puede pisar el contador a
   un valor inferior al último realmente emitido y producir una colisión real
   de `consecutivo`/`radicadoId` en la siguiente inserción. Ya está declarado
   como límite conocido (bitácora, limitación #3), pero dado que el propio
   endpoint de producción resuelve el mismo problema con `runTransaction` a
   costo marginal, pido envolver el reset igual — es la misma primitiva que ya
   se reutiliza aguas arriba, no una pieza nueva. Corregir antes de dejar el
   script como herramienta reutilizable más allá de esta corrida puntual.
2. **[MEDIA] `adoptarHuerfanos()` identifica huérfanos por igualdad exacta de
   texto libre** — `alcaldia-sintetica.ts:523-539`. El único criterio para
   adoptar (y luego poder borrar) un documento ajeno como `isTest` es que
   `detalle.descripcion` coincida carácter a carácter con el roster estático.
   Es un identificador débil frente a alternativas deterministas (p. ej. un
   campo de correlación de corrida escrito antes de radicar). El riesgo de
   colisión accidental es bajo en la práctica (párrafos largos y específicos,
   confirmado por el propio hallazgo de la bitácora: los radicados de QA con
   texto distinto no fueron tocados), pero el texto actual de la sección
   "Determinismo y ciclo de vida" afirma sin matices que "nunca toca
   documentos ajenos al roster" — pido matizar esa afirmación con el mecanismo
   real (coincidencia de texto, no un identificador dedicado) para que quien
   opere el script en el futuro conozca el supuesto exacto que sostiene la
   guarda.
3. **[BAJA] `buscarDiasRetro` no garantiza monotonicidad estricta** —
   `alcaldia-sintetica.ts:481-487`. Búsqueda por fuerza bruta día a día
   (máx. 120 días calendario) hasta que `diasRestantesHabiles` iguale
   exactamente el objetivo; al cruzar fines de semana/festivos el objetivo
   podría "saltarse" en teoría. No es un hallazgo bloqueante porque falla
   ruidosamente (`throw`, exit code 1, principio 13 respetado) en vez de
   producir datos incoherentes — lo señalo solo para que quede como límite
   documentado si se amplían los objetivos de retrodatación.
4. **[BAJA] Acoplamiento año-de-creación vs. año-retrodatado** — el
   `radicadoId` se formatea con el año de `ahora` en el momento de la
   radicación real (`formatearRadicadoInstitucional`, vía
   `app/api/radicacion/route.ts:194`), pero `retrodatarRadicado` puede mover
   `control.fechaRadicado` a una fecha de un año calendario anterior si el
   script corriera cerca de un cambio de año con retrodataciones grandes. Hoy
   no ocurre (máx. ~120 días desde 2026-07-10 no cruza el límite de año), y el
   propio `verificar()` (líneas 624-626) detectaría el desajuste id↔formato
   canónico y haría fallar la corrida — autodefendido, no silencioso. Dejar
   constancia para quien reutilice el script en enero/febrero.

### Verificado como correcto (no requiere nueva revisión)

- **Guarda anti-producción evaluada antes de cualquier escritura, incluida la
  limpieza**: el chequeo de `project_id`, `LAB_PASSWORD` y
  `NEXT_PUBLIC_FIREBASE_API_KEY` (líneas 328-346) corre a nivel de módulo,
  antes de `admin.initializeApp()` y de la definición de `limpiar()`/`sembrar()`,
  por lo que `--limpiar` y `--solo-limpiar` también quedan cubiertos.
- **`--limpiar` no puede borrar nada que no sea `isTest:true`**: la query de
  borrado filtra por `isTest == true` (línea 543) y el radicado protegido
  `1-110-2026-00000001` tiene guarda explícita por id (líneas 546-549).
- **Fidelidad al camino real, confirmada con lectura directa a stage**: muestreé
  6 radicados sintéticos (3 sin retrodatar, más los escenarios 9 -vencido-, 23
  -resuelto en término- y 29 -resuelto fuera de término-, dirigidos por
  `laboratorio.escenario`). En los 6, `termino.fechaVencimiento` persistido es
  IDÉNTICO al recalculado en el momento con `calcularFechaVencimiento()` de
  producción; `diasRestantesHabiles` hoy coincide exactamente con los
  objetivos del roster (-3 y -1 para los escenarios 9 y 29); `cumplioTermino`
  es coherente con `respuestaOficial.fecha` vs `termino.fechaVencimiento`
  (`true` en el 23, `false` en el 29). No se ejecutó el script completo ni
  `--limpiar`; el script de lectura usado se creó y se eliminó dentro de esta
  revisión.
- **La retrodatación solo toca los campos que declara**: `control.fechaRadicado`,
  `control.horaRadicado`, `termino.fechaVencimiento`, `ultimaActualizacion` y
  la huella de trazabilidad `RADICACION` — nunca `cumplioTermino`,
  `termino.prorrogasAplicadas` ni `estadoActual`, que siguen calculándose
  exclusivamente en los endpoints reales (`resolver`, `prorroga`, `asignar`).
- **`prorroga` real suma días calendario, no hábiles**
  (`app/api/radicados/[radicadoId]/prorroga/route.ts:64-67`); el script no
  duplica esa lógica ni la contradice — correcto no reutilizar
  `calcularFechaVencimiento` ahí, porque no es lo que hace producción.
- **Secretos**: revisé cada `console.log`/`console.error`/`throw` del
  archivo — `LAB_PASSWORD` y el service account nunca se imprimen; los
  mensajes de error que incluyen cuerpo de respuesta HTTP provienen de
  Firebase Identity Toolkit o de los endpoints propios, que no ecoan la
  contraseña.
- **`x-forwarded-for` sintético confinado al script**: solo se usa en el
  `fetch` contra `BASE_URL` (por defecto `localhost:3000`) dentro de
  `radicarPorApi`; no se introdujo en ningún archivo de producción.
- **TypeScript estricto**: `npx tsc --noEmit -p tsconfig.json` no reporta
  errores en el archivo; sin `any`; los dos usos de `unknown` están
  justificados (narrowing de `catch` y de un valor de Firestore sin tipar).
- **Cero duplicación de lógica de dominio**: confirmé por lectura que
  `calcularFechaVencimiento`, `diasRestantesHabiles`,
  `formatearRadicadoInstitucional` y `areasParaDependencia` se importan y se
  usan tal cual, sin reimplementación paralela.
- **Los 13 `TenantId` destino del roster existen en `DIRECTORIO_TENANTS`**
  (`src/types/reglas-negocio.ts`) y el área elegida por
  `areasParaDependencia(...).filter(a => !a.transversal)[0]` siempre es válida
  para `validarAreaParaDestino` del endpoint `asignar` — confirmado por
  inspección cruzada y porque `tsc` no falló (los literales están tipados
  como `TenantId`).
- **Cero cambios en código de producción**: `git status` confirma que en el
  ámbito de este encargo solo son nuevos el script y esta bitácora.

### Impacto declarado fuera de mi área

- **Para seguridad (hallazgo colateral, no introducido por este script):**
  `app/api/radicacion/route.ts:76-79` (`getClientIp`) toma el primer valor de
  `x-forwarded-for` tal cual lo envía el cliente, sin validarlo contra una
  lista de proxies confiables. El script de laboratorio explota esto
  deliberadamente y de forma declarada para evadir el rate limit en su propio
  entorno controlado — lo cual es legítimo ahí —, pero el mismo
  comportamiento significa que el endpoint público de radicación en
  producción podría ser vulnerable a que un cliente externo spoofee ese
  encabezado para eludir el límite de 8 solicitudes/minuto por IP. No es un
  defecto del script bajo revisión; es una debilidad preexistente en el
  endpoint que el ejercicio del laboratorio puso en evidencia. Recomiendo
  ticket para `seguridad` + `dev-backend`: solo confiar en `x-forwarded-for`
  detrás de un proxy conocido (o usar el encabezado específico de la
  plataforma de despliegue) en vez de tomar el primer valor de una cadena
  controlable por el cliente.
- **firestore-datos**: condiciones 1 y 2 arriba son sobre el propio script de
  laboratorio (Admin SDK), no sobre el modelo de datos ni sobre
  `firestore.rules` — no hay cambios de colección/índice que revisar.
- **QA / coordinación**: confirmo el hallazgo ya declarado por el autor sobre
  los radicados de QA sin `isTest:true` (consecutivos 32 y 42): mi lectura
  directa a stage no los tocó ni los necesitó tocar para esta revisión.

---

## Auditor funcional Playwright (qa)

**Entregable:** `playwright.config.ts` + `e2e/` — 11 escenarios E2E contra
STAGE (de un presupuesto duro de 15, ADR-0002 §4.1: 6 de la primera entrega
+ 5 del Batch A), más el mecanismo de marcado `isTest` que corrige el
hallazgo de firestore-datos de más arriba. Corrida verificada el
2026-07-10 (6 corridas completas consecutivas de la suite entera —4 de la
primera entrega, 2 del Batch A con los 11 escenarios juntos—, todas en
verde salvo el fixme documentado).

### Qué cubren los 6 escenarios

| Archivo | Escenario | Verifica |
|---|---|---|
| `01-ciclo-dorado.spec.ts` | Ciclo dorado completo | recepcionista radica (identificada, petición general) → formato `1-110-{año}-{########}` → asigna a Secretaría de Gobierno desde la Bandeja → funcionario responde y marca como resuelto → consulta pública `POST /api/public/radicado/consulta` ya devuelve `fueRespondido: true` |
| `02-radicacion-anonima.spec.ts` | Presentación ANÓNIMA | nombre e identificación se teclean, luego se limpian y se deshabilitan al cambiar a "Anónima" (Ley 1755/2015 art. 14); el radicado se crea igual |
| `03-consulta-publica-incorrecta.spec.ts` | Anti-enumeración | verificación incorrecta → 404 genérico, mensaje idéntico al de "radicado inexistente" |
| `04-radicacion-adjunto.spec.ts` | Radicación con adjunto | **`test.fixme`** — bloqueado por hallazgo de infraestructura (CORS), ver abajo |
| `05-jefe-solo-lectura.spec.ts` | JEFE_DEPENDENCIA solo lectura | abre el radicado, la pestaña Responder muestra el botón deshabilitado con el `title` exacto "Tu rol no permite realizar acciones sobre radicados." |
| `06-perimetro-sin-sesion.spec.ts` | Perímetro sin sesión | `/interno/dashboard` sin cookie redirige a `/interno/login?next=...`; `GET /api/interno/resumen-diario` sin cookie → 401 |

Tres actores reales (recepcionista, funcionario, jefe, admin) se modelan
como `BrowserContext` aislados dentro del mismo test — nunca logout/login
sobre la misma pestaña (el layout tiene control de pestaña única por
`localStorage`+`BroadcastChannel`, que además confirmé que SÍ aísla
correctamente entre contexts). El escenario (e) no asume el tenant de
`jefe.lab`: lo descubre leyendo "Tablero · {dependencia}" en vivo (solo
visible para roles sin alcance municipal) y luego usa ADMIN —que sí puede
elegir cualquier "Dependencia destino" al radicar— para crear un radicado
dirigido exactamente ahí. Todos los asuntos llevan el prefijo `[E2E-AUTO]`
para poder re-correr la suite contra stage indefinidamente sin ambigüedad.

### Batch A — 5 escenarios nuevos (07-11)

| Archivo | Escenario | Verifica |
|---|---|---|
| `07-identidad-reservada.spec.ts` | Presentación RESERVADA | a diferencia de ANÓNIMA, nombre/documento SÍ se capturan (quedan habilitados y con el valor tecleado); aviso "Los datos se registran pero quedan protegidos en las vistas." visible; protección real verificada (no asumida) en dos puntos concretos — el mostrador de Ventanilla muestra "Identidad protegida" en vez del nombre, y la consulta pública omite la clave `dependencia` del JSON |
| `08-traslado-dependencias.spec.ts` | Traslado entre dependencias | pestaña "Traslado" mueve el radicado de Secretaría de Gobierno a Secretaría de Planeación; evento de Historia "Trasladado a X" / "Desde Y" con origen y destino; el cambio persiste de verdad (confirmado recargando el panel desde cero, no solo el estado optimista de React) |
| `09-prorroga-con-notificacion.spec.ts` | Prórroga con notificación | `termino.prorrogasAplicadas` incrementa (verificado leyendo el documento real, la respuesta HTTP no lo expone), `fechaVencimiento` se recalcula exactamente `+N` días calendario, evento de Historia con el motivo — y expone el hallazgo normativo #5 (abajo) aplicando una segunda prórroga a propósito |
| `10-devolucion-datos-incompletos.spec.ts` | Devolución | el flujo SÍ existe (se confirmó antes de escribir el test); motivo obligatorio (≥10 caracteres), `estadoActual` pasa a `DEVUELTO`, evento de Historia con el motivo |
| `11-registro-expres.spec.ts` | Registro exprés | crea DOS documentos en una llamada (entrada YA resuelta + salida amarrada `2-SAL-...`); default de tipo `PETICION_GENERAL` confirmado (distinto del default de Radicación Rápida); término real de 15 días hábiles aplicado igual que cualquier otra vía; expone el hallazgo de documentación #7 (abajo) |

Decisiones de diseño de estos 5:
- **08, 09, 10 usan ADMIN**, no recepcionista/funcionario — `canOperateTenant`
  (`lib/server/internal-auth.ts:82-86`) da vía libre a ADMIN sobre cualquier
  tenant, así que el test puede radicar directo al origen que necesita sin
  tener que pasar por la Bandeja primero. Es una decisión deliberada de
  acotar la variable bajo prueba (el flujo de traslado/prórroga/devolución
  en sí, no la matriz de permisos por rol — eso ya lo cubre el escenario 05
  y es candidato explícito para los 4 restantes del presupuesto).
- **09 y 10 comparten pestaña ("Prórroga") y el mismo estado `motivo`** en
  el componente (`app/interno/dashboard/page.tsx` ~3013-3059) — cada test
  llena su propio campo por `placeholder` (no por el label compartido) para
  no arrastrar el texto del otro control.
- **11 necesitó un segundo fixture de marcado** (`registrarDocumentoDePrueba`,
  `e2e/fixtures.ts`) porque Registro exprés crea el documento de salida en
  `ventanilla_salidas`, una colección que el fixture original
  (`registrarRadicadoDePrueba`, acotado a `ventanilla_radicados`) no cubre.

### Qué queda para los 4 restantes del presupuesto (propuesta, no implementado)

Numeración consecutiva sin huecos bajo concurrencia (relevante: ver
hallazgo de huecos, #2 abajo); comparación de expediente completo
inicio→cierre (nada se pierde entre etapas); sello de documento PDF;
registro de salida con constancia de despacho (distinto del de Registro
exprés — el flujo manual desde el detalle, `RegistrarSalidaModal`). El
propio ADR pide variantes negativas (anónimo, reservado, traslado,
prórroga, devolución) — con este batch quedan las 5 cubiertas.

### Hallazgos

1. **[ALTA] CORS no configurado en el bucket de Storage de STAGE — bloquea
   el 100% de las radicaciones con adjunto en este entorno.**
   `e2e/04-radicacion-adjunto.spec.ts` (comentario completo con reproducción
   en el propio archivo). El bucket
   `ventanilla-simacota-stage.firebasestorage.app` rechaza el preflight
   OPTIONS de `subirArchivos` (`lib/storage.ts:56-95`, sube directo desde el
   navegador con el SDK cliente) para origen `http://localhost:3000`; el
   botón se queda en "Radicando…" para siempre porque `subirArchivos` nunca
   resuelve ni rechaza. Reproducido 100% de las veces, con consola mostrando
   literalmente `blocked by CORS policy: Response to preflight request
   doesn't pass access control check`. **Rol que corrige: `devops`**
   (configurar CORS del bucket — falta un `cors.json` aplicado con `gsutil
   cors set` o el equivalente en consola; no existe ninguno en el repo hoy).
   Marcado `test.fixme` con el hallazgo completo en el propio archivo, tal
   como exige el encargo — no se debilitó la aserción.
2. **[MEDIA, relacionado con el hallazgo 1] Huecos de numeración cuando la
   radicación no termina de crearse.** `lib/radicado-institucional.ts:33-40`
   incrementa el consecutivo institucional (`runTransaction`) ANTES de que
   `lib/actions/radicarVentanilla.ts` suba los adjuntos (línea ~201) y
   ANTES del `setDoc` del radicado (línea 332). Si la subida nunca resuelve
   (como en el hallazgo 1) o falla por cualquier otra razón, el consecutivo
   queda consumido sin que exista jamás un radicado con ese número — un
   hueco real en la numeración AGN 060/2001. Confirmado en STAGE durante el
   diagnóstico de este hallazgo (varios consecutivos "fantasma" sin
   documento). **No confirmado en producción** (bucket distinto, CORS podría
   estar configurado ahí) — se reporta como hallazgo a verificar, no como
   hecho consumado. **Rol que corrige: `dev-backend`** (mover el incremento
   del consecutivo a después de que el radicado esté garantizado, o generar
   el número dentro de la misma transacción/operación que persiste el
   documento).
3. **[BAJA, UX] La confirmación "✓ Asignado" de la Bandeja puede no llegar a
   verse.** `app/interno/dashboard/page.tsx` `BandejaAsignacion` (~4104-4142):
   `exitoFila` es estado LOCAL de React, pero la fila se desmonta en cuanto
   el listener en tiempo real de Firestore refleja que `estadoActual` dejó
   de ser `PENDIENTE` (filtro de `radicadosPendientes`, línea ~4629). Si el
   eco del listener llega antes o junto con el re-render de "✓ Asignado", la
   fila desaparece sin que el checkmark llegue a mostrarse — reproducido de
   forma consistente en `01-ciclo-dorado.spec.ts` (documentado en el
   comentario del test). No bloqueante: la asignación en sí funciona
   (confirmado independientemente porque el funcionario de destino ve y
   resuelve el radicado en el mismo test); es un gap de feedback visual, no
   de datos. **Rol que corrige: `dev-frontend`/`ux-ui`** si se decide que
   vale la pena arreglarlo (podría bastar con una confirmación no atada al
   ciclo de vida de esa fila, p. ej. un toast global).
4. **[MEDIA] Modal "Resumen del día" puede colgar cualquier interacción del
   dashboard de forma impredecible.** `app/interno/dashboard/page.tsx`
   ~4364-4377: al montar, se pide `/api/interno/resumen-diario` y si
   `data.mostrar` es true se abre un modal `z-50` de pantalla completa —
   puede resolver en CUALQUIER momento después del login, incluso a mitad
   de otra interacción ya en curso, y su backdrop `fixed inset-0` intercepta
   clics de cualquier otro control de la página. Encontrado porque bloqueó
   la suite de forma intermitente hasta que se manejó explícitamente en
   `e2e/helpers.ts` con `page.addLocatorHandler`. No es exactamente un bug
   de producción (el modal es intencional y el funcionario real solo tiene
   que hacer un clic para cerrarlo) pero SÍ es una carrera real: si el
   funcionario ya está en medio de otra acción cuando la carga tardía del
   resumen dispara el modal, ese clic puede quedar interceptado igual que le
   pasó a esta suite. **Rol que corrige: `ux-ui`/`dev-frontend`** si se
   considera que vale la pena resolver la carrera (p. ej. no auto-abrir el
   modal si el usuario ya interactuó con algo en los últimos N segundos, o
   pedir el resumen ANTES de pintar el dashboard interactivo).
5. **[MEDIA, normativo] La prórroga no tiene límite de unicidad.** Ley
   1755/2015 exige que la prórroga sea ÚNICA. `POST
   /api/radicados/[radicadoId]/prorroga` no tiene ningún guard que lo
   impida: `assertNotClosed` (`lib/server/radicados-security.ts:44-48`)
   solo bloquea `RESUELTO`/`RECHAZADO`, y el estado que deja una prórroga es
   `PRORROGA` — no está en esa lista. Verificado aplicando una segunda
   prórroga a propósito en `e2e/09-prorroga-con-notificacion.spec.ts`:
   `termino.prorrogasAplicadas` llega a 2 sin ningún error. El motivo SÍ se
   captura (queda "motivada") y la notificación al ciudadano SÍ se intenta
   cuando hay correo (queda "notificada" si hay canal) — la brecha real es
   específicamente la ausencia del límite de unicidad. **Rol que corrige:
   `gobierno-digital`** para confirmar la interpretación normativa exacta
   (¿la segunda prórroga debería rechazarse siempre, o permitirse con
   causal calificada?) y **`dev-backend`** para implementar el guard una
   vez decidido.
6. **[BAJA, interno] La protección de "identidad reservada" es inconsistente
   entre vistas internas.** Verificado en `e2e/07-identidad-reservada.spec.ts`:
   el mostrador de Ventanilla SÍ protege (`VistaVentanilla.identidadProtegida`,
   "Identidad protegida" en vez del nombre), pero la Bandeja de Asignación
   (`BandejaAsignacion`, columna Solicitante) y el panel de detalle completo
   —pestaña Información, `app/interno/dashboard/page.tsx` ~2494— muestran
   nombre y documento en texto plano sin ninguna condición sobre
   `identidadReservada`. Puede ser intencional (quien gestiona el caso
   necesita el dato) o un descuido — no lo asumo. **Rol que corrige:
   `gobierno-digital`** para decidir si es conforme, **`dev-frontend`** para
   implementar si no lo es.
7. **[BAJA, documentación] Comentario desactualizado en Registro exprés.**
   `lib/dependencias/registro-expres.ts` (comentario de cabecera) dice que
   la entrada nace como "1-EMAIL-...", pero `formatearRadicadoInstitucional`
   usa `CODIGO_OFICINA_RADICADORA = '110'` fijo, sin excepción
   (`lib/radicado-institucional.ts:23) — el id real es `1-110-...`,
   confirmado empíricamente en `e2e/11-registro-expres.spec.ts`. No es un
   bug funcional (el consecutivo es correcto y comparte counter con
   radicación normal), solo el comentario quedó desactualizado. **Rol que
   corrige: `dev-backend`** (fix trivial de comentario).
8. **[BAJA, informativo] `ventanilla_salidas` no tiene higiene `isTest` del
   lado cliente.** A diferencia de `ventanilla_radicados`
   (`useVentanillaRadicados` filtra `isTest`), ningún hook consume ese campo
   sobre `ventanilla_salidas` hoy — confirmado al implementar el marcado de
   la salida que crea Registro exprés (`e2e/lab-admin.ts:marcarDocumentoDePrueba`,
   necesario para el escenario 11). Se marca por higiene y por si
   `--limpiar` de la Alcaldía Sintética la adopta más adelante, pero
   actualmente no oculta nada de "Salidas" en el dashboard. **Rol:
   `firestore-datos`/`dev-frontend`**, si se decide dar a las salidas la
   misma disciplina que a los radicados.

### Mecanismo de marcado `isTest` (hallazgo de firestore-datos, atendido)

El coordinador trasladó el hallazgo de la sección de firestore-datos (más
arriba en esta bitácora): los radicados `[E2E-AUTO]` que esta suite crea en
STAGE quedaban sin `isTest: true`, rompiendo `--limpiar` de la Alcaldía
Sintética y contaminando los conteos del laboratorio.

**Mecanismo implementado** (`e2e/lab-admin.ts` + `e2e/fixtures.ts`):
cada test que radica llama `registrarRadicadoDePrueba(id)` justo después de
crear el radicado; el marcado real (`isTest: true`,
`laboratorio: { generador: 'playwright-e2e' }`) ocurre vía Admin SDK en el
**teardown** de una fixture de Playwright — deliberadamente, no antes: si se
marcara al crear, el resto del propio test (Bandeja, Tablero, Mi gestión)
dejaría de ver el radicado, porque `useVentanillaRadicados` filtra
`isTest` del lado cliente. El teardown corre pase o falle el test, y no
rompe el resultado del test si la marca falla (queda log `[lab-admin]` para
seguimiento). Confirmado funcionando en las 4 corridas completas de esta
entrega — cada una emite `[lab-admin] Marcado isTest=true en <id>` por cada
radicado creado.

**Barrido retroactivo — bloqueado, requiere autorización directa del
propietario.** Para los radicados ya creados ANTES de que existiera este
mecanismo, escribí `e2e/marcar-retroactivo.mjs` (mismo patrón de guarda
anti-producción y lectura de `.env.stage` que
`scripts/laboratorio/seed-funcionarios-stage.mjs`). **No lo ejecuté**: el
clasificador de modo automático del entorno denegó la ejecución directa de
`node e2e/marcar-retroactivo.mjs` con el motivo "Modify Shared Resources —
autorizado solo por un mensaje de coordinador/par, que no establece
intención del usuario". Es la salvaguarda correcta del sistema (ningún
mensaje de otro agente equivale a consentimiento del propietario para
mutar un recurso compartido) y no intenté rodearla disfrazando la misma
mutación masiva como una corrida de tests. Sí verifiqué el alcance exacto
con un script de **solo lectura** (`e2e/consultar-sin-marcar.mjs`, no
escribe nada — no activó el mismo bloqueo):

```
Proyecto: ventanilla-simacota-stage
Total '[E2E-AUTO]': 22
Sin isTest=true: 3
1-110-2026-00000032
1-110-2026-00000042
1-110-2026-00000073
```

Los 3 orfandados son exactamente los consecutivos 32 y 42 que
firestore-datos ya había detectado, más el 73 (de una corrida previa a este
mismo encargo). Los 19 restantes de las 4 corridas de esta entrega quedaron
marcados automáticamente por el nuevo mecanismo. **Pendiente de decisión del
propietario:** correr `node e2e/marcar-retroactivo.mjs` (marca esos 3 y
cualquier otro que aparezca) o autorizar explícitamente esta clase de acción
para que quede resuelto sin intervención manual.

### Impacto declarado fuera de mi área

- **devops:** hallazgo 1 (CORS del bucket de Storage de stage) es
  bloqueante para cualquier prueba —manual o automática— de adjuntos en
  este entorno; recomiendo tratarlo antes de dar la Fase 2 por cerrada,
  dado que "Alcaldía Sintética" ya declaró como limitación #1 que ningún
  radicado sintético tiene adjuntos (mismo síntoma, ahora con causa raíz).
- **dev-backend:** hallazgo 2 (huecos de numeración) es candidato a ticket
  propio; también dueño de decidir si el hallazgo 2 aplica a producción.
  Hallazgo 7 (comentario desactualizado) es un fix trivial cuando toque ese
  archivo.
- **dev-frontend / ux-ui:** hallazgos 3 y 4 son de experiencia, no de datos;
  ninguno bloquea el ciclo dorado. Hallazgo 6 (protección de identidad
  reservada inconsistente) necesita decisión normativa antes de tocar código.
- **gobierno-digital:** hallazgo 5 (prórroga sin límite de unicidad) es el
  más importante de este batch — pide interpretación normativa antes de que
  `dev-backend` implemente el guard. Hallazgo 6 (protección de identidad
  reservada) también necesita su lectura: ¿es correcto que quien gestiona
  el caso vea la identidad completa, o debería protegerse también ahí?
- **firestore-datos:** su hallazgo sobre radicados QA sin marcar queda
  atendido por el mecanismo de esta sección; los 3 documentos ya
  identificados por ambos (32, 42) más el 73 quedan con barrido listo para
  ejecutar, pendiente de autorización. Hallazgo 8 (salidas sin higiene
  `isTest`) es candidato a evaluar junto con el resto de la disciplina de
  datos sintéticos.
- **Propietario del proyecto:** decisión pendiente sobre el barrido
  retroactivo (ver arriba) — es la única acción de esta entrega que no se
  pudo completar por diseño del sistema de permisos, no por falta de
  tiempo o de código. Sigue pendiente tras el Batch A (no creció: el nuevo
  mecanismo marcó automáticamente los 11 radicados y 1 salida de este
  batch, confirmado por los logs `[lab-admin]` en la evidencia).
