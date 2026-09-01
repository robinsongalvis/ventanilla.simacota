# Hoja del día del arranque — operación real de licencias

- **Estado:** BORRADOR para aprobación del propietario (1-sep-2026).
- **Qué es:** los pasos exactos, en orden, del día en que la Secretaría de Planeación
  empieza a operar con números reales. Quién hace cada cosa: **[P]** propietario,
  **[C]** asistente (Claude), **[F]** funcionaria de Planeación.
- **Regla de oro:** el único error sin arreglo es **duplicar un número de serie**.
  Un hueco se explica con acta; un duplicado no se arregla
  (`scripts/operacion/abrir-series.mjs:14`).
- **Producción la abre el propietario.** Todo comando que escribe en la base real
  lo corre **[P]** con su service account; **[C]** prepara, verifica salidas y
  redacta constancias. Esa regla no tiene excepción por trabajo bien hecho.

## 0. El encuadre que evita el error de fondo

**Hay DOS aperturas, dos libros y dos decisores** — no una:

| Serie | Número | Libro físico | Decide | Mecanismo | Filosofía |
|---|---|---|---|---|---|
| `radicados` (ventanilla) | `1-110-AAAAMM-XXXXXXXX` | Libro de ventanilla (alcaldía) | **[P] con la alcaldía**, acta 24-ago §9 | `configuracion/series` + `scripts/operacion/abrir-series.mjs` | Abrir **POR ENCIMA** del libro, con margen escrito — el libro avanza a diario |
| `expedientes` (licencias) | `68745-0-AA-CCCC` | Consecutivo del ingeniero de Planeación | **[P] con el ingeniero**, PT-7 | `scripts/migracion/abrir-serie-expedientes.mjs` | Abrir **EXACTO** en el máximo del libro, confirmado por escrito ≤7 días |

Estado del código hoy (verificado 1-sep-2026):

- El candado R10 es la constante `EMISION_REAL_EXPEDIENTES_HABILITADA = false as const`
  (`lib/server/expedientes-licencias.ts:67`). Mientras esté en `false`, **todo
  expediente nace `esPrueba: true`** con número `DEMO-…` y `serieId: 'demo'`
  (líneas 538 y 1108): sin debida forma (422), sin sello ni paquete
  (409 `SIN_NUMERO_LEGAL`), invisible para el vigía del término.
- Desde el 26-ago el acto de radicar **RECIBE** el número de ventanilla
  (`serieId: 'radicados'`) — ya no emite la serie `expedientes`. Abrir la serie
  68745 hoy protege contra duplicados futuros; el número oficial del expediente
  vivo es el `1-110-…`.
- La serie `radicados` **no tiene candado técnico** (`exigeAperturaExplicita`
  solo existe para `expedientes`): si alguien radica antes de la apertura, el
  sistema emite el 28 sin quejarse. De ahí la Regla operativa n.º 1 (§B).

## A. ANTES del día (D-3 a D-1) — sin esto, el día no arranca

- [ ] **A1 [P] Decisión de producto pendiente** (no está escrita en ningún doc):
  cuando la creación deje de forzar `DEMO + esPrueba`, ¿qué escribe en
  `numeroExpediente`? El tipo permite nacer **sin número**
  (`lib/motor-expedientes/tipos.ts:462`, campo opcional).
  **Recomendación [C]:** nacer sin número y recibir el `1-110-…` en la debida
  forma, como ya ocurre; el camino demo se conserva solo tras un selector
  explícito **de servidor** (hoy el body «NO puede pedir otra cosa» y así debe
  seguir). Decidido esto, [C] prepara el PR.
- [ ] **A2 [C] El PR del candado, listo y verde ANTES del día.** Contenido:
  constante → `true`; los dos planes de creación dejan de forzar
  (`planCrearExpedienteDemo` :538 y `planCrearExpedienteDesdeRadicado` :1108)
  según A1; y los **dos tests que fijan la constante y su texto fuente**
  (`__tests__/expedientes-licencias-decisiones.test.ts:59-61` y
  `__tests__/expedientes-licencias-rutas.test.ts:26-27`). El día del arranque
  solo se mergea y despliega — no se programa.
- [ ] **A3 [P + ingeniero] Confirmación ESCRITA del máximo del consecutivo**
  (fecha ≤7 días antes — el guion la exige con `--libro-confirmado-el`).
  ⚠ **El máximo GLOBAL de la serie, no solo la hoja «Relación LSR»**: la serie
  68745 es UN consecutivo compartido por todas las modalidades (LC/LSR/LSU/PH/
  LR/LA/LU); una hoja filtrada a LSR puede dar un máximo menor y provocar
  duplicados. El snapshot del 9-ago decía **19** — con ~4 asientos/mes, hoy es
  casi seguro que el libro va más arriba: si la cifra confirmada no coincide
  con el snapshot, se re-extrae el Excel ANTES del día
  (`PROCEDIMIENTO_APERTURA_SERIE_EXPEDIENTES.md:99-104` ordena PARAR).
