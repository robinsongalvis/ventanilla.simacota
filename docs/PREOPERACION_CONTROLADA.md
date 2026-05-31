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
- Asignación por dependencia.
- Responsable funcional MIPG (snapshot inmutable).
- Resolución por funcionario.
- Oficio PDF adjunto.
- Email SMTP (Gmail App Password verificado).
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
- 15 tests automatizados (Vitest).
- UAT-1 completa: 21/21 pasos (100%).

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
   - Desactivar vía Firebase Console o Admin SDK

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
