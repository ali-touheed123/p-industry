# PHASE 11 FORENSIC AUDIT REPORT — PERFORMANCE, DEPENDENCIES & LEGACY CODE

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 11 — Performance, Dependencies & Legacy Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE, SCHEMA, CONFIG, OR DEPENDENCIES MODIFIED  
**Human Gate Status:** AUDIT COMPLETE — AWAITING HUMAN APPROVAL TO PLAN/REMEDIATE  

---

## 1. Executive Summary

Phase 11 comprises an end-to-end audit of runtime performance bottlenecks, query efficiency, payload overhead, frontend rendering lifecycles, memory leaks, dependency bloat, dead code, and architectural monoliths.

The audit verified critical performance hazards:
1. **Unbounded Historical Payloads**: Default API limits set to 5,000–10,000 full records with nested joins (`*, invoice_items(*)`) downloaded into client state on dashboard/sales screens.
2. **N+1 Fan-Out Queries**: Multi-branch KPI aggregations in the CEO Suite invoke parallel full-table scans per sister branch, compounding network and CPU load.
3. **Monolithic UI Rendering Bottlenecks**: Top-level route `[slug]/page.tsx` eagerly imports 11 heavy modules (including `PosBilling.tsx` [2,569 lines] and `SalesHistory.tsx` [2,759 lines]) into a single client bundle without dynamic code splitting.
4. **Unbounded In-Memory State Growth**: Module-scoped arrays (`memoryLedger` in `ai-gateway.ts`) grow indefinitely without TTL eviction.
5. **Ghost Dependencies**: Direct database driver `pg` is installed in production dependencies despite the entire application architecture running on `@supabase/supabase-js`.

---

## 2. Audit Scope & Assets Inspected

| Category | Assets Inspected | Lines / Size |
|---|---|---|
| **Dependencies & Packaging** | `package.json`, `next.config.ts`, `node_modules` structure | 33 lines |
| **Data Fetching & APIs** | `src/app/api/invoices/route.ts`, `src/app/api/items/route.ts`, `src/app/api/tenants/route.ts`, `src/app/api/shifts/route.ts`, `src/app/api/ledgers/route.ts`, `src/app/api/purchases/route.ts` | 2,185 lines |
| **Frontend Shell & State** | `src/app/[slug]/page.tsx`, `src/components/PosBilling.tsx`, `src/components/SalesHistory.tsx`, `src/components/FinancialLedgers.tsx`, `src/components/ceo-panel/CeoSuite.tsx`, `src/components/ceo-panel/OverviewView.tsx` | 8,980 lines |
| **Client Utilities & Memory** | `src/utils/receiptCanvas.ts`, `src/utils/iframePrint.ts`, `src/lib/ai-gateway.ts`, `src/lib/rate-limit.ts` | 1,277 lines |
| **Dead / Legacy Routes** | `src/app/ceo/page.tsx`, `src/app/dev/page.tsx`, `scripts/*.mjs` | 150 lines |

---

## 3. Findings Matrix

| Finding ID | Severity | Category | Target File / Component | Verification Status | Title / Summary |
|---|---|---|---|---|---|
| **PERF-001** | **HIGH** | Query / Large Payload | `src/app/api/invoices/route.ts:20` | **VERIFIED** | Default query limit set to 5,000 with nested items join causing multi-megabyte payloads |
| **PERF-002** | **HIGH** | N+1 / Fan-Out Query | `src/components/ceo-panel/CeoSuite.tsx:68-107` | **VERIFIED** | N+1 sequential/parallel full table fetches across sister branches for KPI calculation |
| **PERF-003** | **HIGH** | Bundle / Code Splitting | `src/app/[slug]/page.tsx:1-17` | **VERIFIED** | Eager client-side import of 11 monolithic components (~9,000 lines) without `next/dynamic` |
| **PERF-004** | **MEDIUM** | Memory Leak | `src/lib/ai-gateway.ts:86, 357` | **VERIFIED** | Unbounded module-scoped `memoryLedger` array grows without eviction on server instances |
| **PERF-005** | **MEDIUM** | Inefficient Loop | `src/app/api/items/route.ts:167-191` | **VERIFIED** | Nested array scan `.find()` inside items iteration instead of indexed Map lookup |
| **PERF-006** | **MEDIUM** | Premature Iframe Detach | `src/utils/iframePrint.ts:57-61` | **VERIFIED** | 3-second hardcoded cleanup timer aborts print dialog on slow cashier printer selection |
| **PERF-007** | **LOW** | Layout Math | `src/utils/receiptCanvas.ts:71` | **VERIFIED** | Fixed canvas width assumption (440px / 600px) causes clipping on 58mm mobile slips |
| **DEP-001** | **MEDIUM** | Ghost Dependency | `package.json:18` | **VERIFIED** | Unused direct PostgreSQL driver `pg` installed in production runtime dependencies |
| **DEP-002** | **LOW** | Obsolete Script Flag | `package.json:6` | **VERIFIED** | `--webpack` CLI flag forces legacy bundler mode on Next.js 16 |
| **LEG-001** | **LOW** | Dead Route Handler | `src/app/ceo/page.tsx:1-6` | **VERIFIED** | Dead route immediately invokes `notFound()`; CEO dashboard moved to `[slug]/page.tsx` |
| **LEG-002** | **LOW** | Non-Atomic Default Switch | `src/app/api/receipt-templates/route.ts:86-91` | **VERIFIED** | Non-atomic template default reset leaves zero default templates on update failure |

