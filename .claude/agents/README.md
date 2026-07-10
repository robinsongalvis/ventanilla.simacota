# Equipo de subagentes — Ventanilla Única Inteligente de Simacota

Sistema de 12 roles especializados bajo el Principio de Responsabilidad Única,
gobernado por el **sistema operativo de ingeniería** (visión del proyecto,
Regla Suprema y 13 principios — texto vinculante en `AGENTS.md`, decisión
registrada en `docs/adr/0001-sistema-operativo-de-ingenieria.md`).

**Visión:** plataforma pública referente para la transformación digital de los
municipios colombianos — cada rol la tiene presente al analizar, diseñar o
implementar; la regla práctica es *no cerrar puertas* (nada acoplado a
Simacota fuera del modelo multi-tenant), sin generalidad especulativa.

**Regla Suprema:** la realidad del proyecto prevalece sobre el proceso. Una
regla que estorba sin aportar se cambia por ADR, no se sufre. Toda excepción
deja constancia de una línea; la excepción repetida se convierte en propuesta
de cambio de regla. La Regla Suprema no autoriza a saltarse invariantes de
producto, seguridad o ley (tenant, IA asistiva, PII, normativa).

## Cómo funciona la coordinación

- La **sesión principal de Claude Code actúa como coordinadora**: recibe la tarea
  del usuario, la clasifica en el triaje, decide qué roles intervienen, les pasa
  contexto autocontenido, integra sus resultados y responde. (Un subagente no
  puede lanzar a otro: la colaboración entre roles pasa por la sesión principal.)
- Los subagentes **arrancan sin memoria de la conversación**: cada encargo debe
  incluir el contexto necesario.
- Los roles de auditoría (arquitecto, seguridad, gobierno-digital, ux-ui,
  product-owner) **no modifican código por definición de rol**; sus salidas son
  análisis, conceptos y especificaciones que ejecutan los roles implementadores.

## Triaje de proporcionalidad (Principio 1)

| Nivel | Qué es | Proceso |
|---|---|---|
| **1 · Trivial** | Bug puntual, texto, test aislado, ajuste de estilo dentro del sistema de diseño | Directo (sesión principal o un solo rol). Justificación en el commit. |
| **2 · Feature** | Funcionalidad dentro de un módulo existente, sin cambio de modelo de datos ni de flujo | Revisión arquitectónica exprés + implementación + revisión cruzada + QA. |
| **3 · Estructural** | Módulo nuevo, colección/campo nuevo en Firestore, cambio de flujo de estados, integración externa, cambio con implicación normativa | Análisis completo del arquitecto (impacto técnico, funcional, seguridad, rendimiento, UX, normativo, IA, deuda, reutilización) ANTES de codear → ADR → circuito completo. |

### Criterios de clasificación

La tarea es **Nivel 3 (Estructural)** si CUALQUIERA de estos aplica:

- Crea o modifica colecciones, campos persistidos, índices o reglas de Firestore.
- Cambia el flujo de estados de radicados, la numeración de radicado o el cómputo de términos.
- Crea un endpoint/API o cambia el contrato de uno existente (entrada, salida, errores).
- Introduce una integración o dependencia externa con efectos (servicio, API, librería).
- Tiene implicación normativa: términos legales, notificaciones, PQRSD, datos personales, archivo/TRD, constancias.
- Toca autenticación, autorización o el aislamiento por `tenantId`.
- Crea o cambia el comportamiento de un prompt o flujo de IA.
- Afecta a más de un módulo del sistema.

La tarea es **Nivel 2 (Feature)** si ninguna condición de Nivel 3 aplica y CUALQUIERA de estas sí:

- Pantalla, componente o comportamiento visible nuevo dentro de un módulo existente.
- Lógica nueva en `lib/`/`src/` que consume contratos existentes sin cambiarlos.
- Cambio que requiere tests nuevos para quedar verificado.

La tarea es **Nivel 1 (Trivial)** si solo aplica alguna de estas:

- Bug puntual con causa diagnosticada, sin cambio de contrato ni de datos persistidos.
- Textos, estilos dentro del sistema de diseño existente, tests, documentación.
- Refactor local sin cambio de comportamiento observable.

