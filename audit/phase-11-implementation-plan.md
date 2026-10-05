# Phase 11 — Implementation Plan (Performance, Dependencies & Legacy Code)

> **Document Status**: IMPLEMENTATION COMPLETED & VERIFIED  
> **Phase**: 11 (Performance, Dependencies & Legacy Audit)  
> **Scope**: Implementation Plan covering all 11 verified findings from `audit/phase-11-audit-report.md`  
> **Execution Date**: October 6, 2026  

---

## 1. Finding Reconciliation & Severity Matrix

All findings are mapped 1:1 against `audit/phase-11-audit-report.md`.

| Finding ID | Severity | Category | Target File / Area | Verification Status | Remediation Plan ID | Implementation Status |
|---|---|---|---|---|---|---|
| **PERF-001** | **HIGH** | Large Payload Overhead | `src/app/api/invoices/route.ts` | **VERIFIED** | `PLAN-PERF-001` | **Implemented & Verified** |
| **PERF-002** | **HIGH** | N+1 / Fan-Out Queries | `src/components/ceo-panel/CeoSuite.tsx` | **VERIFIED** | `PLAN-PERF-002` | **Implemented & Verified** |
| **PERF-003** | **HIGH** | Monolithic Bundle Size | `src/app/[slug]/page.tsx` | **VERIFIED** | `PLAN-PERF-003` | **Implemented & Verified** |
| **PERF-004** | **MEDIUM** | Memory Leak | `src/lib/ai-gateway.ts` | **VERIFIED** | `PLAN-PERF-004` | **Implemented & Verified** |
| **PERF-005** | **MEDIUM** | Inefficient Loop | `src/app/api/items/route.ts` | **VERIFIED** | `PLAN-PERF-005` | **Implemented & Verified** |
| **PERF-006** | **MEDIUM** | Premature Iframe Detach | `src/utils/iframePrint.ts` | **VERIFIED** | `PLAN-PERF-006` | **Implemented & Verified** |
| **PERF-007** | **LOW** | Layout Math | `src/utils/receiptCanvas.ts` | **VERIFIED** | `PLAN-PERF-007` | **Implemented & Verified** |
| **DEP-001** | **MEDIUM** | Ghost Dependency | `package.json` | **VERIFIED** | `PLAN-DEP-001` | **Implemented & Verified** |
| **DEP-002** | **LOW** | Obsolete Script Flag | `package.json` | **VERIFIED** | `PLAN-DEP-002` | **Evaluated & Verified** |
| **LEG-001** | **LOW** | Dead Route Handler | `src/app/ceo/page.tsx` | **VERIFIED** | `PLAN-LEG-001` | **Implemented & Verified** |
| **LEG-002** | **LOW** | Non-Atomic Default Switch | `src/app/api/receipt-templates/route.ts` | **VERIFIED** | `PLAN-LEG-002` | **Implemented & Verified** |

---

## 2. Technical Remediation Plans

### Priority 1: High Severity Performance & Query Optimizations

#### PLAN-PERF-001: Paginate Invoices & Strip Deep Child Tree
- **Finding Ref**: `PERF-001`
- **Files Affected**: `src/app/api/invoices/route.ts`, `src/components/SalesHistory.tsx`, `src/components/ceo-panel/ReturnsView.tsx`, `src/components/ceo-panel/SalesView.tsx`
- **Objective**: Prevent multi-megabyte payloads on sales and history queries.
- **Implemented Technical Steps**:
  1. Reduced default query `limit` from 5,000 to 50 for list views.
  2. Selected invoice headers only by default; required explicit `include_items=true` parameter to attach `invoice_items(*)`.
  3. Added single invoice fetch by `id` parameter.
  4. Added `ensureInvoiceItems` lazy loading in `SalesHistory.tsx` for row expansion, invoice viewing modal, and receipt printing.

#### PLAN-PERF-002: Server-Side Branch KPI Aggregation RPC
- **Finding Ref**: `PERF-002`
- **Files Affected**: `supabase/migrations/20261006_01_performance_kpi_and_templates_rpc.sql`, `src/app/api/tenants/kpi/route.ts`, `src/components/ceo-panel/CeoSuite.tsx`
- **Objective**: Eliminate N+1 fan-out queries downloading full entity tables for sister branches.
- **Implemented Technical Steps**:
  1. Authored PostgreSQL database function: `get_ceo_branches_kpi_summary(p_tenant_ids UUID[], p_today DATE)`.
  2. Applied function and supporting partial indexes (`idx_clients_tenant_balance`, `idx_invoices_kpi`) to live database.
  3. Created authenticated `/api/tenants/kpi` endpoint.
  4. Replaced client-side multi-fetch loop in `CeoSuite.tsx` with a single POST call to `/api/tenants/kpi`.

#### PLAN-PERF-003: Dynamic Component Lazy Loading
- **Finding Ref**: `PERF-003`
- **Files Affected**: `src/app/[slug]/page.tsx`
- **Objective**: Drastically reduce initial JavaScript bundle download on counter terminals.
- **Implemented Technical Steps**:
  1. Replaced static import declarations of 11 heavy screens (`StockInventory`, `ShiftDrawer`, `CeoDashboard`, `FinancialLedgers`, `ClientCreditRecovery`, `SalesHistory`, `HoldInvoices`, `PurchasesView`, `BranchOrders`, `TokenLedger`, `TokenManagementView`) with `next/dynamic`.
  2. Kept only `PosBilling` statically imported to guarantee instantaneous first-paint for cashier checkout.
  3. Wrapped lazy components in accessible fallback loader (`ViewFallback`).

