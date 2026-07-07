# Checklist de arranque a producción — Ventanilla Única Simacota

> Guía práctica para el primer día real de operación. Nace de la auditoría de
> seguridad y producción del 2026-07-07. Marca cada casilla antes de abrir el
> sistema a usuarios reales.
>
> **Estado de la auditoría:** los tres riesgos reales (costos de IA, revocación
> de sesión, fuga de errores) están **cerrados y en producción**. La base ya era
> sólida (reglas bloqueadas, sin secretos, 0 vulnerabilidades de dependencias,
> escape de HTML en correos, descargas protegidas H-01). Lo que falta no es
> código: es configuración de despliegue, respaldo y **validación con usuarios
> reales**.

---

## 1. Variables de entorno en Vercel (entorno *Production*)

Verifica una por una que estén en **Production**, no solo en Preview.

### Imprescindibles — sin estas algo se cae o degrada

| Variable | Para qué | Si falta… |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK (toda escritura server) | El sistema no funciona |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Cliente Firebase / login | No hay login |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Login | No hay login |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Cliente Firebase | No hay login |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Adjuntos en el cliente | Fallan subidas |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Cliente Firebase | Config incompleta |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Cliente Firebase | Config incompleta |
| `FIREBASE_STORAGE_BUCKET` | Adjuntos, sellos, oficios PDF (server) | Fallan las subidas |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | Correos al ciudadano | **El ciudadano nunca recibe respuesta** |
| `CONSULTA_HASH_SECRET` | Hash de IP en consulta pública y rate-limit de IA | Cae a un valor por defecto débil |
| `CRON_SECRET` | Protege el cron de alertas | El cron queda expuesto |
| `GEMINI_API_KEY` | SIMI | SIMI cae a modo mock (no cita normas) |

### Recomendadas

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Refuerza el control de origen de los endpoints de IA (sin ella, igual funciona el chequeo de mismo-host) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Ver errores en producción (el scrubbing de PII ya está configurado) |
| `AI_RATE_CHAT_MINUTO` / `AI_RATE_CLASSIFY_MINUTO` / `AI_RATE_SCANDOC_MINUTO` | Ajustar los topes del rate-limit de IA (tienen defaults sanos: 10/15/5 por minuto) |

### Solo si se activan funciones opcionales

- `WHATSAPP_PROVIDER` / `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` — solo si se habilita el aviso por WhatsApp (hoy no implementado).
- `DIGITAL_SIGNATURE_PROVIDER` — solo si se usa firma digital.

- [ ] Todas las **imprescindibles** configuradas en Production.
- [ ] Las **recomendadas** revisadas.

---

## 2. Base de datos y reglas

- [ ] `firestore.rules` desplegadas al proyecto (`ventanilla-unica-f31b1`).
- [ ] `storage.rules` desplegadas (incluyen la ruta `salidas/` de los oficios PDF).
- [ ] **Backup antes de abrir**: `gcloud firestore export` — y definir cadencia (diaria o semanal).
- [x] Normograma núcleo cargado (12 normas citables) — hecho el 2026-07-07.

---

## 3. Cron y tareas programadas

- [ ] Confirmar que corre el cron de alertas: `vercel.json` → `/api/cron/alertas-vencimiento` (lun–vie 12:00 UTC = 7 a.m. Colombia).
- [ ] Decidir el segundo cron `/api/cron/simi/alertas-vencimiento` — existe pero **no está agendado**: agéndalo o quítalo.

---

## 4. Verificaciones funcionales del primer día

- [ ] Radicar un caso real de prueba de punta a punta: radicar → dirigir → responder → correo al ciudadano → consulta pública.
- [ ] Confirmar que el correo **llega de verdad** (revisar spam) — el eslabón que más falla.
- [ ] Probar **cerrar sesión**: debe bloquear de inmediato en todas partes.
- [ ] Abrir SIMI en un radicado y confirmar que **cita una norma real** (ya no "sin contexto validado").
- [ ] Imprimir un sello de recibido y un oficio de salida — verificar el escudo y el formato.

---

## 5. Validación humana (lo más importante)

- [ ] **Ratificación jurídica** de las 12 normas — un abogado revisa la base cargada (puede ajustar el estado de cualquiera).
- [ ] **Sesión con Laura y un funcionario** antes de soltar el sistema — media hora viéndolos usarlo.
- [ ] Definir quién es el **ADMIN** y crear los usuarios reales por dependencia.

---

## 6. Limpieza pendiente (no bloquea el piloto interno; sí antes del público general)

- [ ] Bloquear el endpoint `/api/simi/test/e2e` en producción (gate por `NODE_ENV`).
- [ ] Agendar o eliminar el segundo cron (ver sección 3).
- [ ] Aumentar cobertura de tests en la capa de endpoints (hoy los helpers puros están bien probados; los guards de auth/validación de las rutas, poco).
- [ ] Consolidar los ~20 guards de sesión duplicados en un helper único.
- [ ] Borrar ramas viejas sin fusionar (`chore/uat-hardening-*`, `feat/seguridad-h10-aislamiento-*`).
- [ ] Antes de abrir el chat / radicación pública al tráfico de internet: considerar un **escaneo de seguridad externo** automatizado.

---

## Lectura de conjunto

- **Secciones 1 + 2 completas y sección 4 verificada** → listo para un **piloto interno controlado** con Laura.
- **Sección 5** → convierte "funciona en mis pruebas" en "funciona en la alcaldía".
- **Sección 6** → cerrar antes de abrirlo al público general.

> Una auditoría no es un certificado: reduce el riesgo conocido, no garantiza cero
> fallos. La mayoría de problemas reales aparecen con uso y datos reales — por eso
> la sección 5 es la más importante.
