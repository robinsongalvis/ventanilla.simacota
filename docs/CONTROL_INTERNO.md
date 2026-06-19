# Centro de Control Interno — Ventanilla Única Simacota

Módulo de seguimiento y mejora continua para la administración municipal.
Su MVP permite revisar prioridades diarias, alertas, hallazgos, planes de
mejora, cumplimiento por dependencia e informes, sin alterar la operación
normal del funcionario.

## Qué resuelve el MVP

- Ordena las situaciones que Control Interno debe revisar primero.
- Explica indicadores y niveles de riesgo en lenguaje sencillo.
- Permite registrar hallazgos y solicitar planes de mejora.
- Compara el cumplimiento de las dependencias.
- Genera un informe Excel para soporte institucional.

## Qué no resuelve

- No responde ni modifica radicados.
- No sustituye el criterio profesional de Control Interno.
- No realiza auditoría individual avanzada ni genera informes PDF mensuales.
- No se integra todavía con entes de control o plataformas externas.

## Principio rector

Control Interno NO modifica radicados ni responde solicitudes.

| Puede                                                | NO puede                              |
|------------------------------------------------------|---------------------------------------|
| Ver todos los radicados y reportes                   | Responder en nombre de la dependencia |
| Crear hallazgos y observaciones                      | Cambiar la respuesta oficial          |
| Solicitar planes de mejora a las dependencias        | Eliminar radicados                    |
| Aprobar / cerrar planes de mejora                    | Modificar fechas oficiales            |
| Marcar alertas como gestionadas o descartadas        | Borrar evidencia o trazabilidad       |
| Exportar reporte Excel institucional                 | Saltarse roles ni reglas de tenant    |

## Estructura del módulo

Ubicación del componente raíz:
[CentroControlInterno.tsx](../app/interno/dashboard/components/control-interno/CentroControlInterno.tsx)

Pestañas disponibles:

1. **Resumen** — Qué revisar hoy, indicadores y semáforo.
2. **Alertas** — Situaciones que requieren atención o seguimiento.
3. **Hallazgos** — Registro y seguimiento de incumplimientos.
4. **Planes de mejora** — Acciones correctivas con seguimiento.
5. **Dependencias** — Desempeño comparado, semáforo y carga.
6. **Reportes** — Informe Excel institucional con 7 hojas.

## Motor de riesgos

Implementado como funciones puras en
[lib/control-interno/riesgos.ts](../lib/control-interno/riesgos.ts).

Cada radicado se evalúa según los siguientes criterios y pesos:

| Criterio                        | Peso |
|---------------------------------|------|
| Vencido                         | 4    |
| Resuelto fuera de término       | 3    |
| Por vencer (≤ 2 días)           | 2    |
| Sin responsable                 | 2    |
| Devuelto varias veces           | 2    |
| Notificación fallida sin gestionar | 2 |
| Tipo de solicitud urgente       | 2    |
| Con prórroga                    | 1    |
| Anónimo / Reservado             | 1    |
| Sin trazabilidad reciente       | 1    |
| Dependencia congestionada       | 1    |

Umbrales:

- `0` → **BAJO**
- `1–3` → **MEDIO**
- `4–6` → **ALTO**
- `7+` → **CRITICO**

En la interfaz estos resultados se presentan como riesgo bajo, medio, alto
o crítico, acompañados por una explicación y una acción sugerida. El cálculo
sirve para ordenar el seguimiento; no toma decisiones por Control Interno.

## Alertas

9 tipos automáticos derivados en vivo (no se persisten salvo cuando se
marcan como gestionadas):

`RADICADO_VENCIDO`, `RADICADO_POR_VENCER`, `SIN_RESPONSABLE`,
`SIN_TRAZABILIDAD`, `RESPUESTA_FUERA_TERMINO`, `NOTIFICACION_FALLIDA`,
`DEPENDENCIA_CONGESTIONADA`, `TIPO_URGENTE_SIN_ATENDER`,
`PRORROGA_SIN_JUSTIFICACION`.

Cada alerta lleva nivel, motivo, acción sugerida y soporta dos acciones:
**Marcar revisada** y **Descartar con justificación**. Ambas dejan
evento en la trazabilidad de Control Interno.

## Flujo de hallazgos

```
Control Interno detecta irregularidad
  ↓
Crea hallazgo (descripción ≥ 10 caracteres, evidencia, nivel)
  ↓
Estado ABIERTO → se agregan observaciones
  ↓
Solicita plan de mejora (opcional)  → estado pasa a EN_GESTION
  ↓
Cierre con justificación (≥ 10 caracteres) → CERRADO
```

