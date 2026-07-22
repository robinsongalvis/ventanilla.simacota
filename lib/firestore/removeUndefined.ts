export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

/**
 * Solo los objetos planos (literales) se clonan y filtran. Las
 * instancias de clase — FieldValue.delete(), Timestamp, Date… — pasan
 * intactas: clonarlas con Object.fromEntries las convertía en `{}` y
 * ese objeto vacío terminaba ESCRITO en Firestore en lugar del
 * sentinel (causa raíz del React #31 en el panel).
 */
function esObjetoPlano(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep) as T;
  }

  if (value && typeof value === 'object') {
    if (!esObjetoPlano(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, removeUndefinedDeep(nested)]),
    ) as T;
  }

  return value;
}

/**
 * Pieza angular (P2.1, Fase 2) — política de sanitización "null explícito",
 * movida aquí desde `lib/actions/radicarVentanilla.ts` para que la nueva
 * ruta `app/api/radicacion/interna/route.ts` la reutilice sin duplicar la
 * lógica (Principio 3 — reutilización por defecto). Comportamiento IDÉNTICO
 * al original: convierte recursivamente cada `undefined` a `null`
 * CONSERVANDO la clave — en vez de eliminarla como hace `removeUndefinedDeep`.
 * Es la contraparte "ausente" de este mismo módulo; ambas conviven a
 * propósito (decisión de la revisión cruzada firestore-datos del blueprint
 * v2: la unificación null-vs-ausente NO se resuelve en Fase 1 salvo para el
 * endpoint NUEVO de Fase 2, que adopta esta política explícitamente).
 *
 * Firestore: acepta `null` ✅ — rechaza `undefined` ❌
 */
export function sanitizeFirestoreData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      sanitized[key] = null;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeFirestoreData(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item !== null && typeof item === 'object'
          ? sanitizeFirestoreData(item as Record<string, unknown>)
          : item ?? null,
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
