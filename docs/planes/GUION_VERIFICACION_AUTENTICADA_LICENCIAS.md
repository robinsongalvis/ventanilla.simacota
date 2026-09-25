# Guion de verificación autenticada — módulo de Licencias

**Para:** el propietario, en su demo con sesión iniciada.
**Motivo:** cerrar el ÚNICO hueco de cobertura que la verificación automatizada no puede cubrir.

---

## Por qué existe este documento (el límite, declarado)

El módulo de Licencias vive detrás del muro de sesión (`useAuth` → Firebase
Auth real). El asistente **no tiene credenciales y no debe pedirlas**, así que
en la verificación del rediseño (11-ago-2026) se montaron los COMPONENTES
REALES con datos reales en un banco de pruebas temporal, ya eliminado.

**Qué SÍ quedó verificado por esa vía** (y sigue cubierto por la suite):
componentes, funciones puras de cómputo, estados de la tabla, accesibilidad
del panel lateral, responsive, y el comportamiento con datos feos.

**Qué NO puede verificar el asistente, y por eso está aquí:**

1. **La carga real desde la API autenticada** — que la sesión del funcionario
   pase el gate de rol/tenant y la lista llegue con datos de producción.
2. **El aislamiento por área** — que Licencias solo sea visible/operable para
   Planeación (y ADMIN), no para otras dependencias.
3. **La descarga real del CSV** — el navegador headless no ejerce la descarga
   de archivos ni su apertura en Excel.
4. **La impresión real** — el diálogo de impresión del sistema operativo.
5. **El correo real al ciudadano** — envío efectivo y su llegada a la bandeja.

---

## Guion (10 minutos, en orden)

Marque cada casilla. Donde algo falle, anote **qué vio** — no hace falta
diagnosticar.

### A. Acceso y aislamiento
- [ ] Entrar como funcionario de **Planeación** → el módulo "Licencias" aparece en el menú.
- [ ] Entrar como funcionario de **OTRA dependencia** → "Licencias" **NO** aparece, y si se pega la URL directa, se rechaza el acceso.

### B. Libro consecutivo (el rediseño)
- [ ] La tabla carga con los expedientes reales (no queda "Cargando…" ni error).
- [ ] Los cuatro contadores muestran cifras coherentes con las filas visibles.
- [ ] Al hacer clic en un filtro, la tabla cambia y el contador del chip coincide con las filas mostradas.
- [ ] La columna **"Vence"**: los expedientes con actuación registrada muestran fecha; los demás, "—". *(Los creados antes del 11-ago-2026 mostrarán "—" hasta que se les registre una actuación: es esperado, no un fallo.)*
- [ ] La columna **"Vigencia hasta"** está vacía en todo expediente que no esté en firme.
- [ ] Cambiar el año en el selector recarga la tabla con ese año.

### C. Panel de detalle
- [ ] Clic en una fila → el panel abre por la derecha **sin tapar** la tabla.
- [ ] El panel carga los datos del expediente (no queda en error).
- [ ] La tecla **Escape** lo cierra.
- [ ] Se ven **DOS fechas de término** con la más exigente resaltada en rojo.

### D. Exportación e impresión *(no verificable de forma automatizada)*
- [ ] "Exportar CSV" descarga el archivo.
- [ ] El archivo abre en Excel **con los acentos correctos** y las columnas separadas (no todo en una sola celda).
- [ ] "Imprimir" muestra la vista limpia, sin el menú lateral ni los botones.

### E. En un expediente con plazo vencido *(si existe uno)*
- [ ] Aparece el aviso **"Por archivar"**.
- [ ] Se ve el proyecto de acto con la frase de que **nada ocurre hasta la firma**.
- [ ] **NO** existe ningún botón que archive automáticamente.

### F. Móvil (desde el celular)
- [ ] Los contadores se ven en dos columnas.
- [ ] La tabla se desplaza de lado sin romper la pantalla.

---

## Qué hacer con el resultado

Cualquier casilla sin marcar es un hallazgo. Basta con reportar la casilla y
lo que se vio en pantalla; el diagnóstico y la corrección van por el flujo
normal (rama, prueba de regresión, PR con CI en verde).

**Nota sobre datos de prueba:** los expedientes con la etiqueta `PRUEBA` son
de las demos y deben depurarse antes de la entrega formal — decisión
pendiente del propietario.
