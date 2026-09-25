# Guía Oficial de Despliegue y Configuración
## Ventanilla Única Inteligente · Simacota

Este documento técnico describe los pasos necesarios para aprovisionar, configurar e implementar la plataforma de Ventanilla Única Inteligente en entornos de staging y producción.

---

## 1. Stack Tecnológico de Hosting

La plataforma está diseñada como una aplicación híbrida Next.js (App Router) optimizada para despliegues serverless o VPS convencionales:
* **Frontend y Backend API**: Alojado de forma nativa en **Vercel** o en un contenedor **Node.js (v20+)** mediante Docker.
* **Base de Datos y Autenticación**: **Firebase** (Cloud Firestore, Firebase Auth, Firebase Storage).
* **Capa Cognitiva**: **Google Gemini API** (modelo `gemini-2.5-flash` o superior).

---

## 2. Variables de Entorno Requeridas

El archivo `.env.local` debe configurarse en el servidor o en el panel de Vercel con las siguientes llaves estratégicas:

```ini
# Firebase Configuración Pública (Acceso Cliente)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyA1..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="ventanilla-simacota.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="ventanilla-simacota"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="ventanilla-simacota.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"

# Inteligencia Artificial (Acceso Servidor Secreto)
GEMINI_API_KEY="AIzaSyC..."
```

> [!WARNING]
> Jamás expongas `GEMINI_API_KEY` con el prefijo `NEXT_PUBLIC_`. La API de Gemini debe llamarse únicamente desde el lado del servidor (Route Handlers) para evitar robo de cuotas e inyección de payloads maliciosos desde clientes web no autorizados.

---

## 3. Configuración y Aprovisionamiento de Firestore

### 3.1. Índices Compuestos Requeridos
Para que las búsquedas, listados reactivos de trámites y cálculos del motor de anticipación de riesgos funcionen sin errores de base de datos (`QueryRequireIndexError`), se deben aprovisionar los siguientes índices en la consola de Firebase o mediante la consola CLI (`firebase deploy --only firestore:indexes`):

| Colección | Campos y Orden | Query Operativo Relacionado |
| :--- | :--- | :--- |
| `ventanilla_radicados` | `clasificacion.oficinaDestino` ASC, `control.fechaRadicado` DESC | Dashboard interno ordenado por llegada en secretaría |
| `ventanilla_radicados` | `estadoActual` ASC, `termino.fechaVencimiento` ASC | Listado de alertas y urgencia operativa por funcionario |
| `ventanilla_radicados` | `control.medioRecepcion` ASC, `control.fechaRadicado` DESC | Auditoría de canales públicos y físicos de radicación |
| `ai_logs` | `tipo` ASC, `timestamp` DESC | Monitoreo y telemetrías del panel de supervisión de IA |

### 3.2. Reglas de Seguridad (`firestore.rules`)
Asegúrate de que las reglas de seguridad restringen la escritura y lectura cruzada. Los ciudadanos no escriben directamente en Firestore: la creación pública pasa por `POST /api/radicacion` y el servidor crea documentos en `ventanilla_radicados`. Los funcionarios internos autenticados tienen permisos según su rol verificado en `usuarios/{uid}`.

---

## 3.3. Caché de favicon e íconos PWA

Los navegadores suelen cachear `favicon.ico`, `apple-touch-icon.png` y los íconos del manifest por más tiempo que el HTML. Si después de un deploy el navegador sigue mostrando el ícono anterior:

- Abrir en modo incógnito.
- Limpiar caché del navegador.
- En celular, eliminar el acceso directo anterior y volver a agregarlo.
- Confirmar que Vercel desplegó `favicon.ico`, `icon-192x192.png`, `icon-512x512.png` y `manifest.json`.
- Esperar propagación de caché si el usuario ya había abierto la página antes.

---

## 4. Despliegue Paso a Paso (Vercel CLI)

Para realizar un despliegue rápido desde tu estación de desarrollo:

1. **Instalar dependencias**:
   ```bash
   npm ci
   ```
2. **Construir el bundle de producción localmente** (Garantiza tipado perfecto e higiene sintáctica):
   ```bash
   npm run build
   ```
3. **Desplegar a producción**:
   ```bash
   npx vercel --prod
   ```
4. **Verificar variables de entorno**: Ejecuta un ping visual de prueba a `/api/ai/classify` o revisa el monitor de *AI Health Status* para certificar que la conexión con Gemini API y Firestore es correcta.

---

## 5. Configuración SMTP Institucional

El sistema de notificaciones por correo electrónico requiere las siguientes variables en Vercel (Production):