---

## 4. Detailed Findings

---

### FINDING-PERF-001 — High-Payload Default Limit on Invoices API (HIGH)

- **Finding ID**: `PERF-001`
- **Severity**: **HIGH**
- **Category**: Database / Large Payload Overhead
- **Target File**: `src/app/api/invoices/route.ts:19-28, 41-48`
- **Component / API**: `GET /api/invoices`
- **Actual Behavior**:
  The handler specifies a default limit of 5,000 records (`let limit = 5000`), expandable up to 10,000. Unless `summary=true` is explicitly provided, it performs a deep select:
  ```typescript
  supabaseAdmin.from('invoices').select('*, invoice_items(*)')
  ```
  In stores with thousands of historical transactions, a single client request can return 5,000 invoices with 15,000–30,000 nested line-items, resulting in response payloads exceeding 10MB–25MB.
- **Expected Behavior**:
  Paginate using sensible pagination defaults (`limit = 50` or cursor-based streaming) and separate summary metadata from heavy child item trees.
- **Evidence**:
  ```typescript
  // src/app/api/invoices/route.ts:19-28
  let limit = 5000;
  if (limitParam === 'all' || limitParam === 'none') {
    limit = 10000;
  }
  ...
  let query: any = summary
    ? supabaseAdmin.from('invoices').select('*')
    : supabaseAdmin.from('invoices').select('*, invoice_items(*)');
  ```
- **Impact**:
  Severe frontend heap allocation, prolonged Time to Interactive (TTI), network saturation over 3G/LTE counter terminals, and potential Supabase API gateway timeouts.
- **Verification Method**: Verified via static code inspection of `src/app/api/invoices/route.ts`.

---

### FINDING-PERF-002 — N+1 Fan-Out KPI Fetching in CEO Executive Suite (HIGH)

- **Finding ID**: `PERF-002`
- **Severity**: **HIGH**
- **Category**: N+1 Queries / Excessive Database Calls
- **Target File**: `src/components/ceo-panel/CeoSuite.tsx:68-107`
- **Component / API**: `CeoSuite.tsx` (`fetchRealBranches`)
- **Actual Behavior**:
  When the CEO Suite loads, it queries `/api/tenants`, iterates through all sister branches, and for every branch fires concurrent unpaginated queries to `/api/invoices?tenant_id=...` and `/api/clients?tenant_id=...`:
  ```typescript
  const branchesWithKpis: Branch[] = await Promise.all(
    finalTenants.map(async (t: any) => {
      const [invRes, clientsRes] = await Promise.all([
        fetch(`/api/invoices?tenant_id=${t.id}`),
        fetch(`/api/clients?tenant_id=${t.id}`),
      ]);
      ...
  ```
  If an enterprise operates 10 branches, this triggers 21 parallel HTTP and database round-trips downloading complete historical invoice tables into browser memory merely to sum today's and this month's revenue numbers client-side.
- **Expected Behavior**:
  Aggregate branch KPIs server-side using a single SQL aggregation query or dedicated analytics RPC (`get_branches_kpi_summary`), returning scalar totals without streaming raw entity tables.
- **Evidence**:
  `src/components/ceo-panel/CeoSuite.tsx:75-97` executes client-side array `.forEach` filtering over entire invoice histories.
- **Impact**:
  Browser thread freezing during CEO dashboard mount, excessive PostgREST ingress/egress, high latency on dashboard load.
- **Verification Method**: Traced call flow from `CeoSuite.tsx` to `/api/invoices` and `/api/clients`.

---

