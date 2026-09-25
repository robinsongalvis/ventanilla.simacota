# Piloto por Dependencia — Ventanilla Única Digital Simacota

**Versión:** 1.0
**Vigencia:** desde la fecha de aprobación institucional.
**Responsable global:** Administrador del sistema (rol ADMIN).
**Documento vivo:** actualizar al cerrar cada dependencia piloto.

---

## 1. Objetivo del piloto

Poner en operación controlada la Ventanilla Única Digital dependencia por
dependencia, con radicados reales de la Alcaldía Municipal de Simacota,
antes de habilitar la publicación ciudadana masiva. El piloto valida en
condiciones reales:

- La correcta separación de datos por dependencia (tenant).
- La trazabilidad completa de cada radicado.
- El envío de notificaciones institucionales al ciudadano.
- La descarga segura de oficios de respuesta.
- La estabilidad operativa bajo uso diario por funcionarios.

## 2. Alcance

**Incluido en el piloto:**

- Radicación por Recepción / Ventanilla Única con datos reales.
- Asignación y clasificación por dependencia.
- Respuesta oficial con oficio adjunto.
- Notificación al ciudadano por correo (H-02).
- Consulta pública por parte del ciudadano radicante (H-03).
- Trazabilidad, auditoría y expediente completo.

**Fuera del piloto (fase posterior):**

- Publicación abierta a radicación 24/7 desde la página web ciudadana.
- Integración con canales externos (WhatsApp, correo entrante automático).
- Módulos SIMI Jurídico avanzados.
- Reportes MIPG masivos.

## 3. Dependencias participantes

Ver **Tabla base de dependencias** al final del documento. Se sugiere iniciar
con **una única dependencia piloto** (recomendado: la de mayor volumen o la
que tenga liderazgo más disponible) y expandir semanalmente.

Recomendación de orden:

1. **VENTANILLA_UNICA + SEC_GOBIERNO** (piloto inicial conjunto).
2. **SEC_HACIENDA**.
3. **Resto de secretarías**, una por semana.
4. **CONTROL_INTERNO** en paralelo desde la primera dependencia.

## 4. Roles por dependencia

Cada dependencia requiere como mínimo:

| Rol | Cantidad mínima | Responsabilidad |
|---|:-:|---|
| `ADMIN` (global, no por dependencia) | 1 | Alta/baja de usuarios, auditoría, reset de contraseñas |
| `RECEPCIONISTA` (tenant `VENTANILLA_UNICA`) | 1 | Radica y clasifica |
| `JEFE_DEPENDENCIA` (por tenant) | 1 | Supervisa la dependencia, ve solo su tenant |
| `FUNCIONARIO` (por tenant) | 2 | Responde radicados de su dependencia |
| `CONTROL_INTERNO` (global lectura) | 1 | Audita, verifica cumplimiento |

## 5. Datos que se deben recolectar antes de crear usuarios

Por cada usuario a crear (formato Excel/CSV entregable al ADMIN):

- Nombres y apellidos completos.
- Documento de identidad (para validar identidad, **no se registra en el sistema**).
- **Correo institucional confirmado** (`@simacota-santander.gov.co` o el dominio elegido).
- Cargo actual.
- Rol solicitado (`ADMIN` / `RECEPCIONISTA` / `JEFE_DEPENDENCIA` / `FUNCIONARIO` / `CONTROL_INTERNO`).
- Tenant (dependencia — obligatorio para `FUNCIONARIO` y `JEFE_DEPENDENCIA`).
- Firma de acta de confidencialidad (soporte físico o digital).

## 6. Checklist antes de iniciar

Verificar antes de arrancar cada dependencia:

- [ ] Deploy productivo estable en Vercel.
- [ ] Backups programados de Firestore activos (Cloud Scheduler → Storage).
- [ ] Alertas de presupuesto configuradas en Google Cloud y Vercel.
- [ ] `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `EMAIL_*` productivos.
- [ ] SPF / DKIM / DMARC del dominio institucional verificados (mxtoolbox).
- [ ] SMTP institucional o sandbox funcional (según fase).
- [ ] Política de Tratamiento de Datos publicada y enlazada desde `/radicacion`.
- [ ] Guía de usuario (`docs/GUIA_USUARIO.md`) revisada y actualizada.
- [ ] Guía de administrador (`docs/GUIA_ADMINISTRADOR.md`) actualizada.
- [ ] Sentry activo y con `beforeSend` de scrubbing (H-N03).
- [ ] Runbook de incidentes disponible (`docs/RUNBOOK_INCIDENTES_SMTP.md`).
- [ ] Dependencia elegida tiene datos maestros correctos en `DIRECTORIO_TENANTS`.

## 7. Capacitación mínima

Sesión de 2 horas por dependencia con:

| Rol | Contenido |
|---|---|
| Recepción | Radicar PQRSD paso a paso · anexar archivos válidos · asignar dependencia · manejo de anónimos y reservados. |
| Jefe de Dependencia | Ver expediente completo · autorizar respuesta · lectura de trazabilidad · lectura de hallazgos de Control Interno. |
| Funcionario | Responder radicado · adjuntar oficio en PDF · descarga segura · notificar al ciudadano · gestión de fallos de correo. |
| ADMIN | Crear/desactivar usuarios · reset contraseña · lectura de auditoría · configuración inicial. |
| Control Interno | Panorama · hallazgos · planes de mejora · exportación de reportes. |

Material sugerido:

- Guía institucional (PDF de 5-10 páginas).
- Video corto de 15 min por rol (opcional).
- Sesión de preguntas de 30 min al cierre.

## 8. Flujo de uso por dependencia

**Semana -2 (planeación):**

- Reunión con Jefe de Dependencia — presentar sistema y beneficios.
- Recolectar datos de usuarios (sección 5).
- Confirmar catálogos institucionales.

**Semana -1 (preparación):**

- ADMIN crea usuarios en producción.
- Envío de contraseñas temporales por canal seguro (no por correo).
- Capacitación (sección 7).
- Firma de acta de confidencialidad.

**Día 0 (kickoff):**

- Recepción radica el primer PQRSD real de esa dependencia.
- Verificación en vivo de asignación correcta.

**Días 1-7 (uso supervisado):**

- Funcionarios responden bajo observación del ADMIN.
- Reporte diario de incidencias (canal directo con ADMIN).

**Día 8 (revisión):**

- Reunión de seguimiento: qué falla, qué falta.
- Ajustes menores.

**Día 15 (cierre):**

- Firma del acta de aceptación (sección 12).
- Dependencia pasa a operación normal.

## 9. Pruebas obligatorias

Cada dependencia debe superar estas pruebas antes de firmar aceptación:

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Recepción radica 1 PQRSD identificado dirigido a la dependencia | Radicado creado, dependencia correcta, correo de confirmación al ciudadano |
| 2 | Funcionario de la dependencia ve el radicado en su bandeja | ✓ visible |
| 3 | Funcionario de OTRA dependencia intenta abrir ese radicado | ❌ bloqueado (403 / no visible) |
| 4 | Funcionario responde con oficio PDF válido | ✓ oficio guardado, trazabilidad `RESPUESTA_FUNCIONARIO` con archivo anexado |
| 5 | Funcionario notifica al ciudadano | ✓ correo enviado, trazabilidad `NOTIFICACION_CORREO_ENVIADA` |
| 6 | Ciudadano consulta en `/consulta` con su correo | ✓ ve estado + respuesta oficial + `tieneArchivo: true` sin exponer path |
| 7 | JEFE_DEPENDENCIA revisa expediente completo (pestaña Información + Trazabilidad) | ✓ ve nombre del oficio + botón "Descargar documento" |
| 8 | JEFE_DEPENDENCIA intenta abrir hallazgos de OTRA dependencia | ❌ bloqueado por H-10 |
| 9 | CONTROL_INTERNO ve el expediente y su trazabilidad | ✓ solo lectura |
| 10 | Radicación anónima → consulta con token generado | ✓ funciona sin revelar identidad |

## 10. Criterios de éxito

Una dependencia se considera **piloto exitoso** cuando:

- ≥ 10 radicados reales gestionados sin incidencias críticas.
- ≥ 1 respuesta con oficio anexado completa.
- ≥ 1 notificación al ciudadano enviada correctamente.
- 0 accesos cross-tenant reportados.
- 0 fugas de PII en Sentry (verificado por Seguridad técnico).
- 0 correos rebotados por SPF / DKIM / DMARC mal configurados.
- 100% de las 10 pruebas de la sección 9 aprobadas.
- Feedback de al menos 3 funcionarios positivo.

## 11. Incidencias y responsables

Canal único de reporte: correo a `soporte-ventanilla@simacota-santander.gov.co`
(o canal definido).

| Tipo | SLA respuesta | Responsable |
|---|:-:|---|
| Incidencia crítica (bloqueo de radicación, fuga de datos) | 2 horas | ADMIN + Seguridad técnico |
| Incidencia mayor (correo no llega, error en descarga) | 8 horas | ADMIN |
| Consulta funcional (dudas de uso, capacitación) | 24 horas | Responsable UAT |
| Sugerencia (mejora de UX, texto) | 72 horas | Producto |

## 12. Acta de aceptación por dependencia

Al cierre del piloto de cada dependencia:

```
Acta de aceptación — Piloto Ventanilla Única

