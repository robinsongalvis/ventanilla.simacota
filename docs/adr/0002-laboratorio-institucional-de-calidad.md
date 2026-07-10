# ADR-0002 — Laboratorio Institucional de Calidad y congelamiento de arquitectura

- **Fecha:** 2026-07-09
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario del proyecto)
- **Roles consultados:** sesión principal (auditoría E2E e inventario), con insumos de la
  auditoría funcional del 2026-07-09

## Contexto

La auditoría funcional E2E del 2026-07-09 demostró con evidencia que: (a) el entorno
local no puede ejecutar operaciones de servidor (H1, service account mal configurado);
(b) no existe separación de entornos, por lo que cualquier prueba de escritura consume
consecutivos oficiales de radicación en producción (H2); (c) el CI no ejecuta la suite
de 822 tests; (d) los scripts UAT históricos corren contra producción con credenciales
de prueba hardcodeadas en el repositorio. La calidad unitaria es fuerte, pero no hay
forma segura de validar el ciclo completo del trámite antes de desplegar.

## Alternativas evaluadas

1. **Corregir solo los hallazgos puntuales** — barato, pero deja intacta la causa raíz
   (sin entornos ni datos de prueba, cada auditoría futura vuelve a bloquearse).
2. **Tres proyectos Firebase (dev/stage/prod)** — separación máxima, pero el proyecto
   dev real duplica administración sin aportar sobre lo que da el emulador (YAGNI).
3. **Laboratorio con 2 proyectos + emuladores** *(elegida)* — DEV sobre Firebase
   Emulator Suite en Docker (esquiva la restricción de Java 8 local, gratis y
   desechable), STAGE como proyecto real nuevo, PROD intocable para scripts de prueba.

## Decisión

Se aprueba la arquitectura del Laboratorio Institucional de Calidad descrita en
`docs/laboratorio/ARQUITECTURA_LABORATORIO_CALIDAD.md` (entornos DEV-emulador /
STAGE / PROD; Alcaldía Sintética generada vía servicios de dominio; cinco auditores
automáticos — funcional, normativo, seguridad, rendimiento, IA — con dueño por rol;
informe ejecutivo automático; hoja de ruta de 6 fases).

**Congelamiento de arquitectura:** desde esta fecha y hasta finalizar la Fase 2 y
validar el laboratorio con evidencia real, no se incorporan nuevos módulos
estratégicos, subsistemas ni iniciativas de gran alcance. Las mejoras detectadas se
registran como propuestas para evaluación posterior, sin alterar la arquitectura
vigente salvo riesgo crítico o necesidad demostrada con evidencia. La prioridad es
ejecutar, medir y aprender.

## Razones

- La causa raíz (imposibilidad de probar el ciclo de escritura sin tocar datos
  institucionales) solo se elimina con entornos separados y datos sintéticos.
- El emulador en Docker convierte la restricción local de Java 8 en un no-problema.
- El congelamiento protege la fase de ejecución: el proyecto ya tiene definición
  suficiente (SOI + laboratorio); el riesgo dominante ahora es diseñar en vez de
  entregar.

## Consecuencias

- **Positivas:** validación pre-despliegue del ciclo completo sin riesgo institucional;
  las Firestore Rules se prueban de verdad por primera vez; hallazgos normativos con
  norma citada; el informe ejecutivo se vuelve rutina y no esfuerzo heroico.
- **Negativas / deuda aceptada:** costo de mantenimiento del laboratorio (mitigado con
  presupuesto duro de < 15 escenarios E2E); pipeline de CI más largo (mitigado:
  laboratorio completo solo pre-despliegue); estimaciones de fase sin medición previa
  (supuesto declarado, se recalibra al cerrar Fase 1).
- **Impacto:** `qa` opera el laboratorio; `devops` lo mantiene; `seguridad`,
  `gobierno-digital` e `ia-simi` son dueños de sus matrices; los informes van a
  `docs/auditorias/`.
