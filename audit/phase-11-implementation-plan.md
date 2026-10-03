# Phase 11 — Implementation Plan (Performance, Dependencies & Legacy Code)

> **Document Status**: READY FOR REVIEW  
> **Phase**: 11 (Performance, Dependencies & Legacy Audit)  
> **Scope**: Implementation Plan covering all 11 verified findings from `audit/phase-11-audit-report.md`  
> **Constraint**: AUDIT ONLY. Zero code changes executed during audit.

---

## 1. Finding Reconciliation & Severity Matrix

All findings are mapped 1:1 against `audit/phase-11-audit-report.md`.

| Finding ID | Severity | Category | Target File / Area | Verification Status | Remediation Plan ID |
|---|---|---|---|---|---|
| **PERF-001** | **HIGH** | Large Payload Overhead | `src/app/api/invoices/route.ts` | **VERIFIED** | `PLAN-PERF-001` |
| **PERF-002** | **HIGH** | N+1 / Fan-Out Queries | `src/components/ceo-panel/CeoSuite.tsx` | **VERIFIED** | `PLAN-PERF-002` |
| **PERF-003** | **HIGH** | Monolithic Bundle Size | `src/app/[slug]/page.tsx` | **VERIFIED** | `PLAN-PERF-003` |
| **PERF-004** | **MEDIUM** | Memory Leak | `src/lib/ai-gateway.ts` | **VERIFIED** | `PLAN-PERF-004` |
| **PERF-005** | **MEDIUM** | Inefficient Loop | `src/app/api/items/route.ts` | **VERIFIED** | `PLAN-PERF-005` |
| **PERF-006** | **MEDIUM** | Premature Iframe Detach | `src/utils/iframePrint.ts` | **VERIFIED** | `PLAN-PERF-006` |
| **PERF-007** | **LOW** | Layout Math | `src/utils/receiptCanvas.ts` | **VERIFIED** | `PLAN-PERF-007` |
| **DEP-001** | **MEDIUM** | Ghost Dependency | `package.json` | **VERIFIED** | `PLAN-DEP-001` |
| **DEP-002** | **LOW** | Obsolete Script Flag | `package.json` | **VERIFIED** | `PLAN-DEP-002` |
| **LEG-001** | **LOW** | Dead Route Handler | `src/app/ceo/page.tsx` | **VERIFIED** | `PLAN-LEG-001` |
| **LEG-002** | **LOW** | Non-Atomic Default Switch | `src/app/api/receipt-templates/route.ts` | **VERIFIED** | `PLAN-LEG-002` |

---

## 2. Technical Remediation Plans

### Priority 1: High Severity Performance & Query Optimizations

#### PLAN-PERF-001: Paginate Invoices & Strip Deep Child Tree
- **Finding Ref**: `PERF-001`
- **Files Affected**: `src/app/api/invoices/route.ts`
- **Objective**: Prevent multi-megabyte payloads on sales and history queries.
- **Technical Steps**:
  1. Reduce default query `limit` from 5,000 to 50 for list views.
  2. Require explicit `include_items=true` parameter to attach `invoice_items(*)`. Default query should select invoice headers only (`select('*')`).
  3. Ensure frontend components (`SalesHistory.tsx`, `PosBilling.tsx`) request child items only upon invoice expansion/selection.

#### PLAN-PERF-002: Server-Side Branch KPI Aggregation RPC
- **Finding Ref**: `PERF-002`
- **Files Affected**: `src/components/ceo-panel/CeoSuite.tsx`, `supabase/migrations/`
- **Objective**: Eliminate N+1 fan-out queries downloading full entity tables for sister branches.
- **Technical Steps**:
  1. Author a PostgreSQL database function: `get_ceo_branches_kpi_summary(p_tenant_ids UUID[], p_today DATE)`.
  2. Return scalar summary fields (`today_sales`, `monthly_sales`, `total_receivables`) computed directly in SQL using indexed aggregate functions.
  3. Replace client-side multi-fetch loop in `CeoSuite.tsx` with a single call to the new aggregation endpoint.

#### PLAN-PERF-003: Dynamic Component Lazy Loading
- **Finding Ref**: `PERF-003`
- **Files Affected**: `src/app/[slug]/page.tsx`
- **Objective**: Drastically reduce initial JavaScript bundle download on counter terminals.
- **Technical Steps**:
  1. Replace static import declarations of heavy screens (`SalesHistory`, `TokenLedger`, `PurchasesView`, `FinancialLedgers`, `StockInventory`, `ShiftDrawer`, `BranchOrders`, `ClientCreditRecovery`, `HoldInvoices`, `TokenManagementView`) with `next/dynamic`.
  2. Keep only `PosBilling` statically imported to guarantee instantaneous first-paint for cashier checkout.
  3. Wrap lazy components in accessible fallback loaders (`Suspense`).

