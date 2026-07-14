# ADR-0022 — Cambio de fase: de análisis a construcción por capacidades sobre una Arquitectura Funcional Objetivo

- **Fecha:** 2026-07-14
- **Estado:** aceptado (2026-07-14, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Rol asumido:** Arquitecto Principal de Producto y Plataforma Institucional.
- **Relación:** opera sobre todo el marco (ADR-0001, 0014–0021); no lo sustituye.

## Contexto

Hay evidencia funcional, normativa y técnica suficiente para dejar de ampliar el
análisis y empezar a construir la siguiente generación. El propietario define un
cambio de enfoque: **no desarrollar funcionalidades sueltas ni recorrer el backlog
de arriba abajo, sino construir primero la arquitectura funcional objetivo y
evolucionar por capacidades institucionales**, reutilizando al máximo lo existente
y sin crear módulos paralelos.

## Decisión

1. **El Plan Maestro pasa de inventario a hoja de ruta**: se reorganiza por
   **capacidades**, no por orden de descubrimiento.
2. **Se adopta una Arquitectura Funcional Objetivo (TFA)** en
   `docs/ARQUITECTURA_FUNCIONAL_OBJETIVO.md`: dominios funcionales, relaciones,
   capacidades principales/secundarias, dependencias y orden natural de evolución,
   partiendo de un **inventario con evidencia** de lo ya construido.
3. **Regla de no-duplicación de módulos:** cada capacidad declara qué **reutiliza,
   reemplaza, simplifica e incorpora como innovación**; se evoluciona sobre los
   módulos existentes en vez de crear paralelos.
4. **Definición previa obligatoria por capacidad** (antes de una línea de código):
   objetivo, alcance, actores, procesos, reglas de negocio, modelo de datos,
   integraciones, riesgos, dependencias, reutilización, automatización SIMI y
   criterios de éxito.
5. **Roadmap por capacidades:** cada fase entrega **valor funcional completo** (una
   capacidad utilizable), no funcionalidades aisladas.
6. **Autorización:** nada queda autorizado por este ADR. La secuencia es *validar
   la TFA → elegir capacidad → completar su ficha → superar las Cuatro Preguntas
   (ADR-0021) → autorización expresa → desarrollo.* El Bloque 2 sigue congelado.

## Consecuencias

- **Positivas:** construcción coherente por capacidades; máxima reutilización de lo
  existente (radicación, salidas, respuesta, firma-SIMI, planillas, trazabilidad,
  IA); se evita el módulo paralelo y el feature suelto; cada fase es entregable y
  medible.
- **Costo:** definir cada capacidad exige diseño previo; se mitiga porque el
  inventario ya mapeó la base reutilizable y la TFA fija el orden.
- **Riesgo controlado:** la TFA es diseño **pendiente de validación**; puede
  ajustarse con evidencia antes de iniciar cualquier capacidad (ADR-0020 §4).

## Verificación de cumplimiento

La TFA está completa cuando: (a) inventaría con evidencia lo existente, (b) define
los dominios y sus relaciones, (c) reorganiza el backlog por capacidad, (d) entrega
un roadmap por capacidades con valor completo por fase, y (e) cada capacidad puede
declarar reutiliza/reemplaza/simplifica/innova. Ninguna capacidad inicia sin ficha
completa y sin superar las Cuatro Preguntas.
