/**
 * High-performance, relevance-ranked product search utility.
 * Designed for POS Billing, Purchases, Inventory, and Order Sheets.
 *
 * Ranking Tiers:
 * 1. Exact Barcode / SKU Code match
 * 2. Code starts with query
 * 3. Exact Name match
 * 4. Name starts with query
 * 5. Any word in Name starts with query (word-boundary match)
 * 6. Code contains query
 * 7. Name contains query
 * 8. Exact Shade Code / starts with Shade Code
 * 9. Brand match
 * 10. Category match (lowest priority, so category names don't overshadow actual products)
 */

export interface SearchableItem {
  id: string;
  name: string;
  code: string;
  category?: string;
  brand?: string;
  shade_code?: string;
  pack_size?: string;
  unit?: string;
  [key: string]: any;
}

export interface ProductSearchOptions {
  limit?: number;
}

export function rankProducts<T extends SearchableItem>(
  items: T[],
  rawQuery?: string | null,
  options?: ProductSearchOptions
): T[] {
  if (!items || items.length === 0) return [];
  if (!rawQuery || !rawQuery.trim()) return [];

  const limit = options?.limit ?? 40;
  const q = rawQuery.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return [];

  const scored: { item: T; score: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const code = (item.code || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const shade = (item.shade_code || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const pack = (item.pack_size || item.unit || '').toLowerCase();

    // Multi-token check: every token must be found in at least one field
    let matchesAllTokens = true;
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (
        !code.includes(token) &&
        !name.includes(token) &&
        !shade.includes(token) &&
        !brand.includes(token) &&
        !cat.includes(token) &&
        !pack.includes(token)
      ) {
        matchesAllTokens = false;
        break;
      }
    }

    if (!matchesAllTokens) continue;

    // Calculate relevance score (lower score = higher priority / better rank)
    let score = 1000;

    if (code === q) {
      score = 10; // Exact SKU / barcode match
    } else if (code.startsWith(q)) {
      score = 20; // Code starts with search query
    } else if (name === q) {
      score = 30; // Exact product name match
    } else if (name.startsWith(q)) {
      score = 40; // Name starts with search query
    } else {
      // Check if any individual word in product name starts with the search query
      const words = name.split(/\s+/);
      const wordStartsWith = words.some((w) => w.startsWith(q));
      if (wordStartsWith) {
        score = 50;
      } else if (code.includes(q)) {
        score = 60; // Code contains search query
      } else if (name.includes(q)) {
        score = 70; // Name contains search query
      } else if (shade === q || shade.startsWith(q)) {
        score = 75; // Shade code exact/prefix
      } else if (brand === q || brand.startsWith(q)) {
        score = 80; // Brand exact/prefix
      } else if (shade.includes(q)) {
        score = 85; // Shade code contains query
      } else if (brand.includes(q)) {
        score = 90; // Brand contains query
      } else if (pack.includes(q)) {
        score = 95; // Pack size/unit contains query
      } else if (cat.includes(q)) {
        score = 100; // Category match (lowest rank to prevent unrelated items flooding)
      } else {
        score = 110;
      }
    }

    // Boost multi-token queries where tokens reside in name or code rather than just category
    if (tokens.length > 1) {
      const allInNameOrCode = tokens.every(
        (t) => name.includes(t) || code.includes(t)
      );
      if (allInNameOrCode) {
        score -= 15;
      }
    }

    scored.push({ item, score });
  }

  // Sort by score ascending (lowest score first)
  scored.sort((a, b) => a.score - b.score);

  const results: T[] = [];
  const maxResults = Math.min(scored.length, limit);
  for (let i = 0; i < maxResults; i++) {
    results.push(scored[i].item);
  }

  return results;
}
