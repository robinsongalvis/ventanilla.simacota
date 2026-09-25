# Laboratorio Institucional de Calidad — Propuesta de arquitectura

- **Estado:** ACEPTADA — ADR-0002 (2026-07-09). Arquitectura de alto nivel CONGELADA
  hasta finalizar la Fase 2 y validar el laboratorio con evidencia real; mejoras se
  registran como propuestas, no se implementan.
- **Fecha:** 2026-07-09
- **Origen:** hallazgos de la auditoría funcional E2E del 2026-07-09 (H1: entorno local
  inoperante para servidor; H2: sin separación de entornos, toda prueba de escritura
  consume consecutivos reales) + inventario de infraestructura de calidad existente.
- **Nivel de triaje:** 3 (estructural) — este documento es la fase de arquitectura previa.

## 1. Qué existe hoy (inventario verificado)

| Componente | Estado | Evidencia |
|---|---|---|
| Suite unitaria/render | ✅ 822 tests, 100 archivos, verde | `vitest run` 2026-07-09 |
| CI (GitHub Actions) | ⚠️ Parcial: lint + tsc + npm audit + build. **No ejecuta la suite de tests** | `.github/workflows/ci.yml` |
| Scripts UAT | ⚠️ Existen (`uat-1.ts` 20 pasos, `uat-h02/h03/hardening.sh`) pero corren **contra producción**, con password de prueba **hardcodeada en el repo** | `scripts/uat-1.ts:25` |
| Datos de prueba | ⚠️ Solo reactivo: `marcar-datos-prueba.ts` marca `isTest` a posteriori. No hay generador | `scripts/marcar-datos-prueba.ts` |
| Entornos | ❌ Un solo proyecto Firebase (`ventanilla-unica-f31b1`) para todo. Emulador local imposible (Java 8) | `.env.local`, memoria del proyecto |
| E2E con navegador | ❌ No hay Playwright/Cypress. Existe `E2ETestPanel` embebido en la UI (hallazgo H4: sin compuerta de entorno) | `package.json`, `SimiGobernanzaPanel.tsx:124` |
| Tests de Firestore Rules | ❌ Solo dry-run de sintaxis. Sin `@firebase/rules-unit-testing` | memoria: entorno Firebase local |
| Rendimiento | ❌ Sin Lighthouse/presupuestos de latencia. Sentry sí está configurado | `package.json`, `sentry.*.config.ts` |
| Gobernanza IA | ✅ Base sólida: `ai-governance.md`, `prompts-registry.md`, tests SIMI, regla "sugiere/decide" con tests | `docs/`, `__tests__/simi-*.test.ts` |
| Sanitización PII, rate limits, magic bytes | ✅ Implementados y testeados | `lib/seguridad/`, tests |
| Auditorías documentadas | ✅ Precedente manual | `docs/AUDITORIA_*.md`, `MATRIZ_UAT_FINAL.md` |

Conclusión del inventario: el proyecto tiene una base de calidad **unitaria** fuerte y
gobernanza documental seria, pero carece de las tres piezas que convierten eso en un
laboratorio: **entornos aislados, datos sintéticos y auditoría automática del ciclo completo**.

## 2. Arquitectura de entornos (requisito 1)

**Estrategia: 2 proyectos Firebase reales + emuladores efímeros.** Tres proyectos reales
serían más caros de mantener que el valor que aportan a un equipo de este tamaño (YAGNI);
los emuladores cubren DEV mejor que un proyecto real: son gratis, se destruyen y recrean
en segundos, y permiten probar reglas de seguridad sin riesgo.

| Entorno | Firebase | App | Datos | Uso |
|---|---|---|---|---|
| **DEV** | **Firebase Emulator Suite** (Auth + Firestore + Storage) en Docker | `next dev` local | Alcaldía Sintética (seed determinista) | Desarrollo diario y tests de integración |
| **STAGE** | Proyecto real nuevo: `ventanilla-simacota-stage` (plan gratuito) | Vercel Preview (rama `develop`) con env vars de stage | Alcaldía Sintética (re-seedeable) | UAT, auditoría E2E completa, validación pre-despliegue |
| **PROD** | `ventanilla-unica-f31b1` (actual) | Vercel Production | Datos institucionales reales | Solo operación real. **Ningún script de prueba vuelve a apuntar aquí** |

