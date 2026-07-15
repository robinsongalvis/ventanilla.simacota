# Blueprint Arquitectónico — C2 · Respuesta y Comunicaciones

**Estado:** EN REVISIÓN → (ver §24 y Definition of Ready). **No autoriza
implementación** (ADR-0023). Rige la gobernanza vigente (ADR-0001, 0014–0023).
**Rol:** Chief Software Architect (registra OAT en §H).

- **Capacidad / dominio:** C2 (D4) — ficha en
  [`PLAN_MAESTRO_EVOLUCION.md`](../PLAN_MAESTRO_EVOLUCION.md).
- **Iniciativas BM-\*:** BM-B20 (comunicaciones internas), BM-B21 (consecutivos por
  dependencia), BM-B22 (plantillas/tipos de comunicación), BM-B23 (circuito de
  firma), BM-B31 (cargos autorizados a firmar).
- **Versión / revisión:** v1 — 2026-07-14 — fundamentado en evidencia de código.

> **Decisión de alcance (crítica).** El norte de D4 es "un único Motor de
> Comunicaciones". La evidencia muestra que hoy ya existen **dos tracks maduros de
> salida** (respuesta al ciudadano vía SIMI, y libro de salidas/oficios). Unificarlos
> es un refactor grande y sensible que **no** se hace aquí: se registra como
> **[OAT-02](../OAT_REGISTRO.md#oat-02)**. C2 entrega la **pieza faltante**
> (comunicaciones internas + firmantes + consecutivos por dependencia)
> **reutilizando** los mecanismos existentes y **dejando el terreno preparado** para
> la convergencia, sin divergir.

---

## A. Arquitectura funcional y de dominio

### 1. Arquitectura funcional detallada
C2 habilita que una dependencia **emita comunicaciones** (principalmente
**internas** hoy inexistentes) con: numeración legal por dependencia, plantilla,
**circuito de firma** por cargo autorizado, envío por un canal y **trazabilidad y
acuse**. Reutiliza el circuito de firma y de envío ya construidos para la respuesta
al ciudadano y para las salidas externas.

**Estado actual (evidencia):**
- **Salidas externas** existen: `SalidaOficial` (`src/types/salida.ts`), serie
  propia `2-SAL-{año}` numerada con **H3** (`app/api/salidas/registrar/route.ts:12`
  usa `leerConsecutivosLegales`/`confirmarConsecutivosLegales`), tipos `RESPUESTA` y
  `OFICIO_INDEPENDIENTE` (correspondencia propia de la administración), firmante,
  `medioEnvio`, PDF.
- **Respuesta al ciudadano** existe y es rica: `ApprovalFlow`
  (`simi_aprobaciones_respuesta`) + `RespuestaFirma` (`simi_respuestas_firma`) con
  aprobación jefe/jurídica, firma, hash SHA-256, PDF, firma digital y notificación.
- **Comunicaciones internas: NO existen** (solo mención en `src/types/ventanilla.ts`;
  grep `comunicacion` → sin módulo). **Es la brecha real de BM-B20.**
- **Notificaciones** existen: `lib/email`, `lib/whatsapp`; `CanalEnvio` en
  `simi-firma.ts`.

### 2. Arquitectura lógica
- **Agregado de comunicación (evoluciona `SalidaOficial`):** una comunicación es
  un documento que sale de una dependencia; `OFICIO_INDEPENDIENTE` ya modela
  "correspondencia propia". Se **generaliza** para admitir **destinatario interno**
  (otra dependencia) → tipo `INTERNA`.
- **Numeración (reutiliza H3):** `leerConsecutivosLegales(tx, db, fecha, [{serie}])`
  con **serie por dependencia** (p. ej. `comunicaciones-110`) para BM-B21.
- **Circuito de firma (reutiliza):** `ApprovalFlow` + `RespuestaFirma` /
  `DigitalSignature` como mecanismo; para comunicaciones internas se usa un perfil
  **ligero** del flujo (sin revisión jurídica cuando no aplica).
- **Firmantes (nuevo pequeño):** catálogo de cargos autorizados por dependencia
  (BM-B31).
- **Envío/notificación (reutiliza):** `lib/email`, `lib/whatsapp`.
- **Trazabilidad (D9):** eventos de auditoría en el radicado/comunicación.

### 3. Límites del dominio (bounded context)
- **Dentro de C2:** comunicaciones **internas** (nuevo), catálogo de **firmantes**
  (BM-B31), **consecutivos por dependencia** (BM-B21), **plantillas/tipos** de
  comunicación (BM-B22), y el **circuito de firma** aplicado a comunicaciones
  (BM-B23) reutilizando lo existente.
- **Fuera de C2 (importante):**
  - **Unificar** el track de respuesta al ciudadano con el de salidas →
    **[OAT-02](../OAT_REGISTRO.md#oat-02)** (no aquí).
  - **Generar el contenido jurídico** de la respuesta al ciudadano → sigue en el
    flujo SIMI existente (D8) y en C7.
  - **Numeración legal base (H3)** → D9; C2 solo la consume.

### 4. Entidades y agregados
- **Agregado raíz `Comunicacion`** (evolución de `SalidaOficial`,
  `ventanilla_salidas`): añade `tipo: 'RESPUESTA'|'OFICIO_INDEPENDIENTE'|'INTERNA'`
  y `destinatarioInterno?: { tenantId, ... }` como alternativa a
  `DestinatarioSalida`. Invariantes: consecutivo único (H3), firmante autorizado,
  amarre opcional a radicado.
- **Entidad `FirmanteAutorizado`** (nuevo, BM-B31): `{ tenantId, cargo, uid?,
  puedeFirmar: TipoComunicacion[] }`. Fuente pendiente: documento G-GSC-170-003 (no
  entregado — riesgo R2).
- **Objeto de valor `ConfigConsecutivoDependencia`** (BM-B21): serie por dependencia
  para la numeración.
- **Reutilizadas:** `ApprovalFlow`, `RespuestaFirma`, `DigitalSignatureRequest`.

### 5. Eventos de negocio
- **`ComunicacionCreada`** (borrador). **`ComunicacionFirmada`** (reutiliza estados
  `RespuestaFirma`: `pendiente_firma`→`firmado`). **`ComunicacionEnviada`** /
  **`ComunicacionNotificada`** (canal). **`ComunicacionAcusada`** (acuse recibo).
  Consumidores: trazabilidad, reportes, bandeja del destinatario (D3).

### 6. Reglas de negocio
1. **Consecutivo único por serie/dependencia** (H3, invariante no-huérfano).
2. **Solo firma un cargo autorizado** (BM-B31); la firma registra snapshot del
   firmante (como `SalidaOficial.firmante`).
3. **Toda comunicación deja huella y acuse** (trazabilidad).
4. **Amarre opcional** a un radicado de entrada (tipo `RESPUESTA`).
5. **IA sugiere / funcionario decide:** SIMI puede redactar el borrador; la firma y
   el envío son humanos (Principio 9).
6. **Aislamiento por `tenantId`.**

### 7. Flujos principales y alternos
**Principal — comunicación interna:** dependencia A redacta (opcional: SIMI borrador)
→ toma consecutivo de su serie (H3) → circuito de firma (cargo autorizado) → envío/
notificación a dependencia B → acuse → trazabilidad. Aparece en la bandeja de B (D3).
**Alterno A — oficio externo:** ya soportado por salidas (`OFICIO_INDEPENDIENTE`);
C2 solo añade firmantes/plantillas.
**Alterno B — respuesta al ciudadano:** sigue el flujo SIMI existente; C2 no lo
altera (OAT-02 lo unificará después).
**Alterno C — rechazo/devolución en firma:** reutiliza `devuelto_para_ajustes`
(`ApprovalStatus`) → vuelve al redactor.
**Alterno D — sin canal digital:** `medioEnvio: FISICO`; entra a planillas (C5).

## B. Contratos e interfaces

### 8. Actores
Redactor (funcionario), **firmante autorizado** (cargo), destinatario (dependencia
interna / entidad externa / ciudadano), SIMI (borrador), sistema (numeración/envío).

### 9. Permisos
- Crear comunicación: rol con permiso en la dependencia origen.
- Firmar: **solo** cargos del catálogo de firmantes (BM-B31) → nueva verificación de
  autorización (reutiliza `lib/permisos` + `lib/seguridad`).
- Ver comunicación interna: dependencias origen/destino (aislamiento `tenantId`).

### 10. APIs
- **Reutiliza el patrón** `app/api/salidas/registrar/route.ts` (staging→tx→finalize,
  H3, PDF opcional). Se **generaliza** a `INTERNA` (nuevo tipo + destinatario
  interno) en vez de crear un endpoint paralelo.
- **Nuevos endpoints mínimos:** gestión del **catálogo de firmantes** (CRUD
  administrativo, BM-B31) y acuse de recibo interno.
- Contratos idempotentes; consecutivo server-side (Admin SDK), nunca cliente.

### 11. Integraciones
- **Internas:** D3 (la comunicación entra a la bandeja del destinatario), D5 (si es
  física, planilla), D9 (numeración/trazabilidad), D8 (borrador SIMI).
- **Externas:** email/WhatsApp (existentes); futuro (D10): firma electrónica
  certificada (ya hay `DigitalSignatureRequest`).

### 12. Modelo de datos
- **Evoluciona `ventanilla_salidas`** (no colección nueva para la comunicación):
  amplía `tipo` y añade `destinatarioInterno?`. *Alternativa evaluada:* colección
  nueva `comunicaciones` → descartada (duplicaría "salida"; ver §24 y OAT-02, que ya
  apunta a **un** agregado).
- **Nuevo:** colección `firmantes_autorizados` (pequeña, por tenant) para BM-B31;
  config de serie por dependencia para BM-B21.
- **Reutiliza:** `simi_respuestas_firma` / `simi_aprobaciones_respuesta` como
  mecanismo de firma (con perfil ligero para internas).
- **Índices:** por dependencia destino + fecha (bandeja de comunicaciones); se
  definirá el índice compuesto al implementar (patrón `INDICES_REQUERIDOS`).

## C. Reutilización vs. construcción

### 13. Reutilización de componentes existentes
- `lib/salidas/` (`construir-salida`, `radicado-salida`, `reporte-salidas`) y
  `app/api/salidas/registrar/route.ts` — base del agregado y del flujo.
- `lib/server/consecutivo-legal.ts` (H3) — numeración por dependencia.
- `src/types/simi-approval.ts`, `simi-firma.ts`, `simi-digital-signature.ts` —
  circuito de firma/aprobación.
- `lib/email`, `lib/whatsapp` — notificación.
- `lib/permisos`, `lib/seguridad`, `lib/trazabilidad` — permisos y huella.

### 14. Componentes nuevos (solo si son estrictamente necesarios)
- **Catálogo de firmantes autorizados (BM-B31):** justificado — hoy no existe;
  necesario para "solo firma quien está autorizado".
- **Tipo `INTERNA` + destinatario interno + serie por dependencia:** extensión
  mínima del agregado existente, no módulo nuevo.
- **Acuse de recibo interno:** pequeño; parte del ciclo de la comunicación interna.
- *No se crea* un módulo "comunicaciones" paralelo ni una colección nueva de
  comunicación (se evoluciona salidas).

## D. Impactos transversales

### 15. Impacto sobre SIMI
- SIMI **redacta borradores** de comunicaciones internas reutilizando la
  infraestructura de borradores (`simi_borrador_versiones`). Decisión humana: firma y
  envío. Sin IA en la numeración ni en la autorización de firma.

### 16. Impacto sobre seguridad
- Nueva superficie: endpoints de firmantes y de comunicación interna → autorización
  estricta por rol/tenant. Firma con snapshot no repudiable (hash, como
  `RespuestaFirma.hashDocumento`). Datos internos, no personales del ciudadano en el
  caso base.

### 17. Impacto sobre auditoría
- Refuerza: cada comunicación queda con consecutivo, firmante y canal trazables;
  acuse registrado. Reutiliza el patrón de eventos existente.

### 18. Impacto sobre rendimiento
- Bajo. Una transacción H3 por comunicación (idéntica a salidas hoy). Índice de
  bandeja por dependencia destino; sin cargas masivas.

### 19. Impacto sobre mantenibilidad
- **Mejora** si se extiende el agregado existente (una forma de "salida/comunicación")
  en vez de duplicar. **Advertencia honesta:** reutilizar `simi_respuestas_firma`
  (nombrado para "respuesta al ciudadano") para comunicaciones internas añade una
  tensión de nombres → refuerza la necesidad de **OAT-02** (no se resuelve aquí).

## E. Ejecución

### 20. Riesgos
- **R1 — Reutilizar el flujo de firma ciudadano para internas** puede arrastrar
  supuestos (revisión jurídica) no aplicables. Mitigación: perfil ligero de
  `ApprovalRules` (sin revisión jurídica cuando no aplica); si la fricción es alta,
  firma propia mínima para internas. *(Medio.)*
- **R2 — Catálogo de firmantes sin fuente:** G-GSC-170-003 **no entregado**.
  Mitigación: modelar el catálogo parametrizable y cargar cargos al validarse con la
  Alcaldía. *(Medio.)*
- **R3 — Ampliar `ventanilla_salidas`** puede afectar el libro de salidas actual.
  Mitigación: `tipo` aditivo, retrocompatible; tests de regresión del libro.
- **R4 — Divergencia con OAT-02:** si C2 acopla internas al flujo ciudadano, la
  unificación futura se complica. Mitigación: acoplar al agregado **salida**
  (más neutral), no al flujo ciudadano.

### 21. Estrategia de migración
- **Sin migración de datos:** `tipo INTERNA` es aditivo; las salidas existentes no
  cambian. Firmantes y series por dependencia son configuración nueva.
- **Retrocompatibilidad:** el libro de salidas sigue funcionando igual.

### 22. Estrategia de pruebas
- **Unitarias:** numeración por dependencia (H3, serie por dep); autorización de
  firma (cargo permitido/no permitido).
- **Integración (emulador):** ciclo interno completo (crear→firmar→enviar→acuse) con
  rollback transaccional (patrón salidas); no-huérfano del consecutivo.
- **Regresión por mutación** (ADR-0015): revertir la validación de firmante debe
  poner el test en rojo; el libro de salidas actual no debe romperse.
- **E2E:** comunicación interna A→B visible en la bandeja de B (D3).

### 23. Estrategia de despliegue
- **Flag** `comunicaciones_internas`. Rollout por dependencia piloto.
- **Rollback:** desactivar flag; salidas externas y respuesta ciudadana intactas.
- **Observabilidad:** métricas de comunicaciones emitidas/firmadas/acusadas por
  dependencia y canal (alimenta KPIs de la ficha C2).

## F. Análisis crítico obligatorio (ADR-0023 §3)

1. **¿Qué simplificamos?** Reutilizamos el flujo de salida/firma/notificación en vez
   de crear un módulo de comunicaciones desde cero.
2. **¿Qué eliminamos?** La ausencia de comunicaciones internas formales (hoy fuera
   del sistema). No eliminamos código existente.
3. **¿Qué consolidamos?** Numeración (H3), firma (SIMI), notificación (email/WhatsApp)
   como servicios compartidos por respuesta/oficio/interna.
4. **¿Qué reutilizamos?** Salidas, H3, circuito de firma/aprobación, notificación,
   permisos, trazabilidad. **Nuevo real:** catálogo de firmantes + tipo INTERNA +
   acuse.
5. **¿Qué evitamos construir?** Un módulo "comunicaciones" paralelo; una colección
   de comunicación nueva; una segunda numeración; IA en firma/numeración.
6. **¿Existe una alternativa aún más simple?** Se evaluaron tres bases para internas:
   (a) nuevo módulo → descartado (duplica); (b) colgar del flujo **ciudadano** SIMI →
   descartado (arrastra revisión jurídica y nombres ciudadano-céntricos); (c)
   **generalizar el agregado salida** → elegido (salida ya modela "correspondencia
   propia"). Es la más simple que cubre el caso sin cerrar la puerta a OAT-02.
7. **¿Qué ocurrirá en 5 años si esto permanece?** Con OAT-02, respuesta/oficio/
   interna convergen en un solo agregado `Comunicación`; C2 ya acopla al agregado
   **salida** (el más neutral), de modo que la convergencia es evolución, no
   reescritura. **La decisión envejece bien** si respetamos OAT-02; si se ignorara,
   la deuda de dos tracks crecería (por eso queda registrada).

### 24. Veredicto del análisis crítico
- [x] **Sin oportunidad de mayor simplificación dentro del alcance de C2** (se eligió
  la base más neutral y reutilizadora).
- [ ] *Mejora estructural mayor detectada pero fuera de alcance:* unificar los dos
  tracks de salida → **no se arrastra por inercia**; se registra como **OAT-02** y se
  recomienda **después** de C2 en producción. El bucle de re-revisión **no** se
  dispara para C2 (la mejora es transversal, no un defecto del diseño de C2).

## G. Definition of Ready (ADR-0023 §5) — no es autorización

- [x] Blueprint completo (todas las secciones).
- [x] **Cuatro Preguntas:** (1) problema real: comunicaciones internas fuera del
  sistema — sí · (2) mejor solución: generalizar salida + reutilizar firma, sin
  módulo paralelo — sí · (3) valor>complejidad: alto valor (reducción de carga),
  complejidad media contenida por reutilización — sí · (4) largo plazo: acopla a la
  base neutral y prepara OAT-02 — sí.
- [x] **Valor Neto (ADR-0020):** Muy Alto (mayor reducción de carga del roadmap),
  complejidad media. Favorable.
- [x] **Análisis crítico** superado; la mejora mayor se deriva como OAT-02, no se
  mezcla.

**C2 queda como CANDIDATA a implementación.** Requiere **autorización expresa** del
propietario y la **liberación del Bloque 2**. Este Blueprint **no** autoriza código.

## H. Hallazgos Arquitectónicos Transversales (OAT)

Detectadas durante este análisis (registro canónico en
[`../OAT_REGISTRO.md`](../OAT_REGISTRO.md)). **No autorizan cambios.**

| OAT | Título | Prioridad | Momento recomendado |
|---|---|---|---|
| [OAT-02](../OAT_REGISTRO.md#oat-02) | Consolidar los dos tracks de salida (respuesta ciudadano + oficios) en un único agregado "Comunicación" | Alta | Después de C2 en producción |
| [OAT-03](../OAT_REGISTRO.md#oat-03) | Unificar el vocabulario de "canal de envío" (`CanalRespuesta`/`MedioEnvioSalida`/`CanalEnvio`) | Media-Baja | Junto con OAT-02 |

*Relación con OAT previa: **OAT-01** (unificar modelo del radicado, de C1) también
toca esta zona, pero su foco es el radicado de entrada, no la comunicación de salida.*

---

## Anexo — Diseño de implementación (commit-ready) · **CONGELADO por H3**

**Estado:** especificación lista para ejecutar, **NO implementar todavía.** C2 crea
comunicaciones con **consecutivo por dependencia** (H3): toca la numeración legal,
que es justo el bloqueo vigente del Bloque 2. Se deja preparada; se ejecuta **cuando
H3 quede formalmente liberado** (CI + barrida). Decisión del propietario: solo se
implementan capacidades ortogonales a H3.

### I. Por qué C2 no es ortogonal a H3
El registro de una comunicación consume un **consecutivo legal** vía
`leerConsecutivosLegales`/`confirmarConsecutivosLegales` (mismo helper que hoy usan
salidas, `app/api/salidas/registrar/route.ts:12`). Con **serie por dependencia**
(BM-B21) se añaden nuevos contadores (`counters/comunicaciones-{dep}-{año}`). Eso es
exactamente el terreno que el congelamiento protege → **no se toca hasta liberar H3.**

*Matiz:* el **catálogo de firmantes (BM-B31)** sí es ortogonal a H3, pero **no aporta
valor por sí solo** (un catálogo sin el flujo que lo consume). Por "valor completo
por fase" (ADR-0021) se mantiene dentro de C2, no se adelanta suelto.

### II. Puntos de edición (evidencia)
| Cambio | Archivo(s) | Naturaleza |
|---|---|---|
| Tipo `INTERNA` + `destinatarioInterno` | `src/types/salida.ts` (`TipoSalida`, `SalidaOficial`) | aditivo, retrocompatible |
| Consecutivo por dependencia (BM-B21) | `lib/server/consecutivo-legal.ts` (serie param ya existe) + builder | **toca H3** |
| Endpoint registrar comunicación interna | nuevo, **espejo** de `app/api/salidas/registrar/route.ts` (staging→tx→finalize) | **toca H3** |
| Catálogo de firmantes (BM-B31) | nueva colección `firmantes_autorizados` + tipo + CRUD | ortogonal (pero sin valor solo) |
| Circuito de firma (BM-B23) | reutiliza `ApprovalFlow`/`RespuestaFirma` (perfil ligero) | reutilización |
| Notificación/acuse | `lib/email`, `lib/whatsapp` | reutilización |

### III. Cambios (cuando se libere H3)
1. **Modelo** (`salida.ts`): `TipoSalida |= 'INTERNA'`; `SalidaOficial.destinatarioInterno?: { tenantId: TenantId; dependenciaNombre: string }` como alternativa a `destinatario`. Aditivo → el libro de salidas actual no cambia.
2. **Firmantes** (BM-B31): `interface FirmanteAutorizado { tenantId; cargo; uid?; puedeFirmar: TipoSalida[] }`; colección `firmantes_autorizados`; CRUD administrativo; verificación en el registro (reutiliza `lib/permisos`). Fuente de cargos: **G-GSC-170-003 (no entregada — R2)** → parametrizable.
3. **Consecutivo por dependencia** (BM-B21): serie `comunicaciones-{codigoDep}` pasada al helper H3; **misma mecánica transaccional** que salidas (no-huérfano).
4. **Endpoint** `POST /api/comunicaciones/registrar`: espejo de salidas/registrar (staging PDF → tx H3 + `tx.set` → finalize); emite trazabilidad; entra a la bandeja del destinatario (D3).
5. **Firma** (BM-B23): perfil **ligero** de `ApprovalRules` (sin revisión jurídica cuando no aplica) reutilizando `simi_respuestas_firma`.

### IV. Pruebas (cuando se ejecute)
- Numeración por dependencia (H3, serie por dep): unicidad + no-huérfano en emulador.
- Autorización de firma (cargo permitido / no permitido).
- Regresión por mutación (ADR-0015): revertir la validación de firmante → rojo; el
  libro de salidas actual intacto.
- E2E: comunicación interna A→B visible en la bandeja de B.

### V. Bloqueantes previos a ejecutar
- **Liberación de H3** (CI + barrida) — bloqueo principal.
- **G-GSC-170-003** (cargos firmantes) para poblar el catálogo (mitigable: parametrizable).
- Autorización expresa del propietario.
- **No** cherry-pick del catálogo de firmantes por sí solo (sin valor; ADR-0021).

*Referencias transversales: OAT-02 (unificar los dos tracks de salida) y OAT-03
(unificar el vocabulario de canal) siguen registradas y **no** se abordan en C2.*