### FINDING-PERF-003 — Monolithic Client Component Bundle Without Dynamic Splitting (HIGH)

- **Finding ID**: `PERF-003`
- **Severity**: **HIGH**
- **Category**: Frontend Rendering / Bundle Size
- **Target File**: `src/app/[slug]/page.tsx:1-17`
- **Component / API**: `TenantAppPage`
- **Actual Behavior**:
  The tenant page shell (`src/app/[slug]/page.tsx`) statically imports all major sub-screens directly:
  - `PosBilling` (126 KB source, 2,569 lines)
  - `SalesHistory` (125 KB source, 2,759 lines)
  - `TokenLedger` (108 KB source)
  - `PurchasesView` (88 KB source)
  - `FinancialLedgers` (84 KB source)
  - `StockInventory` (80 KB source)
  - `ShiftDrawer` (77 KB source)
  - `BranchOrders` (51 KB source)
  - `TokenManagementView` (49 KB source)
  - `ClientCreditRecovery` (27 KB source)
  - `HoldInvoices` (27 KB source)
- **Expected Behavior**:
  Use `next/dynamic` lazy loading with `React.Suspense` for tabs other than the default active tab (`PosBilling`).
- **Evidence**:
  `src/app/[slug]/page.tsx:5-16` contains static ES module import declarations for all 11 views.
- **Impact**:
  Large initial JavaScript bundle size transferred to point-of-sale terminals. Cashiers on slow connections experience multi-second initial load delays even if they only use POS checkout.
- **Verification Method**: Verified via dependency graph analysis in `src/app/[slug]/page.tsx`.

---

### FINDING-PERF-004 — Unbounded In-Memory Ledger Growth in AI Gateway (MEDIUM)

- **Finding ID**: `PERF-004`
- **Severity**: **MEDIUM**
- **Category**: Memory / Resource Leak
- **Target File**: `src/lib/ai-gateway.ts:86, 357-371`
- **Component / API**: `memoryLedger` in `src/lib/ai-gateway.ts`
- **Actual Behavior**:
  When database reservations fail or during local/fallback mode, `memoryLedger.unshift({...})` inserts transaction objects into a module-scoped array:
  ```typescript
  const memoryLedger: LedgerRecord[] = [];
  ...
  memoryLedger.unshift({ id: ledgerId, ... });
  ```
  Unlike `rate-limit.ts` (which purges expired entries when map size exceeds 5,000), `memoryLedger` contains **zero cleanup logic, zero max-length truncation, and zero TTL eviction**.
- **Expected Behavior**:
  Bound the array with a fixed ring-buffer capacity (e.g., maximum 500 records) or timestamp-based eviction (`Date.now() - 30 days`).
- **Evidence**:
  Inspected lines 86 to 520 of `src/lib/ai-gateway.ts`. `memoryLedger` has insertions (`unshift`) and filters, but no `.pop()`, `.splice()`, or `.length = MAX`.
- **Impact**:
  Continuous heap expansion in persistent Node.js server environments handling repeated AI invoice scan requests.
- **Verification Method**: Verified via static code review of `memoryLedger` lifecycle in `src/lib/ai-gateway.ts`.

---

### FINDING-PERF-005 — Inefficient O(N*M) Lookup in Catalog Item Enrichment (MEDIUM)

- **Finding ID**: `PERF-005`
- **Severity**: **MEDIUM**
- **Category**: Inefficient Loops and Calculations
- **Target File**: `src/app/api/items/route.ts:167-191`
- **Component / API**: `GET /api/items`
- **Actual Behavior**:
  For every item returned from the catalog query, the handler executes an inner `.find()` across the entire `configs` array:
  ```typescript
  const matched = configs.find(c => {
    if (c.series_id !== item.series_id) return false;
    return matchUnitToConfig(itemUnit, c.unit_name);
  });
  ```
- **Expected Behavior**:
  Index `configs` by `series_id` into a `Map<string, Config[]>` before mapping items, reducing search space from O(N * M) to O(N * K).
- **Evidence**:
  `src/app/api/items/route.ts:174-177`.
- **Impact**:
  Sub-optimal CPU utilization on the API server when serializing catalogs of 10,000+ items across hundreds of token configurations.
- **Verification Method**: Algorithmic complexity inspection of `GET /api/items`.

---

### FINDING-PERF-006 — Premature Iframe Detachment Cleanup Race (MEDIUM)

