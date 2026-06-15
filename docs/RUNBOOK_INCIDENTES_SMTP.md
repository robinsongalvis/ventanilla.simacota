# Runbook de Incidentes SMTP y Notificaciones
## Ventanilla Única Digital · Alcaldía de Simacota
**Clasificación:** Uso Institucional Interno | **Aplica desde:** 2026-06-14

---

## 1. Arquitectura de notificaciones por correo

| Evento | Trigger | Endpoint | Template |
|---|---|---|---|
| Confirmación de radicación | POST /api/radicacion (automático) | server-side fire-and-forget | `confirmacion-radicacion.ts` |
| Respuesta oficial al ciudadano | Funcionario resuelve radicado | POST /api/interno/notificar-ciudadano | `respuesta-ciudadano.ts` |
| Alerta de vencimiento próximo | Cron diario (L-V 12:00 UTC) | GET /api/cron/alertas-vencimiento | HTML inline en route |
| Reset de contraseña | ADMIN solicita reset | POST /api/admin/usuarios/[uid] | `reset-password.ts` |

**Trazabilidad en Firestore:**
- `NOTIFICACION_CORREO_ENVIADA` — se escribe cuando el email sale correctamente
- `NOTIFICACION_CORREO_FALLIDA` — se escribe cuando SMTP falla (incluye mensaje de error)
- Ambos eventos aparecen en la subcollección `ventanilla_radicados/{id}/trazabilidad`

---

## 2. Variables de entorno requeridas

| Variable | Valor de producción | Crítica |
|---|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` | Sí |
| `EMAIL_PORT` | `587` | No (default) |
| `EMAIL_USER` | `notificaciones@simacota-santander.gov.co` | Sí |
| `EMAIL_PASS` | App Password de 16 caracteres — solo en Vercel | Sí |
| `EMAIL_FROM` | `Alcaldía de Simacota <notificaciones@simacota-santander.gov.co>` | Sí |

> [!CAUTION]
> `EMAIL_PASS` NUNCA debe aparecer en código, archivos `.env` versionados, documentos ni capturas. Solo debe estar en Vercel Environment Variables → Production.

---

## 3. Procedimiento de configuración inicial

### Paso 1 — Configurar cuenta Gmail institucional
1. Iniciar sesión en `notificaciones@simacota-santander.gov.co`
2. Ir a **Cuenta de Google → Seguridad**
3. Activar **Verificación en dos pasos** (obligatorio)
4. Ir a **Contraseñas de aplicaciones**
5. Crear nueva App Password: Aplicación = "Correo", Dispositivo = "Ventanilla Digital"
6. Copiar los 16 caracteres generados (formato: `xxxx xxxx xxxx xxxx`)

### Paso 2 — Configurar en Vercel
1. Ir a **Vercel Dashboard → ventanilla-simacota → Settings → Environment Variables**
2. Agregar cada variable con target **Production** (y Preview si aplica):
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=notificaciones@simacota-santander.gov.co
   EMAIL_PASS=[App Password de 16 caracteres SIN espacios intermedios en Vercel]
   EMAIL_FROM=Alcaldía de Simacota <notificaciones@simacota-santander.gov.co>
   ```
3. Guardar cada variable

### Paso 3 — Redeploy
1. En Vercel → **Deployments → seleccionar el último deploy → Redeploy**
2. O hacer `git push origin main` para trigger automático
3. Verificar que el build pasa ✅

### Paso 4 — Prueba de smoke test
```bash
# 1. Ir a https://ventanilla-simacota.vercel.app/radicacion
# 2. Crear radicado con un correo real del equipo TI (ej. correo personal del administrador)
# 3. Verificar:
#    - Se genera consecutivo (1-WEB-2026-XXXXXXXX)
#    - Aparece confirmación en pantalla
#    - El correo de confirmación llega en < 60 segundos
#    - El asunto dice: "Radicado 1-WEB-2026-XXXXXXXX confirmado – Alcaldía Municipal de Simacota"
```

---

## 4. Diagnóstico de fallos comunes

### 4.1 Error: "Configuración de email incompleta"
```
Error: Configuración de email incompleta. Verifique EMAIL_HOST, EMAIL_USER y EMAIL_PASS
```
**Causa:** Una o más variables de entorno SMTP no están configuradas en Vercel.
**Acción:**
1. Verificar en Vercel → Settings → Environment Variables que `EMAIL_HOST`, `EMAIL_USER` y `EMAIL_PASS` existen
2. Confirmar que el target es **Production** (no solo Preview o Development)
3. Hacer redeploy después de agregar/modificar variables

---

