# Modelo MIPG — Ventanilla Única Digital
## Alcaldía Municipal de Simacota, Santander

**Versión:** 1.3 (MIPG-3)  
**Fecha:** 2026-05-31  
**Sistema:** `ventanilla_radicados` — Firebase Firestore

---

## Marco normativo

El sistema está alineado con el **Modelo Integrado de Planeación y Gestión (MIPG)** del Departamento Administrativo de la Función Pública (DAFP), específicamente con las dimensiones de:

- **Gestión documental** — trazabilidad completa de cada solicitud ciudadana
- **Transparencia y acceso a información pública** — radicado consultable por el ciudadano
- **Control interno** — rol CONTROL_INTERNO de solo lectura para auditoría
- **Servicio al ciudadano** — notificación email automática al resolver
- **Medición y evaluación del desempeño** — KPIs de cumplimiento de términos

---

## Los 8 puntos de trazabilidad MIPG

Cada documento en `ventanilla_radicados` debe poder responder:

| # | Requisito MIPG | Campo en Firestore | Sprint |
|---|---|---|---|
| 1 | **Quién lo recibió** | `control.medioRecepcion` + `control.origen` + evento `RADICACION` en trazabilidad | v1.0 |
| 2 | **A qué dependencia fue asignado** | `clasificacion.oficinaDestino` + evento `TRASLADO` en trazabilidad | v1.0 |
| 3 | **Qué funcionario lo revisó** | `clasificacion.funcionarioResponsableNombre` (snapshot) + trazabilidad | MIPG-2 |
| 4 | **Qué respuesta se dio** | `respuestaOficial.nota` + evento `RESPUESTA_FUNCIONARIO` en trazabilidad | v1.0 |
| 5 | **En qué fecha** | `respuestaOficial.fecha` + `ultimaActualizacion` + timestamps en trazabilidad | v1.0 |
| 6 | **Qué soporte se adjuntó** | `respuestaOficial.archivoNombre` + `archivoPath` (Storage) | v1.0 |
| 7 | **Qué trazabilidad quedó** | Subcollección `/trazabilidad/` append-only, inmutable, con `eventoId` único | ALTO-1 |
| 8 | **Si se cumplió el término** | `cumplioTermino: boolean` — calculado server-side una sola vez al resolver | MIPG-1 / Cierre Go-Live |

---

## Esquema del documento principal

### `ventanilla_radicados/{radicadoId}`

```typescript
{
  radicadoId:          string;      // SIM-YYYY-NNN
  estadoActual:        EstadoRadicado;
  ultimaActualizacion: string;      // ISO timestamp
  prioridad:           'ROJO' | 'NARANJA' | 'AMARILLO';
  cumplioTermino:      boolean | null; // MIPG Req 8 — null si aún activo

  solicitante: {
    nombreCompleto:  string;
    tipoDocumento:   string;
    numeroDocumento: string;
    email?:          string | null;
    telefono?:       string | null;
    // ...
  };

  control: {
    radicadoId:    string;
    consecutivo:   number;
    fechaRadicado: string;          // YYYY-MM-DD
    horaRadicado:  string;
    medioRecepcion: 'WEB' | 'EMAIL' | 'PRESENCIAL' | 'OFICIO_FISICO';
    origen:        'EXTERNO' | 'INTERNO';
  };

  termino: {
    tipoSolicitudId:    string;
    tipoSolicitudNombre:string;
    diasRespuesta:      number;
    unidad:             'HABILES' | 'CALENDARIO';
    fechaVencimiento:   string;     // ISO
    prorrogasAplicadas: number;
  };

  // ── MIPG-2: ClasificacionRadicado ─────────────────────────
  clasificacion: {
    oficinaDestino: TenantId;
    zonaGeografica: 'CASCO_URBANO' | 'ZONA_RURAL' | 'ZONA_YARIGUIES';

    // Snapshot inmutable al momento de la asignación:
    funcionarioResponsableUid?:    string;  // UID Firebase Auth
    funcionarioResponsableNombre?: string;  // Nombre al momento de asignar
    funcionarioResponsableEmail?:  string;  // Email al momento de asignar
    funcionarioResponsableRol?:    RolInterno;
    funcionarioResponsableCargo?:  string;  // Cargo si aplica
    fechaAsignacionResponsable?:   string;  // ISO timestamp
  };

  detalle: {
    asunto:       string;
    descripcion:  string;
    numeroFolios: number;
    anexosDescripcion?: string | null;
  };

  archivos: ArchivoRadicado[];

  // Campos opcionales
  respuestaOficial?: {
    archivoPath:   string;  // respuestas/{radicadoId}/{filename}
    archivoNombre: string;
    nota:          string;  // MIPG Req 4
    fecha:         string;  // MIPG Req 5
    actorUid:      string;  // MIPG Req 3
    actorNombre:   string;  // MIPG Req 3
  };
  analisisIa?:  AnalisisIA;
  feedbackIa?:  FeedbackIA;
}
```

