# Planificación ejecutiva — antes de la Ola 2

- **Fecha:** 2026-07-11
- **Propósito:** responder las tres preguntas estratégicas del propietario antes de abrir la Ola 2, contra la referencia permanente: *la plataforma debe seguir siendo mantenible, auditable y escalable dentro de 5–10 años, adoptable por cualquier municipio colombiano.*
- **Base de evidencia:** Ola 1 cerrada (P-B/H2/R8/P-C), laboratorio operativo, ciclo de hallazgos probado (H1, R8), prueba de mutación de P-B (el control detecta regresiones), `docs/REGISTRO_RIESGOS.md`.

## 1. ¿Cuál es el mayor riesgo técnico que limita la evolución de la plataforma?

**La arquitectura de lectura/consulta no escala: hoy se carga la colección completa de radicados en cliente/servidor sin límite server-side, y todos los municipios comparten una sola colección.** (Riesgo R11, confirmado además en `app/api/radicados/busqueda-avanzada` y en el montaje del dashboard; evidenciado porque con 216 radicados de prueba en STAGE el dashboard ya se ralentizaba hasta desestabilizar los E2E.)

Por qué es el techo, y no un bug más:
- El costo y la latencia de cada vista crecen con el **volumen total de la plataforma**, no con el de un municipio. Un municipio real con miles de radicados —o diez municipios medianos sobre el mismo proyecto— degradan el rendimiento de todos.
- Es un **patrón**, no un punto: cada feature nueva construida sobre "leer todo y filtrar" hereda el techo. Limita la evolución porque encarece o vuelve inviable todo lo que venga encima.
- Choca de frente con la referencia de 5–10 años: una plataforma multi-municipio no puede tener un modelo de consulta cuyo peor caso sea "toda la base".

Mitigación ya existente: el aislamiento por `tenantId` está verificado por reglas (P-B/R8), así que el riesgo es de **rendimiento/escala**, no de fuga entre municipios.

## 2. ¿Cuál es la inversión con mayor retorno para los próximos doce meses?

**Completar la verificación automática continua (los auditores restantes del laboratorio + la compuerta de despliegue) y, sobre esa red, corregir la arquitectura de consulta.** Es la inversión de mayor retorno porque es un **multiplicador**: convierte la plataforma de "verificada una vez" en "que demuestra su confiabilidad en cada cambio", y hace barato y seguro todo lo demás.

Retorno medido con las 5 métricas del proyecto:
- **Menos trabajo manual:** el orquestador + informe automático reemplaza la auditoría manual (hoy heroica); el onboarding de municipio (P3) se automatiza.
- **Más evidencia automatizada:** auditores de rendimiento, normativo ejecutable, seguridad e IA corriendo en CI como los de la Ola 1.
- **Menor riesgo por despliegue:** compuerta de despliegue = ningún deploy sin informe verde (E2E + controles). La prueba de mutación de P-B demostró que estos controles tienen dientes.
- **Mayor escala:** paginar/segmentar la consulta (atacando R11) levanta el techo del riesgo #1.
- **Mayor trazabilidad:** cada hallazgo → control ejecutable + ADR (ciclo ya institucionalizado).

Secuencia de mayor a menor retorno inmediato: (a) **auditor de rendimiento + corrección de la consulta paginada** (ataca el riesgo #1 y lo blinda con un presupuesto de rendimiento en CI); (b) **rules-unit-testing extendido + normativo ejecutable** (convierte los hallazgos normativos abiertos R9/R10 en controles); (c) **orquestador + compuerta de despliegue**; (d) **gobernanza de IA transversal**.

## 3. ¿Qué capacidad desarrollaremos para adopción por otros municipios sin rediseñar la arquitectura?

**Onboarding automatizado de un municipio: aprovisionamiento reproducible + una capa de configuración institucional dirigida por datos (no por código).**

Qué ya está probado (~85% del aprovisionamiento es scriptable, evidencia de Fase 1–2): creación de proyecto, base y región, reglas, índices, service account, usuarios semilla, datos sintéticos coherentes, Storage/CORS — todo por script, con guardas anti-producción.

Qué falta para que un municipio nuevo entre **sin tocar código**:
- **Capa de configuración institucional por municipio como DATA:** dependencias, TRD, series documentales, términos legales y zonas geográficas deben ser configuración cargable por municipio, no constantes en el repo. Hoy el directorio (`DIRECTORIO_TENANTS`) ya es data; hay que llevar el resto de la configuración institucional al mismo modelo y un importador que la cargue.
- **Aprovisionamiento generalizado:** parametrizar los scripts de Fase 1–2 en un flujo único "crear municipio X" (entorno + config + usuarios), con su verificación automática (el laboratorio se convierte en la prueba de aceptación del onboarding).
- **Consulta que escale por tenant** (riesgo #1): sin esto, adoptar más municipios degrada a todos — es prerrequisito de la adopción, no un extra.

Esta es la capacidad más alineada con la visión: el laboratorio, el ciclo de hallazgos y el aprovisionamiento por API que ya construimos **son el germen** del onboarding multi-municipio; falta industrializarlos y quitar las últimas dependencias de configuración-en-código.

## Conexión con la Ola 2

Las tres respuestas convergen: **la Ola 2 debería ordenarse alrededor de la escalabilidad demostrable.** Propuesta de foco (a detallar en su plan de implementación, como en la Ola 1, antes de ejecutar):
1. Auditor de rendimiento + presupuestos en CI, y corrección de la consulta paginada (riesgo #1).
2. Normativo ejecutable: R9/R10 y demás hallazgos abiertos → controles.
3. Orquestador + compuerta de despliegue (evidencia verde obligatoria pre-deploy).
4. Primer paso del onboarding multi-municipio: llevar la configuración institucional a datos + verificación por laboratorio.

## Métricas contra las que se evaluará cada decisión (institucionalizadas 11 jul 2026)

Menos trabajo manual · más evidencia automatizada · menor riesgo por despliegue · mayor capacidad de escalar sin perder confiabilidad · mayor trazabilidad de decisiones. Referencia de arquitectura: mantenibilidad, auditabilidad y escalabilidad a 5–10 años.
