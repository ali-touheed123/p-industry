import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Phase 4.1: Lightweight health check endpoint for real connectivity probing.
 * Supports quick GET/HEAD probes with zero authentication overhead.
 * Optional `?db=1` query parameter tests database ping with a strict 2s timeout.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkDb = url.searchParams.get('db') === '1';

  if (checkDb) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.from('tenants').select('id').limit(1).abortSignal(controller.signal);
      clearTimeout(timeoutId);

      if (error) {
        return NextResponse.json(
          { ok: false, error: 'Database ping failed', ts: Date.now() },
          {
            status: 503,
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Pragma': 'no-cache',
            },
          }
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Database timeout', ts: Date.now() },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );
    }
  }

  return NextResponse.json(
    { ok: true, ts: Date.now() },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    }
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

