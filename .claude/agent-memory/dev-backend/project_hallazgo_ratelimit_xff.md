---
name: project-hallazgo-ratelimit-xff
description: getClientIp en /api/radicacion confía en el primer x-forwarded-for enviado por el cliente — posible bypass del rate limit público
metadata:
  type: project
---

`app/api/radicacion/route.ts:76-79` (`getClientIp`) toma
`request.headers.get('x-forwarded-for')?.split(',')[0]` — el PRIMER valor de
la cadena, que es exactamente el valor que un cliente externo puede falsificar
libremente (a menos que exista un proxy confiable delante que lo sobrescriba o
lo anteponga de forma que el primer valor sea siempre el suyo). El rate limit
público de radicación es de 8 solicitudes/minuto por IP
(`RATE_LIMIT` en el mismo archivo).

**Cómo se descubrió:** durante la revisión cruzada de
`scripts/laboratorio/alcaldia-sintetica.ts` (ver
[[project_laboratorio_alcaldia_sintetica]]), el script de laboratorio evade
deliberadamente ese rate limit enviando un `x-forwarded-for` sintético único
por solicitud (`10.77.0.N`) contra `localhost:3000` — lo cual es legítimo en
ese entorno de laboratorio controlado, pero puso en evidencia que la MISMA
técnica funcionaría contra el endpoint público si no hay un proxy confiable
que sanee ese encabezado antes de que llegue a Next.js.

**No confirmé si Vercel (u otro proxy delante en producción) ya sanea o
sobrescribe este encabezado de forma que el primer valor sea siempre
confiable** — eso requiere que seguridad/devops verifique la configuración de
despliegue real. Si no hay tal garantía, el fix es no confiar en el primer
hop de `x-forwarded-for` sin validarlo contra una lista de proxies conocidos,
o usar el encabezado específico de la plataforma de despliegue.

Reportado como hallazgo colateral en
`docs/laboratorio/FASE2_BITACORA.md` (sección "Revisión cruzada del seed").
No lo corregí — está fuera del objeto de esa revisión y requiere decisión de
seguridad/devops sobre la topología de proxies reales.
