# Guía de Administrador

## Acceso

URL interna:

`https://ventanilla-simacota.vercel.app/interno/login`

El administrador ingresa con el correo institucional y contraseña asignada. Si la sesión expira, el sistema vuelve al login.

## Usuarios internos

Desde el módulo **Administración** el rol `ADMIN` puede:

- Crear usuarios.
- Editar nombre, cargo, dependencia y rol.
- Desactivar usuarios.
- Enviar restablecimiento de contraseña.
- Revisar auditoría administrativa.

Al desactivar un usuario, el sistema:

- Marca `users/{uid}.activo = false`.
- Deshabilita la cuenta en Firebase Auth.
- Revoca refresh tokens para cortar sesiones vigentes.
- Registra el evento en `admin_auditoria`.

## Roles

- `ADMIN`: visibilidad global y administración del sistema.
- `RECEPCIONISTA`: radica y asigna solicitudes; no administra usuarios.
- `FUNCIONARIO`: gestiona radicados de su dependencia.
- `JEFE_DEPENDENCIA`: supervisa su dependencia en modo lectura.
- `CONTROL_INTERNO`: audita globalmente en modo lectura.

## Dependencias

Cada usuario debe quedar asociado a un `tenantId`. Esa dependencia controla qué radicados puede ver y gestionar.

## Recomendaciones de operación

1. Crear primero usuarios de prueba por dependencia.
2. Validar login en computador y celular.
3. Confirmar que cada rol ve solo lo esperado.
4. Desactivar cuentas de prueba antes de operación abierta.
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
