/* ══════════════════════════════════════════════════════════════
   Pieza angular (P2.1) — kill-switch de la radicación interna a servidor.

   Fase 2 (docs/CRONOGRAMA_PIEZA_ANGULAR.md): crea el endpoint
   `app/api/radicacion/interna` con este switch en OFF. La producción NO
   cambia de comportamiento en esta fase — el cliente sigue llamando a
   `lib/actions/radicarVentanilla.ts` (radicarInstitucionalmente) tal cual.

   Fase 3 (paso 3 de la migración, dueño: dev-frontend): conmuta el caller
   de `app/interno/dashboard/page.tsx` para leer este flag — ON invoca
   `fetch('/api/radicacion/interna', …)`, OFF conserva la action legada.
   Ver §Kill-switch de 1 línea del blueprint
   (docs/blueprints/CN-pieza-angular-radicacion-interna.md).

   Reversión instantánea (Fase 3, §Plan de rollback): mientras
   `firestore.rules`/`storage.rules` sigan abiertas a cliente (Fase 4 aún
   no ejecutada), poner este flag en `false` basta para volver a la ruta
   legada sin redeploy de reglas.
══════════════════════════════════════════════════════════════ */
// ⚠️ RAMA UAT (uat/fase3-cutover-preview) — switch ON SOLO PARA EL PREVIEW DE UAT.
// PROHIBIDO mergear esta rama a main: el cutover real es un PR de 2 líneas aparte (PdC 3).
export const USA_RADICACION_INTERNA_SERVER = true;
