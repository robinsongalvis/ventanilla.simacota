---
name: project-cors-stage-storage-adjuntos
description: Hallazgo bloqueante — bucket de Storage de STAGE sin CORS, bloquea toda radicación con adjunto en ese entorno
metadata:
  type: project
---

El bucket `ventanilla-simacota-stage.firebasestorage.app` no tiene CORS
configurado para aceptar subidas desde un origen web (probado desde
`http://localhost:3000`, el mismo origen de `npm run dev:stage`). La subida
vía `lib/storage.ts` (`subirArchivo`, cliente Firebase directo) nunca
resuelve ni rechaza — el botón "Radicando…" queda colgado para siempre.
Reproducido 100% de las veces (`e2e/04-radicacion-adjunto.spec.ts`, marcado
`test.fixme` con la reproducción completa en el propio archivo).

**Por qué:** `subirArchivos` (lib/actions/radicarVentanilla.ts ~L199-204)
corre ANTES del `setDoc` del radicado (~L332) — así que este bug bloquea el
100% de las radicaciones con adjunto en STAGE, no solo el test. Efecto
colateral confirmado: como el consecutivo institucional se incrementa en
una transacción ANTES de la subida (`lib/radicado-institucional.ts:33-40`),
cada intento fallido deja un hueco real en la numeración AGN 060/2001.

**Rol que corrige:** `devops` — falta un `cors.json` aplicado con
`gsutil cors set` (o equivalente) al bucket de stage; no existe ninguno en
el repo hoy. Verificar si producción tiene el mismo problema (bucket
distinto, no confirmado).

**Cómo reproducir manualmente:** login como recepcionista.lab, "Radicación
Rápida", adjuntar cualquier PDF, enviar. Consola del navegador muestra
`blocked by CORS policy: Response to preflight request doesn't pass access
control check`.