Decisiones de soporte:

- **Java 8 local:** el Emulator Suite exige Java 11+; se resuelve corriendo el emulador
  dentro de Docker (`docker-compose.lab.yml` nuevo, imagen con JDK) — Docker ya es parte
  del stack del proyecto. En CI (GitHub Actions, ubuntu) el emulador corre nativo.
- **Variables por entorno:** `.env.local` (dev/emulador), Vercel Preview env (stage),
  Vercel Production env (prod). Regla dura: los scripts de laboratorio se niegan a correr
  si `PROJECT_ID == ventanilla-unica-f31b1` salvo flag explícito `--prod-solo-lectura`.
- **Storage y Auth** quedan aislados automáticamente al separar proyectos.
- **Reglas e índices**: mismo `firestore.rules`/`indexes` desplegado a stage primero;
  prod solo tras pasar el laboratorio.

## 3. Alcaldía Sintética — datos institucionales de prueba (requisito 2)

Generador determinista (`scripts/laboratorio/seed.ts`, faker con semilla fija) que produce
un municipio ficticio coherente, **reutilizando los catálogos y tipos reales** del proyecto
(`src/types/ventanilla.ts`, catálogo de dependencias/áreas TRD, tipos PQRSD):

- **9 dependencias** con códigos TRD reales (100–150) + áreas transversales.
- **Funcionarios** (usuarios Auth con custom claims + doc Firestore): 1 ventanilla,
  1 por dependencia, 1 control interno, 1 admin.
- **Ciudadanos ficticios** (nombres/cédulas/correos sintéticos — jamás datos reales).
- **Radicados en todos los estados** del enum real (`PENDIENTE`, `ASIGNADO`, `POR_VENCER`,
  `VENCIDO`, `PRORROGA`, …), con fechas coherentes (algunos al borde del término legal,
  algunos vencidos) para ejercitar el semáforo.
- **Los 10 tipos PQRSD**, incluidas anónimas e identidad reservada.
- **Expedientes completos**: documentos adjuntos (PDF fixtures), actuaciones, traslados,
  oficios de salida con constancia, respuestas, sellos, historial de trazabilidad íntegro.
- **Interacciones SIMI** registradas (sugerencia + decisión humana) para auditar IA.

Coherencia garantizada por construcción: el seed no inserta documentos sueltos sino que
**ejecuta los mismos servicios de dominio de la aplicación** (radicar, asignar, responder…),
de modo que los datos nacen por el camino real y la trazabilidad es auténtica. Esto además
convierte al seed en el primer consumidor del ciclo completo: si el seed no puede construir
la alcaldía, el ciclo está roto.

## 4. Auditorías automáticas (requisitos 3–7)

Cinco auditores, cada uno propiedad de un rol del equipo de subagentes:

### 4.1 Auditor funcional (dueño: `qa`)
Playwright (nuevo) contra STAGE o emulador: guion derivado de la auditoría manual del
2026-07-09 — las 16 etapas del trámite como **un** flujo dorado + variantes negativas
(anónimo, reservado, traslado, prórroga, devolución). Verificaciones clave: numeración
consecutiva sin huecos ni saltos, cada mutación deja evento de historial, la consulta
pública refleja el estado real, ningún dato se pierde entre etapas (comparación de
expediente completo al inicio y al cierre). Suite **deliberadamente pequeña** (< 15
escenarios E2E): la pirámide de tests ya tiene 822 unitarios; el E2E valida integración,
no reemplaza unitarios.

### 4.2 Auditor normativo (dueño: `gobierno-digital` define la matriz; `qa` la automatiza)
Matriz de aserciones ejecutables, cada una etiquetada con norma y artículo:
- Ley 1755/2015: términos 15/10/30 días **hábiles** (calendario colombiano con festivos),
  prórroga única notificada, traslado por competencia, peticiones verbales y anónimas.
