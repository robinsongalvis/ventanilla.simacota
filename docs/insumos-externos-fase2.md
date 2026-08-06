# Insumos externos pendientes para habilitar la Fase 2 — Motor de expedientes (Licencia de Construcción)

> **Propósito:** consolidar en un solo lugar lo que falta validar con **Jurídica** y **Planeación** antes de construir la **fase de resolución** del motor, para no edificar sobre supuestos. La ingeniería interna ya está **cerrada** (guard D9, RS-1, cierre SEV-1); estos son los **únicos** bloqueos que restan para la Fase 2.
>
> El sistema **calcula y alerta** plazos legales de forma **asistiva**; la decisión administrativa siempre es del funcionario (IA propone / funcionario decide).

## ✅ Resuelto por Planeación (operativo) — NO volver a preguntar
| Punto | Respuesta |
|---|---|
| **Hito de inicio** | Radicación en Ventanilla **tras verificar completitud** (= "en debida forma"): Planeación revisa → remite a Ventanilla → radica → cuentan los días |
| **Reinicio ante cambio** | Una **modificación** del proyecto o una **subsanación** (ambas igual) **reinician** el término |
| **Competencia** | La **Secretaría de Planeación** (firma el Secretario o Subsecretario). **El Alcalde NO interviene**; el motor no asume delegación del Alcalde |
| **Alerta preventiva** | El sistema debe **alertar 1 mes antes del vencimiento de la licencia** (avisar al titular / pedir prórroga), auto-computada |
| **Checklist de requisitos** | **Completo** (Certificación `F-PGD-009` v02, págs. 1 y 2) |

> ⚠️ **La duración NO está resuelta:** el ing dijo antes **45 días hábiles**; Planeación ahora dice **45 días corridos**. **Contradicción** → la resuelve Jurídica (ver abajo).

## 🔴 A · Para la Oficina Jurídica (concepto formal) — lo que Planeación NO puede zanjar

> Oficio ya redactado: `docs/juridico/solicitud-concepto-juridico-licencia-construccion.md`. Preguntas núcleo (legales):

1. **Unidad del término (CRÍTICO — resolver contradicción):** los 45 días, ¿son **hábiles** o **corridos**? El ing dijo hábiles; Planeación, corridos; la norma nacional suele contar en **hábiles**. Cambia el vencimiento ~3 semanas y el riesgo de silencio positivo.
2. **Legalidad del reinicio:** ante un cambio, ¿es correcto que el término **se REINICIE** (a cero), o el mecanismo legal es **suspender y reanudar**? Fundamento.
3. **¿Reinicio con radicado NUEVO o el MISMO?** Planeación describe un **nuevo radicado** por cambio; operativamente el ing prefiere mantener el **mismo radicado**. ¿Se puede reiniciar el término **sobre el mismo radicado** sin que el término de la radicación **original** gatille **silencio positivo**?
4. **Tope:** ¿hay un límite de reinicios o un plazo total, para que el trámite no quede sin fecha de vencimiento?
5. **Silencio administrativo positivo:** ¿en qué momento y bajo qué condiciones se configura, y qué salvaguardas lo conjuran? (Ley 388 art. 99 / Decreto 1077.)
6. **Competencia (solo confirmar):** ¿confirma que la competencia es de Planeación (**sin** acto de delegación del Alcalde)? ¿Hay algún acto interno de asignación de funciones que debamos citar?

## 🟠 B · Para Planeación / el ingeniero (operativo)

1. **Los 6 meses "para terminar":** después de la vigencia + la prórroga (12 meses), esos **6 meses**, ¿son una **revalidación para terminación de obra** (a solicitud, con obra avanzada), o son en realidad una **vigencia de 6 meses** de cierto tipo de licencia? (En vigencias mencionaste 3 años / 1 año / 6 meses — conviene distinguir si "6 meses" es una vigencia o un plazo extra de terminación.)
2. **Acto interno de asignación de funciones** (si existe): suministrarlo como soporte de la competencia de Planeación.

## Por qué importa (efecto en el diseño)
- La **unidad (hábiles/corridos)** y el **reinicio (mismo/nuevo radicado)** definen el cómputo del vencimiento y el riesgo de **silencio positivo** — el núcleo del reloj del motor.
- La **vigencia + prórroga + los 6 meses** definen el **vencimiento real** de la licencia y la **alerta preventiva** (1 mes antes), ver `docs/blueprints/ciclo-vida-licencia-construccion.md`.
- Sin estas respuestas, el diseño de la fase de resolución se construiría sobre supuestos; por eso la Fase 2 permanece detenida hasta tenerlas. **Las respuestas de Planeación son operativas; la unidad del término y el silencio positivo los debe fijar Jurídica por escrito.**
