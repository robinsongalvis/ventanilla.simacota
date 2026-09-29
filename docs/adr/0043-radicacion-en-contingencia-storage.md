# ADR 0043 — Radicación interna con soportes en custodia

Fecha: 2026-09-29. Estado: implementación autorizada; apertura y despliegue Production pendientes de revisión.

## Contexto e impacto (nivel 3)

Firebase Storage Production está bloqueado por Billing. Firestore permite el registro
del trámite, pero no se puede afirmar que sus soportes digitales fueron guardados.
Se parte exclusivamente del candidato `54256f54cf1ad0cd1b3c61e59fc3c1424889e3f9`.
Los registros históricos de prueba se conservan, sin migraciones ni borrados.

La continuidad operativa requiere conservar autenticación, roles ADMIN/RECEPCIONISTA,
aislamiento por tenant, términos, validación de datos, reserva única y trazabilidad.
No se modifican Rules, Billing, secretos, dominio, PR #360 ni el candidato original.
Este ADR no sustituye un acto administrativo ni certifica obligaciones normativas.

## Decisión

- Una constante versionada de contingencia bloquea los emisores alternativos de la
  serie. Solo el endpoint interno autenticado puede emitir; no se crea un secreto.
- Se rechaza todo archivo recibido durante contingencia antes de Storage y antes
  de reservar número. La interfaz no ofrece carga de adjuntos en esta entrega.
- El nuevo registro lleva gestión de soportes estructurada, con estado
  `PENDIENTE_STORAGE`, inventario y referencia de custodia física o correo
  institucional. El funcionario confirma conservar los originales. La custodia
  digital externa no se presume verificada por la plataforma.
- El radicado, contador, reserva y evento `ADJUNTOS_PENDIENTES_STORAGE` se guardan
  en la misma transacción. No se altera el estado administrativo del trámite.
- La recuperación posterior es autenticada e idempotente. Solo declara `COMPLETO`
  después de verificar bytes en Storage mediante hash y persistir referencias y
  auditoría en Firestore. No borra ni sobrescribe soportes. Mientras continúe la
  indisponibilidad, el proceso informa el bloqueo y nunca simula éxito.
- La fecha del número y el año de su contador usan America/Bogota. Las pruebas
  cubren medianoche UTC y fronteras de mes/año.
- Se reutiliza `esDatoDePrueba` para excluir históricos de prueba de consultas
  ciudadanas, candidatos de licencias, reparto operativo, contexto IA y mutaciones.
  Su evidencia histórica permanece consultable por los lectores autorizados.
- El dry-run oficial acepta una propuesta explícita solo en memoria, comprueba
  contador y colisiones de 1745/1746 y no escribe configuración ni reservas.

## Seguridad, rendimiento y operación

No se debilita ninguna autorización ni se admite tenant/actor/consecutivo forjado.
La reserva transaccional continúa siendo el control de concurrencia. La custodia
obligatoria evita confundir un registro sin soporte digital con un expediente
completo. Un operador debe conciliar diariamente pendientes y originales.
La recuperación usa paths inmutables e idempotencia; un fallo de persistencia deja
el trámite pendiente y no devuelve éxito. Puede dejar un objeto huérfano para
conciliación posterior, nunca borrar datos como compensación automática.

No se incorporan decisiones IA ni nuevas dependencias. El cambio aumenta los
controles de flujo y sus pruebas, no rediseña módulos ajenos. La contingencia
no resuelve Billing, backups, dominio, SMTP, Sentry ni capacidad.

## Validación y límites de autorización

Pruebas locales completas y revisión cruzada, seguidas de **una** radicación
sintética en Stage con sesión legítima y datos sintéticos. Nunca una prueba en
Production. El contador Production debe permanecer en 27; se propone 1744 para
que el primer real sea 1745. El libro externo está congelado por instrucción
del propietario. Si cambia el mes antes de abrir, no se falsea la fecha: se
solicita revisar el consecutivo previsto.

No se abre ni se despliega Production en esta fase. Evidencia y autorización
administrativa en el acta de apertura y el runbook de esta entrega.
