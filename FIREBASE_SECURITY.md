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

- `radicados/{id}` permite `get` publico para que `/consulta` funcione con el numero de radicado.
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

## Nota de seguridad

La consulta publica por ID expone el documento completo a quien conozca el numero de radicado. Es aceptable para el flujo actual, pero el siguiente endurecimiento recomendado es mover `/consulta` a una API server-side que devuelva solo campos publicos.

Tambien hay un paso de bootstrap: crea al menos un usuario `ADMIN` en Firebase Auth y su documento `users/{uid}` antes de publicar estas reglas, o hazlo con Firebase Admin SDK. Una vez publicadas, crear/editar usuarios desde cliente queda reservado a administradores.
