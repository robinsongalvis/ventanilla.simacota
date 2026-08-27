# Acta de cierre — PT-3: superficie expuesta

**Fecha:** 24-ago-2026 · **Marco:** PLAN_GO_LIVE, paquete PT-3 (Fase 2)
**Autorización:** propietario, 24-ago-2026, por chat («dale, sigue con el PT-3»)

## Qué se cerró, con su evidencia

1. **`/api/ai/feedback` exige sesión** [#221]. Era la única ruta de IA que
   escribía estado de negocio sin autenticación: un anónimo con un
   radicadoId derivable sembraba feedback en radicados reales con actor
   forjado. Ahora la sesión va antes del rate limit y la identidad del
   evaluador sale de la sesión. Tests con mordida verificada (contra la
   ruta vieja fallan ambos).
2. **Storage: bucket entero Admin-SDK-only** [#221]. Las dos puertas
   `signedIn()` eran puertas muertas tras el cutover (cero llamadores,
   barrido sin truncar); su único uso posible era el abuso. Desplegado a
   stage y producción por el propietario, y **verificado VIVO**: el
   verificador de deriva reporta `SIN DERIVA` en ambas superficies
   (releases `d8e0c369…` firestore / `12f264ed…` storage, 24-ago).
3. **Las 4 cuentas UAT, desactivadas** — 3 ya lo estaban (flujo de
   Administración, previo, descubierto por el dry-run del propietario) y
   `controlinterno.test@` se retiró hoy con el script: doble candado
   (Auth `disabled` + perfil archivado), sin borrar — sus uid viven en
   trazabilidades reales y borrarlos dejaría huérfano el registro.

## Herramienta nueva que dejó el paquete

`scripts/operacion/verificar-reglas-vivas.mjs` (semilla de PT-5): compara
byte a byte las reglas ACTIVAS en Firebase contra las del repo. Nació de un
«already up to date» ambiguo que no distinguía «ya estaban» de «no subí
nada». Desde hoy, «las reglas están desplegadas» se demuestra, no se afirma.

## Lecciones del paquete

- El script de retiro abortaba ante «ya está hecho» — el primer uso real lo
  delató (3 de 4 ya archivadas) y se corrigió: un script de operación debe
  CONVERGER al re-ejecutarse [#222].
- Dos guardas estáticas del go-live afirmaban las reglas viejas de Storage
  y una lectura truncada escondió un test lector — mismos patrones de la
  jornada anterior, mismas correcciones: barridos sin `head`, guardas
  re-apuntadas a donde el invariante vive.
- El pull del propietario y un merge se cruzaron por segundos y produjeron
  una corrida con el script viejo: inofensivo por las guardas, pero la
  regla operativa queda escrita — **verificar `Updating …` en el pull antes
  de ejecutar scripts recién corregidos**.
