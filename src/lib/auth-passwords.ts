import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText) return '';
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export interface VerifyPasswordOptions {
  /**
   * Deprecated transitional fallback for legacy plain-text passwords.
   * If true, plain-text comparison is evaluated and a warning is logged so the caller can rehash.
   * Defaults to false (strict bcrypt only).
   */
  allowLegacyMigration?: boolean;
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Enforces strict bcrypt hash validation ($2a$ or $2b$).
 * Legacy plain-text fallback is strictly rejected by default to prevent authentication bypass.
 */
export async function verifyPassword(
  plainText: string,
  storedHash: string,
  options?: VerifyPasswordOptions
): Promise<boolean> {
  if (!plainText || !storedHash) return false;

  // If already bcrypt hash ($2a$ or $2b$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    return bcrypt.compare(plainText, storedHash);
  }

  // Deprecated fallback: ONLY if explicitly permitted during auto-migration hook
  if (options?.allowLegacyMigration) {
    console.warn('[SECURITY DEPRECATION] Plain-text password comparison encountered for legacy account. Auto-rehash required.');
    return plainText === storedHash;
  }

  // Strict mode: plain-text passwords cannot authenticate
  return false;
}

/**
 * Checks if a stored password hash requires upgrading to bcrypt.
 */
export function isLegacyPasswordHash(storedHash: string): boolean {
  if (!storedHash) return false;
  return !storedHash.startsWith('$2a$') && !storedHash.startsWith('$2b$');
}
