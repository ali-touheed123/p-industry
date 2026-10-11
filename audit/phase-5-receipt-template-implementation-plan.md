# Phase 5 — Receipt Template System Implementation Plan (Validated & Corrected)
## Release Readiness, Multi-Format Output Verification & Integration Architecture

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** Phase 5 — Release Readiness, Printer Verification & Integration Evidence  
**Status:** `PLANNING AND DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED`  
**Date:** 2026-10-11  

---

## 1. Executive Summary & Objective

The PyntFlow Receipt Template System has progressed through foundational type design (Phase 1), core document rendering integration in POS and Sales History (Phase 2), Dev Panel designer and watermarked preview controls (Phase 3), and automated test suite creation (Phase 4).

The objective of **Phase 5** is to bridge the gap between in-memory automated test validation and verified production release readiness. This document establishes an actionable, safe, non-mutating plan covering:

1. **Output & Printer Spool Verification (T-18):** Validating physical and virtual print rendering across 80mm thermal roll, 58mm thermal roll, A4 sheet portrait, PDF drivers, multi-page page breaks, and hidden iframe DOM lifecycles.
2. **Component Adapter Verification Options (Workstream B / T-22):** Formally evaluating options to verify the real adapter transformation paths in `PosBilling.tsx` and `SalesHistory.tsx`, documenting the limits of interface-level testing without browser automation.
3. **Multi-Tenant Security & API Route Boundary Verification (Workstream C / T-23):** Verifying server-side tenant authentication and authorization in `/api/receipt-templates/assign` across read and mutation methods, distinguishing authentication failures (401) from authorization failures (403).
4. **Business Decision Gates (T-19, T-20, T-21):** Formalizing options, trade-offs, and implementation paths for mandatory field locks, duplicate reprint token disclosures, and token slip suppression policies without pre-empting stakeholder decisions.

---

## 2. Baseline Reconciliation: Previous Plans vs. Repository Reality

A forensic comparison between the approved Phase 1–4 documents, the Phase 4 verification report, and the actual codebase reveals several architectural nuances that govern Phase 5 planning:

| Dimension | Previous Plan / Documentation | Actual Codebase Reality | Phase 5 Planning Impact |
|---|---|---|---|
| **Phase 1–3 Implementation** | Marked `COMPLETED` in task register. | Source code inspection of `receiptRenderCore.ts`, `PosBilling.tsx`, `SalesHistory.tsx`, `DevReceiptTemplatesView.tsx`, `DevReceiptPreview.tsx`, and `iframePrint.ts` confirms full implementation. | Baseline verified intact. |
| **Phase 4 Automated Tests** | Reported 32 dedicated tests, 55 regression tests, 0 TS errors. | Independently confirmed: `node --test scripts/test-receipt-system.mjs` (32/32 pass), combined suite (55/55 pass), `npx tsc --noEmit` (exit code 0). | Test automation baseline verified. |
| **T-18.1 Virtual Spool Evidence & Finding F-18.1-01** | Planned virtual PDF spool verification for 80mm and 58mm profiles. | Executed under explicit user authorization. Visual layout, wrapping, and column totals passed. Discovered critical defect **F-18.1-01**: `@page { size: <N>mm auto; }` is invalid CSS per W3C specification; Chromium discards the rule and spools US Letter (`612pt x 792pt`) PDFs. | **Remediation required (T-18.1-FIX):** Update thermal `@page` syntax to valid dimensions (`${widthMm}mm 297mm`) and add automated PDF MediaBox regression tests. |
| **T-14 POS / Sales History Parity** | Plan expected testing `buildPosThermalHtml` and `buildSalesHistoryThermalHtml` directly. | Functions are **unexported private helpers** inside 2,600+ line TSX components. Automated tests verified `renderReceiptDocument` using identical data contract payloads. | **Workstream B analysis required:** Document why interface-level observation without code changes requires browser automation, and request approval. |
| **T-16 Multi-Tenant Isolation** | Plan expected verifying multi-tenant template separation. | Automated tests verified an **in-memory algorithmic simulation** of the template resolution cascade. | **Workstream C required:** Define a safe, non-mutating API route integration test without risking database corruption. |
| **Tenant Isolation Enforcement Layer** | Often assumed to be PostgreSQL Row-Level Security (RLS). | `/api/receipt-templates/assign` uses `supabaseAdmin` (Service Role key), enforcing tenant isolation at the **Next.js API layer** via `requireTenantAuth(req, tenant_id)`. | Security testing must target API route session authentication headers and status codes, not client-side RLS queries. |
| **A4 Sheet Support Reality** | Mentioned alongside 80mm and 58mm thermal rolls. | Supported at the CSS rule level (`@page { size: A4 portrait; margin: 0; }`, `width: 210mm`), but the HTML content is a **single-column receipt layout stretched to 210mm**, not a traditional tabular ERP invoice. | **Workstream A required:** Document layout reality; evaluate whether stretched receipt meets client expectations. |
| **T-19, T-20, T-21 Decision Gates** | Listed as `BLOCKED — APPROVAL REQUIRED`. | Code currently allows full field toggling (Q-01), suppresses token slips on reprint (Q-02), and suppresses token slips when disabled (Q-03). | Tasks remain strictly blocked pending business stakeholder sign-off. |

