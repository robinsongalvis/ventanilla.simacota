# Auditoría técnica integral — Ventanilla Única Digital de Simacota

- **Fecha:** 2026-07-20 · **Alcance:** `origin/main` (HEAD `d1414bd`)
- **Método:** 5 auditorías especializadas en paralelo (seguridad, infraestructura/DevOps,
  QA, datos/Firestore, arquitectura) con evidencia archivo:línea, más verificación
  directa del coordinador de los hallazgos de mayor severidad.
- **Regla del ejercicio:** solo diagnóstico. Ningún cambio ni despliegue.

---

## 1. Madurez general del sistema: **70 %**

Ponderación: núcleo transaccional/tipos/tests/gobernanza ~88 %; seguridad de superficie
cliente (contador/create/ruta interna) ~45 %; última milla operativa (branch protection,
backups, dependencias, escalabilidad de crons) ~50 %; mantenibilidad de UI ~50 %.

## 2. ¿Está listo para producción? **NO todavía — con matices honestos.**

El **camino crítico** (radicación pública, consecutivo legal atómico, aislamiento por
tenant, saneo de datos personales) es de **calidad de producción y está medido**. Lo que
impide declararlo "listo" no es el diseño sino la **última milla operativa y un flanco de
integridad conocido**: el contador legal es escribible desde el cliente, la compuerta de
gobernanza no bloquea (branch protection inactiva), no hay backups automatizados ni
restauración probada, el pipeline está en rojo hoy por una vulnerabilidad de dependencia,
y dos crons de plazos legales no escalan. Para una plataforma que custodia registros
legales, esos puntos son descalificantes hasta cerrarse — aunque ninguno es explotable de
forma anónima.

## 3. Semáforo por área

| Área | Semáforo | Base |
|---|---|---|
| Arquitectura general | 🟡 | Capas limpias, TS estricto (0 `any`), pero God component + modelo dual |
| Infraestructura y despliegue | 🔴 | Reglas/índices se despliegan a mano (drift); sin `.firebaserc`; sin `maxDuration` |
| Preparación para producción | 🔴 | Backups no automatizados; branch protection off; pipeline rojo hoy |
| Autenticación | 🟢 | Sesión con revocación, whitelist de rol, activo/archivado por ruta |
| Autorización / control de acceso | 🟢 | IDOR bien defendido; tenant re-validado server-side; sin bypass anónimo |
| Reglas Firestore/Storage | 🔴 | `counters` y `create` escribibles desde cliente (N1/N4) |
| Gestión de secretos | 🟢 | Ninguno commiteado; `.gitignore` cubre; lectura de `process.env` |
| CI/CD | 🟡 | Pipeline robusto (gates reales) pero no lo hace cumplir (protección inactiva) |
| Observabilidad / logging / auditoría | 🟢 | Logger estructurado + Sentry 3 runtimes + eventos de negocio + saneo PII |
| Manejo de errores / recuperación | 🟡 | Errores tipados; fallback IA real; huérfanos de Storage sin conciliar |
| Rendimiento y escalabilidad | 🟡 | Stream y búsqueda ejemplares; 4 lecturas O(N) que son pared a 100k |
| Optimización de consultas | 🟡 | Índices cubiertos y con gate; pero N+1 en Excel y full-scan en copiloto/crons |
| Cobertura y calidad de pruebas | 🟡 | 1116 tests estables; pero ~20 archivos prueban texto, no comportamiento |
| Calidad de código | 🟢 | TS estricto genuino; `tsc` limpio; deuda inventariada con archivo:línea |
| Documentación técnica | 🟡 | ADRs/gobernanza excelentes; runbook de operación delgado |
| Dependencias y vulnerabilidades | 🔴 | `npm audit` con 1 alta + 1 moderada hoy; sin Dependabot |
| Crons programados | 🔴 | Autenticados y con buena gobernanza, pero full-scan sin `maxDuration` ni reintento |
| Riesgos operativos / SPOF | 🔴 | Operador único; un solo proyecto Firebase; sin contingencia (P-007) ni restauración probada |
| Buenas prácticas institucionales | 🟢 | Gobernanza con sustancia (gates que bloquean, ADRs con correlato en código) |