## Blindaje de evidencias MIPG

Desde el cierre de seguridad go-live, los campos críticos del documento principal no se modifican directamente desde el cliente. Las operaciones de asignación, devolución, prórroga y resolución pasan por APIs server-side con Admin SDK.

`cumplioTermino` es evidencia de cumplimiento legal. Se define únicamente en `POST /api/radicados/[radicadoId]/resolver`, comparando la fecha de resolución contra `termino.fechaVencimiento`. Si el radicado ya está resuelto o el campo ya fue definido, el backend rechaza una nueva resolución para evitar recalcular la evidencia.

La trazabilidad permanece en subcolección append-only y cada acción crítica registra un evento operativo separado.

---

## Subcollección de trazabilidad (Req 7)

### `ventanilla_radicados/{radicadoId}/trazabilidad/{eventoId}`

```typescript
{
  eventoId:    string;         // ev_{radicadoId}_{timestamp}
  fecha:       string;         // ISO
  accion:      AccionAuditoria | 'TRASLADO' | 'PRORROGA';
  actorUid:    string;
  actorNombre: string;
  nota:        string;
  // Campos opcionales según el tipo de evento
  oficinaOrigen?:  TenantId;
  oficinaDestino?: TenantId;
  funcionarioDestinoUid?: string;
  metadata?: {
    // MIPG-2: enriquecido en eventos de asignación
    dependenciaOrigen?:           string;
    dependenciaDestino?:          string;
    actorRol?:                    string;
    funcionarioResponsableUid?:   string;
    funcionarioResponsableNombre?:string;
    funcionarioResponsableEmail?: string;
    funcionarioResponsableRol?:   string;
    // MIPG-1: enriquecido en eventos de resolución
    // (el campo cumplioTermino va en el documento principal)
    masivo?: boolean;  // true para asignaciones en lote
  };
}
```

**Reglas de Firestore:**
- `allow create: if canWriteTrazabilidad()` — solo ADMIN, RECEPCIONISTA, FUNCIONARIO
- `allow update, delete: if false` — **inmutable**
- `allow read: if isInternalUser()` — todos los roles internos incluyendo JEFE_DEPENDENCIA y CONTROL_INTERNO

---

## Roles y permisos MIPG

| Rol | Lee radicados | Escribe radicados | Escribe trazabilidad | Propósito MIPG |
|---|---|---|---|---|
| `ADMIN` | Todos los tenants | ✅ Todas las acciones | ✅ | Gestión global |
| `RECEPCIONISTA` | Su tenant | ✅ Radicación + asignación | ✅ | Recepción y enrutamiento |
| `FUNCIONARIO` | Su tenant | ✅ Resolución + traslado | ✅ | Atención de solicitudes |
| `JEFE_DEPENDENCIA` | Su tenant | ❌ Solo lectura | ❌ | Supervisión interna |
| `CONTROL_INTERNO` | Todos los tenants | ❌ Solo lectura | ❌ | **Auditoría MIPG** |

---

## Snapshot inmutable del responsable (MIPG-2)

### Principio de inmutabilidad histórica

Los campos `funcionarioResponsable*` se capturan en el momento exacto de la asignación y **no se actualizan** aunque el usuario modifique su perfil. Esto garantiza que:

1. Un radicado de 2026 seguirá mostrando el nombre del funcionario que lo manejó, aunque esa persona ya no esté en la institución.
2. Los reportes de auditoría son reproducibles en cualquier momento.
3. El DAFP puede verificar la responsabilidad funcional sin depender de registros externos.

### Compatibilidad con datos anteriores (radicados pre-MIPG-2)

Los radicados creados antes de la versión MIPG-2 solo tienen `funcionarioResponsableUid`. El sistema los muestra como:
- **UI:** "Radicado anterior — nombre no registrado. Ver trazabilidad para detalle."
- **CSV:** Columna `Responsable Nombre` = `"No registrado (ver trazabilidad)"`

---

## KPIs MIPG disponibles

### Globales (en analytics, cualquier período)

| KPI | Campo | Cálculo |
|---|---|---|
| Tasa de resolución | `globales.tasaResolucion` | Resueltos / Total × 100 |
| **Cumplimiento de términos** | `globales.tasaCumplimientoTerminos` | `cumplioTermino=true` / Total con dato × 100 |
| Respondidos a tiempo (absoluto) | `globales.respondidosATiempo` | Count de `cumplioTermino === true` |
| Vencidos activos | `globales.vencidosActivos` | Activos con `fechaVencimiento < hoy` |
| Tiempo promedio de respuesta | `globales.promedioRespuestaDias` | Promedio días hábiles en resueltos |

### Por dependencia

