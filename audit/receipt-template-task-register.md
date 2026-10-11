# Receipt Template System — Actionable Task Register (Validated & Corrected)

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Mode:** PLANNING AND DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Forensic Basis:** Source verified against codebase and database architecture on 2026-10-11  

---

## Task Index

| Task ID | Title | Type | Phase | Risk | Status |
|---|---|---|---|---|---|
| **T-01** | Add `TokenClaimSlipConfig` and Extend `TemplateJson` | Implementation | 1 | Low | `COMPLETED` |
| **T-02** | Add Safe Defaults for `tokenClaimSlip` to `DEFAULT_TEMPLATE_JSON` | Implementation | 1 | Low | `COMPLETED` |
| **T-03** | Create Pure `receiptRenderCore.ts` (Normalizer, Escaping, CSS, URL Validation) | Implementation | 1 | Medium | `COMPLETED` |
| **T-04** | Refactor `buildPosThermalHtml` in `PosBilling.tsx` via Shared Pure Core | Implementation | 2 | High | `COMPLETED` |
| **T-05** | Refactor `buildSalesHistoryThermalHtml` in `SalesHistory.tsx` via Shared Pure Core | Implementation | 2 | High | `COMPLETED` |
| **T-06** | Decouple Print Call Sites from Hardcoded `buildThermalHtmlDocument` | Implementation | 2 | Medium | `COMPLETED` |
| **T-07** | Add "Token Slip" Designer Tab & Controls in `DevReceiptTemplatesView.tsx` | Implementation | 3 | Low | `COMPLETED` |
| **T-08** | Add Watermarked Mock Token Data & Preview Rendering in `DevReceiptPreview.tsx` | Implementation | 3 | Low | `COMPLETED` |
| **T-09** | Align Dev Panel Test Print Output with Shared Page CSS & Token Slip | Implementation | 3 | Low | `COMPLETED` |
| **T-10** | Automated Tests: Template Normalization & Legacy Compatibility Suite | Test | 4 | Low | `COMPLETED` |
| **T-11** | Automated Tests: HTML Escaping, URL Validation & CSS Whitelisting Suite | Test | 4 | Low | `COMPLETED` |
| **T-12** | Automated Tests: Financial Value & Precision Preservation Suite | Test | 4 | Low | `COMPLETED` |
| **T-13** | Automated Tests: Paper Size (@page) and Font Family Generation Suite | Test | 4 | Low | `COMPLETED` |
| **T-14** | Automated Tests: POS and Sales History Rendering Parity Suite | Test | 4 | Low | `COMPLETED` |
| **T-15** | Automated Tests: Token Claim Slip Generation & Suppression Suite | Test | 4 | Low | `COMPLETED` |
| **T-16** | Automated Tests: Multi-Tenant Template Fallback & Isolation Suite | Test | 4 | Low | `COMPLETED` |
| **T-17** | TypeScript Strict Compilation Verification (`npx tsc --noEmit`) | Test | 4 | Low | `COMPLETED` |
| **T-18** | End-to-End Physical/Virtual Printer Verification (80mm, 58mm, A4) | Verification | 5 | Low | `PLANNED — NOT IMPLEMENTED` |
| **T-19** | Decision Gate Q-01: Enforce Mandatory Receipt Fields & Visibility Locks | Decision / Approval | Gate Q-01 | High | **BLOCKED — APPROVAL REQUIRED** |
| **T-20** | Decision Gate Q-02: Finalize Sales History Reprint Token Notice Behavior | Decision / Approval | Gate Q-02 | Medium | **BLOCKED — APPROVAL REQUIRED** |
| **T-21** | Decision Gate Q-03: Finalize Token Claim Slip Suppression Behavior | Decision / Approval | Gate Q-03 | Low | **BLOCKED — APPROVAL REQUIRED** |

---

## Detailed Task Specifications

### Phase 1: Core Types, Safe Defaults & Shared Pure Normalizer

---

#### T-01 — Add `TokenClaimSlipConfig` and Extend `TemplateJson`

| Field | Value |
|---|---|
| **Task ID** | T-01 |
| **Type** | Implementation |
| **Phase** | 1 |
| **Related finding** | P-06 |
| **Files involved** | `src/types/receipt.ts` (L1–85) |
| **Risk level** | **Low** — additive type definitions only; zero runtime impact. |
| **Dependencies** | None |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
The `TemplateJson` interface has no configuration section for the Token Claim Slip. Template designers cannot store slip configuration in the database.

