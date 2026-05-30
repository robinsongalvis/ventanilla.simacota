# Production Readiness — Ventanilla Única Simacota

**Fecha de auditoría:** 2026-05-30  
**Versión:** Next.js 16.2.6 · Firebase 12 / Admin 13 · React 19  
**Módulo auditado:** Flujo completo de resolución de radicados + notificación al ciudadano

---

## Estado general

| Área | Estado | Bloqueante |
|---|---|---|
| Variables de entorno — cliente | ✅ Configuradas | No |
| Variables de entorno — servidor | ⚠️ Parcialmente configuradas | **SÍ** |
| SMTP (email institucional) | ❌ Sin configurar | **SÍ** |
| Firebase Security Rules | ✅ Revisadas y hardened | No |
| Firestore Índice compuesto | ✅ Creado (`firestore.indexes.json`) | No |
| Build TypeScript | ✅ Limpio | No |
| Tests automatizados | ✅ 8/8 passing | No |
| Logger estructurado | ✅ Implementado | No |
| Rollback documentado | ✅ Ver sección 8 | No |

> **Veredicto:** El sistema **NO está listo para producción** hasta que se configuren las variables de entorno del servidor (Firebase Admin SDK + SMTP). Una vez configuradas, puede desplegarse.

---

## 1. Variables de entorno — auditoría completa

### 1.1 Variables configuradas en `.env.local`

| Variable | Uso | Estado |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Cliente Firebase | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Login ciudadano/funcionario | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Cliente SDK | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Upload archivos | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM (futuro) | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Cliente SDK | ✅ |

### 1.2 Variables faltantes — BLOQUEANTES para producción

Ninguna de estas existe en `.env.local`. Todas son necesarias para que las rutas API funcionen.

| Variable | Módulo que falla sin ella | Prioridad |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `/api/auth/session`, `/api/auth/logout`, `/api/interno/archivo`, `/api/interno/notificar-ciudadano`, telemetría IA | 🔴 CRÍTICA |
| `FIREBASE_STORAGE_BUCKET` | `/api/interno/archivo` (signed URLs) | 🔴 CRÍTICA |
| `EMAIL_HOST` | `/api/interno/notificar-ciudadano` | 🔴 CRÍTICA |
| `EMAIL_USER` | Igual | 🔴 CRÍTICA |
| `EMAIL_PASS` | Igual | 🔴 CRÍTICA |
| `EMAIL_PORT` | Igual (default 587 si se omite) | 🟡 ALTA |
| `EMAIL_FROM` | Igual (default = EMAIL_USER si se omite) | 🟡 ALTA |
| `GEMINI_API_KEY` | `/api/ai/*` — clasificación IA | 🟡 ALTA |
| `SENTRY_DSN` | Observabilidad (sprint ALTO-3, pendiente) | 🟢 MEDIA |

### 1.3 Configuración para despliegue

