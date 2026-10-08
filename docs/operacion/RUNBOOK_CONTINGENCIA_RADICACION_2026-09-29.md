# Runbook de radicación en contingencia

Estado: procedimiento actualizado el 7-oct-2026; **serie Production pendiente de apertura**.
La evidencia de despliegue y del SHA activo se valida por separado antes de
operar. Decisiones: ADR0043 y ADR0048.

Adenda 7-oct-2026: los consecutivos 28 y 29 fueron pruebas del propietario cuyos
documentos se borraron durante el diagnóstico. No fueron trámites ciudadanos ni
un incidente. Sus reservas permanecen como evidencia de consumo y esos números
no se reutilizan. El número inicial real no es 1745 ni otra cifra precargada:
es `N`, tomado del libro físico y escrito por el ADMIN al momento del corte.

## Invariantes

- Solo ADMIN/RECEPCIONISTA activos, con sesión interna legítima, radican.
- Todos los otros emisores de esta serie quedan bloqueados en esta entrega.
- Ningún archivo se acepta al radicar; rechazar archivos no consume número.
- Registro, reserva, contador y trazabilidad de soportes pendientes son atómicos.
- Originales permanecen en custodia física identificada o correo institucional
  identificado, con responsable e inventario. No usar correos personales ni
  carpetas temporales sin custodia. No compartir contraseñas, tokens o enlaces
  firmados en referencias de custodia.
- La referencia de custodia documenta una declaración del funcionario; no prueba
  que un correo o archivo externo exista, sea íntegro o contenga todos los soportes.
  El custodio debe comprobar los originales y conciliarlos con el inventario.
- El trámite conserva su fecha, responsable, destino, términos y estado inicial.
  `PENDIENTE_STORAGE` es un estado de soportes, no suspende plazos del trámite.
- No afirmar que hay archivo digital guardado ni borrar originales pendientes.
- Test históricos excluidos de operación; evidencia preservada para auditoría.
- Solo ADMIN abre la serie y elige el primer número una vez. La apertura queda
  bloqueada; RECEPCIONISTA no puede abrirla ni modificarla.
- La pantalla no precarga ni sugiere un número. El ADMIN coteja el libro físico,
  escribe `N` y confirma que el libro quedó congelado antes de abrir.
- Abrir deja el contador en `N-1`, sin crear radicado ni reserva. El primer
  número se consume únicamente con el primer trámite real en Production.

## Validación antes de pedir apertura

1. Validar lint, TypeScript, tests unitarios, build, Rules y transacciones en
   emulador aislado. Revisión cruzada independiente sobre la entrega completa.
2. Identificar Preview exacto de la entrega: URL, Deployment ID y SHA. Verificar
   configuración cliente y Admin exclusivamente `ventanilla-simacota-stage`.
   No reutilizar el Preview del candidato antiguo para validar código nuevo.
3. Confirmar protección del Preview y el environment GitHub `stage-e2e` para
   cualquier ejecución automatizada con sus secretos. Un environment de GitHub
   no sustituye la protección de acceso del navegador en Vercel.
4. Usuario autorizado inicia sesión por la UI; no generar custom tokens ni
   suplantar usuarios. No capturar contraseña/cookie en archivos o reportes.
5. Hacer peticiones negativas (sin sesión, rol no autorizado, archivo enviado)
   y demostrar ausencia de incremento/reserva. No enviar correos ni llamar IA.
6. Crear **un solo** radicado sintético en Stage: nombre `PRUEBA CONTINGENCIA`,
   datos ficticios, custodia de un soporte sintético, sin adjuntos. Identificarlo
   como prueba en Stage de forma trazable, sin borrarlo ni reutilizar su número.
   Sin reintentos automáticos de creación: ante respuesta ambigua leer el registro.
7. Leer radicado, reserva, contador y eventos determinísticos: confirmar estado
   `PENDIENTE_STORAGE`, actor real de la sesión y auditoría atómica. Comprobar
   ausencia de duplicados. La concurrencia se ensaya en emulador, no creando un
   segundo radicado Stage ni consumiendo `N` o cualquier consecutivo Production.
8. Ejecutar dry-run de Production abajo y detenerse con evidencia.

### Bloqueo actual de la validación Stage

Todavía **no existe un deployment de esta nueva entrega**. Los overrides de
Firebase Stage identificados están limitados a ramas de validaciones anteriores;
su existencia no acredita aislamiento para `contingency/radicacion-2026-09-29`.
No asumir que Preview general apunta a Stage, ni utilizar una URL de código
anterior para declarar esta entrega validada.

Se requiere autorización nueva y explícita para preparar la configuración aislada
de esta entrega y un flujo protegido `stage-e2e` independiente de PR #360. Su
alcance debe delimitar el Preview de contingencia, el proyecto Firebase Stage,
la sesión legítima y la única radicación sintética autorizada. No hay autorización
en esta fase para modificar Vercel, secretos existentes, Production o PR #360.
No alterar protecciones para obtener la prueba. Hasta disponer del entorno
correcto y ejecutar la prueba, Stage permanece pendiente y no se habilita
la apertura ni el despliegue Production.

## Preflight oficial (sin escritura)

Con credencial Production cargada únicamente en memoria mediante el mecanismo
seguro del operador, sin imprimirla ni escribirla en archivos nuevos, definir
`N` con la cifra recién cotejada en el libro físico y ejecutar:

```sh
node scripts/operacion/abrir-series.mjs \
  --proyecto ventanilla-unica-f31b1 \
  --propuesta-contingencia-solo-lectura \
  --primer-numero N
```

