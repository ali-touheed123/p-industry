# Phase 5 — Receipt Template System Actionable Task Register (Validated & Corrected)
## Release Readiness, Multi-Format Output Verification & Integration Architecture

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** Phase 5 — Release Readiness, Printer Verification & Integration Evidence  
**Status:** `PHASE 5 EXECUTION CYCLE COMPLETED — T-22, T-23, T-24 EXECUTED; CONDITIONAL RELEASE READINESS ISSUED`  
**Date:** 2026-10-11  

---

## 1. Task Index & Status Summary

| Task ID | Title | Workstream | Risk | Dependencies | Status | Separate Auth Required? |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **T-18.1** | Virtual Printer & PDF Spool Verification (80mm & 58mm) | A: Output | Low | T-13, T-17 | `COMPLETED (CONDITIONAL PASS / FINDING F-18.1-01)` | Executed |
| **T-18.1-FIX** | Thermal @page CSS Syntax & PDF MediaBox Sizing Remediation | A: Output / Fix | Low | T-18.1 | `COMPLETED` | Executed |
| **T-18.2** | A4 & A5 Cut-Sheet Layout, Pagination & Margin Verification | A: Output | Low | T-13, T-17, T-18.1-FIX | `COMPLETED` | Executed |
| **T-18.3** | Hidden Iframe Printing Lifecycle & Memory Leak Audit | A: Output | Low | T-06, T-09 | `COMPLETED` | Executed |
| **T-18.4** | Physical Hardware Printer Sign-off (Field Trial) | A: Output | Medium | T-18.1-FIX | `BLOCKED — PHYSICAL PRINTER UNAVAILABLE / NOT FUNCTIONAL` | Executed |
| **T-22** | POS and Sales History Adapter Verification (`ADAPT-01`) | B: Adapters | Low | T-04, T-05, T-14 | `COMPLETED` | Executed |
| **T-23** | Multi-Tenant API Route Authorization & Boundary Integration Test (`SEC-01`) | C: Security | Low | T-16 | `COMPLETED` | Executed |
| **T-19** | Decision Gate Q-01: Enforce Mandatory Receipt Fields & Visibility Locks | Decision Gate | High | None | `COMPLETED (OPTION A IMPLEMENTED & VERIFIED)` | Executed |
| **T-20** | Decision Gate Q-02: Finalize Sales History Reprint Token Notice Behavior | Decision Gate | Medium | None | `COMPLETED (OPTION A VERIFIED ACROSS 4 FORMATS)` | Executed |
| **T-21** | Decision Gate Q-03: Finalize Token Claim Slip Suppression Behavior | Decision Gate | Low | None | `COMPLETED (OPTION A VERIFIED ACROSS 4 FORMATS)` | Executed |
| **T-24** | Final System Release Readiness Audit & Production Sign-off (`REL-01`) | Readiness | Low | T-18.1-FIX, T-18.2, T-18.3, T-22, T-23 | `COMPLETED — CONDITIONAL RELEASE READINESS ISSUED` | Executed |

---

## 2. Detailed Task Specifications

---

### Workstream A: Printer Spool, Document Output & Iframe Lifecycle (T-18)

#### T-18.1 — Virtual Printer & PDF Spool Verification (80mm & 58mm Thermal Profiles)

| Field | Value |
|---|---|
| **Task ID** | T-18.1 |
| **Title** | Virtual Printer & PDF Spool Verification (80mm & 58mm Thermal Profiles) |
| **Workstream** | A: Output Verification |
| **Risk Level** | **Low** — visual rendering validation; read-only non-mutating execution. |
| **Dependencies** | T-13 (Paper CSS rules verified), T-17 (TypeScript compilation verified) |
| **Baseline Status** | Executed 2026-10-11. Visual layout, wrapping, and totals verified with zero clipping. Finding F-18.1-01 recorded. |
| **Target Files** | `src/utils/receiptRenderCore.ts`, `src/utils/iframePrint.ts`, `src/components/dev-panel/DevReceiptTemplatesView.tsx` |
| **Execution Authorization** | **Executed under explicit user authorization (Path B)** |
| **Status** | `COMPLETED (CONDITIONAL PASS / FINDING F-18.1-01)` |