### Classification of Evidence Tiers
To ensure technical honesty, Phase 5 enforces strict categorization of all verification evidence:

1. **Tier 1 — Source-Code Inspection:** Direct code reading of function definitions, parameters, and call sites.
2. **Tier 2 — Pure Automated Unit & Contract Tests:** Node.js asserts against pure functions (`receiptRenderCore.ts`). *(Phase 4 complete)*
3. **Tier 3 — Browser / PDF Spool Rendering Evidence:** Measured PDF dimensions, observed page breaks, browser settings, and recorded iframe DOM lifecycle events. *(Planned in Workstream A)*
4. **Tier 4 — Physical Hardware Print Evidence:** Direct hardware verification on physical ESC/POS thermal printers with photographic audit records. *(Planned in Workstream A)*

---

## 3. Workstream A — T-18 Printer & Output Verification Plan

### 3.1 Scope of Profiles
1. **Thermal 80mm Roll (`thermal_80`):** Standard retail POS continuous roll printer (e.g. Epson TM-T88, Xprinter XP-N160, Sunmi desktop).
2. **Thermal 58mm Roll (`thermal_58`):** Narrow compact mobile or desktop thermal printer (e.g. 58mm Bluetooth/USB receipt printers).
3. **A4 Sheet Portrait (`a4`):** Standard office/warehouse laser or inkjet printer on standard 210mm x 297mm cut sheets.
4. **A5 Sheet Portrait (`a5`):** Half-page ledger/counter cut sheet (148mm x 210mm).
5. **Virtual PDF Output:** Chrome/Edge "Save as PDF", Microsoft Print to PDF.

### 3.2 Layout, Pagination & Page-Break Analysis
Inspection of `renderReceiptBodyHtml` in `src/utils/receiptRenderCore.ts` shows:
* **Thermal Continuous Roll (80mm & 58mm):** Continuous roll paper feeds indefinitely until the cut command. In browser spoolers, `@page { size: 80mm auto; margin: 0; }` eliminates page breaks.
* **Cut-Sheet Paper (A4 & A5):** Multi-item invoices spanning beyond 297mm (A4) or 210mm (A5) will trigger browser page breaks.
  * *Critical Observation:* In `src/utils/receiptRenderCore.ts` line 720, the token claim slip container has `style="border:1px dashed #000;padding:8px;margin-top:10px;text-align:center"`. It lacks explicit CSS `break-inside: avoid; page-break-inside: avoid;`.
  * *Risk:* On long cut-sheet invoices, a browser page break could slice the Token Claim Slip across two physical pages.
  * *Verification Requirement:* Test multi-item invoices (15–20 lines) to observe pagination boundaries and ensure totals rows and claim slips do not fracture awkwardly across page breaks.

### 3.3 Reality Check: A4 Layout Structure
* When `a4` is selected, `buildReceiptPageCss` emits:
  ```css
  @page { size: A4 portrait; margin: 0; }
  body { width: 210mm; max-width: 210mm; margin: 0 auto; padding: 4mm 4mm 6mm 4mm; }
  ```
