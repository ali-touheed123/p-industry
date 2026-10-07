import { supabaseAdmin } from './supabase';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const tracker = new Map<string, RateLimitRecord>();

/**
 * Cold-start resistant rate limiter using Supabase PostgreSQL persistent store
 * with in-memory fallback for emergency resilience.
 * Task 13.1.3 (MF-SEC-001)
 */
export async function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit_atomic', {
      p_key: ip,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    });

    if (!error && data) {
      return {
        success: Boolean(data.allowed),
        remaining: Number(data.remaining ?? 0),
        retryAfterSec: Number(data.retry_after_sec ?? 0),
      };
    }
  } catch (err) {
    console.warn('[RateLimit] Database rate limit check failed, falling back to local memory store', err);
  }

  // Fallback to in-memory sliding window tracker if DB is unavailable
  const now = Date.now();
  const record = tracker.get(ip);

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
 * Resets rate limit for an IP upon successful authentication.
 */
export async function resetRateLimit(ip: string) {
  tracker.delete(ip);
  try {
    await supabaseAdmin.rpc('reset_rate_limit_atomic', { p_key: ip });
  } catch (err) {
    console.warn('[RateLimit] Database rate limit reset failed', err);
  }
}
