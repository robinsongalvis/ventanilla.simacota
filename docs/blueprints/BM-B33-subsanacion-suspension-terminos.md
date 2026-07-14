# Blueprint Arquitectónico — BM-B33 · Subsanación y suspensión de términos (Ley 1755, Art. 17)

**Estado:** EN REVISIÓN → requiere **validación normativa** antes de Definition of Ready.
**No autoriza implementación** (ADR-0023). Capacidad del **núcleo** (D3/Trámite), no un
dominio nuevo. **Ortogonal a H3.** **Rol:** Chief Software Architect.

- **Fuente de verdad:** **Ley 1755/2015 Art. 17** (peticiones incompletas y desistimiento)
  + procedimiento **P-GSC-8200-170-014** (tratamiento de PQRSD).
- **BM:** BM-B33. **Versión:** v1 — 2026-07-14.

---

## A. Arquitectura funcional y de dominio

### 1. Funcional detallada
Cuando una petición está **incompleta**, el funcionario **requiere al ciudadano** que la
complete; al emitir ese requerimiento **el término legal se suspende** (el reloj se
detiene). El ciudadano tiene **un (1) mes** para subsanar. Si **subsana**, el término se
**reactiva** con los días hábiles que quedaban. Si **no subsana** en el mes, opera el
**desistimiento tácito** y se archiva **mediante acto administrativo motivado** (decisión
humana; la IA/el cron solo detecta y propone).

### 2. Lógica
- **Requerimiento de subsanación** (nueva acción del funcionario) → notifica al ciudadano
  (reutiliza correo/WhatsApp) + **suspende término**.
- **Suspensión** = se guarda `diasRestantesAlSuspender` y `fechaLimiteSubsanacion`
  (hoy + 1 mes); el semáforo/vencimiento **ignora** el reloj mientras esté suspendido.
- **Reactivación** = cuando el ciudadano completa (reutiliza `completar-datos`), se
  recalcula `fechaVencimiento = reactivación + diasRestantesAlSuspender` (días hábiles).
- **Desistimiento tácito** = **cron** diario detecta suspendidos con
  `fechaLimiteSubsanacion` vencida → **propone** desistimiento; el funcionario lo
  **confirma con acto motivado**.

### 3. Límites del dominio
- **Dentro:** requerimiento de subsanación al ciudadano, suspensión/reactivación del
  término, desistimiento tácito (detección + confirmación humana).
- **Fuera:** la **devolución interna** entre dependencias (ya existe `devolver`, y **no**
  debe suspender el término del ciudadano — son cosas distintas); prórroga (ya existe);
  gestión de archivo (C11).

### 4. Entidades y agregados
Se extiende `TerminoLegal` (`src/types/ventanilla.ts`) con un objeto de suspensión:
```
suspension?: {
  activa: boolean;
  fechaRequerimiento: string;        // ISO — cuándo se requirió
  fechaLimiteSubsanacion: string;    // ISO — +1 mes calendario
  diasHabilesRestantes: number;      // reloj congelado al suspender
  motivo: string;                    // qué debe subsanar
  requeridoPor: { uid: string; nombre: string };
}
```
Sin colección nueva (vive en el radicado). Invariante: la **foto** del término original no
se pierde; la suspensión es aditiva y auditable.

### 5. Eventos de negocio
`RequerimientoSubsanacionEmitido` (suspende) · `SubsanacionRecibida` (reactiva) ·
`DesistimientoTacitoPropuesto` (cron) · `DesistimientoTacitoConfirmado` (acto del
funcionario). Todos a trazabilidad (nuevas `AccionAuditoria`).

### 6. Reglas de negocio (Ley 1755 Art. 17)
1. El requerimiento debe emitirse **dentro** del término y **suspende** el cómputo.
2. Plazo de subsanación al ciudadano: **1 mes** (calendario).
3. Si subsana → **se reanuda** el término por los **días hábiles restantes** (no se
   reinicia).
4. Si **no** subsana en el mes → **desistimiento tácito**, archivo por **acto
   administrativo motivado** (Art. 17) — **decisión humana** (Principio 9), nunca
   automática por el sistema.
5. La suspensión **no** aplica a la devolución interna ni afecta a otras dependencias.
6. Aislamiento por `tenantId`.

### 7. Flujos
**Principal:** funcionario abre el radicado → "Requerir subsanación" (motivo) → sistema
suspende término + notifica al ciudadano → el radicado queda **EN_SUBSANACION** (reloj
detenido) → ciudadano completa (`completar-datos`) → término se reactiva → sigue el
trámite. **Alterno (desistimiento):** vence el mes sin respuesta → cron **propone** →
funcionario **confirma** desistimiento con acto → estado **DESISTIDO/archivado**.

## B. Contratos e interfaces
- **8. Actores:** funcionario (requiere/confirma), ciudadano (subsana), cron (detecta), SIMI
  (opcional: sugiere el texto del requerimiento). 
- **9. Permisos:** requerir subsanación / confirmar desistimiento → mismo alcance que
  responder/devolver (por `tenantId`, `lib/permisos` + `internal-auth`).
- **10. APIs:** `POST /api/radicados/[id]/requerir-subsanacion` (motivo → suspende +
  notifica); reactivación **enganchada** a `completar-datos` (ya existe) o
  `POST /api/radicados/[id]/reactivar`; `POST /api/radicados/[id]/desistimiento` (confirma
  acto). Nuevo cron `app/api/cron/desistimiento-tacito` (patrón `alertas-vencimiento`).
