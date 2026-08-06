# Insumos externos para habilitar la Fase 2 — Motor de expedientes (Licencia de Construcción)

> **Propósito:** consolidar lo que falta validar antes de construir la **fase de resolución** del motor. La ingeniería interna está **cerrada** (guard D9, RS-1, cierre SEV-1, G2). El **insumo de investigación normativa del 6-ago-2026** resolvió las contradicciones previas a nivel de investigación; queda **una sola gestión externa**: la **ratificación por la Oficina Jurídica** del texto consolidado (el propio insumo la exige antes de programar reglas).
>
> El sistema **calcula y alerta** de forma **asistiva**; la decisión administrativa siempre es del funcionario.

## ✅ Resuelto (operativo + investigación normativa) — NO volver a preguntar

| Punto | Resolución | Fuente |
|---|---|---|
| **Unidad del término** | **45 días HÁBILES** (la contradicción hábiles/corridos se resuelve a favor de **hábiles**) | D. 1077 art. 2.2.6.1.2.3.1 + concepto Minvivienda |
| **Hito de inicio** | **Radicación en legal y debida forma** (tras verificar completitud; flujo Planeación: revisa → remite → radica → corren los días) | Planeación + D. 1077 |
| **Mecanismo ante observaciones** | ⚠️ **PARCIAL — es el único punto con tensión abierta.** Norma investigada: el acta **SUSPENDE** y el término **se REANUDA** al subsanar (mismo radicado); reinicio solo vía desistimiento→archivo→nueva solicitud. **Decisión operativa del propietario (6-ago): REINICIO a cero** + modelo dual de radicado (`LEGACY_NUEVO` → objetivo `MISMO_RADICADO`) por bandera. El motor implementa **ambas semánticas**; cuál se activa lo decide la **ratificación de Jurídica** (es el gate del oficio §2) | D. 1077 arts. 2.2.6.1.2.2.4 / 2.2.6.1.2.3.1 + CPACA art. 17 · decisión 6-ago |
| **Tope de reinicios** | **No hay tope legal** (cada radicación es petición independiente). Trazar radicados sucesivos por predio/proyecto, sin bloquear | CPACA + D. 1077 |
| **Silencio positivo (SAP)** | Opera si no se resuelve **ni notifica** en el término neto; NO se configura si hubo pronunciamiento (acta); NO legaliza lo inviable. Reglas: reloj neto en hábiles, suspensiones automáticas, alertas 60/80/90%, control de **notificación**, trazabilidad | CPACA 84-85 + jurisprudencia |
| **Los "6 meses"** | Son la **REVALIDACIÓN** (figura separada, a solicitud, con avance ≥50%): ventana **2 meses** en texto base (D. 1783/2021), ampliada transitoriamente (D. 74/2025, solicitudes hasta 30-jun-2026, ya vencida). **NO codificar "6 meses"** — parametrizar por fecha | D. 1077 art. 2.2.6.1.2.4.2 |
| **Vigencias** | Obra nueva 36+12=48 · otras modalidades 24+12=36 · saneamiento/subdivisión 12 (no prorrogable). Prórroga: solicitar **≥30 días hábiles antes** del vencimiento | D. 1783/2021 |
| **Competencia** | **Propia de Planeación** (Secretario/Subsecretario). **El Alcalde no interviene** | Planeación + resoluciones reales |
| **Checklist** | Completo (`F-PGD-009` v02, págs. 1-2) | Documento oficial |
| **Alerta preventiva** | Requerida por Planeación. ⚠️ **Ajuste de diseño:** "1 mes antes" llega **tarde** (la prórroga se pide ≥30 días **hábiles** antes ≈ 6 semanas) → alerta principal **≥2 meses antes** + recordatorio del cierre real + alerta post-vencimiento (ventana de revalidación) | Planeación + D. 1783 |

## 🔴 ÚNICA gestión externa restante — Oficina Jurídica: RATIFICAR el texto consolidado

> Oficio listo para tramitar: `docs/juridico/solicitud-concepto-juridico-licencia-construccion.md`. Ya no son preguntas abiertas — es **confirmar (o corregir)** cada punto contra el texto consolidado vigente:

1. Término: **45 días hábiles** desde radicación en debida forma; ¿el término mismo admite prórroga de la autoridad?
2. **Mecánica del cambio (EL punto crítico):** la norma investigada dice **suspende/reanuda** (acta, 30+15; nuevo radicado solo tras desistimiento); la operación decidió **reinicio a cero sobre el MISMO radicado**. Jurídica debe pronunciarse **expresamente**: ¿es admisible reiniciar a cero sobre el mismo radicado **sin riesgo de SAP** (que el término original se tenga por vencido)? Sin este pronunciamiento escrito, la semántica `REINICIA_A_CERO` **no se activa**.
3. **SAP:** condiciones, límites y salvaguardas; visto al control por fecha de **notificación**. **No existe aún respuesta de Jurídica sobre SAP** — lo que hay es investigación normativa (no oficial).
4. **Vigencias/prórroga/revalidación:** cuadro D. 1783/2021; **ventana de revalidación aplicable HOY** a solicitudes nuevas (¿2 meses?); tratamiento de expedientes bajo D. 74/2025; confirmación de que "6 meses" no es el valor vigente.
5. **Competencia** propia de Planeación; referencia del acto interno de funciones, si existe.

## 🟠 Con Planeación (menor, no bloqueante)

1. **Validar el ajuste de la alerta** (≥2 meses antes en lugar de 1 mes — ver arriba).
2. **Acto interno de asignación de funciones** (si existe), como soporte documental de la competencia.

## Por qué la ratificación sigue siendo el gate

El propio insumo normativo lo advierte: las normas de vigencia/prórroga/revalidación **cambiaron varias veces** (D. 1783/2021, D. 74/2025) y la versión aplicable depende de la **fecha de cada expediente**; el texto consolidado debe confirmarlo Jurídica **antes de programar reglas**. El motor lo absorbe con **valores en configuración parametrizada** (nunca constantes en código): la arquitectura puede avanzar; los **valores legales** esperan la ratificación.