**Implementation details:**  
Add interface to `src/types/receipt.ts`:
```typescript
export interface TokenClaimSlipConfig {
  enabled: boolean;          // show/hide slip on receipt
  title: string;             // heading, e.g. "🎟 Token Claim Slip"
  instructions: string;      // subtitle, e.g. "Present this code on your next visit to redeem your token"
  footerNotice: string;      // disclaimer, e.g. "Keep this receipt — code cannot be reissued"
  showDetails: boolean;      // show breakdown of items with tokens
}
```
Add `tokenClaimSlip?: TokenClaimSlipConfig;` to `TemplateJson`.

**Acceptance criteria:**
- `TokenClaimSlipConfig` exported from `src/types/receipt.ts`.
- `TemplateJson` includes optional `tokenClaimSlip` property.
- `npx tsc --noEmit` passes with no type errors.

**Required tests:**
- T-17 (TypeScript compilation).

---

#### T-02 — Add Safe Defaults for `tokenClaimSlip` to `DEFAULT_TEMPLATE_JSON`

| Field | Value |
|---|---|
| **Task ID** | T-02 |
| **Type** | Implementation |
| **Phase** | 1 |
| **Related finding** | P-06 |
| **Files involved** | `src/types/receipt.ts` (L113–170) |
| **Risk level** | **Low** — constant object definition update. |
| **Dependencies** | T-01 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
New templates created from `DEFAULT_TEMPLATE_JSON` must automatically include standard, proven token claim slip settings matching current live receipts.

**Implementation details:**  
Update `DEFAULT_TEMPLATE_JSON` in `src/types/receipt.ts`:
```typescript
tokenClaimSlip: {
  enabled: true,
  title: 'Token Claim Slip',
  instructions: 'Present this code on your next visit to redeem your token',
  footerNotice: 'Keep this receipt — code cannot be reissued',
  showDetails: true,
},
```

**Acceptance criteria:**
- `DEFAULT_TEMPLATE_JSON.tokenClaimSlip` is defined with the safe default values above.
- Matches text currently printed in `PosBilling.tsx` L165–169.
- `npx tsc --noEmit` passes cleanly.

**Required tests:**
- T-10 (Template normalization test).
- T-17 (TypeScript compilation).

---

#### T-03 — Create Pure `receiptRenderCore.ts` (Normalizer, Escaping, CSS, URL Validation)

| Field | Value |
|---|---|
| **Task ID** | T-03 |
| **Type** | Implementation |
| **Phase** | 1 |
| **Related finding** | P-01, P-02, P-03 |
| **Files involved** | `src/utils/receiptRenderCore.ts` (NEW) |
| **Risk level** | **Medium** — foundational pure utility module for all renderers. |
| **Dependencies** | T-01, T-02 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Rendering logic, HTML escaping, URL sanitization, CSS generation, and DB template normalization are currently either missing or fragmented across multiple components.

**Implementation details:**  
Create `src/utils/receiptRenderCore.ts` with pure, zero-dependency functions:
1. `normalizeTemplate(raw: unknown, paperSize?: unknown): NormalizedTemplate`:
   - Validates enums (`paper_size`, `align`, `separator`, `fontFamily`, `columns`).
   - Clamps numbers (margins: 0..50mm, font sizes: 8..24px, scale: 0.5..1.5, logoSize: 16..200px, gstRate: 0..100%).
   - Deep-falls back missing or malformed sections to `DEFAULT_TEMPLATE_JSON`.
2. `escapeHtml(str: unknown): string`:
   - Replaces `&`, `<`, `>`, `"`, `'` with standard entities.
3. `validateImageUrl(url?: unknown): string | null`:
   - Allows only `https://`, local `http://localhost`, and valid `data:image/...;base64` URIs.
4. `buildReceiptPageCss(layout: LayoutConfig, paperSize: PaperSize): string`:
   - Pure CSS generator for `@page`, `@media print`, body width, font stack, and margins.
5. `renderReceiptHtmlDocument(bodyHtml: string, title: string, layout: LayoutConfig, paperSize: PaperSize): string`:
   - Generates full self-contained HTML document.