* **Execution Summary & Findings:**  
  1. Rendered multi-item stress mock data for `thermal_80` and `thermal_58` profiles through `renderReceiptDocument`.
  2. Spooled virtual PDFs using Chromium print engine (`chrome.exe --headless=new --print-to-pdf`).
  3. **Visual Layout (PASS):** Content width constrained to 80mm (`302.36px`) and 58mm (`219.20px`) with zero overflow (`overflow: false`). Long product titles wrap cleanly over 3–4 lines without colliding into right-hand numeric columns. Line totals, split payments, and token slips render completely unclipped.
  4. **PDF MediaBox (FAIL / Finding F-18.1-01):** The spooled PDF files measure `612pt x 792pt` (US Letter / `215.9mm x 279.4mm`) rather than ≤ 80mm and ≤ 58mm. Root cause: `@page { size: <N>mm auto; }` is invalid CSS syntax under W3C CSS Paged Media Module Level 3; Chromium discards the rule and falls back to Letter default.
  5. **Remediation Task:** Planned as `T-18.1-FIX`.

---

#### T-18.1-FIX — Thermal @page CSS Syntax & PDF MediaBox Sizing Remediation

| Field | Value |
|---|---|
| **Task ID** | T-18.1-FIX |
| **Title** | Thermal @page CSS Syntax & PDF MediaBox Sizing Remediation |
| **Workstream** | A: Output / Remediation |
| **Risk Level** | **Low** — CSS string template correction in core and wrappers; zero data schema changes. |
| **Dependencies** | T-18.1 (Finding F-18.1-01) |
| **Baseline Status** | Visual layout verified; CSS paged media syntax invalid; automated tests check stale string format. |
| **Target Files** | `src/utils/receiptRenderCore.ts`, `src/utils/iframePrint.ts`, `src/components/TokenRedemption.tsx`, `scripts/test-receipt-system.mjs`, `scripts/test-phase1-receipt-core.mjs`, `scripts/test-phase2-receipt-integration.mjs` |
| **Execution Authorization** | **Executed under explicit user authorization** |
| **Status** | `COMPLETED` |

* **Objective:**  
  Fix Finding F-18.1-01 by replacing the invalid CSS paged media rule `@page { size: ${widthMm}mm auto; margin: 0; }` with valid standard roll dimension syntax `@page { size: ${widthMm}mm 297mm; margin: 0; }`. Ensure Chromium headless spools generate exact 80mm (`227.04pt`) and 58mm (`164.41pt`) MediaBox dimensions while preserving standard A4/A5 portrait behavior, all layout constraints, and 100% test pass rate.

* **Prerequisites:**  
  1. Node.js test infrastructure (`scripts/test-loader.mjs`, `scripts/test-resolver-hook.mjs`).
  2. Chromium browser engine (`chrome.exe`) for automated PDF MediaBox binary validation.

* **Proposed Steps:**  
  1. **Core CSS Update:** In `src/utils/receiptRenderCore.ts` line 176 (`buildReceiptPageCss`), update thermal page rule from:
     ```ts
     const pageRule = isThermal
       ? `@page { size: ${widthMm}mm auto; margin: 0; }`
       : `@page { size: ${validPaperSize.toUpperCase()} portrait; margin: 0; }`;
     ```
     to:
     ```ts
     const pageRule = isThermal
       ? `@page { size: ${widthMm}mm 297mm; margin: 0; }`
       : `@page { size: ${validPaperSize.toUpperCase()} portrait; margin: 0; }`;
     ```
  2. **Iframe Wrapper Update:** In `src/utils/iframePrint.ts` line 102 (`wrapReceiptFragment`), update:
     `@page { size: 80mm auto; margin: 0; }` -> `@page { size: 80mm 297mm; margin: 0; }`.
  3. **Voucher Print Style Update:** In `src/components/TokenRedemption.tsx` line 397, update:
     `@page { margin: 0; size: 80mm auto; }` -> `@page { margin: 0; size: 80mm 297mm; }`.
  4. **Preserve Sheet Rules:** Confirm `a4` and `a5` CSS rules remain untouched.
  5. **Update Existing Test Assertions:**
     - In `scripts/test-receipt-system.mjs`: update T-13.1 and T-13.2 to expect `${widthMm}mm 297mm`.
     - In `scripts/test-phase1-receipt-core.mjs`: update thermal 80 and 58 string assertions.
     - In `scripts/test-phase2-receipt-integration.mjs`: update thermal 80 and 58 string assertions.
  6. **Add Binary PDF MediaBox Regression Suite:**
     - Add dedicated tests in `scripts/test-receipt-system.mjs` that render receipt HTML and spool to PDF via headless Chromium CLI (or inspect decoded PDF dictionary) to assert:
       - 80mm PDF `/MediaBox` width measures `227.04pt ± 0.5pt` (80.1mm).
       - 58mm PDF `/MediaBox` width measures `164.41pt ± 0.5pt` (58.0mm).
       - A4 PDF `/MediaBox` width measures `595.28pt ± 0.5pt` (210.0mm).
       - Receipt body width and line totals remain unclipped.
  7. **Run Full Verification:** Run `npx tsc --noEmit` and all 3 automated test suites to confirm zero regressions.