* The HTML body elements render vertically in sequence: logo, shop name, metadata rows, items table, totals, footer, token slip.
* **Finding:** While mathematically valid for A4 paper, the content appears as a "wide receipt" across the 210mm page. It does not re-flow into a two-column tax invoice or include customer bill-to/ship-to address blocks.
* **Phase 5 Recommendation:** Verify that A4 prints cleanly without horizontal overflow, but explicitly document this layout characteristic so stakeholders understand it is a cut-sheet receipt format rather than an ERP billing sheet.

### 3.4 Hidden Iframe Printing Lifecycle (`iframePrint.ts`)
The printing mechanism in `src/utils/iframePrint.ts` operates via:
1. `document.getElementById('__thermal_print_iframe__')?.remove()` to eliminate previous orphaned iframes.
2. Creates an invisible iframe positioned off-screen (`top: -10000px`, `visibility: hidden`).
3. Injects self-contained HTML containing the document styles.
4. Attaches an `afterprint` listener with a 500ms grace period to remove the iframe.
5. Sets a 30-second safety timeout fallback (`setTimeout(..., 30000)`) in case `afterprint` is intercepted or suppressed by the browser.
6. Synchronously calls `iframe.contentWindow.focus()` and `iframe.contentWindow.print()`.

#### Verification Checks:
* **Orphan Accumulation:** Rapid repeated clicking of "Print" must not spawn multiple uncollected DOM iframes.
* **Premature Destruction:** Long pauses in the browser print preview modal must not detach the iframe before printing initiates (governed by the 30-second safety timer).
* **Popup Blocker Interception:** Ensure no browser blocks the modal across Chrome, Edge, and Firefox.
* **Browser Compatibility:** Verify on Chromium (Chrome/Edge) and Gecko (Firefox) engines.

### 3.5 Verification Methodology (Zero Mutation Guarantee)
To avoid mutating live store records or generating fake inventory movements:
* All print tests must use **standardized static mock payloads** (such as the standard dataset in `scripts/test-receipt-system.mjs`) or existing completed historical invoices from a sandbox/dev tenant.
* Never trigger print tests from the live checkout submit button with real stock. Use the Dev Panel Template Designer's "Test Print" button (`DevReceiptTemplatesView.tsx`), which renders mock data through `printViaIframe`.

### 3.6 Thermal `@page` Paged Media Remediation Architecture (F-18.1-01 Fix Plan)

During T-18.1 execution, virtual spooling to Chromium's print engine revealed a subtle CSS paged media parsing failure:

#### 1. Forensic Root Cause
* **Current Code:** In `src/utils/receiptRenderCore.ts` (line 176):
  ```ts
  const pageRule = isThermal
    ? `@page { size: ${widthMm}mm auto; margin: 0; }`
    : `@page { size: ${validPaperSize.toUpperCase()} portrait; margin: 0; }`;
  ```
  Identical syntax appears in `src/utils/iframePrint.ts` (`@page { size: 80mm auto; margin: 0; }`) and `src/components/TokenRedemption.tsx` (`@page { margin: 0; size: 80mm auto; }`).
* **Specification Conflict:** The W3C CSS Paged Media Module Level 3 specification defines the grammar of `size` as:
  `size: [ <length>{1,2} | auto | [ [ [ a5 | a4 | a3 | b5 | b4 | letter | legal | ledger ] || [ portrait | landscape ] ] ] ]`
  Combining a `<length>` with `auto` (`size: 80mm auto;`) is **syntactically invalid**.
* **Browser Parser Behavior:** When Chromium/Blink parses `@page { size: 80mm auto; }`, it encounters a syntax error and **discards the entire `size` declaration**.
* **Virtual Spool Consequence:** Because the rule is discarded, virtual PDF engines ("Save as PDF", "Microsoft Print to PDF", or headless CLI) fall back to the driver's default page size (US Letter: `612pt x 792pt` / `215.9mm x 279.4mm`). While the internal HTML body is constrained to 80mm/58mm, the resulting PDF is Letter-sized.

