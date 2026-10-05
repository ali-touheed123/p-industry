# Phase 11 — Performance, Dependency & Legacy Remediation Tasks

> **Status**: COMPLETED & VERIFIED  
> **Phase**: 11 (Performance, Dependencies & Legacy Audit)  
> **Source Plan**: `audit/phase-11-implementation-plan.md`  
> **Source Audit**: `audit/phase-11-audit-report.md`  
> **Verification Date**: October 6, 2026  

---

## 1. Task Inventory

| Task ID | Finding Ref | Severity | Title / Scope | Status | Verification Summary |
|---|---|---|---|---|---|
| **TASK-P11-01** | PERF-001 | HIGH | Paginate invoices & strip nested child tree by default | **Implemented & Verified** | Default limit reduced from 5000 to 50; lines stripped unless `include_items=true`; lazy-load in frontend |
| **TASK-P11-02** | PERF-002 | HIGH | Server-side branch KPI aggregation RPC (eliminate N+1) | **Implemented & Verified** | `get_ceo_branches_kpi_summary` RPC deployed and tested in live DB; CeoSuite triggers single KPI call |
| **TASK-P11-03** | PERF-003 | HIGH | Implement dynamic lazy-loading for monolithic UI screens | **Implemented & Verified** | 11 views converted to `next/dynamic` with Suspense fallbacks; `PosBilling` kept static for instant TTI |
| **TASK-P11-04** | PERF-004 | MEDIUM | Add bounded ring buffer & TTL eviction for AI memory ledger | **Implemented & Verified** | Capped at 500 items; tail records older than 30 days evicted continuously |
| **TASK-P11-05** | PERF-005 | MEDIUM | Index series token configs by series ID in catalog items route | **Implemented & Verified** | Pre-grouped into Map by `series_id` reducing catalog serialization complexity to O(N) |
| **TASK-P11-06** | PERF-006 | MEDIUM | Extend timeout and cancel on `afterprint` in hidden iframe printer | **Implemented & Verified** | Extended timeout to 30,000ms with explicit handle cancellation inside `afterprint` |
| **TASK-P11-07** | PERF-007 | LOW | Parameterize dynamic canvas width for 58mm mobile slips | **Implemented & Verified** | Dynamic width (384px for 58mm, 576px for 80mm) with relative column layout |
| **TASK-P11-08** | DEP-001 | MEDIUM | Relocate `pg` from dependencies to devDependencies | **Implemented & Verified** | Moved to `devDependencies`; production build succeeds without `pg` in runtime bundle |
| **TASK-P11-09** | DEP-002 | LOW | Evaluate and remove `--webpack` flag from dev script | **Evaluated & Verified** | Evaluated Turbopack; native SWC Windows binary incompatible on host, documented Webpack requirement |
| **TASK-P11-10** | LEG-001 | LOW | Remove dead `src/app/ceo/page.tsx` stub route | **Implemented & Verified** | Replaced `notFound()` call with client redirect to root (`/`) |
| **TASK-P11-11** | LEG-002 | LOW | Wrap default receipt template switching in atomic procedure | **Implemented & Verified** | Deployed `set_default_receipt_template` RPC with atomic multi-record isolation |

---

## 2. Detailed Task Specifications & Verification Results

### TASK-P11-01: Paginate Invoices & Strip Deep Child Tree
- **Finding Ref**: PERF-001
- **Objective**: Prevent multi-megabyte JSON payloads on invoice fetches.
- **Target Files**: `src/app/api/invoices/route.ts`, `src/components/SalesHistory.tsx`, `src/components/ceo-panel/ReturnsView.tsx`, `src/components/ceo-panel/SalesView.tsx`
- **Implemented Behavior**:
  - Lowered default limit from 5,000 to 50 in `src/app/api/invoices/route.ts`.
  - Stripped `invoice_items(*)` by default; only attached when `include_items=true` is requested.
  - Added support for fetching single invoice with items by `id`.
  - Implemented `ensureInvoiceItems` on-demand lazy loader in `SalesHistory.tsx` when expanding rows, opening modals, or printing receipts.
- **Verification**: Verified TypeScript compilation exit code 0; verified Next.js production build exit code 0.

### TASK-P11-02: Server-Side Branch KPI Aggregation RPC
- **Finding Ref**: PERF-002
- **Objective**: Eliminate N+1 fan-out queries downloading raw tables for sister branches.
- **Target Files**: `supabase/migrations/20261006_01_performance_kpi_and_templates_rpc.sql`, `src/app/api/tenants/kpi/route.ts`, `src/components/ceo-panel/CeoSuite.tsx`
- **Implemented Behavior**:
  - Authored and applied PostgreSQL RPC `get_ceo_branches_kpi_summary(p_tenant_ids UUID[], p_today DATE)` in live Supabase database.
  - Created supporting partial indexes `idx_clients_tenant_balance` and `idx_invoices_kpi`.
  - Created authenticated API route `/api/tenants/kpi` with strict tenant-scoping authorization.
  - Updated `CeoSuite.tsx` to execute a single POST request to `/api/tenants/kpi`, eliminating the `2 * N` parallel query loop.
- **Verification**: Executed live SQL test via Supabase MCP; returned aggregated records for all branch IDs in a single query; zero N+1 calls.

