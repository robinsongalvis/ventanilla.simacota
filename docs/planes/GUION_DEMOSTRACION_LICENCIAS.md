# Guion de demostración — Ventanilla Única y Licencias

**Fecha:** 13-ago-2026 · **Duración:** 20–25 minutos · **Para:** alcalde, secretarios, control interno

---

## Antes de empezar — cinco minutos que evitan el ridículo

| # | Comprobación | Cómo | Si falla |
|---|---|---|---|
| 1 | **El usuario ve el módulo** | Entre y confirme que aparece «Licencias» en el menú | Solo lo ven ADMIN o FUNCIONARIO de Planeación. Un **jefe de dependencia NO entra** |
| 2 | **Hay radicados sin expediente** | Bandeja → «Crear desde radicado» → debe listar alguno | Radique uno de prueba antes, no en vivo |
| 3 | **El almacenamiento funciona** | Suba un PDF a un requisito del checklist | Sin `FIREBASE_STORAGE_BUCKET` falla con error 500 — y es el momento más lucido |
| 4 | **Decida dónde demuestra** | Ver «El dilema del entorno», abajo | — |

### El dilema del entorno

|  | Producción | Stage |
|---|---|---|
| Los 196 históricos reales | **Sí** | No, salvo que se siembren |
| Los ejemplos que cree | **Quedan para siempre** en el Libro, marcados «Prueba» | Se borran con un comando |
| Correo al ciudadano | Ya no sale con número de demostración (PR #193) | Igual |

**Recomendación:** el Libro Consecutivo con datos reales es lo más impresionante que tiene, y solo existe en producción. Demuestre ahí **la parte de consulta**, y si va a crear ejemplos, decida antes cuántos y quién los borra.

---

## El guion

### Acto 1 — «Esto reemplaza el Excel» (7 min) · *lo más fuerte, va primero*

**Tablero → Licencias → Libro consecutivo**

1. Muestre la tabla con los **196 expedientes históricos reales** de 2022 a 2026, migrados del libro de papel de Planeación.
2. Cambie el **año** en el selector. Es el mismo gesto que abrir otra hoja del Excel.
3. **Busque** un expediente por nombre, cédula, matrícula o número. En el Excel esto era Ctrl+F y suerte.
4. Pulse el chip **«Históricos incompletos»**: el sistema sabe cuáles le faltan datos y los agrupa.
5. **Exportar CSV** — se abre en Excel, para quien lo necesite.
6. **Imprimir** — sale en horizontal con las 8 columnas completas.

> **La frase:** «El libro de Planeación era un archivo de Excel en un computador. Ahora es un registro consultable, con respaldo, y que cualquiera puede auditar.»

### Acto 2 — «El trámite completo» (8 min)

**Bandeja → Crear desde radicado**

1. Explique el flujo real: **el ciudadano radica en Ventanilla**, el radicado se clasifica a Planeación, y Planeación lo recoge.
2. Abra «Crear desde radicado»: la lista de radicados pendientes **se carga sola**. Nadie copia ni pega números.
3. Elija uno, marque las figuras normativas, confirme.
4. Entre al expediente y muestre:
   - El **checklist con los 19 requisitos** del formato oficial F-PGD-009 de la Alcaldía.
   - **Suba un documento** — el sistema verifica que el archivo sea de verdad lo que dice ser.
   - El **doble reloj de términos**, con las dos fechas posibles mientras Jurídica no defina el criterio.
   - La **vigencia del acto** calculada según la modalidad.

> **La frase:** «El expediente ya no es una carpeta física que se pierde. Cada documento queda con su huella, con fecha y con responsable.»

### Acto 3 — «El sistema no deja mentir» (5 min) · *el que convence a control interno*

1. En el Libro, muestre un expediente con **«COLISIÓN»**: dos expedientes con el mismo número en el libro de papel, que el sistema **delata** en vez de esconder.
2. Muestre un **«Histórico sin resolver»**: el sistema **no inventa** un estado que el papel no tenía.
3. Muestre un expediente resuelto: **no cuenta días de mora**, porque el plazo dejó de correr.

> **La frase:** «El sistema prefiere decir "no sé" antes que inventarse un dato. Eso es lo que lo hace confiable para una auditoría.»

---

## Lo que NO debe decir

| No diga | Diga |
|---|---|
| «Ya estamos radicando licencias» | «El trámite está construido; falta la autorización para activar la numeración legal» |
| «Este es el número del expediente» | «Es un número de demostración; el legal se activa cuando se autorice» |
| «El sistema no deja radicar sin papeles» | «El sistema lleva el control de qué falta» — *no bloquea, informa* |
| «El ciudadano radica en Planeación» | «El ciudadano radica en Ventanilla y Planeación recoge el trámite» |

---

## Si le preguntan

**«¿Por qué el número dice DEMO?»**
> Porque la numeración legal arranca donde quedó el libro de papel, y para eso necesitamos que Planeación confirme por escrito cuál fue el último número que asentó. Es un paso de una tarde, y el procedimiento está listo y ensayado.

**«¿Y los papeles que el ciudadano ya entregó en Ventanilla?»**
> Hoy hay que volver a subirlos al expediente. Es la siguiente mejora y está identificada.

**«¿Esto sirve para otras secretarías?»**
> El motor es genérico. Licencias es el primer trámite; la arquitectura está pensada para que el siguiente cueste mucho menos.

**«¿Qué pasa si se cae el sistema?»**
> Hay respaldo diario verificado y procedimiento de contingencia documentado.

---

## Después de la demostración

- Si creó ejemplos en producción, **anótelos y bórrelos** — quedan en el Libro marcados «Prueba».
- El paso que desbloquea todo: **preguntarle al ingeniero de Planeación el último número de 2026** (esperado `68745-0-26-0019`).

## Referencias

`docs/planes/PROCEDIMIENTO_APERTURA_SERIE_EXPEDIENTES.md` · ADR-0031 · R16 de `docs/REGISTRO_RIESGOS.md` · `docs/planes/REPORTE_E2E_LICENCIAS_STAGE_12AGO2026.md`
