# Ventanilla Unica Digital - Alcaldia de Simacota

Aplicacion Next.js para radicacion ciudadana, consulta publica de estado y gestion interna de radicados con Firebase.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores de Firebase.

- `NEXT_PUBLIC_FIREBASE_*`: configuracion publica del SDK web.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: cuenta de servicio usada solo por APIs server-side.
- `N8N_WEBHOOK_URL`: webhook privado de clasificacion IA.

No uses `NEXT_PUBLIC_` para secretos.

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Produccion

Antes de publicar:

```bash
npm run lint
npm run build
firebase deploy --only firestore:rules,storage
```

La consulta ciudadana `/consulta` no lee Firestore directamente desde el navegador: pasa por `/api/consulta/{radicadoId}` y devuelve solo campos publicos.

La clasificacion IA se dispara mediante `/api/radicacion/webhook`, que usa `N8N_WEBHOOK_URL` privado del servidor.

## Firebase

Reglas incluidas:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

Consulta tambien `FIREBASE_SECURITY.md`.
