# Insumos externos pendientes para habilitar la Fase 2 — Motor de expedientes (Licencia de Construcción)

> **Propósito:** consolidar en un solo lugar lo que falta validar con **Jurídica** y **Planeación** antes de construir la **fase de resolución** del motor, para no edificar sobre supuestos. La ingeniería interna ya está **cerrada** (guard D9, RS-1, cierre SEV-1); estos son los **únicos** bloqueos que restan para la Fase 2.
>
> El sistema **calcula y alerta** plazos legales de forma **asistiva**; la decisión administrativa siempre es del funcionario (IA propone / funcionario decide).

## ✅ Ya resuelto — NO volver a preguntar
| Punto | Respuesta | Fuente |
|---|---|---|
| Hito de inicio del término | **Ingreso a ventanilla** (radicación) | Planeación (ing) |
| Duración del término para resolver | **45 días hábiles** | Planeación (ing) |
| Competencia para expedir | **Secretaría de Planeación e Infraestructura** (Ley 388 art. 99 + Decreto 1077) | Resoluciones reales |
| Checklist de requisitos | **Completo** (Certificación `F-PGD-009` v02, págs. 1 y 2) | Documento oficial |

## 🔴 A · Para la Oficina Jurídica (concepto formal)

> Oficio ya redactado: `docs/juridico/solicitud-concepto-juridico-licencia-construccion.md`. Preguntas núcleo:

1. **Reinicia vs. suspende (crítico):** ante un cambio durante el trámite, ¿el término de 45 días hábiles legalmente **se REINICIA** (vuelve a cero) o **se SUSPENDE** (se pausa y luego se reanuda)? ¿Cuál es el fundamento? *(Planeación indica, en la práctica, que reinicia; necesitamos la lectura jurídica porque incide en el silencio positivo.)*
2. **Qué constituye un "cambio":** ¿una modificación del proyecto por el solicitante, un requerimiento de subsanación de documentos, o ambos? ¿Reciben el mismo tratamiento?
3. **Tope:** si el término se reinicia, ¿existe un número máximo de reinicios o un plazo total, para que el trámite no quede sin fecha de vencimiento definida?
4. **Silencio administrativo positivo:** ¿en qué momento y bajo qué condiciones se configura en la licencia de construcción, y qué salvaguardas de procedimiento lo conjuran? (Ley 388 art. 99 / Decreto 1077.)
5. **Hito "en debida forma":** ¿el término corre desde el **ingreso a ventanilla** o, jurídicamente, desde la **radicación en legal y debida forma** (solicitud completa)? Importa cuando la solicitud entra con requisitos por subsanar.
6. **Competencia:** confirmar la base vigente; ¿existe un **acto de delegación del Alcalde** que debamos citar en el expediente digital (tipo, número, fecha)?

## 🟠 B · Para Planeación / el ingeniero (operativo)

1. **Los +6 meses para terminar:** después de la vigencia (36 meses obra nueva / 24 ampliación) + la prórroga única (12 meses), esos **6 meses adicionales para terminar** la obra, ¿bajo qué **figura** se conceden — **revalidación para terminación de obra**, u otra? ¿Se otorgan **a solicitud** o corren automáticamente al vencer la prórroga? ¿Exigen que la obra esté **avanzada / certificada**?

## Por qué importa (efecto en el diseño)
- **Reinicia-vs-suspende** define el cómputo del vencimiento y el riesgo de **silencio positivo** (parámetro `comportamientoAnteCambio` del reloj del motor).
- **Los +6 meses** definen el **vencimiento real** de la licencia (¿54 meses máx. en obra nueva?, ver `docs/blueprints/ciclo-vida-licencia-construccion.md`).
- Sin estas respuestas, el diseño de la fase de resolución se construiría sobre supuestos; por eso la Fase 2 permanece detenida hasta tenerlas.