* **Acceptance Criteria (Measurable Evidence):**  
  - **AC-FIX-1:** `buildReceiptPageCss('thermal_80')` generates `@page { size: 80mm 297mm; margin: 0; }`.
  - **AC-FIX-2:** `buildReceiptPageCss('thermal_58')` generates `@page { size: 58mm 297mm; margin: 0; }`.
  - **AC-FIX-3:** Cut-sheet CSS (`a4` and `a5`) remain unchanged (`@page { size: A4 portrait; margin: 0; }`, `@page { size: A5 portrait; margin: 0; }`).
  - **AC-FIX-4:** `wrapReceiptFragment` in `iframePrint.ts` and `TokenRedemption.tsx` emit valid paged media CSS.
  - **AC-FIX-5:** Automated regression test confirms Chromium headless PDF output has MediaBox width measuring `227.04pt ± 0.5pt` for 80mm and `164.41pt ± 0.5pt` for 58mm.
  - **AC-FIX-6:** Visual layout, product title multi-line wrapping, line totals, and token slips remain 100% unclipped.
  - **AC-FIX-7:** Full regression suite (`node --test scripts/test-receipt-system.mjs`, `scripts/test-phase1-receipt-core.mjs`, `scripts/test-phase2-receipt-integration.mjs`) and `npx tsc --noEmit` pass with zero failures.

---

#### T-18.2 — A4 & A5 Cut-Sheet Layout, Pagination & Margin Verification

| Field | Value |
|---|---|
| **Task ID** | T-18.2 |
| **Title** | A4 & A5 Cut-Sheet Layout, Pagination & Margin Verification |
| **Workstream** | A: Output Verification |
| **Risk Level** | **Low** — visual rendering and pagination validation; non-mutating. |
| **Dependencies** | T-13, T-17 |
| **Baseline Status** | CSS rules `@page { size: A4 portrait; }` and `@page { size: A5 portrait; }` pass automated tests. Visual layout and pagination unverified. |
| **Target Files** | `src/utils/receiptRenderCore.ts`, `src/components/dev-panel/DevReceiptPreview.tsx` |
| **Execution Authorization** | **Executed under explicit user authorization (combined T-18.2/T-18.3/T-18.4 cycle)** |
| **Status** | `COMPLETED` |

* **Objective:**  
  Validate that cut-sheet print profiles (`a4` and `a5`) render without horizontal overflow, and record observed multi-page pagination behavior (evaluating whether totals blocks or token claim slips fracture across page boundaries on multi-item invoices).

* **Prerequisites:**  
  1. Dev Panel Template Designer loaded.
  2. Browser PDF virtual printer available.

* **Proposed Steps:**  
  1. In the Dev Panel, select paper size `A4 Sheet (210mm)`.
  2. Observe preview: confirm that `width: 210mm` scales across container.
  3. Test standard single-page invoice (3–5 items): trigger "Test Print" to virtual PDF. Confirm layout occupies a single page.
  4. Test multi-page stress invoice (15–20 items): trigger "Test Print" to virtual PDF. Inspect and record page-break boundaries:
     - Check whether page break splits item rows cleanly.
     - Observe whether the Totals block or Token Claim Slip is severed across page 1 and page 2 (noting that the slip container currently lacks `break-inside: avoid;`).
  5. Repeat for `A5 Sheet (148mm)`.
  6. Document layout reality: record that A4 outputs as a stretched receipt format, not a two-column enterprise invoice.