## 4. Riesgos críticos (resolver antes de crecer)

**CR-1 · Contador legal e ids escribibles desde el cliente (convergencia de 3 auditores + verificado).**
`firestore.rules:208-211` (`counters` `read,write` para admin/recepcionista) y `:143-144`
(`create` de `ventanilla_radicados` sin validar campos). Un token privilegiado filtrado
puede **resetear el consecutivo** (→ duplicados en la serie AGN 060) o **forjar un radicado**
con fecha/término arbitrarios — flanqueando todo el blindaje atómico de H3. Señalado por
seguridad, datos y arquitectura de forma independiente.
*Cierre:* `write:if false` / `create:if false` (2 líneas) **tras** migrar la ruta interna a
servidor (CR-2). Bajo esfuerzo en las reglas; acoplado a CR-2.

**CR-2 · Ruta interna de radicación client-side (la "pieza angular", D1).**
`lib/actions/radicarVentanilla.ts` corre en cliente, no reusa el helper canónico
`consecutivo-legal.ts`, **escribe la trazabilidad fuera de la transacción** (`:358-398` →
radicado sin su evento si falla) y sube adjuntos antes de la tx (huérfanos si aborta). Es la
raíz que habilita CR-1. *Cierre:* endpoint server-side con Admin SDK + constructor puro
compartido (cierra en cascada N1/N3/N4). Esfuerzo medio-alto; ya planificado en PLAN_BLOQUE3.

**CR-3 · Sin backups automatizados ni restauración probada.**
`docs/disaster-recovery.md` describe el export como si estuviera programado, pero **no hay
Cloud Scheduler, Action ni script en el repo** que lo ejecute; la restauración nunca se
probó. Para registros legales, es el riesgo de pérdida irreversible.

**CR-4 · Branch protection inactiva en `main`.**
Los 3 checks (validate / emulador / informe de gobernanza) **no son required** → la compuerta
ADR-0013 reporta pero no impide un merge en rojo. Toda la inversión en gates es opcional en
la práctica. *Cierre:* acción de administrador del propietario (5 minutos).

**CR-5 · Pipeline en rojo hoy por vulnerabilidad de dependencia (verificado).**
`npm audit` sobre `d1414bd`: **1 alta + 1 moderada** (`js-yaml`, `protobufjs`) — tercera
advisory de la semana. Sin Dependabot, cada una es parche manual reactivo con `main` en rojo.

## 5. Riesgos medios y menores

**Medios:** crons full-scan sin `maxDuration` (alertas de plazo legal se truncan en silencio
a escala — devops+datos); `useSalidas` con suscripción sin cota **invisible al gate** de
rendimiento (falso verde — datos A-4); despliegue de reglas/índices manual con drift (devops
C2); `FormRespuesta.tsx:141,161` escribe a la colección legacy `radicados` que las reglas
niegan (`update:if false`, verificado — función rota o código muerto alcanzable); Excel MIPG
N+1 y copiloto con doble full-scan (datos A-2/A-3); test de concurrencia H3 contra emulador
**reimplementa la lógica** en vez de ejercer el código real (qa); `storage.rules` sin ninguna
prueba de comportamiento (qa); gate R11 sin test propio (qa); endpoint WhatsApp sin verificar
pertenencia radicado↔tenant ni teléfono↔solicitante (seguridad M-3); God component
`dashboard/page.tsx` (5160 líneas, 62 `useState`); huérfanos de Storage sin conciliación (N8);
sin librería de validación de esquema (zod) en 73 rutas; outcome del gate de índices no llega
al informe de gobernanza (qa).

**Menores:** código muerto (`lib/radicacion.ts`, `generarRadicadoInstitucional`) con formato
de id obsoleto; `firestore-schema.ts` documenta el modelo retirado (2 de ~30 colecciones);
Playwright E2E fuera de CI; contador de consecutivos global no aislado por tenant (puerta del
multi-municipio); sin verificación fail-closed de env en build; Docker sin `NEXT_PUBLIC_*` en
build; README de operación delgado; sin medición de cobertura (%); parseo ZIP de magic-bytes
por local headers (falla cerrado).

