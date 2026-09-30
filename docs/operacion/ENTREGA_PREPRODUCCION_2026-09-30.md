# Entrega de preproducción — 30-sep-2026

**Estado: validación local; NO desplegado ni aprobado para Production.**

## Entrega conservada

La incidencia #327 ya estaba corregida por `e39f34a` (#329). Se comprobó la
cadena formulario → endpoint → modelo → persistencia → guard de desistimiento;
no se reimplementó ni se atribuye a esta entrega.

Cambios nuevos, revisados cruzadamente y guardados en la rama de trabajo:

| Commit | Cambio |
|---|---|
| `66678a4` | Extraer los cinco exports auxiliares de Route Handlers a módulos reutilizables. |
| `1fb0600` | Sesión canónica, contratos HTTP, autorización de recursos SIMI/IA y persistencia atómica de firma/feedback. |
| `c2735d6` | Ajuste administrativo de consecutivo con auditoría append-only atómica, rechazo de contador inválido y consulta en Bogotá. |

No se ejecutaron ajustes de contador ni se emitieron números reales.

## Reconciliación de Git

Comprobación remota y `git fetch` de solo lectura respecto al código:

- PR #358 se integró el 21-sep-2026, con head `91e9ae7` y squash `83cddc3`.
- `origin/main` continúa en `83cddc3`; la rama remota de documentación está en
  `d32e961`. Los once commits posteriores al head integrado no entraron en #358.
- Se preparó una rama **local** `release/hardening-prod-2026-09-30`, desde
  `origin/main`, con esos once commits y los tres nuevos. No se cambió ni
  reescribió la rama compartida, no hubo push ni se abrió/modificó ningún PR.
- Snapshot de código integrado: `c1a2c06dab432bf387c9b69de9cf4826c2956e9e`.
  El árbol coincide exactamente con `c2735d6`:
  `f41cc2395c623359f9ffcc2c4d5948133fbebdce`.

Se necesita un PR nuevo, no seguir atribuyendo cambios al #358 cerrado.

## Compuertas locales

Entorno medido: macOS x64, Node 22.23.2. No equivale a Linux/Node 24.

| Comando / comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS; 0 errores, 24 warnings preexistentes fuera de esta entrega |
| `npm test -- --maxWorkers=2` | **PASS: 316 archivos, 3.827 pruebas, 0 fallos; 717,72 s** |
| `npx next build --webpack` | PASS; TypeScript y generación completa de páginas |
| `npm run presupuesto:rendimiento` | PASS; deuda preexistente explícita, no desapareció |
| `npm run verificar:indices` | PASS sin violaciones nuevas; conserva deuda declarada de índices SIMI |
| `npm run audit:gate` | **FAIL**, advisories high sin excepción vigente |
| Linux/Node 24 + Preview Stage del SHA final | PENDIENTE |
| E2E autenticado de la entrega final | PENDIENTE; no se probó con ciudadanos ni contra Production |

La primera corrida completa tuvo dos timeouts y cuatro fallos de arranque de
workers; registró una duración de pared de 47.256 s, sin causa de aplicación demostrada. Los seis
archivos afectados pasaron al repetirse: 41/41. No se cambiaron ni relajaron
timeouts para ocultarlos. La nueva corrida completa del snapshot final pasó
sin errores no controlados. El build oficial de Vercel/CI sigue siendo una comprobación distinta al
build local Webpack; no se tocaron sus flags ni se ignoraron errores de tipos.

## Bloqueo de dependencias

Consulta del 30-sep: el gate detecta diez entradas high, correspondientes a
seis advisories sobre tres paquetes. No se cambió el lockfile, no se ejecutó
`npm audit fix` y no se añadieron excepciones.

| Paquete | Lockfile e instalado | Parche mínimo confirmado | Alcance |
|---|---|---|---|
| brace-expansion | 1.1.18 / 2.1.4 / 5.0.9 | 1.1.20 / 2.1.6 / 5.0.11 | Compatible con rangos transitivos actuales |
| undici | 8.10.0 | 8.10.2 | Transitiva de jsdom (desarrollo), rango compatible |
| nodemailer | 9.1.1; declarado `^9.0.5` | 10.0.6 | **Major 9→10**, requiere decisión explícita antes de ampliar la entrega |

Fuentes de los mantenedores:
[brace-expansion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7),
[Nodemailer](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-v53p-9fqp-m79j),
[release Nodemailer 10](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0),
[Undici WebSocket](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5),
[Undici TLS](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3),
[Undici caché](https://github.com/nodejs/undici/security/advisories/GHSA-vp8m-p9jh-q5pm).

Nodemailer participa en el envío SMTP real. No se ha demostrado que el vector
de la advisory sea inalcanzable; no procede aprobar una excepción por intuición.
La propuesta es actualizar con autorización, probar sin enviar correos,
repetir compuertas y revisar el diff de dependencias antes de publicar.

## Empaquetado y despliegue seguro

No ejecutar `vercel --prod` desde el directorio de trabajo. La CLI instalada
lee `.vercelignore`/`.nowignore` y sus exclusiones propias, no `.gitignore`.
No existe `.vercelignore` en esta entrega; `.claude` contiene 63 archivos
históricos versionados, además del trabajo local ajeno. Un worktree limpio
por sí solo tampoco excluye esos archivos históricos.

El futuro paquete debe generarse desde el SHA aprobado, con exclusiones
explícitas de `.claude/**`, `.env*`, `.git/**`, metadatos locales de Vercel y
artefactos locales. Verificar su manifiesto antes de cualquier upload.
No borrar ni reescribir `.claude` para conseguirlo. No se generó un paquete
que contenga secretos ni se llamó a Vercel en esta entrega.

## Límites que siguen abiertos

- Preview de esta rama: falta comprobar variables Stage, protección y SHA
  servido; no reutilizar credenciales de Production ni un bypass.
- Copilot conserva el lector SDK cliente del servidor: el guard está cerrado,
  pero no se presenta el flujo funcional completo como validado.
- Los índices SIMI preexistentes deben comprobarse en el ambiente de ensayo:
  un error ahora responde 500 en vez de generar historiales falsamente vacíos.
- Los emisores compartidos aún tienen cálculos de año/mes del host; la
  corrección de esta entrega cubre la consulta y ajuste administrativo.
- Cron SIMI produce avisos con tenant `TODOS` que el filtro histórico de la
  bandeja no muestra. La UI de marcado leído tampoco verifica `response.ok`.
- La firma ahora comprueba pertenencia y confirma atómicamente. Quedan fuera
  de este parche el contraste del correo destinatario con el ciudadano y
  la igualdad del texto final con el borrador aprobado; no se afirma que el
  workflow completo de firma/envío haya quedado certificado.

El checklist mantenido por el usuario, reglas, índices, CI, `.nvmrc`, secretos,
dominios, Firebase, Sentry, Production y PR #360 no se modificaron. Los cambios
ajenos de `.claude` quedaron intactos y fuera de los commits nuevos.
