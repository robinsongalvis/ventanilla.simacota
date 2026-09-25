#!/usr/bin/env bash
#
# export-firestore.sh — Export MANUAL de Firestore a GCS (misma operación que
# ejecuta el workflow .github/workflows/backup-firestore.yml, aquí para correr a
# mano desde una máquina con gcloud autenticado). ADITIVO: crea un backup, nunca
# borra ni modifica datos.
#
# Uso:
#   ./scripts/backups/export-firestore.sh
#   PROJECT=ventanilla-unica-f31b1 BUCKET=ventanilla-simacota-backups ./scripts/backups/export-firestore.sh
#
set -euo pipefail

PROJECT="${PROJECT:-ventanilla-unica-f31b1}"
BUCKET="${BUCKET:-ventanilla-simacota-backups}"
FECHA="$(date -u +%F)"
DESTINO="gs://${BUCKET}/diario/${FECHA}"

command -v gcloud >/dev/null || { echo "ERROR: gcloud no está instalado."; exit 1; }

echo "Export de Firestore (ADITIVO — no toca datos)"
echo "  Proyecto: ${PROJECT}"
echo "  Destino : ${DESTINO}"
gcloud firestore export "${DESTINO}" \
  --project="${PROJECT}" \
  --database='(default)'
echo "Export completo. Verifícalo con: gcloud storage ls ${DESTINO}"
