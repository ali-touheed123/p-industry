/**
 * @file src/lib/utils.ts
 * Shared backend utility functions for PyntFlow API routes.
 */

import { supabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// FINDING-API-007 / FINDING-API-008
// PostgREST ilike / .or() Injection Sanitizer
// ---------------------------------------------------------------------------
// PostgREST interprets special characters in filter values (e.g. '*', '(', ')',
// '.', ',', '%', '_') as wildcards or meta-syntax. A malicious caller could
// craft a search term that escapes the intended filter expression and reads
// data across tenants or disrupts query structure.
//
// sanitizePostgRESTLike() strips all characters that have special meaning in
// PostgREST filter expressions before they are interpolated into .ilike() or
// .or() calls, leaving only safe alphanumeric / space / hyphen / slash chars.
// ---------------------------------------------------------------------------

/** Characters that PostgREST treats as meta-syntax inside filter expressions. */
const POSTGREST_META_CHARS = /[*()\[\]{}.,!\\^$|?+:;%<>"'`]/g;

/**
 * Strip PostgREST meta-characters from a search string.
 * Safe to use as the argument to .ilike() or embedded inside .or() expressions.
 *
 * @param input - Raw user-supplied search string.
 * @param maxLen - Maximum allowed length of the sanitized output (default 120).
 * @returns Sanitized string, trimmed and capped at maxLen characters.
 */
export function sanitizePostgRESTLike(input: string | null | undefined, maxLen = 120): string {
  if (!input) return '';
  return input
    .replace(POSTGREST_META_CHARS, '')  // strip meta-characters
    .trim()
    .slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// FINDING-API-013
// Unique Code Generator with Collision Retry
// ---------------------------------------------------------------------------
// The original code generators (CL-XXXX, SUP-XXXX, RCP-XXXX etc.) used a
// single Math.random() call with no collision detection. In a system with
// thousands of clients/suppliers the 4-digit space (9000 values) gives a
// ~50% collision probability at roughly 3700 existing records (Birthday
// Problem). Duplicate codes break unique indexes and cause silent insert
// failures.
//
// generateUniqueCode() retries up to `maxAttempts` times, checking the DB
// for collisions before returning, ensuring the generated code is globally
// unique within the scoped table column.
// ---------------------------------------------------------------------------

/**
 * Generate a unique prefixed numeric code (e.g. "CL-4821") that does not
 * already exist in the specified Supabase table/column.
 *
 * @param prefix     - Short uppercase string prefix (e.g. "CL", "SUP", "RCP").
 * @param table      - Supabase table to check for collision.
 * @param column     - Column name that holds the code (default "code").
 * @param tenantId   - Optional tenant_id scope for the uniqueness check.
 * @param digits     - Number of random decimal digits (default 4 → range 1000–9999).
 * @param maxAttempts - Maximum retry attempts before falling back to timestamp.
 * @returns A code string guaranteed unique within the specified scope.
 */
export async function generateUniqueCode(
  prefix: string,
  table: string,
  column = 'code',
  tenantId: string | null = null,
  digits = 4,
  maxAttempts = 10
): Promise<string> {
  const rangeMin = Math.pow(10, digits - 1);          // e.g. 1000 for digits=4
  const rangeSize = Math.pow(10, digits) - rangeMin;  // e.g. 9000 for digits=4

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const numeric = Math.floor(rangeMin + Math.random() * rangeSize);
    const candidate = `${prefix}-${numeric}`;

    let query = (supabaseAdmin as any)
      .from(table)
      .select(column, { count: 'exact', head: true })
      .eq(column, candidate);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { count } = await query;
    if (count === 0) {
      return candidate;
    }
  }

  // Fallback: use millisecond timestamp to guarantee uniqueness
  return `${prefix}-${Date.now()}`;
}