#### 2. Experimental Verification of CSS Sizing Alternatives
* **Single `<length>` (`@page { size: 80mm; }`):**
  Per CSS spec, a single length sets both width and height to that value (square: 80mm × 80mm). Experimental testing with a 30-item receipt proved this causes **excessive pagination chopping**, breaking a single receipt into multiple 80mm × 80mm square pages.
* **Standard Roll Cut Segment (`@page { size: ${widthMm}mm 297mm; }`):**
  Using a defined standard segment length (297mm, the length of an A4 sheet and standard Windows POS thermal roll segment):
  * Headless Chromium parsed the rule immediately and generated a PDF with `/MediaBox [0, 0, 227.04, 841.92]` (exact width: `80.1mm`, height: `297.0mm`).
  * For 58mm profiles, `/MediaBox [0, 0, 164.41, 841.92]` (exact width: `58.0mm`, height: `297.0mm`).
  * Normal retail receipts fit completely within a single roll segment without unnecessary pagination breaks.
  * Very long industrial invoices (30+ items) paginate cleanly across 297mm segments without text truncation.

#### 3. Scope of Affected Files & Target Remediation
1. `src/utils/receiptRenderCore.ts`:
   Update `buildReceiptPageCss` to emit `@page { size: ${widthMm}mm 297mm; margin: 0; }` for thermal profiles.
2. `src/utils/iframePrint.ts`:
   Update fallback wrapper in `wrapReceiptFragment` to emit `@page { size: 80mm 297mm; margin: 0; }`.
3. `src/components/TokenRedemption.tsx`:
   Update redemption voucher print style to `@page { margin: 0; size: 80mm 297mm; }`.
4. `src/types/receipt.ts`:
   Preserve existing types completely. (No breaking changes to `LayoutConfig` or `PaperSize`).
5. **A4 & A5 Protection:**
   Cut-sheet profiles (`a4`, `a5`) remain completely unchanged (`@page { size: A4 portrait; margin: 0; }` and `@page { size: A5 portrait; margin: 0; }`).

#### 4. Automated Regression & MediaBox Verification Suite
* **Unit Level:** Update existing string assertions in `scripts/test-receipt-system.mjs` (T-13.1, T-13.2), `scripts/test-phase1-receipt-core.mjs`, and `scripts/test-phase2-receipt-integration.mjs` to assert the valid `${widthMm}mm 297mm` syntax.
* **Binary PDF Level:** Introduce new automated test cases executing headless Chromium CLI or direct PDF buffer inspection to verify:
  * 80mm profile produces PDF with MediaBox width of `227.04pt ± 0.5pt` (80.1mm).
  * 58mm profile produces PDF with MediaBox width of `164.41pt ± 0.5pt` (58.0mm).
  * A4 profile produces PDF with MediaBox width of `595.28pt ± 0.5pt` (210.0mm).
  * HTML layout, column boundaries, line totals, and token slips remain 100% unclipped.

---

## 4. Workstream B — Component Adapter Verification Analysis (T-22)

### 4.1 Technical Feasibility of Interface-Level Observation
`buildPosThermalHtml` (in `PosBilling.tsx`) and `buildSalesHistoryThermalHtml` (in `SalesHistory.tsx`) are unexported private helper functions embedded inside React client components.

* **Can interface-level testing observe this HTML in a pure Node.js CLI script?**
  * **No.** `PosBilling.tsx` and `SalesHistory.tsx` cannot be executed in a Node.js CLI test runner without a full React DOM runtime, context providers, and browser mocks.
* **Can interface-level testing observe this HTML in a real browser environment?**
  * **Yes, but only via browser end-to-end automation (Playwright/Puppeteer or browser subagent)** intercepting the `iframe` DOM element or `printViaIframe` call during a checkout interaction.
* **What if automated testing without browser infrastructure is required?**
  * It requires introducing an application code change: either exporting the helpers directly (narrow test seam) or extracting them into a dedicated module (`src/utils/receiptAdapters.ts`).

### 4.2 Comparison of Approaches