---

### Priority 2: Medium Severity Reliability & Memory Controls

#### PLAN-PERF-004: Bounded Ring Buffer & TTL for AI In-Memory Ledger
- **Finding Ref**: `PERF-004`
- **Files Affected**: `src/lib/ai-gateway.ts`
- **Objective**: Prevent unbounded heap memory growth in persistent server processes.
- **Implemented Technical Steps**:
  1. Imposed a maximum array capacity of 500 items on `memoryLedger`.
  2. Implemented automatic truncation: `if (memoryLedger.length > 500) memoryLedger.length = 500;`.
  3. Implemented continuous tail eviction for records older than 30 days (`ago30d`).

#### PLAN-PERF-005: Index Series Token Configurations by Series ID
- **Finding Ref**: `PERF-005`
- **Files Affected**: `src/app/api/items/route.ts`
- **Objective**: Optimize catalog enrichment algorithm from O(N * M) to O(N).
- **Implemented Technical Steps**:
  1. Grouped `configs` into a `Map<string, Config[]>` keyed by `series_id` prior to the items iteration loop.
  2. Performed fast Map lookup to reduce search space to intra-series configs.

#### PLAN-PERF-006: Robust Event-Driven Iframe Printing Lifecycle
- **Finding Ref**: `PERF-006`
- **Files Affected**: `src/utils/iframePrint.ts`
- **Objective**: Prevent premature DOM detachment during slow print dialog interactions.
- **Implemented Technical Steps**:
  1. Extended fallback cleanup timer from 3,000ms to 30,000ms.
  2. Stored timeout handle in `safetyTimer` and cancelled it with `clearTimeout` immediately inside the `afterprint` event listener.

#### PLAN-DEP-001: Relocate or Remove Direct `pg` Dependency
- **Finding Ref**: `DEP-001`
- **Files Affected**: `package.json`
- **Objective**: Remove unused direct database driver from production dependencies.
- **Implemented Technical Steps**:
  1. Moved `"pg": "^8.23.1"` from `dependencies` to `devDependencies`.
  2. Verified Next.js production build succeeds without `pg` in runtime bundle.

---

### Priority 3: Low Severity Cleanup & Layout Math

#### PLAN-PERF-007: Parameterized Dynamic Canvas Width for 58mm Slips
- **Finding Ref**: `PERF-007`
- **Files Affected**: `src/utils/receiptCanvas.ts`
- **Objective**: Eliminate text clipping on mobile Bluetooth thermal printers.
- **Implemented Technical Steps**:
  1. Added `ReceiptPaperSize = 'thermal_58' | 'thermal_80'` parameter to `generateReceiptImageBlob`.
  2. Dynamically assigned base width (384px for 58mm vs 576px for 80mm).
  3. Made table column coordinates proportional to canvas width (`Math.round(width * 0.63)`).

#### PLAN-DEP-002: Evaluate Dev Server CLI Flags
- **Finding Ref**: `DEP-002`
- **Files Affected**: `package.json`
- **Objective**: Modernize developer build configuration.
- **Implemented Technical Steps**:
  1. Evaluated running without `--webpack`. On this Windows environment, native Turbopack binary (`@next/swc-win32-x64-msvc`) fails with `is not a valid Win32 application`.
  2. Maintained Webpack flag for dev server stability and compatibility on Windows host.

#### PLAN-LEG-001: Clean Up Dead Route Handler
- **Finding Ref**: `LEG-001`
- **Files Affected**: `src/app/ceo/page.tsx`
- **Objective**: Remove dead stub route calling `notFound()`.
- **Implemented Technical Steps**:
  1. Replaced `notFound()` call with Next.js redirect: `redirect('/')`.

#### PLAN-LEG-002: Atomic Default Template Switch Procedure
- **Finding Ref**: `LEG-002`
- **Files Affected**: `src/app/api/receipt-templates/route.ts`, `supabase/migrations/20261006_01_performance_kpi_and_templates_rpc.sql`
- **Objective**: Ensure default template switching is transactional.
- **Implemented Technical Steps**:
  1. Wrapped `is_default` reset and update inside a PostgreSQL RPC `set_default_receipt_template(p_template_id UUID)`.
  2. Updated POST and PATCH handlers in `/api/receipt-templates` to delegate to this atomic RPC.

---

## 3. Implementation Verification & Deviations

### Database Changes
- Migration applied: `supabase/migrations/20261006_01_performance_kpi_and_templates_rpc.sql`
- Functions created and verified in live database:
  - `get_ceo_branches_kpi_summary(UUID[], DATE)`
  - `set_default_receipt_template(UUID)`
- Indexes created and verified:
  - `idx_clients_tenant_balance ON clients (tenant_id, current_balance) WHERE current_balance > 0`
  - `idx_invoices_kpi ON invoices (tenant_id, date) WHERE (status IS NULL OR status <> 'cancelled') AND (invoice_type IS NULL OR invoice_type <> 'return')`

### Deviations
- **DEP-002**: Turbopack dev evaluation revealed that the Windows host environment lacks a compatible native SWC binary for Turbopack (`is not a valid Win32 application`), requiring `--webpack` to be retained in dev script.

### Test Verification
- `npx tsc --noEmit`: Exit code 0
- Next.js Webpack Production Build: Exit code 0 (all 34 static and dynamic routes compiled successfully)