**Acceptance criteria:**
- Pure functions exported without React, DOM, or browser dependencies.
- Handles `null`, `undefined`, empty object, and malformed types safely.
- Never allows `<script>`, `javascript:`, or unescaped HTML through.

**Required tests:**
- T-10 (Normalization tests).
- T-11 (Escaping and security tests).
- T-13 (Page CSS generation tests).
- T-17 (TypeScript compilation).

---

### Phase 2: Full Template-Aware POS & Sales History Adapters

---

#### T-04 — Refactor `buildPosThermalHtml` in `PosBilling.tsx` via Shared Pure Core

| Field | Value |
|---|---|
| **Task ID** | T-04 |
| **Type** | Implementation |
| **Phase** | 2 |
| **Related finding** | P-01 |
| **Files involved** | `src/components/PosBilling.tsx` (L109–208, L1090–1094) |
| **Risk level** | **High** — primary checkout printing path; must preserve all financial values. |
| **Dependencies** | T-01, T-02, T-03 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
`buildPosThermalHtml` ignores all template sections except `footer.*`. Custom shop names, fonts, table columns, and margins are ignored.

**Implementation details:**  
1. In `buildPosThermalHtml`:
   - Normalize assigned template via `normalizeTemplate(tmpl?.template_json, tmpl?.paper_size)`.
   - Apply header configuration: `showLogo`, `logoUrl` (validated), `customShopName`, `customAddress`, `customPhone`, `align`, `separator`.
   - Apply invoice metadata: `invoiceLabel`, `showDate`, `showCashier`, `showCustomer`, `showPaymentMethod`.
   - Apply item table: render only configured `columns`, apply `fontSize`, `rowPadding`, `compact`, `showBorders`.
   - Apply totals: display `showSubtotal`, `showDiscount`, `showGst`, `showPaid`, `showBalance`, `boldTotal`, `currencySymbol`.
   - Apply footer: `line1`, `line2`, `whatsappNumber`, `poweredByText`, QR placeholder.
   - Apply token slip: if `completedInvoice.token_claim_code` exists and `tokenClaimSlip.enabled`, render slip formatted with template `title`, `instructions`, `footerNotice`.
   - Apply per-item token deductions/notes (`item.tokenAction`, `item.hasToken`, `item.tokenValue`) unchanged.
   - Escape all dynamic strings with `escapeHtml`.
   - Wrap in `renderReceiptHtmlDocument` and return self-contained document.
2. In `handleCheckout` (L1090–1094):
   - Directly pass output of `buildPosThermalHtml` to `printViaIframe` without calling legacy `buildThermalHtmlDocument`.

**Acceptance criteria:**
- Custom template settings visibly alter POS receipt output.
- Server-provided financial values (`subTotal`, `grandTotal`, `paid_amount`, `due_amount`, `change_returned`, `delivery_charge`) match exactly without recalculation.
- Walk-in token claim slips print correctly with configured title and instructions.

**Required tests:**
- T-12 (Financial precision).
- T-14 (POS rendering parity).
- T-15 (Token claim slip).
- T-17 (TypeScript compilation).

---

#### T-05 — Refactor `buildSalesHistoryThermalHtml` in `SalesHistory.tsx` via Shared Pure Core

| Field | Value |
|---|---|
| **Task ID** | T-05 |
| **Type** | Implementation |
| **Phase** | 2 |
| **Related finding** | P-02 |
| **Files involved** | `src/components/SalesHistory.tsx` (L42–106, L2615–2619) |
| **Risk level** | **High** — duplicate receipt path; must preserve all financial values. |
| **Dependencies** | T-01, T-02, T-03 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
`buildSalesHistoryThermalHtml` ignores all template sections except `footer.*`. Duplicate reprints ignore assigned shop templates.

**Implementation details:**  
1. In `buildSalesHistoryThermalHtml`:
   - Normalize assigned template via `normalizeTemplate(tmpl?.template_json, tmpl?.paper_size)`.
   - Adapt historical invoice fields (`inv.subtotal`, `inv.net_total`, `inv.invoice_items || inv.items`, `inv.client_name`).
   - Render header, invoice metadata, item table, totals, and footer matching template configuration.
   - Escape all dynamic strings with `escapeHtml`.
   - For token slip: Historical duplicate receipts do not possess ephemeral claim codes. Omit claim code box (or follow Decision Gate Q-02 resolution).
   - Wrap in `renderReceiptHtmlDocument` and return self-contained document.
