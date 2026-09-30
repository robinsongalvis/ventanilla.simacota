# ADR-0047 — Autenticación interna centralizada y autorización explícita de recursos

- **Estado:** ACEPTADO — implementación por fases en curso.
- **Fecha:** 29-sep-2026.
- **Relacionado:** ADR-0001 (sistema operativo de ingeniería), ADR-0046
  (la interfaz no es barrera de seguridad).

## 1. Contexto medido

La API tiene 91 Route Handlers. Cuarenta y cuatro ya consumen
`requireActiveInternalUser`, mientras 24 verifican directamente la cookie de
Firebase. Descontando logout y dos rutas E2E exclusivas de Preview, quedan 21
rutas y 28 handlers normales con guards locales.

Los guards no son equivalentes: algunos aceptan roles o tenants por `cast`,
otros convierten una cookie inválida en 500, otros responden 401 ante falta de
rol y tres inventan silenciosamente `FUNCIONARIO` o `VENTANILLA_UNICA` cuando
el perfil está incompleto. Esa divergencia hace que una corrección de seguridad
deba repetirse en más de veinte lugares.

La comprobación previa, agregada y de solo lectura, no imprimió identidades:

| Entorno | Perfiles | Habilitados | Rol inválido | Tenant ausente/inválido | Firmantes sin `cargo` |
|---|---:|---:|---:|---:|---:|
| Production (`ventanilla-unica-f31b1`) | 19 | 9 | 0 | 0 | 3 |
| Stage (`ventanilla-simacota-stage`) | 7 | 7 | 0 | 0 | 2 |

Por tanto, validar rol y tenant contra los catálogos oficiales no bloquea hoy
ninguna identidad. `cargo` debe seguir siendo opcional: faltan datos reales y
esta entrega no está autorizada para reescribir usuarios.

## 2. Decisión

1. `requireActiveInternalUser` es la única fuente de identidad interna para
   rutas normales. Valida cookie revocada, documento de usuario, estado,
   catálogo cerrado de roles y tenant oficial.
2. La verificación de credencial y la lectura de Firestore se separan:
   - cookie ausente, inválida, expirada o revocada → 401;
   - sesión válida con perfil inexistente, inactivo, archivado, rol o tenant
     inválido → 403;
   - indisponibilidad explícita de Firebase/Firestore → error de
     infraestructura, sin convertir indiscriminadamente cualquier excepción
     en «sesión inválida». Límite del SDK: Firebase Admin también traduce
     ciertos fallos al descargar certificados a `auth/argument-error`, el
     mismo código de una cookie inválida. Esa ambigüedad no se resuelve
     inspeccionando mensajes internos ni relajando la validación.
3. La sesión común incorpora `cargo?: string`, sin inventar un cargo cuando el
   perfil no lo tiene.
4. Cada ruta conserva de forma explícita su matriz de roles y tenant. Un helper
   de identidad no sustituye la autorización del recurso.
5. Quedan deliberadamente fuera del helper obligatorio:
   - logout, que debe limpiar la cookie aunque sea inválida;
   - dos endpoints E2E cerrados en Production, cuyos roles de laboratorio no
     pertenecen al dominio operativo;
   - cualquier acceso ciudadano explícitamente opcional. Mientras el PDF de
     firma no tenga un contrato ciudadano activo, autentica antes de leer.
6. La migración se divide en dos fases verificables:
   - **identidad:** reemplazar guards duplicados sin ampliar permisos;
   - **recursos:** cerrar los hallazgos de acceso horizontal con pruebas de
     tenant y pertenencia.
7. Ocho consumidores que ya usaban el helper, pero convertían cualquier fallo
   inesperado en 401, adoptan también el adaptador HTTP. Así, la fase de
   identidad deja 29 rutas y 36 handlers con una traducción común, sin cambiar
   sus contratos de rol ni sus cabeceras de seguridad.
8. El ajuste de consecutivo añadido en `d32e961` adopta también el adaptador
   y el rol efectivo ADMIN. Cada ajuste crea una entrada nueva en la colección
   existente `admin_auditoria` en la misma transacción que el contador; el
   resumen `ultimoAjusteManual` se conserva, pero ya no sustituye al historial.
   No se ejecuta ningún ajuste en un entorno real como parte de esta entrega.

## 3. Taxonomía HTTP

| Estado | Significado |
|---|---|
| 401 | Credencial ausente, inválida, expirada o revocada. |
| 403 | Identidad válida sin rol, estado, tenant o permiso suficiente. |
| 404 | Recurso inexistente, solo después de superar autenticación y gate de rol. |
| 400/422 | Payload o transición de negocio inválida. |
| 500 | Fallo real de infraestructura, con mensaje público genérico. |

## 4. Autorización de recursos que no resuelve el guard

La auditoría encontró siete superficies que requieren controles propios:

- Copilot carga contexto de un radicado sin comprobar que el actor pueda verlo.
- Borradores acepta un `radicadoId` arbitrario para lectura y escritura.
- Notificaciones permite marcar IDs arbitrarios como leídos.
- Trazabilidad no limita al jefe a su tenant.
- Firma confía en radicado, aprobación y dependencia enviados por el cliente
  sin demostrar su coherencia.
