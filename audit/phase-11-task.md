# Phase 11 — Performance, Dependency & Legacy Remediation Tasks

> **Status**: IMPLEMENTATION-READY — NOT EXECUTED  
> **Phase**: 11 (Performance, Dependencies & Legacy Audit)  
> **Constraint**: AUDIT ONLY. Zero code changes executed during audit.  
> **Source Plan**: `audit/phase-11-implementation-plan.md`  
> **Source Audit**: `audit/phase-11-audit-report.md`

---

## 1. Task Inventory

| Task ID | Finding Ref | Severity | Title / Scope | Status |
|---|---|---|---|---|
| **TASK-P11-01** | PERF-001 | HIGH | Paginate invoices & strip nested child tree by default | Implementation-Ready (Not Executed) |
| **TASK-P11-02** | PERF-002 | HIGH | Server-side branch KPI aggregation RPC (eliminate N+1) | Implementation-Ready (Not Executed) |
| **TASK-P11-03** | PERF-003 | HIGH | Implement dynamic lazy-loading for monolithic UI screens | Implementation-Ready (Not Executed) |
| **TASK-P11-04** | PERF-004 | MEDIUM | Add bounded ring buffer & TTL eviction for AI memory ledger | Implementation-Ready (Not Executed) |
| **TASK-P11-05** | PERF-005 | MEDIUM | Index series token configs by series ID in catalog items route | Implementation-Ready (Not Executed) |
| **TASK-P11-06** | PERF-006 | MEDIUM | Extend timeout and cancel on `afterprint` in hidden iframe printer | Implementation-Ready (Not Executed) |
| **TASK-P11-07** | PERF-007 | LOW | Parameterize dynamic canvas width for 58mm mobile slips | Implementation-Ready (Not Executed) |
| **TASK-P11-08** | DEP-001 | MEDIUM | Relocate `pg` from dependencies to devDependencies | Implementation-Ready (Not Executed) |
| **TASK-P11-09** | DEP-002 | LOW | Evaluate and remove `--webpack` flag from dev script | Implementation-Ready (Not Executed) |
| **TASK-P11-10** | LEG-001 | LOW | Remove dead `src/app/ceo/page.tsx` stub route | Implementation-Ready (Not Executed) |
| **TASK-P11-11** | LEG-002 | LOW | Wrap default receipt template switching in atomic procedure | Implementation-Ready (Not Executed) |

---

## 2. Detailed Task Specifications

### TASK-P11-01: Paginate Invoices & Strip Deep Child Tree
- **Finding Ref**: PERF-001
- **Objective**: Prevent multi-megabyte JSON payloads on invoice fetches.
- **Target Files**: `src/app/api/invoices/route.ts`
- **Required Behavior**: Lower default limit from 5,000 to 50; only include `invoice_items(*)` if `include_items=true` is explicitly requested; enforce cursor pagination.
- **Verification**: `GET /api/invoices?tenant_id=...` returns ≤ 50 records without child items; payload size < 100KB.

### TASK-P11-02: Server-Side Branch KPI Aggregation RPC
- **Finding Ref**: PERF-002
- **Objective**: Eliminate N+1 fan-out queries downloading raw tables for sister branches.
- **Target Files**: `src/components/ceo-panel/CeoSuite.tsx`, `supabase/migrations/`
- **Required Behavior**: Deploy database function `get_ceo_branches_kpi_summary`; update `CeoSuite.tsx` to execute a single fetch replacing the multi-branch loop.
- **Verification**: Opening CEO Suite triggers exactly 1 API call for all branch KPIs instead of 2 * N calls.

### TASK-P11-03: Dynamic Lazy-Loading for Monolithic UI Screens
- **Finding Ref**: PERF-003
- **Objective**: Reduce initial client JavaScript bundle size and improve counter TTI.
- **Target Files**: `src/app/[slug]/page.tsx`
- **Required Behavior**: Convert static imports of 10 secondary screens to `next/dynamic` with Suspense fallbacks; maintain static import only for `PosBilling`.
- **Verification**: Initial bundle analysis demonstrates separate chunks for `SalesHistory`, `FinancialLedgers`, `PurchasesView`.

