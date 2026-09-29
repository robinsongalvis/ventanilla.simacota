# Checklist de arranque a producción — Ventanilla Única Simacota

> Guía práctica para el primer día real de operación. Nace de la auditoría de
> seguridad y producción del 2026-07-07. Marca cada casilla antes de abrir el
> sistema a usuarios reales.
>
> **Estado de la auditoría:** los tres riesgos reales (costos de IA, revocación
> de sesión, fuga de errores) están **cerrados y en producción**. La base ya era
> sólida (reglas bloqueadas, sin secretos, 0 vulnerabilidades de dependencias,
> escape de HTML en correos, descargas protegidas H-01). Lo que falta no es
> código: es configuración de despliegue, respaldo y **validación con usuarios
> reales**.

---

## 0. Cuenta de facturación de Google Cloud — **bloqueador transversal**

> **Estado al 2026-09-29:** cuenta **REABIERTA** y Storage **verificado
> funcionando**. El bloqueo que afectó al proyecto `ventanilla-unica-f31b1`
> quedó levantado.

### Cómo se cerró

Durante el bloqueo la consola mostraba *«Esta cuenta de facturación está
cerrada»* **aunque** Google ya había aprobado la revisión, el método de pago
estaba registrado y el cobro se había aplicado. La lección quedó escrita:
**«pago recibido» no es «cuenta reabierta»** — son hechos distintos y solo el
segundo levanta el bloqueo.

El botón de reabrir no aparecía por dos razones acumuladas:

1. La lista de cuentas de facturación viene **filtrada por `Estado: Activo`**,
   así que una cuenta cerrada **no se muestra en absoluto**. Hay que quitar el
   filtro para verla.
2. Ya dentro de la cuenta, la acción de reabrir es un **icono ↺ sin texto** en
   la barra superior de *Administración de cuentas* — no un botón en el banner
   rojo.

### Estado verificado

| Señal | Estado | Cómo se comprobó |
|---|---|---|
| Revisión de la cuenta aprobada | ✅ Sí | Correo de Google Cloud Support |
| Método de pago registrado | ✅ Sí | Consola · método principal |
| Pago recibido y aplicado a GCP | ✅ Sí | Correo de Google Payments |
| **Cuenta reabierta** | ✅ **Sí** | Banner rojo desaparecido; el icono pasó a «cerrar cuenta» |
| **Estado efectivo** | 🟢 **`ACTIVE`** | **Prueba funcional**, no solo visual (abajo) |

La reapertura **no se dio por buena con señales visuales**. Se comprobó
ejecutando contra el proyecto real:

- `storage.getBuckets()` respondió — la API dejó de devolver
  *«billing account … is disabled»*.
- Subida real → lectura íntegra → borrado, en
  `ventanilla-unica-f31b1.firebasestorage.app`. Los tres pasos correctos, sin
  dejar rastro.

### Qué bloquea hoy

| Capacidad | Estado | Dónde impacta en este checklist |
|---|---|---|
| Storage (adjuntos, sellos, oficios PDF) | 🟢 **Operativo — verificado** | §1, §2, §4 desbloqueadas |
| Respaldo puntual (export manual) | 🟢 **Hecho y verificado** — 2026-09-29 | §2 — ver abajo |
| Respaldo **automático diario** | 🟠 **Interrumpido 20 días** — por confirmar que se reanuda | §2 — ver abajo |
| Firestore (datos, radicación, consulta) | 🟢 Operativo | — |
| Radicación SIN archivos | 🟢 Operativo | Camino de contingencia, ya no es la única vía |

> ⚠️ **Storage verificado ≠ respaldos verificados.** Que el bucket acepte
> escrituras no prueba que el export de Firestore corra completo.

#### El respaldo puntual: hecho y verificado

Ejecutado **manualmente desde la consola** el 2026-09-29 (base completa, estado
actual) sobre `gs://ventanilla-simacota-backups`:

```
2026-09-29T17:30:37_61326 · 6 objetos · 906 KB · 1.169 documentos
.overall_export_metadata presente → el export cerró bien
```

Se comprobó **contra el bucket**, no por lo que dijera la consola: que la
operación figure «completada» no prueba que los objetos existan ni que el
export no quedara a medias.

