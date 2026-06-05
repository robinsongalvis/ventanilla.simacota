# Variables de Entorno — Ventanilla Única Digital Simacota

Configura estas variables en Vercel → Settings → Environment Variables
antes de hacer deploy a producción.

---

## 🔴 CRÍTICAS — Sin estas el sistema NO funciona

### Firebase (cliente)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```
Origen: Firebase Console → Project Settings → General → Your apps

### Firebase Admin (servidor)
```
FIREBASE_SERVICE_ACCOUNT={"project_id":"...","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}
FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
```
Origen: Firebase Console → Project Settings → Service accounts → Generate new private key
Pegar el JSON completo como string en FIREBASE_SERVICE_ACCOUNT.

---

## 🟡 IMPORTANTES — Sin estas, funciones clave fallan silenciosamente

### SIMI / Gemini AI
```
GEMINI_API_KEY=
```
Origen: Google AI Studio → https://aistudio.google.com/app/apikey
Sin esta variable, SIMI Jurídico no genera análisis ni borradores.

### Email (notificaciones internas)
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=notificaciones@simacota-santander.gov.co
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx   # App Password de Gmail
EMAIL_FROM="Alcaldía de Simacota <notificaciones@simacota-santander.gov.co>"
```
Para Gmail: activar autenticación de 2 pasos → Contraseñas de aplicación → Mail
Sin esta configuración, los emails de aprobaciones no se envían.

### URL de la aplicación
```
NEXT_PUBLIC_APP_URL=https://ventanilla.simacota.gov.co
```
Usada en links de emails. Si no está configurada, los botones de emails apuntarán a la URL de producción hardcodeada (https://ventanilla.simacota.gov.co).

---

## 🟢 OPERACIONALES — Para funciones específicas

### Cron de alertas de vencimiento
```
CRON_SECRET=un-secreto-muy-largo-y-aleatorio
```
Generar con: `openssl rand -hex 32`
Configurar en Vercel Cron Jobs → el endpoint `/api/cron/alertas-vencimiento`
usa `Authorization: Bearer {CRON_SECRET}` para protegerse.

### Sentry (monitoreo de errores — opcional pero recomendado)
```
SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```
Sin esto, los errores de producción no se reportan.

---

## Checklist de verificación pre-deploy

- [ ] Firebase Auth habilitado con Email/Password
- [ ] Firestore creado en modo producción
- [ ] Security Rules de Firestore aplicadas (`firestore.rules`)
- [ ] Storage Rules aplicadas (`storage.rules`)
- [ ] Dominio autorizado en Firebase → Authentication → Authorized domains
- [ ] CORS configurado si se usa Storage directamente
- [ ] `GEMINI_API_KEY` con créditos disponibles
- [ ] Email SMTP probado con herramienta como Mailtrap
- [ ] `CRON_SECRET` configurado en Vercel Cron Jobs
- [ ] `NEXT_PUBLIC_APP_URL` apunta al dominio real

---

## Variables actuales en `.env.local` (desarrollo local)

Estas variables ya están en `.env.local` y NO deben subirse a git:
- `FIREBASE_SERVICE_ACCOUNT` ✅
- `FIREBASE_STORAGE_BUCKET` ✅
- `NEXT_PUBLIC_FIREBASE_*` ✅

Estas variables FALTAN en `.env.local` y deben agregarse:
- `GEMINI_API_KEY` ❌
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` ❌
- `CRON_SECRET` ❌
- `NEXT_PUBLIC_APP_URL` ❌
- `SENTRY_DSN` ❌ (opcional)

El archivo `.env.local` está en `.gitignore` — nunca se sube al repositorio. ✅