**Gmail con App Password (recomendado para inicio):**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=notificaciones@simacota-santander.gov.co
EMAIL_PASS=xxxx xxxx xxxx xxxx        # App Password de 16 caracteres
EMAIL_FROM="Alcaldía de Simacota <notificaciones@simacota-santander.gov.co>"
```

**FIREBASE_SERVICE_ACCOUNT** — JSON inline (una sola línea):
```env
FIREBASE_SERVICE_ACCOUNT='{"project_id":"tu-proyecto","client_email":"firebase-adminsdk-...@...iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}'
FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
```

> ⚠️ En Vercel: pegar el JSON como string en la variable de entorno de la plataforma, NO en un archivo `.env`. Nunca incluir `FIREBASE_SERVICE_ACCOUNT` en repositorios.

---

## 2. Validación SMTP

### Configuración del transporter (lib/email/mailer.ts)

| Parámetro | Valor |
|---|---|
| Autenticación | Usuario + App Password |
| Puerto seguro | 587 STARTTLS (SSL en 465) |
| `secure` auto-detectado | `port === 465` → true, resto → false |
| Manejo de errores | `logError` + HTTP 500 sin detalles al cliente |
| Fire-and-forget en UI | ✅ No bloquea al funcionario |

### Plan de validación SMTP antes de producción

1. Crear cuenta Gmail `notificaciones@simacota-santander.gov.co` con 2FA activo.
2. Generar App Password (Google Account → Seguridad → Contraseñas de aplicación).
3. Configurar las variables en `.env.local` (local) y en el panel de Vercel (producción).
4. Ejecutar prueba manual: resolver un radicado de prueba con email real de funcionario.
5. Verificar que el email llega en < 30 segundos con el formato correcto.
6. Verificar que si SMTP falla, el funcionario ve "Operación guardada correctamente" (radicado resuelto) y en los logs aparece `[ventanilla:error] {"modulo":"resolver-radicado/email-ciudadano"...}`.

---

## 3. Checklist de despliegue

### Pre-despliegue (completar en orden)

- [ ] **ENV-1** Configurar `FIREBASE_SERVICE_ACCOUNT` en Vercel (Environment Variables → Production)
- [ ] **ENV-2** Configurar `FIREBASE_STORAGE_BUCKET` en Vercel
- [ ] **ENV-3** Configurar `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` en Vercel
- [ ] **ENV-4** Configurar `GEMINI_API_KEY` en Vercel
- [ ] **RULES-1** Desplegar reglas Firestore: `firebase deploy --only firestore:rules`
- [ ] **RULES-2** Desplegar reglas Storage: `firebase deploy --only storage`
- [ ] **INDEX-1** Desplegar índice compuesto: `firebase deploy --only firestore:indexes`
  - Alternativa: Firebase Console → Firestore → Indexes → Crear índice compuesto
  - Colección: `ventanilla_radicados`, Campo 1: `clasificacion.oficinaDestino` (ASC), Campo 2: `control.fechaRadicado` (DESC)
  - ⚠️ La creación del índice toma 5-15 minutos
- [ ] **BUILD-1** Ejecutar `npm run build` localmente — verificar cero errores
- [ ] **TEST-1** Ejecutar `npm run test` — verificar 8/8 passing
- [ ] **SMTP-1** Probar envío de email desde local con variables reales

### Despliegue

- [ ] **DEPLOY-1** `git push origin main` (Vercel detecta y despliega automáticamente)
- [ ] **DEPLOY-2** Verificar en Vercel Dashboard que el build pasó
- [ ] **DEPLOY-3** Ejecutar smoke test en URL de producción (ver Sección 7)

### Post-despliegue

- [ ] **POST-1** Verificar logs en Vercel Functions → Logs (no deben aparecer errores de Admin SDK)
- [ ] **POST-2** Confirmar que el índice de Firestore está en estado "Enabled"
- [ ] **POST-3** Resolver radicado real de prueba y confirmar email recibido

---

## 4. Reglas de seguridad Firebase — auditoría

### 4.1 Firestore Rules

| Regla | Estado | Nota |
|---|---|---|
| Acceso por tenant (`clasificacion.oficinaDestino == userTenant()`) | ✅ | Aislamiento correcto |
| Funcionario no puede cambiar a otro tenant | ✅ | Doble check before/after en update |
| Trazabilidad append-only | ✅ | `allow update, delete: if false` |
| `ai_logs` — solo Admin lee, nadie escribe desde cliente | ✅ | Admin SDK escribe |
| `validVentanillaUpdate` — validación de `estadoActual` | ✅ **Corregida en este sprint** | Agregada función `validVentanillaEstado` |
| Colección `counters` — solo Admin/Recepcionista | ✅ | Correcto para radicación |
| Catch-all final `allow read, write: if false` | ✅ | Seguro por defecto |

**Estados válidos para cliente en `ventanilla_radicados`:**
```
PENDIENTE · EN_REVISION · EN_PROCESO · ASIGNADO
RESUELTO · DEVUELTO · RECHAZADO · PRORROGA
```
`POR_VENCER` y `VENCIDO` quedan reservados para Admin SDK (Cloud Functions futuras).

### 4.2 Hallazgo menor — colección legacy `radicados`

`validEstado()` no incluye `'ASIGNADO'`, `'PRORROGA'`, `'POR_VENCER'`, `'VENCIDO'`. Esta colección parece ser la del flujo ciudadano anterior (no el MIPG). Riesgo: **BAJO** (colección separada, no afecta el flujo auditado).

### 4.3 Storage Rules

| Regla | Estado |
|---|---|
| `radicados/` — escritura sin auth (ciudadano), límite 10 MB, solo PDF/imagen | ✅ |
| `radicados/` — lectura deshabilitada (`allow read: if false`) | ✅ |
| `respuestas/` — escritura solo usuario autenticado, solo PDF, límite 10 MB | ✅ |
| `respuestas/` — lectura deshabilitada (solo via signed URLs Admin SDK) | ✅ |
| Catch-all `allow read, write: if false` | ✅ |

---

## 5. Índice compuesto Firestore

### Índice requerido

| Colección | Campo 1 | Campo 2 |
|---|---|---|
| `ventanilla_radicados` | `clasificacion.oficinaDestino` (ASC) | `control.fechaRadicado` (DESC) |

**Usado por:** `useVentanillaRadicados` → query con `where + orderBy`

**Archivo creado:** `firestore.indexes.json`  
**Despliegue:** `firebase deploy --only firestore:indexes`

> Si el índice no existe, el hook captura el error de Firestore y muestra el enlace de creación directamente en la UI (`"Falta un índice en Firestore. Créalo aquí: [link]"`). El dashboard queda en blanco pero no crashea.

---

## 6. Logs en entorno productivo

### Formato de `logError` (lib/logger.ts)

```json
[ventanilla:error] {"radicadoId":"SIM-2026-001","timestamp":"2026-05-30T10:00:00.000Z","modulo":"resolver-radicado/critico","mensaje":"Firestore: network unavailable"}
```

### Módulos con logging estructurado

| Módulo | Evento registrado |
|---|---|
| `resolver-radicado/critico` | Error en Storage o updateDoc |
| `resolver-radicado/trazabilidad` | Error en addDoc de trazabilidad |
| `resolver-radicado/email-ciudadano` | Error SMTP / fetch fallido |
| `notificar-ciudadano` (API route) | Error SMTP en server (ruta API) |

### En Vercel

Acceder a: **Vercel Dashboard → proyecto → Functions → Logs**. Filtrar por `[ventanilla:error]`. Cada línea es JSON parseable para agregar en cualquier sistema de monitoreo.

---

## 7. Escenarios de prueba — flujo real

Ejecutar en este orden antes de anunciar producción al equipo.

### 7.1 Caso: ciudadano con email, sin archivo adjunto

**Precondición:** Radicado en estado `EN_PROCESO`, solicitante con email real.

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Escribir respuesta ≥ 10 caracteres en textarea | Habilitado |
| 2 | Clic "Marcar como resuelto" | Spinner aparece |
| 3 | Esperar confirmación | Banner verde "Operación guardada correctamente" |
| 4 | Verificar Firestore | `estadoActual: "RESUELTO"`, `ultimaActualizacion` actualizado |
| 5 | Verificar subcollección `trazabilidad` | Nuevo evento `RESPUESTA_FUNCIONARIO` |
| 6 | Verificar email recibido (ciudadano) | Asunto: "Su solicitud SIM-XXX ha sido respondida…" |
| 7 | Textarea y PDF input limpiados | ✅ |

### 7.2 Caso: ciudadano SIN email

| Paso | Resultado esperado |
|---|---|
| Resolver radicado normalmente | Banner verde, Firestore actualizado |
| Sin email en `solicitante.email` | `despacharNotificaciones` no llama a `fetch` |
| Logs | Sin error de email — flujo completo |

### 7.3 Caso: SMTP fallido (simular)

**Preparación:** Poner `EMAIL_PASS=invalida` temporalmente.

| Resultado esperado |
|---|
| Radicado marcado RESUELTO en Firestore ✅ |
| Funcionario ve "Operación guardada correctamente" ✅ |
| Email al ciudadano NO llega (esperado) |
| En Vercel Logs: `[ventanilla:error] {"modulo":"resolver-radicado/email-ciudadano"...}` ✅ |

### 7.4 Caso: con archivo PDF adjunto

| Paso | Resultado esperado |
|---|---|
| Adjuntar PDF ≤ 10 MB | Nombre del archivo visible en UI |
| Resolver | Spinner más largo (upload + Firestore) |
| Firestore | `respuestaOficial.archivoPath` con ruta `respuestas/…` |
| Email | Sección "📎 Oficio de respuesta disponible" visible |
| Descarga del oficio | `/api/interno/archivo?path=respuestas/…` → signed URL (302) |

### 7.5 Caso: sin archivo adjunto

| Resultado esperado |
|---|---|
| `respuestaOficial` ausente en Firestore |
| Email sin sección de archivo adjunto |
| `tieneArchivo: false` en payload email |

### 7.6 Caso: Firestore fallido (simular)

**Preparación:** Deshabilitar red o revocar permisos temporalmente.

| Resultado esperado |
|---|
| Banner **rojo** con mensaje de error |
| Textarea conserva el contenido ✅ |
| PDF input conserva el archivo ✅ |
| Email NO se envía ✅ |
| `estadoActual` en Firestore sin cambio ✅ |

---

## 8. Plan de rollback

### Rollback de código (Vercel)

```bash
# Ver deployments anteriores
npx vercel ls