> ℹ️ Se intentó primero por script, con la cuenta de servicio de la app, y
> falló con `PERMISSION_DENIED`. **No se concedió el permiso**, y fue lo
> correcto: `firebase-adminsdk-fbsvc@…` vive en el runtime y la usa toda la
> aplicación — darle capacidad de exportar la base entera amplía lo que un
> atacante podría llevarse si esa credencial se filtrara. La vía de consola usa
> el agente `service-…@gcp-sa-firestore.iam.gserviceaccount.com`, que ya tiene
> ese permiso por diseño. **No cambiar IAM para desbloquear un checklist.**

#### 🔺 El hueco de 20 días — lo que de verdad importa aquí

El respaldo automático corre por **GitHub Actions**
(`.github/workflows/backup-firestore.yml`, `cron: 0 7 * * *` — diario, 2 a.m.
Colombia) y escribe en `gs://…/diario/${FECHA}`.

Funcionaba: hay exports diarios del 1 al **9 de septiembre**. **Se cortó ahí** —
justo cuando se cerró la facturación — y no volvió a correr hasta el manual de
hoy:

```
MAYOR HUECO: 20,2 días   (2026-09-09 → 2026-09-29)
```

Durante esas tres semanas, **un fallo del sistema habría perdido todo lo
radicado en ese periodo**. El respaldo no avisó de que había dejado de existir:
el cierre de facturación se vivió como «no se pueden subir adjuntos», y que
también hubiera matado los respaldos pasó inadvertido.

**Y hay reloj corriendo:** el propio workflow advierte que *la retención del
bucket es de 30 días*. El respaldo automático del 9 de septiembre **se borrará
alrededor del 9 de octubre**. Si la cadencia no se reanuda, quedará una sola
copia — la manual de hoy — y esa expiraría a finales de octubre.

#### El sistema sí avisó — 38 veces

Los avisos automáticos existen, funcionaron y **nadie los leyó**:

| Issue | Aviso | Abierto | Comentarios |
|---|---|---|---|
| [#335](https://github.com/robinsongalvis/ventanilla.simacota/issues/335) | El respaldo diario de Firestore está fallando | 2026-09-10 | **19** |
| [#336](https://github.com/robinsongalvis/ventanilla.simacota/issues/336) | El respaldo de **adjuntos** falló | 2026-09-10 | **19** |

Ambos se abrieron **al día siguiente** del último respaldo bueno, y el workflow
añadió un comentario **cada día** durante 19 días. El último fallo del cron fue
el **2026-09-29 a las 13:33 UTC**, con la facturación todavía cerrada — el
export manual de ese mismo día, ya reabierta, sí funcionó.

> **La lección no es técnica.** El respaldo tenía cadencia, verificación y
> alertas — todo bien diseñado. Falló el último eslabón: que un aviso llegue a
> alguien que actúe. Un aviso que solo se escribe en un issue que nadie abre no
> es una alerta, es un registro.

Ambos issues **se cierran solos** cuando un respaldo vuelva a salir bien: sirven
de semáforo sin tener que mirar los logs.

#### Adjuntos: la copia coincide, pero por accidente

Comparación del 2026-09-29 entre el bucket vivo y el de respaldo:

```
vivo     : 67 objetos · 70,22 MB · más reciente 2026-09-01
respaldo : 67 objetos · 70,22 MB · más reciente 2026-09-01
→ 0 objetos sin copia
```

**No falta nada — y aun así el respaldo está roto.** Coinciden porque desde el
1 de septiembre no se ha subido ningún adjunto: primero por poca actividad, y
desde el 9 porque Storage estaba bloqueado. El proceso lleva 19 días fallando;
lo que no ha habido es material nuevo que perder.

> 🔺 **El riesgo empieza AHORA.** Con Storage operativo otra vez, en cuanto un
> ciudadano anexe un documento o se firme un oficio, ese archivo **no tendrá
> copia** hasta que el respaldo de adjuntos vuelva a correr. Y el export de
> Firestore no lo cubre: restaurar devolvería expedientes apuntando a archivos
> que no existen.

- [ ] **Confirmar que el cron volvió a correr** — primera ejecución tras la
      reapertura. Con la facturación activa debería funcionar solo, pero **hay
      que verlo**: suponerlo es lo que costó 20 días. Señal simple: que #335 y
      #336 se cierren solos.
- [ ] **Decidir quién recibe estos avisos.** Mientras el único canal sea un
      issue del repositorio, el próximo corte volverá a pasar inadvertido.

### Buckets reales del proyecto

| Bucket | Uso |
|---|---|
| `ventanilla-unica-f31b1.firebasestorage.app` | Adjuntos de la aplicación |
| `ventanilla-simacota-backups` | Respaldos |
| `ventanilla-simacota-adjuntos-respaldo` | Respaldo de adjuntos |

> 🔺 **Hallazgo abierto:** el `.env` **local** traía
> `FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com` — un **placeholder de
> ejemplo** que no corresponde a ningún bucket real. Con ese valor las subidas
> fallan con *«The specified bucket does not exist»*, un error que **no tiene
> nada que ver con la facturación** y que puede confundirse con ella. Verificar
> que en **Vercel · Production** esa variable tenga el bucket real (§1).

### Regla de operación

- **Nada de Billing se toca de forma automática.** No se cambia la cuenta de
  facturación, no se crea otra, no se retira el método de pago, no se reasigna
  el proyecto, y no se modifican `storage.rules`, Firebase, secretos ni Vercel
  como forma de «rodear» el bloqueo.
- Un bloqueo de facturación **solo se da por levantado con una prueba
  funcional** contra el servicio afectado. Ni los correos de pago o de
  aprobación, ni la desaparición de un banner, sustituyen esa comprobación.
- Cualquier acción sobre Billing se consulta **antes** con el responsable del
  proyecto.

<!-- Los identificadores de la cuenta de facturación y del medio de pago NO se
     registran aquí a propósito: este repositorio es público. Viven en los
     correos de Google y en la consola. -->

- [x] Cuenta de facturación **reabierta** — 2026-09-29.
- [x] Verificada una **subida real** a Storage (subida → lectura íntegra → borrado) — 2026-09-29.
- [x] Verificado un **export de Firestore completo** — 2026-09-29, 1.169 documentos, comprobado contra el bucket.
- [x] `FIREBASE_STORAGE_BUCKET` corregido en el `.env` **local** — 2026-09-29 (tenía el placeholder `tu-proyecto.appspot.com`).
- [ ] Confirmado que `FIREBASE_STORAGE_BUCKET` en **Vercel · Production** apunta al bucket real y **no** al placeholder. ⚠️ Si allí también está mal, **las subidas fallan en producción** con un error que parece de facturación pero no lo es.

---

## 1. Variables de entorno en Vercel (entorno *Production*)

Verifica una por una que estén en **Production**, no solo en Preview.

### Imprescindibles — sin estas algo se cae o degrada

| Variable | Para qué | Si falta… |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK (toda escritura server) | El sistema no funciona |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Cliente Firebase / login | No hay login |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Login | No hay login |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Cliente Firebase | No hay login |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Adjuntos en el cliente | Fallan subidas |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Cliente Firebase | Config incompleta |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Cliente Firebase | Config incompleta |
| `FIREBASE_STORAGE_BUCKET` | Adjuntos, sellos, oficios PDF (server) | Fallan las subidas |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | Correos al ciudadano | **El ciudadano nunca recibe respuesta** |
| `CONSULTA_HASH_SECRET` | Hash de IP en consulta pública y rate-limit de IA | Cae a un valor por defecto débil |
| `CRON_SECRET` | Protege el cron de alertas | El cron queda expuesto |
| `GEMINI_API_KEY` | SIMI | SIMI cae a modo mock (no cita normas) |

### Recomendadas

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Refuerza el control de origen de los endpoints de IA (sin ella, igual funciona el chequeo de mismo-host) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Ver errores en producción (el scrubbing de PII ya está configurado) |
| `AI_RATE_CHAT_MINUTO` / `AI_RATE_CLASSIFY_MINUTO` / `AI_RATE_SCANDOC_MINUTO` | Ajustar los topes del rate-limit de IA (tienen defaults sanos: 10/15/5 por minuto) |

### Solo si se activan funciones opcionales

- `WHATSAPP_PROVIDER` / `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` — solo si se habilita el aviso por WhatsApp (hoy no implementado).
- `DIGITAL_SIGNATURE_PROVIDER` — solo si se usa firma digital.

> 🟡 **REVISADO EL 2026-09-29 — una duda abierta y un desajuste.** El proyecto de
> Production es `ventanilla-unica-f31b1` (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`), así
> que **ambos** buckets deben ser `ventanilla-unica-f31b1.firebasestorage.app`:
> el de los archivos tiene que ser el del mismo proyecto que la base.
>
Verificado con `vercel env ls production` y `vercel env pull`:
>
> | Variable | Valor en Production |
> |---|---|
> | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `ventanilla-unica-f31b1` |
> | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `ventanilla-unica-f31b1.firebasestorage.app` ✅ alineado |
> | `FIREBASE_STORAGE_BUCKET` | **`[SENSITIVE]` — no verificable** |
>
> **Todas las variables imprescindibles de esta sección existen en Production.**
> El bucket del cliente coincide con el proyecto de la base.
>
> **Lo único que no se puede comprobar** es el bucket del servidor: está marcada
> como *Sensitive* en Vercel, y eso la vuelve **irrecuperable por diseño** — ni
> la consola ni `vercel env pull` devuelven su contenido. Solo se puede
> sobrescribir.
>
> Que exista no basta: una variable definida con el bucket de otro proyecto
> guardaría los archivos donde nadie los buscaría, y **eso no da error** — deja
> la base en un proyecto y los adjuntos en otro. La forma limpia de cerrar la
> duda es **sobrescribirla** con `ventanilla-unica-f31b1.firebasestorage.app`:
> no hace falta leer el valor actual y, si ya era ese, la operación es inocua.
>
> Alternativa sin tocar configuración: **probarlo funcionalmente** en producción
> —adjuntar un documento a un radicado de prueba— y comprobar que el archivo
> aparece en el bucket de `f31b1`. Eso responde la pregunta de verdad, porque
> mide el comportamiento en vez del ajuste.
>
> ⚠️ **Dos lecturas equivocadas durante esta revisión**, anotadas para quien
> venga después: (1) una variable encriptada **se ve vacía** en la consola —
> «no se ve» no es «no está»; (2) el valor `…-stage…` que aparecía en pantalla
> era de **otro entorno**, no de Production. En Vercel hay que leer *siempre* la
> columna de entorno antes de concluir nada.
>
> Si falta del todo, el código no degrada: lanza —`if (!bucketName) throw new
> RadicadoActionError('FIREBASE_STORAGE_BUCKET no configurado.', 400)` en
> `salidas-security` (×2), `planillas-security`, `radicados-security` y
> `api/radicacion/interna`— y el motivo solo se ve en los logs del servidor.
>
> Tras cualquier cambio hay que **redesplegar**: Vercel inyecta las variables en
> el build, así que editarlas no basta.
>
> 📌 Esta sección ya avisaba —*«que estén en Production, no solo en Preview»*—
> desde la auditoría de julio. Nota para quien verifique: en Vercel una variable
> encriptada **se ve vacía**. «No se ve» no es «no está»; confirmar el valor
> exige sobrescribirlo o traerlo con `vercel env pull`.

- [ ] Todas las **imprescindibles** configuradas en Production **y con el valor correcto** — revisado el 2026-09-29: están definidas, pero el valor de las encriptadas no se pudo confirmar (ver recuadro).
- [ ] Las **recomendadas** revisadas.

---

## 2. Base de datos y reglas

- [x] `firestore.rules` **y** `storage.rules` desplegadas al proyecto (`ventanilla-unica-f31b1`) — verificado el 2026-09-29 trayendo las reglas VIVAS por la API de Firebase Rules y comparándolas con el repo: **coinciden** (publicadas el 2026-04-14). Que el archivo exista en el repo no prueba nada; lo que protege los datos es lo publicado.
- [x] **Backup antes de abrir**: export completo ejecutado y verificado — 2026-09-29 (§0).
- [ ] **Cadencia restablecida**: el respaldo diario (GitHub Actions) estuvo **20 días caído**. Confirmar que volvió a correr — ver §0.
- [x] Normograma núcleo cargado (12 normas citables) — hecho el 2026-07-07.

---

## 3. Cron y tareas programadas

- [x] Cron de alertas agendado — verificado el 2026-09-29 en `vercel.json`.
- [x] El segundo cron `/api/cron/simi/alertas-vencimiento` **ya está agendado** (lun–vie 12:00 UTC) — la duda que dejó la auditoría de julio quedó resuelta.
- [ ] Confirmar que los 5 crons **se ejecutan de verdad** en Vercel. Estar declarados en `vercel.json` no prueba que corran: mirar el historial de ejecuciones (es la misma lección del respaldo — declarado ≠ funcionando).

Los 5 declarados hoy: `alertas-vencimiento` (lun–vie 13:00 UTC), `desistimiento-tacito` (diario 06:00), `auditoria-consecutivos` (lun 13:00), `vencimientos-licencias` (lun–vie 12:30), `simi/alertas-vencimiento` (lun–vie 12:00).

---

## 4. Verificaciones funcionales del primer día

- [ ] Radicar un caso real de prueba de punta a punta **con adjuntos**: radicar → dirigir → responder → correo al ciudadano → consulta pública. — *desbloqueado el 2026-09-29 (§0)*.
- [ ] Confirmar que el correo **llega de verdad** (revisar spam) — el eslabón que más falla.
- [ ] Probar **cerrar sesión**: debe bloquear de inmediato en todas partes.
- [ ] Abrir SIMI en un radicado y confirmar que **cita una norma real** (ya no "sin contexto validado").
- [ ] Imprimir un sello de recibido y un oficio de salida — verificar el escudo y el formato. — *desbloqueado el 2026-09-29 (§0)*.

---

## 5. Validación humana (lo más importante)

- [ ] **Ratificación jurídica** de las 12 normas — un abogado revisa la base cargada (puede ajustar el estado de cualquiera).
- [ ] **Sesión con Laura y un funcionario** antes de soltar el sistema — media hora viéndolos usarlo.
- [ ] Definir quién es el **ADMIN** y crear los usuarios reales por dependencia.

---

## 6. Limpieza pendiente (no bloquea el piloto interno; sí antes del público general)

- [x] Bloquear el endpoint `/api/simi/test/e2e` en producción — hecho el 2026-09-29. Se cerró **por `VERCEL_ENV`, no por `NODE_ENV`**: `NODE_ENV` vale `production` también en Preview, y ahí el banco debe seguir vivo porque es donde se ensaya. Cerrados el `POST` que siembra y el `DELETE` que limpia, con 404 (a un endpoint que no debe existir no se le confirma la existencia) y **antes** del guard de sesión. Custodiado por `simi-e2e-cerrado-en-produccion.test.ts`, que también asevera el orden.
- [x] Agendar o eliminar el segundo cron — resuelto: ya está agendado (ver §3).
- [ ] Aumentar cobertura de tests en la capa de endpoints (hoy los helpers puros están bien probados; los guards de auth/validación de las rutas, poco).
- [ ] Consolidar los ~20 guards de sesión duplicados en un helper único.
- [ ] Borrar ramas viejas sin fusionar (`chore/uat-hardening-*`, `feat/seguridad-h10-aislamiento-*`).
- [ ] Antes de abrir el chat / radicación pública al tráfico de internet: considerar un **escaneo de seguridad externo** automatizado.

---

## Lectura de conjunto

- **Sección 0** → precondición de todo lo demás. Desde el 2026-09-29 **ya no
  bloquea**: la facturación está activa y Storage verificado. Queda una casilla
  abierta ahí (el export de Firestore) que sí condiciona la §2.
- **Secciones 1 + 2 completas y sección 4 verificada** → listo para un **piloto interno controlado** con Laura.
- **Sección 5** → convierte "funciona en mis pruebas" en "funciona en la alcaldía".
- **Sección 6** → cerrar antes de abrirlo al público general.

> **Lo que sigue faltando para abrir a usuarios reales:** ya existe una copia de
> seguridad probada (2026-09-29), así que la §2 deja de estar en rojo. Lo que
> queda abierto es la **continuidad**: el respaldo diario estuvo 20 días caído
> sin que nadie lo notara. Una copia puntual protege el día que se hizo; lo que
> protege al municipio es que la cadencia corra **y que alguien se entere
> cuando se detiene**. Confirmar ambas cosas antes de abrir.

> Una auditoría no es un certificado: reduce el riesgo conocido, no garantiza cero
> fallos. La mayoría de problemas reales aparecen con uso y datos reales — por eso
> la sección 5 es la más importante.
