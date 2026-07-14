# Blueprint Arquitectónico — BM-B33 · Subsanación y suspensión de términos (Ley 1755, Art. 17)

**Estado:** **v3 — en implementación autorizada (14 jul 2026).** Validado por
gobierno-digital (v2) y reforzado con QA + Seguridad (v3, abajo). OAT-05 ejecutada
(estados centralizados, commit `248027a`). **Capacidad del núcleo** (D3/Trámite).
**Ortogonal a H3.** **Rol:** Chief Software Architect (decisiones centralizadas).

> **Refuerzos v3 — decisiones de arquitectura (QA + Seguridad, escaladas al Arquitecto
> Principal):**
> 1. **Reloj server-side (Seg. Alto):** `fechaNotificacion` y `diasHabilesRestantes` se
>    calculan en el servidor (`new Date()` + `diasRestantesHabiles`), **nunca** desde el
>    body — evita retrodatar/inflar el término. El body solo trae `motivo`. (§10, §12)
> 2. **`sumarMesCalendario` con clamping C.C. art. 67 (QA Alto):** `Date.setMonth` NO
>    sirve (31 ene +1 mes daría 3 mar). Nueva función pura en `tiempos-radicado`: si el
>    día no existe en el mes destino, usa el último día de ese mes. Ancla a mediodía
>    local (patrón `atLocalNoon` ya existente). (§6.3, pruebas CP-2.x)
> 3. **Rol del desistimiento (Seg. Alto):** confirmar desistimiento = acto que extingue
>    el derecho de petición → exige **ADMIN o JEFE_DEPENDENCIA** del tenant (nuevo
>    `canConfirmarDesistimiento`), no un FUNCIONARIO cualquiera. Requerir subsanación =
>    `canOperateTenant` (como devolver). (§9)
> 4. **Cron solo propone (Seg. Alto):** nunca escribe `DESISTIDO`; filtra `isTest`;
>    autenticado con `autorizarCron`. (§10, prueba obligatoria)
> 5. **Reactivación desacoplada (Seg. Medio):** la "subsanación suficiente" la declara el
>    **funcionario del tenant** en una acción explícita (`reactivar`), separada de
>    `completar-datos` (que es de ADMIN/RECEPCIONISTA). Subsanación parcial NO reactiva. (§10)
> 6. **ANONIMA/RESERVADA (Seg. Medio):** RESERVADA se notifica a su correo (usar
>    `debeNotificarCiudadano`, no el gate estricto). **ANONIMA no tiene contacto** → no se
>    puede anclar la suspensión por correo → **fuera de alcance v3**: se marca para vía
>    manual/edicto y se documenta (no se deja el término corriendo en silencio: la UI
>    advierte). (§16)
> 7. **Prórroga fija +1 mes** calendario, **una sola vez**, solicitada antes de vencer;
>    rechazo extemporáneo. (§6.4)
> 8. **Controles temporales ejecutables (Seg. Medio):** `requerir-subsanacion` rechaza si
>    `suspension.activa`; no se encadenan requerimientos. (§6.6)
> 9. **0 días hábiles restantes (QA):** reactivación vence el **día hábil siguiente** al
>    aporte (mínimo 1). (§6.5)
> 10. **`EN_SUBSANACION` = reloj detenido** en semáforo y en el cron `alertas-vencimiento`
>    (no emite falsas alertas de vencimiento). (§17, no-regresión CPR-8.x)

