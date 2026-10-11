# Receipt Template System — Implementation Plan (Validated & Corrected)

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Mode:** PLANNING AND DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Forensic Basis:** Verified against source code and database architecture on 2026-10-11  

---

## 1. Executive Summary & Scope Boundaries

### 1.1 Confirmed Problems Addressed

| ID | Issue | Location | Impact |
|---|---|---|---|
| **P-01** | `buildPosThermalHtml` reads only `footer.*` from assigned template; all other sections (`header`, `invoiceInfo`, `itemsTable`, `totals`, `layout`) are silently ignored. | `src/components/PosBilling.tsx` (L109–208) | **Critical** — Shop-specific templates have no effect on printed POS receipts. |
| **P-02** | `buildSalesHistoryThermalHtml` reads only `footer.*` from assigned template; all other sections are silently ignored. | `src/components/SalesHistory.tsx` (L42–106) | **Critical** — Historical duplicate receipts ignore assigned shop templates. |
| **P-03** | `buildThermalHtmlDocument` hardcodes `width: 80mm`, `font-family: Courier New`, and `@page { size: 80mm auto }` regardless of template `paper_size` or `layout.fontFamily`. | `src/utils/iframePrint.ts` (L80–107) | **High** — 58mm, A4, and A5 templates cannot format correctly on printer. |
| **P-04** | `DevReceiptPreview.tsx` mock data and interfaces lack token fields; Dev Panel cannot preview or test-print a Token Claim Slip. | `src/components/dev-panel/DevReceiptPreview.tsx` (L4–53) | **Medium** — Template designers cannot inspect or customize token slip output. |
| **P-05** | `DevReceiptTemplatesView.tsx` lacks configuration controls for Token Claim Slip. | `src/components/dev-panel/DevReceiptTemplatesView.tsx` (L38, L776–784) | **Medium** — No UI exists to toggle or customize token slip text. |
| **P-06** | `TemplateJson` interface in `receipt.ts` lacks a `tokenClaimSlip` section; DB-stored templates lack this configuration. | `src/types/receipt.ts` (L72–80) | **Medium** — No structured schema exists to store token slip template settings. |

### 1.2 Intended Final Behavior

1. **Full Template Fidelity:** A template assigned to a shop governs all visual aspects of both new POS receipts and Sales History duplicate receipts: branding/header, invoice metadata, item table columns/typography, totals, footers, margins, font family, and paper size.
2. **Defensive Normalization:** Every template JSON from the database is treated as untrusted and normalized through deep, field-level fallbacks against `DEFAULT_TEMPLATE_JSON`. No malformed JSON, legacy missing key, or invalid enum can crash rendering or corrupt layouts.
3. **Robust Security Safeguards:** All dynamic values (customer names, product descriptions, shade codes, staff names, tenant data, custom labels) are strictly HTML-escaped. Logo and QR image URLs are validated against allowed protocols (`https://`, safe `data:image/...`), and CSS values are strictly clamped and whitelisted.
4. **Token Claim Slip Parity:** Token claim slip settings (`enabled`, `title`, `instructions`, `footerNotice`, `showDetails`) can be customized and previewed in the Dev Panel with clear sample watermarks, while preserving live POS checkout claim-code generation and redemption behavior.
5. **Independent Reprint Handling:** Sales History duplicate receipts apply full template styling without being blocked by the fact that historical ephemeral token claim codes are non-reissuable.

### 1.3 Strict Scope Boundaries

* **IN SCOPE:**
  * Shared pure normalization and rendering core (`src/utils/receiptRenderCore.ts`).
  * Template-driven HTML generation for POS (`src/components/PosBilling.tsx`) and Sales History (`src/components/SalesHistory.tsx`).
  * Print document layout and paper-size CSS generation (`src/utils/receiptRenderCore.ts`, `src/utils/iframePrint.ts`).
  * Type definition updates and safe backward-compatible defaults (`src/types/receipt.ts`).
  * Dev Panel designer controls and live preview (`src/components/dev-panel/DevReceiptTemplatesView.tsx`, `src/components/dev-panel/DevReceiptPreview.tsx`).
  * Automated unit and integration test suite using built-in Node.js test infrastructure (`scripts/test-receipt-system.mjs`).

