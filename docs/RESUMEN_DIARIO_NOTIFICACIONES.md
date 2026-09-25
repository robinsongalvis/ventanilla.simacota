# Resumen del día

El **Resumen del día** es una ventana inicial para funcionarios internos. Su
propósito es responder, en el primer ingreso del día, qué requiere atención
inmediata sin crear una bandeja paralela.

## Cuándo aparece

Al cargar el dashboard, el cliente consulta:

```txt
GET /api/interno/resumen-diario
```

El servidor:

1. valida sesión interna activa;
2. calcula la fecha actual en `America/Bogota`;
3. consulta alertas según rol y dependencia;
4. revisa si el usuario ya cerró el resumen ese día;
5. responde `mostrar: true` solo si hay alertas y aún no fue visto.

Si todo está en cero, no se muestra ningún modal.

## Qué muestra

Las prioridades se ordenan así:

1. vencidos;
2. vencen hoy;
3. próximos a vencer;
4. sin asignar;
5. correos fallidos;
6. devueltos;
7. hallazgos y planes de mejora para Control Interno.

La respuesta incluye contadores y máximo 5 prioridades. No devuelve asunto,
descripción, correo, documento, teléfono, dirección, rutas de archivos ni logs
internos.

## Visibilidad por rol

| Rol | Alcance |
|---|---|
| ADMIN | Resumen global de radicados, sin asignar y fallos de notificación. |
| RECEPCIONISTA | Resumen global operativo para clasificar/asignar y gestionar devoluciones. |
| FUNCIONARIO | Solo su dependencia o radicados asignados a su UID. |
| JEFE_DEPENDENCIA | Solo su dependencia, en modo seguimiento. |
| CONTROL_INTERNO | Alertas globales de riesgo, vencimientos, hallazgos y planes de mejora. No recibe acciones de respuesta ciudadana. |

## Marcar como visto

Al cerrar el modal se registra:

```txt
POST /api/interno/resumen-diario/visto
```

Payload:

```json
{
  "fecha": "2026-07-01"
}
```

El servidor toma el UID desde la sesión, valida que la fecha coincida con el día
actual en Colombia y guarda:

```txt
notificaciones_resumen_diario/{uid}_{YYYY-MM-DD}
```

Campos:

- `uid`
- `fechaColombia`
- `vistoEn`
- `cerradoPorUsuario`
- `cantidadAlertas`
- `versionResumen`

No se almacena detalle del caso ni datos personales.

## Volver a abrirlo

El dashboard incluye un botón **Resumen del día** en el sidebar y una campana en
móvil. Ese acceso reutiliza el mismo resumen calculado y no modifica la lógica de
radicación, asignación ni respuesta.

## Acciones

Los botones no llevan a una pantalla nueva. Reutilizan filtros existentes:

- `VENCIDAS`
- `POR_VENCER`
- `RADICADAS`
- `DEVUELTAS_PRORROGA`
- `TODOS`
- `CONTROL_INTERNO`

## Diseño

El modal sigue el sistema **Obsidian Kinetic** del dashboard:

- fondo oscuro con blur;
- tarjeta centrada, borde suave y sin sombras pesadas;
- firma visual `border-l-4` por prioridad;
- rojo solo para vencidos/fallos críticos;
- ámbar para vencimientos cercanos;
- verde institucional para acción principal.
