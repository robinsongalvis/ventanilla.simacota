/* ══════════════════════════════════════════════════════════════
   Destino tras iniciar sesión (enlaces directos, ADR-0046 §7).

   Quien abre sin sesión un enlace interno (p. ej.
   `/interno/dashboard?vista=licencias&expediente=…` o el enlace a
   Licencias de un correo) pasa por el login y debe volver EXACTAMENTE ahí,
   parámetros incluidos. Única regla, compartida por el layout interno y el
   formulario de login: solo rutas de `/interno/`, nunca externas ni la
   propia página de login (evita redirecciones abiertas y bucles).
══════════════════════════════════════════════════════════════ */

export const DESTINO_POR_DEFECTO = '/interno/dashboard';

/** Origen ficticio solo para resolver y validar; nunca se navega a él. */
const ORIGEN_VALIDACION = 'http://destino.invalid';

/**
 * Valida el parámetro `next` y devuelve un destino interno seguro.
 *
 * Se valida la URL YA RESUELTA (`..`, `%2e%2e`, `\`, tabuladores), que es
 * lo que harán `new URL()` en el proxy y `router.replace()` en el cliente, y
 * se devuelve esa misma forma normalizada: lo validado es exactamente lo que
 * se navega. Validar el texto crudo permitía salir del panel con
 * `/interno/../consulta` o `/interno/..//evil.com` (revisión de seguridad
 * del 24-sep-2026).
 */
export function destinoTrasLogin(next: string | null | undefined): string {
  if (!next || !next.startsWith('/interno/')) return DESTINO_POR_DEFECTO;
  let url: URL;
  try {
    url = new URL(next, ORIGEN_VALIDACION);
  } catch {
    return DESTINO_POR_DEFECTO;
  }
  if (url.origin !== ORIGEN_VALIDACION || !url.pathname.startsWith('/interno/')) return DESTINO_POR_DEFECTO;
  // `//` y la barra final no disfrazan la página de login (saltos de más).
  if (url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') === '/interno/login') return DESTINO_POR_DEFECTO;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Dirección de login que vuelve a la ruta actual con sus parámetros. */
export function urlLoginConRetorno(pathname: string, search: string): string {
  return `/interno/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}