> **Validación normativa (gobierno-digital):** concepto **"REQUIERE CORRECCIONES"** →
> incorporadas 7 correcciones (abajo). El diseño acertó en lo esencial (el requerimiento
> suspende el reloj; reactivación por días hábiles restantes sin reiniciar; desistimiento
> = acto motivado, decisión humana), pero omitía: **anclaje a la NOTIFICACIÓN** (no a la
> emisión), **prórroga del ciudadano** (hasta 1 mes más), **ventana de 10 días** para
> requerir, **notificación personal + recurso de reposición** del acto de desistimiento,
> **subsanación parcial**, **contenido mínimo del requerimiento**, y **reactivación desde
> el día siguiente** al aporte. Fundamento: Ley 1755/2015 Art. 17; CPACA (Ley 1437/2011)
> arts. 67-69; cómputo de "mes" por calendario (Ley 4/1913 / C.C. art. 67).

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
Se extiende `TerminoLegal` (`src/types/ventanilla.ts`) con un objeto de suspensión
**anclado a la notificación** (corrección normativa #1):
```
suspension?: {
  activa: boolean;
  fechaRequerimiento: string;          // ISO — emisión interna del requerimiento
  fechaNotificacion?: string;          // ISO — NOTIFICACIÓN al ciudadano = ancla legal
  fechaLimiteSubsanacion?: string;     // = fechaNotificacion + 1 mes CALENDARIO
  diasHabilesRestantes?: number;       // saldo del reloj capturado AL NOTIFICAR (no al emitir)
  motivo: string;                      // contenido mínimo: qué falta + plazo + prórroga + advertencia
  requeridoPor: { uid: string; nombre: string };
  prorroga?: {                         // Art.17: hasta 1 mes adicional, solicitada ANTES de vencer
    solicitada: boolean;
    fechaSolicitud: string;
    nuevaFechaLimite: string;          // fechaLimiteSubsanacion + hasta 1 mes
  };
}
```
Sin colección nueva (vive en el radicado). Invariantes: la **foto** del término original no
se pierde; **mientras `fechaNotificacion` sea nula, el término sigue corriendo** (no se
congela por la sola emisión — evita incumplimiento silencioso, riesgo señalado por
gobierno-digital). La suspensión es aditiva y auditable.

### 5. Eventos de negocio
`RequerimientoSubsanacionEmitido` (suspende) · `SubsanacionRecibida` (reactiva) ·
`DesistimientoTacitoPropuesto` (cron) · `DesistimientoTacitoConfirmado` (acto del
funcionario). Todos a trazabilidad (nuevas `AccionAuditoria`).

### 6. Reglas de negocio (Ley 1755 Art. 17 — validadas por gobierno-digital)
1. El requerimiento debe emitirse **dentro de los 10 días** siguientes a la radicación
   (no "dentro del término" a secas) — *corrección #4*.
2. La suspensión y el plazo de subsanación se **anclan a la NOTIFICACIÓN** del
   requerimiento al ciudadano, no a su emisión (debido proceso, CPACA 67-69) —
   *corrección #1*. Mientras no haya notificación, el término **sigue corriendo**.
3. Plazo del ciudadano para subsanar: **1 mes calendario** desde la notificación —
   *corrección #2*.
4. **Prórroga:** el ciudadano puede pedir, **antes de vencer**, una prórroga de **hasta
   un término igual** (otro mes); el cron **no** propone desistimiento si hay prórroga
   vigente — *corrección #2 (prórroga), omisión principal*.
5. Si subsana → el término se **reanuda** por los **días hábiles restantes**, contados
   **desde el día siguiente** al aporte (no se reinicia, no el mismo día) —
   *correcciones #3 y #7*.
6. **Subsanación parcial:** si el aporte no satisface lo requerido, **no** reactiva el
   término (decisión humana); prohibido encadenar requerimientos para dilatar —
   *corrección #5*.
7. **Contenido mínimo del requerimiento:** qué falta + plazo de 1 mes + derecho a
   prórroga + advertencia de desistimiento — *corrección #6*.
8. **Desistimiento tácito:** solo si no subsana en el plazo (con prórroga si la hubo);
   archivo por **acto administrativo motivado**, **notificado personalmente**, contra el
   que solo procede **recurso de reposición** — **decisión humana** (Principio 9), nunca
   automática — *correcciones #3 (notif.) y desistimiento*.
9. La suspensión **no** aplica a la devolución interna ni afecta a otras dependencias.
10. Aislamiento por `tenantId`.

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
- **10. APIs:** `POST /api/radicados/[id]/requerir-subsanacion` (emite el requerimiento con
  contenido mínimo); `POST /api/radicados/[id]/notificar-requerimiento` (registra la
  **notificación** → ancla la suspensión y **captura `diasHabilesRestantes` en ese momento**);
  `POST /api/radicados/[id]/prorroga-subsanacion` (antes de vencer, hasta 1 mes más);
  reactivación enganchada a `completar-datos` con validación de subsanación **suficiente**
  (parcial **no** reactiva); `POST /api/radicados/[id]/desistimiento` (confirma acto
  motivado + notificación personal, con recurso de reposición). Nuevo cron
  `app/api/cron/desistimiento-tacito` (patrón `alertas-vencimiento`; **no** propone si hay
  prórroga vigente).
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
- [x] **Validación normativa COMPLETADA** (gobierno-digital, 14 jul 2026): concepto
  "requiere correcciones" → las **7 correcciones incorporadas** (secciones 4 y 6). El
  cómputo queda anclado a la notificación, con prórroga, ventana de 10 días, subsanación
  parcial, contenido mínimo, reactivación día-siguiente y desistimiento notificado con
  recurso. Bucle de re-revisión **no** disparado (fue enriquecimiento legal, no defecto
  estructural). Compuerta normativa **cerrada**.

## G. Definition of Ready
- [x] Blueprint completo (**v2**, correcciones normativas incorporadas).
- [x] Valor Neto favorable (cumplimiento legal del núcleo, complejidad acotada por
  reutilización).
- [x] **Cuatro Preguntas:** P2 resuelta — validado que suspensión-anclada-a-notificación
  + prórroga + acto motivado es la forma correcta (Art. 17).
- [x] **Validación gobierno-digital** completada. → **CANDIDATA a implementación**,
  pendiente **autorización expresa** del propietario. Recomendado empezar por **OAT-05**
  (centralizar estados) para que `EN_SUBSANACION`/`DESISTIDO` entren limpios. No autoriza
  código.

## H. Hallazgos Arquitectónicos Transversales (OAT)
| OAT | Título | Prioridad | Momento |
|---|---|---|---|
| [OAT-05](../OAT_REGISTRO.md#oat-05) | Centralizar la definición de "estados activos" (≥3 copias del set en kpis-operativos y proxima-accion) | Media | Antes/junto a BM-B33 (reduce el ripple del estado nuevo) |