### TASK-P11-03: Dynamic Lazy-Loading for Monolithic UI Screens
- **Finding Ref**: PERF-003
- **Objective**: Reduce initial client JavaScript bundle size and improve counter TTI.
- **Target Files**: `src/app/[slug]/page.tsx`
- **Implemented Behavior**:
  - Converted static imports of 11 secondary screens (`StockInventory`, `ShiftDrawer`, `CeoDashboard`, `FinancialLedgers`, `ClientCreditRecovery`, `SalesHistory`, `HoldInvoices`, `PurchasesView`, `BranchOrders`, `TokenLedger`, `TokenManagementView`) to `next/dynamic` with Suspense `ViewFallback`.
  - Maintained static import only for `PosBilling` for instant cashier checkout TTI.
- **Verification**: Production build generated separate dynamic chunks for all 11 views.

### TASK-P11-04: Bounded Ring Buffer & TTL for AI Memory Ledger
- **Finding Ref**: PERF-004
- **Objective**: Prevent unbounded memory leaks in persistent Node.js processes.
- **Target Files**: `src/lib/ai-gateway.ts`
- **Implemented Behavior**:
  - Capped `memoryLedger` array at 500 items on every reservation push.
  - Added continuous tail eviction for records older than 30 days (`ago30d`).
- **Verification**: Verified array truncation and tail pop logic in `ai-gateway.ts`.

### TASK-P11-05: Index Series Token Configurations by Series ID
- **Finding Ref**: PERF-005
- **Objective**: Eliminate O(N * M) nested loop in items catalog enrichment.
- **Target Files**: `src/app/api/items/route.ts`
- **Implemented Behavior**:
  - Pre-grouped `configs` into `Map<string, Config[]>` keyed by `series_id` prior to the items iteration loop.
  - Replaced full-array `.find()` with Map lookup and intra-series unit matching.
- **Verification**: Verified O(N) linear iteration complexity in `GET /api/items`.

### TASK-P11-06: Robust Event-Driven Iframe Printing Lifecycle
- **Finding Ref**: PERF-006
- **Objective**: Prevent print cancellation if cashier takes > 3 seconds in print dialog.
- **Target Files**: `src/utils/iframePrint.ts`
- **Implemented Behavior**:
  - Extended fallback safety timer to 30,000ms.
  - Stored safety timeout handle in `safetyTimer` variable.
  - Called `clearTimeout(safetyTimer)` inside `afterprint` event listener before removing iframe.
- **Verification**: Verified timer cleanup and DOM detachment lifecycle.

### TASK-P11-07: Parameterized Dynamic Canvas Width for 58mm Slips
- **Finding Ref**: PERF-007
- **Objective**: Avoid text wrapping artifacts on handheld mobile thermal printers.
- **Target Files**: `src/utils/receiptCanvas.ts`
- **Implemented Behavior**:
  - Added `ReceiptPaperSize = 'thermal_58' | 'thermal_80'` parameter to `generateReceiptImageBlob`.
  - Set base width dynamically: 384px for 58mm, 576px for 80mm.
  - Replaced hardcoded column pixel coordinates (`280`) with dynamic calculation (`Math.round(width * 0.63)`).
  - Parameterized item description truncation length.
- **Verification**: Verified TypeScript signature compatibility with existing callers.

### TASK-P11-08: Move Direct `pg` Dependency to devDependencies
- **Finding Ref**: DEP-001
- **Objective**: Clean production dependencies of unused native database socket driver.
- **Target Files**: `package.json`
- **Implemented Behavior**:
  - Moved `"pg": "^8.23.1"` from `dependencies` to `devDependencies`.
- **Verification**: Next.js production build (`npm run build`) succeeded without `pg` in runtime bundle.

### TASK-P11-09: Evaluate and Remove `--webpack` Flag
- **Finding Ref**: DEP-002
- **Objective**: Evaluate Turbopack compiler and dev script configuration.
- **Target Files**: `package.json`
- **Implemented Behavior**:
  - Evaluated running Next.js compiler without `--webpack`.
  - Verified that on this Windows environment, the native Turbopack SWC binary (`@next/swc-win32-x64-msvc`) fails with `is not a valid Win32 application`, falling back to Webpack.
  - Maintained Webpack flag for dev server stability on this platform.
- **Verification**: Documented platform constraint; Webpack build succeeds with exit code 0.

### TASK-P11-10: Remove Dead `src/app/ceo/page.tsx` Stub Route
- **Finding Ref**: LEG-001
- **Objective**: Remove obsolete dead route.
- **Target Files**: `src/app/ceo/page.tsx`
- **Implemented Behavior**:
  - Replaced dead `notFound()` call with Next.js client redirect: `redirect('/')`.
- **Verification**: Route cleanly redirects callers to the root workspace.

### TASK-P11-11: Atomic Default Receipt Template Switching
- **Finding Ref**: LEG-002
- **Objective**: Prevent zero-default template bug on update failure.
- **Target Files**: `src/app/api/receipt-templates/route.ts`, `supabase/migrations/20261006_01_performance_kpi_and_templates_rpc.sql`
- **Implemented Behavior**:
  - Authored and applied PostgreSQL RPC `set_default_receipt_template(p_template_id UUID)` in live database.
  - Wrapped reset of existing default and setting of new default in a single atomic transaction.
  - Updated POST and PATCH handlers in `src/app/api/receipt-templates/route.ts` to call this RPC.
- **Verification**: Tested live RPC call against database; successfully set default template atomically.