- **Finding ID**: `PERF-006`
- **Severity**: **MEDIUM**
- **Category**: Browser Lifecycle / Printing Race Condition
- **Target File**: `src/utils/iframePrint.ts:57-61`
- **Component / API**: `printViaIframe`
- **Actual Behavior**:
  The hidden iframe printer schedules an unconditional DOM removal after 3,000ms:
  ```typescript
  setTimeout(() => {
    if (document.getElementById('__thermal_print_iframe__')) {
      iframe.remove();
    }
  }, 3000);
  ```
  If a cashier's browser modal or printer dialog takes longer than 3 seconds to confirm, the underlying iframe element is destroyed while the print subsystem is active.
- **Expected Behavior**:
  Rely on the `afterprint` event listener and extend fallback safety timeout to 30–60 seconds, clearing the timeout when `afterprint` fires.
- **Evidence**:
  `src/utils/iframePrint.ts:57-61`.
- **Impact**:
  Interrupted or aborted print spooling on slow hardware or when cashiers hesitate in the printer selection dialog.
- **Verification Method**: Inspected timer lifecycle in `src/utils/iframePrint.ts`.

---

### FINDING-PERF-007 — Fixed Width Canvas Layout Assumption (LOW)

- **Finding ID**: `PERF-007`
- **Severity**: **LOW**
- **Category**: Layout Math & Canvas Rendering
- **Target File**: `src/utils/receiptCanvas.ts:71`
- **Component / API**: `generateReceiptImageBlob`
- **Actual Behavior**:
  The thermal canvas generator fixes width to 440px (or 600px in ledger generator) without adapting for 58mm mobile thermal printers (384px width at 203 DPI) versus standard 80mm counter printers (576px width).
- **Expected Behavior**:
  Allow parameterized width based on paper type (`paper_size = 'thermal_58' | 'thermal_80'`).
- **Evidence**:
  `src/utils/receiptCanvas.ts:71`: `const width = 440;`.
- **Impact**:
  Text scaling artifacts or horizontal clipping when rendering digital receipts on handheld 58mm bluetooth printer slips.
- **Verification Method**: Inspected pixel geometry in `src/utils/receiptCanvas.ts`.

---

### FINDING-DEP-001 — Unused Production Database Driver Dependency (MEDIUM)

- **Finding ID**: `DEP-001`
- **Severity**: **MEDIUM**
- **Category**: Outdated / Unused Dependencies
- **Target File**: `package.json:18`
- **Component / API**: `dependencies.pg` (`^8.23.1`)
- **Actual Behavior**:
  The project has `pg` installed in production dependencies (`"pg": "^8.23.1"`). Grep search across `src/` reveals **zero** imports of `pg`. The application exclusively uses `@supabase/supabase-js`. `pg` is only referenced in maintenance scripts in `scripts/`.
- **Expected Behavior**:
  Move `pg` to `devDependencies` or remove if direct pool scripts are not part of production runtime.
- **Evidence**:
  `grep_search` for `pg` in `src/` returned 0 matches. References exist only in `scripts/test-pg-connection.mjs`, `scripts/test-db-direct.mjs`, and `scripts/execute-migration.mjs`.
- **Impact**:
  Unnecessary bloat in production deployment artifacts and potential exposure to supply-chain vulnerabilities in native socket drivers.
- **Verification Method**: Verified via dependency cross-reference across all source files in `src/`.

---

### FINDING-DEP-002 — Deprecated `--webpack` Flag in Dev Script (LOW)

- **Finding ID**: `DEP-002`
- **Severity**: **LOW**
- **Category**: Build & Tooling Configuration
- **Target File**: `package.json:6`
- **Component / API**: `scripts.dev`
- **Actual Behavior**:
  The dev script runs `next dev --webpack -p 3000`. Next.js 16 defaults to Turbopack. Forcing `--webpack` increases local HMR rebuild times and memory consumption during development.
- **Expected Behavior**:
  Assess compatibility with Next.js Turbopack dev server and remove `--webpack` if no unsupported custom Webpack loaders are required.
- **Evidence**:
  `package.json:6`: `"dev": "node ./node_modules/next/dist/bin/next dev --webpack -p 3000"`.
- **Impact**:
  Slower developer feedback loop and higher compilation memory footprint during counter module development.
- **Verification Method**: Inspected `package.json` dev script definition.

---

### FINDING-LEG-001 — Dead Route Handler Calling `notFound()` (LOW)

