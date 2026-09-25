#!/usr/bin/env bash
# UAT semiautomático conjunto H-04 / H-05 / H-07 (PR #19 hardening).
#
# Modos:
#   ./scripts/uat-hardening.sh          → corre las tres secciones
#   ./scripts/uat-hardening.sh --h04    → sólo H-04 (ai/log)
#   ./scripts/uat-hardening.sh --h05    → sólo H-05 (cron fail-closed)
#   ./scripts/uat-hardening.sh --h07    → sólo H-07 (cabeceras)
#
# Casos NO cubiertos por este script — quedan manuales:
#   H04-11: inspección Firestore (ai_logs y seguridad_ai_log_auditoria).
#   H05-01: requiere Preview con CRON_SECRET sin configurar (no manipulable desde cliente).
#   H05-05: requiere SMTP sandbox y CRON_SECRET; corre el job real (puede mandar correos).
#   H07-06: observación de Sentry / logs de Vercel durante ≥ 7 días.
#   H07-07: PR futura que cambia Report-Only → Enforce.
#
# Requiere: bash, curl, jq.

set -uo pipefail

# ── Modo ─────────────────────────────────────────────────────────────────────
MODO="${1:-all}"
case "$MODO" in
  --h04) MODO=h04 ;;
  --h05) MODO=h05 ;;
  --h07) MODO=h07 ;;
  all|--all|"") MODO=all ;;
  *)
    echo "Modo desconocido: $MODO. Use --h04, --h05, --h07 o sin flag." >&2
    exit 2 ;;
esac

# ── Configuración común ──────────────────────────────────────────────────────
: "${BASE_URL:?Configura BASE_URL apuntando al Preview de Vercel}"
if [[ "$BASE_URL" == *"ventanilla-simacota.vercel.app"* ]]; then
  echo "ABORTAR: BASE_URL apunta a producción. Usa el Preview del PR #19." >&2
  exit 2
fi
if ! command -v jq >/dev/null; then
  echo "ABORTAR: requiere 'jq'." >&2
  exit 2
fi

TMP_BODY=$(mktemp); TMP_HEAD=$(mktemp)
trap 'rm -f "$TMP_BODY" "$TMP_HEAD"' EXIT

PASS=0; FAIL=0; SKIP=0

imprimir() {
  printf '%-7s | %-52s | %-8s | %-10s | %s\n' "$1" "$2" "$3" "$4" "$5"
}
veredicto() {  # $1=cond eval, $2=skip-msg (vacío para evaluar)
  if [ -n "${2:-}" ]; then SKIP=$((SKIP+1)); echo "OMITIDO"; return; fi
  if eval "$1"; then PASS=$((PASS+1)); echo "APROBADO";
  else FAIL=$((FAIL+1)); echo "SUSPENDIDO"; fi
}
echo
echo "UAT hardening — $(date -u +%Y-%m-%dT%H:%M:%SZ)  · modo: $MODO"
echo "BASE_URL: $BASE_URL"
echo
printf '%-7s | %-52s | %-8s | %-10s | %s\n' "Caso" "Esperado" "HTTP" "Veredicto" "Observación"
printf -- '--------+------------------------------------------------------+----------+------------+--------\n'

