# Matriz UAT Institucional Final por Roles
## Ventanilla Única Digital · Alcaldía Municipal de Simacota

**Fecha de inicio:** _____________ · **Responsable global:** _____________
**Branch deployada:** `claude/serene-borg-41378d` (commit `6e4425b`) · **URL:** https://ventanilla-simacota.vercel.app

---

## Pre-requisitos antes de ejecutar la matriz

| # | Pre-requisito | Estado | Verificado por | Fecha |
|---|---|:-:|---|---|
| P-1 | PR del sprint de notificaciones mergeado a `main` | ☐ | | |
| P-2 | Deploy productivo exitoso en Vercel sobre `main` | ☐ | | |
| P-3 | `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` configurados en Vercel (Production) | ☐ | | |
| P-4 | `EMAIL_PASS` marcado como **Sensitive** en Vercel | ☐ | | |
| P-5 | Redeploy posterior a configurar variables | ☐ | | |
| P-6 | Sentry sin errores críticos en las últimas 24h | ☐ | | |
| P-7 | SPF / DKIM del dominio `simacota-santander.gov.co` verificados (mxtoolbox) | ☐ | | |

> [!IMPORTANT]
> Si algún pre-requisito está ☐, NO iniciar la matriz. Hallazgos previos del audit estático: branch no mergeado, `EMAIL_PASS` pendiente.

---

## Hallazgo bloqueante conocido — Fase 11 — **RESUELTO**

> ✅ Corregido en commit posterior. Los endpoints `/api/consulta/[radicadoId]` y `/api/public/radicado/consulta` ahora exponen `respuestaOficial: { nota, fecha, dependenciaNombre, tieneArchivo }` cuando el radicado está `RESUELTO` y tiene `respuestaOficial.nota` válida, vía el sanitizador `lib/server/respuesta-publica.ts`. NO se exponen `actorUid`, `actorNombre`, ni `archivoPath`. La UI de `/consulta` renderiza el bloque institucional. Verificable en Fase 11.4.

---

## Usuarios UAT requeridos

Crear desde **Administración → Usuarios** antes de ejecutar las fases 4-10:

| Rol | Email | Nombre sugerido | Dependencia | tipoUsuario |
|---|---|---|---|---|
| ADMIN | `admin.uat@simacota.gov.co` | Admin UAT | VENTANILLA_UNICA | UAT |
| RECEPCIONISTA | `recepcion.uat@simacota.gov.co` | Recepción UAT | VENTANILLA_UNICA | UAT |
| FUNCIONARIO | `funcionario.gobierno.uat@simacota.gov.co` | Funcionario UAT Gobierno | SEC_GOBIERNO | UAT |
| FUNCIONARIO | `funcionario.planeacion.uat@simacota.gov.co` | Funcionario UAT Planeación | SEC_PLANEACION | UAT |
| JEFE_DEPENDENCIA | `jefe.gobierno.uat@simacota.gov.co` | Jefe UAT Gobierno | SEC_GOBIERNO | UAT |
| CONTROL_INTERNO | `controlinterno.uat@simacota.gov.co` | Control Interno UAT | VENTANILLA_UNICA | UAT |

Todos deben quedar con `activo: true`. Después de la UAT, archivar para conservar auditoría.

---

## Leyenda de estados

| Estado | Símbolo | Significado |
|---|:-:|---|
| APROBADO | ✅ | Resultado obtenido = resultado esperado |
| APROBADO CON OBSERVACIÓN | 🟡 | Funciona pero hay un detalle a documentar |
| FALLIDO | ❌ | Resultado obtenido ≠ resultado esperado o error crítico |
| PENDIENTE | ⏳ | No ejecutado todavía |
| BLOQUEADO | 🚫 | No puede ejecutarse por pre-requisito faltante |

---

## Fase 3 — Ciudadano (radicación pública)

**Datos de prueba:**
- Tipo: Petición de información · Nombre: Robinson David Galvis · CC: 1101321226
- Correo: davidgalvis1519@gmail.com · Canal: Correo
- Asunto: `Prueba UAT institucional por roles`

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 3.1 | Diligenciar formulario en `/radicacion` | Validación OK, botón habilitado | | ⏳ | | | | |
| 3.2 | Enviar | Consecutivo generado `1-WEB-AAAA-########` | | ⏳ | | | | |
| 3.3 | Pantalla de constancia | Muestra radicadoId + fecha + dependencia receptora | | ⏳ | | | | |
| 3.4 | Bandeja Gmail del ciudadano | Correo "Radicado X confirmado" recibido < 60s | | ⏳ | | | | |
| 3.5 | Firestore `ventanilla_radicados/{id}` | Documento existe con `estadoActual: PENDIENTE` | | ⏳ | | | | |
| 3.6 | Subcolección trazabilidad | Evento `RADICACION` presente | | ⏳ | | | | |
| 3.7 | Subcolección trazabilidad | Evento `NOTIFICACION_CORREO_ENVIADA` con `tipoNotificacion: RADICACION` | | ⏳ | | | | |
| 3.8 | Dashboard interno | Radicado aparece en tablero general | | ⏳ | | | | |