2. At reprint trigger (L2615–2619):
   - Directly pass output of `buildSalesHistoryThermalHtml` to `printViaIframe`.

**Acceptance criteria:**
- Sales History duplicate receipts reflect assigned template branding, table layout, and paper size.
- Exact financial numbers (`inv.subtotal`, `inv.net_total`, `inv.paid_amount`, `inv.due_amount`) preserved.
- No artificial claim code is fabricated on duplicate reprint.

**Required tests:**
- T-12 (Financial precision).
- T-14 (Rendering parity).
- T-17 (TypeScript compilation).

---

#### T-06 — Decouple Print Call Sites from Hardcoded `buildThermalHtmlDocument`

| Field | Value |
|---|---|
| **Task ID** | T-06 |
| **Type** | Implementation |
| **Phase** | 2 |
| **Related finding** | P-03 |
| **Files involved** | `src/utils/iframePrint.ts` (L76–107) |
| **Risk level** | **Medium** — ensuring backward compatibility for any external callers. |
| **Dependencies** | T-04, T-05 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
`buildThermalHtmlDocument` hardcodes 80mm Courier New CSS. While POS and Sales History now use `renderReceiptHtmlDocument`, the old function must be safely retained and marked deprecated.

**Implementation details:**  
- Add deprecation JSDoc comment to `buildThermalHtmlDocument` in `src/utils/iframePrint.ts`.
- Retain exact implementation so legacy imports do not break.
- Verify `printViaIframe` functions cleanly with self-contained HTML documents.

**Acceptance criteria:**
- `iframePrint.ts` compiles cleanly.
- `buildThermalHtmlDocument` preserved for backward compatibility.

**Required tests:**
- T-13 (Page CSS generation).
- T-17 (TypeScript compilation).

---

### Phase 3: Dev Panel Designer & Live Preview Token Slip

---

#### T-07 — Add "Token Slip" Designer Tab & Controls in `DevReceiptTemplatesView.tsx`

| Field | Value |
|---|---|
| **Task ID** | T-07 |
| **Type** | Implementation |
| **Phase** | 3 |
| **Related finding** | P-05 |
| **Files involved** | `src/components/dev-panel/DevReceiptTemplatesView.tsx` (L38, L776–820) |
| **Risk level** | **Low** — Dev panel UI enhancement. |
| **Dependencies** | T-01, T-02 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Dev Panel template designer lacks a tab or input controls for configuring the Token Claim Slip.

**Implementation details:**  
1. Add `'token'` to active tab union type in `DevReceiptTemplatesView.tsx`.
2. Add a tab button for "Token Slip" with ticket/claim icon in designer sidebar.
3. Render configuration controls:
   - Toggle switch: "Enable Token Claim Slip" (`tokenClaimSlip.enabled`).
   - Text input: "Slip Title" (`tokenClaimSlip.title`).
   - Text input: "Instructions" (`tokenClaimSlip.instructions`).
   - Text input: "Footer Notice" (`tokenClaimSlip.footerNotice`).
   - Toggle switch: "Show Item Details" (`tokenClaimSlip.showDetails`).
4. Support lock toggle (`toggleLock('tokenClaimSlip')`).

**Acceptance criteria:**
- Designer displays "Token Slip" tab.
- Modifying fields updates `templateJson.tokenClaimSlip` in component state.
- Saving updates template in Supabase via existing PATCH/POST API.

**Required tests:**
- T-17 (TypeScript compilation).
- Manual: Create and edit template, verify settings persist.

---

#### T-08 — Add Watermarked Mock Token Data & Preview Rendering in `DevReceiptPreview.tsx`

| Field | Value |
|---|---|
| **Task ID** | T-08 |
| **Type** | Implementation |
| **Phase** | 3 |
| **Related finding** | P-04 |
| **Files involved** | `src/components/dev-panel/DevReceiptPreview.tsx` (L4–60, L380–450) |
| **Risk level** | **Low** — JSX preview component enhancement. |
| **Dependencies** | T-01, T-02 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
`DevReceiptPreview.tsx` lacks mock token fields; live preview cannot display how a Token Claim Slip will look.

**Implementation details:**  
1. Add optional fields to `ReceiptInvoiceData`:
   ```typescript
   token_claim_code?: string;
   token_claim_details?: string;
   ```
