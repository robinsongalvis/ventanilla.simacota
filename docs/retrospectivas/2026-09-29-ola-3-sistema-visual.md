# Retrospectiva técnica — Ola 3 del sistema visual interno

- **Fecha:** 2026-09-29
- **Alcance:** contexto de permisos compartido, primitivas visuales, migración
  de vistas, armazón único de Licencias y guardianes automatizados de Ola 3.
- **Evidencia base:** ADR-0043 a ADR-0046,
  `docs/MATRIZ_MIGRACION_OLA3.md` y pruebas `ola3-*`,
  `design-system-primitivas-render`, `tema-interno-tokens` y
  `licencias-armazon-unico`.
- **Límite:** esta retrospectiva cierra la implementación técnica; la
  aceptación con una sesión real de cada rol en Stage sigue pendiente.

## Qué salió bien

1. El inventario previo permitió conservar acciones, filtros, contadores y
   permisos mientras se reemplazaba la presentación.
2. Las primitivas quedaron independientes del dominio: no conocen radicados,
   roles ni filtros MIPG.
3. La revisión cruzada encontró y corrigió una redirección abierta antes de
   versionar el cierre.
4. Los guardianes automatizados cubren contexto por rol, contraste, tema,
   rutas canónicas y armazón de Licencias.

## Qué podemos hacer mejor

1. Mantener el estado de ADR y matrices sincronizado con el código. La
   implementación terminó antes que la actualización documental y produjo
   afirmaciones contradictorias.
2. Congelar el reloj en pruebas cuyos datos se construyen respecto de una
   fecha fija; depender del día de ejecución convirtió un conteo estable en
   un falso fallo.
3. Evitar que una migración transversal quede mezclada dentro de un commit de
   corrección puntual. Los cambios estructurales requieren commits cuyo
   mensaje y alcance permitan auditarlos.

## Deuda técnica aparecida

- Ola 4: retirar código muerto y reevaluar primitivas sustituidas.
- Validación visual autenticada en Stage por rol y dependencia.
- Revisar los límites visuales H10, H11 y H13 documentados en la matriz.

## Qué podemos automatizar

- Una comprobación documental que detecte estados incompatibles como
  “pendiente” y “cerrado” para una misma ola.
- Un escenario de navegador autenticado por rol en Stage que capture los
  tamaños de referencia sin usar credenciales en artefactos.
- Un límite de workers estable para la suite jsdom en CI, medido antes de
  cambiar la configuración global.

## Qué aprendimos

- Separar el contexto de permisos de las primitivas permite evolucionar la
  interfaz sin convertirla en barrera de seguridad.
- Mantener rutas legacy como redirecciones verificadas protege enlaces
  existentes sin conservar dos armazones.
- El cierre técnico y la aceptación operativa son evidencias distintas; una
  no sustituye a la otra.

## ¿Alguna regla estorbó sin aportar?

No. La revisión arquitectónica, la evidencia automatizada y la revisión
cruzada descubrieron riesgos concretos. La documentación exigida sí aportó al
detectar que el estado declarado no coincidía con la implementación.

## Patrón reutilizable

**Inventario → contrato → migración:** medir primero las superficies y
acciones, fijar el comportamiento con pruebas y solo después sustituir la
presentación. Este patrón permite modernizar otros módulos sin perder reglas
de negocio ni permisos.
