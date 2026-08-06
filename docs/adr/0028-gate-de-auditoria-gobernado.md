# ADR-0028 — Gate de auditoría de dependencias GOBERNADO (allowlist con caducidad)

- **Fecha:** 2026-08-05
- **Estado:** aceptado
- **Responsable:** DevOps (diseño e implementación)
- **Roles consultados:** seguridad (invariantes y política de altas a la allowlist), arquitecto-principal (impacto en la Compuerta ADR-0013), coordinador
- **Nivel de triaje:** 2 (cambio dentro del módulo de CI: reemplaza un paso del gate por un control gobernado equivalente, sin alterar el flujo del pipeline ni introducir colección/módulo nuevos)

## Reserva de numeración

En `main` el último ADR es **0025**. Hay dos ADR **en vuelo sin mergear** que reclaman el
mismo número **0026**: el del **motor de expedientes** (PR #146) y el de **separación de
entornos** (rama aparte, que debe renumerarse a **0027**). Para EVITAR la colisión, este ADR
toma el **0028** y deja reservados: **0026 = motor**, **0027 = separación de entornos**. Si al
mergear cambia esa asignación, se corrige aquí.

## Contexto

El paso `id: audit` del job `Build & Security Gates` de `.github/workflows/ci.yml` corría
`npm audit --audit-level=high` **crudo**, sin allowlist ni caducidad. Ese gate se **pudre
solo**: cada vez que se publica una advisory NUEVA sobre una dependencia transitiva **sin fix
upstream** — sobre un lockfile inmóvil — el paso pasa a rojo y, con `main` protegido
(`enforce_admins=true`, ADR-0013), **bloquea TODA la integración**, incluidos los PR de
Dependabot. Es un **hard-deadlock**: una sola transitiva sin parche corta la organización
entera. Ocurrió con **#139 (23-jul)** y de nuevo alrededor de **#146/#147**.

El Hito 1 (**#147**, `main` en `bb983a2`) remedió *within-major* las 5 advisories vigentes, así
que **hoy el árbol está limpio** (0 high/critical). Pero el mecanismo sigue siendo frágil: la
próxima advisory sobre cualquier transitiva sin fix volverá a trabar `main`. El precedente del
SEV-1 (ADR-0025) y del propio Hito 1 dejó una lección: **no añadir dependencias nuevas a la ruta
crítica sin necesidad** — y un gate de auditoría es, por definición, ruta crítica.

## Decisión

Se reemplaza el `npm audit --audit-level=high` crudo por un **gate GOBERNADO**:
`scripts/ci/audit-gate.mjs`, **dependency-free** (solo Node nativo), contrastado contra una
**allowlist** versionada `audit-allowlist.json`. El paso conserva su `id: audit` y su
`if: ${{ !cancelled() }}`, de modo que la **Compuerta de gobernanza (ADR-0013)** sigue leyendo
`steps.audit.outcome` sin cambios.

El gate **no relaja** el `--audit-level=high`: sigue bloqueando ante cualquier advisory
high/critical. Lo único que añade es la posibilidad de declarar, con dueño y caducidad, una
**excepción puntual y auditable** para una transitiva sin fix upstream — para romper el
hard-deadlock sin abrir la puerta a deuda silenciosa.

### Invariantes de seguridad (los 4 requisitos DUROS — no negociables)

1. **Falla ante lo no exceptuado.** El gate sale con código ≠0 ante CUALQUIER advisory de
   severidad **high/critical** que NO esté explícitamente en la allowlist por su **advisory-id
   exacto**.
2. **Arranca vacía.** La allowlist empieza SIN entradas (el Hito 1 ya remedió las 5 vigentes).
   **No se allowlista deuda existente**: lo remediado se remedia, no se excepciona.
3. **Toda excepción caduca.** Cada entrada EXIGE los 7 campos del esquema (abajo). Una entrada
   **mal formada** o **vencida** (`caducidad < hoy`) hace **FALLAR** el gate — aunque su
   advisory ya no esté presente. Fuerza a revisarla: ninguna excepción queda abierta para
   siempre. La ventana máxima es **90 días** desde el alta (se valida en el propio gate).
4. **Cobertura por id exacto.** Una entrada cubre SOLO el advisory-id que declara. Una advisory
   **NUEVA sobre el MISMO paquete** (otro id) NO queda cubierta y bloquea.

### Esquema de una entrada de allowlist

```jsonc
{
  "advisory":       "GHSA-xxxx-xxxx-xxxx | CVE-AAAA-NNNN",  // id exacto que reporta npm audit
  "paquete":        "nombre-del-paquete",                    // documental (la cobertura es por id)
  "justificacion":  "por qué se excepciona en vez de remediar",
  "alcanzabilidad": "evaluación de si el código alcanza la ruta vulnerable",
  "fechaAlta":      "YYYY-MM-DD",
  "caducidad":      "YYYY-MM-DD",   // ≤ 90 días desde fechaAlta
  "responsable":    "rol/persona que asume la excepción"
}
```

`audit-allowlist.json` lleva el esquema autodocumentado en `_documentacion`; el gate lee el
array `exceptions` (también acepta un array directo).

### Política de caducidad y de revisión

- **Caducidad máxima: 90 días.** El gate rechaza (entrada inválida) cualquier caducidad a más
  de 90 días del alta. Al vencer, el gate se pone rojo hasta **renovar** (re-evaluar
  alcanzabilidad + nueva ventana) o **retirar** la entrada.
- **Toda alta a la allowlist exige visto bueno del rol de Seguridad** (revisión cruzada,
  principio 5). La justificación por defecto de una excepción es una **transitiva sin fix
  upstream y no alcanzable**; si hay fix, se remedia, no se excepciona.

### Mecánica del script

- **Puro y testeable:** el núcleo `evaluarAuditGate(auditJson, allowlist, hoy)` no toca red ni
  filesystem; el `.mjs` es un *thin wrapper* que corre `npm audit --json` (vía `spawnSync`, que
  captura stdout aunque npm salga ≠0 por haber vulnerabilidades), lee la allowlist y calcula
  `hoy`. Mismo patrón de funciones puras exportadas + guardia `if (process.argv[1]…)` que
  `scripts/laboratorio/verificar-indices.mjs` y `presupuesto-rendimiento.mjs`.
- **`hoy` inyectable:** de `AUDIT_GATE_TODAY` (YYYY-MM-DD) si está presente — para tests
  deterministas — si no, del reloj del sistema. Una env var mal formada **lanza** (no degrada
  a hora de pared).
- **Fail-closed:** si `npm audit --json` no devuelve JSON parseable (sin lockfile / sin red), o
  si la metadata reporta high/critical pero no se extrae ninguna advisory (formato inesperado),
  el gate **bloquea**. Nunca pasa por defecto ante lo desconocido.

## Alternativas evaluadas

1. **Seguir con `npm audit --audit-level=high` crudo.** Rechazada: es la causa del hard-deadlock
   documentado (#139, #146/#147). Ata la integración de `main` al calendario de publicación de
   advisories sobre transitivas que no podemos parchear.
2. **Bajar el umbral / quitar el gate.** Rechazada: debilita un invariante de seguridad. El
   objetivo es gobernar el gate, no apagarlo.
3. **Herramienta externa (`audit-ci`, `better-npm-audit`).** Rechazada: **añadir una dependencia
   a un gate de dependencias** es irónico y amplía la superficie que el propio gate vigila
   (lección SEV-1/ADR-0025). Un script Node nativo cubre exactamente lo que necesitamos con cero
   dependencias nuevas en la ruta crítica.
4. **Allowlist sin caducidad.** Rechazada: una excepción eterna es deuda invisible. La caducidad
   (≤90 días) + el fallo por entrada vencida convierten cada excepción en una revisión
   obligatoria.

## Consecuencias

- **Positivas:** la próxima advisory sobre una transitiva sin fix ya no traba `main` de forma
  automática e indefinida — se decide de forma explícita, con dueño y caducidad, o se remedia.
  El gate sigue **estricto** ante advisories nuevas no declaradas. La Compuerta ADR-0013 no
  cambia (mismo `id: audit`, mismo `outcome`).
- **Deuda declarada:** la allowlist arranca vacía; no se introduce ninguna excepción hoy. El
  visto de Seguridad para las altas es un control **de proceso** (no automatizable en el gate);
  el gate sí automatiza la caducidad y el esquema.
- **Verificación:** `node scripts/ci/audit-gate.mjs` sobre el árbol limpio actual → exit 0;
  simulación de advisory nueva → exit 1; simulación de entrada vencida → exit 1; suite unitaria
  `__tests__/audit-gate.test.ts` (16 casos, incluidos los 5 escenarios de los invariantes)
  verde; `npm run lint` y `npx tsc --noEmit` sin errores.
