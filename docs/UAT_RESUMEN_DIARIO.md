# UAT — Resumen del día

Estado: pendiente Preview/UAT.

## Precondiciones

- Ambiente Preview desplegado.
- Usuarios de prueba con roles: ADMIN, RECEPCIONISTA, FUNCIONARIO,
  JEFE_DEPENDENCIA y CONTROL_INTERNO.
- Al menos un radicado vencido, uno que vence hoy, uno próximo a vencer y uno con
  `alertaNotificacionFallida`.
- Para Control Interno: un hallazgo abierto y un plan de mejora vencido o próximo
  a vencer.

## Matriz

| Caso | Usuario | Datos esperados | Resultado |
|---|---|---|---|
| 1 | ADMIN | Alertas globales | Modal aparece en primer ingreso del día. |
| 2 | RECEPCIONISTA | Radicados sin asignar/devoluciones | Modal muestra pendientes operativos. |
| 3 | FUNCIONARIO | Vencidos de su dependencia | Solo ve su dependencia/asignados. |
| 4 | FUNCIONARIO | Sin pendientes | Dashboard carga sin modal. |
| 5 | FUNCIONARIO otra dependencia | Radicado vencido ajeno | No aparece en su resumen. |
| 6 | JEFE_DEPENDENCIA | Alertas de su dependencia | Modal aparece en modo seguimiento. |
| 7 | CONTROL_INTERNO | Hallazgos/planes | Modal muestra Control Interno y no botones de respuesta. |
| 8 | Cierre por hoy | Cualquier rol con alertas | Al cerrar, no vuelve automáticamente ese día. |
| 9 | Otro navegador | Mismo usuario y día | No vuelve a aparecer tras visto en servidor. |
| 10 | Día siguiente | Mismo usuario con alertas | Se evalúa nuevamente. |
| 11 | Móvil | 390 px ancho | Sin desbordamiento horizontal, foco y botones accesibles. |
| 12 | Acciones | Botones del modal | Aplican filtros existentes del dashboard. |
| 13 | Privacidad | Inspeccionar respuesta API | No hay correo, documento, teléfono, dirección, asunto ni descripción completa. |

## Validaciones manuales sugeridas

```bash
curl -i https://URL-PREVIEW.vercel.app/api/interno/resumen-diario
```

Debe responder 401 sin sesión.

Con sesión de navegador, revisar en DevTools que:

- `GET /api/interno/resumen-diario` tenga `Cache-Control: no-store`;
- `POST /api/interno/resumen-diario/visto` guarde solo metadatos;
- no se incluyan datos personales en el JSON.

## Criterio de aprobación

El sprint queda aprobado cuando todos los roles respetan su alcance, el modal no
se repite tras cerrarlo, los filtros llevan al dashboard existente y no hay fuga
de datos personales.