* **STRICTLY OUT OF SCOPE (NO CHANGES):**
  * Financial calculations, line item pricing, discount logic, GST calculation, grand totals, balance due, and payment allocation algorithms.
  * Live POS token claim code generation algorithm (`CLM-XXXXXX` generated at `PosBilling.tsx` L1073–1082) and database checkout transaction flows.
  * Token redemption business logic, verification, or database operations (`TokenRedemption.tsx`, `/api/tokens/*`).
  * Sales invoice database tables, migrations, indexes, or schema mutations.
  * Tenant isolation rules, authentication, and assignment API routes (`/api/receipt-templates/assign`).
  * Adding external npm dependencies (e.g., external test runners or utility libraries).

---

## 2. Rendering Architecture Evaluation

### 2.1 Analysis of Architectural Options

The existing codebase contains three separate rendering implementations:
1. `buildPosThermalHtml` (`PosBilling.tsx` L109–208): Constructs HTML string for live POS receipts; currently reads only `footer.*`.
2. `buildSalesHistoryThermalHtml` (`SalesHistory.tsx` L42–106): Constructs HTML string for duplicate reprints; currently reads only `footer.*`.
3. `DevReceiptPreview` (`DevReceiptPreview.tsx` L64–458): React JSX component implementing all template sections for live interactive preview.

| Dimension | Option A: Monolithic SSR Engine (e.g. `renderToStaticMarkup`) | Option B: Duplicate In-Place Builders | Option C: Shared Pure Core with Thin Adapters (SELECTED) |
|---|---|---|---|
| **Description** | Replace HTML string builders by rendering `DevReceiptPreview` via `react-dom/server` on client. | Maintain two separate builders in `PosBilling.tsx` and `SalesHistory.tsx`, duplicating 200+ lines of template formatting logic in both. | Create a pure helper module (`src/utils/receiptRenderCore.ts`) providing normalization, escaping, CSS generation, and section builders. `PosBilling` and `SalesHistory` use thin adapters. |
| **Regression Risk** | **Extreme:** `react-dom/server` in Next.js client bundles introduces bundle bloat, hydration warnings, and DOM synchronization issues. | **High:** Logic and bug fixes will drift between POS and Sales History. Two separate sets of HTML escaping and sanitization rules. | **Low:** Calling signatures of `buildPosThermalHtml` and `buildSalesHistoryThermalHtml` remain unchanged; invoice data adapters isolate differences. |
| **Maintenance Burden** | Moderate. | **Unacceptable:** High ongoing duplicate code debt across two critical business components. | **Minimal:** Single source of truth for normalization, escaping, CSS generation, and table layout. |
| **Testability** | Hard to unit test without DOM/React environment. | Difficult to unit test without mocking React components. | **Excellent:** Pure functions can be tested directly with Node's native runner (`node --test`). |

### 2.2 Selected Architecture: Shared Pure Core (`receiptRenderCore.ts`)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   src/utils/receiptRenderCore.ts                       │
│                                                                        │
│  1. normalizeTemplate(raw: unknown): NormalizedTemplate                │
│     Deep-merges untrusted DB JSON with DEFAULT_TEMPLATE_JSON           │
│     Validates enums, clamps numeric bounds, normalizes arrays          │
│                                                                        │
│  2. escapeHtml(str: unknown): string                                   │
│     Encodes &, <, >, ", ' for all dynamic text                         │
│                                                                        │
│  3. validateImageUrl(url?: string): string | null                      │
│     Whitelists https://, http://localhost, safe data:image/base64      │
│     Blocks javascript:, vbscript:, arbitrary protocols                 │
│                                                                        │
│  4. buildReceiptPageCss(layout, paperSize): string                     │
│     Pure CSS generation for @page, body width, font stack, margins     │
│                                                                        │
│  5. Pure Section Formatters (Header, Table, Totals, Footer, TokenSlip) │
│     Generates HTML strings from normalized invoice model               │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│  src/components/PosBilling.tsx       │  │  src/components/SalesHistory.tsx    │
│                                      │  │                                      │
│  buildPosThermalHtml(...)            │  │  buildSalesHistoryThermalHtml(...)   │
│  - Adapts POS checkout invoice       │  │  - Adapts historical sales invoice   │
│  - Passes ephemeral token claim code │  │  - Passes reprint flag (no fake code)│
│  - Calls receiptRenderCore           │  │  - Calls receiptRenderCore           │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

