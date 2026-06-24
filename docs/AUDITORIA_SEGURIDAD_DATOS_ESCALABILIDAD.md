# Auditoría Integral — Seguridad, Datos Personales, Continuidad y Escalabilidad

**Plataforma:** Ventanilla Única Digital — Alcaldía Municipal de Simacota
**Fecha de la auditoría:** 18 de junio de 2026
**Alcance:** Análisis y diagnóstico. **No se modificó código.**
**Tipo:** Revisión de código, configuración, reglas de seguridad y riesgos.

> Este documento es un diagnóstico técnico escrito para que también lo entienda
> una administración municipal. Las secciones ejecutivas (Parte 18, 19 y 20)
> resumen lo esencial sin lenguaje técnico.

---

## Cómo leer este informe

- **Severidad / Prioridad:**
  - **P0 — Crítico:** corregir antes del go-live (lanzamiento oficial).
  - **P1 — Alto:** corregir antes de la publicación masiva al ciudadano.
  - **P2 — Medio:** corregir en el primer mes de operación.
  - **P3 — Mejora futura:** deseable, no bloqueante.
- **Estado de cumplimiento:** Cumple · Cumple parcialmente · No cumple · No aplica.
- **Nota honesta:** el sistema tiene una base de seguridad **sólida** (reglas
  Firestore "negar por defecto", sesiones httpOnly, validación de roles en el
  servidor, sanitización de la respuesta pública). Los hallazgos de este informe
  son **puntos concretos a cerrar**, no una reescritura. La mayoría son de
  esfuerzo bajo o medio.

---

## Resumen de hallazgos (vista rápida)

| ID | Área | Riesgo | Prioridad |
|----|------|--------|-----------|
| H-01 | Control de acceso | Descarga de adjuntos sin validar dependencia ni rol (IDOR) | **P1** — ✅ **Corregido** (Sprint Seguridad P1-01) |
| H-02 | Control de acceso / Correo | Notificación al ciudadano sin validar rol ni dependencia; contenido y destinatario los pone el cliente | **P1** — 🟡 Implementado, pendiente UAT P1-02 |
| H-03 | Privacidad | Consulta pública enumerable (números secuenciales + verificación opcional) | **P1** — 🟡 Implementado, pendiente UAT P1-03 |
| H-04 | Abuso / Costos | `/api/ai/log` sin autenticación ni límite (escritura libre a Firestore) | **P2** |
| H-05 | Configuración | Cron "abierto" si falta `CRON_SECRET` (puede dispararse desde fuera) | **P2** |
| H-06 | Abuso | Límite de peticiones (rate limit) en memoria, no distribuido | **P2** |
| H-07 | Configuración web | Faltan cabeceras de seguridad (CSP, HSTS, etc.) | **P2** |
| H-08 | Adjuntos | Tipo de archivo validado por dato del navegador (falsificable); sin antivirus | **P2** |
| H-09 | Abuso | Radicación pública sin CAPTCHA/Turnstile | **P2** |
| H-10 | Reglas Firestore | Jefe de Dependencia puede leer hallazgos/planes de todas las dependencias | **P2** |
| H-11 | Datos personales | PII de radicados identificados se envía a Gemini (Google, tercero) | **P2** |
| H-12 | Escalabilidad | Control Interno carga hasta 2.000 radicados en memoria por consulta; trunca al crecer | **P2** |
| H-13 | Autenticación | Revocación de sesión no inmediata en varios endpoints (`checkRevoked=false`) | **P3** |
| H-14 | Ciclo de vida | Sin política de retención/archivo histórico ni filtro de fecha obligatorio en reportes | **P3** |
| H-15 | Autenticación | Sin segundo factor (MFA) para ADMIN y Control Interno | **P3** |
| H-16 | SIMI | Riesgo residual de "prompt injection" desde el texto del ciudadano | **P3** |

Controles positivos confirmados: sin secretos en Git, reglas Firestore y Storage
"negar por defecto", cookie de sesión httpOnly/secure, validación de rol en el
servidor, anonimato respetado en SIMI y en la consulta pública, `npm audit` en
**0 vulnerabilidades**.

---

# PARTE 1 — Mapa de datos personales

## Fase 1 — Datos personales tratados

| Dato | Dónde se captura | Dónde se guarda | Quién lo ve | Se exporta a Excel | Se envía por correo | Llega a SIMI | Sensible/Reservado | Riesgo de exposición |
|------|------------------|-----------------|-------------|:---:|:---:|:---:|:---:|---|
| Nombre completo | `/radicacion` | `ventanilla_radicados.solicitante` | Admin, Recepción, Control Interno, Funcionario/Jefe (su dependencia) | Sí (sanitizado por rol) | Sí (confirmación/respuesta) | Sí (si identificado) | No, salvo anónimo/reservado | Medio |
| Documento | (no se captura en portal web actual; queda vacío) | `solicitante.numeroDocumento` | Igual | Sí | No | Últimos 4 usados para verificación | Sí | Bajo (hoy vacío en canal WEB) |
| Correo electrónico | `/radicacion` | `solicitante.email` | Roles internos | Sí | Sí (destinatario) | Sí (si identificado) | Sí | **Medio-Alto** |
| Teléfono | `/radicacion` | `solicitante.telefono` | Roles internos | Sí | No (salvo WhatsApp futuro) | Parcial | Sí | Medio |
| Dirección | `/radicacion` | `solicitante.direccion` | Roles internos | Sí | No | Parcial | Sí | Medio |
| Municipio/Depto/País | Fijos (Simacota/Santander/Colombia) | `solicitante.ubicacion` | Roles internos | Sí | No | Sí | No | Bajo |
| Tipo de persona | Fijo (NATURAL en WEB) | `solicitante.tipoPersona` | Roles internos | Sí | No | Sí | No | Bajo |
| Solicitud (asunto/descripción) | `/radicacion` | `detalle` | Roles internos | Sí | Resumen en correo | Sí | Puede contener datos sensibles | **Medio-Alto** |
| Archivos adjuntos | `/radicacion` | Storage `radicados/{id}/` | Internos vía `/api/interno/archivo` | No (solo conteo) | No | Solo vía escáner IA que el ciudadano dispara | Sí | **Alto** (ver H-01, H-08) |
| Respuesta oficial | Panel interno | `respuestaOficial` + Storage `respuestas/{id}/` | Internos; **nota** visible al ciudadano | Sí | Sí | Sí | Acto administrativo público | Medio |
| Trazabilidad | Automática | subcolección `trazabilidad` | Internos (sanitizada al ciudadano) | Sí | No | Resumida | Contiene actorUid | Bajo-Medio |
| Usuarios internos | Admin / Firebase Auth | `users` + Firebase Auth | Solo Admin | Parcial | Reset password | No | Sí (laboral) | Medio |
| Roles / Dependencias | Admin | `users` + claims | Admin | Sí | No | No | No | Bajo |
| Logs de error | Automático | stderr + Sentry | Equipo técnico | No | No | No | Mensajes de error | Bajo (ver Parte 10) |
| Correos enviados | Automático | `trazabilidad` (estado envío) | Internos | Parcial | — | No | Destinatario | Bajo |
| Feedback SIMI | Panel interno | `ai_feedback` | Internos | Parcial | No | Sí | Bajo | Bajo |
| Auditoría Control Interno | Panel CI | `control_interno_*` | Admin, Control Interno (Jefe ve global, ver H-10) | Sí (informe) | No | No | Bajo | Medio |
| Consultas ciudadanas | `/consulta` | `consultas_ciudadanas_radicado` | Internos | No | No | No | IP con hash | Bajo |

