# Blueprint Arquitectónico — C11 · Archivo Institucional (Nivel 1)

**Estado:** **IDENTIFICADA — DIFERIDA a fase posterior (NO autorizada, 14 jul 2026).**
Decisión del propietario: mantener el foco en el núcleo de la Ventanilla y no abrir un
nuevo dominio funcional todavía. El diseño queda listo (Definition of Ready cumplida) para
retomarse tal cual cuando se decida evolucionar hacia el módulo de Archivo Institucional
(ahí se incorporarán el rol ARCHIVO, el catálogo TRD completo y la administración
documental). **No autoriza implementación** (ADR-0023). Capacidad nueva, ortogonal a H3.

- **Alcance elegido (propietario):** Nivel 1 — el **rol Archivo** es **dueño de la TRD
  completa** y **confirma la disposición final**. Cierra B32-a de raíz. *No* incluye
  transferencias/eliminación (Nivel 2/3, diferidos).
- **Fuente de verdad:** las **TRD oficiales** de Simacota (9 dependencias).
- **Iniciativas BM-\*:** habilita/absorbe B32-a; relacionado con BM-B02 (ventanilla ya
  clasifica su subconjunto). **Versión:** v1 — 2026-07-14.

---

## A. Arquitectura funcional y de dominio

### 1. Funcional detallada
Se crea un espacio, visible **solo al rol Archivo**, para: (a) **ver el catálogo TRD
completo** (todas las series/subseries de las 9 dependencias, no solo las 6 que produce
la ventanilla); (b) **confirmar/editar la disposición final** (CT/E/M/S) y la retención
por serie. El Archivo pasa a ser la **autoridad** del instrumento TRD dentro del sistema.

### 2. Lógica
- **Catálogo TRD como dato** (nuevo): colección Firestore `trd_catalogo`, poblada desde
  las TRD oficiales (extracción `pymupdf`). Editable solo por rol Archivo.
- **Rol + permisos:** nuevo rol `ARCHIVO`; función de permiso en `lib/permisos`.
- **API + UI** de administración, alcance rol Archivo.
- **Ventanilla sin cambios en Nivel 1:** `sugerirSerieDocumental` sigue leyendo su
  subconjunto en código (`series-documentales.ts`). La unificación de ambas fuentes se
  registra como **OAT-04** (no se hace aquí).

### 3. Límites del dominio
- **Dentro:** catálogo TRD completo (lectura + edición de retención/disposición) para el
  rol Archivo; confirmación de disposiciones (B32-a).
- **Fuera:** transferencias primarias/secundarias, eliminación reglada, archivo central
  (Nivel 2/3). Reclasificar radicados (es de la ventanilla/D3). Cambiar el flujo de
  radicación (queda intacto).

### 4. Entidades y agregados
- **Agregado raíz `SerieTRD`** (colección `trd_catalogo`): `{ dependencia (100–150),
  cs, sub?, nombre, retencionGestionAnios?, retencionCentralAnios?, disposicionFinal?
  (CT|E|M|S), procedimiento?, fuente, confirmadaPor?, fechaConfirmacion? }`. Clave:
  `${dependencia}.${cs}${sub?'.'+sub:''}`.
- **Objeto de valor `DisposicionConfirmada`**: quién (Jefe de Archivo) y cuándo confirmó.

### 5. Eventos de negocio
- `SerieTRDConfirmada` (disposición fijada por Archivo) · `SerieTRDActualizada`
  (retención/nombre corregidos) · (Nivel 2+) `TransferenciaProgramada` — fuera de alcance.

### 6. Reglas de negocio
1. **Solo el rol Archivo** edita/confirma el catálogo TRD (aislamiento por permiso).
2. La disposición final es **CT/E/M/S** y se **confirma con autoría y fecha** (trazable).
3. La retención proviene de la TRD; el Archivo la corrige si la TRD lo indica.
4. El catálogo del Archivo **no altera** la clasificación histórica de los radicados
   (foto inmutable intacta) — es el instrumento, no el expediente.

### 7. Flujos
**Principal:** Archivo entra a "Catálogo TRD" → ve series por dependencia → confirma
disposición pendiente (p. ej. las 3 de B32-a) → queda con autoría/fecha.
**Alterno A:** corrige retención de una serie según la TRD aprobada → evento de auditoría.
**Alterno B (Nivel 2, fuera de alcance):** programar transferencia.

## B. Contratos e interfaces
- **8. Actores:** Jefe de Archivo (rol `ARCHIVO`); ADMIN (configura el rol). SIMI opcional
  (sugiere disposición desde el texto "procedimiento"; el Archivo decide).
- **9. Permisos:** nuevo `ARCHIVO` en `RolInterno` (`lib/hooks/useAuth.ts:11`) + unión
  inline (`src/types/ventanilla.ts:332`); `puedeGestionarTRD(rol)` en `lib/permisos`.
  Solo `ARCHIVO` (y `ADMIN`) acceden a la administración del catálogo.
- **10. APIs:** `GET /api/interno/trd` (listar, filtrable por dependencia),
  `PATCH /api/interno/trd/[serieId]` (confirmar/editar disposición y retención) —
  ambos exigen rol Archivo. Sin endpoints para la ventanilla (no cambia).
- **11. Integraciones:** ninguna externa. Interna: comparte el vocabulario de serie con
  `series-documentales.ts` (a unificar, OAT-04).