```ini
# Notificaciones institucionales — Gmail con App Password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=contactenos@simacota-santander.gov.co
EMAIL_PASS=[App Password de 16 caracteres — SOLO en Vercel, nunca en código]
EMAIL_FROM=Alcaldía de Simacota <contactenos@simacota-santander.gov.co>
```

### Correos institucionales enviados

| Evento | Destinatario | Template | Condición de envío |
|---|---|---|---|
| Radicación exitosa del ciudadano | Ciudadano | `confirmacion-radicacion.ts` | No anónimo + email válido |
| **Asignación a dependencia** | Ciudadano | `notificacion-estado.ts` (ASIGNADO) | No anónimo + email válido |
| **Prórroga aplicada** | Ciudadano | `notificacion-estado.ts` (PRORROGA) | No anónimo + email válido |
| Respuesta oficial del funcionario | Ciudadano | `respuesta-ciudadano.ts` | No anónimo + email válido |
| Alerta de vencimiento próximo | Funcionario responsable | HTML en `alertas-vencimiento/route.ts` | Radicado a ≤ 2 días hábiles del vencimiento |
| Reset de contraseña (ADMIN) | Funcionario interno | `reset-password.ts` | ADMIN solicita reset |

Las condiciones de envío al ciudadano se centralizan en `lib/email/debe-notificar-ciudadano.ts`. Un radicado **anónimo** o con email placeholder NUNCA recibe correo, sin importar el canal de respuesta seleccionado.

### Trazabilidad de notificaciones

Cada intento de envío registra un evento en `ventanilla_radicados/{id}/trazabilidad` mediante el helper unificado `registrarTrazabilidadNotificacion`:

| Acción | Significado |
|---|---|
| `NOTIFICACION_CORREO_ENVIADA` | Correo enviado correctamente |
| `NOTIFICACION_CORREO_FALLIDA` | SMTP falló — levanta el flag `alertaNotificacionFallida = true` en raíz del radicado |
| `NOTIFICACION_OMITIDA_DUPLICADA` | Idempotencia: misma asignación/prórroga ya notificada en los últimos 5 min |
| `NOTIFICACION_GESTIONADA_MANUALMENTE` | Funcionario marcó el fallo como gestionado por canal alternativo (baja el flag) |

Metadata incluida en cada evento: `tipoNotificacion`, `destinatario`, `estado`, `error?`, y datos específicos del evento (dependencia destino, nueva fecha, etc.).

> [!IMPORTANT]
> El fallo SMTP es **no bloqueante**: el radicado se guarda siempre. El sistema registra el fallo en trazabilidad, sube el flag raíz `alertaNotificacionFallida` (visible en el dashboard como badge rojo) y deja el error en logs de Vercel para diagnóstico posterior. El funcionario debe contactar al ciudadano por canal alternativo y marcar la notificación como gestionada desde el PanelDerecho.

### Validación SMTP antes de go-live

1. Configurar variables SMTP en Vercel + verificar SPF/DKIM en DNS del dominio
2. Hacer redeploy
3. Crear radicado de prueba en `/radicacion` con correo real del equipo TI → verificar correo de confirmación en < 60 segundos
4. Asignar el radicado a una dependencia → verificar correo de asignación
5. Aplicar prórroga → verificar correo con nueva fecha límite
6. Resolver el radicado desde el dashboard interno → verificar correo de respuesta oficial
7. Crear un radicado **anónimo** con email en el formulario → verificar que NO se envía correo
8. Reasignar el mismo radicado a la misma dependencia 2 veces seguidas → verificar evento `NOTIFICACION_OMITIDA_DUPLICADA`

### Referencia adicional

Ver [RUNBOOK_INCIDENTES_SMTP.md](./RUNBOOK_INCIDENTES_SMTP.md) para diagnóstico completo de fallos y procedimientos de escalamiento.

### Cron de alertas (vercel.json)

El cron `GET /api/cron/alertas-vencimiento` se ejecuta automáticamente:
- **Schedule:** Lunes a viernes a las 12:00 UTC (7:00 AM COT)
- **Seguridad:** Header `Authorization: Bearer {CRON_SECRET}` — configurar `CRON_SECRET` en Vercel
- **Umbral:** Radicados con ≤ 2 días hábiles al vencimiento

```bash
# Prueba manual del cron
curl -X GET https://ventanilla-simacota.vercel.app/api/cron/alertas-vencimiento \
  -H "Authorization: Bearer {CRON_SECRET}"
```

---

*Actualizado el 2026-06-14 — Sprint SMTP Institucional completado.*