**Observación clave:** el documento de identidad **no se captura** en el canal web
actual (`numeroDocumento` queda vacío). Esto reduce el riesgo de exposición, pero
también debilita la verificación de identidad en la consulta pública (ver H-03).

---

# PARTE 2 — Tratamiento de datos personales (Ley 1581/2012)

## Fase 2 — Cumplimiento mínimo

| Principio / Requisito | Estado | Evidencia / Comentario |
|-----------------------|--------|------------------------|
| Aviso de tratamiento en `/radicacion` | **Verificar** | Debe confirmarse que el formulario muestra el aviso y la finalidad antes de enviar. No se halló un componente de consentimiento explícito en la capa de API; revisar la UI de `/radicacion`. |
| Consentimiento / aceptación | **Cumple parcialmente** | El acto de radicar implica aceptación, pero conviene una casilla explícita de autorización de datos. |
| Finalidad | **Cumple** | Datos usados solo para gestionar la PQRSD y notificar. |
| Solicitudes anónimas | **Cumple** | `esAnonimo` elimina nombre/correo/teléfono/dirección al persistir (`/api/radicacion`). |
| Solicitudes reservadas | **Cumple** | `identidadReservada`/`RESERVADA` ocultan identidad en SIMI y consulta. |
| Habeas Data | **Cumple parcialmente** | Existe tipo de solicitud `HABEAS_DATA`, pero no hay un flujo automatizado de supresión/rectificación de datos del titular. |
| Consulta pública | **Cumple parcialmente** | Respuesta sanitizada (sin actorUid/rutas), pero enumerable (H-03). |
| Correos al ciudadano | **Cumple parcialmente** | H-02 implementado: `/api/interno/notificar-ciudadano` ya valida rol/dependencia y toma destinatario/contenido del radicado. Pendiente UAT. |
| Exportaciones Excel | **Cumple** | El generador MIPG sanitiza por rol (`radicadosVisiblesParaRol`, `solicitanteVisible`). |
| Usuarios internos | **Cumple** | Solo Admin administra; queda auditado en `admin_auditoria`. |
| Principio de seguridad | **Cumple parcialmente** | Buena base; H-01/H-02/H-03 implementados o corregidos; pendientes UAT H-02/H-03 y cabeceras (H-07). |
| Acceso restringido | **Cumple parcialmente** | Falla en descarga de adjuntos (H-01) y hallazgos para Jefe (H-10). |
| Circulación restringida | **Cumple parcialmente** | PII a Gemini (H-11) debe declararse y cubrirse con encargo. |
| Transparencia | **Cumple** | Trazabilidad completa y consulta de estado. |
| Confidencialidad | **Cumple parcialmente** | Ver H-01/H-02/H-03. |
| Responsabilidad demostrada | **Cumple** | Trazabilidad + auditorías `admin_auditoria`, `simi_auditoria`, `control_interno_eventos`. |

**Recomendación transversal:** publicar **Política de Tratamiento de Datos** y
declarar en el aviso que (a) se usan servicios en la nube (Firebase/Google,
Vercel) y (b) la IA de apoyo (SIMI) procesa el contenido de la solicitud.

---

# PARTE 3 — Privacidad por rol

## Fase 3 — Exposición de datos por rol

| Rol | Qué ve | Puede exportar | Acciones | No debería ver | ¿Cross-dependencia? | ¿Anónimos/Reservados? | ¿Adjuntos? |
|-----|--------|----------------|----------|----------------|---------------------|------------------------|------------|
| **ADMIN** | Todo | Sí (auditado) | Todo (administra) | — | Sí (por diseño) | Sí | Sí |
| **RECEPCIONISTA** | Todos los radicados | Sí | Radicar, clasificar, asignar | Gestión de usuarios | Sí (para clasificar) | Identidad oculta si aplica | Sí |
| **FUNCIONARIO** | Su dependencia | Su dependencia | Responder/devolver su tenant | Otras dependencias | **No (reglas OK)** — pero **sí** vía adjuntos (H-01) | Identidad oculta | Sí (su tenant; H-01 lo amplía indebidamente) |
| **JEFE_DEPENDENCIA** | Su dependencia (lectura) | Lectura | Aprobaciones | Otras dependencias | Radicados: No. **Hallazgos/Planes: Sí (H-10)** | Identidad oculta | Sí (su tenant; H-01) |
| **CONTROL_INTERNO** | Global (seguimiento) | Informes CI | Hallazgos, planes, alertas | No responde radicados | Sí (por diseño, solo lectura) | Ve datos para auditar | Sí (H-01: sin control fino) |
| **CIUDADANO_PÚBLICO** | Su radicado (estado + respuesta) | No | Radicar, consultar | Datos internos | No | Solo lo suyo | No (solo conteo) |
| **SIMI (asistente)** | Contexto del radicado | No | Solo sugiere | Identidad si anónimo/reservado | N/A | Identidad enmascarada | Lee texto, no rutas |