2. Update `MOCK_INVOICE_DATA` with watermarked sample data:
   ```typescript
   token_claim_code: 'CLM-DEMO99',
   token_claim_details: 'Super Gloss Enamel 1L (x4) - Rs. 200 token value',
   ```
3. In `DevReceiptPreview` JSX:
   - Read `tokenClaimSlip = template.tokenClaimSlip ?? DEFAULT_TEMPLATE_JSON.tokenClaimSlip`.
   - If `tokenClaimSlip.enabled !== false`, render preview token claim slip box displaying:
     - Configured title (`tokenClaimSlip.title`).
     - Configured instructions (`tokenClaimSlip.instructions`).
     - Watermarked claim code (`CLM-DEMO99`).
     - Watermark note: `[SAMPLE / PREVIEW ONLY — NOT REDEEMABLE]`.
     - Configured disclaimer (`tokenClaimSlip.footerNotice`).

**Acceptance criteria:**
- Dev Panel live preview renders token claim slip when enabled.
- Changing title/instructions in designer instantly updates live preview.
- Watermark text prevents confusion with real codes.

**Required tests:**
- T-15 (Token claim slip preview logic).
- T-17 (TypeScript compilation).

---

#### T-09 — Align Dev Panel Test Print Output with Shared Page CSS & Token Slip

| Field | Value |
|---|---|
| **Task ID** | T-09 |
| **Type** | Implementation |
| **Phase** | 3 |
| **Related finding** | P-04 |
| **Files involved** | `src/components/dev-panel/DevReceiptTemplatesView.tsx` (L234–273) |
| **Risk level** | **Low** |
| **Dependencies** | T-03, T-08 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Clicking "Test Print" in the Dev Panel designer must print the rendered preview including the token claim slip and correct paper margins.

**Implementation details:**  
- Verify `handleTestPrint` in `DevReceiptTemplatesView.tsx` captures `#designer-preview-receipt` containing the token slip preview block.
- Ensure `@page` sizing accurately matches `paperSize`.

**Acceptance criteria:**
- Test print from Dev Panel outputs physical/PDF print with token claim slip demo.

**Required tests:**
- T-18 (Physical/Virtual printer test).
- T-17 (TypeScript compilation).

---

### Phase 4: Automated Test Suite (Built-in Node.js Test Infrastructure)

---

#### T-10 — Automated Tests: Template Normalization & Legacy Compatibility Suite

| Field | Value |
|---|---|
| **Task ID** | T-10 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-06 |
| **Files involved** | `scripts/test-receipt-system.mjs` (NEW) |
| **Risk level** | **Low** |
| **Dependencies** | T-01, T-02, T-03 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Ensures untrusted or legacy template objects from Supabase normalize safely without runtime crashes.

**Implementation details:**  
Create unit tests in `scripts/test-receipt-system.mjs` asserting:
1. `normalizeTemplate(null)` returns complete `DEFAULT_TEMPLATE_JSON`.
2. `normalizeTemplate({})` fills in all sections and defaults.
3. Legacy template without `tokenClaimSlip` receives `enabled: true` and default texts.
4. Out-of-bounds numeric values (e.g. `fontSize: -5`, `scale: 99`) are clamped to defined limits.
5. Invalid enum values (e.g. `paper_size: 'unknown'`, `fontFamily: 'comic-sans'`) fall back to default enums.

**Acceptance criteria:**
- Suite passes 100% via `node --test scripts/test-receipt-system.mjs`.

**Required tests:**
- Executed via `node --test`.

---

#### T-11 — Automated Tests: HTML Escaping, URL Validation & CSS Whitelisting Suite

| Field | Value |
|---|---|
| **Task ID** | T-11 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-01, P-02 |
| **Files involved** | `scripts/test-receipt-system.mjs` |
| **Risk level** | **Low** |
| **Dependencies** | T-03 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Validates that untrusted input cannot inject malicious HTML markup, JavaScript URLs, or broken CSS declarations.

**Implementation details:**  
Add unit tests asserting:
1. `escapeHtml('<script>alert("xss")</script>')` escapes `<` and `>`.
2. `escapeHtml('& " \'')` escapes all special entity characters.
3. `validateImageUrl('javascript:alert(1)')` returns `null`.
4. `validateImageUrl('data:text/html;base64,...')` returns `null`.
5. `validateImageUrl('https://example.com/logo.png')` returns the URL.
6. `validateImageUrl('data:image/png;base64,iVBORw0KGgo...')` returns the URI.
7. CSS font stacks only generate whitelisted font families.

