# ADR-0030 — Variantes de TEXTO para los tokens semánticos de color (WCAG AA)

- **Fecha:** 2026-08-12
- **Estado:** propuesto — decisión de ejecución tomada por el propietario (ver §Decisión del propietario); la implementación es trabajo separado y aún no ejecutado
- **Responsable:** arquitecto-principal (diseño de la solución). La decisión de producto —documentar sin bloquear el PR #189— es del **propietario del proyecto (12-ago-2026)**
- **Roles consultados:** ux (jerarquía visual e identidad institucional), frontend (alcance de migración), calidad (prueba de regresión), normativo (NTC 5854 / Gobierno Digital)
- **Nivel de triaje:** 2 — cambio dentro del sistema de diseño: añade tokens al `:root` de `app/globals.css` y sustituye valores en sitios de uso. No crea módulo ni colección, no cambia flujo ni modelo de datos. La migración es amplia (82 sitios) pero mecánica y sin efecto sobre la lógica.

## Reserva de numeración

El último ADR es **0029**. El número **0027** quedó **vacante** por la renumeración descrita en ADR-0028 §Reserva de numeración (el ADR de separación de entornos nunca se escribió con ese número). **No se reutiliza**: un número de ADR es un identificador permanente y reciclar un hueco reintroduce exactamente la colisión que ADR-0028 evitó. Este ADR toma el **0030**.

## Contexto

### El hallazgo

