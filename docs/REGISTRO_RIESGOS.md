# Registro de riesgos y hallazgos abiertos

Artefacto de gobernanza vivo (directriz del propietario, 2026-07-10): ningún
hallazgo de riesgo, seguridad o cumplimiento normativo queda implícito ni
olvidado. Cada entrada permanece trazable hasta su **resolución** o su
**aceptación formal del riesgo** por el propietario. Las entradas ALTA que se
decidan corregir bajo el congelamiento se formalizan además como ADR.

Estados: `ABIERTO` · `EN DECISIÓN` (esperando al propietario) · `EN CURSO` ·
`RESUELTO` · `RIESGO ACEPTADO` (con firma del propietario y motivo).

## Abiertos

| ID | Hallazgo | Sev. | Norma / origen | Estado | Dueño técnico | Trazabilidad |
|----|----------|------|----------------|--------|---------------|--------------|
| **R3** | Hueco de consecutivo AGN cuando la subida de adjunto no completa (incremento no atómico respecto a la persistencia del radicado) | MEDIA | Acuerdo AGN 060/2001 (consecutivo) | ABIERTO (backlog) | dev-backend | `docs/laboratorio/FASE2_BITACORA.md` (hallazgo QA #2); `lib/radicado-institucional.ts`, `lib/actions/radicarVentanilla.ts` |
| **R4** | Modal "Resumen del día" se abre por fetch asíncrono y su backdrop intercepta clics de cualquier control en curso | MEDIA (UX/operativo) | Auditoría funcional | ABIERTO (backlog) | ux-ui + dev-frontend | `docs/laboratorio/FASE2_BITACORA.md` (hallazgo QA #4) |
| **R5** | Confirmación "✓ Asignado" puede no mostrarse (carrera estado local React ↔ listener Firestore); misma clase que el toast del cierre estabilizado en E2E 01 | BAJA | Auditoría funcional | ABIERTO (backlog) | dev-frontend | `docs/laboratorio/FASE2_BITACORA.md` (hallazgo QA #3); `e2e/01-ciclo-dorado.spec.ts` (estabilización) |
| **R7** | Robustez ante `termino.diasRespuesta` ausente (legado) — hoy campo requerido y siempre poblado, riesgo teórico | BAJA | Observación de robustez | ABIERTO (backlog) | dev-backend | `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H1 remediación, residual 2) |
| **R11** | El dashboard (y la búsqueda avanzada) cargan la colección de radicados completa al montar/consultar (paginación en memoria, sin límite server-side) — la carga crece con el histórico; con 209 radicados en stage el dashboard ya se ralentiza lo bastante para desestabilizar el E2E más largo (01). Impacto directo en la visión multi-municipio (un municipio real con miles de radicados) | MEDIA (rendimiento/escalabilidad) | Auditoría — diagnóstico de estabilidad E2E | ABIERTO (backlog → P-C/Ola 2 rendimiento) | dev-backend + firestore-datos | `e2e/01-ciclo-dorado.spec.ts` (raíz de la inestabilidad); `app/api/radicados/busqueda-avanzada/route.ts`; tarea `task_7f9e8ba3` |
| **R12** | `ocultarIdentidad` (server, `lib/busqueda/filtros-radicado.ts:83`) DUPLICA el criterio de reserva de `identidadProtegida` en vez de importarlo. Hoy son lógicamente idénticos (deuda DRY), pero es la definición misma de "identidad reservada" (predicado de cumplimiento art. 4 f/g): si divergen, la brecha sería SILENCIOSA (ningún test la detecta) | BAJA (latente, normativamente sensible) | Ley 1581/2012 art. 4 f/g (DRY del predicado de cumplimiento) | ABIERTO (backlog) — detectado en la revisión cruzada de R9 | dev-backend | `lib/busqueda/filtros-radicado.ts:83`; `lib/seguridad/identidad-protegida.ts`; recomendación: importar + test de equivalencia en CI |
| **R10** | Necesidad de conocer: la variante A enmascara para TODOS, incluido el funcionario responsable que podría necesitar la identidad para tramitar (conservador y conforme, no incumplimiento) | BAJA | Ley 1581/2012 (acceso legítimo por rol) | **EN DECISIÓN (dueño: product-owner)** — la variante B (quién revela, condición, traza, alcance) requiere decisión de producto antes de poder tener un control ejecutable; variante A vigente es CONFORME, sin urgencia. Confirmado por gobierno-digital (2C, Ola 2). | product-owner + gobierno-digital | `docs/adr/0012-controles-normativos-ejecutables.md`; `docs/laboratorio/CONCEPTO_NORMATIVO_OLA2.md`; ADR-0006 |

## Resueltos (trazabilidad de cierre)

| ID | Hallazgo | Sev. | Resolución | Trazabilidad |
|----|----------|------|-----------|--------------|
| **H1** | Prórroga sin unicidad ni tope del doble del término | **ALTA** | **RESUELTO 2026-07-10** — excepción controlada al congelamiento aprobada por el propietario. Control ejecutable `validarProrroga` (unicidad 409 + tope 400) que **impide** antes de escribir; 6 unitarias + E2E 09 invertido (2ª prórroga rechazada); conformidad **CONFORME** (gobierno-digital, art. 14); 828 unitarias + 16 E2E sin regresión. Residuales R6/R7 abiertos, ajenos al alcance. | ADR-0003; `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H1 remediación verificada); `lib/server/radicados-security.ts`; `__tests__/prorroga-validacion.test.ts`; `e2e/09-prorroga-con-notificacion.spec.ts` |
| **R9** | Canal de inferencia en filtros de cliente (búsqueda por nombre/documento de reservados) | BAJA-MEDIA (normativo) | **RESUELTO 2026-07-11** (Ola 2, ADR-0012). Función pura `coincideIdentidadFiltroRapido` que reutiliza `identidadProtegida` (el servidor ya cerraba R9); reservado no coincide por nombre/documento, sí por radicadoId. Conformidad **CONFORME** (gobierno-digital, Ley 1581 art. 4 f/g); control de regresión: 11 casos en `__tests__/coincidencia-filtro-rapido.test.ts`. | ADR-0012; `lib/busqueda/coincidencia-filtro-rapido.ts`; `docs/laboratorio/CONCEPTO_NORMATIVO_OLA2.md` |
| **R6** | Prórroga sobre término ya vencido no se impedía | MEDIA-BAJA (normativo) | **RESUELTO 2026-07-11** (Ola 2, ADR-0012). `validarProrroga` valida temporalidad (rechaza si `fechaVencimiento <= ahora`, reloj inyectable); conformidad **CONFORME** (gobierno-digital, Ley 1755 art. 14 parágrafo); control de regresión: 8 casos en `__tests__/prorroga-validacion.test.ts` (13 total verdes). | ADR-0012; `lib/server/radicados-security.ts`; `docs/laboratorio/CONCEPTO_NORMATIVO_OLA2.md` |
| **R8** | Escritura de trazabilidad no validaba tenant (aislamiento incompleto) | ALTA (regla) / mitigado | **RESUELTO 2026-07-11** (Ola 1, ADR-0008). `canWriteTrazabilidad` valida tenant para Funcionario (patrón del `allow read`); revisión cruzada **CONFORME** (seguridad); control de regresión: matriz rules-unit-testing con caso volteado a 'denegado' + 3 filas que blindan la asimetría (Admin/Recepcionista cross-tenant, CI/sin-perfil denegados), **verde en CI** (emulador). | ADR-0008; `firestore.rules`; `e2e/rules/matriz-aislamiento-tenant.test.mjs`; `docs/MODELO_MIPG.md` |
| **H2** | Identidad reservada visible en vistas internas + exportación CSV | MEDIA-ALTA | **RESUELTO 2026-07-11** (Ola 1, ADR-0006, variante A). Helper compartido `lib/seguridad/identidad-protegida.ts` aplicado transversal en 8 superficies + export; conformidad **CUMPLE** (gobierno-digital, Ley 1581 art. 4 f/g/h); control de regresión: 20 unitarias + `e2e/07` extendido (probado rompiendo el masking); 848 unitarias + 14/15 E2E sin regresión (01 fijado 3/3, causa R11). Residuales R9/R10 (variante B, diferida). | `docs/adr/0006-enmascaramiento-identidad-reservada.md`; `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H2 remediación verificada) |
| S1 | `getClientIp` confiaba en `x-forwarded-for` sin proxy de confianza → bypass del rate limit público | MEDIA (seguridad) | Corregido y mergeado a `main` | PR #90; chip `task_93ec61ec` |
| S2 | Storage no aprovisionado en stage bloqueaba el 100% de adjuntos (diagnóstico inicial "CORS" era incorrecto) | ALTA (infra) | Stage a Blaze, Storage activo, reglas desplegadas, subida verificada 403→200; E2E 04 reactivado y verde | chip `task_20a8cafc`; `docs/laboratorio/PROVISION_STORAGE_STAGE.md`; `e2e/04-radicacion-adjunto.spec.ts` |

## Candidatas post-congelamiento (mejoras, no riesgos)

Registradas para evaluación cuando se levante el congelamiento; no se
implementan durante la ejecución (Principio de la Regla Suprema).

- Unificar el mecanismo de subida (Radicación Rápida interna sube cliente-directo vs. `/radicacion` pública server-side).
- Default de tipo distinto entre Radicación Rápida (`PETICION_INFORMACION`) y Registro exprés (`PETICION_GENERAL`) — unificar.
- `ventanilla_salidas` sin higiene `isTest` del lado cliente (ningún hook la filtra).
- Comentario `1-EMAIL-` desactualizado en Registro exprés (id real `1-110-`).

## Regla de operación

- **Ciclo obligatorio de todo hallazgo (principio permanente, 2026-07-10):**
  Riesgo → Decisión de arquitectura (ADR) → Implementación → Pruebas →
  Revisión cruzada → Evidencia → Cierre trazable. **Ninguna corrección se
  acepta sin un control automatizado capaz de detectar su regresión.**
  Ejemplar de referencia: H1 (ADR-0003).
- El propietario revisa este registro en cada cierre de fase.
- Un hallazgo **ALTA** no se cierra por olvido ni por vencimiento de sprint:
  solo por resolución técnica verificada o por aceptación formal del riesgo
  (registrada aquí con fecha y motivo).
- Cuando exista control automatizado que detecte la regresión de un hallazgo
  (p. ej. un test que falle si H1 reaparece), se enlaza en su fila — la meta
  es que cada riesgo cerrado quede protegido por evidencia automatizada
  (nuevo criterio de éxito del proyecto, 2026-07-10).
