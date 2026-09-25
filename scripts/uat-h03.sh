#!/usr/bin/env bash
# UAT semiautomático H-03 — Consulta pública de radicados.
# Ejecutar SOLO contra Preview de Vercel. NO contra producción.
# Requiere: bash, curl, jq.
#
# Uso:
#   export BASE_URL=https://ventanilla-simacota-git-<branch>.vercel.app
#   export RADICADO_IDENTIFICADO=1-WEB-2026-00000001
#   export CORREO_CORRECTO=uat.identificado@example.test
#   export CORREO_INCORRECTO=otro@example.test   # opcional, default no real
#   export RADICADO_INEXISTENTE=1-WEB-2099-00099999   # opcional
#   export RADICADO_ANONIMO=1-WEB-2026-00000002
#   export TOKEN_ANONIMO=<token base64url generado en radicación>
#   export RADICADO_RESERVADO=1-WEB-2026-00000003
#   export TOKEN_RESERVADO=<token base64url generado en radicación>
#   ./scripts/uat-h03.sh
#
# Genera salida tabular y un veredicto final. No firma la matriz —
# eso lo hace el responsable UAT con captura de cada caso.

set -uo pipefail

# ── Configuración ────────────────────────────────────────────────────────────
: "${BASE_URL:?Configura BASE_URL apuntando al Preview de Vercel}"
: "${RADICADO_IDENTIFICADO:?Configura RADICADO_IDENTIFICADO}"
: "${CORREO_CORRECTO:?Configura CORREO_CORRECTO}"
: "${RADICADO_ANONIMO:?Configura RADICADO_ANONIMO}"
: "${TOKEN_ANONIMO:?Configura TOKEN_ANONIMO}"
: "${RADICADO_RESERVADO:?Configura RADICADO_RESERVADO}"
: "${TOKEN_RESERVADO:?Configura TOKEN_RESERVADO}"

CORREO_INCORRECTO="${CORREO_INCORRECTO:-uat.no.existe@example.test}"
RADICADO_INEXISTENTE="${RADICADO_INEXISTENTE:-1-WEB-2099-00099999}"

if [[ "$BASE_URL" == *"ventanilla-simacota.vercel.app"* ]]; then
  echo "ABORTAR: BASE_URL apunta a producción. Usa el Preview del PR #17." >&2
  exit 2
fi
if ! command -v jq >/dev/null; then
  echo "ABORTAR: requiere 'jq' para validar bodies." >&2
  exit 2
fi

ENDPOINT_NUEVO="$BASE_URL/api/public/radicado/consulta"
ENDPOINT_VIEJO="$BASE_URL/api/consulta/$RADICADO_IDENTIFICADO"
MENSAJE_UNIFORME="No fue posible verificar el radicado con la información suministrada"
TMP_BODY=$(mktemp); TMP_HEAD=$(mktemp)
trap 'rm -f "$TMP_BODY" "$TMP_HEAD"' EXIT

PASS=0; FAIL=0; OBS=0

# ── Helpers ──────────────────────────────────────────────────────────────────
post_consulta() {  # $1=numeroRadicado, $2=dato
  curl -sS -X POST "$ENDPOINT_NUEVO" \
    -H "Content-Type: application/json" \
    -H "User-Agent: uat-h03-script/1.0" \
    -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" \
    --data "$(jq -nc --arg n "$1" --arg d "$2" \
       '{numeroRadicado:$n, datoVerificacion:$d}')"
}
post_consulta_token() {  # $1=numeroRadicado, $2=token
  curl -sS -X POST "$ENDPOINT_NUEVO" \
    -H "Content-Type: application/json" \
    -H "User-Agent: uat-h03-script/1.0" \
    -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" \
    --data "$(jq -nc --arg n "$1" --arg t "$2" \
       '{numeroRadicado:$n, tokenConsulta:$t}')"
}
tiene_cache_no_store() {
  grep -i '^cache-control:' "$TMP_HEAD" | grep -qi 'no-store'
}
body_contiene_keys_prohibidas() {
  jq -r '.. | objects | keys | .[]' "$TMP_BODY" 2>/dev/null | \
    grep -E '^(actorUid|actorNombre|archivoPath|storagePath|email|numeroDocumento|telefono|direccion|solicitante|responsableUid)$' || true
}
body_no_tiene_dependencia() {
  ! jq -e '.radicado.dependencia // empty' "$TMP_BODY" >/dev/null 2>&1
}
imprimir() {  # $1=caso, $2=esperado, $3=http, $4=veredicto, $5=obs
  printf '%-7s | %-46s | %-6s | %-10s | %s\n' "$1" "$2" "$3" "$4" "$5"
}
veredicto() {  # $1=cond → pasa/falla
  if eval "$1"; then echo "APROBADO"; PASS=$((PASS+1));
  else echo "SUSPENDIDO"; FAIL=$((FAIL+1)); fi
}