---

## 3. Field-Level Backward Compatibility & Normalization Specification

All JSON fetched from Supabase (`receipt_templates.template_json`) is untrusted `unknown` at runtime. The pure function `normalizeTemplate(rawTemplate: unknown, paperSize?: unknown): NormalizedTemplate` executes field-level validation and fallback:

### 3.1 Field-by-Field Normalization Rules

| Section | Field | Valid Type / Allowed Values | Default / Fallback | Clamping / Normalization Rule |
|---|---|---|---|---|
| **Root** | `paper_size` | `'thermal_80' \| 'thermal_58' \| 'a4' \| 'a5'` | `'thermal_80'` | If not in allowed set, default to `'thermal_80'`. |
| **header** | `showLogo` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `logoUrl` | `string` | `''` | Validated via `validateImageUrl(v)`. Invalid URL falls back to `''`. |
| | `logoSize` | `number` | `56` | Clamped: `Math.min(200, Math.max(16, Number(v) \|\| 56))` |
| | `align` | `'left' \| 'center' \| 'right'` | `'center'` | Whitelisted; invalid values default to `'center'`. |
| | `showShopName` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `customShopName`| `string` | `''` | Trimmed string, fallback `''`. |
| | `showAddress` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `customAddress` | `string` | `''` | Trimmed string, fallback `''`. |
| | `showPhone` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `customPhone` | `string` | `''` | Trimmed string, fallback `''`. |
| | `separator` | `'none' \| 'solid' \| 'dashed' \| 'double'` | `'dashed'` | Whitelisted; invalid values default to `'dashed'`. |
| **invoiceInfo** | `showInvoiceNo` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` (Subject to Q-01) |
| | `invoiceLabel` | `string` | `'Invoice #' ` | Trimmed string, fallback `'Invoice #'`. |
| | `showDate` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `showCashier` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `showCustomer` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `showPaymentMethod` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| **itemsTable** | `columns` | `TableColumnId[]` | `['name', 'qty', 'rate', 'amount']` | Filtered against `['name', 'code', 'qty', 'rate', 'discount', 'amount']`. If empty or invalid, fallback to `['name', 'qty', 'rate', 'amount']`. |
| | `fontSize` | `number` | `12` | Clamped: `Math.min(20, Math.max(8, Number(v) \|\| 12))` |
| | `rowPadding` | `number` | `3` | Clamped: `Math.min(20, Math.max(0, Number(v) \|\| 3))` |
| | `compact` | `boolean` | `false` | `typeof v === 'boolean' ? v : false` |
| | `showBorders` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| **totals** | `showSubtotal` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `showDiscount` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `showGst` | `boolean` | `false` | `typeof v === 'boolean' ? v : false` |
| | `gstRate` | `number` | `0` | Clamped: `Math.min(100, Math.max(0, Number(v) \|\| 0))` |
| | `showGrandTotal`| `boolean` | `true` | `typeof v === 'boolean' ? v : true` (Subject to Q-01) |
| | `showPaid` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `showBalance` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `boldTotal` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `highlightBalanceDue` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `currencySymbol`| `string` | `'Rs.'` | Trimmed string, fallback `'Rs.'`. |
| **footer** | `line1` | `string` | `'Thank you for your business!'` | Trimmed string, fallback default. |
| | `line2` | `string` | `'Goods once sold cannot be returned without receipt.'` | Trimmed string, fallback default. |
| | `showWhatsapp` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `whatsappNumber`| `string` | `''` | Trimmed string, fallback `''`. |
| | `showPoweredBy`| `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `poweredByText` | `string` | `'Powered by Pyntflow ERP'` | Trimmed string, fallback default. |
| | `showQrCode` | `boolean` | `false` | `typeof v === 'boolean' ? v : false` |
| | `qrCodeText` | `string` | `''` | Validated URL/text, fallback `''`. |
| **layout** | `marginTop` | `number` | `4` | Clamped: `Math.min(50, Math.max(0, Number(v) \|\| 4))` |
| | `marginBottom` | `number` | `6` | Clamped: `Math.min(50, Math.max(0, Number(v) \|\| 6))` |
| | `marginLeft` | `number` | `4` | Clamped: `Math.min(50, Math.max(0, Number(v) \|\| 4))` |
| | `marginRight` | `number` | `4` | Clamped: `Math.min(50, Math.max(0, Number(v) \|\| 4))` |
| | `fontSize` | `number` | `12` | Clamped: `Math.min(24, Math.max(8, Number(v) \|\| 12))` |
| | `fontFamily` | `'mono' \| 'sans' \| 'serif'` | `'mono'` | Whitelisted; invalid values default to `'mono'`. |
| | `scale` | `number` | `1` | Clamped: `Math.min(1.5, Math.max(0.5, Number(v) \|\| 1))` |
| **tokenClaimSlip** *(NEW)* | `enabled` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| | `title` | `string` | `'Token Claim Slip'` | Trimmed string, fallback `'Token Claim Slip'`. |
| | `instructions` | `string` | `'Present this code on your next visit to redeem your token'` | Trimmed string, fallback default. |
| | `footerNotice` | `string` | `'Keep this receipt — code cannot be reissued'` | Trimmed string, fallback default. |
| | `showDetails` | `boolean` | `true` | `typeof v === 'boolean' ? v : true` |
| **locks** | `locks` | `Record<string, boolean>`| `{}` | Object map, non-boolean values stripped. |