Validaciones solicitadas:

- ✅ **Control Interno ve global pero no responde** — correcto en reglas y APIs;
  la excepción de notificación al ciudadano (H-02) quedó implementada pendiente
  de UAT: `CONTROL_INTERNO` recibe 403.
- ✅ **Funcionario ve su dependencia** — reglas Firestore correctas para
  `ventanilla_radicados`; **excepción:** adjuntos (H-01).
- ✅ **Jefe ve su dependencia en lectura** — correcto para radicados;
  **excepción:** hallazgos/planes globales (H-10).
- ✅ **Recepción clasifica/asigna** — correcto.
- ✅ **Admin auditado** — correcto.
- ✅ **Ciudadano sin datos internos** — correcto (sanitización), pero enumerable (H-03).

---

# PARTE 4 — Auditoría de Firestore Security Rules

## Fase 4 — Matriz de reglas (`firestore.rules`)

| Colección | Lectura permitida | Escritura permitida | Riesgo | Recomendación |
|-----------|-------------------|---------------------|--------|---------------|
| `users` | Dueño o Admin (get); Admin/Recepción (list) | Solo Admin | Bajo | OK. Recepción lista usuarios para asignar responsable (necesario). |
| `radicados` (legacy) | Admin; Func/Recepción de su tenant | Cerrado (`false`) | Bajo | OK, legado en solo lectura. |
| `ventanilla_radicados` | Admin/Recepción/CI global; Func/Jefe su tenant | Crear: Admin/Recepción. Update/Delete: `false` (solo Admin SDK) | Bajo | Excelente: mutaciones críticas pasan por servidor. |
| `.../trazabilidad` | Internos (Func/Jefe su tenant) | Crear: Admin/Func/Recepción. Update/Delete: `false` | Bajo | OK (append-only). |
| `ai_logs` | Solo Admin | `false` (cliente) | Bajo en reglas | OK; **pero** se escribe vía API sin auth (H-04). |
| `ai_feedback` | Internos | `false` | Bajo | OK. |
| `ai_auditoria` | Internos | `false` | Bajo | OK. |
| `counters` | Admin/Recepción | Admin/Recepción | Bajo | OK (consecutivo transaccional). |
| `admin_auditoria` | Solo Admin | `false` | Bajo | OK (append-only por servidor). |
| `simi_auditoria` | Solo Admin | `false` | Bajo | OK. |
| `control_interno_hallazgos` | Admin, CI, **Jefe (global)** | `false` | **Medio (H-10)** | Restringir Jefe a su tenant o quitar acceso directo (usar solo API). |
| `control_interno_planes_mejora` | Admin, CI, Jefe; Func de su tenant | `false` | **Medio (H-10)** | Igual: el Jefe lee planes de todas las dependencias. |
| `control_interno_alertas` | Admin, CI | `false` | Bajo | OK. |
| `control_interno_eventos` | Admin, CI | `false` | Bajo | OK. |
| `{document=**}` (catch-all) | `false` | `false` | — | Excelente: negar por defecto. |

Validaciones solicitadas:

- ✅ Nadie anónimo lee colecciones privadas (todo exige `signedIn()` + perfil).
- ✅ Ciudadano no lee todos los radicados (la consulta pasa por API con cuenta de servicio).
- ✅ Funcionario solo su tenant (radicados); Jefe solo lectura.
- ✅ Control Interno global solo lectura.
- ✅ Escrituras sensibles cerradas al cliente (`update/delete: false`).
- ✅ **No existe** `allow read, write: if true`.
- ⚠️ **Regla demasiado amplia:** `control_interno_hallazgos` y
  `control_interno_planes_mejora` permiten a **cualquier** `JEFE_DEPENDENCIA`
  leer registros de **todas** las dependencias (H-10). La API sí filtra, pero un
  usuario con SDK podría leer directo.

---

# PARTE 5 — Auditoría de Firebase Storage

## Fase 5 — Adjuntos (`storage.rules`)

**Estado de las reglas:** muy buenas. Lectura directa **siempre negada**
(`allow read: if false`), descarga solo vía servidor con URL firmada temporal.

| Aspecto | Estado | Comentario |
|---------|--------|------------|
| Subida de archivos | Controlada | `radicados/`: solo PDF/imágenes, ≤10 MB (reglas) y ≤5 MB / máx 3 (API). `respuestas/`: solo PDF. |
| Lectura pública | **Negada** | `allow read: if false` en todas las rutas. |
| Descarga | Vía `/api/interno/archivo` (URL firmada 15 min) | **Pero sin control de tenant/rol (H-01).** |
| Validación de tipo | Por `contentType` | Falsificable: el navegador define `file.type`. Sin verificación de magic bytes ni antivirus (H-08). |
| Tamaño máximo | Sí | 5 MB (API) / 10 MB (reglas). Coherente. |
| Rutas privadas | Sí | `archivoPath` nunca se expone al ciudadano (sanitizado). |
| ZIP/ejecutables | Bloqueados | Solo PDF/JPG/PNG permitidos. |

**Riesgos:** (1) un internal user puede descargar adjuntos de otra dependencia o
de anónimos/reservados (H-01); (2) un archivo "PDF" podría ser realmente otro
contenido (H-08).

**Recomendaciones:** validar el radicado y su dependencia antes de firmar la URL;
verificar magic bytes del archivo; evaluar escaneo antivirus (p. ej. función que
revise el objeto al subirse); mantener separación por `radicados/{id}/`.