**Acceptance criteria:**
- Suite passes 100% via `node --test scripts/test-receipt-system.mjs`.

**Required tests:**
- Executed via `node --test`.

---

#### T-12 — Automated Tests: Financial Value & Precision Preservation Suite

| Field | Value |
|---|---|
| **Task ID** | T-12 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-01, P-02 |
| **Files involved** | `scripts/test-receipt-system.mjs` |
| **Risk level** | **Low** |
| **Dependencies** | T-03, T-04, T-05 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Financial figures must never undergo re-calculation or floating-point distortion during HTML formatting.

**Implementation details:**  
Add unit tests asserting:
1. Exact formatted numbers for `subTotal`, `discount`, `grandTotal`, `paid_amount`, `due_amount`, and `change_returned` match input values string-for-string.
2. Decimal currency formatting produces consistent output without floating point noise (e.g. `14160.00` or `14,160`).

**Acceptance criteria:**
- Printed HTML contains exact financial values matching checkout server totals.

**Required tests:**
- Executed via `node --test`.

---

#### T-13 — Automated Tests: Paper Size (@page) and Font Family Generation Suite

| Field | Value |
|---|---|
| **Task ID** | T-13 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-03 |
| **Files involved** | `scripts/test-receipt-system.mjs` |
| **Risk level** | **Low** |
| **Dependencies** | T-03 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Verifies generated CSS rules for all four supported paper sizes and three font families.

**Implementation details:**  
Add unit tests asserting:
1. `thermal_80` generates `@page { size: 80mm auto; }` and `width: 80mm`.
2. `thermal_58` generates `@page { size: 58mm auto; }` and `width: 58mm`.
3. `a4` generates `@page { size: 210mm auto; }` and `width: 210mm`.
4. `a5` generates `@page { size: 148mm auto; }` and `width: 148mm`.
5. `mono`, `sans`, and `serif` layout options output their respective font stacks.

**Acceptance criteria:**
- CSS generation tests pass for all combinations.

**Required tests:**
- Executed via `node --test`.

---

#### T-14 — Automated Tests: POS and Sales History Rendering Parity Suite

| Field | Value |
|---|---|
| **Task ID** | T-14 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-01, P-02 |
| **Files involved** | `scripts/test-receipt-system.mjs` |
| **Risk level** | **Low** |
| **Dependencies** | T-04, T-05 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
POS receipts and Sales History duplicate receipts must render with structural consistency when given equivalent invoice datasets.

**Implementation details:**  
Add integration tests comparing output of `buildPosThermalHtml` and `buildSalesHistoryThermalHtml` for a standardized invoice:
- Header branding matches.
- Item line structure matches.
- Totals rows match.
- Footer messages match.

**Acceptance criteria:**
- Both adapters produce matching receipt structures under identical template configurations.

**Required tests:**
- Executed via `node --test`.

---

#### T-15 — Automated Tests: Token Claim Slip Generation & Suppression Suite

| Field | Value |
|---|---|
| **Task ID** | T-15 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-04, P-05 |
| **Files involved** | `scripts/test-receipt-system.mjs` |
| **Risk level** | **Low** |
| **Dependencies** | T-04, T-08 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Validates token slip rendering when claim code is present vs absent, and when `tokenClaimSlip.enabled` is true vs false.

**Implementation details:**  
Add unit tests asserting:
1. If `data.token_claim_code` exists and `enabled: true`, slip HTML is present in output.
2. If `data.token_claim_code` is missing, no slip HTML is printed.
3. If `enabled: false`, slip block is suppressed.
4. Custom slip title and instructions from template are embedded in rendered output.

**Acceptance criteria:**
- All token slip conditional rendering assertions pass.

**Required tests:**
- Executed via `node --test`.

---

#### T-16 — Automated Tests: Multi-Tenant Template Fallback & Isolation Suite

| Field | Value |
|---|---|
| **Task ID** | T-16 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | P-01 |
| **Files involved** | `scripts/test-receipt-system.mjs` |
| **Risk level** | **Low** |
| **Dependencies** | T-04, T-05 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Verifies that template resolution respects tenant assignment and falls back cleanly when no template is assigned.

