# Evidencia de la entrega aislada de contingencia

Fecha: 2026-09-29. Base inmutable: `54256f54cf1ad0cd1b3c61e59fc3c1424889e3f9`.
Rama local: `contingency/radicacion-2026-09-29`.

> **EVIDENCIA HISTÓRICA SUPERADA — NO OPERATIVA.** Las cifras 27/1745/1746
> documentan lo observado el 29-sep-2026; no fijan ni sugieren el arranque.
> Desde el 7-oct-2026 el preflight exige `--primer-numero N`, donde `N` se
> coteja en el libro físico al momento del corte. Las pruebas 28 y 29 del
> propietario quedaron consumidas/no reutilizables y no fueron un incidente.

## Alcance y estado

Implementación local; sin push, deployment, apertura de serie ni escrituras de
radicados en Production. Tampoco se realizó todavía la prueba sintética Stage.
Las referencias 1745 y 1746 no se consumieron en esta entrega histórica. Los
históricos no se reescribieron.

Se mantienen sin cambios `.nvmrc`, `package.json`, lockfile, CI, Rules, índices,
secretos, Billing, dominio, candidato original y PR #360. Las dependencias locales
se instalaron desde el lockfile con `npm ci --offline --no-audit --no-fund`.
Runtime de las pruebas locales: Node v22.23.2; Java 21.0.12.1 para el emulador.
La validación Node24 del candidato anterior no acredita por sí sola esta entrega.

## Controles implementados

- Custodia e inventario obligatorios, estado `PENDIENTE_STORAGE` y rechazo de
  todo archivo antes de llamar Storage o reservar consecutivo.
- Documento, contador, reserva única y auditoría de soportes en una transacción.
- Emisores alternativos bloqueados, sin quitar autenticación ni permisos.
- Apertura formal requerida en Production; el número real se ingresa desde el
  libro al corte y usa el período vigente en America/Bogota. No se antedata para
  satisfacer una referencia histórica.
- Recuperación futura autenticada e idempotente: PDF consolidado de hasta 3 MB,
  escritura inmutable, lectura y SHA-256 verificados antes de persistir COMPLETO.
  Path compatible con el autorizador de descargas existente.
- Exclusión canónica de datos de prueba en las superficies operativas revisadas;
  planillas mixtas conservan las reservas reales aunque no sean visibles.

## Revisión cruzada

Se revisaron backend, UI, cuarentena y apertura. Dos defectos encontrados fueron
corregidos antes del cierre de pruebas: una planilla mixta no puede liberar sus
reservas reales; un soporte recuperado debe usar un path que acepte el descargador.
No se corrigieron módulos ajenos a la contingencia ni deuda general de Sentry.

## Validaciones locales

| Comprobación | Resultado observado |
| --- | --- |
| TypeScript (`tsc --noEmit`) | PASS; repetido también por el build |
| Build Next.js 16.3.3 / Turbopack | PASS; 68 páginas estáticas generadas |
| ESLint | PASS; 0 errores y 31 advertencias |
| Gate de dependencias npm | PASS; 0 advisories high/critical el 29-sep-2026 |
| Presupuesto de consultas | PASS; sin violaciones nuevas, deuda declarada visible |
| Gate estático de índices | PASS; sin violaciones nuevas, deuda declarada visible |
| Rules y transacciones en Firestore Emulator | PASS; 112/112, 0 fallos, 0 omitidos |
| Smoke del build en localhost, sin credenciales Admin | PASS; login 200, radicación interna sin sesión 401, emisor público bloqueado 503 |
| Reejecución unitaria focalizada previa | PASS; 108/108 en 9 archivos |
| Batería unitaria completa final | PASS; 294/294 archivos, 3224/3224 tests, 809.92 s, salida 0 |
| Stage con sesión legítima | NO EJECUTADA |

El build falló inicialmente por restricciones del entorno local (symlink de
dependencias fuera de la raíz y apertura de puerto del compilador), no por una
validación que se haya deshabilitado. Se instalaron dependencias físicas desde el
lockfile, se apartó la caché fallida de forma recuperable y se repitió el mismo
build con permiso de puerto local, sin cambios de configuración del proyecto.
Persisten advertencias previas de Sentry y trazado dinámico de `cargar-logo.ts`.

