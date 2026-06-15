# Ventanilla Única Digital — Preoperación Controlada

## Estado

**Producción técnica / preoperación controlada.**

## URL

https://ventanilla-simacota.vercel.app

## Alcance

El sistema puede usarse para pruebas internas con funcionarios y usuarios autorizados.

## Aclaración

Este sistema **no afecta** el sistema actual de la Alcaldía mientras:

1. No se redirija la URL oficial del municipio.
2. No se reemplace el enlace actual de PQRS (`www.simacota-santander.gov.co/peticiones-quejas-reclamos`).
3. No se cambien los DNS del dominio oficial.
4. No se conecte el formulario anterior al nuevo sistema.
5. No se desactive el sistema actual.
6. No se usen ciudadanos reales sin autorización.
7. No se hagan envíos masivos de correos.

## Correos institucionales

Los correos del directorio de dependencias (ej. `gobierno@simacota-santander.gov.co`) se usan exclusivamente para:

- Identificar dependencias en la UI y CSV.
- Mostrar datos de contacto al ciudadano en emails de respuesta.
- Registrar trazabilidad institucional.

**Durante la fase de pruebas:**
- Usar únicamente correos controlados del equipo.
- Si se envían correos de prueba, incluir en el asunto `[PRUEBA UAT]`.
- No enviar notificaciones a ciudadanos reales sin autorización.

## Funcionalidades validadas

- Radicación ciudadana.
- Radicación pública unificada con `ventanilla_radicados` mediante `POST /api/radicacion`.
- Asignación por dependencia.
- Responsable funcional MIPG (snapshot inmutable).
- Resolución por funcionario.
- Oficio PDF adjunto.
- Email SMTP — **4 flujos institucionales completos:**
  - Confirmación de radicación al ciudadano (template HTML institucional).
  - Respuesta oficial al ciudadano (template HTML institucional).
  - Alerta de vencimiento próximo al funcionario responsable.
  - Reset de contraseña al funcionario (template HTML institucional, sin exponer link).
- Trazabilidad de notificaciones: `NOTIFICACION_CORREO_ENVIADA` / `NOTIFICACION_CORREO_FALLIDA`.
- Trazabilidad append-only (subcollección inmutable).
- Roles institucionales (5 roles).
- Control Interno (solo lectura, visibilidad global).
- Jefe de Dependencia (solo lectura, su tenant).
- CSV MIPG de 25 columnas.
- Semáforos de cumplimiento de términos.
- Health endpoint (Firestore + Gemini).
- Clasificación IA (Gemini 2.5 Flash).
- Firebase Security Rules hardened.
- Firestore índices compuestos desplegados.
- Storage con signed URLs (15 min).
- 28 tests automatizados (Vitest).
- UAT-1 completa: 21/21 pasos (100%).

## Flujo vigente de radicación

Desde este refuerzo institucional, toda solicitud nueva creada en `/radicacion` entra al flujo moderno:

1. El ciudadano diligencia `/radicacion`.
2. El navegador envía `multipart/form-data` a `POST /api/radicacion`.
3. El servidor usa Firebase Admin SDK para generar el consecutivo oficial `1-WEB-AAAA-########`.
4. Los anexos se guardan en Storage bajo `radicados/{radicadoId}/...`.
5. El documento principal se crea en `ventanilla_radicados`.
6. La trazabilidad inicial se crea en `ventanilla_radicados/{radicadoId}/trazabilidad`.
7. El dashboard interno, SIMI, CSV MIPG y consulta ciudadana operan sobre ese radicado.

La colección `radicados` queda únicamente para compatibilidad temporal de consultas históricas.
Las reglas de Firestore bloquean nuevas escrituras en esa colección legacy.

## Cierre de seguridad go-live

- Las acciones críticas de asignación, devolución, prórroga y resolución pasan por APIs server-side.
- El dashboard no debe modificar directamente `ventanilla_radicados` para cambios de estado o respuesta.
- `cumplioTermino` se calcula únicamente al resolver por backend y queda como evidencia MIPG inmutable.
- Los usuarios inactivos no pueden iniciar sesión, entrar al dashboard ni operar APIs internas.
- Los usuarios archivados tampoco pueden iniciar sesión ni operar APIs; se conservan solo por auditoría.
- Al desactivar un usuario, se deshabilita en Firebase Auth y se revocan sus refresh tokens.
- Al archivar un usuario, se desactiva, se revoca sesión y se oculta de listados normales.
- La radicación pública no escribe en Firestore ni Storage desde el cliente; todo pasa por `POST /api/radicacion`.
- La subida pública anónima directa a Storage está bloqueada.

## Preparación UAT por dependencias

- Crear usuarios reales como `INSTITUCIONAL`.
- Crear usuarios de prueba controlada como `UAT`.
- Marcar cuentas temporales técnicas como `PRUEBA`.
- Mantener roles cerrados: `ADMIN`, `RECEPCIONISTA`, `FUNCIONARIO`, `JEFE_DEPENDENCIA`, `CONTROL_INTERNO`.
- Mantener dependencias cerradas usando el directorio oficial.
- Archivar usuarios de prueba cuando termine la validación para preservar auditoría sin permitir acceso.

## Pendientes antes de publicación oficial

1. **Configurar SMTP definitivo institucional:**
   - Cuenta: `notificaciones@simacota-santander.gov.co`
   - Requiere: 2FA activado + App Password de Gmail
   - Actualizar `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` en Vercel

2. **Configurar observabilidad (Sentry):**
   - `SENTRY_DSN` en Vercel (servidor)
   - `NEXT_PUBLIC_SENTRY_DSN` en Vercel (cliente)
   - La integración ya está en el código — solo falta el DSN

3. **Desactivar cuentas de prueba UAT:**
   - `recepcionista.test@simacota.gov.co`
   - `funcionario.test@simacota.gov.co`
   - `jefe.test@simacota.gov.co`
   - `controlinterno.test@simacota.gov.co`
   - Archivar desde Administración para revocar acceso y conservar auditoría.

4. **Coordinar redirección oficial:**
   - Origen: `www.simacota-santander.gov.co/peticiones-quejas-reclamos`
   - Destino: `https://ventanilla-simacota.vercel.app/radicacion`
   - Requiere coordinación con el administrador del sitio web del municipio

5. **Capacitar funcionarios:**
   - Recepcionistas: flujo de radicación + asignación
   - Funcionarios: resolución + adjunto de oficio
   - Jefes de Dependencia: visualización y supervisión
   - Control Interno: auditoría, CSV MIPG, semáforos

6. **Documentar procedimiento operativo estándar:**
   - Guía de usuario por rol
   - Procedimiento de escalamiento
   - SLA por tipo de solicitud

7. **Definir fecha oficial de go-live institucional.**

## Recomendación

Continuar pruebas controladas con el equipo interno antes de anunciar el sistema masivamente a la ciudadanía. El sistema está técnicamente listo; los pendientes son de configuración institucional y coordinación administrativa.

---

*Documento generado el 2026-05-31 — Ventanilla Única Digital, Alcaldía de Simacota, Santander*
