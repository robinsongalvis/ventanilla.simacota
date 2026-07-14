# Blueprint Arquitectónico — <Cn · Nombre de la capacidad>

**Estado:** BORRADOR | EN REVISIÓN | LISTO (Definition of Ready) — *nunca*
"autorizado" por sí mismo. **No autoriza implementación** (ADR-0023). Rige la
gobernanza vigente (ADR-0001, 0014–0023).

- **Capacidad / dominio:** Cn (Dn) — ver ficha en
  [`PLAN_MAESTRO_EVOLUCION.md`](../PLAN_MAESTRO_EVOLUCION.md).
- **Iniciativas BM-\*:** …
- **Versión / revisión:** v0 — fecha — motivo.

> Cómo usar: copiar este archivo a `CN-<capacidad>.md`, completar **todas** las
> secciones. Una sección sin resolver mantiene el estado en BORRADOR/EN REVISIÓN.
> El §24 (análisis crítico) puede **devolver** el Blueprint a revisión.

---

## A. Arquitectura funcional y de dominio

### 1. Arquitectura funcional detallada
*Qué hace la capacidad, funcionalmente, extremo a extremo.*

### 2. Arquitectura lógica
*Capas/módulos lógicos y su relación (server/cliente, servicios, catálogos).*

### 3. Límites del dominio (bounded context)
*Qué entra y qué NO entra; fronteras con otros dominios (D1…D10).*

### 4. Entidades y agregados
*Agregados, raíces de agregado, entidades y objetos de valor; invariantes por
agregado.*

### 5. Eventos de negocio
*Eventos de dominio que emite/consume (p. ej. RadicadoClasificado,
ComunicaciónFirmada); quién reacciona.*

### 6. Reglas de negocio
*Reglas explícitas e invariantes de producto/normativas (numeración, inmutabilidad,
términos, aislamiento por tenant).*

### 7. Flujos principales y alternos
*Camino feliz + alternos/errores (contingencia, rechazo, reintento).*

## B. Contratos e interfaces

### 8. Actores
*Humanos y de sistema (incluye SIMI como copiloto).*

### 9. Permisos
*Roles y autorizaciones por acción; aislamiento por `tenantId`.*

### 10. APIs
*Endpoints (existentes que se reutilizan / nuevos si son estrictamente
necesarios); contrato de entrada/salida; idempotencia.*

### 11. Integraciones
*Internas (otros dominios) y externas (email/WhatsApp, futuro GOV.CO/SGDEA).*

### 12. Modelo de datos
*Colecciones/campos; qué evoluciona sobre lo existente; índices; foto inmutable
cuando aplique. **Sin colección nueva salvo justificación.***

## C. Reutilización vs. construcción

### 13. Reutilización de componentes existentes
*Módulos/servicios/colecciones concretos que se reutilizan (ruta en el repo).*

### 14. Componentes nuevos (solo si son estrictamente necesarios)
*Cada componente nuevo se justifica: por qué no basta lo existente. Si no hay
justificación, no se crea.*

## D. Impactos transversales

### 15. Impacto sobre SIMI
*Qué asiste la IA (sugiere/precarga); qué decisión permanece humana (Principio 9).*

### 16. Impacto sobre seguridad
*Superficie, datos personales (Ley 1581), aislamiento, autorización.*

### 17. Impacto sobre auditoría
*Qué queda con huella (trazabilidad); evidencia para MIPG/control interno.*

### 18. Impacto sobre rendimiento
*Consultas/índices, carga, límites; puntos calientes.*

### 19. Impacto sobre mantenibilidad
*Claridad, testabilidad, acoplamiento; efecto en la deuda técnica.*

## E. Ejecución

### 20. Riesgos
*Técnicos, funcionales, normativos; probabilidad/impacto y mitigación.*

### 21. Estrategia de migración
*Datos existentes, compatibilidad, reversibilidad; foto inmutable / no reescribir
histórico.*

### 22. Estrategia de pruebas
*Unitarias, integración (emulador), regresión, E2E; controles de regresión
probados por mutación cuando aplique (ADR-0015).*

### 23. Estrategia de despliegue
*Feature flags, rollout, rollback, observabilidad; reglas Firestore por deploy.*

## F. Análisis crítico obligatorio (ADR-0023 §3)

Responder con evidencia. Si alguna respuesta demuestra que se puede simplificar o
consolidar más, el Blueprint **vuelve automáticamente a EN REVISIÓN** (§24).

1. **¿Qué estamos simplificando?**
2. **¿Qué estamos eliminando?**
3. **¿Qué estamos consolidando?**
4. **¿Qué estamos reutilizando?**
5. **¿Qué estamos evitando construir?**
6. **¿Existe una alternativa aún más simple?**
7. **¿Qué ocurrirá dentro de 5 años si esta decisión permanece?**

### 24. Veredicto del análisis crítico
- [ ] Sin oportunidad de mayor simplificación/consolidación → puede pasar a LISTO.
- [ ] Existe una vía más simple/consolidada → **vuelve a EN REVISIÓN** (describir
  qué se ajustará).

## G. Definition of Ready (ADR-0023 §5) — no es autorización

- [ ] Blueprint completo (todas las secciones).
- [ ] Cuatro Preguntas superadas con evidencia (ADR-0021).
- [ ] Valor Neto favorable (ADR-0020).
- [ ] Análisis crítico superado sin disparar el bucle (o resuelto).

*Cumplir la Definition of Ready hace a la capacidad **candidata**. La
implementación requiere **autorización expresa** del propietario y respeta el
estado de congelamiento vigente (Bloque 2).*