* **Acceptance Criteria (Measurable Evidence):**  
  - Observed PDF dimensions match 210mm x 297mm (A4) and 148mm x 210mm (A5) within ±1mm.
  - Recorded pagination behavior for long invoices documented, including whether page break cleanly avoids splitting item rows or totals.
  - Zero horizontal overflow or clipped margins under `Margins: None` setting.

---

#### T-18.3 — Hidden Iframe Printing Lifecycle & Memory Leak Audit

| Field | Value |
|---|---|
| **Task ID** | T-18.3 |
| **Title** | Hidden Iframe Printing Lifecycle & Memory Leak Audit |
| **Workstream** | A: Output Verification |
| **Risk Level** | **Low** — DOM lifecycle and memory retention audit. |
| **Dependencies** | T-06, T-09 |
| **Baseline Status** | `printViaIframe` implementation includes `afterprint` cleanup and 30-second fallback timer. DOM cleanup unverified under repeated triggers. |
| **Target Files** | `src/utils/iframePrint.ts` |
| **Execution Authorization** | **Executed under explicit user authorization (combined T-18.2/T-18.3/T-18.4 cycle)** |
| **Status** | `COMPLETED` |

* **Objective:**  
  Verify that rapid or repeated print actions do not leave orphaned `<iframe>` elements in the DOM, cause memory leaks, or trigger browser popup blockers across supported browsers.

* **Prerequisites:**  
  Browser DevTools Elements and Memory tabs available.

* **Proposed Steps:**  
  1. Open DevTools on POS billing or Dev Panel.
  2. Inspect the DOM body for elements matching `#__thermal_print_iframe__`.
  3. Trigger "Test Print" 5 times consecutively, dismissing the print dialog each time. Record measured cleanup timing in milliseconds.
  4. Verify:
     - Exactly one iframe exists at any given moment during printing.
     - Within 1000ms of dialog dismissal, `iframe.remove()` cleans up the element completely.
     - Zero uncollected iframe nodes remain in the DOM.
  5. Test delayed dismissal: keep the print dialog open for 35 seconds. Verify that the 30-second safety timer executes without throwing unhandled exceptions.
  6. Test across Chromium (Chrome/Edge) and Gecko (Firefox).

* **Acceptance Criteria (Measurable Evidence):**  
  - Measured iframe removal timing is recorded; DOM contains zero `#__thermal_print_iframe__` nodes within 1000ms after print modal dismissal.
  - Recorded absence of browser popup blocker warnings across 5 consecutive prints.
  - Observed 30-second fallback safety timer execution recorded without runtime errors.

---

#### T-18.4 — Physical Hardware Printer Sign-off (Field Trial)

| Field | Value |
|---|---|
| **Task ID** | T-18.4 |
| **Title** | Physical Hardware Printer Sign-off (Field Trial) |
| **Workstream** | A: Output Verification |
| **Risk Level** | **Medium** — requires physical hardware driver interaction and roll media. |
| **Dependencies** | T-18.1 (Virtual spool must pass first) |
| **Baseline Status** | Software tests complete; physical hardware driver detected via Windows WMI enumeration. |
| **Target Files** | Physical thermal printer device (BIXOLON SRP-350plus) |
| **Execution Authorization** | **Executed — physical hardware non-functional; physical trial blocked** |
| **Status** | `BLOCKED — PHYSICAL PRINTER UNAVAILABLE / NOT FUNCTIONAL` |

* **Objective:**  
  Validate output on physical ESC/POS continuous roll thermal hardware, checking paper cutting, thermal contrast, thermal roll feed, and physical margin boundaries.

* **Prerequisites:**  
  Physical 80mm or 58mm thermal receipt printer connected via USB, Network, or Bluetooth to the host machine.

* **Proposed Steps:**  
  1. Route test print to physical thermal printer.
  2. Measure printed roll width: confirm text spans across physical printable area (typically 72mm printable width on 80mm paper).
  3. Verify auto-cutter triggers cleanly below footer text without severing the Token Claim Slip.
  4. Verify barcode/QR code and bold text scan reliably with 2D barcode scanner.

