# UAT Seguridad H-04 · H-05 · H-07 — Hardening de producción

Matriz conjunta para el sprint de hardening (PR #19 `feat/seguridad-hardening-produccion`).
Cada sección puede aprobarse de forma independiente, pero las **tres** deben quedar
en ✅ antes de marcar el bloque como cerrado en `docs/SEGURIDAD_HOTFIXES.md`.

**Estado:** Pendiente de ejecución y aprobación funcional.
**Entorno autorizado:** Preview de Vercel. **No ejecutar en producción.**
**Referencia técnica:**
- H-04: `app/api/ai/log/route.ts`, `lib/seguridad/ai-log-seguro.ts`
- H-05: `lib/seguridad/autorizar-cron.ts`, `app/api/cron/alertas-vencimiento/route.ts`, `app/api/cron/simi/alertas-vencimiento/route.ts`
- H-07: `next.config.ts`
- Pruebas existentes: `__tests__/hardening-produccion.test.ts`

---

## 0. Precondiciones comunes

| # | Precondición | Estado | Verificado por |
|---|---|:-:|---|
| P-1 | PR #19 desplegado en Preview. | ☐ | |
| P-2 | Variables sensibles configuradas en Vercel Preview: `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `EMAIL_*`. | ☐ | |
| P-3 | `CRON_SECRET` marcado **Sensitive** en Vercel. | ☐ | |
| P-4 | SMTP sandbox (Mailpit / Mailtrap) — H05-05 puede disparar correos reales si no está. | ☐ | |
| P-5 | Acceso de lectura a la consola Firestore del proyecto Preview. | ☐ | |
| P-6 | Acceso al panel Vercel Preview (logs y env vars). | ☐ | |

---

## 1. Sección H-04 — `/api/ai/log` con auth, rate-limit y campos cerrados

### 1.1 Usuarios requeridos

| Rol | Email | Uso |
|---|---|---|
| `ADMIN` | `admin.uat@simacota.gov.co` | H04-04, H04-06..H04-12 |
| `RECEPCIONISTA` | `recepcion.uat@simacota.gov.co` | H04-02 |
| `FUNCIONARIO` (cualquier tenant) | `funcionario.gobierno.uat@simacota.gov.co` | H04-03 |
| `CONTROL_INTERNO` | `controlinterno.uat@simacota.gov.co` | H04-05 |

### 1.2 Matriz H-04

| Caso | Rol / Sesión | Acción | Resultado esperado | Resultado obtenido | Evidencia | Estado |
|---|---|---|---|---|---|:-:|
| H04-01 | Sin sesión | `POST /api/ai/log` con `{endpoint:"chat",latenciaMs:100}`. | `401 {"error":"Debe iniciar sesión nuevamente."}`. Auditoría `seguridad_ai_log_auditoria` tipo `AI_LOG_DENEGADO` motivo `SESION_REQUERIDA`. `Cache-Control: no-store`. | | | ⬜ |
| H04-02 | RECEPCIONISTA | Igual cuerpo. | `403 {"error":"No tiene permiso para realizar esta acción."}`. Auditoría motivo `ROL_NO_AUTORIZADO`. | | | ⬜ |
| H04-03 | FUNCIONARIO | Igual cuerpo. | `403`. Auditoría motivo `ROL_NO_AUTORIZADO`. | | | ⬜ |
| H04-04 | ADMIN | POST con `{radicadoId:"1-WEB-2026-00000001",endpoint:"chat",latenciaMs:120,promptVersion:"v1.0"}`. | `200 {"exito":true,"logId":"<id>"}`. En Firestore `ai_logs/<id>` queda: `endpoint`, `latenciaMs:120`, `errorPresente:false`, `errorCategoria:null`, `fallbackActivo:false`, `promptVersion:"v1.0"`, `actorUid`, `actorRol:"ADMIN"`, `timestamp`. | | | ⬜ |
| H04-05 | CONTROL_INTERNO | Igual a H04-04 con su sesión. | `200`. `actorRol:"CONTROL_INTERNO"`. | | | ⬜ |
| H04-06 | ADMIN | POST con body de 5000 bytes (relleno con `promptVersion` largo). | `400 {"error":"Payload inválido."}`. Auditoría motivo `PAYLOAD_DEMASIADO_GRANDE`. | | | ⬜ |
| H04-07 | ADMIN | POST con body `"{ malformado"`. | `400`. Auditoría motivo `JSON_INVALIDO`. | | | ⬜ |
| H04-08 | ADMIN | POST con `{endpoint:"chat",latenciaMs:100,prompt:"texto del prompt completo",email:"x@y.com"}`. | `400`. Auditoría motivo `CAMPO_DESCONOCIDO`. **Ningún** `prompt` ni `email` queda persistido. | | | ⬜ |
| H04-09 | ADMIN | POST con `{endpoint:"otro",latenciaMs:10}`. | `400`. Auditoría motivo `ENDPOINT_INVALIDO`. | | | ⬜ |
| H04-10 | ADMIN | 31 POST válidos en < 60 segundos desde la misma sesión. | Los primeros 30 → `200`. El 31º → `429` con headers `Retry-After`, `X-RateLimit-Limit:30`, `X-RateLimit-Remaining:0`. Auditoría del 31º motivo `RATE_LIMIT`. | | | ⬜ |
| H04-11 | Inspector Firestore | Tras H04-04..H04-10, revisar `ai_logs` y `seguridad_ai_log_auditoria`. | `ai_logs`: ningún doc contiene `error` con texto crudo del usuario, ni `prompt`, ni `email`. Sólo los 7 campos del helper. `seguridad_ai_log_auditoria`: ningún doc contiene PII (sólo `actorUid`, `actorRol`, `actorTenant`, `radicadoId`, `motivo`, `fecha`). | | | ⬜ |
| H04-12 | DevTools | Revisar headers de las respuestas H04-01..H04-10. | Todas tienen `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`. | | | ⬜ |

### 1.3 Criterio de aprobación H-04

12/12 casos en ✅ o 🟡, con observaciones aceptadas por Seguridad técnico.

---

## 2. Sección H-05 — Cron fail-closed

### 2.1 Endpoints cubiertos

- `/api/cron/alertas-vencimiento`
- `/api/cron/simi/alertas-vencimiento`

**Importante:** todos los casos se ejecutan contra **ambos** endpoints. Marcar el resultado por endpoint.

### 2.2 Matriz H-05

| Caso | Acción | Resultado esperado | Resultado obtenido (alertas) | Resultado obtenido (simi) | Estado |
|---|---|---|---|---|:-:|
| H05-01 | **Verificación operativa, no endpoint:** desplegar Preview temporal con `CRON_SECRET` sin configurar. Hacer `GET` al endpoint sin headers. | `503 {"error":"Servicio no disponible."}`. Job **no** ejecuta. Log con motivo `CRON_SECRET_NO_CONFIGURADO`. **No usar el Preview principal**: crear deployment temporal o usar `vercel dev` local con env vacío. | | | ⬜ |
| H05-02 | `GET` sin header `Authorization`. | `401 {"error":"No autorizado."}`. Log motivo `AUTHORIZATION_REQUERIDO`. | | | ⬜ |
| H05-03 | `GET` con `Authorization: TokenABC` (sin `Bearer`). | `401`. Log motivo `FORMATO_BEARER_INVALIDO`. | | | ⬜ |
| H05-04 | `GET` con `Authorization: Bearer token-incorrecto-de-prueba`. | `401`. Log motivo `TOKEN_INVALIDO`. La comparación es `timingSafeEqual` con padding (verificar en logs que el tiempo de respuesta es similar a H05-03 — no debe filtrarse longitud del secreto). | | | ⬜ |
| H05-05 | `GET` con `Authorization: Bearer <CRON_SECRET>` (correcto). | `200 {"ok":true,"total":N,"alertados":M,...}`. **Sólo ejecutar con SMTP sandbox o lista de radicados sin vencimiento próximo** para evitar correos reales. | | | ⬜ |
| H05-06 | DevTools en H05-02..H05-04. | Body de error no expone el secreto, no expone el motivo enum interno (sólo el mensaje genérico), no expone el token recibido. | | | ⬜ |

### 2.3 Criterio de aprobación H-05

6/6 casos × 2 endpoints en ✅ o 🟡. H05-01 puede quedar 🟡 si la verificación es por inspección de código + config (no por ejecución), pero **debe** documentarse así.

---

## 3. Sección H-07 — Cabeceras de seguridad

### 3.1 Cabeceras esperadas (todas las rutas)

| Header | Valor exacto |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy-Report-Only` | (allowlist completa — ver `next.config.ts`) |
| `X-Powered-By` | **ausente** (`poweredByHeader: false`) |

### 3.2 Matriz H-07

| Caso | Acción | Resultado esperado | Resultado obtenido | Evidencia | Estado |
|---|---|---|---|---|:-:|
| H07-01 | `curl -I https://<preview>.vercel.app/` | Las 6 cabeceras presentes con valores exactos. `X-Powered-By` ausente. | | | ⬜ |
| H07-02 | `curl -I https://<preview>.vercel.app/api/consulta/[id-inexistente]` (endpoint público GET). | Mismas 6 cabeceras. | | | ⬜ |
| H07-03 | `curl -I https://<preview>.vercel.app/api/interno/notificar-ciudadano` (endpoint privado; OPTIONS o GET → 401/405). | Mismas 6 cabeceras incluso en respuesta de error. | | | ⬜ |
| H07-04 | Revisar todas las respuestas anteriores. | Ningún `X-Powered-By: Next.js` o similar. | | | ⬜ |
| H07-05 | Verificar que la cabecera de CSP es **`Content-Security-Policy-Report-Only`** y no `Content-Security-Policy`. | Sí, en modo Report-Only. (Permite observar violaciones sin bloquear.) | | | ⬜ |
| H07-06 | Durante **≥ 7 días** en Preview con tráfico de UAT, revisar Sentry y logs de Vercel buscando `csp-report` o violaciones. | Sin violaciones inesperadas. Si las hay, documentar fuente y ajustar allowlist antes de promover a Enforce. | | | ⬜ |
| H07-07 | Una vez H07-06 está limpio, **abrir PR separada** que cambie `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (enforce). | PR creada y enlazada como dependiente de este cierre. | | | ⬜ |
| H07-08 | Verificar HSTS sólo aplica sobre HTTPS — `curl -I http://<preview>...` (si Vercel permite) debe redirigir a HTTPS antes de aplicar HSTS. | Redirección a HTTPS o conexión rechazada. | | | ⬜ |

### 3.3 Criterio de aprobación H-07

8/8 casos en ✅ o 🟡. **H07-07** (enforce) es una acción futura — puede quedar
documentada como "compromiso post-cierre con fecha objetivo", no bloquea el
cierre de H-07 en Report-Only si H07-06 lo respalda.

---

## 4. Evidencias requeridas (todas las secciones)

Por cada caso ejecutado:

- usuario/rol (cuando aplique);
- comando o flujo UI ejecutado;
- resultado esperado vs. obtenido;
- captura del response HTTP (status + headers + body);
- para casos de Firestore: captura del doc creado o ausente;
- para H05-05: captura del cron log en Vercel mostrando ejecución autorizada;
- para H07-06: captura del filtro de Sentry o logs de Vercel durante la ventana;
- aprobado / no aprobado;
- observación.

---

## 5. Firmas

### Responsable técnico / seguridad

- Nombre:
- Cargo:
- Firma:
- Fecha:

### Responsable funcional Ventanilla Única

- Nombre:
- Cargo:
- Firma:
- Fecha:

### Responsable UAT / supervisor

- Nombre:
- Cargo:
- Firma:
- Fecha:

---

## 6. Cierre administrativo

Cuando las tres secciones queden en ✅ y los tres roles firmen, actualizar en un
único commit documental:

- `docs/SEGURIDAD_HOTFIXES.md` — bloque H-04, H-05, H-07 a `✅ Corregido — UAT aprobada` con fecha, ambiente Preview y commit `0d916a2` (PR #19).
- `docs/AUDITORIA_SEGURIDAD_DATOS_ESCALABILIDAD.md` — filas H-04, H-05, H-07 en Resumen, Parte 18 y Parte 20.

No modificar código de negocio en ese commit. Rama sugerida:
`docs/uat-hardening-h04-h05-h07`.

Si H07-07 (CSP Enforce) no se ejecuta en el mismo cierre, dejar una nota en el
bloque H-07 con el PR pendiente y la fecha objetivo.
