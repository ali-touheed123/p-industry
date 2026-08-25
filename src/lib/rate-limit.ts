interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const tracker = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding window rate limiter for login & sensitive endpoints.
 * Max 5 failed/total attempts per 5 minutes per IP address.
 */
export function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const record = tracker.get(ip);

  // Clean up expired entries periodically
  if (tracker.size > 5000) {
    for (const [key, val] of tracker.entries()) {
      if (now > val.resetAt) tracker.delete(key);
    }
  }

  if (!record || now > record.resetAt) {
    tracker.set(ip, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxAttempts - 1, retryAfterSec: 0 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { success: false, remaining: 0, retryAfterSec };
  }

  record.count += 1;
  return { success: true, remaining: maxAttempts - record.count, retryAfterSec: 0 };
}

/**
 * Resets rate limit for an IP upon successful login.
 */
export function resetRateLimit(ip: string) {
  tracker.delete(ip);
}