---

# PARTE 6 — APIs y rutas públicas

## Fase 6 — Matriz de endpoints

`/api/interno/*` está protegido por middleware (`proxy.ts`) con sesión válida +
revocación + usuario activo. El resto valida internamente. Rutas **públicas**:
radicación, consulta y endpoints de IA del formulario.

| Endpoint | Público/Privado | Auth | Rol | Datos devueltos | Riesgo | Recomendación |
|----------|-----------------|------|-----|-----------------|--------|---------------|
| `POST /api/radicacion` | Público | No | — | Acuse (radicadoId) | Rate-limit débil (H-06), sin CAPTCHA (H-09), tipo de archivo falsificable (H-08) | Turnstile + límite distribuido + validar magic bytes |
| `GET /api/consulta/[id]` | Público | No | — | Retirado (`410 Gone`) | Sin exposición directa (H-03 implementado) | Validar en UAT |
| `POST /api/public/radicado/consulta` | Público | No | — | Estado + respuesta sanitizada tras segundo factor | Verificación obligatoria + rate-limit Firestore (H-03 implementado) | Validar en UAT |
| `POST /api/ai/classify` | Público | No | — | Clasificación | Costo Gemini; rate-limit en memoria (H-06) | Límite distribuido / Turnstile |
| `POST /api/ai/chat` | Público | No | — | Texto | Igual | Igual |
| `POST /api/ai/scan-doc` | Público | No | — | Extracción de documento | Costo + procesa archivo del usuario | Límite + tamaño |
| `POST /api/ai/feedback` | Público | No | — | OK | Bajo | Mantener límite |
| `POST /api/ai/log` | Público | **No** | — | logId | **Escritura libre a Firestore (H-04)** | Exigir auth o mover a interno + límite |
| `POST /api/ai/copilot` | Privado | Sesión | Internos | Sugerencia | Bajo | OK (auth + límite por uid) |
| `POST /api/auth/session` | Público (login) | idToken | Internos | Cookie sesión | Bajo | OK |
| `POST /api/auth/logout` | Privado | Sesión | — | OK | Bajo | OK |
| `GET /api/interno/archivo` | Privado | Sesión activa | Rol/dependencia | URL firmada del adjunto | H-01 corregido | Mantener pruebas de tenant/rol |
| `POST /api/interno/notificar-ciudadano` | Privado | Sesión activa | ADMIN/RECEPCIONISTA/FUNCIONARIO propio tenant | Envía correo con datos del radicado | H-02 implementado, pendiente UAT | Validar UAT; no aceptar destinatario/contenido del cliente |
| `POST /api/radicados/[id]/asignar` | Privado | `requireActiveInternalUser` | Admin/Recepción/Func | OK | Bajo | OK |
| `POST /api/radicados/[id]/resolver` | Privado | + `canOperateTenant` | Func/Admin | OK | Bajo | OK |
| `POST /api/radicados/[id]/devolver`/`prorroga`/`reclasificar`/`notificacion-gestionada` | Privado | + tenant | Según acción | OK | Bajo | OK |
| `GET /api/radicados/busqueda-avanzada` | Privado | `requireActiveInternalUser` | Internos | Radicados | Bajo-Medio (volumen) | Paginación/fecha (Parte 13) |
| `GET /api/reportes/mipg/excel` | Privado | `requireActiveInternalUser` | Internos | Excel sanitizado | Bajo | OK |
| `GET/POST/PATCH /api/admin/usuarios*` | Privado | Sesión + **rol ADMIN** | Admin | Usuarios | Bajo | OK |
| `/api/interno/control/*` | Privado | `autorizarAuditor`/`OJefe` | CI/Admin (+Jefe) | KPIs/alertas/etc. | Bajo-Medio (volumen H-12) | OK en permisos |
| `GET /api/cron/alertas-vencimiento` | Cron | `CRON_SECRET` **si existe** | — | Dispara correos | **Fail-open (H-05)** | Exigir secreto siempre |
| `GET /api/cron/simi/alertas-vencimiento` | Cron | `CRON_SECRET` **si existe** | — | Alertas | **Fail-open (H-05)** | Igual |

Riesgos buscados: endpoints sin auth que devuelvan PII → **no** (los públicos
están sanitizados); mutaciones sin rol → H-02 implementado pendiente UAT;
exportaciones sin permiso → **no**; errores que revelen datos internos →
mensajes genéricos al usuario (bien); logs con PII → ver Parte 10.

---

# PARTE 7 — SIMI y datos sensibles

## Fase 7 — Auditoría de SIMI

**Qué recibe SIMI:** el texto del radicado (asunto/descripción), tipo, estado,
dependencia, y —para radicados **identificados**— nombre y correo del solicitante
(`lib/simi/contexto-radicado.ts`). El procesamiento ocurre en **Google Gemini**
(`gemini-2.0-flash-001`), un tercero en el exterior.

| Aspecto | Estado | Comentario |
|---------|--------|------------|
| ¿Recibe documentos? | Parcial | Solo vía `scan-doc` que el ciudadano dispara sobre su propio archivo; el flujo jurídico usa texto, no los binarios. |
| ¿Recibe datos personales? | **Sí (identificados)** | Nombre y correo entran al prompt (H-11). |
| Anónimos/Reservados | **Cumple** | `debeOcultarIdentidad()` enmascara identidad; el prompt instruye "no menciones identidad, no inventes datos". |
| ¿Puede inventar identidad? | Mitigado | Instrucción explícita "no inventes datos personales". |
| Respuestas auditadas | **Cumple** | `simi_auditoria` (lectura solo Admin). |
| Limitado por rol | **Cumple** | Acciones SIMI internas requieren sesión; copilot valida cookie. |
| ¿Filtra datos internos? | Mitigado | Prompt prohíbe revelar UID, rutas de Storage, tokens. |
| Prompt injection | **Riesgo residual (H-16)** | El `descripcion` del ciudadano se incluye en el prompt; un texto malicioso podría intentar manipular. Las guardas del system prompt ayudan pero no son infalibles. |
| Instrucción de no revelar sensibles | **Cumple** | `prompt-institucional.ts` líneas de no-divulgación. |