# ── Cabecera ────────────────────────────────────────────────────────────────
echo
echo "UAT semiautomático H-03 — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Endpoint nuevo: $ENDPOINT_NUEVO"
echo "Endpoint viejo: $ENDPOINT_VIEJO"
echo
printf '%-7s | %-46s | %-6s | %-10s | %s\n' "Caso" "Esperado" "HTTP" "Veredicto" "Observación"
printf -- '--------+------------------------------------------------+--------+------------+----------------------------------\n'

# ── Caso 1: identificado + correo correcto ──────────────────────────────────
HTTP=$(post_consulta "$RADICADO_IDENTIFICADO" "$CORREO_CORRECTO")
OK=$(jq -r '.ok // false' "$TMP_BODY")
PROHIBIDAS=$(body_contiene_keys_prohibidas)
NO_CACHE=$(tiene_cache_no_store && echo true || echo false)
COND='[ "$HTTP" = "200" ] && [ "$OK" = "true" ] && [ -z "$PROHIBIDAS" ] && [ "$NO_CACHE" = "true" ]'
imprimir "H03-01" "200 + ok:true + sin PII + no-store" "$HTTP" "$(veredicto "$COND")" \
  "${PROHIBIDAS:+keys prohibidas: $PROHIBIDAS}"

# ── Caso 2: identificado + correo incorrecto ────────────────────────────────
HTTP=$(post_consulta "$RADICADO_IDENTIFICADO" "$CORREO_INCORRECTO")
ERR=$(jq -r '.error // ""' "$TMP_BODY")
COND='[ "$HTTP" = "404" ] && echo "$ERR" | grep -q "$MENSAJE_UNIFORME"'
imprimir "H03-02" "404 + mensaje uniforme" "$HTTP" "$(veredicto "$COND")" "$ERR"

# ── Caso 3: radicado inexistente ────────────────────────────────────────────
HTTP=$(post_consulta "$RADICADO_INEXISTENTE" "$CORREO_CORRECTO")
ERR=$(jq -r '.error // ""' "$TMP_BODY")
COND='[ "$HTTP" = "404" ] && echo "$ERR" | grep -q "$MENSAJE_UNIFORME"'
imprimir "H03-03" "404 mismo mensaje que H03-02" "$HTTP" "$(veredicto "$COND")" "$ERR"

# ── Caso 4: anónimo + token correcto ────────────────────────────────────────
HTTP=$(post_consulta_token "$RADICADO_ANONIMO" "$TOKEN_ANONIMO")
OK=$(jq -r '.ok // false' "$TMP_BODY")
SIN_DEP=$(body_no_tiene_dependencia && echo true || echo false)
PROHIBIDAS=$(body_contiene_keys_prohibidas)
COND='[ "$HTTP" = "200" ] && [ "$OK" = "true" ] && [ "$SIN_DEP" = "true" ] && [ -z "$PROHIBIDAS" ]'
imprimir "H03-04" "200 + ok:true + sin dependencia ni PII" "$HTTP" "$(veredicto "$COND")" \
  "${PROHIBIDAS:+keys prohibidas: $PROHIBIDAS}"

# ── Caso 5: reservado/anónimo sin fuga de dependencia ───────────────────────
HTTP=$(post_consulta_token "$RADICADO_RESERVADO" "$TOKEN_RESERVADO")
OK=$(jq -r '.ok // false' "$TMP_BODY")
SIN_DEP=$(body_no_tiene_dependencia && echo true || echo false)
DEP_RESP=$(jq -r '.radicado.respuestaOficial.dependenciaNombre // ""' "$TMP_BODY")
COND='[ "$HTTP" = "200" ] && [ "$OK" = "true" ] && [ "$SIN_DEP" = "true" ] && { [ -z "$DEP_RESP" ] || [ "$DEP_RESP" = "Alcaldía Municipal de Simacota" ]; }'
imprimir "H03-05" "Reservado sin fuga de dependencia" "$HTTP" "$(veredicto "$COND")" \
  "respuestaOficial.dependenciaNombre=${DEP_RESP:-(no resuelto aún)}"

