# Auditoría GO/NO-GO de producción — 23-ago-2026

**Commit auditado:** `c11e140` (main desplegado en producción) · **Método:** 6 dimensiones
auditadas contra el código real (el código manda sobre los checklists), con refutación
adversarial de cada candidato a bloqueante bajo la vara «¿qué pasa exactamente el día D?».

**Totales:** 🔴 0 · 🟠 27 · 🟡 21 · 🟢 9

**Veredicto: GO CONDICIONADO — 0 bloqueantes rojos.** El sistema puede operar el día D;
los 🟠 forman el paquete de cierre previo al go-live formal (ver PLAN_GO_LIVE.md).


---

## SEGURIDAD — reglas, autenticación, autorización, aislamiento

> **Veredicto:** El núcleo de seguridad es sólido y operable, pero hay que cerrar las puertas de escritura de cliente sobre el registro legal y retirar cuentas de prueba antes de operar con datos reales.

### 🟠 CR-1: counters/ escribible por cliente (admin/recepcionista) — consecutivo legal manipulable

- **Dónde:** firestore.rules:208-211
- **Qué pasa el día D:** Un RECEPCIONISTA autenticado (incluida la cuenta huérfana recepcionista.test@ que sigue en prod) escribe directamente counters/radicados-2026 vía SDK y salta, reinicia o colisiona el consecutivo AGN. El siguiente radicado real nace con número repetido o fuera de serie y se rompe la foliación oficial del municipio.
- **Evidencia:** Regla literal: `allow read, write: if isAdmin() || isRecepcionista();`. El candado que lo cerraría está apagado: lib/recepcion/radicacion-interna-flag.ts:20 `USA_RADICACION_INTERNA_SERVER = false`, y la ruta legada escribe el contador desde el cliente (lib/actions/radicarVentanilla.ts:178, 304-315 runTransaction sobre counterRef).
- **Solución:** Hacer el cutover del flag a true (la radicación interna server ya está construida en /api/radicacion/interna) y cerrar counters a `write: if false`. Esfuerzo ~0.5 día + validación e2e. Depende del propietario para autorizar el cutover (precondición ya conocida).
- **Pruebas después:** Añadir caso a npm run test:rules que asevere que un RECEPCIONISTA NO puede escribir counters/*; correr la matriz de aislamiento con emulador (laboratorio-emulador en CI) en verde.

### 🟠 CR-2: ventanilla_radicados create de cliente sin validar campos — registro oficial forjable

- **Dónde:** firestore.rules:143-144
- **Qué pasa el día D:** Un ADMIN/RECEPCIONISTA (o recepcionista.test@) crea vía SDK un ventanilla_radicados/{id} con termino, estadoActual, cumplioTermino y clasificacion arbitrarios: un registro oficial fabricado que evade TODA la validación server-side. Con fecha de vencimiento falsa, un derecho de petición vencido aparece 'en término' (o al revés), falseando el cumplimiento legal reportado a Control Interno.
- **Evidencia:** Regla literal: `allow create: if (isAdmin() || isRecepcionista()) && request.resource.data.radicadoId == radicadoId;` — la única restricción es que el doc id coincida con el campo; ningún campo de negocio se valida. update/delete ya están en false, pero create sigue abierto al cliente.
- **Solución:** Mismo cutover que CR-1: llevar la creación a server (Admin SDK, que ya valida) y dejar create en false. Esfuerzo incluido en el cutover. Equipo + autorización del propietario.
- **Pruebas después:** test:rules: create desde cliente como admin/recep → denegado. Verificar que /api/radicacion/interna cubre el flujo interno con e2e antes de apagar la ruta legada.

### 🟠 Trazabilidad y salidas también con create de cliente — auditoría y libro de salidas forjables

- **Dónde:** firestore.rules:177 (trazabilidad create) y firestore.rules:192-193 (ventanilla_salidas create)
- **Qué pasa el día D:** Un FUNCIONARIO inyecta eventos de trazabilidad con actorUid/actorNombre/nota arbitrarios sobre radicados de su tenant (p.ej. fabrica 'notificado al ciudadano el 20-ago' sin que ocurriera): el registro de auditoría legal pierde no-repudio. Un ADMIN/RECEPCIONISTA forja una salida 2-SAL con contenido arbitrario aunque el libro se declara inmutable.
- **Evidencia:** canWriteTrazabilidad (firestore.rules:65-70) habilita create de cliente y el actor viaja desde el cliente sin captura en servidor; la ruta legada lo escribe en lib/actions/radicarVentanilla.ts:318. En salidas, el propio comentario de la regla dice 'toda escritura pasa por /api/salidas/registrar con Admin SDK' pero la regla igual permite create de cliente (contradicción código-vs-regla). Contraste: expedientes/actuaciones ya es write:false server-only (D8).
- **Solución:** Migrar trazabilidad y salidas a server-only siguiendo el patrón D8 (actor capturado en servidor), dejando create en false para cliente. Esfuerzo ~1-2 días. Equipo.
- **Pruebas después:** test:rules: create de cliente en ambas subcolecciones/colección → denegado. e2e que confirme que los endpoints server siguen escribiendo trazabilidad y salidas correctamente.

### 🟠 Storage: create exige solo signedIn(), sin perfil interno ni rol

- **Dónde:** storage.rules:28 (radicados/{id}/{archivo}) y storage.rules:38 (respuestas/{id}/{archivo})
- **Qué pasa el día D:** La config NEXT_PUBLIC_FIREBASE_* viaja al navegador. Si el proveedor Email/Password del proyecto permite auto-registro (Identity Toolkit REST) o hay Anónimo activo, un extraño obtiene un token SIN quedar en users/ y sube hasta 10 MB a radicados/{cualquierId}/ y PDFs a respuestas/{cualquierId}/: abuso de costo/almacenamiento y plantado de 'respuestas oficiales' falsas. SERÍA ROJO si el auto-registro/anónimo está habilitado en Auth.
- **Evidencia:** storage.rules:28 `allow create: if signedIn() && isAllowedRadicadoFile();` y :38 análogo para PDF — no hay exists(/databases/.../users/$(uid)) ni verificación de rol. El cliente escribe estas rutas activamente (lib/storage.ts:52 `radicados/{radicadoId}/{filename}`).
- **Solución:** Propietario: verificar en Firebase Auth que Email/Password NO permite signup y que Anónimo está desactivado. Equipo: endurecer la regla a exigir perfil interno (o firebase.exists del doc users) o mover TODA subida a Admin SDK + App Check. Esfuerzo ~0.5-1 día.
- **Pruebas después:** Intento de create en Storage con un token sin perfil users/ → denegado. Captura de los proveedores Auth habilitados confirmando que no hay self-signup ni anónimo.

### 🟠 /api/ai/feedback escribe en colecciones de producción SIN autenticación

- **Dónde:** app/api/ai/feedback/route.ts:5-67
- **Qué pasa el día D:** Un caller anónimo de Internet que derive un radicadoId (formato público 1-110-AAAAMM-NNNNNNNN) sobrescribe el campo feedbackIa de un radicado real y siembra documentos en ai_feedback y ai_auditoria. Contamina la telemetría de IA y el registro del radicado, sin actor real y sin dejar rastro atribuible.
- **Evidencia:** El handler POST no llama a requireActiveInternalUser ni verifica cookie de sesión: solo checkRateLimit por IP (línea 6-17). Escribe `ai_feedback/{feedbackId}` (57), `ventanilla_radicados/{radicadoId}.feedbackIa` (59-67) y `ai_auditoria/{auditoriaId}` (86) vía Admin SDK (bypasea reglas). Es la única ruta /api/ai que escribe estado de negocio sin el guard evaluarAccesoIA ni sesión.
- **Solución:** Anteponer `const user = await requireActiveInternalUser();` (patrón de las demás rutas /interno) y derivar usuarioId/actorNombre de la sesión en lugar del body. Esfuerzo ~2 horas. Equipo.
- **Pruebas después:** POST sin cookie de sesión → 401; test de handler que verifique el rechazo y que actorNombre proviene de la sesión, no del payload.

### 🟠 Cuentas de prueba UAT privilegiadas vivas en producción, sin procedimiento de retiro

- **Dónde:** scripts/uat-1.ts:42-47 (crea recepcionista.test@/funcionario.test@/jefe.test@/controlinterno.test@) — no existe script inverso
- **Qué pasa el día D:** recepcionista.test@ es una cuenta sin dueño con rol RECEPCIONISTA activo en producción. Si UAT_PASSWORD se filtra o es débil, alguien inicia sesión y ejecuta CR-1/CR-2 (renumera el consecutivo y/o forja radicados oficiales). Estas 4 cuentas son exactamente el 'insider autenticado' que hace explotables los hallazgos 1-3.
- **Evidencia:** USUARIOS_TEST en uat-1.ts:42-47 con roles RECEPCIONISTA/FUNCIONARIO/JEFE_DEPENDENCIA/CONTROL_INTERNO; grep de scripts/docs no encontró ninguna rutina de eliminación/desactivación. Neutralización posible sin borrar: resolveClaims devuelve null si `data.activo === false || data.archivado === true` (app/api/auth/session/route.ts:31) — mismo gate en lib/server/internal-auth.ts:57.
- **Solución:** Antes del go-live: desactivar (activo=false/archivado=true) o borrar las 4 cuentas en Firebase Auth + users/. Añadir el paso de limpieza UAT como ítem bloqueante en PRODUCTION_READINESS. Esfuerzo ~1 hora. Propietario/equipo.
- **Pruebas después:** Login con las 4 cuentas .test@ → rechazado (403 'Usuario inactivo o archivado'). Query users/ where email termina en .test@ mostrando activo=false o ausencia del doc.

### 🟠 Sin pipeline ni verificación de despliegue de reglas (drift repo↔producción)

- **Dónde:** .github/workflows/ci.yml (no hay job de deploy de reglas); despliegue manual en FIREBASE_SECURITY.md:53 y PRODUCTION_READINESS.md:119
- **Qué pasa el día D:** Toda la seguridad de cliente descansa en firestore.rules/storage.rules. Como el despliegue es manual y no hay chequeo de drift, no existe forma automatizada de saber qué regla corre en producción. Si lo vivo es una versión anterior o más laxa, el default-deny del repo (que acabo de validar) es ilusorio y datos de ciudadanos podrían estar expuestos sin que nadie se entere.
- **Evidencia:** ci.yml solo ejecuta gates de validación (lint/tsc/test/presupuesto/indices/audit/build/emulador) — ningún paso `firebase deploy`. El único mecanismo documentado es manual: FIREBASE_SECURITY.md:53 `firebase deploy --only firestore:rules,storage` y checklist PRODUCTION_READINESS.md:119 RULES-1.
- **Solución:** Añadir job en CI que despliegue reglas al mergear a main, o al menos un check de drift que descargue las reglas vivas y las compare con el repo (falla si difieren). Puente inmediato: desplegar manualmente ahora y dejar constancia con el hash de main. Esfuerzo ~0.5-1 día. Equipo.
- **Pruebas después:** Corrida del pipeline que falle deliberadamente ante una regla viva distinta a la del repo; evidencia de la corrida en verde tras el deploy.

### 🟡 Catch mudo en /api/auth/session aplana toda excepción a 401

- **Dónde:** app/api/auth/session/route.ts:96-98
- **Qué pasa el día D:** Un fallo de infraestructura (verifyIdToken o setCustomUserClaims caídos) se presenta a los funcionarios como 'Sesión inválida' masiva. Con Sentry dormido (SENTRY_DSN vacío hace 78 días), no hay señal y el incidente se diagnostica a ciegas. Es fail-closed (dirección segura), pero opaco.
- **Evidencia:** `} catch { return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 }); }` — el catch no distingue un 500 de infra de un token realmente inválido y no registra nada.
- **Solución:** Registrar el error (logError/Sentry) antes de devolver 401, separando 500 de infraestructura del 401 de credencial. Esfuerzo ~1 hora. Equipo. Se apoya en que el propietario pegue el SENTRY_DSN para que la señal llegue.
- **Pruebas después:** Forzar una excepción interna simulada y comprobar que queda log/evento observado, mientras el usuario sigue recibiendo 401 sin fuga de detalle.

### 🟡 Documentación de seguridad desactualizada frente a las reglas reales (doc desactualizado)

- **Dónde:** FIREBASE_SECURITY.md:30-39; docs/deployment.md:52
- **Qué pasa el día D:** Quien opere o audite guiándose por el doc concluye un modelo de permisos que no es el vigente y toma decisiones sobre una foto vieja (p.ej. cree que 'los adjuntos pueden subirse sin cuenta' o que 'create de radicados es público solo WEB', cosas que las reglas actuales contradicen).
- **Evidencia:** FIREBASE_SECURITY.md:33 dice 'create de radicados queda publico solo para origen WEB' y :38 'Adjuntos en Storage pueden subirse sin cuenta' — pero firestore.rules:123 tiene `radicados create: if false` y storage.rules:28 exige `signedIn()`. docs/deployment.md:52 habla de roles en 'usuarios/{uid}' cuando el código usa 'users/{uid}' (lib/server/internal-auth.ts:43).
- **Solución:** Regenerar FIREBASE_SECURITY.md desde las reglas vigentes y corregir la ruta de colección en deployment.md. Esfuerzo ~1 hora. Equipo.
- **Pruebas después:** Revisión línea a línea de que cada afirmación del doc corresponde a una regla o ruta actual del repo.


---

## D2 — Integridad: consecutivos, atomicidad, trazabilidad, motor de expedientes

> **Veredicto:** Lista para operar la ventanilla (0 ROJOS): la unicidad AGN 060 está protegida transaccionalmente en la vía cliente que hoy opera y el motor de expedientes tiene el candado DEMO bien amarrado (SerieNoAbiertaError ata el flip a la siembra); pero esa protección descansa en que todos los escritores se porten bien (reglas de counters abiertas a cualquier sesión ADMIN/RECEPCIONISTA, sin monotonicidad) y el único control automático de unicidad alerta a un buzón muerto — las 4 NARANJA son ejecutables en días, no fases.

### 🟠 CR-1 real: counters de TODAS las series escribibles desde cliente, sin monotonicidad — y el estrechamiento parcial es posible HOY sin esperar el cutover

- **Dónde:** firestore.rules:208-211 (match /counters/{document} → allow read, write: if isAdmin() || isRecepcionista())
- **Qué pasa el día D:** Una sesión ADMIN/RECEPCIONISTA comprometida o errada (incluidos los 4 usuarios de prueba UAT que siguen vivos en producción) puede (a) rebobinar counters/radicados-2026: el siguiente radicado legítimo pasa el check '+1' del cliente y su tx.set SOBRESCRIBE en silencio un radicado legal existente (pérdida de un registro con datos de ciudadano; el detector no lo ve — el número queda 'presente'); o (b) crear counters/expedientes-2026 con ultimo:0, lo que desactiva silenciosamente SerieNoAbiertaError — el cron lo reportaría solo como estado PARCIAL, que NO dispara correo (app/api/cron/auditoria-consecutivos/route.ts:121-125, solo CORRUPTO alerta).
- **Evidencia:** grep -n counters firestore.rules → línea 208 sin filtro por serie ni validación de avance. Verificado que HOY ningún cliente escribe otras series: grep de counters en app/lib excluyendo server → solo lib/actions/radicarVentanilla.ts:178 (radicados) y el muerto lib/radicado-institucional.ts:53; salidas/planillas/expedientes van 100% por Admin SDK (app/api/salidas/registrar, app/api/planillas/generar, app/api/dependencias/registro-expres).
- **Solución:** Estrechamiento parcial inmediato (no es el M3 del blueprint, no rompe nada): limitar el write de counters a document.matches('radicados-.*') — única serie que el cliente necesita — y opcionalmente exigir request.resource.data.ultimo > resource.data.ultimo. Esfuerzo: 1 línea de reglas + dry-run + test. Depende de: quien despliega reglas (propietario/devops). Complemento: eliminar los 4 usuarios de prueba (otra dimensión, mismo vector). El cierre total (write:if false) sigue atado al cutover de la pieza angular, como dice el blueprint.
- **Pruebas después:** firebase deploy --only firestore:rules --dry-run verde; test de reglas que pruebe write a counters/salidas-2026 y counters/expedientes-2026 con sesión RECEPCIONISTA → PERMISSION_DENIED, y write a counters/radicados-2026 → permitido; radicar un caso real en UAT y confirmar consecutivo emitido.

### 🟠 El único control automático de unicidad AGN alerta a un canal muerto: correo sin SMTP y logError sin Sentry

- **Dónde:** app/api/cron/auditoria-consecutivos/route.ts:260-292 (destino = AUDITORIA_ALERTA_EMAIL ?? EMAIL_USER; ambas vacías hace 80 días) — cron registrado en vercel.json (lunes 13:00 UTC)
- **Qué pasa el día D:** El lunes siguiente a un hueco o duplicado real en las series legales, el cron lo DETECTA (barrida 100% con cursor, ambas formas de id) pero el hallazgo muere en un logError('Sin destinatario configurado') que tampoco llega a Sentry (DSN vacío): nadie se entera hasta que un ciudadano o un ente de control encuentre el número repetido. El control existe, la alarma no suena.
- **Evidencia:** route.ts:263-268: if (!destino) logError(...) y sigue; el JSON de respuesta con hallazgos solo lo ve quien lea a mano los logs de Vercel. Contexto verificado hoy: EMAIL_HOST/USER/PASS vacías 80 días, SENTRY_DSN vacía 78 días.
- **Solución:** Ya está en curso por el propietario (buzón institucional + pegar DSN): al poblar EMAIL_* y AUDITORIA_ALERTA_EMAIL el circuito queda completo sin tocar código. Mientras llega: revisar manualmente la respuesta del cron cada lunes (o tras cada jornada de radicación) — 2 minutos con el CRON_SECRET. Esfuerzo: solo variables de entorno; depende del propietario.
- **Pruebas después:** Invocar GET /api/cron/auditoria-consecutivos con Bearer CRON_SECRET y hallazgos simulados en stage → correo recibido en el buzón institucional; forzar un logError y verlo en Sentry.

### 🟠 Día D con DEMO-: el motor de licencias NO puede producir trámites reales, y activarlo exige más que el flip (no hay caller de la emisión real)

- **Dónde:** lib/server/expedientes-licencias.ts:47 (EMISION_REAL_EXPEDIENTES_HABILITADA=false) + lib/server/emitir-numero-expediente.ts:93 (emitirNumeroExpedienteReal: CERO callers de producción, verificado por grep) + docs/adr/0031 (17 históricos de 2026, consecutivos {1,4..19}, counters/expedientes-2026 no existe)
- **Qué pasa el día D:** Si Planeación empieza a tramitar licencias reales sobre el motor: cada expediente nace DEMO-{AA}-{8hex} sin serie legal, la constancia al ciudadano se bloquea (con razón: debeEnviarComunicacionExpediente corta todo numeroExpediente DEMO-, expedientes-licencias.ts:820), y el trabajo NO es regularizable después — no existe conversión DEMO→real ni renumeración: habría que recrear cada expediente. Una funcionaria puede imprimir y firmar un proyecto de acto con número DEMO (el chip 'Prueba' es la única defensa visual). Operar la VENTANILLA así es aceptable; operar LICENCIAS reales así, no.
- **Evidencia:** grep emitirNumeroExpedienteReal en app/ → solo comentarios que afirman 'esta ruta JAMÁS lo importa'; la propia lib dice 'una ruta futura orquestaría' (expedientes-licencias.ts:200-204). El candado sí está bien amarrado: SerieNoAbiertaError + exigeAperturaExplicita (consecutivo-legal.ts:104-126) atan flip→siembra, y scripts/migracion/abrir-serie-expedientes.mjs es fail-closed (dry-run default, create nunca set, --libro-confirmado-el obligatorio y reciente).
- **Solución:** Decisión de alcance del propietario para el acta de go-live: (a) declarar explícitamente que licencias opera en modo demostración/piloto el día D (costo cero), o (b) completar la apertura: dato del ingeniero de Planeación → correr abrir-serie-expedientes.mjs → escribir el wiring de la ruta real que llame a emitirNumeroExpedienteReal (código nuevo, ~1-2 días, no solo el flip: hoy dos tests fijan el candado) → UAT. Precisión importante para el go/no-go: 'procedimiento listo, falta el dato' es cierto para la SIEMBRA, pero la EMISIÓN real además necesita cablear la ruta.
- **Pruebas después:** Si (a): texto en el acta + verificar que la bandeja sigue mostrando ChipPrueba en todo expediente nuevo. Si (b): en stage, abrir serie con --verificar, crear expediente real → número 68745-0-26-0020 (siguiente al libro), tx.create de unicidad_expedientes presente, cron reporta la serie sin hallazgos.

### 🟠 Mientras USA_RADICACION_INTERNA_SERVER=false: trazabilidad de RADICACION post-commit (no atómica) y tx.set que sobrescribe en vez de tx.create — el código del servidor que lo corrige está completo y apagado

- **Dónde:** lib/actions/radicarVentanilla.ts:304-335 (tx.set + addDoc de trazabilidad DESPUÉS del commit) y también app/api/radicacion/route.ts:426,440 (la ruta pública comete lo mismo: tx.set + .add post-commit)
- **Qué pasa el día D:** Invariantes sin proteger hoy: (1) atomicidad radicado↔actuación — si el navegador muere entre la transacción y el addDoc, queda un radicado legal SIN su evento RADICACION en la línea de tiempo (auditoría coja de nacimiento); (2) no-sobrescritura — con un contador rebobinado (ver hallazgo CR-1), tx.set pisa en silencio un radicado existente donde tx.create fallaría ruidoso; (3) autorización nace en el navegador, lo que obliga a mantener counters y el create de ventanilla_radicados abiertos (CR-1/CR-2). LO QUE SÍ está protegido hoy: unicidad y no-fantasma en el flujo normal (peek + tx con check '+1': concurrencia aborta y reintenta, el contador y el doc se confirman juntos — fix H3 verificado por __tests__/h3-consecutivo-fantasma.repro.test.ts).
- **Evidencia:** app/api/radicacion/interna/route.ts está COMPLETO y es superior: consecutivo-legal + guard D9 cableado, tx.create fail-closed, trazabilidad con id determinístico DENTRO de la tx, anti-forja de campos de estado, staging de adjuntos; la bifurcación ya está cableada al dashboard (page.tsx:3255 → radicarSegunFlag) y lockeada por __tests__/radicacion-interna-kill-switch.test.ts. Solo falta el cutover: flip + UAT + M3 (cierre de reglas en deploy separado, blueprint CN-pieza-angular §M3).
- **Solución:** Ejecutar el cutover según el runbook del blueprint: flip del flag (1 línea) → UAT de radicación interna → confirmar 0 escrituras cliente → M3 cierra counters y el create. Es la corrección estructural de los hallazgos 1 y 6 a la vez. Esfuerzo: el código está hecho; resta la ventana operativa + UAT con la funcionaria. Depende de: propietario (PdC 3). No es bloqueante para el día D: la vía cliente opera correcta en el caso normal y viene operando en producción.
- **Pruebas después:** Con flag ON en stage/UAT: radicar → verificar evento RADICACION dentro del mismo commit (existe aunque se mate el cliente), reintento de id colisionante → 500 sin sobrescribir; luego cron de auditoría en verde 2 lunes seguidos antes de M3.

### 🟡 Trazabilidad no atómica en las mutaciones de radicados (patrón sistémico update + add separados)

- **Dónde:** app/api/radicados/[radicadoId]/resolver/route.ts:152-178, asignar:117-118, devolver:47-51, desistimiento:70-71; incluso rutas con tx dejan la traza fuera: registro-expres/route.ts:146, salidas/registrar/route.ts:158
- **Qué pasa el día D:** Un timeout/crash de la función de Vercel entre el update y el appendTrazabilidadAdmin deja, p. ej., un radicado RESUELTO sin evento RESPUESTA_FUNCIONARIO: el estado cambió y la línea de tiempo no lo explica. Ventana pequeña (server-side), no corrompe series ni bloquea operación — por eso no es NARANJA.
- **Evidencia:** lib/server/radicados-security.ts:33-43 (appendTrazabilidadAdmin = .add() suelto, eventoId con Date.now()); contraste con el patrón correcto ya existente en app/api/radicacion/interna/route.ts:562-593 (tx.set con id determinístico dentro de la tx) y sellar-documento (runTransaction).
- **Solución:** Después del lanzamiento: migrar las rutas de mutación al patrón de la pieza angular (una tx: read → update + trazabilidad con id determinístico). Esfuerzo: mecánico, ruta por ruta, ~1 día con tests. Dueño: dev-backend.
- **Pruebas después:** Test por ruta que aborte la tx y verifique que NI el estado NI la traza quedaron; grep de appendTrazabilidadAdmin sin tx → 0 usos en rutas de mutación de estado.

### 🟡 La trazabilidad de radicados admite eventos forjados desde cliente (actorUid sin validar contra auth.uid)

- **Dónde:** firestore.rules:168-179 (allow create: canWriteTrazabilidad, sin validación de datos)
- **Qué pasa el día D:** Un rol operativo autenticado puede escribir en la trazabilidad de un radicado de su tenant un evento con actorUid/actorNombre/fecha/accion arbitrarios (p. ej. a nombre de la jefa): el libro es append-only (update/delete: false, eso sí se cumple) pero la AUTENTICIDAD de los eventos escritos por cliente no es verificable. Riesgo de insider, sin vector externo.
- **Evidencia:** La regla solo evalúa rol+tenant del escritor, ningún campo de request.resource.data; comparar con la ruta servidor que deriva el actor de la sesión (radicacion/interna:545-553).
- **Solución:** Se resuelve solo con el M3 del cutover (trazabilidad pasa a server-only). Si M3 se demora: añadir a la regla request.resource.data.actorUid == request.auth.uid como mínimo. Esfuerzo: 1 línea de reglas.
- **Pruebas después:** Test de reglas: create de evento con actorUid ≠ auth.uid → PERMISSION_DENIED.

### 🟡 Los 196 históricos no estorban la operación, pero el flujo prometido para completarlos (DF-10: 'se completan después desde la plataforma') NO existe

- **Dónde:** lib/motor-expedientes/estados-licencia.ts:396 (completarRevisionHistorica: función pura sin NINGUNA ruta ni UI que la invoque — verificado por grep en app/) ; app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx:253-258 (histórico = solo lectura, 'no admite nuevos aportes')
- **Qué pasa el día D:** Nada grave: los RECONSTRUIDOS están bien contenidos — excluidos de KPIs y términos (R9), solo-lectura en checklist y actuaciones, ordenados por su fecha histórica en la bandeja, con el Libro Consecutivo como vista dedicada que ya anuncia 'les falta completar cédula y estado desde los expedientes físicos'. Solo afectan la CONSULTA (cédulas/estados incompletos), no la operación diaria. Pero la decisión del propietario del 11-ago ('entran sin cédula, se completan después') queda incumplible hasta que exista la pantalla.
- **Evidencia:** grep completarRevisionHistorica → solo lib/ (0 llamadores en app/); LibroConsecutivoClient.tsx:354 reconoce el faltante en el propio texto de la UI; lib/migracion/planificar-importacion-consecutivo.ts:215-224 (DF-10, cuarentena solo FECHA_INVALIDA).
- **Solución:** Post-lanzamiento: construir la ruta PATCH + pantalla que invoque completarRevisionHistorica (la lógica de dominio ya existe y está testeada). Priorizar cuando Planeación empiece a consultar históricos con frecuencia. Esfuerzo: 2-3 días.
- **Pruebas después:** Completar cédula/estado de un histórico en stage → revisionHistorica marca los campos resueltos, actuación de revisión registrada, expediente sigue sin consumir serie legal.

### 🟢 Código muerto que reintroduce el patrón H3 si alguien lo reutiliza: generarRadicadoInstitucional

- **Dónde:** lib/radicado-institucional.ts:48-75
- **Qué pasa el día D:** Nada — 0 llamadores (verificado por grep). Pero la función avanza el contador SIN escribir el documento (exactamente el consecutivo-fantasma que H3 corrigió) y sigue exportada: un dev futuro que la encuentre por autocompletado reabre el bug.
- **Evidencia:** grep -rn generarRadicadoInstitucional app lib __tests__ → solo su propia definición; transaction.set del counter sin ningún set del radicado (líneas 60-68).
- **Solución:** Eliminarla (o marcarla @deprecated con throw). Esfuerzo: 10 minutos, cualquier momento.
- **Pruebas después:** npx tsc --noEmit verde tras el borrado; grep → 0 referencias.


---

## D3 — Plataforma: build, CI/CD, dependencias, TypeScript, lint

> **Veredicto:** Sí puede operar: los gates de CI son reales y están todos activos (tsc, lint, suite, audit gobernado, presupuesto, índices, emulador, compuerta — verificados en verde localmente sobre main c11e140), el árbol de dependencias está limpio (0 advisories, override jose@5 sano, allowlist vacía con disciplina probada); lo que falta no es construcción sino control de release: hoy cualquier merge llega a producción en minutos sin smoke-test post-deploy ni Sentry despierto, exactamente la clase de hueco que ya costó 14 horas de 500 en el SEV-1.

### 🟠 Deploy automático a producción en cada merge, sin smoke-test post-deploy ni detección (G3/G4 del SEV-1 siguen abiertos)

- **Dónde:** .github/workflows/ (solo existen ci.yml, backup-firestore.yml, drill-restauracion.yml — ningún workflow de deploy ni de verificación post-deploy); vercel.json (sin control de release); docs/adr/0025-incidente-sev1-esm-firebase-admin-14.md §Adenda (G3/G4 ⏳ ABIERTO)
- **Qué pasa el día D:** Un merge con fallo solo-de-runtime (la clase exacta del SEV-1: CI, build y preview verdes, lambda rota) llega a producción en minutos y nadie lo sabe hasta que un ciudadano o la funcionaria tropieza — en el SEV-1 el MTTD fue 5h38m con 14,3h de 500 en 58/73 rutas, y hoy Sentry sigue dormido (DSN vacío), así que el detector vuelve a ser un humano. En fase de OPERACIÓN con contrato, eso es un incidente contractual, no un tropiezo de desarrollo.
- **Evidencia:** ls .github/workflows/ → backup-firestore.yml, ci.yml, drill-restauracion.yml (no hay deploy ni smoke). vercel.json solo declara crons. ADR-0025 Adenda 18-ago: 'G3/G4 smoke-test post-deploy + bypass automation ⏳ ABIERTO' y 'G7 Sentry: sin DSN todo es no-op'.
- **Solución:** Antes del día D: (1) pegar el DSN de Sentry en Vercel (propietario, minutos — el código ya está mergeado en #212); (2) implementar G3: workflow post-deploy que golpee 3-4 rutas reales (/api/health + una API interna con el Protection Bypass secret) y abra incidencia al fallar — patrón ya probado en backup-firestore.yml, ~0.5-1 día devops. Después, si el ritmo de merges sigue alto en operación: evaluar control de release (rama release o Vercel promote) vía ADR — no imprescindible con el volumen actual.
- **Pruebas después:** Mergear un cambio trivial → el workflow de smoke corre contra producción y queda verde en Actions; provocar un 500 en un deployment de preview → el mismo smoke lo detecta y la incidencia/alerta se crea. Sentry: forzar un error de prueba marcado y verlo llegar al proyecto.

### 🟠 El E2E de stage jamás se ha registrado: la compuerta vive en AMBER permanente y su 'solo con aceptación explícita' no tiene mecanismo

- **Dónde:** docs/auditorias/e2e-ultimo.json (sha: 'PENDIENTE', resultado: 'pendiente'); scripts/laboratorio/informe-despliegue.mjs:43 y 324-325 (AMBER → exit 0, 'el disparo de deploy es humano'); .github/workflows/ci.yml job informe-despliegue
- **Qué pasa el día D:** Se arranca la operación sobre un SHA cuyos 15 flujos Playwright de punta a punta nunca corrieron contra stage: si un flujo crítico (radicación pública, consulta, login interno) está roto de extremo a extremo de una forma que los tests unitarios no ven, se descubre operando con ciudadanos. Además el contrato de la compuerta ('AMBER = desplegable solo con aceptación explícita del propietario') es ficción mecánica: AMBER sale exit 0, el check pasa y Vercel despliega solo — AMBER≡VERDE en la práctica.
- **Evidencia:** cat docs/auditorias/e2e-ultimo.json → {"sha": "PENDIENTE", "fecha": "PENDIENTE", "resultado": "pendiente"} — el archivo nunca ha sido alimentado. informe-despliegue.mjs:325: 'Compuerta AMBER: desplegable solo con aceptación explícita del propietario. El merge NO se bloquea.'
- **Solución:** Correr una vez `npm run test:e2e` contra stage sobre el SHA candidato del go-live y registrar el resultado en e2e-ultimo.json (coordinador + propietario, ~medio día incluyendo credenciales de stage). Eso convierte la categoría funcional de la compuerta en verde real para el SHA que va a operar. Documentar que el 'disparo humano' del AMBER hoy no existe (o implementarlo con el control de release del hallazgo anterior).
- **Pruebas después:** informe-despliegue del SHA de go-live muestra la categoría funcional en 🟢 con el sha de e2e-ultimo.json == SHA desplegado; el artefacto informe-despliegue-<sha> lo deja trazado.

### 🟡 CI instala con `npm install` en vez de `npm ci`: los gates pueden validar un árbol distinto del lockfile

- **Dónde:** .github/workflows/ci.yml:51 y 134 (npm install) vs drill-restauracion.yml:238 (npm ci)
- **Qué pasa el día D:** Nada concreto el día D — es un riesgo latente de reproducibilidad: si package.json y package-lock.json quedan desalineados en un PR, `npm install` lo 'repara' silenciosamente en el runner y la suite valida versiones que no son las del lockfile que Vercel construye. Tras un SEV-1 causado por un lockfile tóxico, la fidelidad al lockfile en los gates debería ser un invariante.
- **Evidencia:** grep 'npm install\|npm ci' .github/workflows/*.yml → ci.yml usa `npm install` en ambos jobs; el drill de restauración ya usa `npm ci` (la convención correcta existe en el propio repo).
- **Solución:** Cambiar 2 líneas en ci.yml a `npm ci` (devops, 15 minutos + una corrida de CI para verificar caché). Beneficio extra: falla en rojo si el lockfile está desincronizado, en vez de repararlo en silencio.
- **Pruebas después:** Corrida de CI verde con `npm ci`; PR de prueba con lockfile desincronizado → el job Install falla (comportamiento deseado, antes pasaba en silencio).

### 🟡 CI corre Node 22 y producción corre Node 24: la divergencia de runtime solo está cubierta para el caso ya conocido

- **Dónde:** .nvmrc ('22'); package.json engines '>=22' (sin techo); .github/workflows/ci.yml:12-21 (comentario que lo reconoce: 'CI corre 22; Vercel, 24'); ADR-0025 D3 (gate ESM ampliado) ⏳ abierto
- **Qué pasa el día D:** Nada concreto el día D. El gate G1 emula el flag exacto de Vercel (--no-experimental-require-module) pero SOLO sobre los subpaths de firebase-admin; cualquier otra diferencia de comportamiento 22↔24 (u otra bomba ESM-only en otra dependencia de servidor) no se ejercita en CI — la misma tronera por la que entró el SEV-1, hoy más angosta pero no cerrada.
- **Evidencia:** cat .nvmrc → '22'. ADR-0025 causa raíz: 'el runtime de Vercel Functions — Node v24.18.0 real'. ci.yml:21: 'La protección la da el flag vía G1, no la versión de Node (CI corre 22; Vercel, 24)'. G2 quedó completado (#206, fuente única .nvmrc) pero la versión elegida no es la de producción.
- **Solución:** Subir .nvmrc a 24 (o añadir el job validate en matrix 22+24) y correr la suite completa — devops, ~medio día si nada rompe. Evaluar de paso D3 del ADR-0025 (barrido ESM del grafo en cada bump).
- **Pruebas después:** CI verde con node-version-file resolviendo 24; `node --version` en el runner reportado en el log del job coincide en mayor con el runtime declarado por /api/health en producción.

### 🟡 La CSP existe solo en Report-Only, sin recolector: ni bloquea ni informa desde hace 2 meses

- **Dónde:** next.config.ts:27 ('Content-Security-Policy-Report-Only') y next.config.ts:10 (script-src con 'unsafe-inline' 'unsafe-eval'); sin report-uri/report-to en la política; último cambio 2026-06-24 (git log)
- **Qué pasa el día D:** Nada concreto el día D — los headers duros sí están (HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy). Pero la CSP en Report-Only sin endpoint de reporte es un no-op doble: no bloquea inyecciones y las violaciones mueren en la consola del navegador del ciudadano, nadie las ve. Defensa en profundidad contra XSS ausente en una plataforma con datos personales.
- **Evidencia:** next.config.ts:27: { key: 'Content-Security-Policy-Report-Only', value: csp } — es el único header CSP; la cadena csp (líneas 4-19) no contiene report-uri ni report-to.
- **Solución:** Post-lanzamiento: añadir report-to apuntando a Sentry (ya integrado) para ver violaciones reales durante 1-2 semanas, y luego promover a Content-Security-Policy enforced (evaluando retirar 'unsafe-eval' en producción). Dev-frontend + seguridad, ~1 día más ventana de observación. No hacerlo el día D: un enforcement apresurado puede romper Firebase/Sentry en producción.
- **Pruebas después:** Violaciones de CSP visibles en Sentry durante la ventana Report-Only; tras el switch, curl -sI a producción muestra Content-Security-Policy (sin -Report-Only) y los flujos ciudadano/funcionaria pasan el E2E.

### 🟡 Flakes de timeout con mitigación solo parcial: cada flake pinta de rojo un check obligatorio

- **Dónde:** vitest.config.mts (sin retry ni testTimeout global → default 5s); mitigación local solo en 4 archivos (__tests__/radicacion-medios-anexos.test.tsx:7 y 3 más con vi.setConfig({ testTimeout: 15_000 })); evidencia de sesión: 3 flakes conocidos de timeout, verdes aislados
- **Qué pasa el día D:** Ruido operativo, no fallo: en operación cada PR (incluidos los semanales de Dependabot) tiene probabilidad de rojo falso en un check obligatorio del branch protection → re-runs manuales, y lo más caro: el equipo aprende a desconfiar del rojo, que es exactamente el reflejo que dejó pasar verdes falsos en el pasado del proyecto (backups).
- **Evidencia:** vitest.config.mts no define retry ni testTimeout; grep testTimeout __tests__ → solo 4 archivos subidos a 15s; la suite de hoy: 2187 tests con 3 flakes de timeout que pasan aislados (evidencia de sesión, coherente con la memoria 'vitest flaky por timeouts 5s bajo carga').
- **Solución:** Identificar los 3 tests que flaquean y subirles el timeout a 15s como ya se hizo con los otros 4 (patrón existente, ~1 hora), o añadir retry: 1 solo en CI (test.retry condicionado a process.env.CI) dejando el retry en 0 local para no ocultar regresiones nuevas. QA, horas.
- **Pruebas después:** 5 corridas consecutivas de `npm test` en CI sin rojo por timeout; contador de re-runs manuales del check Build & Security Gates en cero durante una semana.

### 🟢 Lint pasa con warnings vivos (sin --max-warnings 0) y 3 warnings acumulados

- **Dónde:** package.json:12 ('lint': 'eslint' sin umbral); warnings actuales en __tests__/ventana-stream-radicados.test.ts:27, __tests__/ventana-stream-salidas.test.ts:25, app/components/ErrorBoundary.tsx:54
- **Qué pasa el día D:** Nada — el gate pasa hoy con 0 errores. Los warnings pueden acumularse sin señal hasta volverse ruido; el de ErrorBoundary (window.location.href en vez de router de Next) es incluso una micro-mejora de UX pendiente.
- **Evidencia:** npm run lint → '✖ 3 problems (0 errors, 3 warnings)', exit 0.
- **Solución:** Limpiar los 3 warnings y añadir --max-warnings 0 al script lint (dev, ~1 hora). Encaja en cualquier PR de mantenimiento.
- **Pruebas después:** npm run lint → 0 problems; un warning nuevo introducido a propósito hace fallar el gate.

### 🟢 Doc desactualizado: docs/deployment.md describe un stack que ya no es el real

- **Dónde:** docs/deployment.md (último commit 6e4425b, 2026-06-15): 'Node.js (v20+)', lista de variables sin SMTP/Sentry/CRON_SECRET, sin mencionar el pipeline actual (gates ADR-0011/0013/0028) ni el flujo Vercel real
- **Qué pasa el día D:** Nada — VARIABLES_ENTORNO.md sí está fresco (actualizado en c11e140 con SENTRY_DSN, EMAIL_*, CRON_SECRET) y es el que importa para la puesta en marcha. Riesgo menor de que alguien nuevo siga la guía vieja.
- **Evidencia:** git log -1 docs/deployment.md → 2026-06-15; el doc dice 'contenedor Node.js (v20+)' cuando .nvmrc fija 22 y Vercel corre 24; regla del encargo: código primero, docs después → doc desactualizado.
- **Solución:** Reescribir deployment.md como puntero corto a VARIABLES_ENTORNO.md + descripción del pipeline real (CI de 3 jobs + auto-deploy Vercel + crons), o marcarlo obsoleto. Docs, ~1 hora.
- **Pruebas después:** deployment.md sin afirmaciones contradichas por .nvmrc, package.json ni .github/workflows/ci.yml.


---

## Dimensión 4 — Configuración y entornos (variables, secretos, separación dev/prod)

> **Veredicto:** Operable sin ROJOS: ninguna variable ausente impide radicar ni tramitar el día D, pero exige cuatro cierres NARANJA antes del go-live — pegar SMTP y DSN de Sentry (ambos en curso), verificar CRON_SECRET en Vercel, y blindar el default de desarrollo para que nadie vuelva a trabajar contra producción; el censo muestra deriva doc-código pero ninguna sorpresa oculta.

### 🟠 El camino por defecto de desarrollo apunta a PRODUCCIÓN con credencial admin (incidente ya materializado esta semana)

- **Dónde:** package.json:9 ("dev": "next dev") + .env.local (symlink compartido a todos los worktrees, FIREBASE_SERVICE_ACCOUNT de prod CON_VALOR) + scripts/laboratorio/dev-stage.mjs
- **Qué pasa el día D:** Cualquier `npm run dev` local — del propietario, de Andrés o de un worktree de agente — arranca contra ventanilla-unica-f31b1 con la service account admin cargada; un clic escribe en expedientes reales de ciudadanos, como ya pasó esta semana. Con contrato vigente, la próxima traza accidental cae sobre un expediente con valor legal.
- **Evidencia:** ls -la muestra `.env.local -> /Users/wendy/Desktop/REPOSITORIO/ventanilla.simacota/.env.local` con FIREBASE_SERVICE_ACCOUNT CON_VALOR (solo nombres inspeccionados). package.json: "dev": "next dev" sin guarda. La guarda anti-prod existe pero solo en la dirección opuesta: dev-stage.mjs:23 aborta si .env.stage apunta a prod. Los scripts de laboratorio sí tienen guarda (`if (sa.project_id === PROYECTO_PROD) abort` en seed-funcionarios-stage.mjs:36, alcaldia-sintetica.ts:330, etc.); `next dev` no tiene ninguna.
- **Solución:** Tres movimientos (~2-4h, equipo dev + propietario): (1) invertir el default — `npm run dev` lanza dev-stage.mjs y el camino a prod pasa a un script explícito `dev:prod-SOLO-LECTURA` o exige bandera CONFIRMO_PROD=1; (2) guarda de arranque en next.config.ts o instrumentation: si NODE_ENV=development y NEXT_PUBLIC_FIREBASE_PROJECT_ID===ventanilla-unica-f31b1 sin la bandera, abortar con mensaje; (3) sacar FIREBASE_SERVICE_ACCOUNT de prod del .env.local cotidiano (dejar solo config de cliente) — la infraestructura stage ya existe completa (.env.stage con SA de stage instalada, instalar-service-account.mjs, seeds).
- **Pruebas después:** `npm run dev` sin bandera debe abortar (o arrancar contra stage mostrando el banner `▶ next dev contra ventanilla-simacota-stage`); `npm run dev:stage` sigue verde; intentar arrancar con project_id de prod sin bandera → mensaje de bloqueo. Repetir desde un worktree de agente.

### 🟠 EMAIL_* vacías 80 días: todo el módulo de notificación por correo degrada — mapa exacto verificado en código

- **Dónde:** lib/email/mailer.ts:21 (throw si !host||!user||!pass; cadena vacía es falsy, así que las variables VACÍAS en Vercel disparan el throw) y sus 14 llamadores en app/api/**
- **Qué pasa el día D:** Ningún correo sale en ningún entorno: (a) constancia de radicación al ciudadano falla y queda NOTIFICACION_CORREO_FALLIDA en trazabilidad (radicar NO se bloquea — el envío está en try/catch, verificado en app/api/radicacion/route.ts:495); (b) el funcionario que pulsa notificar-ciudadano recibe 500 'No fue posible enviar la notificación' con auditoría NOTIFICACION_CIUDADANO_FALLIDA; (c) el cron de alertas de término de las 8:00 COT corre, acumula errores++ por cada alerta y responde 200 — las alertas de vencimiento legal no llegan a nadie (mitigación: el semáforo del panel sigue vivo); (d) la barrida AGN semanal detectaría huecos pero no podría avisarlos por correo (quedan en logError y en el JSON de la corrida).
- **Evidencia:** mailer.ts:21-26 `if (!host || !user || !pass) throw new Error('Configuración de email incompleta...')`; alertas-vencimiento/route.ts:131 catch → errores++; notificar-ciudadano/route.ts:302 `return jsonSeguro({ error: 'No fue posible enviar la notificación.' }, 500)`. Evidencia de hoy: EMAIL_HOST/USER/PASS/PORT/FROM existen VACÍAS en Vercel desde hace 80 días.
- **Solución:** Pegar las credenciales del buzón institucional en Vercel (propietario, ya gestionándolo — es la única dependencia externa). Ningún cambio de código requerido: el módulo está completo y con manejo de fallo correcto.
- **Pruebas después:** Con credenciales puestas: POST /api/radicados/{id-DEMO}/enviar-constancia y verificar recepción real + trazabilidad ENVIADA; disparo manual del cron de alertas con Bearer correcto esperando errores=0; radicación virtual de prueba con email → constancia en bandeja.

### 🟠 Sentry dormido: DSN vacíos 78 días con el código G7 ya mergeado y verificado no-op

- **Dónde:** instrumentation.ts:28 (`if (!dsn) return`), instrumentation-client.ts:18 (`if (dsn)`), sentry.server.config.ts:13
- **Qué pasa el día D:** Un error de producción nocturno vuelve a pasar desapercibido hasta que un ciudadano llame — exactamente el modo de fallo del SEV-1 de julio (14h de caída sin detección). Todo el pipeline (sanitización PII H-N03, captureRequestError, global-error) está construido y en no-op total.
- **Evidencia:** instrumentation.ts: 'SIN SENTRY_DSN, init no se llama: no-op total'. Evidencia de hoy: SENTRY_DSN y NEXT_PUBLIC_SENTRY_DSN existen VACÍAS en Vercel desde hace 78 días; #212 mergeado HOY.
- **Solución:** Propietario: crear el proyecto en Sentry y pegar el DSN en ambas variables (minutos). Opcional no bloqueante: SENTRY_ORG/PROJECT/AUTH_TOKEN para source maps (next.config.ts:47 ya hace silent build sin ellos).
- **Pruebas después:** Tras pegar el DSN, forzar un error controlado en un deployment de preview y verificarlo en Sentry con la PII enmascarada (cédulas/correos ofuscados por sanitizarEventoSentry); comprobar environment=production en el evento.

### 🟠 CRON_SECRET: los 4 crons fallan CERRADO y en silencio si falta — verificar su valor en Vercel antes del día D (desde aquí no es comprobable)

- **Dónde:** lib/seguridad/autorizar-cron.ts:24-31 (503 si falta), vercel.json (3 crons agendados), __tests__/hardening-produccion.test.ts:64-94
- **Qué pasa el día D:** Si CRON_SECRET está vacío en Vercel, los 3 crons agendados (alertas de vencimiento 8:00 COT L-V, desistimiento tácito 1:00 COT diario, barrida AGN lunes 8:00 COT) devuelven 503 cada corrida sin que nadie se entere — sin alertas de término, sin desistimiento tácito, sin auditoría de consecutivos — porque Vercel no alerta de crons fallidos y Sentry está dormido. Nota: fue precondición pendiente del propietario el 15-jul; su estado actual en Vercel no consta en la evidencia de hoy.
- **Evidencia:** autorizar-cron.ts:24 `if (!secret) return { ok:false, status:503, motivo:'CRON_SECRET_NO_CONFIGURADO' }` con comparación timing-safe y test 'sin CRON_SECRET no ejecuta' + 'todos los cron usan el helper y no conservan fail-open'. DOC DESACTUALIZADO (el código gana): docs/CHECKLIST_PRODUCCION.md:34 afirma que sin CRON_SECRET 'el cron queda expuesto' — falso: queda APAGADO, no expuesto.
- **Solución:** Propietario: confirmar en Vercel → Settings → Environment Variables que CRON_SECRET tiene valor (generado con openssl rand -hex 32); corregir la línea del checklist. Esfuerzo: minutos.
- **Pruebas después:** curl del propietario (no mío) a /api/cron/auditoria-consecutivos: sin header → 401 (si responde 503, falta el secreto); con Bearer correcto → 200 con reporte de series. Verificar en el dashboard de Vercel que la corrida agendada de las 13:00 UTC terminó 200.

### 🟡 Cron SIMI construido pero no agendado en ninguna parte (4.º cron fantasma)

- **Dónde:** app/api/cron/simi/alertas-vencimiento/route.ts (existe, protegido, maxDuration 300) vs vercel.json (solo 3 crons) y .github/workflows (ningún schedule lo llama)
- **Qué pasa el día D:** Las alertas predictivas SIMI de vencimiento (notificaciones internas al rol ADMIN) simplemente no existen en operación: la ruta jamás se ejecuta. El cron clásico de alertas por correo sí está agendado, así que no hay hueco legal, solo una feature muerta.
- **Evidencia:** El propio comentario del route.ts pide 'Configurar en Vercel Cron Jobs: diariamente a las 07:00 COT' y vercel.json no lo lista; docs/CHECKLIST_PRODUCCION.md:67 ya lo registra: 'existe pero no está agendado: agéndalo o quítalo'.
- **Solución:** Decisión de una línea inmediatamente después del lanzamiento: agregar la entrada a vercel.json (15 min + deploy) o retirar la ruta. No dejarlo indefinido — es el patrón 'construido y apagado' que la auditoría de agosto marcó como riesgo cultural.
- **Pruebas después:** Si se agenda: corrida verde en el dashboard de crons de Vercel y notificación interna visible para ADMIN cuando existan radicados a ≤1 día. Si se retira: 404 en la ruta y checklist actualizado.

### 🟡 NEXT_PUBLIC_APP_URL ausente: 5 módulos degradan bien por hardcode afortunado, 1 degrada a un dominio viejo de Vercel; y hay una variable gemela sin documentar (NEXT_PUBLIC_SITE_URL)

- **Dónde:** app/api/cron/alertas-vencimiento/route.ts:58 (fallback 'https://ventanilla-simacota.vercel.app/interno/dashboard'), lib/simi-juridico/{emailNotifications,createCitizenNotification,sendCitizenWhatsAppNotification}.ts y lib/email/templates/constancia-radicacion.ts (fallback correcto al dominio .gov.co), lib/ai/guard-publico-ia.ts:51, app/layout.tsx:11-15
- **Qué pasa el día D:** Con SMTP activo, los enlaces de constancias y notificaciones al ciudadano funcionan (el fallback hardcodeado ES el dominio institucional), pero el botón del correo de alertas a funcionarios apunta a ventanilla-simacota.vercel.app — fuera del dominio oficial. Además layout.tsx usa OTRA variable (NEXT_PUBLIC_SITE_URL, no documentada en ningún archivo del repo) y sin ella metadataBase cae a VERCEL_URL: los OG/canonical de enlaces compartidos por WhatsApp apuntan al dominio de deployment *.vercel.app en vez del institucional. En guard-publico-ia solo se pierde una entrada de allowlist (mismo-host sigue pasando: sin impacto).
- **Evidencia:** grep muestra los dos fallbacks divergentes: `?? 'https://ventanilla-simacota.vercel.app'` (cron) vs `?? 'https://ventanilla.simacota.gov.co'` (4 módulos); layout.tsx: `process.env.NEXT_PUBLIC_SITE_URL || VERCEL_URL || 'https://ventanilla-simacota.vercel.app'`. NEXT_PUBLIC_APP_URL además NO está en .env.example (solo en VARIABLES_ENTORNO.md).
- **Solución:** Definir NEXT_PUBLIC_APP_URL=https://ventanilla.simacota.gov.co en Vercel (propietario, minutos) y en un PR corto (~1h): unificar SITE_URL→APP_URL (o definir ambas), corregir el fallback del cron al dominio institucional y añadir la variable a .env.example.
- **Pruebas después:** View-source de la home en producción: og:url y canonical apuntan a ventanilla.simacota.gov.co; el HTML del correo de alerta (test unitario de plantilla) contiene el dominio institucional; grep sin apariciones de ventanilla-simacota.vercel.app en lib/ y app/.

### 🟡 CONSULTA_HASH_SECRET no existe ni está documentada: tres módulos de seguridad usan la service account entera como clave HMAC de facto

- **Dónde:** app/api/public/radicado/consulta/route.ts:43, lib/ai/guard-publico-ia.ts:33, lib/seguridad/auditoria-descargas.ts:46
- **Qué pasa el día D:** Funciona — pero con dos costos ocultos: (1) el día que se rote FIREBASE_SERVICE_ACCOUNT (p. ej. tras un incidente de credenciales), todos los ipHash/radicadoHash cambian de golpe: las ventanas de rate-limit de consulta pública e IA se resetean y la correlación histórica de auditoría de descargas se corta sin aviso; (2) la clave HMAC efectiva es el mismo blob JSON que contiene la private key de admin — acoplamiento innecesario entre rotación de credencial y continuidad de auditoría.
- **Evidencia:** Patrón idéntico en los 3 archivos: `process.env.CONSULTA_HASH_SECRET ?? process.env.FIREBASE_SERVICE_ACCOUNT ?? '<literal>'`. La variable no aparece en .env.example, ni en VARIABLES_ENTORNO.md, ni en ningún doc del repo (grep).
- **Solución:** openssl rand -hex 32 → CONSULTA_HASH_SECRET en Vercel (propietario, minutos) + documentarla en .env.example y VARIABLES_ENTORNO.md con la advertencia de que rotarla resetea rate-limits. Sin cambio de código.
- **Pruebas después:** Verificar que la variable existe con valor en Vercel; smoke: la consulta pública sigue respondiendo y la colección de auditoría registra hashes nuevos estables entre despliegues.

### 🟡 Deriva censo-documentación: variables consumidas sin documentar, documentadas sin consumidor, y un módulo muerto que arrastra 3 credenciales fantasma

- **Dónde:** .env.example, VARIABLES_ENTORNO.md, PRODUCTION_READINESS.md, lib/firestore-admin-rest.ts
- **Qué pasa el día D:** Nada se rompe el día D, pero quien opere por la documentación configurará de más y de menos: faltan en .env.example NEXT_PUBLIC_APP_URL, AUDITORIA_ALERTA_EMAIL, CONSULTA_HASH_SECRET, ALLOWED_ORIGINS y GEMINI_API_KEY_2/GEMINI_API_KEYS (la rotación de claves que el código sí soporta); VARIABLES_ENTORNO.md no menciona WHATSAPP_*, ni los secrets GCP_STAGE_* del drill, y describe 2 de los 3 crons agendados (omite desistimiento-tacito). Sobran: WHATSAPP_FROM_NUMBER (0 consumidores en el código) y FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, que solo consume lib/firestore-admin-rest.ts — módulo con CERO llamadores (código muerto que invita a configurar una segunda credencial admin innecesaria). PRODUCTION_READINESS.md sigue diciendo que Sentry es 'sprint ALTO-3, pendiente' cuando #212 ya mergeó.
- **Evidencia:** grep -rn firestore-admin-rest en todo el repo (sin node_modules) → 0 importadores; grep del censo completo (58 variables process.env.*) contrastado línea a línea contra ambos archivos.
- **Solución:** Una pasada de sincronización de 1-2h (cualquier dev): actualizar .env.example y VARIABLES_ENTORNO.md al censo real, borrar firestore-admin-rest.ts y sus 3 variables, retirar WHATSAPP_FROM_NUMBER, refrescar PRODUCTION_READINESS.md.
- **Pruebas después:** Re-correr el censo: `grep -rhoE 'process\.env\.[A-Z0-9_]+' --include='*.ts*' app lib src | sort -u` y verificar que toda variable de runtime aparece en .env.example y viceversa; tsc --noEmit verde tras borrar el módulo muerto.

### 🟡 GCP_STAGE_SA_KEY: clave JSON de larga vida en GitHub sin ADR de aceptación ni calendario de rotación, con el patrón WIF ya probado en el mismo repo

- **Dónde:** .github/workflows/drill-restauracion.yml:83-114 (soporta WIF stage y cae a credentials_json; el comentario de cabecera trata la clave como la identidad operativa)
- **Qué pasa el día D:** Nada el día D — el riesgo es de ventana: una clave de service account sin expiración con datastore.owner sobre stage y lectura del bucket de respaldos de PRODUCCIÓN vive en GitHub Secrets indefinidamente. Si se filtra (fork, runner comprometido), da acceso de lectura a los respaldos completos de datos de ciudadanos.
- **Evidencia:** El workflow prefiere WIF solo si GCP_STAGE_WORKLOAD_IDENTITY_PROVIDER existe y su comentario dice 'La cuenta de servicio de ACTIONS (la del secret GCP_STAGE_SA_KEY): es la que LISTA el bucket'; VARIABLES_ENTORNO.md:98 exige rotar cada 90 días la análoga GCP_BACKUP_SA_KEY pero no dice nada de la de stage; ningún ADR registra la aceptación (grep en docs/adr).
- **Solución:** Extender setup-gcp-backups.sh/WIF al proyecto stage (el patrón ya está documentado en docs/disaster-recovery.md para backups) y borrar la clave — o, si se acepta el riesgo, dejarlo escrito en un ADR corto con rotación calendarizada a 90 días. Depende del propietario (permisos GCP). Esfuerzo: 1-2h con el script existente.
- **Pruebas después:** Corrida verde del drill usando el paso 'Autenticar (WIF)' en el log de Actions en vez de credentials_json; secret GCP_STAGE_SA_KEY eliminado o ADR mergeado con fecha de rotación.

### 🟢 Clasificador IA y health-check ignoran la rotación de claves Gemini que SIMI sí usa

- **Dónde:** app/api/ai/classify/route.ts:54 y app/api/health/route.ts:35 (leen solo GEMINI_API_KEY) vs lib/ai/gemini-keys.ts (rotación KEY→KEY_2→KEYS que consume callGemini.ts)
- **Qué pasa el día D:** Si el propietario configura las claves solo vía GEMINI_API_KEYS (el formato N-claves), SIMI Jurídico funciona pero la clasificación de radicación cae en silencio al mock local ('Falling back to local mock classifier') y /api/health reporta el motor de IA en fallback: diagnóstico confuso, no caída.
- **Evidencia:** classify/route.ts:89 `console.warn('GEMINI_API_KEY is not defined. Falling back to local mock classifier.')` sin consultar obtenerClavesGemini(); health/route.ts:35 `!!process.env.GEMINI_API_KEY`.
- **Solución:** PR de 30 min: ambos puntos pasan por obtenerClavesGemini() (Principio 3 — reutilización). Sin dependencia externa.
- **Pruebas después:** Test unitario: con solo GEMINI_API_KEYS definida, classify no cae al mock y health reporta 'active'.

### 🟢 WhatsApp en modo 'none' devuelve ok:true simulated:true y la auditoría graba WHATSAPP_ENVIADO — inofensivo hoy (sin UI consumidora), trampa mañana

- **Dónde:** lib/whatsapp/sendWhatsAppMessage.ts:35-42, lib/simi-juridico/sendCitizenWhatsAppNotification.ts:33 (accion: 'WHATSAPP_ENVIADO' con flag simulated), app/api/simi/notificaciones/whatsapp/route.ts:144
- **Qué pasa el día D:** Nada: ninguna pantalla llama hoy al endpoint (grep sin consumidores UI) y el payload sí expone simulated:true. El riesgo es diferido: cuando alguien conecte un botón 'Notificar por WhatsApp' sin mirar el flag, el funcionario creerá notificado a un ciudadano que no recibió nada, con un registro de auditoría rotulado ENVIADO. WHATSAPP_PROVIDER/API_TOKEN/PHONE_NUMBER_ID no constan en la evidencia de Vercel (ausente = 'none').
- **Evidencia:** sendWhatsAppMessage.ts: `if (provider === 'none' || provider === 'mock') return { ok: true, provider, simulated: true, messageId: 'mock_...' }`; audit(): `accion: result.ok ? 'WHATSAPP_ENVIADO' : 'WHATSAPP_ERROR'`.
- **Solución:** Antes de activar cualquier proveedor real: renombrar la acción de auditoría en modo simulado (p. ej. WHATSAPP_SIMULADO) y que todo consumidor futuro trate simulated:true como NO-notificado. 1h, sin urgencia.
- **Pruebas después:** Test: con WHATSAPP_PROVIDER sin definir, la auditoría no registra ningún evento rotulado como envío real; revisión de que la UI (cuando exista) distingue simulated.

### 🟢 Higiene menor: scripts/uat-1.ts hardcodea la ruta local y el nombre de archivo de la clave admin de producción

- **Dónde:** scripts/uat-1.ts:65 ('Downloads/ventanilla-unica-f31b1-firebase-adminsdk-fbsvc-dafc77f1aa.json')
- **Qué pasa el día D:** Nada operativo — el archivo no está en el repo; solo queda expuesto en el historial el identificador parcial de la clave (dafc77f1aa) y la costumbre de guardar la SA de prod en Downloads, que contradice la disciplina de credenciales del propio VARIABLES_ENTORNO.md.
- **Evidencia:** grep 'ventanilla-unica-f31b1' scripts/ → uat-1.ts:65 con la ruta literal en Downloads.
- **Solución:** Cambiar a variable de entorno (GOOGLE_APPLICATION_CREDENTIALS, patrón que ya usan marcar-datos-prueba.ts y afines) y, por prolijidad, rotar esa clave cuando se haga la limpieza de credenciales pre-entrega. 15 min.
- **Pruebas después:** grep sin rutas absolutas a claves en scripts/; la UAT corre exportando la variable.


---

## D5 — Operación: observabilidad, errores, respaldo, incidentes

> **Veredicto:** Sí puede operar, pero arranca parcialmente a ciegas: el respaldo de Firestore está probado de punta a punta (export verificado + drill real 18-ago) y los errores dejan rastro estructurado, mientras que Sentry duerme sin DSN, nadie vigila uptime ni crons (que hoy lucen verdes fallando al 100% de los envíos), y los adjuntos de Storage no tienen ningún respaldo — todo cerrable en horas de configuración, no de desarrollo, sin un solo ROJO.

### 🟠 Los adjuntos en Firebase Storage (documentos legales) no tienen NINGÚN respaldo — el export de Firestore no los incluye

- **Dónde:** .github/workflows/ (solo existen backup-firestore.yml, ci.yml, drill-restauracion.yml); docs/disaster-recovery.md §3 (cubre solo Firestore); storage.rules define radicados/, respuestas/, sellados/, salidas/ con PDFs reales
- **Qué pasa el día D:** El día D no revienta nada (por eso no es ROJO). El día D+n en que un script, una limpieza de consola o un incidente borre/corrompa el bucket de adjuntos, las respuestas oficiales en PDF, las copias selladas y los oficios 2-SAL son IRRECUPERABLES: la restauración de Firestore (ya probada) devuelve el radicado con metadatos cuyos archivoNombre apuntan a objetos que ya no existen. La premisa del propio DR ('el activo más valioso son los documentos') queda incumplida para la mitad de los documentos.
- **Evidencia:** ls .github/workflows → 3 workflows, ninguno respalda Storage; grep -riE 'rsync|storage transfer|versioning' scripts docs → 0 resultados sobre respaldo de adjuntos; docs/disaster-recovery.md no menciona los adjuntos en todo el plan (solo Firestore §3.1-3.2)
- **Solución:** (1) Habilitar object versioning en el bucket de adjuntos (mitigación inmediata contra borrado accidental, 1 comando gcloud del propietario); (2) workflow diario de gcloud storage rsync -r del bucket de adjuntos al bucket de respaldos, reutilizando las credenciales WIF y el patrón de verificación/aviso de backup-firestore.yml (~medio día dev); (3) sección nueva en disaster-recovery.md. Depende del propietario para el IAM.
- **Pruebas después:** Corrida verde del nuevo workflow con conteo de objetos y bytes > 0 en el resumen; drill mínimo: descargar un adjunto desde la copia y abrirlo; verificar que un objeto borrado en el origen sigue recuperable (versioning).

### 🟠 Sentry dormido: todo el pipeline de errores de #212 es no-op hasta que el propietario pegue el DSN; mientras tanto el único rastro es volátil

- **Dónde:** instrumentation.ts:28 (if (!dsn) return), instrumentation-client.ts:18, sentry.server.config.ts:13; variables SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN vacías en Vercel hace 78 días (contexto verificado hoy)
- **Qué pasa el día D:** Un error real a las 9 p.m. del día D (una radicación que falla, un resolver que revienta) deja solo una línea JSON en los logs de runtime de Vercel; con la retención corta de ese plan (supuesto declarado: ~1 h en Hobby, ~1 día en Pro — no verificable desde el repo, y NO hay log drain configurado), al revisarlo a la mañana siguiente el rastro puede haber desaparecido: diagnosticar exige reproducir, que es exactamente lo que la dimensión debe evitar.
- **Evidencia:** instrumentation.ts documenta 'SIN SENTRY_DSN, init no se llama: no-op total'; logError (lib/logger.ts:48) escribe JSON estructurado a stderr pero su destino es efímero; grep -riE 'drain|logtail|axiom' en el repo → 0 resultados
- **Solución:** Acción del propietario, ~15 min: crear el proyecto en Sentry, pegar SENTRY_DSN y NEXT_PUBLIC_SENTRY_DSN en Vercel Production y redeploy. El código ya está listo y con PII depurada (sanitizarEventoSentry, H-N03); no hay desarrollo pendiente.
- **Pruebas después:** Provocar un error controlado en preview/producción y verificar: (a) evento en Sentry con cédulas/correos/URLs firmadas enmascarados, (b) global-error reporta desde el navegador, (c) un error no atrapado de ruta llega vía onRequestError.

### 🟠 Crons de negocio sin ningún monitoreo — y el cron de alertas legales reporta éxito (200) aunque el 100% de los envíos falle, que es lo que ocurre HOY con SMTP vacío

- **Dónde:** vercel.json (3 crons); app/api/cron/alertas-vencimiento/route.ts:141-148 (return ok:true con errores>0 y enviados=0); app/api/cron/auditoria-consecutivos/route.ts:54 ('Silencio = todo bien', reporta hallazgos AGN SOLO por correo)
- **Qué pasa el día D:** El día D a las 8 a.m. el cron corre 'verde' en el panel de Vercel y CERO alertas de vencimiento llegan a nadie (SMTP vacío → cada enviarEmail lanza, el catch cuenta errores y la ruta devuelve ok:true). Un término de Ley 1755 puede vencerse sin que ningún funcionario reciba la alerta y sin que ningún tablero lo delate — la mitigación parcial es el semáforo visual del dashboard, que exige que alguien lo mire. La auditoría semanal AGN tiene como único canal humano el correo: con SMTP muerto, sus hallazgos no llegan. Y si CRON_SECRET faltara en Vercel (precondición que la memoria del proyecto registra como pendiente del propietario en julio), los 3 crons responden 503 en silencio.
- **Evidencia:** Código citado (return NextResponse.json({ ok: true, ... errores, ... }) tras el for de envíos); docs/ROADMAP_MADUREZ_V1.md:89 P4.4 'alerta si un cron no reporta en su ventana; monitoreo de uptime' = pendiente ('No'); autorizar-cron.ts devuelve 503 CRON_SECRET_NO_CONFIGURADO sin más aviso
- **Solución:** (1) Hacer que alertas-vencimiento devuelva 500 (o registre evento de negocio con resultado:error) cuando enviados=0 y errores>0 — 1-2 h dev; (2) al activar Sentry (hallazgo anterior), añadir Cron Monitors/check-ins para los 3 crons — ~2 h; (3) el propietario verifica CRON_SECRET en Vercel Production (docs/CHECKLIST_PRODUCCION.md §1 ya lo exige).
- **Pruebas después:** En preview con SMTP inválido, disparar el cron con Bearer correcto → la corrida debe quedar en rojo o generar alerta visible; check-in de Sentry Crons visible para las 3 rutas; curl sin token → 401, jamás 503 (503 delataría CRON_SECRET ausente).

### 🟠 Cero monitoreo de disponibilidad: /api/health está listo pero nadie lo consulta, y production-readiness.md describe un uptime monitoring que no existe

- **Dónde:** app/api/health/route.ts (devuelve 503 si Firestore cae — funcional); docs/production-readiness.md:32,55 (describe BetterStack/UptimeRobot cada 60s como implementado); docs/ROADMAP_MADUREZ_V1.md:89 (P4.4 lo confirma pendiente)
- **Qué pasa el día D:** Si la plataforma cae el día D a las 10 p.m. (Firestore, deploy roto, dominio), nadie lo sabe hasta que un ciudadano llame o la funcionaria llegue a las 7 a.m.: horas de indisponibilidad invisible en el primer día de operación contractual. El endpoint de salud ya distingue healthy/degraded con latencia de Firestore — solo falta quien lo mire.
- **Evidencia:** grep de uptime en el repo: la única mención operativa es la descripción aspiracional de production-readiness.md:55 ('Integración con BetterStack/UptimeRobot... cada 60 segundos') sin ninguna configuración real; código gana a doc → doc desactualizado
- **Solución:** Acción del propietario, ~30 min: monitor gratuito (UptimeRobot/BetterStack) contra https://ventanilla.simacota.gov.co/api/health cada 1-5 min con alerta al correo/celular del propietario y del soporte; corregir production-readiness.md para que describa lo que existe.
- **Pruebas después:** Forzar un 503 en stage (o pausar el monitor) y verificar que la alerta llega en <5 min; captura del panel del monitor con el check activo sobre /api/health.

### 🟠 El runbook de contingencia operativa tiene el contacto de soporte SIN llenar — la escalada del día D muere en un guion bajo

- **Dónde:** docs/CONTINGENCIA_OPERATIVA.md:56
- **Qué pasa el día D:** El día D el sistema no responde, la funcionaria abre el procedimiento de contingencia (que está bien diseñado: radicación en papel, orden preservado) y en la tabla de escalamiento encuentra 'Soporte técnico del sistema — _completar nombre y teléfono al desplegar_': la parte manual funciona, pero nadie sabe a quién llamar para restablecer el sistema, exactamente en el momento para el que este documento existe.
- **Evidencia:** Línea 56 literal: '| Plataforma (sistema no responde) | Soporte técnico del sistema — _completar nombre y teléfono al desplegar_ |'
- **Solución:** Acción del propietario, 5 min: llenar nombre, teléfono y horario del soporte técnico real (y del contacto de respaldo), reimprimir el formato para la ventanilla. El propio doc (línea 85) ya pide revisar contactos en la capacitación.
- **Pruebas después:** El documento impreso en ventanilla con contacto real; simulacro de 10 min con la funcionaria: '¿el sistema no abre, a quién llamas?' respondido sin dudar.

### 🟡 Las 6 rutas API de Control Interno devuelven 500 sin dejar NINGÚN rastro (ni consola ni Sentry) y 5 filtran err.message crudo al cliente

- **Dónde:** app/api/interno/control/alertas/route.ts:47-51, hallazgos/route.ts:122-126, reportes/route.ts:86-90, responsables/route.ts:53-57, resumen-diario/route.ts:59-63, panorama/route.ts:86-90; mismo patrón sin log en app/api/simi/respuestas/firma/[id]/pdf/route.ts (este al menos audita)
- **Qué pasa el día D:** Si el módulo de Control Interno falla en producción, el equipo no tiene ni una línea de log para diagnosticar — y como el error va ATRAPADO, tampoco llegará a Sentry cuando el DSN se active (onRequestError solo cubre errores no atrapados). Además el mensaje interno crudo (err.message) viaja al navegador, contradiciendo la disciplina H-N03/jsonSeguro que el resto del código sí aplica. No bloquea el día D: el módulo funciona; el problema aparece solo cuando falle.
- **Evidencia:** Barrido con perl sobre los 82 route.ts: 7 rutas con catch que retorna status 500 sin console/logError; p. ej. panorama/route.ts:88 '{ error: err instanceof Error ? err.message : ...}' sin log previo
- **Solución:** Añadir logError + mensaje genérico en las 6 rutas (el patrón correcto ya existe en app/api/interno/notificar-ciudadano/route.ts:280-282); 1-2 h dev, sin dependencias.
- **Pruebas después:** Unitaria por ruta que fuerce el throw y asevere: respuesta con mensaje genérico (sin err.message) + logError invocado con el módulo correcto.

### 🟡 Las escrituras de auditoría y trazabilidad fallan en silencio ABSOLUTO: catch vacío sin siquiera logError

- **Dónde:** lib/seguridad/auditoria-descargas.ts:84-86; lib/trazabilidad/notificacion.ts:95-97 y 177-179; app/api/interno/notificar-ciudadano/route.ts:61-63 y 113-115
- **Qué pasa el día D:** Nada el día D. Pero si Firestore empieza a rechazar esas escrituras (cambio de reglas, cuota, índice), la bitácora institucional — auditoría de descargas de documentos con PII, trazabilidad de notificaciones — se agujerea sin ninguna señal: se descubriría en una auditoría externa, no por el control. El diseño 'no bloquear el flujo principal' es correcto; el silencio total no.
- **Evidencia:** auditoria-descargas.ts:84 'catch { // La auditoría no debe bloquear la descarga... }' — el cuerpo del catch es solo el comentario; ídem en los otros 4 puntos (barrido perl de catch con cuerpo vacío tras quitar comentarios)
- **Solución:** Añadir logError dentro de esos catch (mantiene el no-bloqueo: logError nunca lanza, está diseñado para .catch()); 1 h dev.
- **Pruebas después:** Unitaria con stub de Firestore que rechaza → logError invocado con módulo 'auditoria/...' y el flujo principal (302/200) intacto.

### 🟡 El respaldo diario tiene dos puntos ciegos de AUSENCIA: auto-deshabilitación de GitHub a los 60 días sin push y retención de 30 días que borra sola

- **Dónde:** .github/workflows/backup-firestore.yml (schedule + aviso que solo dispara si el workflow CORRE y falla); docs/disaster-recovery.md:110-113 (salvedad documentada); scripts/backups/lifecycle-retention.json (30 días)
- **Qué pasa el día D:** Nada el día D. Pero el contrato cambia el modo a OPERAR: menos pushes es el escenario esperado. A los 60 días sin push GitHub deshabilita el schedule; el excelente aviso-de-fallo del workflow nunca dispara porque el workflow ya no corre; 30 días después la retención borra los respaldos existentes y el municipio queda sin plan de continuidad, en silencio total. Mitigación parcial: GitHub envía un correo antes de deshabilitar — depende de que alguien lo lea.
- **Evidencia:** El aviso de fallo es 'if: failure()' dentro del propio workflow (no hay watchdog externo); el propio issue del workflow lo advierte: 'la retención del bucket es de 30 días. Si los respaldos siguen fallando, los que ya existen se borran solos'; salvedad de los 60 días reconocida en disaster-recovery.md:110
- **Solución:** Elegir una: (a) keep-alive mensual (workflow que reactiva el schedule con gh workflow enable), (b) migrar el disparo a Cloud Scheduler (alternativa ya evaluada en docs), o (c) dead-man externo: al activar Sentry, un Cron Monitor que alerte si no hay corrida verde en >26 h. ~medio día.
- **Pruebas después:** Prueba del dead-man: pausar el workflow manualmente un día y verificar que la alerta de ausencia llega; documentar la elección en disaster-recovery.md.

### 🟡 El cron SIMI /api/cron/simi/alertas-vencimiento existe pero no está agendado: código agendable que nunca corre

- **Dónde:** app/api/cron/simi/alertas-vencimiento/route.ts (su propio comentario dice 'Configurar en Vercel Cron Jobs: diariamente a las 07:00 COT') vs vercel.json (solo 3 crons, este no está); docs/CHECKLIST_PRODUCCION.md:67 ya lo marca: 'agéndalo o quítalo'
- **Qué pasa el día D:** Las alertas predictivas SIMI (reincidencia/devoluciones, BM-B33 recién mergeado en #211) simplemente no corren; nadie las está esperando aún, así que el impacto del día D es nulo — el costo es confusión operativa: una capacidad que el código promete y la plataforma no ejecuta.
- **Evidencia:** vercel.json contiene exactamente 3 crons (alertas-vencimiento, desistimiento-tacito, auditoria-consecutivos); grep 'cron/simi' en vercel.json → 0
- **Solución:** Decisión del propietario (15 min): agendarlo en vercel.json (cuidando el límite de crons del plan Vercel) o eliminar la ruta y su checklist. La deuda ya está registrada en el checklist — solo falta decidir.
- **Pruebas después:** vercel.json con la entrada nueva y una corrida verificada en el panel de crons, o la ruta eliminada y el ítem del checklist tachado.

### 🟢 Docs de operación desfasados del código: hora del cron (12:00 vs 13:00 UTC) y riesgo R13 marcado ABIERTO cuando el código ya lo resolvió

- **Dónde:** docs/CHECKLIST_PRODUCCION.md:66 y docs/RUNBOOK_INCIDENTES_SMTP.md §1 dicen 'L-V 12:00 UTC' vs vercel.json '0 13 * * 1-5'; docs/REGISTRO_RIESGOS.md:25 (R13: cron 'lee sin cota, O(N)', ABIERTO) vs app/api/cron/alertas-vencimiento/route.ts:66-81 (consulta acotada por estado+fecha, limit 1000)
- **Qué pasa el día D:** Un operador que siga el doc espera la alerta a las 7 a.m. Bogotá y llega a las 8 (confusión menor, no fallo); R13 abierto hace parecer pendiente una deuda de rendimiento que el código de main ya cerró — ruido en el próximo triaje de riesgos. Código gana: se reporta como doc desactualizado.
- **Evidencia:** vercel.json literal: '"schedule": "0 13 * * 1-5"'; route.ts:79-81 '.where(estadoActual, in, ...).where(termino.fechaVencimiento, <=, ...).limit(TECHO_LECTURA_CRON)' con TECHO_LECTURA_CRON=1000
- **Solución:** Actualizar los 3 documentos (checklist, runbook SMTP, registro de riesgos → R13 a RESUELTO con trazabilidad al commit); 30 min, cualquier dev.
- **Pruebas después:** Los docs citan '0 13 * * 1-5' y R13 figura resuelto con referencia al código acotado.


---

## D6 — Producto: features incompletas/experimentales, banderas y candados, IA y datos iniciales

> **Veredicto:** La ventanilla PQRSD sí puede operar el día D — los candados (R10, radicación interna) están bien cableados, nada de IA decide solo y los placeholders son honestos — pero hay 4 naranjas que cerrar antes: interruptores de IA decorativos que fingen control, el doble reloj radicado/expediente sin señal en Ventanilla, el correo institucional vacío que deja actos legales sin notificar, y la depuración de usuarios UAT; el módulo de Licencias opera solo en modo demostración hasta la siembra autorizada.

### 🟠 Panel 'Supervisión IA' con interruptores que no controlan nada (flags decorativos)

- **Dónde:** lib/ai-flags.ts:1-8; app/interno/dashboard/components/analytics/VistaSupervisionIA.tsx:41,131-133,226-229; app/components/SimiChatCondicional.tsx:16-25
- **Qué pasa el día D:** Un ADMIN o CONTROL_INTERNO que necesite apagar el chat público SIMI (respuestas erróneas a ciudadanos, abuso de cuota Gemini) usa el toggle 'Chat SIMI Público', lo ve en OFF y cree que lo apagó — pero el chat sigue vivo para todos los ciudadanos: toggleFlag solo muta useState local que se pierde al recargar, y SimiChatCondicional monta el widget sin leer ningún flag. Además el panel afirma que 'Alertas preventivas (Fase 4)' está apagado (ENABLE_PREDICTIVE_MODE=false) mientras VistaAnticipacionOperativa está montada y operando (dashboard/page.tsx:4644). El panel miente en ambas direcciones.
- **Evidencia:** grep -rn "AI_FEATURE_FLAGS" app lib → único consumidor es VistaSupervisionIA.tsx (toggles). function toggleFlag(key){ setFlags(prev => ({...prev,[key]:!prev[key]})) } — sin persistencia ni efecto. SimiChatCondicional.tsx no importa ai-flags.
- **Solución:** Opción barata (1-2 h, dev): quitar los toggles o deshabilitarlos con nota 'flags compilados — cambio requiere deploy'. Opción completa (medio día, dev): cablear los flags a un doc de config en Firestore leído por SimiChatCondicional y los endpoints /api/ai/*, con auditoría de quién conmutó.
- **Pruebas después:** Apagar el toggle, recargar la página y verificar que el estado persiste y que el widget SimiChat NO se monta en /radicacion; o verificar que los toggles ya no existen y el panel declara el estado real (predictivo incluido).

### 🟠 El radicado sigue corriendo como PQRSD tras convertirse en expediente: doble reloj y cero señal en Ventanilla

- **Dónde:** lib/server/expedientes-licencias.ts:694-761 (handoff solo escribe vinculoExpediente); lib/radicado-estados.ts:15-31 (sin estado de traslado); ningún consumidor UI de vinculoExpediente
- **Qué pasa el día D:** La funcionaria de Planeación crea el expediente desde un radicado (handoff D2); el radicado queda PENDIENTE en el tablero con su término PQRSD corriendo — 15 días hábiles si el ciudadano entró por la web como petición general (el tipo LICENCIA_CONSTRUCCION con 45 días es visibleCiudadano:false, lib/catalogos/tipos-solicitud.ts:293-300). A los 15 días el semáforo lo marca VENCIDO y el cron de alertas lo cuenta como incumplimiento aunque la licencia (45 días hábiles) va en tiempo. Riesgo real de doble respuesta al ciudadano o de 'limpiar' el vencido archivándolo sin acto.
- **Evidencia:** grep -rn vinculoExpediente app lib src → solo lo escriben las rutas de licencias y lo declara el tipo; VistaVentanilla, PanelGestionRadicado, app/consulta y kpis-operativos no lo leen. ESTADOS_ACTIVOS/ESTADOS_TERMINO_SUSPENDIDO no contemplan el vínculo.
- **Solución:** Definición de producto corta con la funcionaria/Jurídica (¿el handoff suspende, cierra o re-etiqueta la PQRSD?) + implementación de 1-2 días: mostrar el vínculo en el detalle/tablero de Ventanilla y excluir o re-etiquetar en el semáforo los radicados con vinculoExpediente. Depende de: dev + decisión funcional (no requiere insumo externo).
- **Pruebas después:** Test: radicado con vinculoExpediente no computa como VENCIDO en el semáforo/kpis; el detalle en Ventanilla muestra 'vinculado al expediente X'; el cron de alertas lo excluye.

### 🟠 Notificaciones por correo construidas pero muertas (SMTP vacío) mientras los actos que las presuponen siguen anclándose

- **Dónde:** lib/email/mailer.ts:21-26; app/api/radicados/[radicadoId]/requerir-subsanacion/route.ts:86-117; app/api/radicacion/route.ts:480-520
- **Qué pasa el día D:** Con EMAIL_* vacías (80 días, evidencia de contexto), TODO envío lanza 'Configuración de email incompleta': el ciudadano que radica por la web no recibe la constancia con su número (solo lo ve en pantalla); un requerimiento de subsanación deja el radicado EN_SUBSANACION con el reloj suspendido y trazabilidad FALLIDA, pero el ciudadano jamás se entera del requerimiento — semanas después el cron propone desistimiento sobre una notificación que nunca salió. Los flujos no se rompen (el error se captura y se registra), pero la operación queda coja en su pieza legal de comunicación.
- **Evidencia:** mailer.ts lanza throw si !host||!user||!pass; requerir-subsanacion captura el error, registra estado 'FALLIDA' y responde { ok:true, notificado:true, emailEnviado:false } — el término ya quedó suspendido antes del envío.
- **Solución:** El propietario pega las credenciales del buzón institucional en Vercel (en gestión hoy, según contexto) y se ejecuta el plan de validación de PRODUCTION_READINESS.md §2. Mientras no exista buzón: regla operativa explícita de NO usar requerir-subsanación/prórroga con notificación electrónica (notificar en físico y registrar). Esfuerzo: horas; depende del propietario.
- **Pruebas después:** Radicar en stage y verificar correo recibido + trazabilidad ENVIADA; ejecutar requerir-subsanación y confirmar emailEnviado:true; simular fallo SMTP y verificar que la UI muestra la falla al funcionario.

### 🟠 4 usuarios de prueba UAT siguen activos en producción (dato inicial sin depurar)

- **Dónde:** Colección users en producción (recepcionista.test@ y similares — evidencia de sesiones anteriores, no verificable desde el repo); herramienta de remedio ya existe: app/api/admin/usuarios/[uid]/route.ts (PATCH archivar) + VistaAdministracion
- **Qué pasa el día D:** Cualquiera que conserve esas credenciales (se compartieron durante la UAT) entra al panel interno con datos reales de ciudadanos y puede actuar como funcionario; además contaminan el directorio de responsables asignables.
- **Evidencia:** El modelo soporta la depuración: TIPOS_USUARIO_VALIDOS = {INSTITUCIONAL, UAT, PRUEBA} y campo esPrueba en VistaAdministracion.tsx:33; el listado admin filtra archivados. La existencia de los 4 usuarios consta del contexto/sesiones previas.
- **Solución:** Archivar los 4 usuarios desde Administración (flujo existente, minutos) o rotar sus contraseñas si se quieren conservar para smoke tests. Depende de: propietario/ADMIN.
- **Pruebas después:** GET /api/admin/usuarios sin incluirArchivados no lista ningún usuario tipo UAT/PRUEBA activo; login con las credenciales de prueba rechazado (cuenta deshabilitada).

### 🟠 Candados verificados y correctos, pero el módulo Licencias solo opera en demostración hasta la siembra R10 (y la radicación interna sigue en cliente)

- **Dónde:** lib/server/expedientes-licencias.ts:47 (EMISION_REAL_EXPEDIENTES_HABILITADA=false), 211-220 (evaluarCandadoEmisionReal 422); lib/recepcion/radicacion-interna-flag.ts:20 (USA_RADICACION_INTERNA_SERVER=false)
- **Qué pasa el día D:** Planeación no puede emitir ningún expediente con consecutivo legal: todo nace DEMO-{AA}-{8hex} y la constancia oficial al ciudadano se corta a propósito para números DEMO- (debeEnviarComunicacionExpediente, expedientes-licencias.ts:820-825) — el módulo sirve para ensayar, no para operar la serie legal. En paralelo, la radicación interna sigue corriendo por el cliente, lo que obliga a mantener counters abierto en firestore.rules (CR-1, dimensión seguridad). Ninguno de los dos es un descuido: ambos caminos reales existen, están probados y se activan cambiando la constante.
- **Evidencia:** POST /api/licencias/expedientes fuerza esPrueba:true y 'JAMÁS importa emitirNumeroExpedienteReal' (route.ts:6-9); evaluarCandadoEmisionReal rechaza con 422 y mensaje R10. radicacion-interna-flag.ts documenta el kill-switch de 1 línea con rollback.
- **Solución:** R10: obtener el dato del consecutivo del ingeniero de Planeación, autorización explícita del propietario para sembrar counters/expedientes-{año}, cambiar la constante y dejar de forzar esPrueba (procedimiento ya documentado; días). Radicación interna: ejecutar la Fase 3 del blueprint (conmutar el caller y luego cerrar reglas). Depende de: propietario + ingeniero de Planeación + dev.
- **Pruebas después:** Crear expediente real en stage con serie sembrada → número legal 68745-0-AA-CCCC, constancia enviada; verificación de que DEMO- ya no se genera por defecto. Para radicación interna: radicar desde el panel y verificar que la escritura fue server-side (trazabilidad del endpoint), luego dry-run de reglas cerradas.

### 🟡 La 'Prueba integral E2E' (commit_test) escribe radicados de prueba en las colecciones legales de producción y el auditor de consecutivos los cuenta

- **Dónde:** app/api/simi/test/e2e/route.ts:229-266; app/interno/dashboard/components/simi/E2ETestPanel.tsx; scripts/laboratorio/detectar-consecutivos-fantasma.mjs:60-76
- **Qué pasa el día D:** Un ADMIN ejecuta commit_test y nace un radicado 1-WEB-2026-{8díg} en ventanilla_radicados de producción. La operación no se rompe (bandeja y métricas filtran isTest/excludeFromMetrics — useVentanillaRadicados.ts:127 — y la limpieza archiva por testRunId), pero el documento es consultable públicamente por diseño y su id matchea perteneceAlAnio (regex '-2026-') con un último segmento derivado de timestamp que entra como 'consecutivo presente' en la auditoría semanal AGN: infla los conteos del reporte y, con probabilidad baja, puede fabricar un falso duplicado en la serie legal (el consecutivo fake es aleatorio módulo 10^8).
- **Evidencia:** buildRadicado(...) → radicadoId = `1-WEB-2026-${Date.now()%100000000}` escrito con safeSet en ventanilla_radicados; consecutivoDeId toma el último segmento; el cron auditoria-consecutivos declara contar 'TODO documento del año, incluidos los marcados isTest' (route.ts:195-198).
- **Solución:** Excluir del conteo del auditor los docs isTest o el prefijo 1-WEB- (una condición, horas, dev) y adoptar política de usar commit_test solo en stage; el dry_run queda libre. No requiere tocar el candado de roles (ya es ADMIN-only con rate limit 3/min).
- **Pruebas después:** Ejecutar commit_test en stage, correr el auditor y verificar que documentos/duplicados no incluyen el radicado de prueba; el reporte semanal en prod no varía tras una corrida E2E.

### 🟡 Los documentos del radicado NO viajan al expediente y el detalle del expediente no enlaza los archivos de origen

- **Dónde:** lib/server/expedientes-licencias.ts:603-607 (proyección mínima D2, deliberada); app/api/licencias/expedientes/[id]/route.ts:86-98 (solo id+fecha del vínculo); app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx:296-305
- **Qué pasa el día D:** La funcionaria abre el expediente creado por handoff y, para ver los planos/anexos que el ciudadano adjuntó al radicado, debe irse a Ventanilla y buscar el radicado a mano (el detalle muestra el número, sin enlace ni listado); la alternativa práctica es re-subir los archivos al expediente por /documentos, duplicándolos. La proyección mínima de PII está bien fundamentada — el hueco es de navegación/uso, no de datos.
- **Evidencia:** El expediente nace con aportes:[] y solo solicitanteNombre/Documento; radicadoVinculado en el GET es {id, fecha}; la UI renderiza NumeroLegal + 'Vinculado el {fecha}' sin href a Ventanilla.
- **Solución:** Enlace directo del detalle del expediente al detalle del radicado en Ventanilla (horas, dev); opcionalmente proyectar referencias (no copias) de los archivos del radicado en la vista del expediente — decisión de producto corta.
- **Pruebas después:** Desde el detalle de un expediente con radicadoId, un clic lleva al radicado de origen y sus anexos son visibles sin re-subirlos.

### 🟡 Datos sembrables de SIMI (plantillas y normograma) requieren verificación explícita el día D

- **Dónde:** app/interno/dashboard/components/simi/SimiGobernanzaPanel.tsx:26-40 (seed_base_templates); lib/simi/normograma-nucleo.ts + scripts/cargar-normograma-nucleo.ts
- **Qué pasa el día D:** Si el normograma núcleo o las plantillas base no están sembrados en producción, SIMI jurídico proyecta borradores 'sin contexto documental validado' y sin plantillas institucionales — degrada la calidad del copiloto justo cuando empieza la operación real. El resto de datos día-1 está resuelto en código y no requiere siembra: tipos de solicitud (lib/catalogos/tipos-solicitud.ts), dependencias (DIRECTORIO_TENANTS), festivos calculados algorítmicamente para cualquier año (lib/tiempos-radicado.ts:274-304, Ley Emiliani), y usuarios creables desde Administración (POST /api/admin/usuarios).
- **Evidencia:** Ambos seeds son idempotentes (slug estable como id de documento); no puedo verificar desde el repo si ya corrieron en prod — supuesto declarado, no hecho.
- **Solución:** Añadir al checklist GO/NO-GO la verificación (consulta de conteo de simi plantillas y normograma en prod) y, si faltan, ejecutar el botón de siembra del panel admin / el cargador. Minutos; depende de ADMIN.
- **Pruebas después:** El panel de gobernanza muestra plantillas cargadas y el normograma responde con normas núcleo; una consulta a SIMI jurídico cita fundamento en lugar de 'sin contexto documental validado'.

### 🟢 Principio 9 verificado en código: ninguna función de IA decide sola y todos los caminos degradan a fallback local

- **Dónde:** app/api/radicacion/route.ts:412,446 (oficinaDestino siempre = TENANT_RECEPCION, la sugerencia IA solo se guarda); app/api/cron/desistimiento-tacito/route.ts (solo PROPONE); app/api/ai/{classify,chat,scan-doc}/route.ts (fallback local + guard C-1 + rate limit); lib/ai/gemini-keys.ts (rotación por cuota)
- **Qué pasa el día D:** Si Gemini cae o agota cuota, el ciudadano sigue radicando (clasificador local por palabras clave, chat con respuestas seguras), el circuito se abre tras 5 fallos y nada se bloquea; el re-enrutamiento por sugerencia IA es un botón que pulsa un humano (PanelGestionRadicado.tsx:97-110); el desistimiento lo confirma un funcionario con acto motivado. Sin acción bloqueante.
- **Evidencia:** ejecutarClasificacionLocal con promptVersion '-fallback-error'; comentario vinculante del cron: 'NUNCA archiva ni cambia el estado… un humano (Principio 9; Ley 1755 Art. 17)'. Matiz cosmético: el fallback reporta confianzaClasificacion 0.85 fija, que la UI muestra como si fuera real.
- **Solución:** Solo mejora futura: bajar/etiquetar la confianza del fallback en la UI ciudadana (el prefijo [FALLBACK] ya viaja en el resumen).
- **Pruebas después:** Suite existente ya cubre fallbacks; opcional: test de que la UI distingue promptVersion *-fallback-*.

### 🟢 Limpieza menor: componente legado no montado que escribe a colección vieja, doble manifest PWA y robots con ruta fantasma

- **Dónde:** app/interno/dashboard/components/ModalRadicado.tsx + FormRespuesta.tsx:141 (escribe a 'radicados', colección legada — sin ningún import en páginas); public/manifest.json vs app/manifest.ts (layout.tsx:48 usa /manifest.json, el de app/ queda duplicado); app/robots.ts (disallow /seed/ que ya no existe)
- **Qué pasa el día D:** Nada: ModalRadicado no está montado (grep sin consumidores), el manifest duplicado sirve el mismo contenido hoy y robots solo lista una ruta muerta. Es deuda de mantenimiento que puede confundir a un dev futuro (editar el manifest equivocado, revivir el modal legado). PWA/sitemap/robots por lo demás coherentes para operar públicamente (sw.js network-first, excluye /api y /interno; sitemap solo rutas ciudadanas).
- **Evidencia:** grep -rn ModalRadicado app → solo su propio archivo y el import interno de FormRespuesta; layout.tsx metadata.manifest='/manifest.json'.
- **Solución:** PR de limpieza post-lanzamiento: borrar ModalRadicado/FormRespuesta, unificar en app/manifest.ts (y apuntar el layout a /manifest.webmanifest o borrar el estático), quitar /seed/ de robots. 1-2 h, dev.
- **Pruebas después:** Build verde sin los archivos; /manifest.json o /manifest.webmanifest único y referenciado; robots.txt sin rutas inexistentes.

