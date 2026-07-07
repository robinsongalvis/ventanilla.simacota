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
