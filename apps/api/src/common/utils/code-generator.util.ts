import { randomInt } from 'node:crypto';

/**
 * Código corto de participante (SDD sección 8).
 *
 * - Longitud fija de 6 caracteres.
 * - Alfabeto de 30 símbolos; se excluyen `0, O, 1, I, L, U` para que el código
 *   sea fácil de dictar y de teclear en el registro manual.
 * - Se almacena siempre en mayúsculas y sin guion (`K7P3Q9`). El guion de la
 *   credencial (`K7P-3Q9`) es solo cosmético.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 6;

/** Separadores tolerados al digitar o leer un código (guion, espacio, punto). */
const SEPARATORS_PATTERN = /[\s\-_.]/g;
const VALID_CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/**
 * Normaliza la entrada del usuario: mayúsculas y sin separadores.
 * No descarta otros caracteres: un símbolo ajeno al alfabeto debe fallar la
 * validación en lugar de transformarse silenciosamente en otro código.
 */
export function normalizeShortCode(input: string | null | undefined): string {
  if (!input) return '';
  return String(input).toUpperCase().replace(SEPARATORS_PATTERN, '');
}

/** `true` si el valor (ya normalizado o no) es un código corto válido. */
export function isValidShortCode(input: string | null | undefined): boolean {
  return VALID_CODE_PATTERN.test(normalizeShortCode(input));
}

/** Presentación cosmética en la credencial: `K7P3Q9` → `K7P-3Q9`. */
export function formatShortCode(input: string | null | undefined): string {
  const code = normalizeShortCode(input);
  if (code.length !== CODE_LENGTH) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Genera un código aleatorio uniforme.
 * `crypto.randomInt` ya entrega valores sin sesgo de módulo, a diferencia de
 * `Math.random()`.
 */
export function generateShortCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Genera un código verificando que no exista, con reintentos ante la colisión
 * improbable y contra la carrera de dos creaciones simultáneas.
 */
export async function generateUniqueShortCode(
  isTaken: (code: string) => Promise<boolean> | boolean,
  maxAttempts = 25,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateShortCode();
    // eslint-disable-next-line no-await-in-loop -- la verificación debe ser secuencial
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error(
    `No fue posible generar un código corto único tras ${maxAttempts} intentos. Verifique el estado de la tabla de participantes.`,
  );
}
