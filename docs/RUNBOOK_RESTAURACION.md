# Runbook de restauración de Firestore

**Objetivo:** restaurar un export de respaldo de Firestore y **verificar que es
recuperable**, sin tocar producción. Es la contraparte de restauración del respaldo
descrito en `docs/disaster-recovery.md` §3.

> **EJECUTADO el 18-ago-2026.** El drill end-to-end contra un export real de
> producción dejó de ser teoría: corrida
> [`32087393598`](https://github.com/robinsongalvis/ventanilla.simacota/actions/runs/32087393598),
> respaldo del 17-ago-2026, restaurado en la base desechable
> `drill-2026-08-17-7` de stage y verificado con
> `scripts/backups/verificar-restauracion.mjs`. Veredicto: **RESTAURACIÓN
> VÁLIDA**. Se automatiza en `.github/workflows/drill-restauracion.yml` y se
> dispara a mano. Detalle en §6.

> **Regla de oro:** una restauración de *ensayo* (drill) SIEMPRE va a **STAGE**
> (`ventanilla-simacota-stage`), **NUNCA** a producción (`ventanilla-unica-f31b1`).
> El único caso en que se importa a producción es una recuperación real ante
> corrupción confirmada (§5), y requiere orden explícita del propietario.

Contexto de infraestructura (verificado 2026-07-20):

| | Producción | Stage |
|---|---|---|
| Proyecto | `ventanilla-unica-f31b1` | `ventanilla-simacota-stage` |
| Firestore location | `nam5` | `nam5` |
| Bucket de respaldos | `gs://ventanilla-simacota-backups/diario/YYYY-MM-DD/` | — |

`gcloud firestore import` **puede** importar a un proyecto distinto del que
generó el export (por eso el DR usa export/import a GCS y no los *backups
gestionados*, que solo restauran dentro del mismo proyecto).

---

## 0. Requisitos previos

- `gcloud` autenticado contra **stage** con permisos suficientes:
  - **Si va a restaurar sobre una base que YA existe:** basta
    `roles/datastore.importExportAdmin` sobre `ventanilla-simacota-stage`.
  - **Si va a crear una base nueva** (§3 y el ensayo automatizado lo hacen):
    hace falta `roles/datastore.owner` sobre `ventanilla-simacota-stage`.
    `importExportAdmin` **no alcanza**: no incluye `datastore.databases.create`
    ni `datastore.databases.delete`. Verificado el 17-ago-2026 contra la
    documentación oficial de IAM de Firestore, tras una corrida fallida.
    El rol va sobre **stage**, nunca sobre producción.
- Lectura del bucket de respaldos, que vive en el proyecto de **producción**.
  Son **dos identidades distintas** y ninguna hereda de la otra:
  - quien ejecuta `gcloud` (lista y elige el respaldo) → `roles/storage.objectViewer`;
  - el *service agent* de Firestore de stage (lee los archivos durante el
    import) → `roles/storage.objectViewer` **y** `roles/storage.legacyBucketReader`,
    porque `objectViewer` no incluye `storage.buckets.get`. Ambos de solo lectura.

  > El workflow `drill-restauracion.yml` sondea esto solo y escribe en el
  > resumen de la corrida los comandos exactos, ya rellenados con la
  > identidad y el número de proyecto reales.
- Credencial de servicio de **stage** para la verificación (el `.env.stage` del
  laboratorio, con `FIREBASE_SERVICE_ACCOUNT` apuntando a stage — ver
  `.env.stage.example` y `scripts/laboratorio/instalar-service-account.mjs`).
- El proyecto stage operativo (Firestore creado en `nam5`).

---

## 1. Elegir el respaldo a restaurar

```bash
# Backups disponibles (uno por día):
gcloud storage ls gs://ventanilla-simacota-backups/diario/

# Confirmar que el export elegido está completo (debe existir el metadata):
FECHA=2026-07-20
gcloud storage ls "gs://ventanilla-simacota-backups/diario/${FECHA}/"
# Debe listar un objeto  *.overall_export_metadata  -> export íntegro.
```

Guarda la ruta exacta del export (el prefijo usado al exportar):

```bash
EXPORT_URI="gs://ventanilla-simacota-backups/diario/${FECHA}"
```

## 2. Autorizar a stage a leer el bucket (import entre proyectos)

El *service agent* de Firestore de stage debe poder leer el bucket de respaldos
de producción. Concede lectura (una sola vez):

```bash
STAGE_PROJECT=ventanilla-simacota-stage
STAGE_NUM=$(gcloud projects describe "$STAGE_PROJECT" --format='value(projectNumber)')
STAGE_AGENT="service-${STAGE_NUM}@gcp-sa-firestore.iam.gserviceaccount.com"

gcloud storage buckets add-iam-policy-binding gs://ventanilla-simacota-backups \
  --member="serviceAccount:${STAGE_AGENT}" \
  --role="roles/storage.objectViewer"
```

## 3. Preparar el destino en STAGE (evitar mezclas)

`import` **sobrescribe** los documentos cuyo ID coincide, pero **no borra** los
que no estén en el backup. Para un ensayo limpio, el destino debe partir vacío.
Dos opciones:

- **Recomendada — base de datos con nombre y desechable** en el mismo proyecto
  stage (aislamiento total, no toca la `(default)` de stage):

  ```bash
  DEST_DB="restore-drill-${FECHA//-/}"
  gcloud firestore databases create --database="$DEST_DB" \
    --location=nam5 --project="$STAGE_PROJECT"
  ```

- **Alternativa — la `(default)` de stage**, vaciándola antes (stage es un
  laboratorio desechable, ADR-0002). Úsalo solo si nadie más está usando stage.

## 4. Importar

```bash
# A la base de datos de ensayo (recomendado):
gcloud firestore import "$EXPORT_URI" \
  --project="$STAGE_PROJECT" \
  --database="$DEST_DB"

# Seguir el progreso:
gcloud firestore operations list --project="$STAGE_PROJECT"
```

> **Precauciones**
> - Verifica **dos veces** que `--project` es `ventanilla-simacota-stage`. Jamás `ventanilla-unica-f31b1`.
> - El import es de larga duración; espera a que la operación llegue a `done: true`.
> - No corras dos imports en paralelo sobre la misma base.

## 5. Verificación post-restauración (criterio de éxito)

El objetivo es demostrar que los datos restaurados son **íntegros y coherentes**.

### 5.1 Conteo e integridad de consecutivos (detector)

El detector de consecutivos fantasma (`scripts/laboratorio/detectar-consecutivos-fantasma.mjs`,
solo lectura) sirve doble: **cuenta** documentos por serie y valida
**unicidad + continuidad** (AGN 060/2001). Apúntalo a la base restaurada:

```bash
# FIREBASE_SERVICE_ACCOUNT debe ser la credencial de STAGE.
# (Si restauraste a una base con nombre, el script lee la (default); para una
#  base con nombre, usa la (default) de stage en el paso 3, o adapta el destino.)
FIREBASE_SERVICE_ACCOUNT="$(cat ruta/al/service-account-stage.json)" \
  node scripts/laboratorio/detectar-consecutivos-fantasma.mjs --anio 2026
```

Salida esperada (JSON): por cada serie (`radicados`, `salidas`, `planillas`),
el campo `documentos` (conteo restaurado) y `huecos`/`duplicados`.

### 5.2 Comparar contra el estado de producción en el momento del backup

Corre el mismo detector, en **solo lectura**, contra producción, y compara:

```bash
FIREBASE_SERVICE_ACCOUNT="$(cat ruta/al/service-account-prod.json)" \
  node scripts/laboratorio/detectar-consecutivos-fantasma.mjs --anio 2026
```

### Criterio de éxito (todos deben cumplirse)

- [ ] La operación de `import` terminó con `done: true` y sin error.
- [ ] El detector sobre lo restaurado corre sin excepción y devuelve JSON.
- [ ] `documentos` por serie en stage **coincide** con el conteo de producción al
      momento del backup (admite diferencia solo por la actividad ocurrida entre
      la hora del export y la lectura de prod).
- [ ] `huecos` y `duplicados` en lo restaurado son **iguales** al perfil de
      producción (idealmente `[]` en ambos — cierre limpio AGN 060/2001).
- [ ] Los contadores `counters/{serie}-2026.ultimo` están presentes y son
      coherentes con el mayor consecutivo restaurado.

Si todo se cumple, el respaldo es **recuperable**: el drill queda como evidencia.

### 5.3 Limpieza del ensayo

```bash
# Borra la base de datos de ensayo para no acumular costo:
gcloud firestore databases delete --database="$DEST_DB" --project="$STAGE_PROJECT"
```

---

## 6. Recuperación REAL ante corrupción de producción (solo con orden del propietario)

Escenario distinto del drill: pérdida o corrupción confirmada en producción.

1. **Congelar escritura**: activar modo mantenimiento / solo lectura del panel
   antes de restaurar (evita que entren datos sobre datos a medio restaurar).
2. **Restaurar primero a stage** (§1–§5) para validar el backup elegido.
3. **Importar a producción** SOLO tras validación y con orden explícita:
   ```bash
   gcloud firestore import "$EXPORT_URI" --project=ventanilla-unica-f31b1 --database='(default)'
   ```
4. **Validar consecutivos en producción** con el detector (solo lectura) antes de
   reabrir el acceso público.
5. Reabrir escritura.

> Ningún paso 3 se ejecuta por iniciativa propia: es decisión humana.

---

## 7. Hardening recomendado (fuera del alcance de este runbook, para el propietario)

Verificado en prod el 2026-08-06 (vía `gcloud firestore databases describe`):

- **Point-in-Time Recovery (PITR): HABILITADO ✅** — `POINT_IN_TIME_RECOVERY_ENABLED`,
  retención 7 días (`versionRetentionPeriod: 604800s`, ventana desde 2026-07-30). Da
  recuperación a cualquier instante de los últimos 7 días, **complementaria** (no
  sustituta) de los exports durables a GCS. (Estado anterior de este documento:
  deshabilitado, snapshot 2026-07-20, previo a su activación.)
- **Delete Protection: HABILITADA ✅** — `DELETE_PROTECTION_ENABLED`. Evita el
  borrado accidental de la base.
- **Exports durables a GCS: OPERATIVO ✅ (verificado 2026-08-06).** `backup-firestore.yml`
  ejecutó su primer export con éxito (run `31088181768`) a
  `gs://ventanilla-simacota-backups/diario/2026-08-06/` (≈ 361 KB). Aprovisionamiento:
  `setup-gcp-backups.sh` + secrets WIF + `iamcredentials.googleapis.com` habilitada
  (el script la habilita solo desde el PR #152, junto con `iam`/`firestore`/`storage`).
  Con ≥1 export verificado, la precondición
  de backup para el reset de producción queda cumplida (el reset sigue requiriendo
  orden explícita del propietario).
