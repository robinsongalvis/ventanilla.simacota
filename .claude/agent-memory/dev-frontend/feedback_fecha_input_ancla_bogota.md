---
name: fecha-input-ancla-bogota
description: "<input type=\"date\"> que alimenta un cálculo de plazo legal (días hábiles/civiles, Bogotá) debe anclarse a T12:00:00-05:00 antes de enviarse — si no, corre el riesgo de un día de diferencia"
metadata:
  type: feedback
---

**Regla:** cuando un formulario de este proyecto tiene un `<input
type="date">` cuyo valor ("YYYY-MM-DD", sin hora) va a alimentar un cálculo
de plazo legal server-side basado en `atLocalNoon`/`sumarDiasHabiles`
(`lib/tiempos-radicado.ts`), el valor que se ENVÍA al servidor debe
anclarse explícitamente al mediodía de Bogotá antes del envío:
`` `${valor}T12:00:00-05:00` `` — no enviar el "YYYY-MM-DD" crudo.

**Por qué:** `atLocalNoon(value)` hace `new Date(value)` y luego extrae el
día civil vía `Intl.DateTimeFormat` en `America/Bogota`. Un string
"YYYY-MM-DD" sin hora se interpreta como MEDIANOCHE UTC — en Bogotá
(UTC−5) eso son las 19:00 del día CALENDARIO ANTERIOR. Resultado: el
cálculo de plazo arrancaría un día civil antes del que el funcionario
realmente seleccionó. Encontrado 8-ago-2026 construyendo el campo opcional
"Fecha de comunicación del acta" (`RegistrarActuacionModal.tsx`, Bloque
A·A4/A5) — ese valor alimenta `calcularFechaLimiteRespuestaActa` →
`sumarDiasHabiles` → `atLocalNoon` en el servidor
(`lib/server/expedientes-licencias.ts`), y la ruta
(`app/api/licencias/expedientes/[id]/actuaciones/route.ts`) pasa el body
TAL CUAL, sin re-anclar. Confirmé el patrón `T12:00:00-05:00` ya
establecido para este mismo problema en
`app/api/interno/resumen-diario/route.ts:254` (ahí el backend ancla al
leer; aquí decidí anclar en el frontend ANTES de enviar porque no puedo
tocar la ruta ni `lib/server/`).

**Cómo aplicar:** antes de enviar CUALQUIER `<input type="date">` cuyo
valor vaya a un endpoint que use `atLocalNoon`/`sumarDiasHabiles`/
`calcularFechaVencimiento` (o downstream de esas funciones), construir el
string anclado en el cliente en vez de pasar `e.target.value` directo. Si
no es obvio si el endpoint re-ancla el valor, revisar el código de la ruta
(no asumir) — algunos SÍ re-anclan (`resumen-diario`), este NO.

Ver [[project_bloque_a4_handoff_radicado_expediente]] (el bloque donde
apareció) y [[project_bloque_a3_checklist_documentos]] (mismo principio
general: verificar el código real del endpoint, no asumir).