# ════════════════════════════════════════════════════════════════════════════
# H-04 — /api/ai/log
# ════════════════════════════════════════════════════════════════════════════
if [ "$MODO" = "all" ] || [ "$MODO" = "h04" ]; then
  ENDPOINT="$BASE_URL/api/ai/log"
  SESSION_ADMIN="${SESSION_ADMIN:-}"
  SESSION_RECEPCION="${SESSION_RECEPCION:-}"
  SESSION_FUNC="${SESSION_FUNC:-}"
  SESSION_CI="${SESSION_CI:-}"

  post_ai() {  # $1=cookie ("" = sin sesión), $2=body
    if [ -n "$1" ]; then
      curl -sS -X POST "$ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Cookie: __session=$1" \
        -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" \
        --data "$2"
    else
      curl -sS -X POST "$ENDPOINT" \
        -H "Content-Type: application/json" \
        -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" \
        --data "$2"
    fi
  }
  no_store() { grep -i '^cache-control:' "$TMP_HEAD" | grep -qi 'no-store'; }
  body_ok() { ! grep -iE 'stack|nodemailer|smtp|PAYLOAD_DEMASIADO_GRANDE|CAMPO_DESCONOCIDO|ROL_NO_AUTORIZADO|RATE_LIMIT' "$TMP_BODY" >/dev/null; }

  BODY_OK='{"endpoint":"chat","latenciaMs":120,"promptVersion":"v1.0"}'

  # H04-01 sin sesión
  HTTP=$(post_ai "" "$BODY_OK")
  imprimir "H04-01" "401 sin sesión + no-store" "$HTTP" \
    "$(veredicto '[ "$HTTP" = "401" ] && no_store && body_ok')" \
    "$(jq -r '.error // ""' "$TMP_BODY")"

  # H04-02 RECEPCIONISTA
  if [ -n "$SESSION_RECEPCION" ]; then
    HTTP=$(post_ai "$SESSION_RECEPCION" "$BODY_OK")
    imprimir "H04-02" "403 ROL_NO_AUTORIZADO" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "403" ] && no_store && body_ok')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"
  else
    imprimir "H04-02" "403 RECEPCIONISTA" "—" "$(veredicto '' 'skip')" "SESSION_RECEPCION no exportada"
  fi

  # H04-03 FUNCIONARIO
  if [ -n "$SESSION_FUNC" ]; then
    HTTP=$(post_ai "$SESSION_FUNC" "$BODY_OK")
    imprimir "H04-03" "403 FUNCIONARIO" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "403" ] && no_store && body_ok')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"
  else
    imprimir "H04-03" "403 FUNCIONARIO" "—" "$(veredicto '' 'skip')" "SESSION_FUNC no exportada"
  fi

  # H04-04 ADMIN OK
  if [ -n "$SESSION_ADMIN" ]; then
    HTTP=$(post_ai "$SESSION_ADMIN" "$BODY_OK")
    LOG_ID=$(jq -r '.logId // ""' "$TMP_BODY")
    imprimir "H04-04" "200 + logId + no-store" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "200" ] && [ -n "$LOG_ID" ] && no_store')" \
      "logId=${LOG_ID:0:12}…"
  else
    imprimir "H04-04" "200 ADMIN" "—" "$(veredicto '' 'skip')" "SESSION_ADMIN no exportada"
  fi

  # H04-05 CI OK
  if [ -n "$SESSION_CI" ]; then
    HTTP=$(post_ai "$SESSION_CI" "$BODY_OK")
    LOG_ID=$(jq -r '.logId // ""' "$TMP_BODY")
    imprimir "H04-05" "200 + logId (CONTROL_INTERNO)" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "200" ] && [ -n "$LOG_ID" ] && no_store')" \
      "logId=${LOG_ID:0:12}…"
  else
    imprimir "H04-05" "200 CI" "—" "$(veredicto '' 'skip')" "SESSION_CI no exportada"
  fi

  # H04-06 payload > 4KB
  if [ -n "$SESSION_ADMIN" ]; then
    RELLENO=$(printf 'a%.0s' {1..5000})
    HTTP=$(post_ai "$SESSION_ADMIN" \
      '{"endpoint":"chat","latenciaMs":1,"promptVersion":"'"$RELLENO"'"}')
    imprimir "H04-06" "400 payload > 4KB" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "400" ] && no_store && body_ok')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"
  else
    imprimir "H04-06" "400 oversized" "—" "$(veredicto '' 'skip')" "SESSION_ADMIN no exportada"
  fi

  # H04-07 JSON inválido
  if [ -n "$SESSION_ADMIN" ]; then
    HTTP=$(post_ai "$SESSION_ADMIN" '{malformado')
    imprimir "H04-07" "400 JSON inválido" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "400" ] && no_store && body_ok')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"
  else
    imprimir "H04-07" "400 JSON inválido" "—" "$(veredicto '' 'skip')" "SESSION_ADMIN no exportada"
  fi

  # H04-08 campo desconocido (intento de filtrar PII)
  if [ -n "$SESSION_ADMIN" ]; then
    HTTP=$(post_ai "$SESSION_ADMIN" \
      '{"endpoint":"chat","latenciaMs":10,"prompt":"texto largo","email":"x@y.com"}')
    BODY_NO_INCLUYE_PII=$(! grep -iE 'x@y.com|texto largo' "$TMP_BODY" >/dev/null && echo true || echo false)
    imprimir "H04-08" "400 + body no refleja PII enviada" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "400" ] && no_store && [ "$BODY_NO_INCLUYE_PII" = "true" ]')" \
      "PII reflejada: $BODY_NO_INCLUYE_PII"
  else
    imprimir "H04-08" "400 CAMPO_DESCONOCIDO" "—" "$(veredicto '' 'skip')" "SESSION_ADMIN no exportada"
  fi

  # H04-09 endpoint inválido
  if [ -n "$SESSION_ADMIN" ]; then
    HTTP=$(post_ai "$SESSION_ADMIN" '{"endpoint":"otro","latenciaMs":10}')
    imprimir "H04-09" "400 ENDPOINT_INVALIDO" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "400" ] && no_store && body_ok')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"
  else
    imprimir "H04-09" "400 ENDPOINT_INVALIDO" "—" "$(veredicto '' 'skip')" "SESSION_ADMIN no exportada"
  fi

  # H04-10 rate-limit (31 requests)
  if [ -n "$SESSION_ADMIN" ]; then
    LIM_HTTP=""
    LIM_RETRY=""
    for i in $(seq 1 35); do
      HTTP=$(post_ai "$SESSION_ADMIN" "$BODY_OK")
      if [ "$HTTP" = "429" ]; then
        LIM_HTTP="$HTTP"
        LIM_RETRY=$(grep -i '^retry-after:' "$TMP_HEAD" | tr -d '\r\n')
        break
      fi
    done
    imprimir "H04-10" "429 + Retry-After tras ≤35 requests" "${LIM_HTTP:-?}" \
      "$(veredicto '[ "$LIM_HTTP" = "429" ] && [ -n "$LIM_RETRY" ]')" \
      "${LIM_RETRY:-no se observó 429}"
  else
    imprimir "H04-10" "429 rate-limit" "—" "$(veredicto '' 'skip')" "SESSION_ADMIN no exportada"
  fi

  # H04-11 manual
  imprimir "H04-11" "Inspección ai_logs + auditoría sin PII" "—" "MANUAL" "Consola Firestore"

  # H04-12 cubierto en cada caso anterior
  imprimir "H04-12" "no-store en todas las respuestas" "—" "Cubierto" "Inspección hecha por caso"
