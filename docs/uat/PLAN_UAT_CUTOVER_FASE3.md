# Plan UAT del cutover — Fase 3 pieza angular (rama `uat/fase3-cutover-preview`)

> **Regla de esta rama:** el switch está ON **únicamente aquí** para generar el preview de UAT. **PROHIBIDO mergear a `main`.** Producción permanece OFF (verificable en cualquier momento: `main` tiene el flag en `false` lockeado por test). El cutover real será un PR de 2 líneas aparte, solo tras el Go del propietario sobre este dossier.

## 1. Entorno de pruebas

- **Preview UAT:** deployment de Vercel de esta rama (URL en el dossier al construirse). Switch ON → el formulario del dashboard interno radica por el **endpoint servidor** (`POST /api/radicacion/interna`).
- **Referencia de comparación:** producción actual (switch OFF, camino cliente legado).
- **Acceso:** protección SSO de Vercel — el propietario entra directo; para la funcionaria, enlace compartible (Share) generado por el propietario; para la batería automatizada de latencia, secret de *Protection Bypass for Automation* (gate G4 del ADR-0025 — pendiente de que el propietario lo genere) + sesión de un usuario de prueba con rol RECEPCIONISTA o ADMIN.

## 2. Matriz de casos UAT (cada uno con evidencia: captura + log + doc en Firestore)

| # | Caso | Qué se verifica | Evidencia requerida |
|---|---|---|---|
| U1 | Radicación identificada completa, 0 adjuntos | 200, radicado con formato legado `1-110-{AAAAMM}-{8díg}`, consecutivo = anterior+1 | captura de constancia + log de la invocación + doc leído de Firestore |
| U2 | Radicación con 2-3 adjuntos (PDF + imagen) | adjuntos en Storage en ruta final, magic-bytes aceptando tipos legítimos | captura + rutas de Storage verificadas |
| U3 | Adjunto con extensión mentirosa (ej. .exe renombrado .pdf) | rechazo controlado con mensaje en español, sin radicado creado, sin consecutivo consumido | captura del error + contador intacto |
| U4 | Presentación ANÓNIMA y RESERVADA | placeholders correctos, doc con `null` explícito según política | docs comparados contra golden |
| U5 | **Constancia vs documento** (hallazgo del arquitecto) | fecha/hora/vencimiento que MUESTRA la constancia == los del doc ALMACENADO (el servidor ahora es la fuente de verdad) | captura de constancia + doc lado a lado |
| U6 | Percepción del progreso (R8) | el avance en 2 hitos (50/90) es aceptable para la operación diaria | veredicto de la funcionaria/propietario |
| U7 | Doble clic en "Radicar" | un solo radicado, un solo consecutivo (anti-doble-submit) | contador + lista de radicados |
| U8 | Error de sesión/rol (si se puede simular con usuario FUNCIONARIO) | 403 con mensaje claro, sin efectos | captura |
| U9 | Serie tras N radicaciones de prueba | detector de consecutivos 0 huecos / 0 duplicados sobre el proyecto | salida del detector |

## 3. Medición de latencia (p50/p95/p99)

- **Batería automatizada** (requiere bypass + sesión de prueba): N≥100 invocaciones reales a `POST /api/radicacion/interna` del preview (mezcla 0/1/3 adjuntos), midiendo端 a extremo. Cold start capturado forzando ventanas de inactividad.
- **Si no hay bypass:** medición desde los logs de función de las radicaciones manuales del UAT (`durationMs` por invocación) — N menor; p99 se declara con muestra insuficiente en vez de inventarse.
- **Criterio:** p95 comparable al flujo cliente actual medido en la misma sesión (comparativa §4); sin timeouts; cold start < `maxDuration` con margen amplio.

## 4. Comparativa flujo cliente actual vs endpoint servidor

- **Funcional:** mismas entradas → constancia equivalente, mismo formato de radicado, misma serie de consecutivos, mismos campos en el doc (paridad ya demostrada por golden Fase 0/2; aquí se verifica la experiencia de usuario de punta a punta).
- **Divergencias CONOCIDAS y aceptadas (se validan, no se ocultan):** progreso 2 hitos vs 4; `fechaVencimiento` derivada en servidor (antes cliente) — cubierta por U5.
- **Método:** mismas radicaciones de prueba ejecutadas en producción (camino legado) y en el preview UAT (camino servidor), con capturas y docs lado a lado.

## 5. Plan de rollback (< 5 minutos, con ensayo)

- **Antes del cutover no hay nada que revertir** (producción OFF). Para el cutover real: rollback = `git revert` del PR de flip (2 líneas) + push → redeploy automático (~80-120 s de build según histórico). **Total medido objetivo: < 3 min.**
- **Ensayo en esta rama (evidencia obligatoria del dossier):** tras completar el UAT, se revierte el commit de flip EN LA RAMA UAT → el preview se reconstruye con switch OFF → se verifica que el formulario vuelve al camino legado → se cronometra el ciclo completo revert→preview-ready→verificación. Ese tiempo medido es la evidencia de §5.
- Contingencia extrema (si un revert no bastara): `vercel alias set` al deployment anterior sano (~5 s, mecánica verificada en el SEV-1).

## 6. Checklist Go/No-Go (un solo NO = no hay cutover)

| Criterio | Estado |
|---|---|
| U1-U9 todos en verde con evidencia | ⏳ |
| p50/p95 dentro de lo comparable al flujo actual; sin timeouts | ⏳ |
| Comparativa §4: comportamiento funcional idéntico para el usuario (divergencias conocidas aceptadas por el propietario) | ⏳ |
| Constancia == documento almacenado (U5) | ⏳ |
| Detector de consecutivos 0/0 tras el UAT | ⏳ |
| Ensayo de rollback cronometrado < 5 min | ⏳ |
| 3 revisiones cruzadas (Arquitectura, Seguridad, QA) del dossier SIN bloqueantes | ⏳ |
| Datos de prueba del UAT marcados/limpiados (isTest o borrado documentado) | ⏳ |
| **Go del propietario (PdC 3)** | ⏳ |

## Secuencia operativa

1. Preview UAT arriba (esta rama) → propietario genera bypass secret (G4) y/o enlace compartible.
2. Batería de latencia + casos U1-U9 (coordinador + propietario/funcionaria) → evidencia al dossier.
3. Ensayo de rollback cronometrado en la rama.
4. Revisiones cruzadas del dossier completo (Arquitectura, Seguridad, QA).
5. Dossier al propietario → decisión Go/No-Go → (si Go) PR de flip de 2 líneas → ventana de monitoreo → PdC 3 cerrado → Fase 4.
