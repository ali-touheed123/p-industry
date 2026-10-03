/**
 * Centralized JWT secrets and cookie constants.
 * Isolated from database clients to ensure full compatibility with Edge Middleware.
 */

export const SESSION_COOKIE_NAME = 'pyntflow_session';
export const DEV_ADMIN_COOKIE = 'aura_dev_token';

const MIN_SECRET_LENGTH = 32;

/**
 * Retrieves the cryptographic secret for user session JWTs.
 * Enforces mandatory high-entropy secret validation (min 32 characters) regardless of environment.
 */
export function getJwtSecret(): Uint8Array {
  const secret = (process.env.SESSION_SECRET || process.env.DEV_ADMIN_SECRET || '').trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `CRITICAL SECURITY ERROR: SESSION_SECRET environment variable is missing or insecure. It must be at least ${MIN_SECRET_LENGTH} characters long.`
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Retrieves the cryptographic secret for developer admin JWTs.
 * Enforces mandatory high-entropy secret validation (min 32 characters) regardless of environment.
 */
export function getDevSecret(): Uint8Array {
  const secret = (process.env.DEV_ADMIN_SECRET || process.env.SESSION_SECRET || '').trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `CRITICAL SECURITY ERROR: DEV_ADMIN_SECRET environment variable is missing or insecure. It must be at least ${MIN_SECRET_LENGTH} characters long.`
    );
  }
  return new TextEncoder().encode(secret);
}
