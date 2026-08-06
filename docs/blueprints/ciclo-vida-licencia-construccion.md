# Ciclo de vida — Licencia de Construcción (insumo de diseño del motor)

> Insumo de diseño para la **fase de resolución** del motor de expedientes ([ADR-0026](../adr/0026-motor-generico-expedientes-administrativos.md) **D1**: la resolución es específica del trámite y se implementa **en código** con revisión de Gobierno Digital, **no** es configurable por datos).
>
> Derivado de **documentos reales** de la Alcaldía (una Resolución LC de 5 págs + su Licencia de 2 págs + un oficio de prórroga). **Sin datos personales:** se conserva la **estructura, la secuencia y los parámetros**, nunca el caso concreto (titulares, cédulas, dirección, matrícula) — dato protegido (Ley 1581).
>
> Los ítems marcados **⏳ P1** esperan el concepto jurídico (ver [solicitud de concepto](../juridico/solicitud-concepto-juridico-licencia-construccion.md)) antes de implementarse.

## Secuencia del trámite (fase de resolución)

1. **Radicación** en ventanilla (intake — checklist oficial `F-PGD-009`).
2. **Evaluación técnica** por Planeación (revisión de completitud / subsanación).
3. **RESOLUCIÓN LC** — acto administrativo que aprueba el proyecto y concede la licencia.
4. **Notificación** — al interesado, a los **vecinos** y **edicto/publicación** a terceros.
5. **Ejecutoria** — ventana de **recursos** (reposición/apelación) de **10 días**; si no se interpone recurso, el acto **queda en firme y ejecutoriado**.
6. **Expedición de la LICENCIA** (certificado), una vez en firme.
7. **Vigencia** de la licencia + **prórroga única**.

## Los tres relojes (no confundirlos)

| Reloj | Inicio | Duración | Comportamiento | Estado |
|---|---|---|---|---|
| **R1 · Término para resolver** | Radicación en Ventanilla **tras verificar completitud** (= "en debida forma") ✅ | **45 días** — ⚠️ **CONTRADICCIÓN: hábiles (ing) vs. corridos (Planeación)** → ⏳ Jurídica | **REINICIA** ante modificación **o** subsanación (ambas igual). Planeación describe **nuevo radicado**; el ing **prefiere mantener el mismo radicado** → ⏳ Jurídica: ¿el reinicio exige radicado nuevo, o vale sobre el mismo sin gatillar silencio positivo? El motor abstrae "término desde el último **evento de radicación/reinicio**" (soporta ambos). | Hito y reinicio confirmados por Planeación. ⏳ **Jurídica:** unidad (hábiles/corridos), silencio positivo, nuevo-vs-mismo radicado, tope. |
| **R2 · Ejecutoria** | Notificación de la resolución | **10 días** para recursos | Firme si no hay recurso | Observado en documentos reales |
| **R3 · Vigencia de la licencia** | Firmeza / expedición | **36 meses** (obra nueva) · **24** (ampliación) | Prorrogable **una sola vez** por **+12 meses**; y **+6 meses adicionales para terminar** (según Planeación) | Decreto 1077/2015 art. 2.2.6.1.2.4.1 (vigencia + prórroga). ⏳ **Los +6 meses no están en ese artículo** — probablemente una **revalidación para terminación de obra**; confirmar base legal, si es a solicitud, y si exige obra avanzada |

## Estructura de los documentos que el motor deberá generar

### Resolución LC (acto administrativo)
- **Encabezado:** entidad, "RESOLUCIÓN", Nº LC, fecha, paginación (N de M).
- **Marco legal (facultades):** Art. 99 Ley 388/1997; Decretos 1077/2015, 1783/2021, 2218/2015, 097/2006, 1469/2010; Acuerdo Municipal 013/2003 (EOT); Resolución 0463/2017 (Formulario Único).
- **CONSIDERANDO.**
- **RESUELVE (artículos):** aprobar; términos de ejecución (vigencia); normas propias (ubicación, cuadro de áreas, reformas); conceder licencia Nº; responsables; responsabilidad civil; **notificación** (interesado + vecinos); sellamiento por cambio de uso; NSR-10/EOT; prohibiciones; **recursos (10 días)**; aislamientos.
- **CONSTANCIA DE EJECUTORIA:** fecha de notificación, firmeza y ejecutoria.
- **Firma** del Secretario de Planeación e Infraestructura (o **Subsecretario**). **Sin delegación del Alcalde** — la competencia es propia de Planeación (confirmado por Planeación).

