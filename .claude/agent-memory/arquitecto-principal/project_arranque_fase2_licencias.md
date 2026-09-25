---
name: arranque-fase2-licencias
description: "Revisión exprés 6-ago-2026 del arranque programable Fase 2 (licencias): veredictos 1-8 sobre calendario, serie expedientes, TenantConfig, unicidad y cron"
metadata:
  type: project
---

Revisión arquitectónica exprés (Nivel 2, 6-ago-2026) del "Arranque programable Fase 2" de licencias, rama `claude/fase2-arranque-licencias` (stack sobre #161). Veredictos emitidos:

1. Calendario: opción (a) — `lib/tiempos-radicado.ts` sigue siendo fuente única; NO se crea `lib/calendario/habiles.ts` (ni façade). Se añade `sumarDiasHabiles` pública; `diasHabilesEntre` NO se crea (ya existe `diasRestantesHabiles` con esa semántica). Desviación documentada: algoritmo total (Ley 51/1983) > tabla versionada; error-por-año-faltante no aplica; `festivosExtra` es el punto de extensión para días cívicos locales (sin fuente de datos hoy — residual declarado).
2. Fecha: NO se introduce tipo `FechaLocal`; `atLocalNoon` sigue siendo la convención canónica, PERO cerrar deuda #15 ADR-0026 (anclar a America/Bogota vía Intl de `lib/fecha-colombia.ts`) es condición obligatoria del arranque — en Vercel (UTC) hay ±1 día real después de las 19:00 Bogotá.
3. Serie: `'expedientes'` minúscula, ya en el union. Formateador en módulo propio (`lib/motor-expedientes/numero-expediente.ts`), puro y parametrizado (no importa DIRECTORIO_TENANTS en el núcleo del motor); `consecutivo-legal.ts` NO se toca. Año con `fecha.getFullYear()` sobre la MISMA fecha anclada que recibe el counter (evita split año-counter vs AA en Nochevieja).
4. TenantConfig: campos opcionales `codigoDane?: string` y `codigoCuraduria?: string` (strings por ceros a la izquierda), poblados SOLO en SEC_PLANEACION; helper fail-closed que lanza si faltan. Si aparece 2.º tenant emisor, evaluar promover codigoDane a config municipal (deuda declarada).
5. Unicidad: aprobada como defensa en profundidad (no YAGNI: el residual de deuda #7 demuestra que ya existieron escritores paralelos de counters). Colección `unicidad_expedientes` (underscore, convención repo), doc id = numeroExpediente formateado, `tx.create` (falla si existe → aborta tx completa), solo origen REAL; reconstruidos con colision:true NO reservan. Residual: colisión por siembra mal hecha la detecta el cron, no la reserva.
6. Cron auditoría: NO extender `COLECCION_POR_SERIE` a expedientes — estructuralmente imposible: (a) `perteneceAlAnio` busca año de 4 dígitos y el número usa AA de 2; (b) el doc id de expedientes es SINTÉTICO, el número legal es campo. Mecanismo aprobado: gate por existencia del counter + reporte PARCIAL explícito en el JSON (nunca silencio engañoso) + validación de forma del counter. Auditoría completa de huecos/duplicados se difiere a cuando exista la colección (lectura por campo numeroExpediente con filtro origen REAL) — esto SUPERSEDE la vía prevista en deuda #12.
7. SubtipoTramite aprobado (Fase 2 lo necesita para `subtipos`); EquivalenciaMigracion aprobada como estructura PROVISIONAL sin contenido ni persistencia, en módulo separado del núcleo; sensible a P2 (combinados) pero la forma `textoHistorico → codigo[]` es robusta a ambas respuestas.
8. Stack sobre #161 sin objeción; condiciones: mergear en orden, título con "[stack sobre #161]", y COMMITEAR `docs/planes/respuestas-juridica-licencia-construccion.md` (estaba untracked pese a ser fuente citada).

**Why:** las Tareas 2-4 de dev-backend se implementan contra estos veredictos; los PRs del stack deben revisarse contra ellos.

**How to apply:** al revisar los PRs del arranque Fase 2 verificar: fix #15 primero, cero cambios en `consecutivo-legal.ts`, formateador puro fuera del núcleo, reserva con `tx.create`, cron sin falsos huecos, reglas Firestore para `unicidad_expedientes` (`if false`). Ver [[revision-insumo-licencias]] para las tensiones previas.