| Approach | Implementation Details | Regression Risk | Tooling Prerequisites | Feasibility Without Code Changes |
|---|---|:---:|:---:|:---:|
| **Approach 1: Browser-Level E2E Automation (Recommended for Zero Source Changes)** | Use browser automation (Playwright or browser subagent) to drive POS / Sales History UI in development and intercept the generated iframe HTML. | **Zero source code modification** | Requires running browser session and dev server | **Feasible without application-source edits** |
| **Approach 2: Narrow Test Seam (Export Helpers)** | Add `export` keyword to `buildPosThermalHtml` in `PosBilling.tsx` and `buildSalesHistoryThermalHtml` in `SalesHistory.tsx`. | **Very low** (Adding `export` does not alter runtime execution) | Pure Node.js test runner (requires TSX import handling) | **Requires code change** (2 exports added) |
| **Approach 3: Module Decoupling (`receiptAdapters.ts`)** | Extract mapping logic from both TSX files into a pure module `src/utils/receiptAdapters.ts`. Components import from new utility. | **Low to Moderate** (Modifies two core checkout components) | Pure Node.js test runner | **Requires code change** (2 components refactored) |

### 4.3 Recommendation & Action Required
* **Recommendation:** If zero source code changes is an inviolable requirement, **Approach 1 (Browser-Level E2E Automation)** must be selected. If lightweight Node.js unit testing is preferred, **Approach 3** is architecturally superior to Approach 2.
* **Action Required:** T-22 remains in `READY FOR AUTHORIZATION` with explicit documentation of this limitation. Stakeholder approval is required to select between Approach 1 (Browser E2E) and Approach 3 (Module Decoupling) before any implementation begins.

---

## 5. Workstream C — Multi-Tenant Security & API Route Boundary Verification (T-23)

### 5.1 Route Handler & Enforcement Architecture
Forensic source inspection of `src/app/api/receipt-templates/assign/route.ts` and `src/lib/session.ts` reveals:
1. **Endpoint Overview:**
   * `GET /api/receipt-templates/assign?tenant_id=XYZ`: Single tenant assignment lookup.
   * `GET /api/receipt-templates/assign`: Dev-only list of all tenant assignments.
   * `POST /api/receipt-templates/assign`: Dev-only upsert of template assignment.
   * `DELETE /api/receipt-templates/assign?tenant_id=XYZ`: Dev-only deletion of assignment (reverts to default).
2. **Authorization Enforcement:**
   * In `GET` (single tenant): Lines 14–17 execute `const auth = await requireTenantAuth(req, tenant_id);`. If `!auth.authorized`, returns `NextResponse.json({ success: false, error: auth.error }, { status: auth.status })` (**401** for unauthenticated, **403** for unauthorized).
   * In `GET` (all tenants): Lines 72–75 execute `const devAuth = await requireDevAuth(req);`. If `!devAuth.authorized`, returns **401** or **403**.
   * In `POST`: Lines 118–122 execute `const auth = await requireDevAuth(req);`. **Authorization is checked immediately at the start of the function, before reading request body or touching the database.**
   * In `DELETE`: Lines 171–175 execute `const auth = await requireDevAuth(req);`. **Authorization is checked immediately at the start of the function, before reading search params or touching the database.**
3. **Database Access Path:**
   * Database queries use `supabaseAdmin` (Service Role key), which bypasses PostgreSQL Row-Level Security (RLS).
   * **Crucial Finding:** Multi-tenant template isolation is enforced **exclusively at the Next.js API layer** by `requireTenantAuth` and `requireDevAuth`, not by PostgreSQL RLS.

### 5.2 Test Partitioning (Distinguishing Authentication vs. Authorization)
All integration tests must be read-only or fail authentication/authorization prior to state changes:

1. **Authentication Failures (HTTP 401):**
   * `GET /api/receipt-templates/assign?tenant_id=any` with no cookie -> Expected: **HTTP 401 Unauthorized** (`Unauthorized: Valid login session required`).
   * `POST /api/receipt-templates/assign` with no cookie -> Expected: **HTTP 401 Unauthorized** (`Unauthorized: Login session required`).
   * `DELETE /api/receipt-templates/assign?tenant_id=any` with no cookie -> Expected: **HTTP 401 Unauthorized** (`Unauthorized: Login session required`).
