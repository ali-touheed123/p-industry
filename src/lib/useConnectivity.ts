'use client';

/**
 * src/lib/useConnectivity.ts
 *
 * Phase 4: Real Connectivity Detection Engine & State Manager
 *
 * Addresses:
 * - HIGH-01: False-positive online status caused by navigator.onLine during captive portal,
 *   dead gateway, or upstream server outage.
 * - MED-03: Lack of degraded network state detection.
 * - Task 4.6: Instant offline flip on write transport errors without waiting for periodic probe.
 */

import { useState, useEffect, useCallback } from 'react';

export type ConnectivityState = 'online' | 'offline' | 'degraded';

export interface ConnectivityInfo {
  state: ConnectivityState;
  isOnline: boolean;
  isOffline: boolean;
  isDegraded: boolean;
  lastCheckedAt: number | null;
  latencyMs: number | null;
  probeNow: () => Promise<boolean>;
  reportNetworkError: () => void;
  reportNetworkSuccess: () => void;
}

// Module-level singleton state shared across all hook consumers
let globalState: ConnectivityState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online';
let globalLastCheckedAt: number | null = null;
let globalLatencyMs: number | null = null;
let consecutiveFailures = 0;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.warn('[useConnectivity] Subscriber notification error:', err);
    }
  });
}

/**
 * Probes the server health endpoint with a strict 3000ms timeout.
 */
export async function probeHealth(endpoint: string = '/api/health'): Promise<{
  ok: boolean;
  latencyMs: number;
  status?: number;
}> {
  if (typeof window === 'undefined') {
    return { ok: true, latencyMs: 0 };
  }

  // Fast offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, latencyMs: 0, status: 0 };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (res.ok) {
      return { ok: true, latencyMs: latency, status: res.status };
    }
    return { ok: false, latencyMs: latency, status: res.status };
  } catch {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    return { ok: false, latencyMs: latency, status: 0 };
  }
}

/**
 * Manually report a write failure (e.g. from checkout or payment save).
 * Immediately shifts state to offline or degraded (Task 4.6).
 */
export function reportNetworkError(): void {
  consecutiveFailures++;
  globalLastCheckedAt = Date.now();
  if (consecutiveFailures >= 2) {
    globalState = 'offline';
  } else {
    globalState = 'degraded';
  }
  notifySubscribers();
}

/**
 * Manually report a successful network transaction.
 * Resets failure counters and restores state to online.
 */
export function reportNetworkSuccess(): void {
  consecutiveFailures = 0;
  globalLastCheckedAt = Date.now();
  if (globalState !== 'online') {
    globalState = 'online';
    notifySubscribers();
  }
}

/**
 * Executes an active connectivity probe and updates global state.
 */
export async function executeProbe(): Promise<boolean> {
  const result = await probeHealth();
  globalLastCheckedAt = Date.now();
  globalLatencyMs = result.latencyMs;

  if (result.ok) {
    consecutiveFailures = 0;
    // If latency is excessive (>1800ms), classify as degraded
    if (result.latencyMs > 1800) {
      globalState = 'degraded';
    } else {
      globalState = 'online';
    }
    notifySubscribers();
    return true;
  }

  consecutiveFailures++;
  if (consecutiveFailures >= 2 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    globalState = 'offline';
  } else {
    globalState = 'degraded';
  }
  notifySubscribers();
  return false;
}

/**
 * React hook for consuming real-time connectivity state.
 */
export function useConnectivity(options?: {
  onlineIntervalMs?: number;
  offlineIntervalMs?: number;
}): ConnectivityInfo {
  const onlineInterval = options?.onlineIntervalMs ?? 25000; // 25s while online
  const offlineInterval = options?.offlineIntervalMs ?? 7000;  // 7s while offline/degraded

  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((prev) => prev + 1);
    subscribers.add(update);
    return () => {
      subscribers.delete(update);
    };
  }, []);

  // Browser online/offline event handlers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBrowserOnline = () => {
      // Reconnected according to OS; immediately probe real health
      executeProbe();
    };

    const handleBrowserOffline = () => {
      globalState = 'offline';
      consecutiveFailures = 2;
      globalLastCheckedAt = Date.now();
      notifySubscribers();
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    // Initial probe on mount
    executeProbe();

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, []);

  // Periodic polling probe
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentInterval = globalState === 'online' ? onlineInterval : offlineInterval;
    const intervalId = setInterval(() => {
      executeProbe();
    }, currentInterval);

    return () => clearInterval(intervalId);
  }, [onlineInterval, offlineInterval]);

  const probeNow = useCallback(async () => {
    return await executeProbe();
  }, []);

  return {
    state: globalState,
    isOnline: globalState === 'online',
    isOffline: globalState === 'offline',
    isDegraded: globalState === 'degraded',
    lastCheckedAt: globalLastCheckedAt,
    latencyMs: globalLatencyMs,
    probeNow,
    reportNetworkError,
    reportNetworkSuccess,
  };
}

