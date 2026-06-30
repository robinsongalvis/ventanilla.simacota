#!/usr/bin/env bash
# UAT semiautomático H-02 — Notificación al ciudadano.
# Cubre SOLO casos negativos que NO envían correos:
#   H02-04, H02-05, H02-06, H02-07, H02-08, H02-09, H02-10, H02-11,
#   H02-12, H02-13, H02-19 (parcial), H02-20 (lado denegado).
#
# Los casos positivos (H02-01 a H02-03, H02-14 a H02-16, H02-20 lado autorizado)
# y los de inspección Firestore (H02-17, H02-18) son MANUALES. Este script no
# los reemplaza.
#
# Requisitos:
#   - bash, curl, jq
#   - Cookies de sesión obtenidas del Preview por el operador (DevTools → Application → Cookies → __session)
#   - SMTP sandbox configurado en Preview (aunque este script no envía, no asumimos)
#
# Uso mínimo:
#   export BASE_URL=https://ventanilla-simacota-git-<branch>.vercel.app
#   export SESSION_ADMIN=<cookie __session del ADMIN UAT>
#   export SESSION_RECEPCION=<cookie del RECEPCIONISTA UAT>
#   export SESSION_FUNC_PROPIO=<cookie del FUNCIONARIO SEC_GOBIERNO UAT>
#   export SESSION_FUNC_AJENO=<cookie del FUNCIONARIO SEC_PLANEACION UAT>
#   export SESSION_JEFE=<cookie del JEFE_DEPENDENCIA UAT>
#   export SESSION_CI=<cookie del CONTROL_INTERNO UAT>
#   export RADICADO_IDENT=1-WEB-2026-XXXXXXXX
#   export RADICADO_ANON=1-WEB-2026-XXXXXXXX
#   export RADICADO_RESERV=1-WEB-2026-XXXXXXXX
#   export RADICADO_SIN_CORREO=1-WEB-2026-XXXXXXXX
#   ./scripts/uat-h02.sh
#
# Cookies que no estén exportadas → casos correspondientes marcados OMITIDO.
# Genera tabla y veredicto final. No firma la matriz.

set -uo pipefail

# ── Configuración ────────────────────────────────────────────────────────────
: "${BASE_URL:?Configura BASE_URL apuntando al Preview de Vercel}"
: "${RADICADO_IDENT:?Configura RADICADO_IDENT (identificado con respuesta oficial)}"

RADICADO_INEXISTENTE="${RADICADO_INEXISTENTE:-1-WEB-2099-00099999}"
RADICADO_ANON="${RADICADO_ANON:-}"
RADICADO_RESERV="${RADICADO_RESERV:-}"
RADICADO_SIN_CORREO="${RADICADO_SIN_CORREO:-}"

SESSION_ADMIN="${SESSION_ADMIN:-}"
SESSION_RECEPCION="${SESSION_RECEPCION:-}"
SESSION_FUNC_PROPIO="${SESSION_FUNC_PROPIO:-}"
SESSION_FUNC_AJENO="${SESSION_FUNC_AJENO:-}"
SESSION_JEFE="${SESSION_JEFE:-}"
SESSION_CI="${SESSION_CI:-}"

if [[ "$BASE_URL" == *"ventanilla-simacota.vercel.app"* ]]; then
  echo "ABORTAR: BASE_URL apunta a producción. Usa el Preview del PR #18." >&2
  exit 2
fi
if ! command -v jq >/dev/null; then
  echo "ABORTAR: requiere 'jq' para validar bodies." >&2
  exit 2
fi

ENDPOINT="$BASE_URL/api/interno/notificar-ciudadano"
TMP_BODY=$(mktemp); TMP_HEAD=$(mktemp)
trap 'rm -f "$TMP_BODY" "$TMP_HEAD"' EXIT

PASS=0; FAIL=0; SKIP=0

# ── Helpers ──────────────────────────────────────────────────────────────────
post_notificar() {  # $1=cookie, $2=json body
  if [ -z "$1" ]; then echo "OMITIDO"; return; fi
  curl -sS -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Cookie: __session=$1" \
    -H "User-Agent: uat-h02-script/1.0" \
    -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" \
    --data "$2"
}
tiene_cache_no_store() {
  grep -i '^cache-control:' "$TMP_HEAD" | grep -qi 'no-store'
}
body_no_filtra_internos() {
  # No debe contener stack, hostname SMTP típico, ni el motivo enum (que vive en auditoría).
  ! grep -iE 'at /|Error:|stack|nodemailer|smtp|gmail|ECONNREFUSED|PAYLOAD_NO_PERMITIDO|ROL_NO_AUTORIZADO|DEPENDENCIA_NO_AUTORIZADA|CORREO_INVALIDO' "$TMP_BODY" >/dev/null
}
body_no_revela_destinatario() {  # $1=email a vigilar (puede estar vacío)
  if [ -z "${1:-}" ]; then return 0; fi
  ! grep -F "$1" "$TMP_BODY" >/dev/null
}
imprimir() {
  printf '%-7s | %-50s | %-10s | %-10s | %s\n' "$1" "$2" "$3" "$4" "$5"
}
veredicto() {
  if [ "$3" = "OMITIDO" ]; then SKIP=$((SKIP+1)); echo "OMITIDO"; return; fi
  if eval "$1"; then PASS=$((PASS+1)); echo "APROBADO";
  else FAIL=$((FAIL+1)); echo "SUSPENDIDO"; fi
}