- Ley 1437/2011: contenido mínimo de constancias y notificaciones.
- Ley 1581/2012: aviso de tratamiento, enmascaramiento de documentos en superficies
  públicas, no-exposición de PII en logs (reutiliza `sanitizar-pii`).
- Ley 1712/2014: consulta pública accesible sin autenticación pero protegida.
- AGN 060/2001: consecutivo anual, código de oficina radicadora inmutable, planillas.
- MIPG: reportes generables y consistentes con los datos.
Un incumplimiento produce hallazgo con la norma aplicable (formato del informe, §5).

### 4.3 Auditor de seguridad (dueño: `seguridad` define; corre en CI)
- `@firebase/rules-unit-testing` contra emulador: matriz tenant × rol × colección
  (el test que hoy es imposible localmente por Java 8 — pieza más valiosa de esta capa).
- Sonda HTTP de perímetro: matriz ruta × (sin sesión / rol funcionario / rol admin) →
  401/403/200 esperados.
- Escáner de PII en respuestas públicas (patrones de cédula/correo sin enmascarar).
- `npm audit` (ya en CI) + escaneo de secretos en el repo (el hallazgo de
  `PASSWORD_TEST` hardcodeada lo habría detectado).

### 4.4 Auditor de rendimiento (dueño: `devops`)
- Lighthouse CI sobre las 4 páginas públicas (presupuestos: LCP, accesibilidad ≥ 95).
- Presupuestos de latencia de API (p95) medidos contra stage.
- Contador de lecturas Firestore por operación (instrumentable en emulador) →
  estimación de costo mensual proyectado; alerta si una pantalla supera umbral de lecturas.
- Métricas SIMI: latencia y tasa de éxito de Gemini (datos ya en `ai-governance`).

### 4.5 Auditor de IA (dueño: `ia-simi` define; `arquitecto-principal` revisa)
- **Invariante supremo**: ninguna salida de IA muta estado sin acción humana — verificado
  en E2E (la sugerencia aparece, el estado NO cambia hasta el clic) y por análisis estático
  (ningún servicio de IA importa mutadores).
- Dataset dorado de clasificación (casos reales anonimizados + sintéticos) con precisión
  mínima aceptable; regresión de prompts al cambiar `prompts-registry`.
- Trazabilidad: cada interacción SIMI deja registro auditable (prompt versionado,
  respuesta, decisión del funcionario).
- Consistencia: mismo caso, N corridas → misma dependencia sugerida (o abstención).

## 5. Informe ejecutivo automático (requisito 8)

Orquestador `scripts/laboratorio/auditar.ts`: ejecuta los cinco auditores, agrega
resultados JSON y genera `docs/auditorias/AAAA-MM-DD-laboratorio.md` con el formato
institucional ya usado en la auditoría manual: resumen ejecutivo, hallazgos por criticidad
(Crítica/Alta/Media/Baja) con evidencia y norma aplicable cuando corresponda,
recomendaciones priorizadas, estado general y **nivel de preparación para producción**
(semáforo: verde = desplegable, amber = desplegable con riesgos aceptados por el
propietario, rojo = bloqueado).

Integración con el flujo:
- **En cada PR:** suite unitaria completa (corrigiendo el hueco actual del CI) + rules-unit-testing + sonda de perímetro (rápidos, con emulador).
- **Pre-despliegue (manual o programado):** laboratorio completo contra STAGE → informe.
  El despliegue a PROD sigue requiriendo orden explícita del propietario; el informe es
  el insumo de esa decisión.

## 6. Hoja de ruta por fases