| KPI | Campo |
|---|---|
| Recibidos | `porDependencia[n].recibidos` |
| Resueltos | `porDependencia[n].resueltos` |
| Vencidos | `porDependencia[n].vencidos` |
| **Respondidos a tiempo** | `porDependencia[n].respondidosATiempo` |
| **Tasa de cumplimiento** | `porDependencia[n].tasaCumplimiento` |
| Tiempo promedio | `porDependencia[n].promDias` |

---

## Exportación CSV MIPG

El botón **"Exportar CSV MIPG"** (Vista Reportes en el dashboard) genera un archivo con las siguientes columnas:

| # | Columna | Requisito MIPG |
|---|---|---|
| 1 | N° Radicado | Req 1 |
| 2 | Fecha Radicación | Req 1 |
| 3 | Hora Radicación | Req 1 |
| 4 | Medio Recepción | Req 1 |
| 5 | Solicitante | Contexto |
| 6 | Documento | Contexto |
| 7 | Tipo Solicitud | Clasificación |
| 8 | Dependencia Asignada | Req 2 |
| 9 | Responsable UID | Req 3 |
| 10 | **Responsable Nombre** | **Req 3 — MIPG-2** |
| 11 | **Responsable Email** | **Req 3 — MIPG-2** |
| 12 | **Responsable Rol** | **Req 3 — MIPG-2** |
| 13 | **Responsable Cargo** | **Req 3 — MIPG-2** |
| 14 | **Fecha Asignación Responsable** | **Req 3 — MIPG-2** |
| 15 | Estado Actual | Ciclo de vida |
| 16 | Respuesta | Req 4 |
| 17 | Fecha Respuesta | Req 5 |
| 18 | Oficio Adjunto | Req 6 |
| 19 | Fecha Vencimiento | Req 8 |
| 20 | **Días Restantes** | **MIPG-3 — calculado al exportar** |
| 21 | **Estado Término** | **MIPG-3 — EN_TERMINO / POR_VENCER / VENCIDO / RESUELTO** |
| 22 | **Días Vencido** | **MIPG-3 — 0 si en término** |
| 23 | Prórrogas Aplicadas | Req 8 |
| 24 | **Cumplió Término MIPG** | **Req 8 — MIPG-1** |
| 25 | Trazabilidad | Req 7 |

**Formato:** CSV UTF-8 con BOM (compatible con Excel colombiano — acentos y ñ correctos).  
**Nombre:** `MIPG_Radicados_YYYY-MM-DD.csv`

---

## Semáforo de cumplimiento MIPG-3

### Componente `SemaforoTermino`

Componente reutilizable (`app/interno/dashboard/components/mipg/SemaforoTermino.tsx`) que calcula y muestra:

| Color | Estado | Condición |
|---|---|---|
| 🟢 Verde | `EN_TERMINO` | > 2 días hábiles restantes |
| 🟡 Amarillo | `POR_VENCER` | 0-2 días hábiles restantes |
| 🔴 Rojo | `VENCIDO` | Días negativos (ya venció) |
| ⚪ Gris | `RESUELTO` | Cerrado — muestra si cumplió o no |
| 🩷 Rosa | `RESUELTO` (fuera de término) | `cumplioTermino === false` |

### Variantes de presentación

- `badge` — pill con dot e indicador de días (default)
- `compact` — dot + texto (para espacios reducidos como el panel derecho)
- `inline` — solo texto con color (para tablas)

### Filtros de dashboard

| Filtro | Descripción |
|---|---|
| `EN_TERMINO` | Activos con > 2 días hábiles (semáforo verde) |
| `POR_VENCER` | Activos con 0-2 días hábiles (semáforo amarillo) |
| `VENCIDAS` | Activos con días negativos (semáforo rojo) |
| `RESUELTOS_FUERA_TERMINO` | Cerrados que no cumplieron el plazo legal |

### Visibilidad por rol

| Rol | Semáforos visibles |
|---|---|
| `ADMIN` | Todos los tenants — todos los filtros |
| `CONTROL_INTERNO` | Todos los tenants — todos los filtros (solo lectura) |
| `JEFE_DEPENDENCIA` | Solo su tenant — todos los filtros (solo lectura) |
| `FUNCIONARIO` | Solo su tenant — todos los filtros |
| `RECEPCIONISTA` | Su tenant — todos los filtros |

---

## Próximas mejoras (backlog MIPG)

| Sprint | Descripción | Prioridad |
|---|---|---|
| MIPG-4 | Notificaciones automáticas de vencimiento próximo (email/SMS) | ALTA |
| MIPG-5 | Dashboard público de indicadores de gestión (transparencia ciudadana) | MEDIA |
| MIPG-6 | Reportes en PDF institucionales con firma digital | MEDIA |

---

*Documento generado automáticamente — Ventanilla Única Digital, Alcaldía de Simacota, Santander, Colombia*