Dependencia: ____________________
Fecha de inicio: __________ · Fecha de cierre: __________
Radicados gestionados durante piloto: ______
Incidencias críticas: ____ · Incidencias mayores: ____

Pruebas aprobadas (Sección 9): ___ / 10

Criterios de éxito cumplidos: ☐ Sí ☐ No

Firmas:
- Jefe de Dependencia: __________________________
- Responsable de Recepción: _____________________
- Administrador del sistema: ____________________
- Control Interno: ______________________________
```

---

## Tabla base de dependencias participantes

*Diligenciar antes de crear usuarios. Los tenants exactos deben validarse
contra `src/types/reglas-negocio.ts` y los correos institucionales deben
corresponder a los declarados en `DIRECTORIO_TENANTS`.*

| Dependencia | Correo institucional | Jefe | Funcionarios | Rol | Tenant | Observaciones |
|---|---|---|---|---|---|---|
| Ventanilla Única | ventanilla@simacota-santander.gov.co | (pendiente) | (pendiente) | RECEPCIONISTA | VENTANILLA_UNICA | Piloto inicial |
| Secretaría de Gobierno | gobierno@... | | | FUNCIONARIO / JEFE_DEPENDENCIA | SEC_GOBIERNO | Alto volumen esperado |
| Secretaría de Hacienda | hacienda@... | | | FUNCIONARIO / JEFE_DEPENDENCIA | SEC_HACIENDA | |
| Secretaría de Planeación | planeacion@... | | | FUNCIONARIO / JEFE_DEPENDENCIA | SEC_PLANEACION | |
| UMATA | umata@... | | | FUNCIONARIO / JEFE_DEPENDENCIA | UMATA | |
| Inspección de Policía | inspeccion@... | | | FUNCIONARIO / JEFE_DEPENDENCIA | INSPECCION | |
| Desarrollo Social | desarrollo@... | | | FUNCIONARIO / JEFE_DEPENDENCIA | DES_SOCIAL | |
| Control Interno | control.interno@... | | | CONTROL_INTERNO | VENTANILLA_UNICA | Rol global lectura |

---

## Checklist detallada por dependencia

*Copiar este bloque completo por cada dependencia que se incorpore.*

**Dependencia:** _______________________

- [ ] Jefe identificado y confirmado.
- [ ] Funcionarios identificados (mínimo 2).
- [ ] Correos institucionales confirmados y validados.
- [ ] Usuarios creados por ADMIN.
- [ ] Roles asignados correctamente en Firestore.
- [ ] Capacitación realizada (fecha: _______).
- [ ] Acta de confidencialidad firmada.
- [ ] Primer radicado de prueba ejecutado sin errores.
- [ ] Primer radicado real gestionado.
- [ ] Primera respuesta con oficio anexado completada.
- [ ] Notificación al ciudadano enviada y confirmada.
- [ ] Trazabilidad revisada por Control Interno.
- [ ] Pruebas de la Sección 9 aprobadas (marcar número): __________
- [ ] Acta de aceptación firmada (fecha: _______).

**Estado final:** ☐ En preparación ☐ En piloto ☐ Aceptado ☐ Rechazado

---

*Documento generado como guía operativa institucional. No modifica código
ni configuración del sistema. Cada dependencia debe cerrar su piloto antes
de la publicación ciudadana masiva.*