- Normograma permite listar `plantillas_respuesta` sin limitar el tenant,
  aunque el endpoint canónico de plantillas sí aplica ese aislamiento.
- Los endpoints de feedback SIMI/IA aceptan un `radicadoId` arbitrario y
  escriben relación o estado sin demostrar antes que pertenezca al alcance del
  actor autenticado.

Estos hallazgos no se dan por resueltos al cambiar el helper. Cada uno exige
una lectura servidor del recurso, comparación de tenant/destinatario y una
prueba que demuestre ausencia de lecturas o escrituras después de denegar.

### Política aplicada a los recursos

- Borradores y feedback reutilizan `canReadTenant`: ADMIN, RECEPCIONISTA y
  CONTROL_INTERNO conservan lectura global; los demás, su dependencia. El
  tenant persistido corresponde al radicado real, no al body ni al actor.
- Un `approvalId` o `auditoriaId` debe existir y enlazar exactamente el
  radicado autorizado. No se exige que una aprobación histórica de ADMIN
  tenga su tenant igual al destino: su productor almacenaba el tenant del
  actor. La firma por JEFE sí exige tanto el tenant del radicado como el de
  la aprobación, manteniendo la matriz vigente de ese módulo.
- Notificaciones exige simultáneamente tenant, rol destinatario y UID cuando
  exista. PATCH valida todas antes de escribir y confirma el lote atómicamente.
- La auditoría de feedback IA y su actualización del radicado se confirman
  juntas: una caída no deja un feedback parcial presentado como éxito.
- Trazabilidad y versiones no traducen fallos de consulta en historiales
  vacíos. Un índice ausente debe verse como fallo, no como evidencia de que
  no ocurrió nada.
- Copilot autoriza el radicado antes del contexto/IA y acota el contexto a su
  dependencia y las auditorías a ese radicado. No se cambia su lector cliente
  a Admin SDK como atajo: ese flujo aún requiere validación funcional, porque
  la sesión HTTP no autentica automáticamente al SDK cliente del servidor.

## 5. Impacto sistémico

- **Técnico:** desaparecen 20 helpers locales y tres guards inline. No cambia
  el modelo de Firestore ni las reglas.
- **Funcional:** se conservan roles permitidos y alcance por dependencia; solo
  se normalizan errores antes inconsistentes.
- **Seguridad y datos personales:** se rechazan perfiles forjados o
  incompletos y se reduce el riesgo de lectura transversal entre dependencias.
- **Rendimiento:** cada solicitud mantiene una verificación de cookie y una
  lectura de `users/{uid}`; no se añaden consultas en la fase de identidad.
  Los controles de recurso reutilizan documentos que el flujo ya necesita
  siempre que sea posible.
- **UX:** mensajes de autenticación coherentes en español; no se presenta una
  caída de Firebase como si la contraseña hubiera expirado.
- **Normativo:** el aislamiento por dependencia y la trazabilidad de quién
  actúa se preservan; no se automatiza ninguna decisión administrativa.
- **IA:** SIMI/Copilot continúa sugiriendo; la identidad centralizada no le
  concede acceso adicional ni capacidad decisoria.
- **Deuda y reutilización:** cualquier rol o regla de vigencia futura se cambia
  una vez. No se mueve todavía `RolInterno` para evitar un refactor de 66
  consumidores sin beneficio funcional inmediato.

## 6. Pruebas y compuertas

1. Pruebas directas del helper: cookie ausente/inválida, perfil inexistente,
   inactivo/archivado, rol inválido, tenant ausente/no oficial, cinco roles
   válidos, `cargo` opcional y fallo de Firestore no convertido en 401.
2. Contrato ejecutable de 36 handlers: 401 sin sesión, 500 por infraestructura,
   19 gates de rol con 403 y ausencia de acceso a Firebase tras denegación, salvo la auditoría de
   intentos rechazada que `/api/ai/log` realiza de forma deliberada.
3. En la fase de recursos, pruebas de tenant para radicado, aprobación, firma,
   WhatsApp, reportes, trazabilidad, borradores y notificaciones. Estas no se
   confunden con la compuerta ya cerrada de identidad.
4. `tsc`, lint, suite completa y build. El build Turbopack local puede requerir
   un entorno que permita abrir su puerto de proceso; Webpack sigue siendo una
   compuerta válida para el contrato de exports de Next, pero no reemplaza el
   build oficial de CI/Vercel.

## 7. Alternativas descartadas

- **Reemplazo textual de guards:** cambia códigos HTTP sin fijar contratos y
  deja intactos los accesos horizontales.
- **Un guard por módulo:** reduce duplicación local pero conserva múltiples
  fuentes de verdad.
- **Confiar en Firestore Rules:** estas rutas usan Admin SDK y, por diseño, las
  reglas del cliente no autorizan sus lecturas servidor.
- **Exigir `cargo` inmediatamente:** bloquearía perfiles válidos observados y
  requeriría una migración administrativa no autorizada.

## 8. Reversibilidad

La fase de identidad no cambia datos. Puede revertirse por commit. Los
controles de recurso son aditivos y tampoco migran documentos; su reversión es
técnica, aunque no se recomienda porque reabriría accesos ya demostrados.
