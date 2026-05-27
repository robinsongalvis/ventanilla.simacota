# Firebase Security Rules

Estos archivos dejan las reglas listas para copiar en Firebase Console o desplegar con Firebase CLI:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

## Modelo esperado

Cada funcionario debe tener un documento en `users/{uid}`:

```json
{
  "nombre": "Secretaria de Gobierno",
  "email": "gobierno@simacota.gov.co",
  "rol": "FUNCIONARIO",
  "tenantId": "SEC_GOBIERNO"
}
```

Roles soportados:

- `ADMIN`
- `FUNCIONARIO`
- `RECEPCIONISTA`

## Comportamiento

- `radicados/{id}` ya no permite `get` publico directo desde el SDK cliente.
- `/consulta` debe pasar por `/api/consulta/{radicadoId}`, que usa cuenta de servicio y devuelve solo campos publicos.
- `list` de radicados queda limitado a `ADMIN` o al `tenantId` del funcionario/recepcionista.
- `create` de radicados queda publico solo para origen `WEB`; origen `FISICO_ESCANER` requiere `ADMIN` o `RECEPCIONISTA`.
- `notasInternas` solo puede enviarse al crear un radicado desde `ADMIN` o `RECEPCIONISTA`.
- `update` de radicados queda limitado a `ADMIN`, `FUNCIONARIO` y `RECEPCIONISTA` de la dependencia asignada.
- `delete` de radicados queda bloqueado.
- `users` solo puede leerse por el propio usuario o por `ADMIN`; crear/editar usuarios queda solo para `ADMIN`.
- Adjuntos en Storage pueden subirse sin cuenta, pero solo si son PDF o imagen y pesan maximo 10 MB.
- Adjuntos solo pueden leerse con usuario autenticado.

## Aplicacion manual

En Firebase Console:

1. Firestore Database -> Rules -> pegar `firestore.rules` sin la primera linea de comentario externa si la consola lo pide.
2. Storage -> Rules -> pegar `storage.rules`.
3. Publicar.

## Aplicacion con CLI

```bash
firebase use <project-id>
firebase deploy --only firestore:rules,storage
```

## Variables server-side

Las APIs server-side requieren estas variables:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`FIREBASE_PRIVATE_KEY` puede guardarse con saltos escapados `\n`, como suele ocurrir en Vercel.

## Nota de seguridad

Tambien hay un paso de bootstrap: crea al menos un usuario `ADMIN` en Firebase Auth y su documento `users/{uid}` antes de publicar estas reglas, o hazlo con una cuenta de servicio. Una vez publicadas, crear/editar usuarios desde cliente queda reservado a administradores.