- [ ] **A4 [P + alcaldía] Número de apertura de `radicados`** (pendiente desde
  el acta 24-ago §9; contador hoy en 27, serie 2026 entera anulada). Se abre
  POR ENCIMA del libro de ventanilla con margen, `desde` escrito y
  `autorizadoPor` con nombre.
- [ ] **A5 [P] Variables de Vercel confirmadas** (PT-2 las dejó «creadas,
  vacías»): `CRON_SECRET` (sin él los 5 crons responden 503 — vigilancia muda),
  `EMAIL_HOST/PORT/USER/PASS/FROM`, `NEXT_PUBLIC_APP_URL`,
  `FIREBASE_STORAGE_BUCKET` (sello y paquete), `FIREBASE_SERVICE_ACCOUNT`.
- [ ] **A6 [P] El buzón del vigía.** `DIRECTORIO_TENANTS` envía las alertas de
  Planeación a `planeacion@simacota-santander.gov.co`
  (`src/types/reglas-negocio.ts:68`); el buzón confirmado vivo del dominio es
  `contactenos@…`. O se crea/confirma ese buzón, o [C] trae el PR de una línea
  ANTES del día. Un término de 45 días hábiles con las alertas yendo a un buzón
  inexistente es silencio administrativo en cámara lenta.
- [ ] **A7 [P] Usuarios y roles en producción, verificados:** la funcionaria →
  `users/{uid}` con rol `FUNCIONARIO` y `tenantId: 'SEC_PLANEACION'`; quien
  radica en ventanilla → `ADMIN` o `RECEPCIONISTA` (`JEFE_DEPENDENCIA` **no**
  pasa `canOperateTenant`). La administración de usuarios es solo de `ADMIN`.
- [ ] **A8 [P] Destino de los libros de papel tras el arranque** — de esto
  depende que el margen de A4 alcance y que la premisa «libro congelado» de A3
  se sostenga. Si el papel sigue asentando después del arranque, las series
  vuelven a divergir.

## B. EL DÍA — los pasos, en orden

> **Regla operativa n.º 1: desde que empieza la jornada hasta que B6 queda
> verificado, NADIE radica nada** — ni real, ni «de prueba». La serie
> `radicados` no tiene candado técnico y emitiría en silencio.

- [ ] **B0 [C prepara, P corre] Fotografía del estado real** (solo lectura):

  ```bash
  node scripts/operacion/abrir-series.mjs --proyecto ventanilla-unica-f31b1
  ```

  ```bash
  node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto ventanilla-unica-f31b1 --verificar
  ```

  **Esperado:** `counters/radicados-2026` con `ultimo = 27`;
  `counters/expedientes-2026` **ausente**. **Si difiere: PARE** y la salida
  completa va a [C] antes de seguir — el acta del 24-ago tiene una semana y la
  base pudo moverse.

- [ ] **B1 [P] Limpieza de datos de prueba, con acta.**
  `scripts/operacion/limpiar-datos-prueba.mjs`: se **BORRA** solo lo demo
  (huella `esPrueba` + `serieId: 'demo'` — no deja hueco en ninguna serie); lo
  que consumió serie **se ANULA con constancia, jamás se borra** (AGN 060: un
  hueco es indistinguible de pérdida documental). [C] redacta el acta.
  Verificar después, a ojo: bandeja limpia **y consulta pública del ciudadano
  sin basura** — la consulta pública NO filtra anulados (acta 24-ago §6).

- [ ] **B2 [P] Apertura de la serie `radicados`.** Escribir
  `configuracion/series` con la decisión de A4
  (`{ apertura: { radicados: { desde: <N>, autorizadoPor: "<nombre>", referencia: "<acta>" } } }`)
  y correr:

  ```bash
  CONFIRMO_APERTURA=SI node scripts/operacion/abrir-series.mjs --proyecto ventanilla-unica-f31b1
  ```

  El guion se niega a bajar un contador («bajar un contador es emitir dos veces
  el mismo número») — si dice `NADA` o `RECHAZAR`, se lee el motivo, no se
  fuerza.

- [ ] **B3 [P] Apertura de la serie `expedientes`** con la cifra confirmada de A3:

  ```bash
  CONFIRMO_ESCRITURA=si node scripts/migracion/abrir-serie-expedientes.mjs \
    --anio 2026 --proyecto ventanilla-unica-f31b1 \
    --ultimo <máximo confirmado> --libro-confirmado-el <AAAA-MM-DD> --ejecutar
  ```

  La guarda 4 exige que `--ultimo` coincida con el máximo del libro: **si no
  coincide, PARE** — se re-extrae el Excel, no se adivina. Abrir esta serie
  **no** habilita la emisión: el candado sigue siendo un acto aparte (B4).