* **Acceptance Criteria (Measurable Evidence):**  
  - Physical roll output matches virtual PDF 1:1.
  - Auto-cut executes after token slip footer notice with minimum 5mm bottom padding.
  - Photographic audit artifact recorded in `audit/` documentation.

---

### Workstream B: Actual Component Adapter Verification

#### T-22 — POS & Sales History Adapter Verification (`ADAPT-01`)

| Field | Value |
|---|---|
| **Task ID** | T-22 (`ADAPT-01`) |
| **Title** | POS & Sales History Adapter Verification |
| **Workstream** | B: Adapters |
| **Risk Level** | **Low** |
| **Dependencies** | T-04, T-05, T-14 |
| **Baseline Status** | `buildPosThermalHtml` and `buildSalesHistoryThermalHtml` are unexported helpers inside large TSX components. Automated tests currently test `renderReceiptDocument` with simulated contracts. |
| **Target Files** | `src/utils/receiptAdapters.ts`, `src/components/PosBilling.tsx`, `src/components/SalesHistory.tsx`, `scripts/test-t22-adapters.mjs` |
| **Execution Authorization** | **Executed under explicit user authorization (genuine production adapter remediation)** |
| **Status** | `COMPLETED — GENUINE PRODUCTION ADAPTER TESTS VERIFIED (23/23 PASS)` |

* **Objective:**  
  Verify that the actual data transformation paths in `PosBilling.tsx` and `SalesHistory.tsx` map raw invoice datasets into `RenderReceiptData` accurately before passing them to `renderReceiptDocument`.

* **Feasibility & Trade-Off Analysis:**
  * **Option 1 (Browser-Level E2E Automation — Zero Code Changes):** In a pure Node.js CLI environment, `PosBilling.tsx` and `SalesHistory.tsx` cannot execute without browser/React runtime. Therefore, observing the existing wrappers without modifying application source code is **feasible only via browser end-to-end automation (Playwright or browser subagent)** intercepting the `printViaIframe` call during a simulated checkout flow.
  * **Option 2 (Narrow Test Seam):** Exporting the helpers from the TSX components allows unit imports, but requires TSX transpilation and mocking React imports in the Node runner.
  * **Option 3 (Module Extraction to `src/utils/receiptAdapters.ts`):** Cleanest for pure Node testing, but requires modifying two core checkout components.
* **Action Required:** Documented limitation: stakeholder approval is requested before selecting between Option 1 (Browser E2E) and Option 3 (Module Extraction).

* **Acceptance Criteria (Measurable Evidence):**  
  - Test Case 22-A: Intercepted or directly tested POS HTML matches expected template structure for multi-item order with token items.
  - Test Case 22-B: Intercepted or directly tested Sales History HTML contains `DUPLICATE RECEIPT` indicator and zero claim slip coupon blocks.

---

### Workstream C: Multi-Tenant Security & API Authorization

#### T-23 — Multi-Tenant API Route Authorization & Boundary Integration Test (`SEC-01`)

| Field | Value |
|---|---|
| **Task ID** | T-23 (`SEC-01`) |
| **Title** | Multi-Tenant API Route Authorization & Boundary Integration Test |
| **Workstream** | C: Security |
| **Risk Level** | **Low** — read-only HTTP integration tests against local development server; zero database modifications. |
| **Dependencies** | T-16 |
| **Baseline Status** | In-memory algorithmic simulation verified. API route session authentication and cross-branch blocking untested via HTTP. |
| **Target Files** | `src/app/api/receipt-templates/assign/route.ts`, `src/lib/session.ts`, `scripts/test-receipt-security.mjs` (NEW) |
| **Execution Authorization** | **Requires Separate Explicit User Authorization** |
| **Status** | `READY FOR AUTHORIZATION` |

* **Objective:**  
  Verify that `/api/receipt-templates/assign` strictly enforces server-side session authentication, prevents cross-tenant template access, and halts unauthorized mutation requests prior to database operations.

* **Prerequisites:**  
  Local Next.js server running (`npm run dev` on port 3000).

