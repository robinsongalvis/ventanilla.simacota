# UAT Seguridad H-10 — Aislamiento de hallazgos y planes

## Objetivo

Confirmar que un `JEFE_DEPENDENCIA` solo puede consultar hallazgos y planes de
su propia dependencia, mientras ADMIN y CONTROL_INTERNO conservan la vista
global autorizada.

## Precondiciones

- `firestore.rules` vigentes de `main` desplegadas en el proyecto Firebase del
  ambiente (el aislamiento H-10 se integró a `main` vía PR #30).
- Dos dependencias distintas, por ejemplo `SEC_GOBIERNO` y `SEC_PLANEACION`.
- Un hallazgo y un plan de mejora UAT para cada dependencia.
- Cuentas activas: ADMIN, CONTROL_INTERNO, JEFE de Gobierno, JEFE de Planeación
  y FUNCIONARIO de Gobierno.
- Usar únicamente datos ficticios, sin PII ciudadana real.

## Matriz de pruebas

| # | Rol | Acción | Resultado esperado |
|---|-----|--------|--------------------|
| 1 | ADMIN | Listar hallazgos y planes | Ve ambas dependencias. |
| 2 | CONTROL_INTERNO | Listar hallazgos y planes | Ve ambas dependencias. |
| 3 | JEFE Gobierno | Listar hallazgos | Solo ve `SEC_GOBIERNO`. |
| 4 | JEFE Gobierno | Listar planes | Solo ve `SEC_GOBIERNO`. |
| 5 | JEFE Gobierno | Consultar por ID un hallazgo de Planeación con SDK cliente | Firestore deniega. |
| 6 | JEFE Gobierno | Consultar por ID un plan de Planeación con SDK cliente/API | Firestore deniega o API responde 403. |
| 7 | JEFE Gobierno | Ejecutar consulta global sin `where('tenantId', '==', ...)` | Firestore deniega. |
| 8 | FUNCIONARIO Gobierno | Consultar planes con filtro de su tenant | Solo ve `SEC_GOBIERNO`. |
| 9 | FUNCIONARIO Gobierno | Consultar hallazgos | Firestore deniega. |
| 10 | RECEPCIONISTA o rol desconocido | Consultar hallazgos/planes | Firestore deniega. |
| 11 | Cualquier cliente | Crear, editar o eliminar hallazgo/plan directamente | Firestore deniega. |
| 12 | JEFE Gobierno | Reportar avance por la API sobre plan propio | Permitido según flujo vigente. |
| 13 | JEFE Gobierno | Reportar avance por la API sobre plan de Planeación | 403, sin datos del plan. |

## Verificación técnica recomendada

La consulta cliente válida para Jefe/Funcionario debe incluir:

```ts
query(
  collection(db, 'control_interno_planes_mejora'),
  where('tenantId', '==', usuario.tenantId),
)
```

No usar consultas globales y filtrar después en el navegador. Las reglas deben
rechazar la consulta antes de devolver documentos.

## Evidencia de cierre

| Campo | Resultado |
|-------|-----------|
| URL/ambiente | Pendiente |
| Commit desplegado | Pendiente |
| Reglas desplegadas | Pendiente |
| Responsable UAT | Pendiente |
| Fecha | Pendiente |
| Casos aprobados | Pendiente |
| Incidentes observados | Pendiente |

Cuando todos los casos estén aprobados, actualizar H-10 a
`✅ Corregido — Sprint Seguridad H-10` en la auditoría y la bitácora.
