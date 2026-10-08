# Retrospectiva técnica — preparación de radicación en contingencia

Fecha: 2026-09-29. Alcance: implementación aislada sobre `54256f5`, ADR 0043.
**Contexto histórico:** al cerrar esta retrospectiva, Stage y la autorización
final estaban pendientes. Actualización 2026-10-07: el código ya fue desplegado
en Production; la serie continúa cerrada hasta la apertura operativa con `N`.

## Qué salió bien

- Separar el estado de soportes del estado administrativo conserva términos,
  responsables y auditoría sin simular disponibilidad de Storage.
- Reutilizar la transacción de radicación permite guardar inventario, custodia
  y evento de pendientes junto con el consecutivo y su reserva.
- La revisión cruzada comprobó autenticación, rechazo temprano de archivos,
  aislamiento, preservación de históricos y recuperación idempotente.
- Nota 2026-10-07: la cifra usada en esta retrospectiva era evidencia histórica
  y quedó superada; el inicio real será el `N` confirmado en el libro físico.
- La barrera de apertura y de mes evita emitir el número entonces propuesto antes
  de la autorización o con un período distinto. Ninguna prueba debe consumir `N`
  en Production.

## Qué mejorar

- Inventariar primero el Preview exacto y sus alcances Stage: los overrides de
  ramas anteriores no validan una nueva rama. No sustituir evidencia Stage con
  una prueba contra código antiguo o con usuarios suplantados.
- Serializar pruebas pesadas en la máquina local: varias suites concurrentes
  saturaron recursos y produjeron timeouts. Paralelizar revisión de código,
  no multiplicar procesos de test sin capacidad medida.
- Nombrar avisos accesibles y limpiar el DOM entre pruebas. El nuevo aviso de
  contingencia reveló consultas ambiguas por `role="status"` y aislamiento
  insuficiente en una suite de componentes; se corrigieron las pruebas sin
  deshabilitar la contingencia.

## Deuda y riesgos pendientes

- No hay aún deployment ni ensayo Stage de esta entrega. Preparar configuración
  aislada y flujo protegido `stage-e2e` requiere autorización adicional, sin PR #360.
- Billing y backups siguen fuera de esta intervención. La plataforma no verifica
  la conservación de originales físicos o en correo: se exige custodia y cotejo humano.
- La radicación heredada no garantiza idempotencia entre peticiones HTTP. Ante
  respuesta ambigua, consultar la bandeja antes de volver a enviar.
- La recuperación preparada admite un PDF consolidado de hasta 3 MB. Casos que no
  puedan representarse íntegramente así continúan pendientes hasta acordar otro
  procedimiento; no se deben degradar ni descartar soportes para completar el estado.

## Qué automatizar y patrón reutilizable

Preparar, tras autorización, un ensayo Stage único que verifique proyecto, SHA,
identidad autorizada, ausencia de consumo en rechazos y concordancia entre
radicado, contador, reserva y trazabilidad. Patrón reutilizable: **registro
transaccional con custodia explícita y regularización posterior verificada**,
sin confundir recepción administrativa con almacenamiento digital completo.

## Qué aprendimos y qué regla estorbó sin aportar

La revisión y las restricciones de Production evitaron convertir una urgencia
operativa en pruebas con consecutivos reales. No se identificó una regla de
seguridad o proceso que deba eliminarse. El ajuste necesario fue operativo:
limitar concurrencia de pruebas según recursos y separar preparación local de
autorización para configurar el entorno remoto.
