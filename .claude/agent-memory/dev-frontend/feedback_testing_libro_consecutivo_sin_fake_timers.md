---
name: feedback-testing-libro-consecutivo-sin-fake-timers
description: vi.useFakeTimers() + waitFor() de Testing Library se cuelgan (timeout de 5s) cuando un componente depende de new Date() para un valor por defecto
metadata:
  type: feedback
---

Nunca combinar `vi.useFakeTimers()`/`vi.setSystemTime()` con `waitFor` de `@testing-library/react` en este proyecto sin advertir el riesgo: `waitFor` hace polling con `setInterval`/`setTimeout` internos — con timers falsos activos, ese polling se congela y el test agota el timeout REAL de 5000ms sin que el DOM actualizado se detecte, aunque el estado sí haya cambiado. Pasó en `__tests__/libro-consecutivo-render.test.tsx` y `vista-licencias-render.test.tsx` (Bloque C, 8-ago-2026): 9 tests colgados hasta quitar `vi.useFakeTimers()`.

**Por qué:** el componente probado (`LibroConsecutivoClient`) usa `new Date().getFullYear()` como año por defecto — la tentación es fijar el reloj del sistema para que el test sea determinista.

**Cómo aplicar en su lugar:** si un componente deriva un valor por defecto de `new Date()` y ese valor solo importa para filtrar/mostrar datos ya presentes en el DOM (un `<select>`, por ejemplo), NO fijar el reloj — leer el valor real del control (`select.value`) después de que cargue, y construir la aserción esperada a partir de ESE valor (`` `Sin expedientes en ${select.value}` ``) en vez de un año hardcodeado. Si el test necesita datos de un año específico del fixture (no el actual), seleccionar ese año explícitamente vía `fireEvent.change` — los años derivados de los datos (`añosDisponiblesLibro`) siempre están disponibles como `<option>` sin importar el reloj real de la máquina que corre la suite.

Ver [[project_bloque_c_libro_consecutivo]] para el contexto del componente.