fi

# ════════════════════════════════════════════════════════════════════════════
# H-05 — Cron fail-closed
# ════════════════════════════════════════════════════════════════════════════
if [ "$MODO" = "all" ] || [ "$MODO" = "h05" ]; then
  CRON_PATHS=(
    "/api/cron/alertas-vencimiento"
    "/api/cron/simi/alertas-vencimiento"
  )
  CRON_SECRET_TEST="${CRON_SECRET_TEST:-}"

  for P in "${CRON_PATHS[@]}"; do
    EP="$BASE_URL$P"
    LABEL=$(echo "$P" | awk -F/ '{print $NF}' | cut -c1-12)

    # H05-01 manual
    imprimir "H05-01" "503 sin CRON_SECRET (${LABEL})" "—" "MANUAL" "requiere Preview limpio"

    # H05-02 sin Authorization
    HTTP=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" "$EP")
    imprimir "H05-02" "401 sin Authorization (${LABEL})" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "401" ]')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"

    # H05-03 Authorization sin Bearer
    HTTP=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -H "Authorization: TokenAbc" "$EP")
    imprimir "H05-03" "401 sin Bearer (${LABEL})" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "401" ]')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"

    # H05-04 Bearer token incorrecto
    HTTP=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" \
      -H "Authorization: Bearer token-incorrecto-de-prueba" "$EP")
    imprimir "H05-04" "401 token incorrecto (${LABEL})" "$HTTP" \
      "$(veredicto '[ "$HTTP" = "401" ]')" \
      "$(jq -r '.error // ""' "$TMP_BODY")"

    # H05-05 manual (riesgo SMTP)
    if [ -n "$CRON_SECRET_TEST" ]; then
      echo
      echo "[H05-05/${LABEL}] CRON_SECRET_TEST presente; ¿ejecutar job autorizado? (s/N): "
      read -r CONFIRMAR
      if [ "$CONFIRMAR" = "s" ] || [ "$CONFIRMAR" = "S" ]; then
        HTTP=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" \
          -H "Authorization: Bearer $CRON_SECRET_TEST" "$EP")
        imprimir "H05-05" "200 con CRON_SECRET (${LABEL})" "$HTTP" \
          "$(veredicto '[ "$HTTP" = "200" ]')" \
          "$(jq -c 'del(.timestamp)' "$TMP_BODY" 2>/dev/null || echo)"
      else
        imprimir "H05-05" "200 con CRON_SECRET (${LABEL})" "—" "$(veredicto '' 'skip')" "no confirmado"
      fi
    else
      imprimir "H05-05" "200 con CRON_SECRET (${LABEL})" "—" "MANUAL" "CRON_SECRET_TEST no exportado"
    fi

    # H05-06 inspección de body — cubierto en 02..04
    imprimir "H05-06" "body no expone secreto (${LABEL})" "—" "Cubierto" "verificación visual del operador"
  done