**Controles existentes:** enmascaramiento de identidad, system prompt con reglas
de no-divulgación, `safetySettings` de Gemini, auditoría de uso, "SIMI sugiere,
la persona decide".

**Controles faltantes / recomendaciones:**
- Declarar en el aviso de datos que el contenido se procesa con IA de un tercero.
- Considerar **minimizar PII** antes de enviar (p. ej. omitir correo si no es
  necesario para la sugerencia).
- Reforzar contra inyección: delimitar claramente el texto del ciudadano como
  "contenido no confiable" en el prompt y reiterar que no son instrucciones.
- Verificar encargo de tratamiento (DPA) con Google.

---

# PARTE 8 — Correos y notificaciones

## Fase 8 — Auditoría de correo (`lib/email/*`)

| Aspecto | Estado | Comentario |
|---------|--------|------------|
| `EMAIL_PASS` solo en Vercel | **Cumple** | `.env*` está en `.gitignore` (solo `.env.example`). No hay secretos en Git. |
| Secretos en Git | **Cumple** | Verificado: solo placeholders en `*.md`/`.env.example`. |
| Exposición de datos en el correo | Cumple parcialmente | Confirmación incluye datos del propio titular (correcto). Revisar que respuestas no incluyan PII de terceros. |
| Envío a correos inválidos | **Cumple** | `debeNotificarCiudadano()` valida formato y descarta placeholders. |
| Anónimos/Reservados | **Cumple** | No se envía correo a anónimos. |
| Trazabilidad de envío/fallo | **Cumple** | `registrarTrazabilidadNotificacion` (ENVIADA/FALLIDA) + flag `alertaNotificacionFallida`. |
| Falla si SMTP cae | **Cumple (degradado)** | El radicado se persiste aunque el correo falle; se marca alerta. |
| SPF/DKIM/DMARC | **No verificable en código** | Es configuración DNS del dominio `simacota-santander.gov.co`. Pendiente confirmar. |
| Relay/abuso | **Mitigado; pendiente UAT (H-02)** | `/api/interno/notificar-ciudadano` ya bloquea campos libres del cliente, valida rol/tenant y toma destinatario/contenido del radicado. |

**Recomendaciones:** configurar **SPF, DKIM y DMARC** en el DNS institucional;
aprobar UAT de H-02; evaluar límite de correos por usuario/hora; tablero de
rebotes y fallos.

---

# PARTE 9 — Autenticación y usuarios internos

## Fase 9 — Auditoría de usuarios y roles

| Aspecto | Estado | Comentario |
|---------|--------|------------|
| Creación de usuarios | **Cumple** | Solo Admin; valida rol y tenant; auditado. |
| Desactivación / archivado | **Cumple** | `activo=false`/`archivado=true` bloquean acceso (middleware + `requireActiveInternalUser`). |
| Reset de contraseña | Cumple | Vía flujo Admin/Firebase. |
| Cookie de sesión | **Cumple** | `httpOnly`, `secure` en producción, `sameSite=lax`, 5 días, Firebase session cookie. |
| Claims de rol/tenant | **Cumple** | Sincronizados en `/api/auth/session`; el dashboard depende de claims. |
| Revocación de sesión | **Parcial (H-13)** | Middleware usa `checkRevoked=true`; varios endpoints usan `checkRevoked=false` (revocación efectiva hasta expirar, 5 días). |
| MFA | **No (H-15)** | Sin segundo factor para roles críticos. |
| Cuentas compartidas | Riesgo de política | No prevenible solo por código; depende de gobernanza. |
| Contraseñas temporales | Depende de proceso | Recomendable forzar cambio al primer ingreso. |

**Recomendaciones:** activar **MFA** para ADMIN y CONTROL_INTERNO; política de
contraseñas; baja inmediata al desvincular un funcionario; revisión trimestral de
usuarios activos; unificar en `checkRevoked=true` (o sesiones más cortas) donde el
riesgo lo amerite.

---

# PARTE 10 — Logs, errores y Sentry

## Fase 10 — Auditoría de observabilidad

| Aspecto | Estado | Comentario |
|---------|--------|------------|
| Logger estructurado | **Cumple** | `lib/logger.ts` solo registra `radicadoId`, `modulo`, `mensaje`. No vuelca PII directamente. |
| PII en logs | **Cumple parcialmente** | Riesgo indirecto: un `error.message` (p. ej. error SMTP) podría contener un correo. |
| Sentry — PII por defecto | **Cumple** | `sendDefaultPii` no se activa → no adjunta IP/headers/cuerpos por defecto. |
| Sentry — session replay | **Revisar** | `replaysOnErrorSampleRate: 0.5`; confirmar enmascaramiento (por defecto Sentry enmascara texto/inputs). Sin `replayIntegration` explícita podría no estar activo. |
| Errores al usuario | **Cumple** | Mensajes genéricos ("No fue posible…"); detalles solo en logs. |
| Stack al usuario | **Cumple** | No se exponen stacks al cliente. |

**Recomendaciones:** añadir `beforeSend` que depure correos/documentos de
`mensaje` y breadcrumbs; confirmar masking del replay; mantener tags sin PII
(hoy `radicadoId` como tag es aceptable).

---

# PARTE 11 — Evaluación OWASP Top 10 (2021)