### 4.2 Error: "Invalid login" o "Username and Password not accepted"
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```
**Causa:** La App Password es incorrecta, expiró o fue revocada.
**Acción:**
1. Ir a la cuenta Gmail institucional
2. Verificar que la App Password sigue activa (Seguridad → Contraseñas de aplicaciones)
3. Si fue revocada, generar una nueva y actualizar `EMAIL_PASS` en Vercel
4. Hacer redeploy

> [!WARNING]
> Si se cambia la contraseña principal de la cuenta Gmail, **todas las App Passwords quedan revocadas automáticamente**. Generar una nueva App Password inmediatamente.

---

### 4.3 Error: Connection timeout o Connection refused
```
Error: connect ETIMEDOUT smtp.gmail.com:587
```
**Causa:** El servidor SMTP de Gmail no es accesible desde Vercel (raro) o el puerto está bloqueado.
**Acción:**
1. Verificar que `EMAIL_PORT=587` está configurado (no 465 ni otro puerto)
2. Probar cambiando a `EMAIL_PORT=465` y `secure=true` implícito
3. Si el problema persiste, verificar el estado de Gmail SMTP en [workspace.google.com/status](https://workspace.google.com/status)

---

### 4.4 El correo llega a spam
**Causa:** El dominio `simacota-santander.gov.co` puede no tener SPF/DKIM configurado para Google Workspace.
**Acción (corto plazo — mientras se resuelve el dominio):**
- Pedir al ciudadano agregar `notificaciones@simacota-santander.gov.co` a sus contactos
- Revisar la carpeta de spam

**Acción (mediano plazo — definitiva):**
1. Configurar **SPF** en el DNS del dominio: `v=spf1 include:_spf.google.com ~all`
2. Configurar **DKIM** desde Google Workspace Admin → Gmail → Autenticar correo
3. Configurar **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:admin@simacota-santander.gov.co`
4. Verificar configuración con [mxtoolbox.com](https://mxtoolbox.com)

---

### 4.5 Vercel no toma las nuevas variables
**Causa:** Las variables se agregaron pero no se hizo redeploy, o se agregaron al entorno equivocado.
**Acción:**
1. Verificar en Vercel → Settings → Environment Variables que el target incluye **Production**
2. Hacer redeploy manual en Vercel → Deployments → Redeploy
3. Verificar en el log del deployment que no hay errores de configuración

---

### 4.6 Gmail bloquea el envío por política de seguridad de Google Workspace
**Causa:** El administrador de Google Workspace del municipio puede tener restricciones adicionales.
**Acción:**
1. Contactar al administrador de Google Workspace del municipio
2. En Google Workspace Admin → Seguridad → Configuración básica → verificar que "Acceso de aplicaciones menos seguras" no está bloqueado para aplicaciones con App Password
3. Alternativa: usar un relay SMTP institucional del municipio si existe

---

## 5. Validación post-configuración

### Checklist de verificación

- [ ] Email de confirmación de radicación llega al ciudadano
- [ ] Email de respuesta oficial llega al ciudadano cuando funcionario resuelve
- [ ] Email de alerta de vencimiento llega al funcionario responsable (verificar con radicado de prueba próximo a vencer)
- [ ] Email de reset password llega al funcionario (sin exponer link en pantalla)
- [ ] En Vercel Logs: no hay errores `[ventanilla:error] {...modulo: "radicacion/email-confirmacion"...}`
- [ ] En trazabilidad de Firestore: evento `NOTIFICACION_CORREO_ENVIADA` presente en radicados de prueba
- [ ] El radicado se guarda correctamente aunque el email falle (SMTP fall-safe)

### Cómo verificar logs en Vercel
```
Vercel Dashboard → ventanilla-simacota → Functions → Logs
Filtrar por: [ventanilla:error]
```

### Cómo verificar trazabilidad en Firestore
```
Firebase Console → Firestore → ventanilla_radicados → {radicadoId} → trazabilidad
Buscar documentos con accion: "NOTIFICACION_CORREO_ENVIADA" o "NOTIFICACION_CORREO_FALLIDA"
```

---

## 6. Cron de alertas de vencimiento

| Parámetro | Valor |
|---|---|
| Schedule | Lunes a viernes, 12:00 UTC (7:00 AM COT) |
| Endpoint | `GET /api/cron/alertas-vencimiento` |
| Autorización | Header `Authorization: Bearer {CRON_SECRET}` |
| Umbral de alerta | Radicados con ≤ 2 días hábiles al vencimiento |

**Variable requerida (opcional pero recomendada):**
```
CRON_SECRET=cadena-aleatoria-segura-de-32-caracteres
```
Sin `CRON_SECRET`, el endpoint acepta cualquier llamada sin autenticación. Se recomienda configurarlo antes del go-live.

**Prueba manual del cron:**
```bash
curl -X GET https://ventanilla-simacota.vercel.app/api/cron/alertas-vencimiento \
  -H "Authorization: Bearer {CRON_SECRET}"
```
Respuesta esperada:
```json
{"ok":true,"timestamp":"...","total":N,"alertados":N,"errores":0,"omitidos":0}
```

---

## 7. Contactos de escalamiento

| Nivel | Responsable | Cuándo escalar |
|---|---|---|
| L1 | Administrador del sistema | Errores de configuración de variables |
| L2 | Equipo TI / DevOps | Errores de SMTP persistentes, cambios en App Password |
| L3 | Google Workspace Admin municipio | Bloqueos de cuenta, SPF/DKIM, políticas de Workspace |

---

*Documento generado el 2026-06-14 · Ventanilla Única Digital · Alcaldía de Simacota, Santander, Colombia*
