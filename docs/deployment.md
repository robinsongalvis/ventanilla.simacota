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