# ── Caso 6a: ruta vieja GET → 410 ───────────────────────────────────────────
HTTP=$(curl -sS -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" "$ENDPOINT_VIEJO")
NO_DATOS=$(! jq -e '.numeroRadicado // .radicado // empty' "$TMP_BODY" >/dev/null 2>&1 && echo true || echo false)
NO_CACHE=$(tiene_cache_no_store && echo true || echo false)
COND='[ "$HTTP" = "410" ] && [ "$NO_DATOS" = "true" ] && [ "$NO_CACHE" = "true" ]'
imprimir "H03-06a" "GET ruta vieja → 410 + no-store + sin datos" "$HTTP" "$(veredicto "$COND")" ""

# ── Caso 6b: GET canónico nuevo → 405 ───────────────────────────────────────
HTTP=$(curl -sS -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" "$ENDPOINT_NUEVO")
ALLOW=$(grep -i '^allow:' "$TMP_HEAD" | tr -d '\r\n')
COND='[ "$HTTP" = "405" ] && echo "$ALLOW" | grep -qi POST'
imprimir "H03-06b" "GET endpoint nuevo → 405 Allow: POST" "$HTTP" "$(veredicto "$COND")" "$ALLOW"

# ── Caso 7: Cache-Control en respuesta autorizada ───────────────────────────
post_consulta "$RADICADO_IDENTIFICADO" "$CORREO_CORRECTO" >/dev/null
COND='tiene_cache_no_store'
imprimir "H03-07" "Cache-Control: no-store en 200 OK" "200" "$(veredicto "$COND")" \
  "$(grep -i '^cache-control:' "$TMP_HEAD" | tr -d '\r\n')"

# ── Caso 8: sanitización detallada de la respuesta autorizada ───────────────
post_consulta "$RADICADO_IDENTIFICADO" "$CORREO_CORRECTO" >/dev/null
PROHIBIDAS=$(body_contiene_keys_prohibidas)
TIENE_REQUERIDAS=$(jq -e '.radicado.numeroRadicado and .radicado.estadoPublico' "$TMP_BODY" >/dev/null && echo true || echo false)
COND='[ -z "$PROHIBIDAS" ] && [ "$TIENE_REQUERIDAS" = "true" ]'
OBS_MSG=""
[ -n "$PROHIBIDAS" ] && OBS_MSG="keys prohibidas: $PROHIBIDAS"
[ "$TIENE_REQUERIDAS" != "true" ] && OBS_MSG="${OBS_MSG} faltan keys requeridas"
imprimir "H03-08" "Sin PII; con numeroRadicado + estadoPublico" "200" "$(veredicto "$COND")" "$OBS_MSG"

# ── Caso 9: rate-limit básico (no agresivo) ─────────────────────────────────
# Hace 5 intentos con dato incorrecto contra el mismo radicado.
# Por config (CONSULTA_RATE_FALLOS_RADICADO=5) el quinto debería bloquear.
ULTIMO=200
RETRY=""
for i in 1 2 3 4 5 6; do
  ULTIMO=$(post_consulta "$RADICADO_IDENTIFICADO" "$CORREO_INCORRECTO")
  if [ "$ULTIMO" = "429" ]; then
    RETRY=$(grep -i '^retry-after:' "$TMP_HEAD" | tr -d '\r\n')
    break
  fi
  sleep 1
done
COND='[ "$ULTIMO" = "429" ] && [ -n "$RETRY" ]'
imprimir "H03-09" "Tras ≤6 intentos fallidos → 429 + Retry-After" "$ULTIMO" "$(veredicto "$COND")" \
  "${RETRY:-(no se observó 429)}"

# ── Resumen ─────────────────────────────────────────────────────────────────
echo
TOTAL=$((PASS+FAIL))
echo "Resumen: $PASS/$TOTAL aprobados, $FAIL suspendidos."
echo
echo "Esto es evidencia técnica, no firma. El responsable UAT debe:"
echo "  1. Adjuntar capturas/curl logs por caso."
echo "  2. Validar manualmente H03-09 (rate-limit) en panel Firestore."
echo "  3. Verificar en consola de Firestore que 'seguridad_consultas_auditoria'"
echo "     sólo contiene hashes, sin correos, documentos ni tokens."
echo "  4. Firmar la matriz docs/UAT_SEGURIDAD_H03_CONSULTA_PUBLICA.md."

[ "$FAIL" -eq 0 ] || exit 1