| Riesgo OWASP | Estado | Evidencia | Recomendación | Prioridad |
|--------------|--------|-----------|---------------|-----------|
| A01 Broken Access Control | **Atención** | H-01 (adjuntos), H-02 (notificar), H-10 (hallazgos Jefe) | Validar tenant/rol en cada recurso | **P1** |
| A02 Cryptographic Failures | OK | HTTPS (Vercel), cookie secure/httpOnly, sin secretos en Git | Mantener; HSTS (H-07) | P2 |
| A03 Injection | OK / Atención | Sin SQL; Firestore tipado; **prompt injection** en SIMI (H-16) | Delimitar texto no confiable | P3 |
| A04 Insecure Design | Atención | Enumeración por IDs secuenciales (H-03); rate-limit débil (H-06) | Verificación obligatoria; límite distribuido | P1/P2 |
| A05 Security Misconfiguration | **Atención** | Sin cabeceras (H-07); cron fail-open (H-05) | CSP/HSTS; secreto cron obligatorio | P2 |
| A06 Vulnerable Components | **OK** | `npm audit --omit=dev` = 0 vulnerabilidades | Monitoreo continuo | P3 |
| A07 Auth Failures | OK / Atención | Buenas sesiones; sin MFA (H-15); `checkRevoked=false` (H-13) | MFA roles críticos | P2/P3 |
| A08 Data Integrity Failures | OK | Mutaciones por servidor; auditorías append-only | Mantener | P3 |
| A09 Logging/Monitoring Failures | OK | Trazabilidad + Sentry; depurar PII (Parte 10) | `beforeSend` scrubbing | P2 |
| A10 SSRF | OK | No hay fetch de URLs provistas por el usuario | Mantener | P3 |

---

# PARTE 12 — Rate limiting y abuso

## Fase 12 — Riesgo de abuso

| Vector | Estado actual | Riesgo | Recomendación |
|--------|---------------|--------|---------------|
| Radicación masiva | Límite 8/min/IP en memoria | Medio-Alto (H-06, H-09) | Turnstile/CAPTCHA + límite distribuido |
| Consulta masiva | `/consulta` sin límite; `/public/...` 10/min memoria | Medio (H-03) | Límite distribuido + verificación obligatoria |
| Fuerza bruta al login | Firebase Auth (límites propios) | Bajo-Medio | MFA + monitoreo de intentos |
| Spam a SIMI / IA | Límite por IP/uid en memoria | Medio (costo Gemini) | Límite distribuido + presupuesto |
| Abuso de subida de archivos | 3 × 5 MB validado | Medio (H-08) | Magic bytes + antivirus |
| Abuso de correos | H-02 implementado pendiente UAT; cron fail-open (H-05) | **Alto** | Aprobar UAT H-02; cerrar H-05 + evaluar límite de correos |
| `/api/ai/log` abierto | Sin auth (H-04) | Medio (costo/almacenamiento) | Auth + límite |
| Exportaciones pesadas | Carga grande (H-12) | Medio | Fecha obligatoria + paginación |

**Nota técnica sobre el límite actual:** `lib/ai/rate-limit.ts` usa un `Map` en
memoria. En Vercel (serverless) cada instancia tiene su propio contador y se
**reinicia en cada arranque en frío**; por tanto el límite es "mejor esfuerzo" y
**evadible** distribuyendo peticiones. Para protección real se necesita un
almacén compartido (Vercel KV / Upstash Redis / contador en Firestore) o una capa
WAF/Turnstile delante.

---

# PARTE 13 — Rendimiento actual

## Fase 13 — Auditoría de performance

| Área | Riesgo de lentitud | Causa | Recomendación |
|------|--------------------|-------|---------------|
| Panorama / Alertas / Resumen CI | **Alto al crecer** | `listarRadicadosParaControl` lee `.limit(2000)` de **todos** los radicados por request; Alertas sin filtro de fecha (H-12) | Agregaciones incrementales / contadores; obligar rango de fecha; paginar |
| Reporte CI / MIPG | Medio-Alto | Carga radicados + trazabilidad para el Excel | Limitar por rango; generación por lotes |
| Búsqueda histórica | Medio | Lecturas amplias al crecer | Índices + paginación por cursor |
| Subcolección trazabilidad | Bajo-Medio | Lectura por radicado (consulta pública limita a 25) | OK; mantener `limit` |
| Dashboard interno | Medio | Suscripción/lectura de radicados activos | Filtrar por estado/tenant; paginar |
| `Promise.all` de adjuntos | Bajo | Máx 3 archivos | OK |
| Timeout de Vercel | Riesgo al crecer | Funciones que leen miles de docs (H-12) | Mover agregaciones a precálculo/cron |
| Índices | OK base | `firestore.indexes.json` cubre fecha, tenant, estado, tipo, cumplimiento | Añadir índices por año/mes al crecer |

---

# PARTE 14 — Capacidad futura (Firebase / Vercel) a 1 año

## Fase 14 — Escenarios (categorías, no precios)

Supuestos: ~3 eventos de trazabilidad por radicado, ~1.5 adjuntos (~1.5 MB c/u),
lecturas de dashboard/reportes varias veces al día por usuario interno.

| Escenario | Radicados/mes | Docs Firestore/año (aprox.) | Trazabilidad/año | Storage/año | Lecturas dashboard | Costo relativo | Riesgo de lentitud |
|-----------|---------------|------------------------------|------------------|-------------|--------------------|----------------|--------------------|
| Pequeño | 100 | ~1.200 + 3.600 | ~3.600 | ~2–3 GB | Bajo | **Bajo** | Bajo |
| Medio | 500 | ~6.000 + 18.000 | ~18.000 | ~10–15 GB | Medio | **Bajo-Medio** | Bajo-Medio |
| Alto | 2.000 | ~24.000 + 72.000 | ~72.000 | ~40–55 GB | Alto | **Medio** | **Medio (H-12 activo)** |
| Crítico | 10.000 | ~120.000 + 360.000 | ~360.000 | ~200+ GB | Muy alto | **Alto / monitorear** | **Alto** |

**Conclusión:** Firebase y Vercel **soportan técnicamente** los cuatro
escenarios. El cuello de botella **no es la base**, sino el patrón de
"cargar muchos documentos en memoria por request" (H-12): a partir del escenario
**Alto** empieza a truncar (límite 2.000) y a encarecer lecturas. Antes de
escenarios Alto/Crítico hay que pasar a **agregaciones precalculadas** y
**filtros de fecha obligatorios**.