fi

# ════════════════════════════════════════════════════════════════════════════
# H-07 — Cabeceras de seguridad
# ════════════════════════════════════════════════════════════════════════════
if [ "$MODO" = "all" ] || [ "$MODO" = "h07" ]; then
  check_headers() {  # $1=path, $2=label
    curl -sS -I "$BASE_URL$1" -o "$TMP_HEAD" >/dev/null 2>&1
    local missing=()
    grep -qi '^x-content-type-options:[[:space:]]*nosniff' "$TMP_HEAD" || missing+=("X-Content-Type-Options")
    grep -qi '^referrer-policy:[[:space:]]*strict-origin-when-cross-origin' "$TMP_HEAD" || missing+=("Referrer-Policy")
    grep -qi '^x-frame-options:[[:space:]]*DENY' "$TMP_HEAD" || missing+=("X-Frame-Options")
    grep -qi '^permissions-policy:.*camera=().*microphone=().*geolocation=()' "$TMP_HEAD" || missing+=("Permissions-Policy")
    grep -qi '^strict-transport-security:.*max-age=31536000.*includeSubDomains' "$TMP_HEAD" || missing+=("HSTS")
    grep -qi '^content-security-policy-report-only:' "$TMP_HEAD" || missing+=("CSP-Report-Only")
    grep -qi '^x-powered-by:' "$TMP_HEAD" && missing+=("X-Powered-By-presente")
    if [ ${#missing[@]} -eq 0 ]; then echo OK; else echo "FALTA:${missing[*]}"; fi
  }

  RES=$(check_headers "/" "raíz")
  imprimir "H07-01" "6 cabeceras + sin X-Powered-By (/)" "—" \
    "$(veredicto '[ "$RES" = "OK" ]')" "$RES"

  RES=$(check_headers "/api/consulta/1-WEB-2099-00099999" "api pública")
  imprimir "H07-02" "headers en API pública (GET)" "—" \
    "$(veredicto '[ "$RES" = "OK" ]')" "$RES"

  RES=$(check_headers "/api/interno/notificar-ciudadano" "api privada")
  imprimir "H07-03" "headers en API privada (sin sesión)" "—" \
    "$(veredicto '[ "$RES" = "OK" ]')" "$RES"

  curl -sS -I "$BASE_URL/" -o "$TMP_HEAD" >/dev/null
  PB=$(grep -i '^x-powered-by:' "$TMP_HEAD" || echo "")
  imprimir "H07-04" "X-Powered-By ausente" "—" \
    "$(veredicto '[ -z "$PB" ]')" "${PB:-ausente}"

  curl -sS -I "$BASE_URL/" -o "$TMP_HEAD" >/dev/null
  CSP_TIPO=$(grep -i '^content-security-policy' "$TMP_HEAD" | head -1 | tr -d '\r')
  imprimir "H07-05" "CSP en modo Report-Only" "—" \
    "$(veredicto 'echo "$CSP_TIPO" | grep -qi report-only')" \
    "$(echo "$CSP_TIPO" | cut -c1-50)…"

  imprimir "H07-06" "≥ 7 días sin violaciones CSP en Sentry" "—" "MANUAL" "observación temporal"
  imprimir "H07-07" "PR para promover CSP a Enforce" "—" "MANUAL" "compromiso post-cierre"
  imprimir "H07-08" "HSTS sólo sobre HTTPS" "—" "MANUAL" "verificar redirección"
fi

# ════════════════════════════════════════════════════════════════════════════
# Resumen
# ════════════════════════════════════════════════════════════════════════════
echo
TOTAL=$((PASS+FAIL))
echo "Resumen: $PASS/$TOTAL aprobados, $FAIL suspendidos, $SKIP omitidos."
echo
echo "Casos MANUALES obligatorios para firmar:"
echo "  - H04-11: inspeccionar ai_logs y seguridad_ai_log_auditoria en Firestore."
echo "  - H05-01: verificar comportamiento sin CRON_SECRET (Preview limpio o code review)."
echo "  - H05-05: si no se confirmó arriba, ejecutar con sandbox SMTP."
echo "  - H07-06: observar Sentry ≥ 7 días buscando csp-report."
echo "  - H07-07: abrir PR para promover CSP a Enforce."
echo "  - H07-08: verificar redirección HTTPS."

[ "$FAIL" -eq 0 ] || exit 1
