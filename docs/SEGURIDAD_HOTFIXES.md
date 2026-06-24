# Bitácora de hotfixes de seguridad

Este documento registra las correcciones aplicadas a los hallazgos del informe
[Auditoría integral](AUDITORIA_SEGURIDAD_DATOS_ESCALABILIDAD.md). Sirve como
historial vivo del avance hacia el go-live.

---

## H-01 — Descarga de adjuntos protegida por rol y dependencia

**Estado:** ✅ Corregido — Sprint Seguridad P1-01.
**Severidad original:** P1 — Alto.
**Archivos:**
- `lib/seguridad/autorizar-descarga-archivo.ts` *(nuevo, helper puro)*
- `app/api/interno/archivo/route.ts` *(reescrito)*
- `__tests__/autorizar-descarga-archivo.test.ts` *(nuevo)*

### Qué se hizo

Se agregó validación de **pertenencia del archivo al radicado** y **control de
acceso por rol y dependencia** antes de generar URL firmada de descarga.

Cadena de validaciones aplicada por el endpoint:

1. **Sesión interna activa** vía `requireActiveInternalUser()` (cookie + revocación + usuario activo).
2. **Path estructuralmente válido** (prefijo permitido — `radicados/` o
   `respuestas/` — sin `..`, sin `/` inicial, sin doble barra, sin caracteres
   de control, alfabeto restringido).
3. **Identificación del radicado** a partir del path y lectura del documento en
   `ventanilla_radicados/{id}`.
4. **Pertenencia del archivo al radicado**:
   - Para `radicados/...` debe aparecer en `radicado.archivos[].path`.
   - Para `respuestas/...` debe coincidir con `radicado.respuestaOficial.archivoPath`.
5. **Permiso institucional**:
   - `ADMIN`, `RECEPCIONISTA`, `CONTROL_INTERNO` → acceso global.
   - `FUNCIONARIO`, `JEFE_DEPENDENCIA` → solo si
     `usuario.tenantId === radicado.clasificacion.oficinaDestino`.
6. **Firma de URL** (TTL 15 min) **solo** si todas las validaciones pasan.

### Respuestas humanas y seguras

| Código | Cuándo | Mensaje |
|--------|--------|---------|
| `400` | Path vacío, no string, con `..`, prefijo no permitido, etc. | `La ruta del archivo no es válida.` |
| `401` | Sin sesión o sesión expirada | `Debe iniciar sesión nuevamente.` |
| `403` | Funcionario/Jefe de otra dependencia | `No tiene permiso para descargar este archivo.` |
| `404` | Radicado inexistente **o** archivo no registrado en el radicado (mensaje uniforme para no revelar existencia) | `Archivo no encontrado.` |
| `500` | Falla interna | `No fue posible generar la descarga. Intente nuevamente.` |

Nunca se devuelve: el `path` completo, el `bucket`, stack traces ni UIDs.

### Auditoría / trazabilidad

Cada decisión queda en consola estructurada:

- `ARCHIVO_DESCARGA_AUTORIZADA` — `console.info` con
  `{ radicadoId, tipo, actorRol, actorTenant, timestamp }`.
- `ARCHIVO_DESCARGA_DENEGADA` — `console.warn` con
  `{ radicadoId, motivo, actorRol, actorTenant, prefijo, timestamp }`.

No se registra la URL firmada, el path completo ni datos personales.

### Tests

`__tests__/autorizar-descarga-archivo.test.ts` cubre los 13 casos exigidos:

1. ADMIN descarga cualquier dependencia.
2. RECEPCIONISTA descarga cualquier dependencia.
3. CONTROL_INTERNO descarga cualquier dependencia.
4. FUNCIONARIO descarga su dependencia.
5. FUNCIONARIO **no** descarga otra dependencia (403, sin filtrar path).
6. JEFE_DEPENDENCIA descarga su dependencia.
7. JEFE_DEPENDENCIA **no** descarga otra dependencia (403).
8. Sin sesión → 401.
9. Path vacío/inválido → 400.
10. Path con `../` → 400, mensaje sin filtrar detalle.
11. Path no registrado en el radicado → 404 con mensaje uniforme.
12. Respuesta oficial solo si coincide con `archivoPath`.
13. Mensajes de error sin path, sin bucket, sin stack.

Más casos extra: parser rechaza prefijos no permitidos, doble barra,
segmentos extra y caracteres de control; helper `aRadicadoParaDescarga`
extrae adjuntos válidos del documento de Firestore.

### Resumen ejecutivo

> Se agregó validación de pertenencia del archivo al radicado y control de
> acceso por rol/dependencia antes de generar URL firmada. Un funcionario
> de una dependencia ya no puede descargar adjuntos de otra dependencia ni
> de solicitudes anónimas o reservadas que no le correspondan.

---

## H-03 — Consulta pública protegida

**Estado:** 🟡 Implementado — pendiente aprobación UAT de Seguridad P1-03.
**Severidad original:** P1 — Alto.

### Inventario y flujo anterior

