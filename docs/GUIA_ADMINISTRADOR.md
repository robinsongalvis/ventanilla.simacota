# Guía de Administrador

## Catálogo de tipos de solicitud

Los tipos de solicitud (PQRSD y trámites internos) están centralizados en
`lib/catalogos/tipos-solicitud.ts`. El catálogo define:

- Visibilidad ciudadana vs interna.
- Término legal (días hábiles o calendario).
- Si el tipo fue heredado del sistema actual.
- Si requiere validación jurídica antes de operar.

Cualquier ajuste a un término o a la lista de tipos visibles al ciudadano debe
hacerse en ese archivo y respaldarse en `docs/CATALOGO_SOLICITUDES.md`.

### Reclasificación de un radicado

`RECEPCIONISTA` y `ADMIN` pueden cambiar el tipo de solicitud de un radicado ya
creado (por ejemplo, cuando el ciudadano radicó como “Petición general” pero el
caso corresponde a una “Licencia de construcción”). El sistema:

1. Conserva el tipo anterior y el nuevo en metadata.
2. Recalcula la fecha de vencimiento.
3. Registra el evento `TIPO_SOLICITUD_RECLASIFICADO` en la trazabilidad.
4. Si el nuevo término es menor, advierte al funcionario antes de confirmar.

Endpoint: `POST /api/radicados/:radicadoId/reclasificar`.

## Acceso

URL interna:

`https://ventanilla-simacota.vercel.app/interno/login`

El administrador ingresa con el correo institucional y contraseña asignada. Si la sesión expira, el sistema vuelve al login.

## Usuarios internos

Desde el módulo **Administración** el rol `ADMIN` puede:

- Crear usuarios.
- Editar nombre, cargo, dependencia y rol.
- Desactivar usuarios.
- Reactivar usuarios.
- Marcar usuarios como institucionales, UAT o prueba.
- Archivar usuarios de prueba sin borrarlos físicamente.
- Enviar restablecimiento de contraseña.
- Revisar auditoría administrativa.

Al desactivar un usuario, el sistema:

- Marca `users/{uid}.activo = false`.
- Deshabilita la cuenta en Firebase Auth.
- Revoca refresh tokens para cortar sesiones vigentes.
- Registra el evento en `admin_auditoria`.

Al archivar un usuario, el sistema:

- Marca `users/{uid}.archivado = true`.
- Marca `activo = false`.
- Deshabilita la cuenta en Firebase Auth.
- Revoca refresh tokens.
- Conserva el documento para auditoría histórica.
- Oculta el usuario de la lista normal, salvo cuando el ADMIN active el filtro de archivados.

## Roles

- `ADMIN`: visibilidad global y administración del sistema.
- `RECEPCIONISTA`: radica y asigna solicitudes; no administra usuarios.
- `FUNCIONARIO`: gestiona radicados de su dependencia.
- `JEFE_DEPENDENCIA`: supervisa su dependencia en modo lectura.
- `CONTROL_INTERNO`: audita globalmente en modo lectura.

## Dependencias

Cada usuario debe quedar asociado a un `tenantId`. Esa dependencia controla qué radicados puede ver y gestionar.

El selector de dependencia usa únicamente el directorio oficial del sistema. No se deben escribir dependencias manualmente.

## Matriz UAT por Roles

La vista Administración incluye la sección **Matriz UAT por Roles** con:

- Nombre, correo, cargo, rol y dependencia.
- Tipo de usuario: `INSTITUCIONAL`, `UAT` o `PRUEBA`.
- Estado: activo, inactivo o archivado.
- Último acceso si está disponible.
- Filtros por tipo, estado, rol y dependencia.
- Acciones masivas seguras para marcar prueba, desactivar o archivar.

Use `INSTITUCIONAL` para usuarios reales de la Alcaldía. Use `UAT` para usuarios de prueba controlada por dependencia. Use `PRUEBA` para cuentas temporales técnicas.

## Reset password

El sistema no muestra enlaces de restablecimiento en pantalla. El ADMIN solicita el reset y el sistema envía el enlace al correo registrado, dejando evento `RESET_PASSWORD_SOLICITADO` en auditoría.

## Recomendaciones de operación

1. Crear primero usuarios de prueba por dependencia.
2. Validar login en computador y celular.
3. Confirmar que cada rol ve solo lo esperado.
4. Archivar cuentas de prueba antes de operación abierta.
5. No compartir contraseñas entre dependencias.

## Seguridad

No registrar credenciales, llaves de Firebase, claves SMTP ni tokens de IA en documentos, capturas o commits. Las variables sensibles deben permanecer en Vercel/Firebase y en `.env.local` fuera de Git.

## Operación segura de radicados

Las acciones críticas no deben hacerse editando Firestore manualmente. Usar siempre el dashboard:

- Asignar o trasladar radicados.
- Registrar devolución.
- Registrar prórroga.
- Resolver con respuesta oficial.

El dashboard ejecuta APIs internas que validan sesión, rol, dependencia y usuario activo. La colección legacy `radicados` está cerrada para nuevas escrituras; el flujo vigente opera sobre `ventanilla_radicados`.