| Fase | Contenido | Criterio de salida | Esfuerzo |
|---|---|---|---|
| **0 · Correcciones previas** | Fix `FIREBASE_SERVICE_ACCOUNT` local (H1); CI ejecuta los 822 tests; retirar password hardcodeada de `uat-1.ts`; gatear/retirar `E2ETestPanel` (H4); correcciones H5/H6 | CI en verde con tests; sin secretos en repo | Días |
| **1 · Entornos** | Proyecto `ventanilla-simacota-stage`; emulador en Docker (`docker-compose.lab.yml`); emulador en CI; guarda anti-PROD en scripts | Emulador corre local y en CI; stage recibe deploy de reglas | 1 sprint |
| **2 · Alcaldía Sintética + auditor funcional** | Seed determinista vía servicios de dominio; Playwright con flujo dorado de 16 etapas + variantes | El ciclo completo corre solo y en verde contra stage | 1–2 sprints |
| **3 · Seguridad + normativa** | rules-unit-testing (matriz tenant/rol); sonda de perímetro; matriz normativa v1 (1755 + AGN + 1581 primero) | Matrices en CI; hallazgos con norma citada | 1–2 sprints |
| **4 · Rendimiento + IA** | Lighthouse CI; presupuestos de latencia; contador de lecturas; dataset dorado SIMI | Presupuestos activos con umbrales acordados | 1 sprint |
| **5 · Orquestador e informe** | `auditar.ts` + informe institucional automático + integración a decisión de despliegue | Primer informe automático generado de punta a punta | 1 sprint |

Cada fase es valiosa por sí sola y desplegable de forma independiente; si el proyecto
necesita pausar el laboratorio tras la fase 2 o 3, lo construido ya rinde (mejora continua
sin big-bang). Las fases 4–5 se confirman con evidencia de uso de las anteriores
(Regla Suprema: si un auditor no aporta hallazgos ni confianza, se replantea por ADR).

## 7. Gobernanza del laboratorio

- El laboratorio es propiedad del sistema operativo de ingeniería: `qa` lo opera,
  `devops` lo mantiene, `seguridad`/`gobierno-digital`/`ia-simi` son dueños de sus
  matrices, `arquitecto-principal` arbitra, `documentacion` mantiene este documento y
  los informes.
- Los hallazgos del laboratorio alimentan retrospectivas y ADRs; un hallazgo Crítico
  bloquea despliegue hasta decisión expresa del propietario.
- Los datos sintéticos jamás contienen información de personas reales; los scripts del
  laboratorio se niegan a ejecutar contra el proyecto de producción.

## 7b. Indicadores de cierre de Fase 2 (fijados por el propietario, 2026-07-10)

Definidos ANTES de conocer los resultados, con su línea base, para que la medición
no nazca contaminada (Principio 13):

| Indicador | Cómo se mide | Línea base (inicio de Fase 2) |
|---|---|---|
| **Valor por subagente** | Entregables aceptados por rol + hallazgos propios documentados en `FASE2_BITACORA.md` + retrabajos causados | 0 tareas delegadas ejecutadas (Fases 0–1 fueron del coordinador) |
| **Hallazgos de revisión cruzada** | Defectos detectados por el rol revisor que el productor no vio, con evidencia archivo:línea | Sin datos — primera medición real |
| **% del flujo institucional automatizado** | Etapas del ciclo (16 de la auditoría) cubiertas por escenarios Playwright que corren solos vs. a mano | 0 % automatizado (14/16 etapas validadas, pero manualmente) |
| **Cercanía al "municipio en minutos"** | Pasos del aprovisionamiento de un municipio nuevo: automatizados vs. manuales, con tiempo estimado de los manuales | Automatizado por API: proyecto, APIs, Firestore+región, reglas, service account, usuarios semilla. Manual aún: habilitar Auth en consola (~3 clics), Vercel/hosting, SMTP, clave Gemini, dominio, datos institucionales propios (dependencias/TRD del municipio) |

El cierre de Fase 2 incluye estos cuatro indicadores con datos reales; si la
especialización no demuestra valor, se propone ajuste del modelo por ADR.

## 8. Riesgos de la propuesta (declarados)

1. **Mantenimiento E2E:** las suites de navegador se degradan si crecen sin control.
   Mitigación: presupuesto duro de escenarios (< 15) y dueño único (`qa`).
2. **Deriva stage/prod:** stage pierde valor si su configuración diverge. Mitigación:
   reglas e índices se despliegan a stage desde el mismo artefacto que a prod.
3. **Costo de CI:** emulador + Playwright alargan el pipeline. Mitigación: por PR solo
   lo rápido; el laboratorio completo es pre-despliegue, no por commit.
4. **Supuesto declarado (Principio 13):** los tiempos de fase son estimaciones sin
   medición previa; se recalibran al cerrar la fase 1 con datos reales.