| Componente | Flujo anterior | Riesgo encontrado | Flujo seguro |
|---|---|---|---|
| `/consulta` | Enviaba solo el número a `GET /api/consulta/[id]` y hacía búsqueda automática desde `?id=` | Enumeración directa | Solicita número + dato de verificación y usa POST |
| `GET /api/consulta/[radicadoId]` | Devolvía estado, dependencia, trazabilidad y respuesta sin segundo factor ni límite | IDOR público enumerable | Retirado con `410 Gone` y `Cache-Control: no-store` |
| `GET /api/public/radicado/consulta` | Verificación documental opcional en query string y límite en memoria | Confirmaba existencia y filtraba el dato por URL | GET responde `405`; POST es la única ruta canónica |
| Constancia y enlaces | Incluían `/consulta?id={radicado}` | El número precargado disparaba la consulta | Solo precargan el número; nunca el dato de verificación |
| E2E SIMI | Consultaba el GET heredado | Conservaba una dependencia insegura | Usa POST canónico con segundo factor |
| PDF de firma | Aceptaba radicado/verificación en URL y permitía anónimos/reservados sin segundo factor | Fuga por URL y bypass alternativo | Acceso público directo cerrado; solo sesión interna autorizada |

El canal web almacena correo cuando el ciudadano lo registra, pero hoy no
captura documento (`numeroDocumento` queda vacío). Por eso el correo es el
método normal para solicitudes identificadas del portal. Los radicados creados
por otros canales pueden usar los últimos cuatro dígitos cuando exista un
documento válido.

### Controles implementados

- Verificación obligatoria y centralizada en
  `lib/seguridad/consulta-publica-radicado.ts`.
- Correo normalizado (`trim` + minúsculas), documento por últimos cuatro
  dígitos y código de consulta mediante SHA-256/comparación constante.
- Nuevas solicitudes sin correo —incluidas las anónimas— reciben un código
  aleatorio de 256 bits una sola vez; Firestore guarda únicamente
  `consultaTokenHash`.
- Respuesta pública construida por lista positiva. Nunca propaga PII, UIDs,
  rutas de Storage, adjuntos, comentarios internos ni auditoría privada.
- Anónimos y reservados omiten además la dependencia en la respuesta pública.
- Mensaje y código uniformes para formato inválido, inexistente, dato erróneo o
  expediente sin método de verificación.
- Rate limit compartido en `seguridad_rate_limits`: IP/minuto, radicado/hora,
  combinación IP+radicado y bloqueo progresivo por fallos. IP y radicado se
  guardan solo como HMAC SHA-256. El respaldo local se usa únicamente si falla
  el contador compartido.
- Auditoría agregada por ventanas de cinco minutos en
  `seguridad_consultas_auditoria`, sin correo, documento, token, IP completa ni
  contenido del expediente.
- `Cache-Control: no-store, no-cache, must-revalidate` y `Pragma: no-cache` en
  todas las respuestas de consulta.

### Compatibilidad

| Tipo de radicado | Método de verificación | Consulta pública | Acción |
|---|---|---:|---|
| Identificado con correo | Correo exacto normalizado | Sí | Sin migración |
| Identificado con documento válido | Últimos 4 dígitos | Sí | Sin migración |
| Identificado sin correo/documento, nuevo | Código aleatorio | Sí | Hash generado al radicar |
| Anónimo nuevo | Código aleatorio | Sí | Mostrar código una sola vez en constancia |
| Anónimo histórico sin código | Ninguno confiable | No | Orientar a Ventanilla Única; sin bypass |
| Legacy `EXT-*` | No normalizado | No | Orientar a Ventanilla Única hasta migración aprobada |
| Reservado | Correo/documento/código disponible | Sí, sanitizada | Ocultar identidad y dependencia |

No se modifican datos históricos. Cualquier migración futura exige script,
`dry run`, respaldo y aprobación explícita.

### Operación

Los límites se configuran mediante `CONSULTA_RATE_IP_MINUTO`,
`CONSULTA_RATE_RADICADO_HORA`, `CONSULTA_RATE_COMBINACION_MINUTO`,
`CONSULTA_RATE_FALLOS_RADICADO` y `CONSULTA_RATE_BLOQUEO_MINUTOS`.
`CONSULTA_HASH_SECRET` es recomendado; si no existe, el servidor utiliza la
credencial Firebase ya configurada como clave HMAC sin exponerla.

Configurar políticas TTL de Firestore sobre `expiresAt` para
`seguridad_rate_limits` y `seguridad_consultas_auditoria`. El código ya escribe
la fecha de expiración, pero la activación de TTL es una operación de
infraestructura y no debe ejecutarse automáticamente desde la aplicación.

La guía manual está en `docs/UAT_SEGURIDAD_H03_CONSULTA_PUBLICA.md`. Este
hallazgo solo debe pasar a ✅ Corregido después de aprobarla.

### Validación técnica ejecutada

- `npx tsc --noEmit`: aprobado.
- `npm run lint`: aprobado.
- `npm run test`: 19 archivos y 235 pruebas aprobadas.
- Pruebas específicas H-03 y sanitización: 34 aprobadas.
- `npm run build`: aprobado con Next.js 16.2.6.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- Revisión responsive: escritorio y 390 px sin desbordamiento horizontal; el
  dato de verificación no aparece en URL ni en logs del navegador.
- Búsqueda de secretos: solo variables/placeholders documentales ya existentes;
  no se añadieron credenciales.