## 6. Deuda técnica priorizada

| Prioridad | Deuda | Impacto | Esfuerzo |
|---|---|---|---|
| P0 | Migrar ruta interna a servidor + constructor puro (D1/D2) → cierra N1/N3/N4 | Muy alto | Alto |
| P0 | Cerrar reglas `counters`/`create` (tras D1) | Alto | Bajo |
| P0 | Automatizar dependencias (Dependabot) + `npm audit fix` | Alto | Bajo |
| P0 | Branch protection en `main` | Alto | Trivial (propietario) |
| P0 | Backups automatizados + 1 restauración probada | Alto | Medio |
| P1 | `maxDuration` + consultas acotadas en crons; acotar `useSalidas` | Medio-alto | Bajo |
| P1 | Verificar/arreglar `FormRespuesta` (legacy) | Medio | Medio |
| P1 | Conciliación de huérfanos de Storage (N8) | Medio | Medio |
| P1 | Test de concurrencia H3 contra código real; reglas de Storage en emulador; test del gate R11 | Medio | Medio |
| P1 | Verificación de pertenencia en WhatsApp | Medio | Bajo |
| P2 | Descomponer God component del dashboard | Medio | Alto |
| P2 | Unificar modelo dual + renombrar `clasificacionIA` (OAT-01) | Medio | Alto |
| P2 | Borrar código muerto; regenerar schema; medir cobertura; Playwright en CI; `docs/OPERACION.md` | Bajo-medio | Bajo-medio |
| P3 | Contador aislado por tenant (precondición multi-municipio); esquemas zod | Medio (futuro) | Medio |

## 7. Fortalezas actuales (reales, no cosméticas)

- **`consecutivo-legal.ts`** — transacción contador↔documento con guarda `WeakMap<Transaction>`
  que impide confirmar un contador no leído en la misma tx. Diseño senior.
- **Radicación pública** completamente resuelta: Admin SDK, atomicidad, magic-bytes (con
  rechazo de macros), token de consulta hasheado, staging→tx→finalize.
- **Aislamiento por tenant probado**: 75 casos reales contra emulador Firestore (ADR-0007/0008).
- **Tipado estricto genuino**: 0 `any`, `tsc` limpio sobre ~59k líneas.
- **Observabilidad diagnosticable**: logger estructurado + Sentry en 3 runtimes + eventos de
  negocio, todo con saneo de PII.
- **Gobernanza con sustancia**: gates de rendimiento e índices que **bloquean** regresiones
  reales ya vividas; ADRs con correlato en código; deuda inventariada con archivo:línea.
- **Contingencia de IA real**: fallback local determinista si Gemini cae (código, no papel).
- **Suite estable**: 1116/1116 en dos corridas, sin flakes.

## 8. Oportunidades de mejora

- **Corto plazo (días):** `npm audit fix` + Dependabot; branch protection; `maxDuration` +
  acotar crons y `useSalidas`; cablear el gate de índices al informe de gobernanza.
- **Mediano plazo (1-2 bloques):** pieza angular D1/D2 → cierre de N1/N4; backups automatizados
  + restauración probada; conciliación de Storage (N8); reforzar los tests que hoy dan falso
  verde (H3 real, Storage rules, gate R11); verificación de WhatsApp.
- **Largo plazo:** descomponer el dashboard; unificar modelo de datos; contador por tenant;
  módulo C2 de comunicaciones internas; procedimiento de contingencia P-007; medición de
  cobertura y esquemas de validación.

## 9. Recomendaciones para llevar a excelencia

1. **Convierte los gates en obligatorios** (branch protection) — hoy la mejor ingeniería del
   proyecto es opcional.
2. **Cierra el flanco de integridad legal** (pieza angular + reglas del contador) antes de
   cualquier crecimiento — es la razón de ser del sistema.
