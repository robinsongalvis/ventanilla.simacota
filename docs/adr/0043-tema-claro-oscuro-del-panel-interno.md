# ADR-0043 — Tema claro / oscuro del panel interno, migración incremental por tokens

- **Estado:** ACEPTADO — alcance inicial extendido por ADR-0045 y ADR-0046.
- **Relacionado:** ADR-0030 (tokens de texto accesibles, AA), ADR-0032 (sistema
  de diseño interno).

## 1. Contexto

Se pidió un selector sol/luna en el dashboard de Admin: cambio instantáneo,
preferencia en `localStorage`, preferencia del sistema como valor inicial,
modo claro idéntico al actual y modo oscuro con la misma identidad (verde,
dorado, rojo, azul, gris, morado).

Medición previa (Principio 13): `app/globals.css` ya declaraba tokens, pero
el panel no los consumía. `app/interno/dashboard/` tenía **~2.100 colores
literales en 51 archivos** (595 solo en `page.tsx`), casi todos en
`style={{…}}`. Además un mismo color cumple papeles distintos: `#14532D` aparece
~295 veces como **texto** (ilegible sobre oscuro) y también como **fondo** de
botón con texto blanco (válido en oscuro). Un modo oscuro que funcione solo
cambiando variables no existía.

## 2. Decisión

1. **Tokens por rol con el valor claro en el nombre:** `--tema-<rol>-<hex>`,
   `<rol>` ∈ {`fondo`, `borde`, `texto`}. En `:root` cada token vale
   exactamente su hex → el modo claro es idéntico **por construcción**. El
   valor oscuro vive solo bajo `[data-tema="oscuro"]`.
2. **El tema se aplica por zona, no por documento:** solo las zonas migradas
   llevan `data-tema`. Hoy es la columna central del **Tablero**. Todo lo
   demás hereda el claro de `:root`, así que ninguna vista a medio migrar
   puede verse oscura.
3. **Los colores de estado fuertes no se tokenizan** (dorado `#D4A017`, ámbar
   `#FBBF24`/`#F59E0B` y rojo `#DC2626` usados como fondo o riel). Son la
   identidad y no cambian entre temas. El texto oscuro propio sobre esos
   chips también se conserva.
4. **Clases de paleta de Tailwind** (badges de estado, semáforo de término):
   se añade la variante `oscuro:` (`@custom-variant`) sin tocar la clase base.
5. **Transparencias concatenadas** (`${color}22`) pasan a
   `color-mix(in srgb, <color> 13.3%, transparent)`. Da el mismo resultado en
   claro y admite `var()`.
6. **Preferencia:** `lib/hooks/useTemaInterno.ts` usa `useSyncExternalStore`
   (sin destello claro→oscuro al montar). Orden: `localStorage` → respaldo en
   memoria → `prefers-color-scheme`. El menú lateral no cambia: ya es verde
   oscuro con texto claro.

## 3. Alcance de esta entrega

Migrados: barra superior móvil, cabecera del Tablero, Semáforo PQRSD, Resumen
de trámites, Seguimiento de gestión, barra de filtros, alerta de prioridad y
tabla/tarjetas de radicados (`page.tsx`, `PqrsdDeadlineDashboard`,
`BarraFiltrosActivos`, `PriorityBanner`, `SemaforoTermino`).

**Pendiente, en claro por ahora:** panel de detalle del radicado
(`PanelDerecho`, ~250 colores más sus componentes), el drawer de radicación,
los modales y el resto de vistas. Cada una se migra con el mismo método y se
incorpora a la zona con `data-tema` cuando esté completa. El botón solo se
muestra en el Tablero, donde tiene efecto.

## 4. Guardianes

`__tests__/tema-interno-tokens.test.ts`:
- el valor claro de cada token es igual al hex de su nombre;
- todo token usado tiene valor claro y oscuro;
- todo token de texto cumple AA (4,5:1) sobre las superficies oscuras, y
  el texto de cada estado sobre su fondo tintado;
- `data-tema` aparece una sola vez (en la zona del Tablero).

`__tests__/use-tema-interno.test.ts`: preferencia del sistema, preferencia
guardada, alternar y persistir, valor inválido.

## 5. Deuda aceptada

- Los nombres `--tema-<rol>-<hex>` son de **migración**, no semánticos.
  Cuando todo el panel esté migrado se consolidan (p. ej. los cinco grises de
  texto secundario en uno o dos tokens), con decisión visual explícita, porque
  consolidar sí cambia el modo claro.
- Los colores que el Tablero no usa como estilo (`rielColor`/`textoColor` de
  `construirTarjetasMIPG`) quedan en hex: los lee el test de contraste de
  ADR-0030/0032 y no se pintan en la zona migrada.

## 6. Enmienda de alcance (24-sep-2026)

ADR-0045 y ADR-0046 sustituyen el alcance incremental descrito en §§2–4. El
tema se fija actualmente una sola vez en `<html>` desde
`app/interno/layout.tsx`, cubre todo `/interno` y se retira al salir; el login
queda excluido. Ninguna vista fija su propio `data-tema`. Se conserva arriba
la decisión original como contexto histórico de la migración.