---

### Priority 2: Medium Severity Reliability & Memory Controls

#### PLAN-PERF-004: Bounded Ring Buffer & TTL for AI In-Memory Ledger
- **Finding Ref**: `PERF-004`
- **Files Affected**: `src/lib/ai-gateway.ts`
- **Objective**: Prevent unbounded heap memory growth in persistent server processes.
- **Technical Steps**:
  1. Impose a maximum array capacity of 500 items on `memoryLedger`.
  2. Implement automatic truncation: `if (memoryLedger.length > 500) memoryLedger.length = 500;`.
  3. Filter out records older than 30 days during periodic maintenance.

#### PLAN-PERF-005: Index Series Token Configurations by Series ID
- **Finding Ref**: `PERF-005`
- **Files Affected**: `src/app/api/items/route.ts`
- **Objective**: Optimize catalog enrichment algorithm from O(N * M) to O(N).
- **Technical Steps**:
  1. Group `configs` into a `Map<string, Config[]>` keyed by `series_id` prior to the items iteration loop.
  2. Perform fast Map lookup: `const seriesConfigs = configMap.get(item.series_id) || [];` and match units only within the target series.

#### PLAN-PERF-006: Robust Event-Driven Iframe Printing Lifecycle
- **Finding Ref**: `PERF-006`
- **Files Affected**: `src/utils/iframePrint.ts`
- **Objective**: Prevent premature DOM detachment during slow print dialog interactions.
- **Technical Steps**:
  1. Extend fallback cleanup timer from 3,000ms to 30,000ms.
  2. Store timeout handle in a variable and cancel with `clearTimeout` immediately when the `afterprint` event listener triggers.

#### PLAN-DEP-001: Relocate or Remove Direct `pg` Dependency
- **Finding Ref**: `DEP-001`
- **Files Affected**: `package.json`
- **Objective**: Remove unused direct database driver from production dependencies.
- **Technical Steps**:
  1. Move `"pg": "^8.23.1"` from `dependencies` to `devDependencies` since it is only referenced in auxiliary maintenance scripts in `scripts/`.
  2. Re-verify production build succeeds without `pg` in runtime bundle.

---

### Priority 3: Low Severity Cleanup & Layout Math

#### PLAN-PERF-007: Parameterized Dynamic Canvas Width for 58mm Slips
- **Finding Ref**: `PERF-007`
- **Files Affected**: `src/utils/receiptCanvas.ts`
- **Objective**: Eliminate text clipping on mobile Bluetooth thermal printers.
- **Technical Steps**:
  1. Accept paper size option (`paperSize: 'thermal_58' | 'thermal_80'`).
  2. Dynamically assign base width (384px for 58mm vs 576px for 80mm).

#### PLAN-DEP-002: Evaluate Dev Server CLI Flags
- **Finding Ref**: `DEP-002`
- **Files Affected**: `package.json`
- **Objective**: Modernize developer build configuration.
- **Technical Steps**:
  1. Test running `next dev` without `--webpack` to leverage Turbopack performance.

#### PLAN-LEG-001: Clean Up Dead Route Handler
- **Finding Ref**: `LEG-001`
- **Files Affected**: `src/app/ceo/page.tsx`
- **Objective**: Remove dead stub route calling `notFound()`.
- **Technical Steps**:
  1. Either delete `src/app/ceo/page.tsx` or redirect callers to `/[slug]` with an informative message.

#### PLAN-LEG-002: Atomic Default Template Switch Procedure
- **Finding Ref**: `LEG-002`
- **Files Affected**: `src/app/api/receipt-templates/route.ts`, `supabase/migrations/`
- **Objective**: Ensure default template switching is transactional.
- **Technical Steps**:
  1. Wrap `is_default` reset and update inside a PostgreSQL RPC `set_default_receipt_template(template_id)`.

---

## 3. Human Gate & Execution Policy

> [!IMPORTANT]
> **AUDIT PHASE COMPLETE — HUMAN APPROVAL REQUIRED**
>
> All 11 performance, dependency, and legacy findings are structured into technical implementation plans.
> **Zero remediation actions have been executed.**
> Implementation requires explicit human authorization.
