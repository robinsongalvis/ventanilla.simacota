/* ══════════════════════════════════════════════════════════════
   debeNotificarCiudadano — Regla única de privacidad y entrega

   Función pura y centralizada que decide si un radicado dado
   puede recibir notificaciones por correo electrónico. La usan
   TODOS los hooks de notificación (radicación, asignación,
   prórroga, respuesta oficial) para garantizar que un radicado
   anónimo NUNCA reciba correo aunque alguien haya guardado un
   email por error o por una versión previa del formulario.

   Reglas:
   1. `esAnonimo === true` → bloquea sin importar el email.
   2. `tipoPresentacion === 'ANONIMA'` → bloquea sin importar el email.
   3. Email vacío, inválido, o de la lista de placeholders → bloquea.
   4. Caso contrario → permite.

   La función es independiente del canal de respuesta: incluso si
   el ciudadano eligió respuesta presencial/telefónica, las
   notificaciones de estado son cortesía informativa y se envían
   si hay un correo válido.
══════════════════════════════════════════════════════════════ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Direcciones que nunca deben recibir correo aunque queden persistidas. */
const EMAIL_PLACEHOLDERS = new Set<string>([
  'anonimo@simacota.gov.co',
  'noreply@simacota.gov.co',
  'no-reply@simacota.gov.co',
  'sin-correo@simacota.gov.co',
  'reservado@simacota.gov.co',
]);

/**
 * Sub-tipo mínimo necesario para decidir si notificar. Acepta un
 * `VentanillaRadicado` completo o un payload aplastado equivalente.
 */
export interface CriterioNotificacion {
  esAnonimo?: boolean;
  tipoPresentacion?: 'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA';
  solicitante?: {
    email?: string | null;
  };
}

export function debeNotificarCiudadano(radicado: CriterioNotificacion): boolean {
  if (radicado.esAnonimo === true) return false;
  if (radicado.tipoPresentacion === 'ANONIMA') return false;

  const email = radicado.solicitante?.email?.trim().toLowerCase();
  if (!email) return false;
  if (!EMAIL_RE.test(email)) return false;
  if (EMAIL_PLACEHOLDERS.has(email)) return false;

  return true;
}
