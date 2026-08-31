---
name: feedback-preview-worktree-distinto
description: El panel de vista previa (Browser pane / preview_start) puede apuntar a OTRO worktree distinto al del sub-agente — verificar cwd del proceso antes de depurar rutas/login
metadata:
  type: feedback
---

Durante el rediseño de los modales de Licencias (PR #303, 31-ago-2026), pasé
tiempo depurando un 404 de una página nueva (`app/dev-preview-licencias/
page.tsx`) creyendo que era un problema de Turbopack (caché de rutas,
convención de archivos en esta versión de Next.js) o del `proxy.ts` (el
`middleware.ts` renombrado en esta versión). Ninguna de las dos hipótesis
era la causa.

**La causa real:** `mcp__Claude_Browser__preview_start` levantó el servidor
`next dev` en el worktree **del coordinador**
(`.claude/worktrees/<otro-id>/`), no en el mío. Lo confirmé con
`ps aux | grep "next dev"` + `lsof -p <pid> | grep cwd`: el proceso corría
desde un directorio que no era `Working directory` de mi sesión. El servidor
nunca iba a reflejar mis cambios — no era un problema de caché, de rutas, ni
de login.

**Por qué importa:** en tareas donde trabajo en un worktree aislado
(`agent-<id>`, separado del worktree principal de la sesión), el panel de
vista previa del entorno puede estar atado a un worktree distinto sin
avisarlo. Perseguir el síntoma (404, ruta no encontrada) sin verificar antes
el `cwd` real del proceso del servidor cuesta tiempo.

**Cómo aplicar:** antes de invertir tiempo depurando por qué una página
nueva no aparece en el Browser pane (404, ruta vieja, estilos que no
cargan), correr `ps aux | grep "next dev\|next-server"` y `lsof -p <pid> |
grep cwd` para confirmar que el servidor corre DESDE mi worktree. Si no
coincide, no hay arreglo posible por ese camino — pasar directo al respaldo
ya contemplado por el encargo (capturar el árbol DOM renderizado con
`@testing-library/react` + `prettyDOM`, en un test temporal que se borra
antes de comitear) y declararlo honestamente en la entrega, en vez de seguir
intentando levantar el preview.