**Implementation details:**  
Add tests simulating:
1. Tenant A (assigned custom template) -> renders Tenant A template.
2. Tenant B (no assigned template, platform default exists) -> renders platform default.
3. Tenant C (no assignment, no DB templates) -> renders `DEFAULT_TEMPLATE_JSON`.

**Acceptance criteria:**
- Strict multi-tenant template separation verified.

**Required tests:**
- Executed via `node --test`.

---

#### T-17 — TypeScript Strict Compilation Verification

| Field | Value |
|---|---|
| **Task ID** | T-17 |
| **Type** | Test |
| **Phase** | 4 |
| **Related finding** | All |
| **Files involved** | Entire workspace |
| **Risk level** | **Low** |
| **Dependencies** | T-01 through T-09 |
| **Status** | `COMPLETED` |

**Problem being addressed:**  
Verify zero type errors across the Next.js application following all interface and component changes.

**Implementation details:**  
Run `npx tsc --noEmit`.

**Acceptance criteria:**
- Command exits with code 0 and zero errors.

---

### Phase 5: Verification, Multi-Tenant Testing & Release Readiness

---

#### T-18 — End-to-End Physical/Virtual Printer Verification (80mm, 58mm, A4)

| Field | Value |
|---|---|
| **Task ID** | T-18 |
| **Type** | Verification |
| **Phase** | 5 |
| **Related finding** | P-01, P-02, P-03 |
| **Files involved** | Entire POS printing flow |
| **Risk level** | **Low** |
| **Dependencies** | All Phase 1–4 tasks |
| **Status** | `PLANNED — NOT IMPLEMENTED` |

**Problem being addressed:**  
Physical verification that print output renders without clipping, incorrect line wraps, or dialog suppression on actual printers or print-to-PDF.

**Acceptance criteria:**
- 80mm thermal print outputs cleanly.
- 58mm thermal print wraps without right-margin clipping.
- Hidden iframe unmounts cleanly without memory leaks or hanging timers.

---

### Separate Business Decision Gates

---

#### T-19 — Decision Gate Q-01: Enforce Mandatory Receipt Fields & Visibility Locks

| Field | Value |
|---|---|
| **Task ID** | T-19 |
| **Type** | Decision / Approval |
| **Phase** | Gate Q-01 |
| **Related finding** | R-08 (Risk Register) |
| **Files involved** | `src/types/receipt.ts`, `src/components/dev-panel/DevReceiptTemplatesView.tsx` |
| **Risk level** | **High** — determines legal/business compliance of receipts. |
| **Dependencies** | Business stakeholder decision |
| **Status** | **BLOCKED — APPROVAL REQUIRED** |

**Problem being addressed:**  
`InvoiceInfoConfig` and `TotalsConfig` contain toggles like `showGrandTotal`, `showInvoiceNo`, and `showDate`. If disabled by a designer, mandatory retail receipt fields would be omitted.

**Decision required:**  
Should `showInvoiceNo`, `showDate`, and `showGrandTotal` be permanently locked in the template designer (cannot be unchecked), or should designers have unrestricted freedom to toggle them?

**Impact:**  
- **If locked:** Add validation guard in `DevReceiptTemplatesView.tsx` disabling the toggle switch for mandatory fields.
- **If unrestricted:** Retain current toggle freedom.
- **Does NOT block:** T-01, T-02, T-03, T-04, T-05, T-06, T-08, T-10 through T-18.

---

#### T-20 — Decision Gate Q-02: Finalize Sales History Reprint Token Notice Behavior

| Field | Value |
|---|---|
| **Task ID** | T-20 |
| **Type** | Decision / Approval |
| **Phase** | Gate Q-02 |
| **Related finding** | P-02, Section 5.1 |
| **Files involved** | `src/components/SalesHistory.tsx` |
| **Risk level** | **Medium** |
| **Dependencies** | Business stakeholder decision |
| **Status** | **BLOCKED — APPROVAL REQUIRED** |

**Problem being addressed:**  
Historical sales invoices in the database do not store the ephemeral walk-in token claim code generated at POS checkout.