---

## Fase 4 — Recepcionista (asignación)

Sesión: `recepcion.uat@simacota.gov.co`

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 4.1 | Login | Sesión válida + dashboard se carga | | ⏳ | | | | |
| 4.2 | Ver radicado de la fase 3 | Visible en tablero/bandeja | | ⏳ | | | | |
| 4.3 | Abrir Panel Derecho del radicado | Datos visibles + tabs Información/Traslado/Trazabilidad/Respuesta | | ⏳ | | | | |
| 4.4 | Tab Traslado → asignar a SEC_GOBIERNO con responsable funcional | Mensaje "Operación guardada", `estadoActual: ASIGNADO` | | ⏳ | | | | |
| 4.5 | Correo de asignación al ciudadano | Recibido en Gmail con dependencia destino | | ⏳ | | | | |
| 4.6 | Trazabilidad | Evento `ASIGNACION` + `NOTIFICACION_CORREO_ENVIADA / ASIGNACION` | | ⏳ | | | | |
| 4.7 | Intentar ir a "Administración" en sidebar | Opción NO visible | | ⏳ | | | | |
| 4.8 | `POST /api/admin/usuarios` desde devtools (con sesión recepcionista) | 403 Forbidden | | ⏳ | | | | |

---

## Fase 5 — Funcionario Secretaría de Gobierno (respuesta oficial)

Sesión: `funcionario.gobierno.uat@simacota.gov.co`

**Texto de respuesta sugerido** (copiar tal cual al textarea):
```
Cordial saludo,

En atención a la solicitud radicada en la Ventanilla Única Digital de la
Alcaldía Municipal de Simacota, nos permitimos informar que el presente
trámite corresponde a una prueba institucional controlada del sistema.

Se valida que la solicitud fue recibida correctamente, asignada a la
dependencia competente y gestionada dentro del flujo interno de la
plataforma.

De esta manera, se deja constancia de la prueba satisfactoria del
proceso de respuesta oficial, trazabilidad, notificación al ciudadano y
control MIPG.

Atentamente,
Secretaría de Gobierno
Alcaldía Municipal de Simacota
```

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 5.1 | Login | Dashboard se carga filtrado a SEC_GOBIERNO | | ⏳ | | | | |
| 5.2 | Ver radicado UAT | Visible (asignado a su tenant) | | ⏳ | | | | |
| 5.3 | Buscar radicado de Planeación (otro tenant) | NO visible | | ⏳ | | | | |
| 5.4 | Tab Respuesta → escribir nota sugerida (sin PDF) → resolver | `estadoActual: RESUELTO`, `cumplioTermino: true` | | ⏳ | | | | |
| 5.5 | Verificar `respuestaOficial.nota` persistida sin archivo | Nota presente, `archivoPath: null`, `archivoNombre: null` | | ⏳ | | | | |
| 5.6 | Correo de respuesta al ciudadano | Recibido en Gmail | | ⏳ | | | | |
| 5.7 | Trazabilidad | `RESPUESTA_FUNCIONARIO` + `NOTIFICACION_CORREO_ENVIADA / RESPUESTA_OFICIAL` | | ⏳ | | | | |

---

## Fase 6 — Jefe de Dependencia (solo lectura)

Sesión: `jefe.gobierno.uat@simacota.gov.co`

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 6.1 | Login | Dashboard se carga | | ⏳ | | | | |
| 6.2 | Ver radicado UAT | Visible | | ⏳ | | | | |
| 6.3 | Trazabilidad completa visible | Todos los eventos listados | | ⏳ | | | | |
| 6.4 | Botones de Asignar/Devolver/Prorrogar/Responder | Visibles pero **deshabilitados** con tooltip "Tu rol no permite realizar acciones" | | ⏳ | | | | |
| 6.5 | `POST /api/radicados/{id}/asignar` desde devtools | 403 Forbidden | | ⏳ | | | | |
| 6.6 | Sidebar "Administración" | NO visible | | ⏳ | | | | |
| 6.7 | Sidebar "Aprobaciones" | Visible (rol tiene acceso) | | ⏳ | | | | |

---

## Fase 7 — Control Interno (auditoría global)