Medición sobre la aplicación real en **stage, 12-ago-2026**, contraste de los tokens semánticos usados como **color de TEXTO** sobre `--bg-surface` (#FFFFFF):

| Token | Valor | Uso medido | Contraste | WCAG AA (4.5:1) |
|---|---|---|---|---|
| `--color-danger` | `#DC2626` | "Vencido hace N días" | 4.83:1 | cumple (por 0.33) |
| `--color-warning` | `#F59E0B` | "Quedan 2 días hábiles" | **2.15:1** | **NO cumple** |
| `--color-success` | `#16A34A` | "16 días hábiles" | **3.30:1** | **NO cumple** |
| `--color-border` | `#D9E2D9` | fecha de expediente resuelto | **1.33:1** | **NO cumplía — YA CORREGIDO** |

El caso grave es el **ámbar**: es precisamente la alerta de "quedan pocos días hábiles" del **Libro Consecutivo** y de la **Bandeja** — el aviso que la funcionaria **más** necesita leer, y el peor contraste de todo el sistema de diseño (2.15:1, menos de la mitad del mínimo). Un aviso de vencimiento ilegible no es un defecto estético: es un aviso que no cumple su única función.

### El hallazgo se agrava sobre las superficies reales

La medición sobre blanco es el **mejor caso**. La aplicación pinta texto sobre tres superficies institucionales, y ninguna de las dos restantes es blanca:

| Token | sobre `--bg-surface` #FFFFFF | sobre `--bg-base` #F8FAF7 | sobre `--bg-surface-2` #EEF4EE |
|---|---|---|---|
| `--color-danger` #DC2626 | 4.83 ✅ | 4.60 ✅ | **4.33 ❌** |
| `--color-warning` #F59E0B | **2.15 ❌** | **2.05 ❌** | **1.92 ❌** |
| `--color-success` #16A34A | **3.30 ❌** | **3.14 ❌** | **2.95 ❌** |

`--color-danger` **también incumple** cuando cae sobre fila atenuada (#EEF4EE, 4.33:1) y sobre el propio fondo de las cajas de error con que se le empareja (#FEF2F2, 4.41:1). Es decir: el rojo no está "salvado", está **al borde**, y cualquier fondo que no sea blanco puro lo tumba. Esto no se ve midiendo solo contra blanco.

### El código ya inventó la solución tres veces, mal

Búsqueda en `app/`, `lib/` y `src/` (excluyendo `app/globals.css`): `#F59E0B` **no aparece nunca** como literal. Pero sí aparecen **tres ámbares oscuros ad hoc**, usados como color de texto para esquivar el problema sin nombrarlo:

| Literal | Sitios como texto | Contraste s/ blanco | ¿AA? |
|---|---|---|---|
| `#D97706` | 10 | 3.19:1 | **no** |
| `#B45309` | 9 | 5.02:1 | sí (4.50 sobre #EEF4EE — al filo) |
| `#92400E` | 16 | 7.09:1 | sí |

Tres tonos distintos para el mismo significado, uno de ellos igualmente inaccesible. Esto es exactamente la duplicación de lógica que prohíbe el **Principio 3**, y confirma que el vacío del token no es teórico: los desarrolladores ya chocaron con él y lo parchearon localmente.

### El precedente ya aplicado (PR #189, esta semana)

En `app/interno/licencias/presentacion-libro-consecutivo.ts` se introdujo `COLOR_TEXTO_URGENCIA_LIBRO`, derivado de `COLOR_URGENCIA_LIBRO` y redefiniendo **solo** el color de texto de la banda `NEUTRO`:

```ts
export const COLOR_TEXTO_URGENCIA_LIBRO: Record<UrgenciaFilaLibro, string> = {
  ...COLOR_URGENCIA_LIBRO,
  NEUTRO: 'var(--text-secondary)',   // --color-border rinde 1.33:1 como texto
};
```

Ese cambio ya estableció la idea correcta —**el color de la franja y el color del texto son cosas distintas**— pero la resolvió **para un caso y en un archivo**. Las bandas `POR_VENCER` y `EN_TERMINO` siguen heredando el token de franja como color de texto y siguen incumpliendo. Este ADR **generaliza el precedente al sistema de diseño** en lugar de dejar que se replique caso por caso.

### Por qué no es cosmético

La accesibilidad web es **exigible** a las entidades públicas colombianas: **NTC 5854** (accesibilidad de páginas web, que adopta los criterios WCAG 2.0/2.1 nivel AA) por vía de la **Resolución 1519 de 2020 del MinTIC** (anexo 1, directrices de accesibilidad) y la política de **Gobierno Digital** (Decreto 1078/2015, Título 9, actualizado por el Decreto 767/2022). El criterio incumplido es **WCAG 1.4.3 Contraste (mínimo), nivel AA**. Una ventanilla única municipal que aspira a ser referente nacional (Principio 10) no puede fallar el criterio de accesibilidad más elemental precisamente en su alerta de vencimiento de términos.

**Hallazgo secundario, con matiz:** la franja lateral de 4 px rinde 2.15:1 (ámbar) y 3.30:1 (verde) contra el blanco. **WCAG 1.4.11 (Contraste no textual, AA)** exige 3:1 a los objetos gráficos *necesarios para entender el contenido*. Como la franja **duplica** información que el texto ya dice ("Quedan 2 días hábiles"), es defendible como decorativa y 1.4.11 no la alcanza. Se documenta el dato, **no se decide aquí** y no condiciona la migración: cambiar el color de la franja tocaría la identidad visual del tablero, que es materia de UX, no de accesibilidad estricta.

## Alternativas evaluadas

1. **Oscurecer los tokens semánticos en sitio** (`--color-warning: #8E5C06`, etc.). Ventaja: cero migración, un solo cambio. **Rechazada:** los mismos tokens se usan como **fondo** de chips y como **franja**, donde el ámbar brillante es correcto y necesario. Oscurecerlos convertiría los chips ámbar en marrones y destruiría la identidad institucional del tablero. Un token no puede servir a dos funciones con requisitos opuestos (fondo saturado vs. texto oscuro): esa es justamente la confusión que el PR #189 empezó a deshacer.

2. **Resolver caso por caso, como en el PR #189.** Ventaja: mínimo alcance por PR. **Rechazada:** ya se ensayó y produjo tres ámbares ad hoc (`#D97706`, `#B45309`, `#92400E`) de los cuales uno **sigue incumpliendo**. Sin token, cada desarrollador vuelve a elegir un tono a ojo. Viola el Principio 3 y garantiza la reincidencia.

3. **Usar texto oscuro sobre chip de color en todos los casos** (patrón ya presente en `PanelDetalleExpediente.tsx:189`: fondo `--color-warning` + texto `#4A2E02`, 5.81:1). Ventaja: accesible y de identidad fuerte. **Rechazada como regla general:** convierte cada dato en una etiqueta. La columna "Vence" del Libro es una tabla densa; llenarla de chips destruye la lectura en barrido y compite visualmente con el estado del expediente. Se conserva como patrón **válido y vigente** donde ya se usa, pero no sustituye al token de texto.

4. **Marcar la alerta solo con icono/negrita, sin color.** **Rechazada:** no resuelve el criterio (el texto seguiría teniendo su propio contraste que evaluar) y pierde el barrido cromático que la funcionaria usa para priorizar.

5. **No hacer nada.** **Rechazada:** el incumplimiento es normativo y exigible, está medido, y afecta al aviso operativamente más importante del módulo. La deuda no decae sola: cada pantalla nueva la multiplica.

## Decisión

Se introducen **variantes de TEXTO** de los tres tokens semánticos en `app/globals.css`, hermanas de los tokens existentes y con la misma familia cromática, calculadas para cumplir **≥4.5:1 sobre las tres superficies institucionales** (no solo sobre blanco). Los tokens actuales **no cambian de valor** y conservan su función de fondo, franja y borde.

```css
/* Estados semánticos — FONDO / franja / borde (sin cambios) */
--color-success:  #16A34A;
--color-warning:  #F59E0B;
--color-danger:   #DC2626;

/* Estados semánticos — TEXTO (WCAG 1.4.3 AA sobre las 3 superficies) */
--color-success-text: #117937;
--color-warning-text: #8E5C06;
--color-danger-text:  #B91C1C;
```

### Regla de derivación (por qué esos valores y no otros)

Cada variante conserva **exactamente el mismo tono (H) y la misma saturación (S)** que su token base y solo baja la luminosidad (L), hasta el valor más claro que mantiene ≥4.5:1 sobre la superficie institucional **más oscura** (`--bg-surface-2` #EEF4EE) con un margen ≥8 %. Conservar H y S es lo que garantiza que **el ámbar siga leyéndose como el mismo ámbar y el verde como el mismo verde**: no es otro color, es el mismo color con menos luz.

| Token nuevo | Valor | HSL | HSL del token base | s/ #FFFFFF | s/ #F8FAF7 | s/ #EEF4EE |
|---|---|---|---|---|---|---|
| `--color-warning-text` | `#8E5C06` | hsl(**38**, **92**%, 29%) | `#F59E0B` = hsl(38, 92%, 50%) | **5.70:1** | **5.43:1** | **5.11:1** |
| `--color-success-text` | `#117937` | hsl(**142**, **76**%, 27%) | `#16A34A` = hsl(142, 76%, 36%) | **5.51:1** | **5.25:1** | **4.93:1** |
| `--color-danger-text` | `#B91C1C` | hsl(0, 74%, 42%) | `#DC2626` = hsl(0, 72%, 51%) | **6.47:1** | **6.16:1** | **5.80:1** |

Todos los valores están **medidos**, no estimados: fórmula de luminancia relativa WCAG 2.1 (sRGB linealizado, coeficientes 0.2126/0.7152/0.0722, `(L1+0.05)/(L2+0.05)`).

**Frontera documentada** (para que nadie "aclare un poquito" el token sin darse cuenta de que lo rompe):

- Ámbar hsl(38, 92%, **31%**) = `#986206` → 4.60:1 sobre #EEF4EE. **Es el último valor que pasa.** A partir de L 32 % el token incumple.
- Verde hsl(142, 76%, **29%**) = `#12823B` → 4.39:1 sobre #EEF4EE. **Ya incumple.**
- `#B45309` (amber-700, uno de los parches ad hoc actuales) → 4.50:1 sobre #EEF4EE: pasa por 0.00. **No se adopta**: no deja margen para ninguna variación de fondo.

### Regla de uso (queda como norma del sistema de diseño)

> **`--color-*` pinta superficies (fondo, franja, borde). `--color-*-text` pinta texto e iconos con significado.** Nunca al revés.
>
> Excepción vigente y válida: **texto oscuro sobre chip de color saturado** (fondo `--color-warning` + texto `#4A2E02`, 5.81:1), patrón ya usado en `PanelDetalleExpediente.tsx`. Ese texto oscuro **no** es `--color-warning-text` y no se sustituye por él.

`COLOR_TEXTO_URGENCIA_LIBRO` deja de ser una excepción local y pasa a ser la **aplicación en el Libro** de esta regla general: sus tres bandas de color pasan a apuntar a las variantes de texto, y `NEUTRO` conserva `--text-secondary` (4.97:1) tal como quedó en el PR #189.

## Decisión del propietario (12-ago-2026)

> **Documentar la solución en un ADR, pero NO bloquear el PR #189. La corrección se ejecuta como trabajo separado.**

Razones registradas:

- El PR #189 **ya mejora** el estado del sistema: corrige el peor contraste medido (`--color-border` como texto, 1.33:1) y establece el precedente conceptual. Retenerlo hasta que esté hecha una migración de 82 sitios sería castigar una mejora por no ser la mejora total —el antipatrón que ADR-0014 (ritmo vs. calidad) obliga a evitar.
- El alcance real (82 sitios, 28 archivos, dos módulos: licencias y dashboard) **no cabe** en un PR cuyo tema es la legibilidad del Libro Consecutivo. Mezclarlos haría irrevisable el PR #189 y diluiría su evidencia.
- La deuda queda **nombrada, medida y con solución especificada** en este ADR, no en la cabeza de nadie. Ese es el mecanismo que el proyecto acepta para diferir sin perder (Principio 2 y estándar de evidencia, ADR-0015).

**Consecuencia formal:** al mergearse el PR #189, la aplicación **sigue incumpliendo WCAG 1.4.3 AA** en los avisos ámbar y verde. Es deuda **aceptada a sabiendas y con fecha**, no un descuido. Este ADR es su constancia.

## Alcance de la migración (medido)

Inventario sobre `app/`, `lib/` y `src/`, excluyendo la definición en `app/globals.css`. Se cuentan solo usos en **rol de texto** (`color:`, `texto:`, `text:`), no fondos ni bordes:

| Origen del color | Sitios | ¿Incumple AA hoy? |
|---|---|---|
| `#DC2626` literal | 37 | sobre blanco no (4.83); sobre #EEF4EE / #FEF2F2 **sí** |
| `#92400E` literal (ámbar ad hoc) | 16 | no (7.09) — se unifica igualmente |
| `#D97706` literal (ámbar ad hoc) | 10 | **sí** (3.19) |
| `#B45309` literal (ámbar ad hoc) | 9 | al filo (4.50 sobre #EEF4EE) |
| `#16A34A` literal | 8 | **sí** (3.30) |
| `var(--color-success)` | 2 | **sí** (3.30) |
| **Total** | **82 sitios en 28 archivos** | **20 incumplen sobre blanco**; más los `#DC2626` sobre fondo no blanco |

Además, los tres consumidores de token del módulo de licencias:

- `app/interno/licencias/presentacion-libro-consecutivo.ts` — mapa `COLOR_TEXTO_URGENCIA_LIBRO` (bandas `VENCIDO`, `POR_VENCER`, `EN_TERMINO`).
- `app/interno/licencias/components/TarjetaKpiLibro.tsx:29` — `--color-danger` / `--color-warning` como color del número del KPI.
- `app/interno/licencias/components/PanelHechosCaso.tsx:158, 269` — `--color-success` como color de texto.

Concentración: `app/interno/dashboard/page.tsx` reúne 11 sitios; el resto se reparte en 27 archivos con 1–4 cada uno. La migración es **mecánica** (sustitución de valor, sin cambio de lógica) y **divisible por módulo**: licencias (5 sitios, cierra el hallazgo original) y dashboard (77 sitios, unifica además los tres ámbares ad hoc).

## Consecuencias

- **Positivas.**
  - El aviso de vencimiento —la información operativamente más crítica del Libro y la Bandeja— pasa a ser legible: 2.15:1 → 5.70:1. La funcionaria deja de tener que adivinar el aviso que más necesita.
  - Se cierra un incumplimiento **normativo exigible** (NTC 5854 / Res. 1519 de 2020 / Gobierno Digital), no una preferencia estética.
  - Los tres ámbares ad hoc se colapsan en **un** token, eliminando duplicación real (Principio 3) y con ella la reincidencia: el siguiente desarrollador ya no elige tono a ojo.
  - La identidad institucional se conserva por construcción: mismo H y S, solo menos luminosidad.
  - El precedente del PR #189 queda **generalizado** en el sistema de diseño en lugar de repetido caso por caso.
- **Negativas / deuda aceptada.**
  - Entre el merge del PR #189 y la ejecución de la migración, la aplicación **sigue incumpliendo AA** en ámbar y verde. Deuda declarada arriba, con dueño y solución especificada. **Revisión: al cierre del bloque de licencias en curso.**
  - 82 sitios a tocar: PR amplio aunque mecánico. Se mitiga partiéndolo por módulo.
  - Tres tokens nuevos en `:root` amplían la superficie del sistema de diseño. Coste asumido: es la única forma de que un token no cargue dos requisitos contradictorios.
  - Este ADR **no** decide sobre el contraste de la franja de 4 px (1.4.11): queda como dato registrado y materia de UX.
- **Impacto en otros módulos.**
  - **Licencias**: `presentacion-libro-consecutivo.ts` y sus tres componentes; el test `__tests__/presentacion-libro-consecutivo.test.ts` (que ya asevera la forma `var(--…)` de estos valores) deberá actualizar sus expectativas.
  - **Dashboard**: 77 sitios, incluidos KPIs MIPG, alertas y paneles SIMI.
  - **Portal público** (superficie oscura, `--bg-portal` #0A0A0B): **fuera del alcance de este ADR**. Sus colores no se han medido y las variantes aquí definidas están calculadas para fondo claro; sobre negro serían aún peores que los tokens actuales. Requiere medición propia antes de tocar nada.
  - Sin impacto en modelo de datos, reglas de Firestore, cómputo de términos ni lógica de negocio.

## Referencias

`app/globals.css` (definición de tokens) · `app/interno/licencias/presentacion-libro-consecutivo.ts` (precedente `COLOR_TEXTO_URGENCIA_LIBRO`, PR #189) · `__tests__/presentacion-libro-consecutivo.test.ts` · WCAG 2.1 criterios 1.4.3 (AA) y 1.4.11 (AA) · NTC 5854 · Resolución MinTIC 1519 de 2020, anexo 1 · Decreto 1078/2015 Título 9 (Gobierno Digital), act. Decreto 767/2022 · ADR-0014 (ritmo vs. calidad) · ADR-0015 (estándar de evidencia) · ADR-0028 (reserva de numeración).