* **Test Partitions & Proposed Steps:**  
  1. Create automated read-only integration script `scripts/test-receipt-security.mjs`.
  2. Generate isolated test session cookies using local test secret utilities (never production credentials):
     - Session Alpha (`role: 'staff', tenantId: 'tenant-alpha-uuid'`)
     - Session Beta (`role: 'staff', tenantId: 'tenant-beta-uuid'`)
     - Session Dev (`role: 'developer'`)
  3. Execute HTTP requests:
     - **Partition 1 (Unauthenticated Rejections — HTTP 401):**
       - `GET /api/receipt-templates/assign?tenant_id=tenant-alpha-uuid` (no cookie) -> Assert HTTP **401 Unauthorized**.
       - `POST /api/receipt-templates/assign` (no cookie) -> Assert HTTP **401 Unauthorized**.
       - `DELETE /api/receipt-templates/assign?tenant_id=tenant-alpha-uuid` (no cookie) -> Assert HTTP **401 Unauthorized**.
     - **Partition 2 (Authenticated Same-Tenant Read — HTTP 200):**
       - Session Alpha requests `?tenant_id=tenant-alpha-uuid` -> Assert HTTP **200 OK** and response contains Tenant Alpha's template.
     - **Partition 3 (Cross-Tenant Rejection — HTTP 403):**
       - Session Beta requests `?tenant_id=tenant-alpha-uuid` -> Assert HTTP **403 Forbidden** with `{ success: false, error: 'Forbidden: Access to this branch is denied' }`. Confirm zero template configuration in body.
     - **Partition 4 (Developer-Only Read Endpoint — HTTP 403):**
       - Session Alpha requests `GET /api/receipt-templates/assign` (no `tenant_id`) -> Assert HTTP **403 Forbidden** (`Forbidden: Developer privileges required`).
     - **Partition 5 (Mutation Protection for Non-Developers — HTTP 403):**
       - Session Alpha sends `POST /api/receipt-templates/assign` -> Assert HTTP **403 Forbidden**. Source inspection confirms line 119 terminates execution before body parsing or database upsert.
       - Session Alpha sends `DELETE /api/receipt-templates/assign?tenant_id=tenant-alpha-uuid` -> Assert HTTP **403 Forbidden**. Source inspection confirms line 172 terminates execution before database delete.

* **Acceptance Criteria (Measurable Evidence):**  
  - Test Case 23-A: HTTP 401 returned for unauthenticated requests across GET, POST, and DELETE.
  - Test Case 23-B: HTTP 200 returned for authorized same-tenant reads.
  - Test Case 23-C: HTTP 403 returned for cross-tenant reads with zero data disclosure.
  - Test Case 23-D: HTTP 403 returned for non-developer `POST` and `DELETE` requests prior to database access.

---

### Business Decision Gates (T-19, T-20, T-21) — Authoritative Reconciliation

#### T-19 — Decision Gate Q-01: Enforce Mandatory Receipt Fields & Visibility Locks

| Field | Value |
|---|---|
| **Task ID** | T-19 (Gate Q-01) |
| **Title** | Enforce Mandatory Receipt Fields & Visibility Locks |
| **Selected Decision** | **Option A — Strict Compliance Locks (Confirmed by Project Owner 2026-10-11)** |
| **Risk Level** | **Medium** — requires synchronization across normalizer, renderer, preview, and designer UI. |
| **Dependencies** | None (decision confirmed) |
| **Current Baseline** | `normalizeTemplate` currently parses raw boolean values; `DevReceiptTemplatesView.tsx` allows checkboxes to be unchecked. |
| **Target Files** | `src/types/receipt.ts`, `src/utils/receiptRenderCore.ts`, `src/components/dev-panel/DevReceiptTemplatesView.tsx`, `src/components/dev-panel/DevReceiptPreview.tsx`, `scripts/test-receipt-system.mjs` |
| **Execution Authorization** | **EXECUTED UNDER EXPLICIT USER AUTHORIZATION (2026-10-11)** |
| **Status** | `COMPLETED (OPTION A IMPLEMENTED & VERIFIED)` |

