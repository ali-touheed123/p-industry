/**
 * src/lib/fetchWithTimeout.ts
 *
 * Phase 2.1: Unified fetch helper with timeout and typed network error classification.
 * Distinguishes "no internet / timeout / offline" from "server responded with rejection".
 */

export class NetworkTimeoutError extends Error {
  timeoutMs: number;
  constructor(message?: string, timeoutMs: number = 20000) {
    super(message || `Request timed out after ${timeoutMs / 1000}s. Please check your network.`);
    this.name = 'NetworkTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class NetworkConnectionError extends Error {
  originalError?: unknown;
  constructor(message?: string, originalError?: unknown) {
    super(message || 'Network connection failed. Server is unreachable.');
    this.name = 'NetworkConnectionError';
    this.originalError = originalError;
  }
}

export function isNetworkOrTimeoutError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof NetworkTimeoutError || err instanceof NetworkConnectionError) return true;
  if (typeof err === 'object') {
    const e = err as { name?: string; message?: string };
    if (e.name === 'NetworkTimeoutError' || e.name === 'NetworkConnectionError') return true;
    if (e.name === 'AbortError') return true;
    if (e.name === 'TypeError' && typeof e.message === 'string' && /fetch|network|failed/i.test(e.message)) {
      return true;
    }
    if (typeof e.message === 'string' && /Failed to fetch|NetworkError|net::ERR|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(e.message)) {
      return true;
    }
  }
  return false;
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Executes a fetch request with an automatic timeout.
 * Throws NetworkTimeoutError if timeout expires.
 * Throws NetworkConnectionError if network fails (offline, connection refused, DNS fail).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 20000, signal: callerSignal, ...fetchOptions } = options;

  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
  }

  try {
    const res = await fetch(input, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    if (timedOut) {
      const endpoint = typeof input === 'string' ? input : input instanceof URL ? input.pathname : 'endpoint';
      throw new NetworkTimeoutError(
        `Request to ${endpoint} timed out after ${timeoutMs / 1000} seconds.`,
        timeoutMs
      );
    }
    if (callerSignal?.aborted) {
      throw err;
    }
    if (
      (err as { name?: string })?.name === 'TypeError' ||
      /fetch|network|offline/i.test((err as { message?: string })?.message || '')
    ) {
      const endpoint = typeof input === 'string' ? input : input instanceof URL ? input.pathname : 'server';
      throw new NetworkConnectionError(
        `Network error reaching ${endpoint}: ${(err as Error)?.message || 'Connection lost'}`,
        err
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