### 3.2 Legacy Template Compatibility Guarantee

Any legacy template row in Supabase that was created prior to this enhancement lacks the `tokenClaimSlip` key. Under `normalizeTemplate`:
- `raw.tokenClaimSlip` evaluates to `undefined`.
- The normalizer fills in the full default `TokenClaimSlipConfig` with `enabled: true` and the original text.
- Consequently, receipts printed with legacy templates produce the exact output and wording currently printed, guaranteeing 100% backward compatibility.

---

## 4. HTML, URL, and CSS Safety Specification

### 4.1 Strict HTML Escaping

All user-supplied and tenant-supplied text rendered into HTML strings must pass through `escapeHtml`:
```typescript
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```
**Mandatory Escaped Targets:**
- Tenant name (`tenantName`, `customShopName`)
- Customer name (`client_name`)
- Cashier/Staff name (`staffName`)
- Product names, shade codes, and item codes
- Invoice remarks, invoice numbers, dates
- Footer lines, WhatsApp numbers, Powered-By text
- Token claim codes and token claim breakdown details
- Currency symbols and custom table headers

### 4.2 URL Validation for Logos and QR Codes

To prevent `javascript:`, `vbscript:`, or arbitrary data URIs from executing via image tags or links:
```typescript
export function validateImageUrl(url?: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  
  // Whitelist HTTPS
  if (/^https:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) return trimmed;
  
  // Whitelist HTTP localhost/127.0.0.1 for local development only
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?(\/.*)?$/i.test(trimmed)) return trimmed;
  
  // Whitelist standard base64 image data URIs
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return trimmed;
  
  return null;
}
```
If `validateImageUrl` returns `null`, the image block is completely omitted from the HTML output.