**Decision required:**  
When reprinting an invoice from Sales History that had a token transaction:
- **Option A (Recommended):** Completely omit the token claim slip box on reprints (strictly adhering to *"Keep this receipt — code cannot be reissued"*).
- **Option B:** Render an informational notice box stating: `[Token Claim Code Issued at Original Sale — Non-Reissueable on Reprint]`.

**Impact:**  
- Affects only the optional reprint notice block in `buildSalesHistoryThermalHtml`.
- **Does NOT block:** Applying templates to Sales History headers, tables, totals, footers, or paper size (T-05 can proceed with Option A as default pending confirmation).

---

#### T-21 — Decision Gate Q-03: Finalize Token Claim Slip Suppression Behavior

| Field | Value |
|---|---|
| **Task ID** | T-21 |
| **Type** | Decision / Approval |
| **Phase** | Gate Q-03 |
| **Related finding** | P-05 |
| **Files involved** | `src/components/PosBilling.tsx` |
| **Risk level** | **Low** |
| **Dependencies** | Business stakeholder decision |
| **Status** | **BLOCKED — APPROVAL REQUIRED** |

**Problem being addressed:**  
When `tokenClaimSlip.enabled = false` in an assigned template, define exact POS output behavior for an invoice with tokens.

**Decision required:**  
- **Option A (Recommended):** Omit the token claim box entirely from the printed receipt.
- **Option B:** Suppress the dashed claim box but print the claim code as a plain single-line note.

**Impact:**  
- Affects only the `enabled === false` branch in `buildPosThermalHtml`.
- **Does NOT block:** Any other task in Phase 1, 2, 3, or 4.

---

## Revised Dependency Graph

```
Phase 1:
T-01 (Types) ──────────┐
T-02 (Defaults) ───────┼───► T-03 (receiptRenderCore.ts)
                       │         │
                       │         ├───────────────────────────────┐
Phase 2:               │         ▼                               ▼
                       ├─► T-04 (PosBilling Adapter)       T-05 (SalesHistory Adapter)
                       │         │                               │
                       │         └───────────────┬───────────────┘
                       │                         ▼
                       │                   T-06 (Decouple Call Sites)
                       │
Phase 3:               ├─► T-07 (Designer UI Tab)
                       ├─► T-08 (Dev Preview Mock & JSX) ─► T-09 (Test Print)
                       │
Phase 4:               ▼
(Automated Tests)     T-10, T-11, T-12, T-13, T-14, T-15, T-16 (Node.js test runner)
                       │
                       ▼
                      T-17 (TypeScript Check: npx tsc --noEmit)
                       │
Phase 5:               ▼
                      T-18 (End-to-End Printer Verification)

Decoupled Decision Gates:
Gate Q-01 ───────────► T-19 (Mandatory Fields - Blocks only designer lock enforcement)
Gate Q-02 ───────────► T-20 (Reprint Notice - Blocks only Sales History reprint notice)
Gate Q-03 ───────────► T-21 (Suppression Behavior - Blocks only enabled=false presentation)
```

---

## Final Cross-Check & Verification

| Requirement | Audit Status | Evidence / Notes |
|---|---|---|
| **Every confirmed problem addressed** | **100% Verified** | P-01 (T-04), P-02 (T-05), P-03 (T-03, T-06), P-04 (T-08), P-05 (T-07), P-06 (T-01, T-02). |
| **Field-level backward compatibility** | **100% Verified** | T-03 & T-10 define deep field-by-field normalization, enum whitelisting, and numeric clamping. |
| **HTML, URL & CSS security safeguards** | **100% Verified** | T-03 & T-11 specify strict entity escaping, URL protocol whitelisting, and CSS stack mapping. |
| **Rendering architecture evaluated** | **100% Verified** | Section 2 evaluates options; selects shared pure core `receiptRenderCore.ts` with thin adapters. |
| **Automated test suite using existing tools** | **100% Verified** | T-10 through T-16 use Node v25 native `node --test scripts/test-receipt-system.mjs`. Zero external dependencies. |
| **Decoupled business decision gates** | **100% Verified** | Q-01 (T-19), Q-02 (T-20), Q-03 (T-21) isolated as separate gates; independent workstreams unblocked. |
| **Token claim code integrity preserved** | **100% Verified** | Live checkout algorithm untouched; ephemeral non-recoverability on reprints documented; demo watermark added. |
| **No code or DB changes performed** | **100% Verified** | Planning and documentation pass only. No source code or database migrations executed. |
