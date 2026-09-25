# Dictamen — Anclaje del día civil a la hora legal colombiana (deuda #15 ADR-0026)

**Fecha:** 2026-08-07 · **Rol:** gobierno-digital · **Objeto:** validación legal del fix de `atLocalNoon` (`lib/tiempos-radicado.ts`) exigida por ADR-0026 §A2 (deuda #15 / RS-1)

**Concepto: CUMPLE (el fix), con acción transicional requerida sobre radicados en trámite.**

## 1. Fondo — es defecto, el fix es la corrección

- Hora legal de Colombia: UTC−5 (Decreto 2707 de 1982); custodio vigente: **INM** (Decreto Ley 4175/2011, art. 6 num. 14, mod. Decreto 062/2021) — la SIC lo fue solo hasta 2011.
- Los plazos "correrán hasta la medianoche del último día" (Código Civil, art. 67) — medianoche de la **hora legal colombiana**. Un escrito recibido a las 20:00 Bogotá del día X pertenece jurídicamente al día X; interpretarlo como X+1 (lectura UTC del servidor) contradice la norma de cómputo.
- Términos en juego: Ley 4ª/1913 art. 62 (días = hábiles salvo expresión en contrario), Ley 1755/2015 arts. 14/17/31, D.1077/2015 art. 2.2.6.1.2.3.1 (45 días licencias).
- La semántica jurídicamente exigida siempre fue "día civil colombiano"; el código la producía solo por accidente del entorno. **Defecto de implementación; el fix restituye conformidad — no hay "cambio de criterio" que documentar como tal.**

## 2. Efecto transicional (el sesgo del defecto es unidireccional: solo pudo correr el día hacia ADELANTE, +1)

| Clase | Veredicto |
|---|---|
| (a) Plazos del **ciudadano** ya comunicados (límite de subsanación) | Se honran como se comunicaron; **prohibido acortar** (C.P. art. 83, CPACA art. 3 num. 4) |
| (b) Plazos de **respuesta de la entidad** en radicados **en trámite** | **Barrido one-off exigido**: recalcular `fechaVencimiento` o alertar al funcionario — un vencimiento +1 día induce respuesta extemporánea confiando en el semáforo (Ley 1755 art. 31) y distorsiona el silencio administrativo (CPACA art. 83). Responder antes de la fecha comunicada no lesiona a nadie |
| (c) Radicados **cerrados** | No tocar lo almacenado (Ley 594/2000 art. 19); basta esta constancia |

Supuesto declarado a verificar: que `fechaRadicado` y las constancias emitidas usan el instante real (timestamp), no un día civil derivado de `atLocalNoon`; si alguna constancia quedó mal fechada, corrección con constancia escrita (espíritu Acuerdo AGN 060/2001, art. 5).

## 3. Constancias

- Este documento ES la validación que la deuda #15 del ADR-0026 exige; al cerrar la deuda, referenciarlo junto al test del anclaje.
- `docs/REGISTRO_RIESGOS.md`: RS-1 pasa a mitigado con residual transicional (vencimientos históricos almacenados) hasta ejecutar el barrido (b).
- NO se requiere: acto administrativo, notificación a ciudadanos, ni recálculo de cerrados.

## Cambios requeridos (riesgo descendente)

1. **ALTO:** barrido one-off de radicados en trámite radicados/requeridos después de ~19:00 hora Bogotá → recalcular vencimiento de respuesta de la entidad (o alertar). Nunca acortar fechas ya comunicadas al ciudadano. **Escribe en prod → requiere autorización del propietario con protocolo autorización→ejecución.**
2. **MEDIO:** cerrar deuda #15 en ADR-0026 §A2 referenciando este dictamen + test.
3. **MEDIO:** actualizar RS-1 en `docs/REGISTRO_RIESGOS.md`.
4. **BAJO:** verificar en código que `fechaRadicado`/constancias usan timestamp real.

**Fuentes:** Decreto 2707/1982; D.L. 4175/2011 art. 6.14 (mod. D. 062/2021, verificado en inm.gov.co); Código Civil art. 67; Ley 4ª/1913 art. 62; Ley 1755/2015 arts. 14, 17, 31; CPACA arts. 3.4 y 83; D.1077/2015 art. 2.2.6.1.2.3.1; Ley 594/2000 art. 19; Acuerdo AGN 060/2001 art. 5.
