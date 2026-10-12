/**
 * Transformaciones para valores que llegan como texto (query string,
 * `multipart/form-data`) y deben comportarse como tipos reales.
 */

/**
 * `true`/`false`/`1`/`0`/`si`/`no` → booleano.
 * `Boolean("false")` es `true`, por eso no se usa el constructor.
 */
export const toBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return value as boolean;
};

/** Recorta un texto y lo convierte en `null` cuando queda vacío. */
export const emptyToNull = ({ value }: { value: unknown }): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};