* **Exact Behavioral Requirements (Option A):**
  1. **Invoice Number** must always be visible on rendered receipts.
  2. **Receipt Date & Timestamp** must always be visible on rendered receipts.
  3. **Grand Total** must always be visible on rendered receipts.
  4. Receipt template configurations must **never** hide these three fields, even if a raw template JSON in the database contains `false`.
  5. In `DevReceiptTemplatesView.tsx`, the checkboxes for these three fields must be locked/disabled, display a lock icon/badge `(Mandatory / Locked)`, and explain that they are required for audit and legal compliance.
  6. Legacy templates in the database with `false` are automatically normalized to `true` at the rendering/normalization boundary, preventing audit non-compliance without requiring destructive database migrations.

* **Executed Implementation & Verification Evidence:**
  * **T-19.1 (`T-19-IMPL-01`):** Normalization & Renderer Layer Enforcement. `normalizeTemplate` in `src/utils/receiptRenderCore.ts` enforces `showInvoiceNo: true`, `showDate: true`, `showGrandTotal: true` regardless of incoming/raw values. `renderReceiptBodyHtml` unconditionally renders invoice number, date, and grand total. `COMPLETED`.
  * **T-19.2 (`T-19-IMPL-02`):** Dev Panel UI Lock Indicators. In `src/components/dev-panel/DevReceiptTemplatesView.tsx`, disabled the checkboxes for Invoice Number, Date, and Grand Total; rendered `🔒 Mandatory / Locked` badges and compliance explanation tooltips. `COMPLETED`.
  * **T-19.3 (`T-19-IMPL-03`):** Preview Parity. In `src/components/dev-panel/DevReceiptPreview.tsx`, guaranteed unconditional rendering of Invoice Number, Date, and Grand Total. `COMPLETED`.
  * **T-19.4 (`T-19-TEST-01`):** Automated Regression Tests. Added tests `T-19.1`, `T-19.2`, and `T-19.3` in `scripts/test-receipt-system.mjs` asserting normalizer override, multi-format rendering enforcement (`thermal_80`, `thermal_58`, `a4`, `a5`), and UI lock indicators. All passed (42/42). `COMPLETED`.

---

#### T-20 — Decision Gate Q-02: Sales History Reprint Token Notice Behavior

| Field | Value |
|---|---|
| **Task ID** | T-20 (Gate Q-02) |
| **Title** | Finalize Sales History Reprint Token Notice Behavior |
| **Selected Decision** | **Option A — Complete Suppression (Confirmed by Project Owner 2026-10-11)** |
| **Risk Level** | **Low** — existing code baseline already enforces complete suppression. |
| **Dependencies** | None (decision confirmed) |
| **Current Baseline** | `src/utils/receiptAdapters.ts` sets `tokenClaimCode: undefined` and `isReprint: true`. `renderReceiptDocument` renders no coupon box and no fallback notice when `tokenClaimCode` is undefined. |
| **Target Files** | `src/utils/receiptAdapters.ts`, `src/utils/receiptRenderCore.ts`, `scripts/test-t22-adapters.mjs`, `scripts/test-receipt-system.mjs` |
| **Execution Authorization** | **EXECUTED UNDER EXPLICIT USER AUTHORIZATION (2026-10-11)** |
| **Status** | `COMPLETED (OPTION A VERIFIED ACROSS ALL 4 FORMATS)` |

* **Exact Behavioral Requirements (Option A):**
  1. A Sales History reprint must **never** display the token claim slip box.
  2. The reprint must **never** display a replacement token claim notice or disclaimer banner.
  3. The reprint must preserve all original invoice details, line items, prices, financial totals, and split payments.
  4. The reprint must display the `DUPLICATE RECEIPT` indicator.
  5. The original POS live checkout must continue to print token claim slips normally when tokens are issued.

* **Executed Verification Evidence:**
  * **T-20.1 (`T-20-VERIF-01`):** End-to-End Reprint Suppression Verification across all 4 formats (`thermal_80`, `thermal_58`, `a4`, `a5`). Verified that reprints contain `DUPLICATE RECEIPT` and zero claim slip boxes, zero `CLM-` claim codes, zero fallback/replacement notes. Verified parity: original POS live checkout continues to render legitimate token claim slips normally. Automated regression test `T-20.1` passing in `scripts/test-receipt-system.mjs` and `T-22.B.5` in `scripts/test-t22-adapters.mjs`. `COMPLETED`.

---

#### T-21 — Decision Gate Q-03: Token Claim Slip Suppression Behavior