### TASK-P11-04: Bounded Ring Buffer & TTL for AI Memory Ledger
- **Finding Ref**: PERF-004
- **Objective**: Prevent unbounded memory leaks in persistent Node.js processes.
- **Target Files**: `src/lib/ai-gateway.ts`
- **Required Behavior**: Cap `memoryLedger` array at 500 items; truncate old entries on push; add periodic 30-day timestamp cleanup.
- **Verification**: Simulating 1,000 requests does not increase `memoryLedger.length` beyond 500.

### TASK-P11-05: Index Series Token Configurations by Series ID
- **Finding Ref**: PERF-005
- **Objective**: Eliminate O(N * M) nested loop in items catalog enrichment.
- **Target Files**: `src/app/api/items/route.ts`
- **Required Behavior**: Construct `Map<string, Config[]>` keyed by `series_id` before iterating items.
- **Verification**: CPU execution time for catalog serialization scales linearly with item count.

### TASK-P11-06: Robust Event-Driven Iframe Printing Lifecycle
- **Finding Ref**: PERF-006
- **Objective**: Prevent print cancellation if cashier takes > 3 seconds in print dialog.
- **Target Files**: `src/utils/iframePrint.ts`
- **Required Behavior**: Extend safety timer to 30,000ms; save timer handle; call `clearTimeout` inside `afterprint` listener.
- **Verification**: Print dialog kept open for 10 seconds prints successfully without DOM removal.

### TASK-P11-07: Parameterized Dynamic Canvas Width for 58mm Slips
- **Finding Ref**: PERF-007
- **Objective**: Avoid text wrapping artifacts on handheld mobile thermal printers.
- **Target Files**: `src/utils/receiptCanvas.ts`
- **Required Behavior**: Accept paper size parameter and set canvas base width to 384px for 58mm and 576px for 80mm.
- **Verification**: 58mm canvas generation renders crisp image without right-edge text truncation.

### TASK-P11-08: Move Direct `pg` Dependency to devDependencies
- **Finding Ref**: DEP-001
- **Objective**: Clean production dependencies of unused native database socket driver.
- **Target Files**: `package.json`
- **Required Behavior**: Move `"pg"` from `dependencies` to `devDependencies`.
- **Verification**: Production build (`npm run build`) succeeds without warnings.

### TASK-P11-09: Evaluate and Remove `--webpack` Flag
- **Finding Ref**: DEP-002
- **Objective**: Improve developer server compilation speed on Next.js 16.
- **Target Files**: `package.json`
- **Required Behavior**: Remove `--webpack` flag from `dev` script if Turbopack compiles without errors.
- **Verification**: `npm run dev` boots successfully with Next.js Turbopack.

### TASK-P11-10: Remove Dead `src/app/ceo/page.tsx` Stub Route
- **Finding Ref**: LEG-001
- **Objective**: Remove obsolete dead route.
- **Target Files**: `src/app/ceo/page.tsx`
- **Required Behavior**: Delete file or replace with client redirect to `/[slug]`.
- **Verification**: No dead route invoking `notFound()`.

### TASK-P11-11: Atomic Default Receipt Template Switching
- **Finding Ref**: LEG-002
- **Objective**: Prevent zero-default template bug on update failure.
- **Target Files**: `src/app/api/receipt-templates/route.ts`, `supabase/migrations/`
- **Required Behavior**: Implement PostgreSQL RPC `set_default_receipt_template` wrapping reset and assignment in a single transaction.
- **Verification**: Failed update rolls back previous default state safely.

---

## 3. Human Gate & Execution Policy

> [!IMPORTANT]
> **AUDIT ONLY RULE ENFORCED**
>
> All 11 tasks in this register are derived directly from `audit/phase-11-audit-report.md`.
> **Zero remediation tasks have been executed.**
> Execution of any task requires explicit human authorization.