Los 112 tests del emulador incluyen las Rules actuales, colisiones, rollback y
concurrencia contra Firestore local. Los casos nuevos cargan el handler real de
contingencia; autenticación y Storage son fronteras simuladas y declaradas.
No confundir mocks ni emulador con una sesión legítima en Stage. Las pruebas
históricas de modo normal desactivan la constante exclusivamente en sus harnesses
de test; los casos de contingencia mantienen la constante real activa.

## Dry-run histórico de Production — solo lectura, superado

Ejecutado con el modo `--propuesta-contingencia-solo-lectura`. Credencial utilizada
únicamente en memoria, sin imprimirla. Salida:

```text
CURRENT_COUNTER=27
PROPOSED_COUNTER_VALUE=1744
PROPOSED_FIRST_NUMBER=1745
EXPECTED_NUMBER_CHECK=OK
TARGET_DOCUMENT_COLLISIONS=0
TARGET_RESERVATION_COLLISIONS=0
HISTORICAL_TEST_RECORDS=19
PRODUCTION_WRITES=false
SERIES_DRY_RUN_OK=true
```

Es una observación puntual, no una reserva. Debe repetirse antes de una futura
apertura autorizada con `--primer-numero N`; su salida debe usar el contador
vigente y revisar cualquier documento o reserva del año con consecutivo igual o
posterior a `N`. La apertura futura requiere una transacción acotada y revisión;
no se autoriza usar el ejecutor legado secuencial como sustituto.
Además, exige desplegar primero la entrega aprobada en estado cerrado, manteniendo
el contador en su valor vigente, y demostrar el cierre de todos los demás emisores, incluidos
deployments antiguos u otras URLs y procesos con acceso a la base. Si ese cierre
no puede acreditarse, no se abre la serie. Después de esa verificación procede
la apertura transaccional autorizada y la habilitación operativa de recepción.
Esta secuencia es futura: no se ejecutó ningún despliegue ni apertura en esta fase.

El `SERIES_DRY_RUN_OK=true` de este bloque acredita únicamente la lectura
puntual del 29-sep-2026; no acredita el número ni el contador de una apertura
posterior.

## Bloqueo de Stage y acceso

No hay URL, Deployment ID ni SHA servido correspondientes a esta entrega. El
Preview del candidato anterior no sirve para validar el código nuevo.
Los overrides observados de Firebase Stage están asociados a ramas anteriores,
no a esta rama. No se publicará suponiendo que heredará el aislamiento correcto.
Se requiere revisar y autorizar su configuración Stage y un flujo protegido
`stage-e2e` independiente de PR #360. Ese environment de GitHub no equivale a
autenticación del navegador ni reemplaza la protección de Vercel.

Durante una lectura de metadatos de protección de Vercel se expuso en la salida
de una herramienta un identificador que debe tratarse como posible credencial
de bypass. No se reproduce en este documento, no se usó y no se guardó en archivos
nuevos. Se detuvieron las consultas y se informó al propietario. Revisar ese
acceso y una posible revocación/rotación requiere autorización explícita; no se
modificó ninguna protección ni secreto automáticamente. Esta incidencia debe
resolverse antes de publicar el Preview.

## Estado de las puertas de revisión

```text
CONTINGENCY_STAGE_VALIDATION=false
SERIES_DRY_RUN_OK=true
PRODUCTION_READY_FOR_CONTINGENCY=false
PRODUCTION_WRITES=false
PRODUCTION_DEPLOYMENT_CREATED=false
```

No se certifica operación ni seguridad end-to-end de Stage sin la prueba única con
sesión legítima. El propietario dispone de una cuenta de prueba y solicita conocer
URL, Deployment ID, SHA, Firebase Stage y protección antes de iniciar sesión.

## Riesgos residuales

Billing, Storage y backups siguen pendientes fuera de esta entrega. Custodia y
conciliación humana son obligatorias. El POST de radicación preexistente no es
idempotente: ante respuesta ambigua se consulta el registro antes de repetir.
El hash de recuperación verifica bytes, no la integridad administrativa del
inventario: el funcionario coteja originales. Ningún cambio suspende términos.

Referencias: ADR0043, runbook y registro de autorización de apertura de esta fecha.
