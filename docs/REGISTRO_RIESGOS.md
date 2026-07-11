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
| **H2** | Identidad reservada visible en vistas internas (detalle, bandeja) **y en la exportación CSV/Excel** —`nombreCompleto`+`numeroDocumento` sin guarda, vector de exfiltración de mayor impacto (confirmado por el coordinador)— pese a estar enmascarada en mostrador/consulta/MIPG | MEDIA-ALTA (ALTA si denunciante) | Ley 1581/2012 art. 4 f/g/h | PLANIFICADO — Ola 1 (P-A/H2) | dev-frontend (reutilizar `identidadProtegida`) | `docs/PLAN_OLA1.md`; `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md`; `e2e/07-identidad-reservada.spec.ts`; `app/interno/dashboard/page.tsx` ~2493-2500, ~4290, **~3687-3692 (export)** |
| **R3** | Hueco de consecutivo AGN cuando la subida de adjunto no completa (incremento no atómico respecto a la persistencia del radicado) | MEDIA | Acuerdo AGN 060/2001 (consecutivo) | ABIERTO (backlog) | dev-backend | `docs/laboratorio/FASE2_BITACORA.md` (hallazgo QA #2); `lib/radicado-institucional.ts`, `lib/actions/radicarVentanilla.ts` |
| **R4** | Modal "Resumen del día" se abre por fetch asíncrono y su backdrop intercepta clics de cualquier control en curso | MEDIA (UX/operativo) | Auditoría funcional | ABIERTO (backlog) | ux-ui + dev-frontend | `docs/laboratorio/FASE2_BITACORA.md` (hallazgo QA #4) |
| **R5** | Confirmación "✓ Asignado" puede no mostrarse (carrera estado local React ↔ listener Firestore); misma clase que el toast del cierre estabilizado en E2E 01 | BAJA | Auditoría funcional | ABIERTO (backlog) | dev-frontend | `docs/laboratorio/FASE2_BITACORA.md` (hallazgo QA #3); `e2e/01-ciclo-dorado.spec.ts` (estabilización) |
| **R6** | La prórroga no se impide si el término original ya venció; el art. 14 exige informar la ampliación *antes* del vencimiento | MEDIA-BAJA | Ley 1755/2015 art. 14 (parágrafo) | ABIERTO (backlog) — detectado en la revisión de conformidad de H1, fuera de su alcance | dev-backend | `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H1 remediación, residual 1) |
| **R7** | Robustez ante `termino.diasRespuesta` ausente (legado) — hoy campo requerido y siempre poblado, riesgo teórico | BAJA | Observación de robustez | ABIERTO (backlog) | dev-backend | `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H1 remediación, residual 2) |

## Resueltos (trazabilidad de cierre)

| ID | Hallazgo | Sev. | Resolución | Trazabilidad |
|----|----------|------|-----------|--------------|
| **H1** | Prórroga sin unicidad ni tope del doble del término | **ALTA** | **RESUELTO 2026-07-10** — excepción controlada al congelamiento aprobada por el propietario. Control ejecutable `validarProrroga` (unicidad 409 + tope 400) que **impide** antes de escribir; 6 unitarias + E2E 09 invertido (2ª prórroga rechazada); conformidad **CONFORME** (gobierno-digital, art. 14); 828 unitarias + 16 E2E sin regresión. Residuales R6/R7 abiertos, ajenos al alcance. | ADR-0003; `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H1 remediación verificada); `lib/server/radicados-security.ts`; `__tests__/prorroga-validacion.test.ts`; `e2e/09-prorroga-con-notificacion.spec.ts` |
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
