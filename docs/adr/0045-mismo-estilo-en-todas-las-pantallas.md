# ADR-0045 — Mismo estilo para todos los roles y todas las pantallas

- **Estado:** ACEPTADO — pedido del propietario el 23-sep-2026 («manejemos el
  mismo estilo en todos los usuarios en todas las pantallas»).
- **Extiende:** ADR-0043 (tema por tokens, antes limitado al Tablero) y
  ADR-0044 (paleta y jerarquía del Tablero).

## 1. Qué se unifica y cómo

El programa se divide en tres fases, en este orden:

1. **Armazón común (hecho).** Un único `EncabezadoPantalla` de escritorio
   para todas las vistas del panel: antetítulo, título de la vista, fecha,
   lupa (búsqueda avanzada existente), campana (Resumen del día existente) y
   tema. La barra móvil y el encabezado toman el título de la misma función,
   `etiquetaDeVista`. `SectionHeader` pasa a ser un subencabezado sin franja
   propia, y su subtítulo usa `--text-secondary`: el gris muted no llegaba
   a AA.
2. **Tema claro/oscuro en todas las pantallas (hecho).**
   - Todos los colores de `app/interno/**` y `app/components/design-system/**`
     pasaron a tokens `--tema-<rol>-<hex>` con el mismo método de ADR-0043.
     El modo claro es idéntico por construcción.
   - Los valores oscuros nuevos se generan por regla: mismo tono, y el texto
     con ≥4,6:1 sobre la superficie oscura más clara. Los tokens que ya tenían
     un valor elegido a mano no se tocan.
   - Las clases de paleta de Tailwind reciben una variante `oscuro:`; la clase
     base no cambia.
   - Los tokens globales anteriores (`--text-primary`, `--bg-surface`,
     `--color-border`…) reciben valor oscuro, así que toda pantalla que los
     usa se adapta sola. `--color-primary` no cambia (es fondo de botón); como
     texto se usa `--tema-texto-007049`.
   - El atributo `data-tema` va en `<html>` desde `app/interno/layout.tsx`.
     Cubre Dashboard, Licencias, Recepción, modales y portales. Se retira al
     salir de `/interno` y no aplica al login.
   - Selector de tema: `BotonTema` (sistema de diseño) en el encabezado común,
     la barra móvil y el menú lateral compartido. El armazón propio de
     Licencias fue retirado por ADR-0046 §7.
3. **Contenido de cada vista (implementación técnica cerrada el 24-sep).** Cada pantalla aplica la
   jerarquía de ADR-0044: tarjetas grandes → chips, filas compactas o paneles
   colapsables. El detalle y sus pruebas están en ADR-0046 §7 y en
   `docs/MATRIZ_MIGRACION_OLA3.md` §7. La aceptación con sesión autenticada
   en Stage sigue pendiente y no se confunde con el cierre técnico.

## 2. Excepciones deliberadas

- **Documentos oficiales** (`SelloRadicado`, `SelloRecibido`,
  `ComprobanteRadicado`, `SelloDespacho`) llevan la clase `isla-clara`: en
  modo oscuro conservan su aspecto de papel, y dentro de la isla no se aplica
  la variante `oscuro:`. `ConstanciaRadicacion` es del portal ciudadano y no
  entra en el tema.
- **Colores de identidad** (verde de botón, dorado, rojos y ámbares usados como
  fondo, riel, barra o icono SVG) quedan fijos: se leen igual en ambos temas.
- **Menús laterales:** ya son verde oscuro con texto claro; no cambian.

## 3. Correcciones de contraste encontradas al migrar

- Texto `--color-primary` (#007049) sobre dorado en `ChipFiltroLibro` y
  `LibroConsecutivoClient`: 2,81:1 → `#03402A` (5,41:1).
- Texto gris del SVG de `CabeceraTermino` en `#94A3B8` (2,5:1) →
  `--tema-texto-64748b`. Es el único cambio visible en modo claro, y va a
  favor de AA.

## 4. Guardianes

`__tests__/tema-interno-tokens.test.ts`:
- todo token usado en `app/` tiene valor claro y oscuro;
- el valor claro es igual al hex del nombre;
- todo texto oscuro cumple AA;
- el tema se fija en un solo lugar (`<html>`) y ninguna pantalla lo fija por
  su cuenta;
- los documentos oficiales no usan tokens de tema.

## 5. Límite conocido

Los pares de texto y fondo se validan token a token, no combinación por
combinación en pantalla. La revisión automatizada y el render controlado se
completaron; aún falta la verificación autenticada en Stage por rol. Lo que
aparezca allí se corrige ajustando el valor oscuro del token, sin tocar
componentes salvo que la evidencia lo exija.