### 4.3 CSS Value Whitelisting & Injection Prevention

Dynamic template settings must never be interpolated into CSS style strings without strict validation:
1. **Font Stacks:** Controlled by a strict mapping dictionary:
   ```typescript
   export const FONT_STACK_MAP = {
     mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
     sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
     serif: 'Georgia, Cambria, "Times New Roman", serif',
   };
   ```
2. **Numeric CSS Properties:** Margins, paddings, and font sizes are strictly cast to numbers and clamped before appending unit identifiers (`px` or `mm`), preventing CSS declaration injection.
3. **Separators:** Mapped strictly to explicit CSS border rules:
   - `'none'` -> `border-bottom: none;`
   - `'solid'` -> `border-bottom: 1px solid #000;`
   - `'dashed'` -> `border-bottom: 1px dashed #000;`
   - `'double'` -> `border-bottom: 3px double #000;`

---

## 5. Token Claim Slip Backward Compatibility & Data Integrity

### 5.1 Verification of Ephemeral Token Claim Code

Forensic audit of `PosBilling.tsx` and database schema confirms:
1. In `PosBilling.tsx` (L1073–1083), walk-in token claim codes are generated in memory at checkout:
   ```typescript
   const code = 'CLM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
   completedInvoice.token_claim_code = code;
   ```
2. The `invoices` table does **not** contain a `token_claim_code` column. The ephemeral code exists only on the initially printed receipt slip and in `token_redemptions` when created.
3. Therefore, **historical invoices re-queried from Sales History do not possess the original claim code**.

### 5.2 Preservation Rules

1. **Do Not Generate Replacement Codes:** Sales History reprint must never generate a random replacement code for past invoices.
2. **Do Not Claim Recoverability:** No plan or code shall assert that historical claim codes can be recovered without database storage.
3. **Preserve Generation Logic:** The live checkout algorithm in `PosBilling.tsx` (L1073–1083) remains 100% untouched.
4. **Dev Panel Mock Isolation:** In `DevReceiptPreview.tsx`, the demo token claim slip uses watermarked sample data (`CLM-DEMO99`) with an explicit notice: `[SAMPLE / PREVIEW ONLY — NOT REDEEMABLE]`.

---

## 6. Business Decision Gates (Decoupled)

The plan isolates three distinct business questions so that work is not unnecessarily blocked:

```
┌────────────────────────────────────────────────────────────────────────┐
│  INDEPENDENT WORKSTREAM (Phases 1, 4, and Core Phase 2 & 3)           │
│  - Types & Safe Defaults (T-01, T-02, T-03)                            │
│  - Pure Normalizer & Safety Utilities (T-03)                           │
│  - POS Full Template Adapter (T-04)                                    │
│  - Sales History Full Template Adapter (T-05)                          │
│  - Paper Size CSS Generation (T-10, T-11)                              │
│  - Dev Panel Designer UI & Preview Demo (T-06, T-07, T-08)             │
│  - Automated Test Suite (T-12 to T-18)                                 │
└──────────────┬─────────────────────────┬───────────────────────────────┘
               │                         │
               ▼                         ▼
      ┌─────────────────┐       ┌─────────────────┐
      │  Gate Q-01      │       │  Gate Q-02      │
      │  Mandatory      │       │  Reprint Token  │
      │  Invoice Fields │       │  Slip Behavior  │
      └────────┬────────┘       └────────┬────────┘
               │                         │
               ▼                         ▼
      ┌─────────────────┐       ┌─────────────────┐
      │  T-19: Enforce  │       │  T-20: Finalize │
      │  Field Locks    │       │  Reprint Slip   │
      └─────────────────┘       └─────────────────┘
```

### Decision Gate Q-01: Mandatory Receipt Fields & Visibility Restrictions
* **Question:** Are any receipt fields (e.g. Net Total, Invoice Number, Date) legally or operationally required in retail and must be prevented from being hidden by template toggles?
* **Options:**
  * **Option A (Recommended):** Lock `showInvoiceNo`, `showDate`, and `showGrandTotal` so they cannot be disabled in the designer.
  * **Option B:** Allow template designers full freedom to toggle all fields off without software locks.
