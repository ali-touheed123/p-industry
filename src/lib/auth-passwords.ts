import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText) return '';
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored hash.
 * Supports legacy plain-text fallback during migration so existing accounts don't break.
 */
export async function verifyPassword(plainText: string, storedHash: string): Promise<boolean> {
  if (!plainText || !storedHash) return false;

  // If already bcrypt hash ($2a$ or $2b$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    return bcrypt.compare(plainText, storedHash);
  }

  // Fallback for unmigrated plain-text passwords
  return plainText === storedHash;
}