---

# PARTE 15 — Retención y archivo histórico

## Fase 15 — Ciclo de vida de datos

Situación actual: los radicados se acumulan **indefinidamente** en una sola
colección; los reportes pueden pedir todo sin rango obligatorio.

**Recomendaciones:**
- Definir **política de retención documental** acorde a tablas de retención (TRD)
  de la entidad.
- Estado **"archivado"** para radicados cerrados con cierto tiempo; excluirlos de
  las vistas operativas por defecto.
- **Filtro de fecha obligatorio** en reportes y exportaciones grandes.
- Exportaciones **por rango** (mes/trimestre/año).
- Índices por **año/mes/dependencia** para histórico.
- Evaluar **anonimización** de radicados muy antiguos cuando ya no se requiera la
  identidad (minimización de datos).
- Separar conceptualmente **datos activos** (operación diaria) de **históricos**
  (consulta esporádica).

---

# PARTE 16 — Continuidad y recuperación

## Fase 16 — Plan de continuidad

| Escenario | Impacto hoy | Recomendación |
|-----------|-------------|---------------|
| Firebase cae | Sistema no opera | Plan de comunicación; backups; SLA de Google |
| Vercel cae | Portal no disponible | Página de estado; canal alterno de radicación (físico) |
| SMTP cae | No salen correos | **Ya degradado correctamente**: el radicado se guarda y se marca alerta de notificación fallida |
| Gemini/SIMI cae | Sin sugerencias IA | **Ya degradado**: modo fallback/mock (`GEMINI_API_KEY` ausente → contingencia local) |
| Storage cae | Sin adjuntos | Reintentos; mensajes claros |
| Se borra un usuario | Pierde acceso | `delete: false` en reglas; baja por `activo=false` (no borrado físico) |
| Se borra un radicado por error | Pérdida de evidencia | `delete: false` en reglas (no se puede borrar desde cliente) + **backups** |

**Recomendaciones clave:**
- **Backups programados** de Firestore (exportación a Cloud Storage) — hoy es la
  brecha más importante de continuidad.
- Exportaciones periódicas (Excel/JSON) como respaldo administrativo.
- **Runbook de incidentes** (ya existe `docs/RUNBOOK_INCIDENTES_SMTP.md`;
  ampliar a Firebase/Vercel/Gemini).
- Roles de emergencia y procedimiento de restauración documentado.

---

# PARTE 17 — Costos y límites

## Fase 17 — Riesgo de costos

| Recurso | Nivel | Comentario |
|---------|-------|------------|
| Lecturas Firestore | **Requiere monitoreo** | H-12 multiplica lecturas en CI/reportes |
| Escrituras Firestore | Bajo-Medio | ~4 docs por radicado; `/api/ai/log` abierto puede inflar (H-04) |
| Storage | Medio | Crece con adjuntos; aplicar retención (Parte 15) |
| Salida de datos | Bajo-Medio | Descargas de adjuntos/Excel |
| Funciones Vercel | Medio | Tiempo de cómputo en agregaciones grandes (H-12) |
| Correos | Bajo-Medio | Vigilar abuso (H-02/H-05) |
| SIMI / Gemini | **Requiere monitoreo** | Endpoints IA públicos + límite débil (H-06) |
| Exportaciones | Medio | Pesadas sin rango (Parte 15) |

**Recomendación:** activar **alertas de presupuesto** en Google Cloud y Vercel;
revisar consumo mensual de Firestore y Gemini.

---

# PARTE 18 — Matriz final de riesgos

| ID | Área | Riesgo | Impacto | Probabilidad | Nivel | Evidencia | Recomendación | Prioridad | Esfuerzo | Estado |
|----|------|--------|---------|--------------|-------|-----------|---------------|-----------|----------|--------|
| H-01 | Acceso | Descarga de adjuntos sin validar tenant/rol | Alto | Media | **Alto** | `app/api/interno/archivo/route.ts` | Verificar radicado→tenant→rol antes de firmar URL | **P1** | Bajo | ✅ **Corregido (Sprint Seguridad P1-01)** |
| H-02 | Acceso/Correo | Notificar al ciudadano sin rol/tenant; datos del cliente | Alto | Media | **Alto** | `app/api/interno/notificar-ciudadano/route.ts` | Tomar datos del radicado; validar rol/tenant | **P1** | Bajo | Implementado; pendiente UAT |
| H-03 | Privacidad | Consulta pública enumerable | Medio-Alto | Alta | **Alto** | `app/api/consulta/[id]`, `public/radicado/consulta` | Verificación obligatoria + rate-limit | **P1** | Medio | Implementado; pendiente UAT |
| H-04 | Abuso | `/api/ai/log` sin auth | Medio | Media | Medio | `app/api/ai/log/route.ts` | Auth + límite | **P2** | Bajo | Abierto |
| H-05 | Config | Cron fail-open sin `CRON_SECRET` | Medio | Media | Medio | `cron/*/route.ts` | Exigir secreto siempre | **P2** | Bajo | Abierto |
| H-06 | Abuso | Rate limit en memoria | Medio | Alta | Medio | `lib/ai/rate-limit.ts` | Almacén distribuido / WAF | **P2** | Medio | Abierto |
| H-07 | Config | Faltan cabeceras de seguridad | Medio | Media | Medio | `next.config.ts` | CSP/HSTS/X-Frame/etc. | **P2** | Bajo | Abierto |
| H-08 | Adjuntos | Tipo validado por cliente; sin AV | Medio | Media | Medio | `api/radicacion`, `storage.rules` | Magic bytes + antivirus | **P2** | Medio | Abierto |
| H-09 | Abuso | Radicación sin CAPTCHA | Medio | Media | Medio | `api/radicacion` | Turnstile | **P2** | Bajo | Abierto |
| H-10 | Reglas | Jefe lee hallazgos/planes globales | Medio | Baja | Medio | `firestore.rules` | Filtrar por tenant | **P2** | Bajo | Abierto |
| H-11 | Datos | PII a Gemini (identificados) | Medio | Alta | Medio | `lib/simi/contexto-radicado.ts` | Declarar + minimizar + DPA | **P2** | Medio | Abierto |
| H-12 | Escala | Carga de 2.000 docs en memoria | Medio | Media | Medio | `lib/control-interno/server/datos.ts` | Agregación precalculada + fecha | **P2** | Medio | Abierto |
| H-13 | Auth | Revocación no inmediata | Bajo-Medio | Baja | Bajo | varios endpoints (`checkRevoked=false`) | Unificar revocación / sesión corta | **P3** | Bajo | Abierto |
| H-14 | Ciclo de vida | Sin retención/archivo | Medio | Alta (con tiempo) | Medio | (ausencia) | Política de retención | **P3** | Medio | Abierto |
| H-15 | Auth | Sin MFA roles críticos | Medio | Baja | Bajo-Medio | (ausencia) | MFA Admin/CI | **P3** | Medio | Abierto |
| H-16 | SIMI | Prompt injection residual | Bajo-Medio | Baja | Bajo | `lib/simi/*` | Delimitar texto no confiable | **P3** | Bajo | Abierto |