También consultar la pantalla autenticada **Apertura de serie** sin confirmar
ninguna acción. Debe mostrar el contador vigente, ausencia de apertura previa y
el campo de inicio vacío. El preflight debe imprimir ese contador, `N-1`, `N`,
cero colisiones documentales/reservas desde `N` y `PRODUCTION_WRITES=false`.
Antes de confirmar se comprueban históricos y reservas; cualquier discrepancia
detiene la apertura. Las salidas antiguas 27/1745 son evidencia histórica
superada y no deben usarse como instrucción.

## Apertura futura — NO ejecutar en esta fase

Requiere Stage validado, revisión y autorización final. Mantener congelado el
libro externo. **No abrir el contador antes de cerrar todos los emisores.**

1. Tras autorización explícita, desplegar primero la entrega aprobada en estado
   cerrado. El contador conserva su valor vigente (29 fue el último observado
   tras las pruebas 28/29): la barrera del endpoint interno impide emitir sin
   apertura formal y los emisores alternativos quedan bloqueados.
   Comprobar sesión, permisos y lecturas, sin radicación sintética Production.
2. Demostrar que ningún otro emisor puede acceder a la serie para emitir. Incluir
   deployments antiguos y cualquier otra URL o proceso con acceso a la misma base:
   cambiar el alias principal no acredita su cierre. Si no puede demostrarse
   ese aislamiento, **no abrir la serie**. Toda medida adicional sobre acceso,
   deployments, configuración o credenciales requiere su propia autorización;
   este runbook no autoriza revocaciones ni cambios automáticos.
3. En la ventana de corte, consultar el libro físico, congelarlo y repetir el
   preflight con ese `N`. El ADMIN escribe el **primer número** `N` y confirma
   una sola vez. La transacción relee el contador vigente `C`, comprueba ausencia
   de apertura previa, históricos y reservas incompatibles, registra autoridad,
   referencia, fecha, `veniaDe: C` y `abiertoEn: N`, y deja el contador en `N-1`
   sin alterar históricos ni otras series.
4. Verificar por lectura la apertura y la persistencia del cierre de los demás
   emisores. Habilitar operativamente recepción únicamente entonces. El primer
   trámite **real** consume `N`; el siguiente real, `N+1`. No probarlos.

El script legado de apertura general hace escrituras secuenciales: **no usarlo
a ciegas como apertura de contingencia**. La futura ejecución debe contar con
una operación transaccional acotada, auditable y revisada. No simular la apertura
para poner en verde el expediente técnico.

La barrera del endpoint interno impide emitir antes de una apertura bloqueada y
válida. La máscara usa el período real de `America/Bogota`; nunca se cambia el
reloj ni se retrofecha para forzar el identificador mostrado como ejemplo. El
preflight debe repetirse inmediatamente antes de cualquier apertura futura.

## Operación cotidiana

Capturar solicitante, trámite, asunto, destino, folios/anexos, inventario de
soportes y custodia. Confirmar preservación del original. Entregar constancia
con número y fecha del servidor y advertencia de soportes pendientes.
Conciliar diariamente registro↔inventario↔originales con responsable asignado.
Si un trámite ya fue creado y falla impresión o red, buscarlo antes de reenviar:
no existe garantía de idempotencia del POST de radicación histórica.

## Recuperación posterior de soportes

Cuando Billing y Storage sean recuperados y se autorice esta fase, acceder con
sesión interna al proceso autenticado `POST /api/radicados/{id}/regularizar-adjuntos`.
Esta entrega prepara el endpoint, pero **no habilita una interfaz de carga** ni
autoriza ejecutar ahora la regularización. El procedimiento futuro debe usar una
sesión legítima ADMIN/RECEPCIONISTA; no generar identidades sustitutas ni exportar
credenciales a documentos, comandos de ejemplo o evidencias.

Preparar un único PDF consolidado de **máximo 3 MB**, cotejarlo documento por
documento con el inventario y los originales y confirmar integridad mediante
`confirmacionIntegridad=true`. Si la consolidación pierde información o no cabe
sin degradar soportes, mantener `PENDIENTE_STORAGE` y solicitar un procedimiento
autorizado adecuado; no confirmar una carga parcial como completa. El servidor
valida bytes, guarda ruta inmutable derivada de SHA256, vuelve a leer Storage y
verifica hash; luego confirma referencias, estado `COMPLETO` y auditoría en
una transacción. No mostrar hashes completos al usuario ni crear logs de bytes.

Un reintento del mismo PDF no duplica la auditoría. Un contenido distinto sobre
un registro completo se rechaza. Si Storage o persistencia fallan, permanece
pendiente y el endpoint informa el error; no borrar originales ni compensar borrando
archivos. Conciliar objetos sin referencia si hubo fallo entre Storage/Firestore.
La comprobación de hash garantiza transporte, no que el operador digitalizó
todos los documentos: se exige cotejo humano del inventario antes de confirmar.

## Riesgos temporalmente aceptados y reversión

Billing/Storage y backups continúan bloqueados. No hay respaldo verificado de
los soportes custodiados por esta plataforma. Esto exige custodia y conciliación
humana, no una promesa técnica de recuperación. Dominio/Sentry/capacidad siguen
en su matriz independiente. No ejecutar carga ni recuperación de backups.

Ante incidente, detener nuevas radicaciones y conservar registros/reservas/
trazabilidad. Nunca bajar contador ni borrar trámites para volver a probar.
No volver a una versión que habilite otros emisores sin revisar sus efectos.
