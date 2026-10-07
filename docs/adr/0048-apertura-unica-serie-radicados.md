# ADR 0048 — Apertura única y bloqueada de la serie de radicados

Fecha: 2026-09-30. Estado: aceptado para validación Stage; Production pendiente de autorización final.

## Contexto

La entrega de contingencia exigía abrir la serie real en 1745. Antes de la
salida, la Secretaría de Gobierno aclaró que un ADMIN debe poder escoger el
primer consecutivo real una sola vez (por ejemplo 1745 o 1755), sin convertir
el contador en una configuración editable durante la operación.

El ajuste administrativo preexistente no satisface esa regla: permite avances
sucesivos. La contingencia aislada tampoco: fijaba 1745 en código. Cualquiera de
las dos opciones permitiría una discrepancia entre el acto de apertura y la
serie que reciben los ciudadanos.

Este es un cambio estructural de nivel 3: modifica el contrato del endpoint,
la historia persistida del contador y la barrera que habilita la emisión real.

## Decisión

- `counters/radicados-{año}` es la única fuente de verdad. Su bloque
  `apertura` registra el primer número elegido y queda con estado `BLOQUEADA`.
- Solo un ADMIN interno activo puede abrir la serie. RECEPCIONISTA puede
  radicar después, pero nunca abrir ni cambiar el inicio.
- La apertura se ejecuta en una sola transacción: lee contador, apertura,
  históricos y reservas; valida; deja `ultimo = primerNumero - 1`; y crea una
  auditoría inmutable. No crea radicado ni reserva, por lo que no consume el
  primer número.
- Repetir exactamente la misma solicitud es idempotente y devuelve la apertura
  existente sin una segunda escritura. Intentar otro número después devuelve
  conflicto. Una apertura incompleta o corrupta bloquea la operación.
- El registro conserva actor, rol, tenant, instante ISO, representación en
  `America/Bogota`, valor anterior, primer número, referencia y el identificador
  de auditoría.
- La radicación interna deja de exigir un número codificado. Exige una apertura
  bloqueada válida y toma el siguiente número del contador. Los emisores
  alternativos continúan cerrados durante la contingencia.
- El valor sugerido en la interfaz es 1745, pero la decisión final pertenece al
  ADMIN autorizado. El campo desaparece después de la apertura.

## Impacto sistémico

- **Seguridad:** no cambian sesión, roles, Rules, secretos ni aislamiento por
  tenant. El Admin SDK sigue siendo la única superficie de escritura del
  contador y la auditoría.
- **Integridad:** la reserva `tx.create` continúa siendo el control de unicidad
  de cada emisión; la apertura no la adelanta ni la simula.
- **Concurrencia:** dos aperturas compiten sobre el mismo contador. Firestore
  reintenta la transacción y solo una decisión puede quedar persistida.
- **Rendimiento:** la revisión completa de históricos y reservas ocurre una
  única vez al abrir. No se añade costo al flujo cotidiano después del corte.
- **UX:** antes de confirmar se muestra el radicado institucional completo;
  después se muestra exclusivamente “Serie abierta desde N”.
- **Normativo:** se preservan consecutivos históricos, autoría y explicación
  del salto. Este ADR no sustituye el acto administrativo de la Alcaldía.
- **IA:** no interviene en la elección ni en la apertura.
- **Deuda/reutilización:** se reutilizan el contador anual, la transacción, la
  reserva de unicidad y los helpers de formato/fecha existentes; no se crea una
  segunda colección mutable para configurar la serie.

## Validación obligatoria

Antes de Production: auditoría de dependencias sin HIGH/CRITICAL; suite completa;
TypeScript, lint y build; Rules y concurrencia en emulador; Linux/Node 24; y
Stage aislado. Stage puede usar números sintéticos propios. Ninguna prueba debe
abrir la serie Production ni consumir 1745, 1755 u otro número real.

La salida se detiene aun con todos los gates verdes hasta recibir autorización
explícita de despliegue Production.
