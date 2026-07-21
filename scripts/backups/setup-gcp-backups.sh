#!/usr/bin/env bash
#
# setup-gcp-backups.sh — Provisión IDEMPOTENTE de la infraestructura de respaldos
# de Firestore (Roadmap P2.4). Lo ejecuta el PROPIETARIO una sola vez (requiere
# rol Owner/Editor sobre el proyecto). Es seguro re-ejecutarlo: cada paso
# comprueba si el recurso ya existe antes de crearlo.
#
# Qué deja montado:
#   1. Bucket GCS de respaldos, en la MISMA ubicación que Firestore (nam5 -> US).
#   2. Política de retención (lifecycle) de 30 días sobre ese bucket.
#   3. Service account dedicada de backups (identidad separada de la app).
#   4. IAM mínimo: datastore.importExportAdmin (export/import) + objectAdmin en el bucket.
#   5. (Opcional, recomendado) Federación de identidad (WIF) GitHub Actions -> GCP,
#      para autenticar el workflow SIN clave JSON de larga vida.
#
# NO ejecuta ningún export ni toca datos. Solo crea/verifica recursos de infra.
#
# Requisitos: gcloud autenticado como Owner/Editor del proyecto de producción.
#
# Uso:
#   ./scripts/backups/setup-gcp-backups.sh
#   PROJECT=ventanilla-unica-f31b1 BUCKET=ventanilla-simacota-backups ./scripts/backups/setup-gcp-backups.sh
#
set -euo pipefail

# ── Parámetros (sobre-escribibles por variables de entorno) ──────────────────
PROJECT="${PROJECT:-ventanilla-unica-f31b1}"        # proyecto de PRODUCCIÓN
BUCKET="${BUCKET:-ventanilla-simacota-backups}"     # nombre del bucket de respaldos
LOCATION="${LOCATION:-US}"                           # Firestore prod = nam5 (multi-región US) -> bucket US
BACKUP_SA_NAME="${BACKUP_SA_NAME:-firestore-backup}"
BACKUP_SA="${BACKUP_SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
LIFECYCLE_FILE="$(cd "$(dirname "$0")" && pwd)/lifecycle-retention.json"

# Solo si vas a usar WIF (recomendado). Déjalos vacíos para omitir ese paso.
GH_REPO="${GH_REPO:-robinsongalvis/ventanilla.simacota}"   # owner/repo
WIF_POOL="${WIF_POOL:-github-actions}"
WIF_PROVIDER="${WIF_PROVIDER:-github}"
SETUP_WIF="${SETUP_WIF:-ask}"                        # ask | yes | no

echo "== Provisión de respaldos Firestore =="
echo "  Proyecto : ${PROJECT}"
echo "  Bucket   : gs://${BUCKET}  (ubicación ${LOCATION})"
echo "  SA backup: ${BACKUP_SA}"
echo

command -v gcloud >/dev/null || { echo "ERROR: gcloud no está instalado."; exit 1; }
gcloud config set project "${PROJECT}" >/dev/null

# ── 1. Bucket de respaldos ───────────────────────────────────────────────────
if gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "[1/5] Bucket gs://${BUCKET} ya existe. OK"
else
  echo "[1/5] Creando bucket gs://${BUCKET} en ${LOCATION}..."
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${PROJECT}" \
    --location="${LOCATION}" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi

# ── 2. Retención (lifecycle) ─────────────────────────────────────────────────
echo "[2/5] Aplicando política de retención (${LIFECYCLE_FILE})..."
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file="${LIFECYCLE_FILE}"

# ── 3. Service account de backups ────────────────────────────────────────────
if gcloud iam service-accounts describe "${BACKUP_SA}" >/dev/null 2>&1; then
  echo "[3/5] SA ${BACKUP_SA} ya existe. OK"
else
  echo "[3/5] Creando SA ${BACKUP_SA}..."
  gcloud iam service-accounts create "${BACKUP_SA_NAME}" \
    --project="${PROJECT}" \
    --display-name="Firestore backups (export diario)"
fi

# ── 4. IAM mínimo ────────────────────────────────────────────────────────────
echo "[4/5] Concediendo roles mínimos..."
# Export/import de Firestore.
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${BACKUP_SA}" \
  --role="roles/datastore.importExportAdmin" \
  --condition=None >/dev/null
# Escritura de los objetos del backup SOLO en este bucket (menor privilegio).
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${BACKUP_SA}" \
  --role="roles/storage.objectAdmin" >/dev/null
echo "      OK: datastore.importExportAdmin + storage.objectAdmin@bucket"

# ── 5. Federación de identidad (WIF) — recomendado, sin clave de larga vida ───
if [ "${SETUP_WIF}" = "ask" ]; then
  read -r -p "[5/5] ¿Configurar WIF para GitHub Actions (${GH_REPO})? [y/N] " resp
  case "${resp}" in y|Y|yes|si|s) SETUP_WIF=yes;; *) SETUP_WIF=no;; esac
fi

if [ "${SETUP_WIF}" = "yes" ]; then
  PROJECT_NUM="$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')"
  echo "[5/5] Configurando Workload Identity Federation..."
  gcloud iam workload-identity-pools describe "${WIF_POOL}" --location=global >/dev/null 2>&1 || \
    gcloud iam workload-identity-pools create "${WIF_POOL}" \
      --location=global --display-name="GitHub Actions"
  gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
      --location=global --workload-identity-pool="${WIF_POOL}" >/dev/null 2>&1 || \
    gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
      --location=global --workload-identity-pool="${WIF_POOL}" \
      --display-name="GitHub OIDC" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
      --attribute-condition="assertion.repository=='${GH_REPO}'" \
      --issuer-uri="https://token.actions.githubusercontent.com"
  # Permite que el repo impersone la SA de backups.
  gcloud iam service-accounts add-iam-policy-binding "${BACKUP_SA}" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GH_REPO}"
  PROVIDER_RESOURCE="projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
  echo
  echo "  >> Carga estos secrets en GitHub (Settings -> Secrets and variables -> Actions):"
  echo "     GCP_WORKLOAD_IDENTITY_PROVIDER = ${PROVIDER_RESOURCE}"
  echo "     GCP_BACKUP_SA                  = ${BACKUP_SA}"
else
  echo "[5/5] WIF omitido. Fallback con clave JSON (rótala cada 90 días):"
  echo "     gcloud iam service-accounts keys create backup-sa.json --iam-account=${BACKUP_SA}"
  echo "     gh secret set GCP_BACKUP_SA_KEY < backup-sa.json   # luego BORRA backup-sa.json"
fi

echo
echo "== Provisión completa. Variables opcionales del repo (Actions -> Variables):"
echo "   GCP_BACKUP_PROJECT = ${PROJECT}"
echo "   GCP_BACKUP_BUCKET  = ${BUCKET}"
echo "== Prueba manual: Actions -> 'Backup Firestore' -> Run workflow -> input 'backup'."