Sesión: `controlinterno.uat@simacota.gov.co`

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 7.1 | Login | Dashboard se carga sin filtro de tenant | | ⏳ | | | | |
| 7.2 | Ver radicados de SEC_GOBIERNO y SEC_PLANEACION simultáneamente | Ambos visibles | | ⏳ | | | | |
| 7.3 | Semáforos PQRSD visibles | Sí | | ⏳ | | | | |
| 7.4 | Exportar CSV MIPG | Descarga archivo con 25 columnas, fila del radicado UAT con `cumplioTermino: true` y respuesta presente | | ⏳ | | | | |
| 7.5 | Acceso a vista "Control Interno" | Sí | | ⏳ | | | | |
| 7.6 | Intentar resolver/asignar | Botones deshabilitados (soloLectura) + API 403 | | ⏳ | | | | |
| 7.7 | Sidebar "Administración" | NO visible | | ⏳ | | | | |

---

## Fase 8 — Admin (administración de usuarios)

Sesión: `admin.uat@simacota.gov.co`

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 8.1 | Crear usuario test `temp.uat@simacota.gov.co` rol FUNCIONARIO | Usuario creado en Auth + Firestore | | ⏳ | | | | |
| 8.2 | Editar nombre del usuario | Cambio persiste, auditoría `USUARIO_EDITADO` | | ⏳ | | | | |
| 8.3 | Solicitar reset password | API responde `ok: true`, NO expone link en UI, correo recibido | | ⏳ | | | | |
| 8.4 | Auditoría `RESET_PASSWORD_SOLICITADO` | Presente en `admin_auditoria` | | ⏳ | | | | |
| 8.5 | Desactivar usuario | `activo: false` + refresh tokens revocados | | ⏳ | | | | |
| 8.6 | Login con usuario desactivado | Bloqueado | | ⏳ | | | | |
| 8.7 | Archivar usuario | `archivado: true`, ya no aparece en listado normal | | ⏳ | | | | |
| 8.8 | Login con usuario archivado | Bloqueado | | ⏳ | | | | |

---

## Fase 9 — Privacidad (anónimo / reservado)

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 9.1 | Crear radicado con `tipoPresentacion: ANONIMA` y correo válido en el formulario | Radicado se crea, NO se envía correo de confirmación | | ⏳ | | | | |
| 9.2 | Trazabilidad del anónimo | NO existe evento `NOTIFICACION_CORREO_ENVIADA` | | ⏳ | | | | |
| 9.3 | Consultar el radicado anónimo desde `/consulta` (sin verificación) | Permite consulta básica sin pedir cédula | | ⏳ | | | | |
| 9.4 | Payload de consulta pública | NO incluye nombre/email del solicitante | | ⏳ | | | | |
| 9.5 | Crear radicado con `tipoPresentacion: RESERVADA` | Dashboard muestra identidad solo a roles autorizados | | ⏳ | | | | |
| 9.6 | CSV MIPG con anónimos | Columnas de identidad enmascaradas/vacías | | ⏳ | | | | |
| 9.7 | Asignar radicado anónimo | NO se envía correo de asignación (regla privacidad) | | ⏳ | | | | |

---

## Fase 10 — Notificaciones fallidas

> Simulación recomendada: temporalmente cambiar `EMAIL_PASS` a un valor inválido en Vercel y hacer redeploy. Crear un radicado de prueba con correo válido para forzar el fallo. **Restaurar inmediatamente al terminar.**

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 10.1 | Crear radicado con SMTP roto | Radicado se guarda igual + respuesta API `emailEnviado: false` | | ⏳ | | | | |
| 10.2 | Trazabilidad del radicado | Evento `NOTIFICACION_CORREO_FALLIDA / RADICACION` con `metadata.error` | | ⏳ | | | | |
| 10.3 | Documento raíz | Flag `alertaNotificacionFallida: true` | | ⏳ | | | | |
| 10.4 | Sidebar dashboard | Pill rojo "Correos fallidos (1)" visible | | ⏳ | | | | |
| 10.5 | Abrir radicado en PanelDerecho | Banner rojo "Correo fallido" con email afectado | | ⏳ | | | | |
| 10.6 | Botón "Marcar gestionada" → motivo "Contactado por teléfono" → confirmar | API responde `ok: true`, flag baja a `false`, evento `NOTIFICACION_GESTIONADA_MANUALMENTE` registrado | | ⏳ | | | | |
| 10.7 | Contador del sidebar | Decrece en 1 | | ⏳ | | | | |
| 10.8 | Restaurar `EMAIL_PASS` | Verificar nuevo radicado envía correo correctamente | | ⏳ | | | | |

---

## Fase 11 — Consulta ciudadana

| # | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observación | Responsable | Fecha |
|---|---|---|---|:-:|---|---|---|---|
| 11.1 | Ir a `/consulta` desde el link del correo (escritorio) | Página carga, formulario funciona | | ⏳ | | | | |
| 11.2 | Ingresar radicadoId UAT + últimos 4 cédula | Datos correctos visibles | | ⏳ | | | | |
| 11.3 | Estado actualizado (`RESUELTO`) | Visible | | ⏳ | | | | |
| 11.4 | Respuesta oficial visible | Bloque institucional con la nota, fecha, dependencia y badge si hay PDF (no descargable desde público) | | ⏳ | | Fix aplicado en commit posterior: sanitizador `buildRespuestaPublicaCiudadano` + UI | | |
| 11.5 | Trazabilidad pública (eventos permitidos) | Visible y filtrada | | ⏳ | | | | |
| 11.6 | Misma URL en móvil (responsive) | UI usable | | ⏳ | | | | |

---

## Fase 14 — Validaciones técnicas

Ejecutar localmente sobre el commit deployado:

| # | Comando | Resultado esperado | Resultado obtenido | Estado | Fecha |
|---|---|---|---|:-:|---|
| 14.1 | `npx tsc --noEmit` | Sin output (cero errores) | | ⏳ | |
| 14.2 | `npm run lint` | Sin warnings ni errores | | ⏳ | |
| 14.3 | `npm run test` | 53/53 passing | | ⏳ | |
| 14.4 | `npm run build` | 40 rutas compiladas, sin errores | | ⏳ | |
| 14.5 | `git status` | working tree clean (o solo cambios esperados) | | ⏳ | |
| 14.6 | `grep -R "EMAIL_PASS\|PRIVATE KEY\|FIREBASE_SERVICE_ACCOUNT\|GEMINI_API_KEY\|AIza"` | Solo placeholders en `*.md` | | ⏳ | |

---

## Carpeta de evidencias

Crear `docs/evidencias/uat-final-{YYYY-MM-DD}/` y guardar:

- `01-radicado-creado.png` — pantallazo de constancia
- `02-correo-confirmacion.png` — captura del correo recibido (correo del ciudadano)
- `03-asignacion-dashboard.png` — radicado asignado en dashboard recepción
- `04-responsable-funcional.png` — snapshot de `clasificacion.funcionarioResponsable*` en Firestore
- `05-respuesta-oficial.png` — pantallazo del momento de resolución (funcionario)
- `06-correo-respuesta.png` — captura del correo de respuesta (ciudadano)
- `07-consulta-ciudadana.png` — pantallazo de `/consulta`
- `08-csv-mipg.csv` — CSV exportado por Control Interno
- `09-usuario-desactivado-bloqueado.png` — captura del login bloqueado
- `10-reset-password.png` — captura del correo de reset
- `11-simi-respetando-rol.png` — captura del panel SIMI sin acciones automáticas
- `12-banner-correo-fallido.png` — captura del banner rojo en PanelDerecho
- `13-marcar-gestionada.png` — captura de la acción manual
- `14-trazabilidad-firestore.png` — snapshot de la subcolección con los 6 eventos

---

## Resumen ejecutivo

| Fase | Total pruebas | ✅ | 🟡 | ❌ | 🚫 | ⏳ | Estado fase |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 3 — Ciudadano | 8 | | | | | 8 | ⏳ |
| 4 — Recepción | 8 | | | | | 8 | ⏳ |
| 5 — Funcionario | 7 | | | | | 7 | ⏳ |
| 6 — Jefe Dependencia | 7 | | | | | 7 | ⏳ |
| 7 — Control Interno | 7 | | | | | 7 | ⏳ |
| 8 — Admin | 8 | | | | | 8 | ⏳ |
| 9 — Privacidad | 7 | | | | | 7 | ⏳ |
| 10 — Notif. fallidas | 8 | | | | | 8 | ⏳ |
| 11 — Consulta | 6 | | | | | 6 | ⏳ |
| 14 — Técnicas | 6 | | | | | 6 | ⏳ |
| **TOTAL** | **72** | | | | | **72** | ⏳ |

---

## Veredicto final

> Completar al cierre de la matriz.

**Resultado:** ⏳ EN EJECUCIÓN

- [ ] Todas las fases en ✅ o documentadas en 🟡
- [ ] Cero ❌
- [ ] Cero 🚫 sin mitigación documentada
- [ ] Evidencias completas
- [ ] Validaciones técnicas verdes

**Si todo APROBADO:** la Ventanilla Única Digital queda lista para piloto gradual controlado.

**Si hay ❌:** seguir el formato de "No completado totalmente" especificado en el sprint, indicando rol/paso/error/evidencia/riesgo/próximo paso.

---

*Plantilla generada el 2026-06-15 · Sprint UAT Institucional Final por Roles · Ventanilla Única Digital · Alcaldía de Simacota, Santander, Colombia*
