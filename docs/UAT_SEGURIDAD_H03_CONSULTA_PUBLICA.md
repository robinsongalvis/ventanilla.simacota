# UAT Seguridad H-03 — Consulta pública de radicados

**Entorno autorizado:** local o Preview. No ejecutar enumeración agresiva en
producción.

**Estado:** Pendiente de ejecución y aprobación funcional.

## Preparación

Crear o identificar datos controlados para estos perfiles:

1. Radicado identificado con correo.
2. Radicado con documento válido.
3. Solicitud anónima nueva con código de consulta.
4. Solicitud anónima histórica sin código.
5. Solicitud reservada.
6. Radicado resuelto con respuesta oficial.

No anexar datos personales reales a la evidencia. En capturas, enmascarar el
dato de verificación.

## Matriz de pruebas

| Caso | Acción | Resultado esperado | Resultado obtenido | Evidencia | Estado |
|---|---|---|---|---|---|
| H03-01 | Correo correcto | Muestra el radicado sanitizado | Pendiente | Pendiente | ⬜ |
| H03-02 | Correo con espacios/mayúsculas | Autoriza tras normalizar | Pendiente | Pendiente | ⬜ |
| H03-03 | Correo incorrecto | Mensaje uniforme, sin confirmar existencia | Pendiente | Pendiente | ⬜ |
| H03-04 | Últimos 4 del documento correctos | Muestra el radicado sanitizado | Pendiente | Pendiente | ⬜ |
| H03-05 | Documento incorrecto | Mismo mensaje que H03-03 | Pendiente | Pendiente | ⬜ |
| H03-06 | Anónimo nuevo + código correcto | Autoriza sin identidad/dependencia | Pendiente | Pendiente | ⬜ |
| H03-07 | Anónimo nuevo + código incorrecto | Mensaje uniforme | Pendiente | Pendiente | ⬜ |
| H03-08 | Anónimo histórico sin código | Mensaje uniforme + orientación a Ventanilla | Pendiente | Pendiente | ⬜ |
| H03-09 | Reservado verificado | Sin identidad, PII, dependencia, UID ni rutas | Pendiente | Pendiente | ⬜ |
| H03-10 | Número inexistente | Mismo mensaje que dato incorrecto | Pendiente | Pendiente | ⬜ |
| H03-11 | Sin dato de verificación | No consulta; foco en campo obligatorio | Pendiente | Pendiente | ⬜ |
| H03-12 | `GET /api/consulta/{id}` | `410`, sin datos del radicado | Pendiente | Pendiente | ⬜ |
| H03-13 | GET canónico con query de correo/token | `405`, sin datos | Pendiente | Pendiente | ⬜ |
| H03-14 | Cinco intentos/min por IP | Dentro del límite funcionan | Pendiente | Pendiente | ⬜ |
| H03-15 | Intento posterior al límite | `429` + `Retry-After` | Pendiente | Pendiente | ⬜ |
| H03-16 | Cinco verificaciones fallidas del radicado | Bloqueo temporal progresivo | Pendiente | Pendiente | ⬜ |
| H03-17 | Diez números consecutivos controlados | No permite enumerar; activa límite | Pendiente | Pendiente | ⬜ |
| H03-18 | Revisar respuesta HTTP | `Cache-Control: no-store` y `Pragma: no-cache` | Pendiente | Pendiente | ⬜ |
| H03-19 | Revisar auditoría | Solo hashes/motivo/conteo; sin PII | Pendiente | Pendiente | ⬜ |
| H03-20 | Revisar móvil | Formulario y resultado legibles, sin scroll lateral | Pendiente | Pendiente | ⬜ |
| H03-21 | Tres intentos fallidos en UI | Limpia el dato de verificación | Pendiente | Pendiente | ⬜ |
| H03-22 | Copiar enlace | Incluye solo número, nunca segundo factor | Pendiente | Pendiente | ⬜ |

## Inspección de privacidad

En DevTools, confirmar que el body de POST contiene el dato únicamente durante
la petición y que no aparece en URL, historial, `localStorage`,
`sessionStorage`, headers personalizados, consola ni analytics.

Buscar en el JSON autorizado y confirmar ausencia de:

- nombre, correo, teléfono, dirección y documento;
- `actorUid`, `responsableUid`, `archivoPath`, `storagePath`, `bucket`;
- comentarios/observaciones internas, claims, prompts, auditorías y alertas;
- dependencia para solicitudes anónimas o reservadas.

## Cierre

| Rol aprobador | Nombre | Fecha | Veredicto | Firma/evidencia |
|---|---|---|---|---|
| Seguridad / técnico | Pendiente | Pendiente | Pendiente | Pendiente |
| Ventanilla Única | Pendiente | Pendiente | Pendiente | Pendiente |
| Responsable UAT | Pendiente | Pendiente | Pendiente | Pendiente |

Cuando todos los casos estén aprobados, actualizar H-03 a
`✅ Corregido — Sprint Seguridad P1-03` en la auditoría y la bitácora.