---

# PARTE 19 — Plan de acción recomendado

### Acciones inmediatas (esta semana)
- **H-01** Validar dependencia/rol antes de entregar adjuntos. ✅ Corregido.
- **H-02** Asegurar que `notificar-ciudadano` use datos del radicado y valide rol/tenant. 🟡 Implementado, pendiente UAT.
- **H-05** Hacer obligatorio `CRON_SECRET` (fail-closed).
- **H-04** Cerrar o autenticar `/api/ai/log`.

### Antes del go-live oficial
- **H-03** Verificación obligatoria + rate-limit en la consulta pública.
- **H-07** Cabeceras de seguridad (CSP, HSTS, X-Content-Type-Options, etc.).
- **H-10** Restringir hallazgos/planes del Jefe a su dependencia.
- Confirmar **SPF/DKIM/DMARC** del dominio institucional.
- Publicar **Política de Tratamiento de Datos** y declarar uso de IA/nube.

### Durante el primer mes
- **H-06** Rate limit distribuido + **H-09** Turnstile en radicación.
- **H-08** Validar magic bytes; evaluar antivirus.
- **H-11** Minimizar PII a SIMI + DPA con Google.
- **Backups** programados de Firestore (continuidad).
- Alertas de presupuesto (Google Cloud / Vercel).

### A 3 meses
- **H-12** Agregaciones precalculadas para Control Interno/reportes.
- **H-15** MFA para Admin y Control Interno.
- **H-13** Unificar revocación de sesión / sesiones más cortas.
- Tablero de rebotes y fallos de correo.

### A 1 año
- **H-14** Política de retención y archivo histórico; anonimización de antiguos.
- Separar datos activos/históricos; índices por año/mes.
- Revisión anual de seguridad y de usuarios activos.

---

# PARTE 20 — Veredicto ejecutivo

**¿El sistema está listo para pruebas internas?**
**Sí.** La base de control de acceso, sesiones y reglas es sólida. Las pruebas
internas (UAT) pueden realizarse de inmediato con usuarios reales de la Alcaldía.

**¿Está listo para publicación ciudadana masiva?**
**Todavía no, sin aprobar UAT de los P1 y cerrar los P2 recomendados de borde.**
El sistema funciona y los tres P1 ya tienen corrección/implementación, pero no
deben marcarse como cierre definitivo hasta validar UAT.

**Bloqueantes reales (cerrar antes del lanzamiento masivo):**
1. **H-01** — corregido: descarga de adjuntos con validación de rol/dependencia.
2. **H-02** — implementado, pendiente UAT: notificación ciudadana con rol,
   dependencia y datos tomados del radicado.
3. **H-03** — implementado, pendiente UAT: consulta pública con segundo factor,
   rate limit y respuestas anti-enumeración.

Recomendado también antes del lanzamiento: **H-05** (cron), **H-04** (ai/log),
**H-07** (cabeceras) y confirmar **SPF/DKIM/DMARC**.

**Riesgos aceptables (vigilar, no bloquean):**
- Rate limit en memoria (H-06) — aceptable para volúmenes bajos; reforzar pronto.
- PII a Gemini en identificados (H-11) — aceptable si se declara y se firma DPA.
- Ausencia de MFA (H-15) — aceptable temporalmente con contraseñas fuertes.

**Mejoras futuras:** agregaciones de Control Interno (H-12), retención/archivo
(H-14), MFA (H-15), endurecimiento anti-inyección de SIMI (H-16).

**Qué debe vigilar la Alcaldía mensualmente:**
- Consumo de **Firestore** (lecturas) y **Gemini** (costo IA).
- **Correos** enviados/fallidos y posibles abusos.
- **Usuarios activos** (dar de baja a quien se desvincule).
- **Almacenamiento** (adjuntos) y crecimiento de radicados.
- **Alertas de Sentry** y errores recurrentes.
- Verificar que los **backups** se ejecutan.

---

## Anexo — Validaciones de lectura ejecutadas

| Comando | Resultado |
|---------|-----------|
| `git status` | Limpio (no se modificó código) |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `npm audit --audit-level=high` | 0 vulnerabilidades |
| `npx tsc --noEmit` | Sin errores |
| `npm run lint` | Sin errores ni advertencias |
| `npm run test` | 195/195 pruebas (16 archivos) |
| `npm run build` | Compilación exitosa |

**Confidencialidad:** durante la auditoría no se leyeron, copiaron ni
incluyeron secretos reales. Las variables sensibles solo aparecen como
*placeholders* en `.env.example` y documentación; los archivos `.env*` están
correctamente excluidos de Git.

---

*Documento generado como parte del Sprint de Auditoría Integral. No modifica
código, configuración ni datos. Es un insumo de diagnóstico y planeación.*