3. **Demuestra la recuperación**, no la documentes: backup automatizado + una restauración real
   a stage.
4. **Automatiza la higiene de dependencias** — tres parches manuales en una semana es señal.
5. **Cierra la brecha entre "verde" y "seguro"**: tests que ejerciten el código real, no su
   texto ni su reimplementación; y que el falso verde de `useSalidas`/gate R11 no exista.

## 10. Plan de acción priorizado (orden recomendado)

1. **Semana 1 (rápido, alto impacto):** `npm audit fix` (desbloquea el pipeline) + Dependabot;
   branch protection en `main`; `maxDuration` en los 4 crons + acotar `useSalidas`.
2. **Bloque siguiente (estructural):** pieza angular D1/D2 (ruta interna → servidor + constructor
   puro) → **luego** cerrar `counters`/`create` en reglas; verificar y resolver `FormRespuesta`.
3. **Endurecimiento operativo:** backups automatizados + restauración probada; conciliación de
   huérfanos de Storage; verificación de pertenencia en WhatsApp; automatizar el deploy de reglas.
4. **Calidad de la red de seguridad:** test de concurrencia H3 contra código real; reglas de
   Storage en emulador; test del gate R11; cablear OUTCOME_INDICES.
5. **Mantenibilidad:** descomponer el dashboard; unificar modelo dual; borrar código muerto;
   medir cobertura; Playwright en CI; runbook único de operación.
6. **Habilitadores de futuro:** contador por tenant; C2 comunicaciones; contingencia P-007.

*(Nota transversal, fuera del código: cerrar el Bloque 2 con la firma de las 13 constancias
AGN y configurar el buzón institucional SMTP — pendientes del propietario ya conocidos.)*

---

## Conclusión ejecutiva

**¿Confiarías en poner este sistema en producción hoy?**
No hoy, y no por fragilidad del núcleo — el camino crítico es sólido — sino porque cinco
salvaguardas operativas no están cerradas: el contador legal es escribible desde el cliente,
no hay backups probados, la compuerta no bloquea, el pipeline está rojo por una dependencia, y
dos crons de plazos legales no escalan. Para una plataforma que custodia el registro oficial de
un municipio, esos cinco puntos deben cerrarse antes del corte. La buena noticia: cuatro de los
cinco son de esfuerzo bajo o son acciones del propietario.

**Nivel de madurez (1-10): 7.** Ingeniería de núcleo y gobernanza de 9; última milla operativa
y flanco de integridad de 4-5. El promedio ponderado es un 7 honesto: mejor que la mayoría de
plataformas públicas de este tamaño, pero con deuda crítica concentrada y aún abierta.

**Los tres mayores riesgos hoy:**
1. Contador legal / `create` escribibles desde el cliente (integridad del registro — la razón
   misma por la que existió H3).
2. Sin backups automatizados ni restauración probada (pérdida irreversible de registros legales).
3. Branch protection inactiva (la gobernanza es asesora, no obligatoria: un merge en rojo puede
   llegar a producción).

**Las tres mejoras de mayor impacto y menor esfuerzo:**
1. `npm audit fix` + Dependabot — arregla el pipeline hoy y elimina el parcheo manual semanal.
2. Activar branch protection — convierte toda la inversión en gates en cumplimiento real (5 min).
3. `maxDuration` + acotar los crons y `useSalidas` — evita el truncado silencioso de alertas
   legales y elimina un falso verde (pocas líneas).

**¿Qué hacer antes de considerar la plataforma consolidada?**
Ejecutar la "pieza angular" (ruta interna a servidor) y cerrar con ella las reglas del contador;
demostrar la recuperación con una restauración real; hacer obligatorios los gates; automatizar
dependencias; y cerrar la brecha entre "verde" y "seguro" en las pruebas (código real, no texto).
Con eso, el sistema pasa de 🟡 a 🟢 y la madurez de 7 a ~9 — el resto (dashboard, modelo dual,
multi-municipio) es evolución, no bloqueo.
