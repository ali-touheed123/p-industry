/**
 * scripts/test-phase3-cart-draft-store.mjs
 *
 * Phase 3 Unit Tests: Cart Auto-Save & Recovery Store
 *
 * Validates:
 * 1. Scoped localStorage key generation by tenantId:branchId:userId (Task 3.2)
 * 2. Save, load, and clear lifecycle for in-progress cart (Tasks 3.1 & 3.3)
 * 3. Cross-user and cross-branch security isolation (Task 3.2 & 3.7)
 * 4. Schema versioning compatibility check (Task 3.6)
 * 5. Logout wiping all drafts via clearAllCartDrafts (Task 3.5 & 3.7)
 * 6. Rate re-validation against catalog changes (Task 3.8)
 * 7. Security review: ensures no passwords or CEO tokens are saved (Task 3.7)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CART_DRAFT_SCHEMA_VERSION,
  buildCartDraftKey,
  saveCartDraft,
  loadCartDraft,
  clearCartDraft,
  clearAllCartDrafts,
  validateCartDraftRates,
} from '../src/lib/cartDraftStore.ts';

// Mock localStorage for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

global.window = global.window || {};
global.localStorage = new MockLocalStorage();

test('3.2: Storage key is strictly scoped by tenantId, branchId, and userId', () => {
  const key1 = buildCartDraftKey('tenant-karachi', 'branch-clifton', 'cashier-01');
  assert.strictEqual(key1, 'pyntflow_cart_draft:tenant-karachi:branch-clifton:cashier-01');

  // Fallback branchId defaults to tenantId
  const key2 = buildCartDraftKey('tenant-lahore', '', 'cashier-02');
  assert.strictEqual(key2, 'pyntflow_cart_draft:tenant-lahore:tenant-lahore:cashier-02');
});

test('3.1 & 3.3: Save and load cart draft with line items and customer info', () => {
  global.localStorage.clear();

  const tenantId = 'tenant-xyz';
  const branchId = 'tenant-xyz';
  const userId = 'user-ali';

  const cartContent = {
    lineItems: [
      {
        id: 'li-1',
        productName: 'Weather Sheet White 4L',
        code: 'WS-WHT-4L',
        qty: 2,
        rate: 3500,
        discountPercent: 5,
        unit: 'Can',
        shadeCode: '001',
        shadeColorHex: '#FFFFFF',
      },
    ],
    invoiceType: 'sales',
    selectedClient: null,
    customerSearch: 'Ahmed Khan (03001234567)',
    remarks: 'Deliver to site',
    invoiceDiscount: 200,
    deliveryCharge: 300,
    cashPayment: 6750,
    cardPayment: 0,
    bankPayment: 0,
    othersPayment: 0,
    activeCheckoutKey: 'uuid-chk-1234',
  };

  const saved = saveCartDraft(tenantId, branchId, userId, cartContent);
  assert.strictEqual(saved, true, 'Draft should be saved successfully');

  const loaded = loadCartDraft(tenantId, branchId, userId);
  assert.ok(loaded, 'Draft should be retrievable');
  assert.strictEqual(loaded.schemaVersion, CART_DRAFT_SCHEMA_VERSION);
  assert.strictEqual(loaded.tenantId, tenantId);
  assert.strictEqual(loaded.userId, userId);
  assert.strictEqual(loaded.cart.lineItems.length, 1);
  assert.strictEqual(loaded.cart.lineItems[0].productName, 'Weather Sheet White 4L');
  assert.strictEqual(loaded.cart.customerSearch, 'Ahmed Khan (03001234567)');
  assert.strictEqual(loaded.cart.activeCheckoutKey, 'uuid-chk-1234');
});

test('3.2: Multi-user isolation prevents Draft Leaking across users on same terminal', () => {
  global.localStorage.clear();

  const tenantId = 'paint-shop-central';
  const branchId = 'branch-main';

  // User 1 saves cart
  saveCartDraft(tenantId, branchId, 'user-bilal', {
    lineItems: [{ id: 'p1', productName: 'Enamel Gloss', qty: 1, rate: 1200, discountPercent: 0, unit: 'Can', code: 'E1', shadeCode: '01', shadeColorHex: '#fff' }],
    invoiceType: 'sales',
    selectedClient: null,
    customerSearch: 'Walk-in Bilal',
    remarks: '',
    invoiceDiscount: 0,
    deliveryCharge: 0,
    cashPayment: 0,
    cardPayment: 0,
    bankPayment: 0,
    othersPayment: 0,
  });

  // User 2 logs into the same terminal
  const user2Draft = loadCartDraft(tenantId, branchId, 'user-usman');
  assert.strictEqual(user2Draft, null, 'User Usman must NOT see Bilal’s draft cart');

  // Bilal can still load his draft
  const bilalDraft = loadCartDraft(tenantId, branchId, 'user-bilal');
  assert.ok(bilalDraft, 'Bilal should load his own draft');
  assert.strictEqual(bilalDraft.cart.customerSearch, 'Walk-in Bilal');
});

test('3.5: Successful sale or explicit cancel clears the specific draft', () => {
  global.localStorage.clear();

  const tenantId = 'tenant-1';
  const branchId = 'branch-1';
  const userId = 'user-1';

  saveCartDraft(tenantId, branchId, userId, {
    lineItems: [{ id: 'x1', productName: 'Primer Red Oxide', qty: 1, rate: 800, discountPercent: 0, unit: 'Can', code: 'PR1', shadeCode: '01', shadeColorHex: '#f00' }],
    invoiceType: 'sales',
    selectedClient: null,
    customerSearch: 'Tariq',
    remarks: '',
    invoiceDiscount: 0,
    deliveryCharge: 0,
    cashPayment: 0,
    cardPayment: 0,
    bankPayment: 0,
    othersPayment: 0,
  });

  assert.ok(loadCartDraft(tenantId, branchId, userId));

  // Sale completes or cashier presses Cancel (F9)
  clearCartDraft(tenantId, branchId, userId);

  const reloaded = loadCartDraft(tenantId, branchId, userId);
  assert.strictEqual(reloaded, null, 'Draft must be cleared after checkout/cancel');
});

test('3.5 & 3.7: Logout wipes all stored cart drafts from terminal', () => {
  global.localStorage.clear();

  // Multiple users and branches had saved drafts
  saveCartDraft('tenant-1', 'branch-1', 'user-1', {
    lineItems: [{ id: 'x', productName: 'A', qty: 1, rate: 10, discountPercent: 0, unit: 'Can', code: 'A', shadeCode: 'A', shadeColorHex: '#000' }],
    invoiceType: 'sales', selectedClient: null, customerSearch: '', remarks: '', invoiceDiscount: 0, deliveryCharge: 0, cashPayment: 0, cardPayment: 0, bankPayment: 0, othersPayment: 0,
  });
  saveCartDraft('tenant-1', 'branch-2', 'user-2', {
    lineItems: [{ id: 'y', productName: 'B', qty: 2, rate: 20, discountPercent: 0, unit: 'Can', code: 'B', shadeCode: 'B', shadeColorHex: '#000' }],
    invoiceType: 'sales', selectedClient: null, customerSearch: '', remarks: '', invoiceDiscount: 0, deliveryCharge: 0, cashPayment: 0, cardPayment: 0, bankPayment: 0, othersPayment: 0,
  });

  assert.strictEqual(global.localStorage.length, 2);

  // Cashier logs out
  clearAllCartDrafts();

  assert.strictEqual(global.localStorage.length, 0, 'All cart drafts must be wiped on logout');
});

test('3.6: Drafts with incompatible schemaVersion are safely discarded', () => {
  global.localStorage.clear();

  const key = buildCartDraftKey('t1', 'b1', 'u1');
  const obsoleteDraft = {
    schemaVersion: 999, // Incompatible future/past version
    tenantId: 't1',
    branchId: 'b1',
    userId: 'u1',
    updatedAt: new Date().toISOString(),
    cart: {
      lineItems: [{ id: 'old-1' }],
    },
  };
  global.localStorage.setItem(key, JSON.stringify(obsoleteDraft));

  const result = loadCartDraft('t1', 'b1', 'u1');
  assert.strictEqual(result, null, 'Obsolete schema version must be discarded');
  assert.strictEqual(global.localStorage.getItem(key), null, 'Invalid key should be cleaned from storage');
});

test('3.7: Security Audit: Payload contains NO passwords, CEO tokens, or credentials', () => {
  global.localStorage.clear();

  const tenantId = 'tenant-sec';
  const branchId = 'branch-sec';
  const userId = 'user-sec';

  saveCartDraft(tenantId, branchId, userId, {
    lineItems: [{ id: 'p1', productName: 'Wall Putty 20KG', qty: 3, rate: 1500, discountPercent: 0, unit: 'Bag', code: 'WP1', shadeCode: 'W', shadeColorHex: '#fff' }],
    invoiceType: 'sales',
    selectedClient: { id: 'c-1', name: 'Al-Madina Contractors' },
    customerSearch: '',
    remarks: 'PO-8823',
    invoiceDiscount: 100,
    deliveryCharge: 0,
    cashPayment: 4400,
    cardPayment: 0,
    bankPayment: 0,
    othersPayment: 0,
  });

  const raw = global.localStorage.getItem(buildCartDraftKey(tenantId, branchId, userId));
  assert.ok(raw);

  // Prohibited strings
  assert.strictEqual(raw.includes('password'), false, 'Draft must not contain password field');
  assert.strictEqual(raw.includes('ceo_token'), false, 'Draft must not contain CEO approval token');
  assert.strictEqual(raw.includes('jwt'), false, 'Draft must not contain JWT token');
  assert.strictEqual(raw.includes('cvv'), false, 'Draft must not contain card CVV');
});

test('3.8: Rate Revalidation detects catalog price updates and flags warnings', () => {
  const draftItems = [
    {
      id: 'item-101',
      code: 'EM-WHT-1L',
      productName: 'Matt Emulsion 1L',
      qty: 2,
      rate: 1800, // Quoted in draft
      discountPercent: 0,
      unit: 'Can',
      shadeCode: '01',
      shadeColorHex: '#fff',
    },
    {
      id: 'item-102',
      code: 'PR-RED-4L',
      productName: 'Red Oxide Primer 4L',
      qty: 1,
      rate: 2200, // Remains same
      discountPercent: 0,
      unit: 'Can',
      shadeCode: '02',
      shadeColorHex: '#f00',
    },
  ];

  const liveCatalog = [
    {
      id: 'item-101',
      code: 'EM-WHT-1L',
      name: 'Matt Emulsion 1L',
      retail_price: 2000, // Price increased in catalog!
    },
    {
      id: 'item-102',
      code: 'PR-RED-4L',
      name: 'Red Oxide Primer 4L',
      retail_price: 2200, // Price unchanged
    },
  ];

  const validation = validateCartDraftRates(draftItems, liveCatalog);
  assert.strictEqual(validation.hasChanges, true);
  assert.strictEqual(validation.warnings.length, 1);
  assert.strictEqual(validation.warnings[0].itemId, 'item-101');
  assert.strictEqual(validation.warnings[0].cartRate, 1800);
  assert.strictEqual(validation.warnings[0].catalogRate, 2000);
});