# Promover deployment anterior a producción
npx vercel rollback [deployment-url]
# O desde Vercel Dashboard → Deployments → seleccionar → Promote to Production
```

### Rollback de reglas Firestore

```bash
# Restaurar desde git el archivo anterior
git show HEAD~1:firestore.rules > firestore.rules.bak
# Revisar y desplegar
firebase deploy --only firestore:rules
```

### Rollback de índice

El índice `firestore.indexes.json` solo **agrega** un índice compuesto; no modifica ni elimina índices existentes. El rollback es eliminar el índice desde Firebase Console si fuera necesario (no afecta datos).

### Rollback de datos (sin migraciones)

No hubo migraciones de esquema. Los cambios a Firestore son aditivos:
- `respuestaOficial` es un campo opcional nuevo — los radicados sin él siguen funcionando.
- La subcollección `trazabilidad` es append-only — no hay datos a revertir.

> No existe riesgo de pérdida de datos en un rollback de código.

---

## 9. Resumen de archivos entregados en este sprint

| Archivo | Estado | Descripción |
|---|---|---|
| `firestore.indexes.json` | 🆕 Nuevo | Índice compuesto requerido por el hook |
| `firebase.json` | ✏️ Modificado | Referencia al archivo de índices |
| `firestore.rules` | ✏️ Modificado | `validVentanillaEstado` + validación en `validVentanillaUpdate` |
| `lib/logger.ts` | 🆕 Nuevo | Logger estructurado JSON |
| `lib/acciones/resolver-radicado.ts` | 🆕 Nuevo | Lógica crítica/secundaria desacoplada |
| `__tests__/resolver-radicado.test.ts` | 🆕 Nuevo | 8 tests (4 escenarios de hardening) |
| `vitest.config.mts` | 🆕 Nuevo | Configuración de Vitest (Next.js 16 oficial) |
| `package.json` | ✏️ Modificado | Scripts `test`/`test:watch` + 7 devDependencies |
| `app/interno/dashboard/page.tsx` | ✏️ Modificado | `responderCaso()` delega a funciones extraídas |

---

*Generado automáticamente — Auditoría de Production Readiness — Ventanilla Única Digital, Alcaldía de Simacota, Santander, Colombia*