Colección: `control_interno_hallazgos`.
Cada operación deja un `EventoControlInterno` en `control_interno_eventos`.

## Flujo de planes de mejora

```
Control Interno solicita plan a partir de un hallazgo
  ↓
PENDIENTE → la dependencia reporta avances (estado pasa a EN_EJECUCION)
  ↓
Control Interno aprueba (CUMPLIDO) o marca como INCUMPLIDO (VENCIDO)
```

Colección: `control_interno_planes_mejora`.

Quien puede reportar avances: `FUNCIONARIO`, `JEFE_DEPENDENCIA`, `ADMIN`.
Quien puede aprobar/cerrar: `CONTROL_INTERNO`, `ADMIN`.

## Permisos

Definidos en [lib/control-interno/permisos.ts](../lib/control-interno/permisos.ts)
y blindados por reglas Firestore + APIs server-side.

Las nuevas colecciones tienen permisos de lectura solo para
`CONTROL_INTERNO` y `ADMIN` (con excepciones específicas para
`JEFE_DEPENDENCIA` y `FUNCIONARIO` sobre planes de su tenant). Todas las
escrituras pasan por endpoints server-side en
`app/api/interno/control/*` que validan rol antes de tocar Firestore.

## Trazabilidad

Cada operación de Control Interno se registra en
`control_interno_eventos` con los campos:

- `tipo` (`CONTROL_INTERNO_HALLAZGO_CREADO`, `_CERRADO`,
  `_PLAN_MEJORA_SOLICITADO`, `_PLAN_MEJORA_ACTUALIZADO`,
  `_PLAN_MEJORA_CERRADO`, `_ALERTA_REVISADA`,
  `_OBSERVACION`, `_REPORTE_EXPORTADO`)
- `actorUid`, `actorNombre`, `actorRol`, `fecha`
- `radicadoId`, `tenantId` (cuando aplica)
- `metadata` adicional

## Endpoints API

| Verbo | Ruta                                                  | Rol                       |
|-------|-------------------------------------------------------|---------------------------|
| GET   | `/api/interno/control/panorama`                       | CONTROL_INTERNO / ADMIN   |
| GET   | `/api/interno/control/resumen-diario`                 | CONTROL_INTERNO / ADMIN   |
| GET   | `/api/interno/control/responsables?tenantId=...`      | CONTROL_INTERNO / ADMIN   |
| GET   | `/api/interno/control/alertas`                        | CONTROL_INTERNO / ADMIN   |
| PATCH | `/api/interno/control/alertas/[id]`                   | CONTROL_INTERNO / ADMIN   |
| GET   | `/api/interno/control/hallazgos`                      | + JEFE_DEPENDENCIA (lectura tenant) |
| POST  | `/api/interno/control/hallazgos`                      | CONTROL_INTERNO / ADMIN   |
| PATCH | `/api/interno/control/hallazgos/[id]`                 | CONTROL_INTERNO / ADMIN   |
| GET   | `/api/interno/control/planes-mejora`                  | + JEFE_DEPENDENCIA        |
| POST  | `/api/interno/control/planes-mejora`                  | CONTROL_INTERNO / ADMIN   |
| PATCH | `/api/interno/control/planes-mejora/[id]`             | avance: + funcionario/jefe; cierre: CI/ADMIN |
| GET   | `/api/interno/control/reportes?desde&hasta`           | CONTROL_INTERNO / ADMIN   |

## Reporte Excel Control Interno

Generado por
[reporte-excel.ts](../lib/control-interno/server/reporte-excel.ts).
Contiene 7 hojas:

1. Resumen (KPIs + semáforos)
2. Alertas
3. Radicados revisados (filtro `nivel != BAJO`)
4. Hallazgos
5. Planes de mejora
6. Dependencias
7. Diccionario

## Fuera de alcance en este sprint

Pendientes (no bloquean el cierre del sprint):

- Auditoría individual de radicado (checklist + subcolección)
- Módulo "Entes de control" (Contraloría, Procuraduría, Personería)
- Acciones SIMI Auditor con prompts dedicados
- Informe PDF mensual
- Integraciones externas (SECOP, firma digital, Power BI)

## Tests

[__tests__/control-interno-riesgos.test.ts](../__tests__/control-interno-riesgos.test.ts)
cubre riesgos, generación de alertas, recomendaciones diarias y permisos.
