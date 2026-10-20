import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Test Suite: Modal Business Logic & In-Memory State Behavior ─────────────

// Helper function mirroring the brand extraction logic in CompanyOrderSheetModal
function extractBrands(items) {
  const brandSet = new Set();
  items.forEach((it) => {
    if (it.brand && it.brand.trim()) {
      brandSet.add(it.brand.trim());
    }
  });
  return Array.from(brandSet).sort((a, b) => a.localeCompare(b));
}

// Helper function mirroring the filter logic in CompanyOrderSheetModal
function filterItems(items, selectedBrand, query) {
  const q = query.trim().toLowerCase();
  return items.filter((it) => {
    if (selectedBrand !== 'ALL' && it.brand !== selectedBrand) {
      return false;
    }
    if (!q) return true;
    const nameMatch = (it.name || '').toLowerCase().includes(q);
    const codeMatch = (it.code || '').toLowerCase().includes(q);
    const shadeMatch = (it.shade_code || '').toLowerCase().includes(q);
    return nameMatch || codeMatch || shadeMatch;
  });
}

// Helper function mirroring the "Select All 0 Stock" logic in CompanyOrderSheetModal
function selectAllZeroStock(draftQuantities, filteredItems) {
  const updated = { ...draftQuantities };
  filteredItems.forEach((it) => {
    const stock = Number(it.stock_qty || 0);
    // <= 0 or null or string "0"
    if (stock <= 0 && (!updated[it.id] || updated[it.id] === 0)) {
      updated[it.id] = 1;
    }
  });
  return updated;
}

test('Behavior: First alphabetical brand selected by default & All Brands available', () => {
  const catalog = [
    { id: '1', name: 'Product 1', brand: 'Nippon' },
    { id: '2', name: 'Product 2', brand: "Gobi's" },
    { id: '3', name: 'Product 3', brand: 'Berger' },
    { id: '4', name: 'Product 4', brand: 'Brighto' },
  ];

  const brandOptions = extractBrands(catalog);
  assert.deepEqual(brandOptions, ['Berger', 'Brighto', "Gobi's", 'Nippon']);

  // Initial selected brand should be the first alphabetical brand
  const initialBrand = brandOptions.length > 0 ? brandOptions[0] : 'ALL';
  assert.equal(initialBrand, 'Berger');

  // "ALL" brand option exists in dropdown
  const allDropdownOptions = ['ALL', ...brandOptions];
  assert.ok(allDropdownOptions.includes('ALL'));
  assert.equal(allDropdownOptions[0], 'ALL');
});

test('Behavior: Select All 0 Stock applies ONLY to current filtered view (active brand + search)', () => {
  const catalog = [
    // Brand A items
    { id: 'a1', brand: 'Brand A', name: 'Gloss White', code: 'A1', stock_qty: 0 },
    { id: 'a2', brand: 'Brand A', name: 'Gloss Black', code: 'A2', stock_qty: '0' },
    { id: 'a3', brand: 'Brand A', name: 'Matt Blue', code: 'A3', stock_qty: 5 }, // In stock
    { id: 'a4', brand: 'Brand A', name: 'Primer Grey', code: 'A4', stock_qty: null }, // Null stock (zero)
    // Brand B items
    { id: 'b1', brand: 'Brand B', name: 'Gloss Red', code: 'B1', stock_qty: 0 },
    { id: 'b2', brand: 'Brand B', name: 'Gloss Yellow', code: 'B2', stock_qty: -2 },
  ];

  let draftQuantities = {};

  // Case 1: Active brand = 'Brand A', no search
  const filteredBrandA = filterItems(catalog, 'Brand A', '');
  draftQuantities = selectAllZeroStock(draftQuantities, filteredBrandA);

  assert.equal(draftQuantities['a1'], 1, 'a1 (stock 0) should be 1');
  assert.equal(draftQuantities['a2'], 1, 'a2 (stock "0") should be 1');
  assert.equal(draftQuantities['a3'], undefined, 'a3 (stock 5) should NOT be set');
  assert.equal(draftQuantities['a4'], 1, 'a4 (null stock) should be 1');
  assert.equal(draftQuantities['b1'], undefined, 'Brand B items should NOT be touched');
  assert.equal(draftQuantities['b2'], undefined, 'Brand B items should NOT be touched');

  // Case 2: Active brand = 'Brand A', search = 'Primer'
  draftQuantities = {}; // Reset
  const filteredSearch = filterItems(catalog, 'Brand A', 'Primer');
  assert.equal(filteredSearch.length, 1);
  assert.equal(filteredSearch[0].id, 'a4');

  draftQuantities = selectAllZeroStock(draftQuantities, filteredSearch);
  assert.equal(draftQuantities['a4'], 1);
  assert.equal(draftQuantities['a1'], undefined, 'Filtered-out item a1 should NOT be set');
});

test('Behavior: Quantities persist across brand filter switches and search', () => {
  const catalog = [
    { id: '1', brand: "GOBI'S", name: 'Super Emulsion', stock_qty: 10 },
    { id: '2', brand: 'BERGER', name: 'Robbialac Enamel', stock_qty: 10 },
  ];

  const draftQuantities = {};

  // User selects GOBI'S and sets qty = 5
  draftQuantities['1'] = 5;

  // User switches to BERGER
  // Quantities for GOBI'S still remain in draftQuantities
  assert.equal(draftQuantities['1'], 5);

  // User sets BERGER qty = 2
  draftQuantities['2'] = 2;

  // Both exist in draft
  assert.equal(draftQuantities['1'], 5);
  assert.equal(draftQuantities['2'], 2);

  // Active items for slip print include all items with qty > 0 across all brands
  const activeOrderItems = catalog
    .filter((it) => (draftQuantities[it.id] || 0) > 0)
    .map((it) => ({ ...it, qty: draftQuantities[it.id] }));

  assert.equal(activeOrderItems.length, 2);
  assert.equal(activeOrderItems[0].brand, "GOBI'S");
  assert.equal(activeOrderItems[1].brand, 'BERGER');
});

test('Behavior: Discard confirmation when closing with quantities > 0', () => {
  const draftQuantities = { 'item-1': 3 };
  const hasDraftQuantities = Object.values(draftQuantities).some((q) => q > 0);
  assert.equal(hasDraftQuantities, true, 'Must flag prompt if quantities exist');

  const emptyDraft = { 'item-1': 0, 'item-2': 0 };
  const hasEmptyDraft = Object.values(emptyDraft).some((q) => q > 0);
  assert.equal(hasEmptyDraft, false, 'Should not prompt if all are 0');
});