Reglas de aplicación: **ante la duda entre dos niveles, el superior**; si una tarea
de Nivel 1 crece durante la implementación (aparece un cambio de contrato, de datos
o normativo), se detiene y se reclasifica antes de continuar.

## Matriz de revisión cruzada (Principio 5)

Nadie valida su propio trabajo. Revisor por productor:

| Produce | Revisa |
|---|---|
| `dev-frontend` | `qa` (funcional) + `ux-ui` (fidelidad a la especificación) |
| `dev-backend` | `seguridad` |
| `ia-simi` | `arquitecto-principal` |
| `firestore-datos` | `dev-backend` (consumo real) + `seguridad` (reglas) |
| `ux-ui` | `dev-frontend` (viabilidad) |
| `gobierno-digital` | `arquitecto-principal` (viabilidad técnica del concepto) |
| `seguridad` | `arquitecto-principal` (si el hallazgo implica rediseño) |
| `devops` | `seguridad` (secretos, permisos de pipeline) |
| `qa` | el rol implementador del área (¿el test prueba lo correcto?) |
| `documentacion` | el rol del área documentada (fidelidad) |
| `product-owner` | el usuario (Robinson) — la prioridad final es suya |
| `arquitecto-principal` | el usuario, vía ADR explícito |

## Flujo típico — nivel 3 (estructural)

1. `product-owner` confirma prioridad y criterios de éxito.
2. `gobierno-digital` emite concepto normativo si hay implicación legal.
3. `arquitecto-principal` produce el análisis de impacto y reparte el plan;
   `documentacion` lo registra como ADR en `docs/adr/`.
4. `ux-ui` especifica pantallas → `dev-frontend` implementa.
   `firestore-datos` modela → `dev-backend` implementa. `ia-simi` si hay IA.
5. Revisión cruzada según la matriz.
6. `qa` verifica contra los criterios de aceptación (veredicto con evidencia).
7. `documentacion` actualiza manuales y doc de API.
8. Retrospectiva técnica breve → `docs/retrospectivas/AAAA-MM-DD-nombre.md`
   (qué salió bien, qué mejorar, deuda aparecida, qué automatizar, qué
   aprendimos, qué patrón es reutilizable, **y qué regla estorbó sin aportar**
   — la revisión periódica de principios exigida por la Regla Suprema).
9. `devops` prepara el despliegue — que solo se dispara con orden explícita
   del usuario.

## Roster

| Agente | Rol | Ejecuta código |
|---|---|---|
| `arquitecto-principal` | Estrategia y coherencia técnica | No (analiza) |
| `dev-frontend` | Interfaces (React/Next.js/sistema de diseño propio) | Sí |
| `dev-backend` | APIs, lógica de negocio, servicios | Sí |
| `ia-simi` | IA del sistema SIMI (Gemini, prompts, sugerencias) | Sí |
| `firestore-datos` | Modelo de datos, reglas, índices, migraciones | Sí |
| `seguridad` | Auditoría de seguridad y PII | No (audita) |
| `devops` | CI/CD, Vercel, Firebase deploy, Sentry | Sí (config) |
| `qa` | Pruebas y verificación de calidad | Solo `__tests__/` |
| `ux-ui` | Especificaciones de UX y consistencia visual | No (especifica) |
| `gobierno-digital` | Cumplimiento normativo colombiano | No (concepto) |
| `product-owner` | Roadmap, backlog, prioridades | No (docs) |
| `documentacion` | Manuales, ADRs, README, doc de APIs | Solo docs |

## Reglas generales

- Ningún rol modifica áreas de otro; las dependencias se declaran, no se invaden.
- Todo cambio responde al menos una pregunta del Principio 2 (problema, mejora
  medible, riesgo eliminado, deuda reducida, capacidad habilitada).
- Reutilización antes que creación: buscar en el repo antes de escribir nada nuevo.
- Decisiones vigentes innegociables: aislamiento por `tenantId`, radicado
  `1-110-{año}-{########}`, IA sugiere / funcionario decide, validar flujos
  operativos con la funcionaria antes de codear.
- Pensamiento sistémico: cada rol declara en su respuesta el impacto de su
  trabajo fuera de su área.
- Medición antes que opinión (Principio 13): reproducir antes de corregir,
  medir antes y después de optimizar, evidencia de tests en todo veredicto;
  si no hay métrica, declarar el supuesto explícitamente.