# ── Cabecera ────────────────────────────────────────────────────────────────
echo
echo "UAT semiautomático H-02 — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Endpoint: $ENDPOINT"
echo "Casos cubiertos: negativos (no envían correos). Positivos H02-01..03,"
echo "  H02-14..16, H02-17, H02-18 y H02-20 (rama autorizada) son MANUALES."
echo
printf '%-7s | %-50s | %-10s | %-10s | %s\n' "Caso" "Esperado" "HTTP" "Veredicto" "Observación"
printf -- '--------+----------------------------------------------------+------------+------------+--------\n'

JSON_OK='{"radicadoId":"'"$RADICADO_IDENT"'","accion":"RESPUESTA_OFICIAL"}'

# ── H02-04: FUNCIONARIO cross-tenant ────────────────────────────────────────
HTTP=$(post_notificar "$SESSION_FUNC_AJENO" "$JSON_OK")
COND='[ "$HTTP" = "403" ] && tiene_cache_no_store && body_no_filtra_internos'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-04" "403 + no-store + sin motivo interno" "$HTTP" "$VEREDICTO" \
  "$(jq -r '.error // ""' "$TMP_BODY" 2>/dev/null)"

# ── H02-05: CONTROL_INTERNO ─────────────────────────────────────────────────
HTTP=$(post_notificar "$SESSION_CI" "$JSON_OK")
COND='[ "$HTTP" = "403" ] && tiene_cache_no_store && body_no_filtra_internos'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-05" "403 (ROL_NO_AUTORIZADO)" "$HTTP" "$VEREDICTO" \
  "$(jq -r '.error // ""' "$TMP_BODY" 2>/dev/null)"

# ── H02-06: JEFE_DEPENDENCIA ────────────────────────────────────────────────
HTTP=$(post_notificar "$SESSION_JEFE" "$JSON_OK")
COND='[ "$HTTP" = "403" ] && tiene_cache_no_store && body_no_filtra_internos'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-06" "403 (ROL_NO_AUTORIZADO)" "$HTTP" "$VEREDICTO" \
  "$(jq -r '.error // ""' "$TMP_BODY" 2>/dev/null)"

# ── H02-07: sin sesión ──────────────────────────────────────────────────────
HTTP=$(curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -D "$TMP_HEAD" -o "$TMP_BODY" -w "%{http_code}" \
  --data "$JSON_OK")
COND='[ "$HTTP" = "401" ] && tiene_cache_no_store'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-07" "401 sin sesión" "$HTTP" "$VEREDICTO" \
  "$(jq -r '.error // ""' "$TMP_BODY" 2>/dev/null)"

# ── H02-08: radicado inexistente ────────────────────────────────────────────
HTTP=$(post_notificar "$SESSION_ADMIN" \
  '{"radicadoId":"'"$RADICADO_INEXISTENTE"'","accion":"RESPUESTA_OFICIAL"}')
COND='[ "$HTTP" = "404" ] && tiene_cache_no_store && body_no_filtra_internos'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-08" "404 sin filtrar motivo interno" "$HTTP" "$VEREDICTO" \
  "$(jq -r '.error // ""' "$TMP_BODY" 2>/dev/null)"

# ── H02-09: anónimo ─────────────────────────────────────────────────────────
if [ -n "$RADICADO_ANON" ]; then
  HTTP=$(post_notificar "$SESSION_ADMIN" \
    '{"radicadoId":"'"$RADICADO_ANON"'","accion":"RESPUESTA_OFICIAL"}')
  COND='[ "$HTTP" = "400" ] && tiene_cache_no_store && body_no_filtra_internos'
  VEREDICTO=$(veredicto "$COND" "" "$HTTP")
else
  VEREDICTO="OMITIDO"; SKIP=$((SKIP+1)); HTTP="—"
fi
imprimir "H02-09" "400 anónimo no genera correo" "$HTTP" "$VEREDICTO" \
  "${RADICADO_ANON:-RADICADO_ANON no exportado}"

