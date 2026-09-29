# ADR-0044 — Paleta institucional nueva y jerarquía del Tablero (radicados primero)

- **Estado:** ACEPTADO — alcance decidido por el propietario el 22-sep-2026.
- **Relacionado:** ADR-0030 (contraste AA de textos), ADR-0032 (sistema de
  diseño), ADR-0043 (tema claro/oscuro por tokens).

## 1. Decisiones del propietario

1. **Paleta nueva en toda la interfaz web** (no solo en el Tablero).
2. **Chips de filtro rápido solo para filtros existentes.**
3. **Header solo con funciones existentes.** No se crean búsqueda global,
   notificaciones ni menú de usuario.

## 2. Paleta

| Rol | Antes | Ahora |
|---|---|---|
| Verde institucional | `#14532D` | `#007049` |
| Menú lateral | `#14532D` | `#03402A` |
| Verde profundo | `#0F3D20` | `#03402A` |
| Éxito (iconos, bordes, puntos) | `#16A34A` | `#008F5A` |
| Éxito como **texto** (`--color-success-text`) | `#117937` | `#007A4D` |
| Verde hover / texto verde oscuro | `#166534` | `#006B45` |
| Dorado | `#D4A017` | `#E5A31A` |
| Rojo | `#DC2626` | `#D81E1E` |
| Texto principal / títulos | `#1F2933` / `#12261A` | `#172033` |
| Texto secundario | `#667085` | `#64748B` |
| Bordes | `#D9E2D9` | `#DCE4EA` |
| Fondo general | `#F8FAF7` | `#F7F9FB` |
| Superficie tintada | `#EEF4EE` | `#F4F9F6` |
| Morado (nuevo: «Sin responsable») | — | `#7C3AED` |
| Azul («Sin analizar SIMI») | — | `#2563EB` |

**Ajustes por contraste (ADR-0030), medidos:**
- `#008F5A` da 4,14:1 sobre blanco. Como texto se usa `#007A4D` (5,40:1);
  `#008F5A` queda para lo que no es texto.
- El verde `#007049` sobre dorado da 2,81:1. Sobre dorado, el texto va en
  `#03402A` (5,41:1).
- `#64748B` sobre la superficie tintada: 4,47:1, igual que el par anterior
  (4,46:1). No hay regresión; la deuda previa del gris secundario sigue
  anotada en ADR-0032.

**Alcance:** `app/**` (UI) y `app/globals.css`.
**Quedan fuera a propósito:** `app/api/**` y `lib/**` (sello PDF, constancias,
plantillas de correo) y los componentes que imprimen documentos oficiales
(`SelloRadicado`, `ConstanciaRadicacion`, `SelloRecibido`,
`ComprobanteRadicado`, `SelloDespacho`). Un documento oficial ya emitido no
cambia de aspecto por un rediseño de la interfaz. Si también deben migrarse,
es una decisión aparte.

Los tokens de migración de ADR-0043 (`--tema-<rol>-<hex>`) se renombraron
junto con su hex, así que siguen cumpliendo que el valor claro sea igual al
nombre.

## 3. Jerarquía del Tablero

Orden: header → Semáforo PQRSD (una fila compacta) → barra de trabajo
(búsqueda, Filtros, dependencia, Nuevo radicado) → chips de filtro rápido →
«Filtrando por» → alerta (solo si existe) → **tabla (panel principal, alto
restante, scroll interno, encabezado fijo)** → Resumen de trámites y
Seguimiento de gestión (colapsables, debajo de la tabla).

- **Chips:** Todos, Vencidos, Por vencer, Sin asignar, Radicados, Asignados,
  más los interruptores existentes (Datos incompletos, Solo los míos). El
  contador y el handler de cada chip vienen de `construirIndicadoresTablero`,
  la misma fuente que las tarjetas, así que el número del chip siempre
  coincide con las filas que muestra.
- **Sin chip:** «Jurídica» y «Sin analizar SIMI» no tienen filtro, y el
  «Sin responsable» del Semáforo (activos sin responsable) cuenta distinto al
  filtro «Sin asignar» (PENDIENTE sin responsable). Siguen como métricas del
  Semáforo. Crear esos filtros es funcionalidad nueva y queda fuera de este
  ADR.
- **Header:** la lupa abre la búsqueda avanzada existente y la campana el
  Resumen del día existente; se muestra la fecha. El usuario sigue en el menú
  lateral.
- **Paneles colapsables:** cerrados muestran igual los valores en una línea;
  abiertos, exactamente las tarjetas de antes. «Minimizar paneles» se conserva.
- Las aclaraciones de las tarjetas pasan a `title` y `aria-label`, y las
  explicaciones largas a un icono ⓘ con texto para lector de pantalla.

## 4. Guardianes

- `__tests__/tablero-responsive.test.ts`: chips solo de filtros existentes y
  con la misma fuente; paneles colapsables con los mismos indicadores y
  handlers; aclaraciones conservadas.
- `__tests__/tema-interno-tokens.test.ts`: contraste AA en oscuro, incluidas
  las parejas nuevas morado y azul.

## 5. Enmienda (23-sep-2026, ADR-0046 §6)

El propietario adopta como referencia oficial una imagen del Tablero con una
fila de tarjetas de resumen. La jerarquía de §3 queda así:

header → Semáforo PQRSD (si aplica) → barra de trabajo → chips de filtro
rápido → «Filtrando por» → **tarjetas de resumen (solo lectura, mismas
cifras que los chips)** → alerta (solo si existe) → tabla → Resumen de
trámites y Seguimiento de gestión (colapsables).

Las tarjetas no filtran: los chips siguen siendo el único filtro rápido.
«Minimizar paneles» y el detalle abierto las ocultan.

## 6. Ajuste de contraste del texto secundario (24-sep-2026, cierre de la Ola 3)

El token semántico `--text-secondary` pasa de `#64748B` a `#5B6B80`: el mismo
gris, un paso más oscuro. `#64748B` quedaba en 4,47:1 sobre la superficie
tintada `#F4F9F6` y entre 4,34 y 4,39:1 sobre los tintes del Semáforo.
`#5B6B80` da 5,44:1 sobre blanco y ≥4,96:1 en esos tintes (medido por la
revisión UX/UI).

- El valor oscuro no cambia.
- El token con nombre de hex (`--tema-texto-64748b`) conserva su valor.
- Los documentos oficiales (`.isla-clara`) conservan `#64748B`.
- El Tablero y Licencias usan el token semántico para su texto secundario.