- [ ] **B4 [P] Merge y deploy del PR del candado** (el de A2, ya verde).
  [C] observa el deploy y confirma que el build sirvió la versión nueva.

- [ ] **B5 [C] Verificación post-deploy sin tocar datos:** la constante activa,
  rutas arriba, crons autenticando. Nada se crea todavía.

---

### ⛔ PUNTO DE NO RETORNO

**Hasta aquí, todo es reversible**: el PR se revierte, un contador abierto y
sin consumo se puede reabrir más arriba (nunca más abajo), los demos borrados
no dejaron hueco.

**El primer número real emitido — la primera reserva `tx.create` en
`unicidad_radicados` (paso B6.1) — es un acto administrativo.** Desde ese
momento nada se corrige borrando: los errores se anulan con acta y el número
queda consumido para siempre.

---

- [ ] **B6 [F opera, P mira, C acompaña] El primer trámite real, completo:**
  1. Radicar en ventanilla (`/interno/dashboard`, rol ADMIN/RECEPCIONISTA) —
     **el número emitido debe ser exactamente el `desde` de A4**; si no, PARE
     total (no se radica un segundo).
  2. Crear el expediente desde el radicado clasificado a `SEC_PLANEACION` —
     verificar `esPrueba` ausente/`false` (ya no DEMO).
  3. Radicar en debida forma transcribiendo el número del libro de ventanilla
     — el expediente queda `serieId: 'radicados'` con su `1-110-…`.
  4. El término aparece corriendo: 45 días hábiles (D.1077).
  5. Sello por documento y paquete sellado **descargan** (ya no 409
     `SIN_NUMERO_LEGAL`) — el papel sale con escudo, folio «Página N de M» y
     esquina elegible.

- [ ] **B7 [P corre, C verifica] Evidencia positiva de la vigilancia** — desde
  hoy el silencio del vigía deja de ser salud: corrida del cron
  `vencimientos-licencias` con `CRON_SECRET` registrada en
  `vigilancia_termino_corridas`, y **un correo real recibido** en el buzón
  decidido en A6. Sin ese correo en mano, la vigilancia no se declara viva.

- [ ] **B8 [P] Apertura al público.** [C] redacta la constancia del arranque
  (fecha, números de apertura de ambas series, quién autorizó cada uno,
  evidencias de B6/B7) y queda en `docs/actas/`.

## C. Lo que ese día NO se hace

- No se importan históricos (la migración D6 es otro día, con su propio plan).
- No se toca el checklist de requisitos vigente (regla del propietario, 29-ago;
  `docs/licencias/auditoria-requisitos-checklist.md`).
- No se borra nada que haya consumido serie — se anula con acta.
- No se radica «para probar» después de B2: toda emisión ya es real.

## D. Si algo sale mal

| Cuándo | Qué se hace |
|---|---|
| Antes de B6 | Reversible: revert del PR, contadores sin consumo se corrigen hacia ARRIBA (jamás hacia abajo), y el día se reprograma sin deuda. |
| B6.1 emite un número inesperado | PARE total. No se radica un segundo número. El número emitido se anula con acta y se diagnostica antes de continuar. |
| Después de B6 | Doctrina de siempre: anular con constancia, nunca borrar. Los papeles ya emitidos son actos. |

## Anexo — identificadores exactos (para no sembrar con nombre equivocado)

- Contadores: `counters/radicados-{año}`, `counters/expedientes-{año}` (campo
  `ultimo`, bloque `apertura`). ⚠ La grafía `counters/expedientes-expedientes-…`
  que menciona un JSDoc viejo (`expedientes-licencias.ts:55`) **no existe** —
  el path real es el de `consecutivo-legal.ts:263`.
- Unicidad: `unicidad_radicados/{número}`, `unicidad_expedientes/{número}`.
- Config de apertura: `configuracion/series`.
- Candado: `EMISION_REAL_EXPEDIENTES_HABILITADA`
  (`lib/server/expedientes-licencias.ts:67`) y sus dos tests fijadores.
- Fuentes de esta hoja: `docs/planes/PROCEDIMIENTO_APERTURA_SERIE_EXPEDIENTES.md`,
  `docs/planes/PLAN_GO_LIVE.md` (PT-7), actas del 23 y 24-ago
  (`docs/actas/`), `docs/auditorias/AUDITORIA_GO_LIVE_2026-08-23.md`, y el
  mapeo de código del 1-sep-2026 (5 lectores + crítica, sesión de esta hoja).