# ── H02-10: reservado ───────────────────────────────────────────────────────
if [ -n "$RADICADO_RESERV" ]; then
  HTTP=$(post_notificar "$SESSION_ADMIN" \
    '{"radicadoId":"'"$RADICADO_RESERV"'","accion":"RESPUESTA_OFICIAL"}')
  COND='[ "$HTTP" = "400" ] && tiene_cache_no_store && body_no_filtra_internos'
  VEREDICTO=$(veredicto "$COND" "" "$HTTP")
else
  VEREDICTO="OMITIDO"; SKIP=$((SKIP+1)); HTTP="—"
fi
imprimir "H02-10" "400 reservado no genera correo" "$HTTP" "$VEREDICTO" \
  "${RADICADO_RESERV:-RADICADO_RESERV no exportado}"

# ── H02-11: sin correo válido ───────────────────────────────────────────────
if [ -n "$RADICADO_SIN_CORREO" ]; then
  HTTP=$(post_notificar "$SESSION_ADMIN" \
    '{"radicadoId":"'"$RADICADO_SIN_CORREO"'","accion":"RESPUESTA_OFICIAL"}')
  COND='[ "$HTTP" = "400" ] && tiene_cache_no_store && body_no_filtra_internos'
  VEREDICTO=$(veredicto "$COND" "" "$HTTP")
else
  VEREDICTO="OMITIDO"; SKIP=$((SKIP+1)); HTTP="—"
fi
imprimir "H02-11" "400 correo inválido" "$HTTP" "$VEREDICTO" \
  "${RADICADO_SIN_CORREO:-RADICADO_SIN_CORREO no exportado}"

# ── H02-12: payload con 'destinatario' libre ────────────────────────────────
ATAQUE_EMAIL="atacante.h02@example.test"
HTTP=$(post_notificar "$SESSION_ADMIN" \
  '{"radicadoId":"'"$RADICADO_IDENT"'","destinatario":"'"$ATAQUE_EMAIL"'"}')
COND='[ "$HTTP" = "403" ] && tiene_cache_no_store && body_no_filtra_internos && body_no_revela_destinatario "$ATAQUE_EMAIL"'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-12" "403 + no revela destinatario inyectado" "$HTTP" "$VEREDICTO" \
  "$(jq -r '.error // ""' "$TMP_BODY" 2>/dev/null)"

# ── H02-13: payload con asunto/mensaje/html/nota/tenantId libres ────────────
TODO_OK=true
DETALLE=""
for CAMPO in asunto mensaje html nota tenantId; do
  HTTP=$(post_notificar "$SESSION_ADMIN" \
    '{"radicadoId":"'"$RADICADO_IDENT"'","'"$CAMPO"'":"intento_libre"}')
  if [ "$HTTP" != "403" ] || ! tiene_cache_no_store; then
    TODO_OK=false
    DETALLE="$DETALLE $CAMPO=$HTTP"
  fi
done
COND='$TODO_OK'
VEREDICTO=$(veredicto "$COND" "" "403")
imprimir "H02-13" "403 para asunto/mensaje/html/nota/tenantId" "5×403" "$VEREDICTO" \
  "${DETALLE:-todos 403}"

# ── H02-19: parcial — body no expone stack ni motivo enum (cubierto arriba) ─
imprimir "H02-19" "parcial: bodies sin stack/SMTP/motivo enum" "—" "Cubierto-por-04..13" "Inspección manual obligatoria"

# ── H02-20 (rama denegada): REINTENTO con CONTROL_INTERNO ───────────────────
HTTP=$(post_notificar "$SESSION_CI" \
  '{"radicadoId":"'"$RADICADO_IDENT"'","accion":"REINTENTO_NOTIFICACION"}')
COND='[ "$HTTP" = "403" ] && tiene_cache_no_store'
VEREDICTO=$(veredicto "$COND" "" "$HTTP")
imprimir "H02-20" "REINTENTO con CI → 403" "$HTTP" "$VEREDICTO" \
  "rama autorizada (FUNCIONARIO propio) es MANUAL"

# ── Resumen ─────────────────────────────────────────────────────────────────
echo
TOTAL=$((PASS+FAIL))
echo "Resumen: $PASS/$TOTAL aprobados, $FAIL suspendidos, $SKIP omitidos por cookies/radicados faltantes."
echo
echo "Esto es evidencia técnica parcial. El responsable UAT debe además:"
echo "  1. Ejecutar manualmente H02-01..03, H02-14..16, H02-20 (rama autorizada)."
echo "  2. Inspeccionar el sandbox SMTP para H02-14, H02-15."
echo "  3. Inspeccionar Firestore 'seguridad_notificaciones_auditoria' para H02-17."
echo "  4. Inspeccionar subcolección 'trazabilidad' del radicado para H02-18."
echo "  5. Firmar la matriz docs/UAT_SEGURIDAD_H02_NOTIFICACION_CIUDADANO.md."

[ "$FAIL" -eq 0 ] || exit 1
