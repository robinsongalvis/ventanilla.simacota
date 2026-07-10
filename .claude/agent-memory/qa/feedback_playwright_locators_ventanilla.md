---
name: feedback-playwright-locators-ventanilla
description: Gotchas de locators Playwright específicos del dashboard de Ventanilla (substring matching, panel lateral no-modal, interstitial impredecible)
metadata:
  type: feedback
---

Patrones que causaron falsos negativos al escribir `e2e/` (auditor
funcional Playwright, ADR-0002 Fase 2) contra `app/interno/dashboard/page.tsx`.
Reutilizar al escribir escenarios nuevos de los 9 restantes del presupuesto.

**`getByLabel`/`getByRole` hacen match por substring por defecto.** En este
dashboard eso es ambiguo con frecuencia: "Correo electrónico" matchea
también el checkbox "No aporta correo electrónico" y una opción del select
"Medio de respuesta"; "Cerrar modal" matchea también el botón de la X con
aria-label "Cerrar modal de radicación rápida"; "Bandeja" matchea también
cada botón "Filtrar bandeja por..." dentro de la propia vista Bandeja.
Regla general: usar `{ exact: true }` por defecto en este proyecto salvo
que el substring sea intencional, o escopar al landmark correcto (p. ej.
`page.getByRole('navigation').getByRole('button', { name: 'Bandeja' })`
para el nav lateral).

**El panel de detalle de un radicado (`PanelDerecho`) NO es un modal a
pantalla completa** — es un panel lateral; el Tablero/Bandeja detrás sigue
visible y puede repetir el mismo texto (radicadoId, badges de estado). Un
`getByText(radicadoId)` o `getByText('Resuelto')` sin escopar resuelve a
>1 elemento. Usar en su lugar algo que solo exista DENTRO del panel: el
`role="tab"` "Responder", o el `role="button"` cuyo nombre cambia con el
estado ("Marcar como resuelto" → "Ya está resuelto").

**Modal "Resumen del día" es un interstitial impredecible** — se abre en
cualquier momento tras el login (fetch async) y su backdrop `fixed inset-0`
intercepta clics. `page.addLocatorHandler` es la solución correcta, pero
apuntar al botón "Cerrar" VISIBLE dentro de la tarjeta
(`getByRole('dialog', {name:'Resumen del día'}).getByRole('button',
{name:'Cerrar', exact:true})`), NUNCA al backdrop completo — el backdrop
resuelve como clicable pero su centro (donde Playwright apunta) cae bajo
la tarjeta del propio modal, causando un bucle de reintentos sin fin.
Registrar el handler en el helper `login()` compartido, no por test.

**Confirmaciones de éxito en filas de tabla con estado local + listener en
tiempo real son carrera potencial.** Si una fila muestra un feedback local
("✓ Asignado") pero el mismo evento hace que esa fila se filtre/desmonte
vía un listener de Firestore, el checkmark puede no llegar a verse nunca.
Preferir aserciones sobre el efecto persistente (la fila desaparece de la
lista filtrada) en vez del feedback transitorio.
