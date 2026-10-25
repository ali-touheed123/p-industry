/**
 * Walk-in customer naming.
 * A sale without a registered customer account must carry a typed walk-in name, stored as
 * "<name> (WI)" so receipts, the Sales list and CEO reports all show it is a walk-in.
 */
export const WALK_IN_SUFFIX = ' (WI)';
const SUFFIX_RE = /\s*\(WI\)\s*$/i;

/** Typed walk-in name -> stored/display name. Empty input stays empty. */
export function formatWalkInName(raw: string | null | undefined): string {
  const name = String(raw ?? '').replace(SUFFIX_RE, '').trim();
  return name ? `${name}${WALK_IN_SUFFIX}` : '';
}

/** Stored name -> editable name (used when loading a saved/held bill back into POS). */
export function stripWalkInSuffix(raw: string | null | undefined): string {
  return String(raw ?? '').replace(SUFFIX_RE, '').trim();
}

/** Legacy placeholder names that must not count as a real walk-in name. */
export function isPlaceholderWalkInName(raw: string | null | undefined): boolean {
  const n = stripWalkInSuffix(raw).toLowerCase();
  return !n || n === 'walk-in customer' || n === 'walk in customer' || n === 'walk-in' || n === 'walkin' || n === 'walk in';
}