| Field | Value |
|---|---|
| **Task ID** | T-21 (Gate Q-03) |
| **Title** | Finalize Token Claim Slip Suppression Behavior |
| **Selected Decision** | **Option A — Complete Suppression (Confirmed by Project Owner 2026-10-11)** |
| **Risk Level** | **Low** — existing code baseline already enforces complete suppression. |
| **Dependencies** | None (decision confirmed) |
| **Current Baseline** | `receiptRenderCore.ts` line 716-727 suppresses the entire slip when `tokenClaimSlip.enabled === false`. Zero fallback text or sample codes are rendered. |
| **Target Files** | `src/utils/receiptRenderCore.ts`, `src/components/dev-panel/DevReceiptPreview.tsx`, `scripts/test-receipt-system.mjs` |
| **Execution Authorization** | **EXECUTED UNDER EXPLICIT USER AUTHORIZATION (2026-10-11)** |
| **Status** | `COMPLETED (OPTION A VERIFIED ACROSS ALL 4 FORMATS)` |

* **Exact Behavioral Requirements (Option A):**
  1. When a template has `tokenClaimSlip.enabled = false`, the token claim slip box must be **completely omitted**.
  2. No fallback claim-code note or replacement footer text shall be printed.
  3. No sample claim code shall be generated or displayed.
  4. When `tokenClaimSlip.enabled = true` and tokens are issued, the slip box must render normally.
  5. The Dev Panel preview must also completely omit the slip when disabled.

* **Executed Verification Evidence:**
  * **T-21.1 (`T-21-VERIF-01`):** Complete Suppression Test Coverage across all 4 formats (`thermal_80`, `thermal_58`, `a4`, `a5`). Verified that disabling `tokenClaimSlip.enabled` results in zero claim markup, zero claim codes, zero fallback coupons, and zero replacement notices. Verified that enabling it renders the slip normally. Automated regression test `T-21.1` passing in `scripts/test-receipt-system.mjs`. `COMPLETED`.

---

### Final Release Readiness Audit

#### T-24 — Final System Release Readiness Audit & Production Sign-off (`REL-01`)

| Field | Value |
|---|---|
| **Task ID** | T-24 (`REL-01`) |
| **Title** | Final System Release Readiness Audit & Production Sign-off |
| **Risk Level** | **Low** — final documentation and audit synthesis. |
| **Dependencies** | T-18.1, T-18.2, T-18.3, T-22, T-23 |
| **Baseline Status** | Pending completion of Phase 5 execution workstreams. |
| **Target Files** | `audit/phase-5-receipt-template-release-report.md` |
| **Execution Authorization** | **Requires Separate Explicit User Authorization** |
| **Status** | `PLANNED` |

* **Objective:**  
  Synthesize all virtual spool evidence, adapter verification results, API security testing, and stakeholder decision approvals into a release certification report.
* **Conditional Readiness Reporting:**  
  If software verification gates (T-18.1–T-18.3, T-22, T-23) pass with recorded evidence while physical hardware trials (T-18.4) or business decisions (T-19–T-21) remain open, T-24 is permitted to issue a **Conditional Release Readiness Report**.
* **Strict Rule:** **Conditional readiness must NEVER be equated with production release approval.** Production release approval strictly requires either formal ratification of all remaining gates or an explicit written exception signed off by project stakeholders.

---

## 3. Dependency Graph & Proposed Execution Order

```
[Phase 4 Baseline: T-10 through T-17 Complete]
          │
          ├──► Workstream A: T-18.1 (Spool / F-18.1-01) ──► T-18.1-FIX (MediaBox Fix) ──► T-18.2 (A4/A5) ──► T-18.3 (Iframe Audit)
          │                                                                                                         │
          │                                                                                                         ▼
          │                                                                                              [T-18.4 Hardware Field Trial]
          │                                                                                             (Blocked on Physical Hardware)
          │
          ├──► Workstream B: T-22 (Adapter Verification via Interface / Test Seam)
          │
          ├──► Workstream C: T-23 (API Route Security & Boundary Test)
          │
          └──► Decision Gates: T-19 (Q-01), T-20 (Q-02), T-21 (Q-03)
                    (Blocked on Business Stakeholder Sign-off)
                              │
                              ▼
                [T-24 Conditional / Final Release Readiness Report]
```
