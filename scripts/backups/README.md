# Respaldos automatizados de Firestore

Contraparte **ejecutable** del respaldo diario descrito en
`docs/disaster-recovery.md`. Antes ese documento describía un export "programado"
que **no existía en ningún lado** (hallazgo CR-3 de la auditoría 2026-07-20):
no había Cloud Scheduler, ni Action, ni script. Este directorio lo remedia.

## Vía elegida y por qué

**GitHub Actions programado** (`.github/workflows/backup-firestore.yml`) que
ejecuta `gcloud firestore export` a un bucket de GCS, con retención por
*lifecycle*.

Se prefirió sobre Cloud Scheduler (la opción "nativa GCP") por tres razones
propias de este proyecto:

1. **La causa raíz del hallazgo era "nada versionado".** Un workflow en el repo
   queda bajo control de versiones, revisión y trazabilidad — justo lo que
   faltaba. Cloud Scheduler se configura de forma imperativa y no deja rastro
   auditable en el código.
2. **Una sola superficie operativa.** El equipo ya opera todo su CI/gobernanza
   en GitHub Actions (gates de calidad, informe de despliegue ADR-0013). No se
   añade un sistema nuevo que aprender y vigilar.
3. **Estampado por día sin infraestructura extra.** El workflow calcula
   `YYYY-MM-DD` y escribe en `diario/YYYY-MM-DD/`. Cloud Scheduler, por sí solo,
   no puede plantillar la fecha en el destino del export: requeriría además una
   Cloud Function o un Workflow de GCP (más piezas móviles).

### Restaurar a STAGE requiere export a GCS (no backups gestionados)

Firestore ofrece *backups gestionados* nativos (`gcloud firestore backups`),
más simples, **pero solo restauran dentro del mismo proyecto**. El runbook exige
restaurar a **STAGE** (proyecto distinto) para no tocar producción, y eso solo
lo permite el par **export/import a GCS**. Por eso el mecanismo es el export a
bucket, no el backup gestionado.

### Salvedad honesta de esta vía

Los workflows *programados* de GitHub se **auto-deshabilitan tras 60 días sin
`push` al repo**. En un proyecto en mantenimiento activo (con PRs frecuentes) no
aplica, pero si el repo entra en pausa prolongada hay que reactivar el workflow
o migrar el disparo a Cloud Scheduler. Documentado en `docs/disaster-recovery.md`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `../../.github/workflows/backup-firestore.yml` | Export diario (02:00 Colombia) + disparo manual. |
| `setup-gcp-backups.sh` | Provisión **idempotente** de bucket, retención, SA de backups, IAM y WIF. Lo corre el propietario UNA vez. |
| `export-firestore.sh` | Export manual desde una máquina con `gcloud` (misma operación que el workflow). |
| `lifecycle-retention.json` | Política de retención del bucket (30 días). |

## Puesta en marcha (propietario, una vez)

```bash
# 1. Provisionar infraestructura (requiere gcloud como Owner/Editor del proyecto).
./scripts/backups/setup-gcp-backups.sh

# 2. Cargar los secrets/variables que imprime el script en GitHub:
#    Settings -> Secrets and variables -> Actions
#      Secrets:   GCP_WORKLOAD_IDENTITY_PROVIDER, GCP_BACKUP_SA   (vía WIF, recomendado)
#                 (o GCP_BACKUP_SA_KEY si se usa clave JSON)
#      Variables: GCP_BACKUP_PROJECT, GCP_BACKUP_BUCKET

# 3. Probar: Actions -> "Backup Firestore" -> Run workflow -> input "backup".
#    Verificar: gcloud storage ls gs://ventanilla-simacota-backups/diario/
```

Restauración: ver `docs/RUNBOOK_RESTAURACION.md`.

## Retención

30 días (regla `lifecycle-retention.json`). Ajustable si el municipio define
otra ventana legal. Los objetos con más de 30 días se borran automáticamente;
no requiere intervención manual.