### Licencia (certificado)
- Encabezado + "LICENCIA".
- Nº de licencia; **fecha de inicio / vencimiento**.
- Expedidor (Secretario de Planeación, Decreto 1077).
- Predio.
- **Cuadro de áreas** (terreno, construida por piso, común por piso, terraza, total).
- Titular(es); profesionales responsables (matrícula profesional).
- **OBSERVACIONES** (condiciones estándar: responsabilidad de firmantes, NSR-10, salubridad/estabilidad, vía pública, paramento, aislamientos, Ley 1228/2008…).
- Firma + "Elaboró".

## Parámetros para el motor (`TerminoLegal` / `RegimenSubsanacion`)

```
termino.dias                 = 45
termino.unidad               = ???                 # ⚠️ CONTRADICCIÓN: ing dijo HABILES, Planeación dice CORRIDOS → ⏳ Jurídica (la norma suele ser hábiles)
termino.hito                 = RADICACION_EN_DEBIDA_FORMA  # radicación tras verificar completitud (Planeación) ✅
termino.reinicioAnteCambio   = SI                  # modificación o subsanación (ambas igual) ✅ operativo
termino.reinicioRadicado     = ???                 # NUEVO (Planeación) vs. MISMO (preferencia ing) → ⏳ Jurídica (silencio positivo)
termino.origen               = ULTIMO_EVENTO_RADICACION  # abstracción del motor: soporta nuevo o mismo radicado
termino.competencia          = SECRETARIO_PLANEACION      # o Subsecretario; SIN delegación del Alcalde ✅
termino.tope                 = ???                 # ⏳ Jurídica: ¿límite de reinicios / plazo total?
ejecutoria.recursos_dias     = 10
vigencia.obra_nueva_meses    = 36                  # + prórroga única +12
vigencia.ampliacion_meses    = 24                  # + prórroga única +12
vigencia.otras               = {12, 6}             # Planeación menciona vigencias de 1 año y 6 meses según el tipo de licencia
vigencia.terminacion_meses   = 6                   # ⏳ aclarar con Planeación si es esto o una vigencia de 6 meses (posible confusión)
alerta.previaVencimiento     = 1_MES               # NUEVO (Planeación): alertar 1 mes antes del vencimiento de la LICENCIA (avisar al titular / pedir prórroga), auto-computado, para toda vigencia
```

## Mapeo a ADR-0026 (qué implica para el motor)

- La **resolución y la licencia son SALIDA** de la fase de resolución → **D1** (código, trámite-específico, revisión de Gobierno Digital). **No** es configurable por datos.
- El **reloj del término principal** conecta con la **deuda #3 (§A2)**: consumidor genérico de `terminos {días, unidad}`, sin reutilizar `calcularFechaVencimiento` del catálogo PQRSD. **La `unidad` (hábiles vs. corridos) está en disputa** (ver R1) → no cablear hasta que Jurídica la fije.
- **Modelo de reinicio:** el término corre desde el **último evento de radicación/reinicio**. Planeación describe un **nuevo radicado** por cambio; el ing prefiere el **mismo radicado**. El motor lo abstrae en un evento (`radicación vigente`), de modo que el expediente (D3) puede enlazar **uno o varios** radicados en el tiempo — la elección nuevo-vs-mismo y su validez frente al silencio positivo la fija Jurídica.
- **Alerta preventiva (NUEVO, Planeación):** 1 mes antes del vencimiento de la **licencia** (R3), auto-computada, para avisar al titular y permitir la prórroga — aplica a toda vigencia (36/24/12/6 meses).
- El comportamiento del término (unidad, reinicio, tope) es **parametrizable**; su valor **legal** lo fija el concepto jurídico, no la práctica operativa.
- **Precondición P1 sigue BLOQUEANTE** para implementar esta fase: los ítems ⏳ deben quedar resueltos **por escrito por Jurídica** antes de cablear cualquier plazo a un endpoint/cron (toca términos legales, silencio positivo y archivo indebido). **Las respuestas de Planeación son operativas, no sustituyen el concepto jurídico** — en especial la unidad del término (hábiles/corridos), hoy contradictoria.