- **12. Modelo de datos:** nueva colección `trd_catalogo` (índice por `dependencia`).
  Semilla desde las TRD (script de extracción). Sin cambios en `ventanilla_radicados`.

## C. Reutilización vs. construcción
- **13. Reutiliza:** modelo de roles (`RolInterno`) + `lib/permisos`; el tipo
  `SerieDocumentalDef`/`disposicionFinal` ya definido en `series-documentales.ts`; el
  patrón de rutas internas (`app/api/interno/*`) con `requireActiveInternalUser`.
- **14. Nuevo (justificado):** colección `trd_catalogo` (el Archivo necesita un registro
  editable, hoy inexistente); rol `ARCHIVO` (no existe); API + UI de administración;
  script de semilla desde las TRD. Cada uno se justifica por la necesidad del rol Archivo.

## D. Impactos transversales
- **15. SIMI:** puede **sugerir** la disposición leyendo el campo "procedimiento" de la
  TRD (p. ej. "se seleccionará una muestra" → S). El Archivo confirma. Nunca automática.
- **16. Seguridad:** nueva superficie mínima, **estrictamente** por rol `ARCHIVO`; sin
  datos personales (es instrumento archivístico). Aislamiento por permiso.
- **17. Auditoría:** cada confirmación/edición queda con autoría y fecha (refuerza MIPG).
- **18. Rendimiento:** catálogo pequeño (~110 docs), lectura por dependencia; sin impacto
  en la radicación (no se toca su ruta caliente).
- **19. Mantenibilidad:** el catálogo pasa de "solo código" a "dato editable por el
  dueño"; a mediano plazo simplifica (una sola fuente, vía OAT-04).

## E. Ejecución
- **20. Riesgos:** (R1) **doble fuente TRD** (código subset vs dato completo) mientras no
  se aplique OAT-04 → mitigar: el Nivel 1 no conecta la ventanilla al dato; la ventanilla
  sigue con su subset probado. (R2) TRD en borrador → `fuente` versionada. (R3) semilla mal
  extraída → validación del Archivo antes de dar por buena.
- **21. Migración:** poblar `trd_catalogo` desde las TRD (retención ya extraíble; la
  disposición la confirma el Archivo). Sin migrar radicados.
- **22. Pruebas:** unitarias del permiso (`puedeGestionarTRD`: solo ARCHIVO/ADMIN);
  API (confirmar disposición exige rol; persiste autoría); regresión por mutación
  (revertir el guard de rol → rojo). El flujo de la ventanilla no debe cambiar (test de
  no-regresión de `sugerirSerieDocumental`).
- **23. Despliegue:** rol `ARCHIVO` tras alta del usuario; UI detrás del permiso; sin
  feature flag (superficie nueva y aislada). Rollback: quitar el rol.

## F. Análisis crítico obligatorio
1. **¿Simplificamos?** Damos al Archivo un **home** propio en vez de repartir función
   archivística por toda la plataforma.
2. **¿Eliminamos?** El hardcode de disposiciones por mi parte (las confirma el dueño).
3. **¿Consolidamos?** El instrumento TRD en una fuente de dato única para el Archivo
   (y, vía OAT-04, con la ventanilla más adelante).
4. **¿Reutilizamos?** Roles, permisos, tipos de serie, patrón de rutas internas.
5. **¿Evitamos construir?** Transferencias/eliminación (Nivel 2/3); tocar la radicación;
   convertir la plataforma en gestor integral de archivo.
6. **¿Alternativa más simple?** Sí se evaluó: confirmar disposiciones **editando el
   código + deploy** (sin colección/rol). Descartada: no le da al Archivo la **titularidad**
   ni autonomía que el propietario pidió ("agregar la función a la oficina de archivo").
   El dato editable por rol es el mínimo que cumple ese objetivo.
7. **¿En 5 años?** El Archivo tiene una base que crece a Nivel 2/3 **sin** rediseñar ni
   tocar la ventanilla; OAT-04 unifica la fuente TRD cuando convenga. Envejece bien.

### 24. Veredicto
- [x] Sin mayor simplificación dentro del alcance de Nivel 1. Bucle de re-revisión **no**
  disparado. La doble fuente TRD se deriva como **OAT-04** (no se arrastra por inercia).

## G. Definition of Ready
- [x] Blueprint completo. [x] Cuatro Preguntas: (1) problema real: el Archivo no tiene
  dónde ejercer su titularidad de la TRD ni confirmar disposiciones — sí; (2) mejor
  solución: dato editable por rol, sin tocar la ventanilla — sí; (3) valor>complejidad:
  alto valor normativo, complejidad acotada y aislada — sí; (4) largo plazo: base
  evolutiva para Archivo — sí. [x] Valor Neto favorable. [x] Análisis crítico superado.

**C11-Nivel 1 queda CANDIDATA a implementación.** Requiere **autorización expresa** y
—como toda validación archivística— el criterio del **Jefe de Archivo** sobre las
disposiciones. Ortogonal a H3: no depende de la liberación del Bloque 2. Este Blueprint
**no** autoriza código.

## H. Hallazgos Arquitectónicos Transversales (OAT)
| OAT | Título | Prioridad | Momento |
|---|---|---|---|
| [OAT-04](../OAT_REGISTRO.md#oat-04) | Unificar la fuente de verdad de la TRD (código subset de la ventanilla ↔ dato completo del Archivo) | Media | Después de C11-Nivel 1 |