- **11. Integraciones:** notificación ciudadano (email/WhatsApp existentes). Sin externas.
- **12. Modelo de datos:** `termino.suspension` (arriba) + **nuevo estado**
  `EN_SUBSANACION` y `DESISTIDO` en `EstadoRadicado`. Sin colección nueva.

## C. Reutilización vs. construcción
- **13. Reutiliza:** `completar-datos` (reactivación), notificación al ciudadano,
  `diasRestantesHabiles`/`calcularFechaVencimiento` (`lib/tiempos-radicado`), patrón de
  cron `alertas-vencimiento`, trazabilidad, permisos.
- **14. Nuevo (justificado):** acción "requerir subsanación" + endpoint; objeto
  `termino.suspension`; estados `EN_SUBSANACION`/`DESISTIDO`; cron de desistimiento;
  plantilla del requerimiento. Todo mínimo y anclado a la norma.

## D. Impactos transversales
- **15. SIMI:** puede **redactar** el requerimiento (qué falta) y **avisar** proximidad del
  desistimiento; el funcionario decide. Nunca archiva solo.
- **16. Seguridad/legal:** el desistimiento es acto administrativo → **humano**; el sistema
  no lo ejecuta automáticamente. Datos personales sin cambios.
- **17. Auditoría:** cada paso (requerimiento, suspensión, reactivación, desistimiento)
  con huella — evidencia de cumplimiento Art. 17.
- **18. Rendimiento:** cron diario acotado (solo suspendidos). Sin impacto en radicación.
- **19. Mantenibilidad:** concentra la lógica del "reloj legal" en `tiempos-radicado`.

## E. Ejecución
- **20. Riesgos:**
  - **R1 — Ripple del estado nuevo:** `estadoActual` se usa en **~54 archivos**; añadir
    `EN_SUBSANACION`/`DESISTIDO` obliga a revisar los sets `ESTADOS_ACTIVOS` (≥3 copias) y
    los switch de estado. Mitigación: el `union` con `tsc` **exhaustivo** guía cada punto;
    tratar `EN_SUBSANACION` como *activo con reloj detenido*. Ver **OAT-05** (centralizar
    los estados activos).
  - **R2 — Cálculo del reloj:** reactivar mal = incumplir la ley. Mitigación: lógica pura
    en `tiempos-radicado` con **pruebas dedicadas** y de mutación.
  - **R3 — Detalle normativo** (días hábiles vs calendario del mes, momento exacto de
    suspensión). Mitigación: **validación con gobierno-digital** antes de codear (bloqueante).
- **21. Migración:** aditiva; radicados existentes sin `suspension` siguen igual. Sin
  reescritura.
- **22. Pruebas:** unitarias del reloj (suspender→reactivar conserva días hábiles;
  desistimiento por vencimiento del mes); mutación (revertir la suspensión → el término
  seguiría corriendo → rojo); integración del cron (solo propone, no archiva); no-regresión
  de KPIs/semáforo con el estado nuevo.
- **23. Despliegue:** flag `subsanacion_art17`; cron nuevo desactivable; rollback = flag +
  quitar estados (aditivos). Reglas Firestore revisadas para el estado nuevo.

## F. Análisis crítico obligatorio
1. **¿Simplificamos?** Un mecanismo único de "reloj legal" (prórroga ya extiende;
   subsanación suspende) concentrado en `tiempos-radicado`.
2. **¿Eliminamos?** El vacío normativo actual (hoy no se puede suspender el término).
3. **¿Consolidamos?** Requerimiento + suspensión + reactivación + desistimiento como un
   flujo coherente, reutilizando `completar-datos` y notificaciones.
4. **¿Reutilizamos?** Cron, notificación, cálculo de días, permisos, trazabilidad.
5. **¿Evitamos construir?** Un motor de plazos nuevo; archivar automáticamente (lo hace el
   funcionario); tocar la devolución interna.
6. **¿Alternativa más simple?** Evaluada: modelar la suspensión **solo** como flag en
   `termino` **sin** estado nuevo → menos ripple, pero "en subsanación" **no** sería
   visible como estado (peor para el ciudadano y el control). Se prefiere el estado nuevo
   por transparencia legal; el ripple se controla con `tsc` exhaustivo + OAT-05.
7. **¿En 5 años?** El "reloj legal" queda centralizado y auditable; añadir otro mecanismo
   (p. ej. otra causal de suspensión) es incremental. Envejece bien.

### 24. Veredicto
- [ ] **Bloqueado por validación normativa (R3):** el diseño está completo, pero antes de
  Definition of Ready se requiere el **visto bueno de gobierno-digital** sobre el cómputo
  exacto (suspensión, mes de subsanación, reactivación en días hábiles). No dispara
  re-revisión de diseño; es una **compuerta normativa**.

## G. Definition of Ready
- [x] Blueprint completo. [x] Valor Neto favorable (cumplimiento legal del núcleo,
  complejidad acotada por reutilización). [ ] **Cuatro Preguntas: P2 pendiente** de la
  validación normativa (que confirme que es la forma correcta). [ ] Validación
  gobierno-digital (bloqueante). → **Candidata tras validación normativa**, luego
  autorización expresa. No autoriza código.

## H. Hallazgos Arquitectónicos Transversales (OAT)
| OAT | Título | Prioridad | Momento |
|---|---|---|---|
| [OAT-05](../OAT_REGISTRO.md#oat-05) | Centralizar la definición de "estados activos" (≥3 copias del set en kpis-operativos y proxima-accion) | Media | Antes/junto a BM-B33 (reduce el ripple del estado nuevo) |