* **Impact:** Affects only task **T-19** (designer validation rules for visibility locks). Does not block template rendering, paper size support, or previewing.

### Decision Gate Q-02: Sales History Reprint Token Claim Slip Behavior
* **Question:** When reprinting a historical invoice from Sales History that originally involved a token claim:
* **Options:**
  * **Option A (Recommended):** Suppress the token claim slip completely on reprints. (Aligns with printed disclaimer: *"Keep this receipt — code cannot be reissued"*).
  * **Option B:** Print an informational non-redeemable notice: `[Token Claim Code Issued at Original Sale — Non-Reissueable on Reprint]`.
* **Impact:** Affects only task **T-20** (Sales History reprint token slip block). **Does NOT block** applying template headers, tables, totals, footers, or paper sizes to Sales History reprints.

### Decision Gate Q-03: Token Claim Slip Suppression Behavior
* **Question:** When `tokenClaimSlip.enabled = false` in a template for an invoice that has a token:
* **Options:**
  * **Option A (Recommended):** Completely omit the token claim box from the printed receipt.
  * **Option B:** Suppress the decorative border but print the claim code as a single plain text line.
* **Impact:** Affects only task **T-21** (token slip rendering branch when `enabled === false`).

---

## 7. Phased Implementation Roadmap

### Phase 1: Core Types, Safe Defaults & Shared Pure Normalizer
* **Target Files:** `src/types/receipt.ts`, `src/utils/receiptRenderCore.ts` (new pure utility)
* **Tasks:** T-01, T-02, T-03
* **Deliverables:**
  * Define `TokenClaimSlipConfig` and update `TemplateJson` in `receipt.ts`.
  * Add default token configuration to `DEFAULT_TEMPLATE_JSON`.
  * Implement `normalizeTemplate`, `escapeHtml`, `validateImageUrl`, and `buildReceiptPageCss` in `receiptRenderCore.ts`.
* **Verification Gate:** `npx tsc --noEmit` passes cleanly.

### Phase 2: Full Template-Aware POS & Sales History Adapters
* **Target Files:** `src/components/PosBilling.tsx`, `src/components/SalesHistory.tsx`, `src/utils/iframePrint.ts`
* **Tasks:** T-04, T-05, T-06
* **Deliverables:**
  * Connect `buildPosThermalHtml` to use `receiptRenderCore.ts`.
  * Connect `buildSalesHistoryThermalHtml` to use `receiptRenderCore.ts`.
  * Ensure both builders return full self-contained HTML documents embedding template `@page` CSS and font stacks.
  * Deprecate hardcoded `buildThermalHtmlDocument` in `iframePrint.ts` while preserving it for backward compatibility.
* **Verification Gate:** Custom template applied to both POS and Sales History with identical financial calculations.

### Phase 3: Dev Panel Designer & Live Preview Token Slip
* **Target Files:** `src/components/dev-panel/DevReceiptTemplatesView.tsx`, `src/components/dev-panel/DevReceiptPreview.tsx`
* **Tasks:** T-07, T-08, T-09
* **Deliverables:**
  * Add "Token Slip" configuration tab in Dev Panel template designer.
  * Add mock token data and preview rendering in `DevReceiptPreview.tsx`.
  * Ensure Dev Panel test print faithfully reflects token slip configuration.
* **Verification Gate:** Dev Panel preview and test print render token claim slip demo cleanly.

### Phase 4: Automated Test Suite (Built-in Node.js Test Infrastructure)
* **Target Files:** `scripts/test-receipt-system.mjs`
* **Tasks:** T-10 through T-17
* **Deliverables:**
  * Comprehensive automated test suite runnable via `node --test scripts/test-receipt-system.mjs`.
  * Zero external dependencies.
  * Tests normalization, XSS escaping, URL validation, CSS clamping, financial preservation, paper sizes, POS/Sales History parity, and legacy template defaults.
