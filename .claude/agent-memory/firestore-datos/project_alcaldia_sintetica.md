---
name: alcaldia-sintetica
description: Generador de datos sintéticos de stage (Fase 2 lab) — cómo funciona, decisiones clave y trampas del entorno
metadata:
  type: project
---

`scripts/laboratorio/alcaldia-sintetica.ts` (correr con `npx tsx`, servidor `npm run dev:stage` arriba) siembra 30 radicados coherentes en `ventanilla-simacota-stage` por el camino real (POST /api/radicacion + sesiones lab + asignar/prorroga/resolver). `--limpiar` está **namespaced por `laboratorio.generador`**: borra SOLO docs de `alcaldia-sintetica` (no las fixtures `playwright-e2e` de QA ni el protegido `1-110-2026-00000001`), resetea el counter (transacción) y resiembra. La verificación interna se acota al namespace propio; consecutivos de terceros intercalados = nota informativa, no error.

**Why:** ADR-0002 Fase 2 — el stage necesita un municipio funcional reproducible sin datos reales.

**How to apply:** hechos que ahorran re-descubrimiento:
- La radicación vigente vive EN los route handlers, no en lib (`lib/radicacion.ts` y `lib/acciones/resolver-radicado.ts` están DEPRECATED) → generar datos = llamar APIs, no importar servicios.
- POR_VENCER/VENCIDO son estados DERIVADOS en lectura (`lib/reportes-mipg/estado-termino.ts`), no se persisten; solo PRORROGA/RESUELTO/ASIGNADO se escriben.
- Retrodatación coherente = mover `control.fechaRadicado` y recalcular con `calcularFechaVencimiento` de `lib/tiempos-radicado.ts` (misma función de producción); resolver DESPUÉS para que el endpoint calcule `cumplioTermino`.
- Rate limit público (8/min/IP) se evita con `x-forwarded-for` único por request contra el dev server.
- Stage no tiene EMAIL_HOST → todo intento SMTP falla al instante y levanta `alertaNotificacionFallida`; usar el placeholder `sin-correo@simacota.gov.co` (bloqueado por `debeNotificarCiudadano`) para no contaminar alertas.
- `npx tsx` (v4.23 cacheado) funciona offline y hay precedente de scripts .ts importando lib/.
- QA (auditor funcional `playwright-e2e`) comparte el proyecto stage y radica en paralelo → el counter de stage NUNCA se puede asumir limpio ni contiguo. Por eso todo (limpieza, verificación, doble-siembra) va namespaced por `laboratorio.generador`. Patrón reutilizable: cualquier generador nuevo del laboratorio debe marcar `laboratorio.generador` y acotar sus operaciones por él (decisión de arquitecto 2026-07-10, activo multi-auditor).
