---
name: auditoria-licencias-bloques-abc
description: Auditoría E2E por código de los Bloques A→B→C del módulo de Licencias (8-ago-2026), previa a reunión con Planeación/Jurídica — huecos funcionales y puntos de parametrización verificados
metadata:
  type: project
---

Auditoría encargada por el propietario el 8-ago-2026, en `main` (b2a5ae1 → 19 commits detrás en el worktree, actualizado con `git pull --ff-only`), sin login (revisión por código+tests, no UI viva).

**Suite del módulo**: 33 archivos de test, 421 tests, TODOS pasan (`npx vitest run` sobre los 33 archivos que tocan licencias/motor-expedientes/expedientes-documentos, ~111s, sin reintentos ni flakiness observada en un run limpio). Comando: `npx vitest run $(grep -rl "licencias\|motor-expedientes\|expedientes-licencias\|expedientes-documentos" __tests__ | sort | tr '\n' ' ')`.

**Hueco de pirámide** (no bug, hallazgo de cobertura): CERO specs E2E Playwright (`e2e/*.spec.ts`, 15 archivos numerados) cubren el módulo de Licencias — toda la verificación es unitaria/decisión pura + tests de ruta con Firestore stub. El flujo completo (crear→checklist→subir→acta→respuesta→libro) nunca se ejercita de punta a punta con un browser real.

**Huecos funcionales reales encontrados** (clasificados, con archivo:línea):
1. MOLESTO — `avisoEnviado`/`constanciaEnviada` (respuesta de `POST .../actuaciones` y `.../desde-radicado`) se calcula bien en servidor pero la UI (`RegistrarActuacionModal.tsx`, `CrearDesdeRadicadoModal.tsx`) solo muestra texto cuando es `true`; si es `false` (sin email) no hay NINGÚN mensaje — el funcionario no puede saber si el aviso/constancia se envió o no.
2. MOLESTO — botones "Registrar acta de observaciones"/"Registrar respuesta de subsanación" en `DetalleLicenciaClient.tsx` (~L313-332) se deshabilitan sin ningún texto/tooltip que explique por qué (contraste: "Emitir acto final" sí usa `notaDeshabilitado`). Si ya hubo acta, el funcionario no puede ni abrir el modal para leer la nota explicativa.
3. MOLESTO — `GET /api/licencias/expedientes` (route.ts) sin `.limit()`, y `BandejaLicenciasClient.tsx` sin paginación/búsqueda/filtro — no escala visualmente pasado un puñado de expedientes. Bajo riesgo HOY porque R10 (candado de emisión real) sigue cerrado.
4. COSMÉTICO/deuda — `POST .../documentos` (route.ts) valida `requisitoId` contra la Definición pero NUNCA reevalúa `evaluarCondicion`/completitud — servidor aceptaría un aporte sobre un requisito actualmente NO_APLICA si alguien lo llama fuera de la UI (la UI sí gatea correctamente vía `RequisitoItem.puedeSubir`).

**Bien resuelto, no reportar como hueco**: guard de acta única (409), respuesta-subsanación sin acta previa (409), RECONSTRUIDO solo-lectura sin semáforo, guard de dependencia (visual + 403 server), radicado ya vinculado excluido de candidatos, D7 corrección vía "Reemplazar (nueva versión)" con etiqueta explícita, esPrueba visible en bandeja/libro/CSV, checklist con badge Completo/Incompleto + aviso "PARCIAL página 1/2".

**Puntos de parametrización verificados** (todos existen, tienen candado documentado, cambio acotado):
- P1′ (códigos locales LA/LCR VISR/LRC) → `lib/motor-expedientes/catalogo-subtipos-normativo.ts` `EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS`, tipo `EquivalenciaMigracion` — cambio = agregar filas de dato.
- P4′ (estados operativos históricos) → SIN estructura de código todavía, solo intención declarada en JSDoc de `estados-licencia.ts` ("un estado operativo futuro se mapeará A estos hitos"); a diferencia de P1′ no hay tipo/tabla lista — cuando llegue el dato puede exigir diseño nuevo, no solo relleno.
- Checklist oficial completo (página 2) → `lib/motor-expedientes/definiciones/licencia-construccion-parcial.ts`, array `requisitos` — cambio = dato, ya declarado parcial con aviso visible en UI.
- Política del término (hueco 1 ADR-0029) → `PoliticaTermino` dual en `lib/motor-expedientes/termino.ts`; sin default en ningún punto.
- Texto del aviso bajo suspensión → `VARIANTE_B_SUSPENSION` en `lib/email/templates/aviso-acta-observaciones.ts` — cambio = 1 línea en `buildAvisoActaHtml` cuando exista concepto escrito.
- RN-5/gate de subsanación → `lib/catalogos/regimen-legal-subsanacion.ts` (`REGIMEN_SUBSANACION_POR_TIPO`, `LICENCIA_CONSTRUCCION: ESPECIAL_NO_HABILITADO`) — fail-closed por `Record` exhaustivo, no compila un tipo nuevo sin clasificar.
- Vigencias → `lib/motor-expedientes/vigencias.ts`, semillas `VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE`/`VIGENCIAS_ANTERIORES_D1469_SEMILLA` — contrato anti-consumo con test dedicado (`__tests__/vigencias-anti-consumo.test.ts`) que falla si algo bajo `app/` las importa.
- R10 (emisión real) → `EMISION_REAL_EXPEDIENTES_HABILITADA = false` en `lib/server/expedientes-licencias.ts` — activar exige flag + tocar `planCrearExpedienteDemo`/`planCrearExpedienteDesdeRadicado` para dejar de forzar `esPrueba:true` (cambio acotado a 2 funciones, no reescritura).
- P5/P6 → alimentan la migración (Fase 5), no tienen punto de código propio todavía (confirmado, ADR-0029).

Veredicto dado al propietario: listo para la reunión — nada bloquea la demo de los Bloques A→B→C; los 4 huecos son reales pero MOLESTO/COSMÉTICO, no BLOQUEA-DEMO. Recomendación entregada: no bloquear la reunión por esto, pero llevar el punto 1 (aviso silencioso) como pregunta explícita a Jurídica/Planeación porque toca confianza operativa, no solo UX.