- **Finding ID**: `LEG-001`
- **Severity**: **LOW**
- **Category**: Legacy / Dead Code
- **Target File**: `src/app/ceo/page.tsx:1-6`
- **Component / API**: `CeoRoutePage`
- **Actual Behavior**:
  `src/app/ceo/page.tsx` consists entirely of:
  ```typescript
  import { notFound } from 'next/navigation';
  export default function CeoRoutePage() {
    notFound();
  }
  ```
  The CEO dashboard was refactored to be accessible directly inside the tenant route `[slug]/page.tsx` via `activeTab === 'ceo_reports'`.
- **Expected Behavior**:
  Either remove the route or implement an explicit redirect to the tenant selection view.
- **Evidence**:
  Complete file contents of `src/app/ceo/page.tsx`.
- **Impact**:
  Dead code increasing route maintenance overhead and confusion regarding valid portal entrypoints.
- **Verification Method**: Verified via code inspection of `src/app/ceo/page.tsx` and routing logic in `src/app/[slug]/page.tsx`.

---

### FINDING-LEG-002 — Non-Atomic Default Switch in Receipt Templates (LOW)

- **Finding ID**: `LEG-002`
- **Severity**: **LOW**
- **Category**: Legacy Logic / Transaction Isolation
- **Target File**: `src/app/api/receipt-templates/route.ts:86-91, 133-138`
- **Component / API**: `POST /api/receipt-templates`, `PATCH /api/receipt-templates`
- **Actual Behavior**:
  When a user sets a receipt template as default (`is_default = true`), the API executes an un-isolated update resetting all other templates:
  ```typescript
  if (is_default) {
    await supabaseAdmin
      .from('receipt_templates')
      .update({ is_default: false })
      .neq('id', id);
  }
  ```
  If the subsequent template update fails, the system is left in a degraded state with zero default templates.
- **Expected Behavior**:
  Execute default template re-assignment in a single atomic database RPC or transaction.
- **Evidence**:
  `src/app/api/receipt-templates/route.ts:86-91` and `133-138`.
- **Impact**:
  Print rendering failure if cashiers perform checkout while zero templates are marked as default.
- **Verification Method**: Verified via static code inspection.

---

## 5. Trace of Critical End-to-End Performance Bottleneck

**Flow: CEO Suite Multi-Branch KPI Load**
1. **User Action**: Owner switches to CEO Suite view in browser (`[slug]/page.tsx`).
2. **Frontend Layer**: `CeoSuite.tsx` triggers `fetchRealBranches()`.
3. **API Layer**: `GET /api/tenants` returns all sister branches.
4. **Fan-Out (N+1)**: For every branch, `Promise.all` fires two concurrent HTTP calls:
   - `GET /api/invoices?tenant_id=<id>`
   - `GET /api/clients?tenant_id=<id>`
5. **Backend / Database Layer**:
   - `/api/invoices` queries `invoices` with `select('*, invoice_items(*)')` and a default limit of 5,000 records.
   - Database executes deep joins scanning line-items and serializes full JSON trees across the network.
6. **Resulting State**:
   - Browser receives tens of megabytes of raw invoice data.
   - Client JS thread runs synchronous `.forEach` loops computing sums.
   - UI freezes noticeably on counter hardware; network ingress spikes.

---

## 6. Positive Performance Patterns Observed

| Pattern | Location | Verdict |
|---|---|---|
| Vector / Canvas Rendering | `src/utils/receiptCanvas.ts` | ✅ 100% client-side HTML5 canvas rendering; 0 bytes server storage used for image generation |
| Database Indexing Coverage | `supabase/migrations/20260924_03_performance_indexes.sql` | ✅ Dedicated performance indexes added on foreign keys (`tenant_id`, `invoice_id`, `client_id`) |
| Headless Count Queries | `src/lib/ai-gateway.ts:136, 142` | ✅ Uses `{ count: 'exact', head: true }` for quota checks without downloading row bodies |
| Optimistic In-Memory Updates | `src/app/[slug]/page.tsx:283-291` | ✅ Sales completion immediately prepends invoice to local list before background refresh |

---

## 7. Phase 11 Status & Human Gate

**PHASE 11 — PERFORMANCE, DEPENDENCIES & LEGACY AUDIT: AUDIT COMPLETE**

- Total Findings: **11 Findings** (3 HIGH · 4 MEDIUM · 4 LOW).
- **STRICT AUDIT ONLY RULE RESPECTED**: Zero source code, database migrations, configuration, or dependencies were altered.
- All findings are derived directly from the current codebase.

> [!IMPORTANT]
> **HUMAN GATE ENFORCED**  
> Awaiting user review of `audit/phase-11-audit-report.md`. Do not start Phase 12 or execute remediations without explicit authorization.