2. **Authorization Failures — Cross-Tenant Read (HTTP 403):**
   * Valid session JWT for Tenant B accessing `?tenant_id=Tenant_A` -> Expected: **HTTP 403 Forbidden** (`Forbidden: Access to this branch is denied`). Zero template configuration leaked.
3. **Authorization Failures — Non-Developer Access to Admin Endpoints (HTTP 403):**
   * Valid non-developer session requests `GET /api/receipt-templates/assign` (no `tenant_id`) -> Expected: **HTTP 403 Forbidden** (`Forbidden: Developer privileges required`).
   * Valid non-developer session sends `POST /api/receipt-templates/assign` -> Expected: **HTTP 403 Forbidden**. Authorization check halts execution before body parsing or database upsert.
   * Valid non-developer session sends `DELETE /api/receipt-templates/assign?tenant_id=any` -> Expected: **HTTP 403 Forbidden**. Authorization check halts execution before database delete.
4. **Authorized Same-Tenant Reads (HTTP 200):**
   * Valid session JWT for Tenant A accessing `?tenant_id=Tenant_A` -> Expected: **HTTP 200 OK** with Tenant A's assigned template (or platform default if unassigned).

*Safety Rule:* Only valid, isolated test sessions generated via local test secret utilities may be used. Never use production credentials.

---

## 6. Business Decision Gates: Authoritative Reconciliation & Task Breakdown

On 2026-10-11, the project owner confirmed **Option A** for all three decision gates. This section supersedes previous open trade-off discussions and establishes actionable requirements and task plans.

### 6.1 Decision Gate Q-01 / T-19: Mandatory Receipt Fields Visibility Locks
* **Selected Decision:** **Option A — Strict Compliance Locks (CONFIRMED)**
* **Requirements:**
  1. `showInvoiceNo`, `showDate`, and `showGrandTotal` must **always be visible** on all rendered receipts.
  2. Receipt templates must not be permitted to hide these three fields under any circumstances.
  3. In `DevReceiptTemplatesView.tsx`, the toggles for these three fields must be locked/disabled, display a lock icon with a `(Mandatory / Locked)` badge, and provide an explanatory tooltip indicating they are required for audit and retail compliance.
  4. In `normalizeTemplate` (`src/utils/receiptRenderCore.ts`), these three fields must be clamped/enforced to `true` regardless of incoming raw template JSON. This ensures legacy templates in the database with `false` will render compliantly without requiring a destructive database migration.
  5. `DevReceiptPreview.tsx` must maintain 100% parity with the printed output by displaying these three fields.
* **Planned Implementation Subtasks (Awaiting Separate Authorization):**
  * `T-19-IMPL-01`: Update `normalizeTemplate` in `src/utils/receiptRenderCore.ts` to clamp `showInvoiceNo: true`, `showDate: true`, `showGrandTotal: true`.
  * `T-19-IMPL-02`: In `DevReceiptTemplatesView.tsx`, disable the toggles for Invoice Number, Date, and Grand Total; render lock badges and explanatory text.
  * `T-19-IMPL-03`: Verify `DevReceiptPreview.tsx` reflects mandatory rendering.
  * `T-19-TEST-01`: Add regression tests in `scripts/test-receipt-system.mjs` verifying that template configurations attempting to pass `false` for these fields are overridden to `true`.

### 6.2 Decision Gate Q-02 / T-20: Historical Sales History Reprint Token Notice
* **Selected Decision:** **Option A — Complete Suppression (CONFIRMED)**
* **Requirements:**
  1. Sales History reprints must **never** display the token claim slip box.
  2. The reprint must **never** display an alternative or replacement token claim notice/banner.
  3. Existing reprint mapping behavior in `src/utils/receiptAdapters.ts` (`tokenClaimCode: undefined`, `isReprint: true`) already ensures complete suppression.
  4. The duplicate receipt watermark (`DUPLICATE RECEIPT`) must be preserved.
  5. Original live POS checkout printing must continue to issue active token claim slips when tokens are qualified.
