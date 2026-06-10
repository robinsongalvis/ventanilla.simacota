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