* **Verification Gate:** All automated tests pass with 100% assertion success.

### Phase 5: Verification, Multi-Tenant Testing & Release Readiness
* **Target Files:** Entire application (verification only)
* **Tasks:** T-18, T-19 (if Q-01 resolved), T-20 (if Q-02 resolved), T-21 (if Q-03 resolved)
* **Deliverables:**
  * Multi-tenant template assignment isolation verification.
  * Physical / PDF printer testing on 80mm and 58mm profiles.
  * Pre-commit verification report.

---

## 8. Automated Test Coverage Plan

The project uses Node.js v25.6.1, which natively provides `node --test` and `node:assert`. No npm dependencies need to be installed.

```
scripts/test-receipt-system.mjs
├── Suite 1: Template Normalization & Defaults
│   ├── Returns DEFAULT_TEMPLATE_JSON for null/undefined/empty input
│   ├── Normalizes legacy templates lacking tokenClaimSlip
│   ├── Whitelists and falls back on invalid enums (paper_size, align, fontFamily)
│   └── Clamps out-of-range numeric values (margins, font sizes, logo size)
├── Suite 2: HTML Escaping & Injection Prevention
│   ├── Escapes HTML special characters (&, <, >, ", ')
│   ├── Validates and sanitizes image URLs (blocks javascript:, allows data:image)
│   └── Restricts CSS values to predefined font stacks and clamped numbers
├── Suite 3: Financial Precision & Value Preservation
│   ├── Ensures printed formatted strings match input numbers exactly
│   └── Verifies no recalculation or floating-point manipulation occurs
├── Suite 4: Paper Size & Page CSS Generation
│   ├── Generates correct @page rules for thermal_80, thermal_58, a4, a5
│   └── Verifies scale and margin styles in output HTML
├── Suite 5: Rendering Parity & Adapters
│   ├── Compares POS and Sales History HTML structure for identical invoice data
│   └── Verifies fallback to PyntFlow defaults when tenant names are unset
└── Suite 6: Token Claim Slip Logic
    ├── Renders live claim code on POS when present and enabled
    ├── Omit or handles token slip according to template enabled toggle
    └── Verifies mock data watermark in Dev Preview
```

---

## 9. Risk Register & Rollback Strategy

| Risk ID | Description | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|
| **R-01** | XSS injection via customer or product names in receipt HTML. | Low | Critical | Implement mandatory `escapeHtml` on all dynamic values in `receiptRenderCore.ts`. Automated test suite T-13 validates injection vectors. |
| **R-02** | Financial values on receipt differ from checkout totals. | Very Low | Critical | Renderers format passed-in server values directly (`fmt(subTotal)`); zero re-calculation of math or taxes. Automated test suite T-14 verifies values match to the penny. |
| **R-03** | Legacy templates in database crash new renderers. | Medium | High | `normalizeTemplate` validates every field with explicit fallbacks; legacy templates receive full default object. Automated test suite T-12 verifies legacy schemas. |
| **R-04** | Template from one shop leaks to another shop's POS session. | Low | Critical | Tenant assignment is resolved strictly per `tenant_id` at the API layer (`/api/receipt-templates/assign`). Verified unchanged. |
| **R-05** | Historical token claim code duplicated or fabricated on reprint. | Low | High | Ephemeral claim code generation is strictly isolated to POS checkout. Sales History reprint never fabricates or reissues codes. |
| **R-06** | Browser popup blockers suppress printing. | Low | Medium | Printing remains strictly inside hidden iframe (`printViaIframe`), which operates synchronously without triggering popup blockers. |

### Rollback Strategy
* Zero database schema changes or migrations are made.
* Any issue in Phase 1–3 can be immediately rolled back via `git revert`.
* `buildThermalHtmlDocument` is deprecated but retained in `iframePrint.ts`, allowing instant fallback if required.