* **Code Impact & Findings:**
  * Inspection of `src/utils/receiptAdapters.ts` and `src/utils/receiptRenderCore.ts` confirms that the current production implementation **already satisfies Option A**.
* **Planned Verification Subtask (Awaiting Separate Authorization):**
  * `T-20-VERIF-01`: Run dedicated verification suite ensuring that reprint HTML output contains zero claim code boxes, zero claim slip text, and zero replacement notices across thermal and cut-sheet profiles.

### 6.3 Decision Gate Q-03 / T-21: Token Claim Slip Suppression Behavior
* **Selected Decision:** **Option A — Complete Suppression (CONFIRMED)**
* **Requirements:**
  1. When a template specifies `tokenClaimSlip.enabled = false`, the token claim slip box must be **completely omitted**.
  2. No fallback claim-code note or replacement footer text shall be printed.
  3. No sample claim code shall be generated or substituted.
  4. Original sales using enabled templates must retain full claim slip functionality.
* **Code Impact & Findings:**
  * Inspection of `receiptRenderCore.ts` lines 716-727 confirms that the current production implementation **already satisfies Option A** (`tokenClaimSlipSection` is empty when `tokenClaimSlip.enabled === false`).
* **Planned Verification Subtask (Awaiting Separate Authorization):**
  * `T-21-VERIF-01`: Verify that setting `tokenClaimSlip.enabled: false` suppresses the coupon box completely across all 4 paper profiles (thermal_80, thermal_58, A4, A5) with zero fallback text.

---

## 7. Release Readiness Criteria & Verification Gates

Before the Receipt Template System can be declared production-ready, the following gates must be evaluated:

```
[GATE 1] Code & Type Integrity (VERIFIED)
  ├── npx tsc --noEmit exits 0 (32/32 dedicated tests, 55/55 regression tests pass)
  └── Pure normalizer and escaping verified

[GATE 2] Output Spool & Formatting (Phase 5 - T-18 & T-18.1-FIX)
  ├── F-18.1-01 Remediation: @page CSS updated to valid dimension syntax (${widthMm}mm 297mm)
  ├── 80mm virtual PDF renders with MediaBox width ≤ 80.5mm without horizontal clipping
  ├── 58mm virtual PDF renders with MediaBox width ≤ 58.5mm, wrapping long titles without column collision
  ├── A4/A5 layouts output full-page portrait without horizontal scroll or aspect distortion
  ├── Multi-page invoices paginate cleanly without splitting totals or token slips
  └── Hidden iframe creates and destroys cleanly across repeated prints

[GATE 3] Adapter Verification (Phase 5 - T-22)
  ├── PosBilling mapping logic verified against rendering core
  └── Sales History duplicate reprint mapping verified against rendering core

[GATE 4] Multi-Tenant Security & API Authorization (Phase 5 - T-23)
  ├── Unauthenticated request returns HTTP 401
  ├── Authorized same-tenant request returns HTTP 200 with tenant template
  ├── Cross-tenant request returns HTTP 403 Forbidden with zero data leakage
  └── Unauthorized mutation attempt returns HTTP 403 before any database touch

[GATE 5] Business Decisions & Compliance Locks (Phase 5 - T-19, T-20, T-21) (VERIFIED & COMPLETED)
  ├── Q-01 Mandatory field lock decision ratified & implemented (Option A)
  ├── Q-02 Reprint token notice decision ratified & verified across 4 formats (Option A)
  └── Q-03 Disabled slip policy decision ratified & verified across 4 formats (Option A)

[GATE 6] Physical Hardware Deployment (Phase 5 - T-18.4)
  └── Physical printer field trial verified OR explicitly deferred with documented software-only sign-off
```

### Distinction Between Conditional Readiness & Production Approval
* **Conditional Readiness Report (T-24):** If Gates 1–4 are fully satisfied with recorded evidence while Gate 5 (business decisions) or Gate 6 (physical hardware) remain open, T-24 is permitted to issue a **Conditional Release Readiness Report**.
* **Strict Rule:** **Conditional readiness must NEVER be equated with production release approval.** Full production approval strictly requires either formal ratification of all remaining gates or an explicit written exception signed off by project stakeholders.
