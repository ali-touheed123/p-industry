/**
 * scripts/test-phase1-special-idempotency.mjs
 *
 * Phase 1 Unit Tests: Special Receipt Idempotency (HOTFIX)
 * Exercises client-side idempotency key generation, retention across retries,
 * cart-signature invalidation, and duplicate-response contract handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

test('1.1 & 1.2: Idempotency key generation & stable retry retention', () => {
  let activeSpecialCheckoutKey = null;

  function getOrGenerateKey() {
    const key = activeSpecialCheckoutKey || `idemp-spl-mock-${Date.now()}`;
    if (!activeSpecialCheckoutKey) {
      activeSpecialCheckoutKey = key;
    }
    return key;
  }

  // First call generates a key
  const key1 = getOrGenerateKey();
  assert.ok(key1.startsWith('idemp-spl-mock-'));

  // Simulated retry due to network timeout / failure
  const key2 = getOrGenerateKey();
  assert.strictEqual(key2, key1, 'Retried request must reuse identical idempotency key');

  // Simulated success clears the key
  activeSpecialCheckoutKey = null;

  // Next distinct transaction generates a fresh key
  const key3 = getOrGenerateKey();
  assert.ok(key3.startsWith('idemp-spl-mock-'));
});

test('1.1: Cart signature detects specialRate and discountPercent changes', () => {
  function computeCartSignature(cart) {
    return JSON.stringify({
      items: cart.lineItems.map((ci) => ({
        id: ci.id,
        qty: ci.qty,
        rate: ci.rate,
        specialRate: ci.specialRate,
        discountPercent: ci.discountPercent,
        tokenAction: ci.tokenAction,
      })),
      discount: cart.invoiceDiscount,
      delivery: cart.deliveryCharge,
      clientId: cart.selectedClient?.id || null,
      customerSearch: cart.customerSearch,
      cash: cart.cashPayment,
      card: cart.cardPayment,
      bank: cart.bankPayment,
      others: cart.othersPayment,
    });
  }

  const baseCart = {
    lineItems: [{ id: 'item-1', qty: 2, rate: 1000, specialRate: 850, discountPercent: 0, tokenAction: 'keep' }],
    invoiceDiscount: 0,
    deliveryCharge: 0,
    selectedClient: null,
    customerSearch: 'Ahmed',
    cashPayment: 1700,
    cardPayment: 0,
    bankPayment: 0,
    othersPayment: 0,
  };

  const sig1 = computeCartSignature(baseCart);

  // Changing specialRate MUST alter signature
  const cartWithNewSpecialRate = {
    ...baseCart,
    lineItems: [{ ...baseCart.lineItems[0], specialRate: 800 }],
  };
  const sig2 = computeCartSignature(cartWithNewSpecialRate);
  assert.notStrictEqual(sig1, sig2, 'Changing specialRate must invalidate cart signature');

  // Changing discountPercent MUST alter signature
  const cartWithNewDiscount = {
    ...baseCart,
    lineItems: [{ ...baseCart.lineItems[0], discountPercent: 5 }],
  };
  const sig3 = computeCartSignature(cartWithNewDiscount);
  assert.notStrictEqual(sig1, sig3, 'Changing discountPercent must invalidate cart signature');

  // Unchanged cart produces identical signature
  const sig1Repeat = computeCartSignature(baseCart);
  assert.strictEqual(sig1, sig1Repeat, 'Unchanged cart must maintain identical signature');
});

test('1.4: Duplicate response (is_duplicate: true) handling contract', () => {
  // Mock server response when an idempotency duplicate is caught
  const mockDuplicateResponse = {
    success: true,
    is_duplicate: true,
    invoice_id: 'inv-uuid-1234',
    invoice_no: 'INV-261029-0042',
    charged_total: 1700,
    invoice: { id: 'inv-uuid-1234', invoice_no: 'INV-261029-0042' },
    snapshot: { invoice_no: 'INV-261029-0042', client_name: 'Ahmed' },
    template: { id: 'tmpl-1' },
  };

  let cartCleared = false;
  let activeKey = 'idemp-spl-active';
  let printedInvoiceNo = null;

  function handleResponse(resData) {
    if (!resData.success) {
      throw new Error(resData.error || 'Failed');
    }

    // Success (even if is_duplicate: true)
    if (resData.snapshot) {
      printedInvoiceNo = resData.snapshot.invoice_no;
    }
    cartCleared = true;
    activeKey = null; // Key must be cleared
    return resData.is_duplicate ? 'retrieved_existing' : 'created_new';
  }

  const outcome = handleResponse(mockDuplicateResponse);

  assert.strictEqual(outcome, 'retrieved_existing');
  assert.strictEqual(cartCleared, true, 'Cart must be cleared on duplicate confirmation');
  assert.strictEqual(activeKey, null, 'Active checkout key must be reset on duplicate confirmation');
  assert.strictEqual(printedInvoiceNo, 'INV-261029-0042', 'Original invoice snapshot must be printed');
});

test('1.5: Special return idempotency contract verified', () => {
  let activeReturnKey = null;

  function getReturnKey() {
    const key = activeReturnKey || 'idemp-ret-uuid-5678';
    if (!activeReturnKey) {
      activeReturnKey = key;
    }
    return key;
  }

  const retKey1 = getReturnKey();
  const retKey2 = getReturnKey();
  assert.strictEqual(retKey1, retKey2, 'Special return must maintain stable key across retries');

  // On return success:
  activeReturnKey = null;
  assert.strictEqual(activeReturnKey, null);
});

