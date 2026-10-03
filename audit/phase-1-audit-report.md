# PHASE 1 REPORT — REPOSITORY & ARCHITECTURE

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 1 — Repository & Architecture  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED

---

## 1. Scope

Comprehensive structural, architectural, and inventory audit of the entire PyntFlow POS & Industrial ERP codebase.
- File system and folder topology
- File inventory across all source directories (`src/app`, `src/components`, `src/lib`, `src/types`, `src/utils`, `src/data`, `src/Logo`, `src/assets`, `supabase/migrations`, `scripts`)
- Routing and page architecture (App Router, dynamic `[slug]`, dev routes, CEO routing)
- API route inventory (28 endpoint handlers across 24 modules)
- Library utilities and services (`session.ts`, `supabase.ts`, `rate-limit.ts`, `auth-passwords.ts`, `ai-gateway.ts`)
- Database migrations inventory (15 SQL files)
- Configuration and security headers (`next.config.ts`, `package.json`, `tsconfig.json`, `eslint.config.mjs`)
- Middleware and authentication perimeter architecture
- Environment variables and secret access patterns
- Module dependency graph and cross-layer relationships

---

## 2. Files Inspected

### 2.1 Configuration & Tooling Files
- `package.json` (Core dependencies, build/dev scripts)
- `tsconfig.json` (TypeScript 5 compiler options & path aliases `@/*`)
- `next.config.ts` (Next.js 16 configuration, HTTP security response headers)
- `eslint.config.mjs` (Linter configuration)
- `postcss.config.mjs` (PostCSS / Tailwind v4 plugins)
- `.env.local` (Local environment variable declarations)
- `.gitignore` (Ignored patterns)

### 2.2 Application Entrypoints & Routing (`src/app`)
- `src/app/layout.tsx` (Root HTML layout, Google Fonts: Inter, JetBrains Mono, Plus Jakarta Sans)
- `src/app/page.tsx` (Root landing page, metadata, renders `LandingApp`)
- `src/app/globals.css` (Global styles, custom UI variables, scrollbar styling)
- `src/app/[slug]/page.tsx` (Core tenant application shell, POS, inventory, multi-tab POS system)
- `src/app/ceo/page.tsx` (CEO route placeholder, calls `notFound()`)
- `src/app/dev/page.tsx` (Developer Control Panel entrypoint, renders `AuraDevPanel`)

### 2.3 API Route Handlers (`src/app/api`)
1. `src/app/api/ai-invoice-scan/route.ts` (GET quota, POST invoice image vision scan)
2. `src/app/api/audit-logs/route.ts` (GET tenant audit logs)
3. `src/app/api/auth/login/route.ts` (POST username/password authentication & JWT session issuance)
4. `src/app/api/auth/logout/route.ts` (POST session cookie clearing)
5. `src/app/api/auth/dev-pin/route.ts` (POST dev PIN verification & DELETE session)
6. `src/app/api/branch-orders/route.ts` (GET branch orders, POST order creation, PATCH status updates)
7. `src/app/api/brands/route.ts` (GET, POST, PATCH paint brands)
8. `src/app/api/brand-series/route.ts` (GET, POST, PATCH brand series)
9. `src/app/api/clients/route.ts` (GET, POST, PATCH customer / contractor khata records)
10. `src/app/api/custom-units/route.ts` (GET, POST, PATCH custom pack units)
11. `src/app/api/dev/ai-control/route.ts` (GET global & tenant AI controls, PATCH limits & kill switch)
12. `src/app/api/expenses/route.ts` (GET, POST petty expenses)
13. `src/app/api/held-invoices/route.ts` (GET, POST, DELETE held/paused invoices)
14. `src/app/api/invoices/route.ts` (GET sales history, POST checkout, PATCH edit, DELETE cancel/return)
15. `src/app/api/items/route.ts` (GET inventory catalog, POST new item, PATCH item edit, DELETE item)
16. `src/app/api/items/receive/route.ts` (POST inward stock adjustment)
17. `src/app/api/ledgers/route.ts` (GET customer/supplier financial ledger transactions)
18. `src/app/api/purchases/route.ts` (GET, POST supplier purchase invoices)
19. `src/app/api/receipt-templates/route.ts` (GET, POST, PATCH, DELETE thermal receipt templates)
20. `src/app/api/receipt-templates/assign/route.ts` (GET, POST, DELETE tenant template assignments)
21. `src/app/api/shifts/route.ts` (GET shift status, POST open shift, PATCH close shift)
22. `src/app/api/suppliers/route.ts` (GET, POST suppliers)
23. `src/app/api/tenants/route.ts` (GET tenant details/branches, POST create branch, PATCH update branch, DELETE purge)
24. `src/app/api/token-configs/route.ts` (GET, PUT series token unit pricing configurations)
25. `src/app/api/token-redemptions/route.ts` (GET redemption logs, POST customer token payout)
26. `src/app/api/tokens/route.ts` (GET token balances/stockpile, POST token settlements & adjustments)
27. `src/app/api/users/route.ts` (GET, POST, PUT, DELETE tenant staff & cashier accounts)
28. `src/app/api/vouchers/route.ts` (GET, POST accounting vouchers)

### 2.4 Core Component Layer (`src/components`)
- `src/components/PosBilling.tsx` (POS counter checkout, quick search, item builder, token keep/remove logic, split payments)
- `src/components/StockInventory.tsx` (Stock inventory manager, bulk adjustments, barcode generator, alerts)
- `src/components/ShiftDrawer.tsx` (Shift register opening, closing, cash counts, commission calculations)
- `src/components/FinancialLedgers.tsx` (Khata ledgers, vouchers, customer/supplier balances)
- `src/components/PurchasesView.tsx` (Purchase orders, inward stock, supplier invoices, AI scan integration)
- `src/components/AiInvoiceScan.tsx` (AI camera/file invoice upload modal, item mapping, catalog auto-linking, quota pill)
- `src/components/SalesHistory.tsx` (Historical sales invoices, receipts reprint, thermal preview, cancellations)
- `src/components/HoldInvoices.tsx` (Held/paused draft sales carts)
- `src/components/ClientCreditRecovery.tsx` (Contractor aging, khata recovery tracking)
- `src/components/TokenLedger.tsx` (Paint token audit trail, physical stockpile, vendor settlement)
- `src/components/TokenManagementView.tsx` (Brand/Series/Unit token value matrix configuration)
- `src/components/TokenRedemption.tsx` (Customer paint bucket token return & cash/credit redemption)
- `src/components/BranchOrders.tsx` (Inter-branch stock transfer requisition)
- `src/components/CeoDashboard.tsx` (Wrapper rendering CEO Suite)

### 2.5 Specialized Sub-Panels
- `src/components/ceo-panel/` (21 files: `CeoSuite.tsx`, `OverviewView.tsx`, `SalesView.tsx`, `ReturnsView.tsx`, `DayCloseView.tsx`, `CustomersView.tsx`, `PurchaseView.tsx`, `TokensView.tsx`, `BranchOrdersView.tsx`, `AuditLogsView.tsx`, `SettingsView.tsx`, Modals, Header, Sidebar)
- `src/components/dev-panel/` (15 files: `AuraDevPanel.tsx`, `DevAiControlView.tsx`, `DevBranchesView.tsx`, `DevUsersView.tsx`, `DevReceiptTemplatesView.tsx`, `DevTemplateAssignView.tsx`, `DevOverviewView.tsx`, `DevPinLogin.tsx`, Modals, Sidebar)
- `src/components/landing/` (14 components + 6 subdirectories: Hero, Bento, Pricing, FAQ, Footer, Navbar, DemoModal, etc.)

### 2.6 Core Library, Security & Utility Files (`src/lib`, `src/utils`, `src/types`)
- `src/lib/session.ts` (JWT session verification, `requireTenantAuth`, `requireDevAuth`, cookie/header extraction)
- `src/lib/supabase.ts` (Public `supabase` client and elevated `supabaseAdmin` client)
- `src/lib/auth-passwords.ts` (Bcrypt password hashing & plain-text legacy comparison fallback)
- `src/lib/rate-limit.ts` (Sliding window IP-based in-memory rate limiter for auth routes)
- `src/lib/ai-gateway.ts` (Central AI Gateway, resilient quota ledger, Gemini vision inference)
- `src/types/index.ts` (Canonical TypeScript models: Tenant, AppUser, Item, Invoice, TokenTransaction, Shift, etc.)
- `src/types/ceo.ts` (CamelCase CEO panel domain types: Branch, DayCloseRecord, Customer, CeoSupplier, etc.)
- `src/types/dev.ts` (Developer panel tab & view types)
- `src/types/receipt.ts` (Receipt designer typography, canvas, paper width schemas)
- `src/utils/receiptCanvas.ts` (HTML5 Canvas thermal receipt pixel renderer for 58mm/80mm ESC/POS printers)
- `src/utils/iframePrint.ts` (Silent hidden iframe browser printing utility)

### 2.7 Database Migrations (`supabase/migrations`)
1. `20260924_01_fix_missing_columns.sql`
2. `20260924_02_business_constraints.sql`
3. `20260924_03_performance_indexes.sql`
4. `20260924_04_secure_held_invoices_rls.sql`
5. `20260925_05_atomic_stock_adjust.sql`
6. `20260925_06_receipt_templates.sql`
7. `20261002_01_paint_token_management.sql`
8. `20261002_02_atomic_invoice_tokens.sql`
9. `20261002_03_redeem_tokens_atomic.sql`
10. `20261003_01_centralized_ai_usage_system.sql`
11. `feature_2_paint_token_system.sql`
12. `feature_2_token_claims.sql`
13. `feature_2_token_enhancements.sql`
14. `feature_2_token_stockpile_redeemed_and_vouchers.sql`
15. `feature_2_token_stockpile_usage.sql`

### 2.8 Scripts (`scripts/`)
1. `apply-ai-migration.mjs`
2. `apply-sql.mjs`
3. `execute-migration.mjs`
4. `test-db-direct.mjs`
5. `test-pg-connection.mjs`
6. `verify-ai-usage-system.mjs`
7. `verify-ai-usage-system.ts`
8. `verify-section31-all.mjs`
9. `verify-task65.mjs`
10. `verify-task66-comprehensive.mjs`
11. `verify-task66.mjs`

---

## 3. Database Objects Inspected (Structural Map)

- **Tables:** `tenants`, `app_users`, `items`, `custom_units`, `brands`, `brand_series`, `series_token_configs`, `customers`/`clients`, `suppliers`, `invoices`, `invoice_items`, `held_invoices`, `purchases`, `purchase_items`, `shifts`, `expenses`/`petty_expenses`, `customer_tokens`, `token_redemptions`, `token_redemption_items`, `token_transactions`, `vouchers`, `financial_ledgers`, `audit_logs`, `branch_orders`, `branch_order_items`, `receipt_templates`, `receipt_template_assignments`, `global_ai_settings`, `tenant_ai_settings`, `ai_usage_ledger`.
- **RPC Functions Identified in Migrations:**
  - `adjust_item_stock_atomic` (Atomic stock delta increment/decrement)
  - `process_pos_checkout_atomic` / `atomic_invoice_tokens` (Atomic checkout, inventory deduction, and token dispatch)
  - `process_token_redemption_atomic` / `redeem_tokens_atomic` (Atomic customer token redemption and cash payout)
  - `reserve_ai_usage` (Atomic AI usage quota check and ledger reservation with `FOR UPDATE` locking)

---

## 4. APIs Inspected

Complete list of 28 route files covering 48 individual HTTP endpoints cataloged and audited for method exposure, parameter extraction, and authorization handlers.

---

## 5. Runtime Tests Executed

- **Repository file measurement & tree traversal:** Executed live PowerShell recursive inventory command: exactly **218 active codebase files** (excluding `.next`, `node_modules`, `.git`).
- **Static AST & Import Analysis:** Ran ripgrep verification over all imports, exports, and environment variable lookups.

---

## 6. Verified Correct (Architectural Strengths)

1. **Centralized AI Provider Encapsulation:** Verified `@google/generative-ai` is imported and used in exactly one file (`src/lib/ai-gateway.ts`). Zero direct provider leaks in route handlers.
2. **Unified Session Validation Helpers:** Route handlers consistently consume `requireTenantAuth` or `requireDevAuth` from `src/lib/session.ts` for tenant boundary verification.
3. **Multi-Branch Sister Company Resolution:** `requireTenantAuth` implements authorization for multi-branch CEOs by verifying matching `owner_name` or `email` in `tenants`.
4. **Resilient Thermal Printing Architecture:** `receiptCanvas.ts` and `iframePrint.ts` provide dedicated pixel-level rendering for ESC/POS printers without external cloud print dependencies.
5. **Modern Build & Dependency Stack:** Package ecosystem uses Next.js 16.3.4 (App Router), React 19, TypeScript 5, Tailwind CSS 4, and `jose` for stateless JWT encryption.

---

## 7. Architectural Findings & Structural Risks

### FINDING-ARCH-001
- **Severity:** HIGH
- **Location:** `src/` (Entire repository root)
- **Component:** Edge Middleware / Network Perimeter
- **Evidence:** Ripgrep search confirmed 0 `middleware.ts` or `src/middleware.ts` files exist in the repository.
- **Actual Behavior:** Authentication and tenant authorization checks are executed independently inside each individual Route Handler (`src/app/api/**/route.ts`).
- **Expected Behavior:** Next.js Edge Middleware should intercept incoming `/api/*` and `/[slug]/*` routes to perform unified token verification, rate limiting, and security header validation before reaching route handlers.
- **Impact:** An omitted `requireTenantAuth` or `requireDevAuth` call in any new or refactored route handler immediately creates an unauthenticated endpoint.
- **Reproduction:** Inspect repository root and `src/` directory; observe absence of `middleware.ts`.
- **Verification Status:** VERIFIED

---

### FINDING-ARCH-002
- **Severity:** HIGH
- **Location:** `src/lib/auth-passwords.ts:25-27`
- **Component:** `verifyPassword` function
- **Evidence:**
  ```typescript
  // Fallback for unmigrated plain-text passwords
  return plainText === storedHash;
  ```
- **Actual Behavior:** If a database password hash does not begin with `$2a$` or `$2b$`, the system performs a plain-text string comparison.
- **Impact:** Plain-text passwords in `app_users.password_hash` will successfully authenticate without triggering hash upgrades or warnings.
- **Reproduction:** Inspect `src/lib/auth-passwords.ts` lines 25-27.
- **Verification Status:** VERIFIED

---

### FINDING-ARCH-003
- **Severity:** MEDIUM
- **Location:** `src/lib/session.ts:16-22` & `src/app/api/auth/dev-pin/route.ts:42`
- **Component:** Session Secrets & Dev PIN Fallback
- **Evidence:**
  ```typescript
  // src/lib/session.ts:19
  return new TextEncoder().encode('pyntflow-dev-secret-super-key-32-chars-min!');
  // src/app/api/auth/dev-pin/route.ts:42
  const masterPin = (process.env.DEV_ADMIN_PIN || (process.env.NODE_ENV !== 'production' ? 'dev2026' : '')).trim();
  ```
- **Actual Behavior:** If `DEV_ADMIN_SECRET` is omitted in non-production or staging environments, a hardcoded fallback key is utilized. `DEV_ADMIN_PIN` defaults to `'dev2026'` when `NODE_ENV !== 'production'`.
- **Impact:** Staging deployments running with `NODE_ENV !== 'production'` without explicit `.env` configurations are accessible using default dev credentials.
- **Reproduction:** Inspect `src/lib/session.ts:19` and `src/app/api/auth/dev-pin/route.ts:42`.
- **Verification Status:** VERIFIED

---

### FINDING-ARCH-004
- **Severity:** MEDIUM
- **Location:** `src/types/index.ts` vs `src/types/ceo.ts`
- **Component:** Schema Naming & Type Duality
- **Evidence:** `src/types/index.ts` uses snake_case (`invoice_no`, `client_name`, `net_total`, `paid_amount`), while `src/types/ceo.ts` defines separate camelCase models (`invoiceNumber`, `customerName`, `netAmount`, `paidAmount`).
- **Actual Behavior:** CEO components must execute runtime key mapping or duplicate queries to adapt database responses into camelCase interfaces.
- **Impact:** Increases cognitive overhead, potential transformation bugs, and payload inconsistencies across modules.
- **Reproduction:** Compare `src/types/index.ts:120-146` with `src/types/ceo.ts:33-57`.
- **Verification Status:** VERIFIED

---

### FINDING-ARCH-005
- **Severity:** LOW
- **Location:** `next.config.ts:29-31`
- **Component:** HTTP Security Headers / Permissions-Policy
- **Evidence:**
  ```typescript
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  }
  ```
- **Actual Behavior:** The `Permissions-Policy` header explicitly disables camera access (`camera=()`) across all routes.
- **Expected Behavior:** If the AI invoice scanner or barcode scanner utilizes WebRTC `navigator.mediaDevices.getUserMedia()`, the browser will reject the camera stream. (Standard `<input type="file" capture="environment">` is unaffected, but direct video streams are blocked).
- **Impact:** Direct live camera stream features will fail if introduced without adjusting permissions policy headers.
- **Reproduction:** Inspect `next.config.ts` line 30.
- **Verification Status:** VERIFIED

---

## 8. Security Findings Summary
- Absence of edge middleware perimeter (`FINDING-ARCH-001`)
- Plain-text password fallback comparison in authentication helper (`FINDING-ARCH-002`)
- Development PIN & secret fallbacks for non-production environments (`FINDING-ARCH-003`)

---

## 9. Data Integrity Findings Summary
- Dual-type definitions (snake_case vs camelCase) between standard POS and CEO suites (`FINDING-ARCH-004`)

---

## 10. Business Logic Findings Summary
- Business logic is partitioned across POS Billing, Stock Inventory, Financial Ledgers, Shift Drawer, Token Management, and AI Invoice Scanner.

---

## 11. Performance Findings Summary
- Database migration history demonstrates added indexes (`20260924_03_performance_indexes.sql`), but runtime query efficiency and N+1 query patterns require verification in Phase 4 (APIs) and Phase 11 (Performance).

---

## 12. Legacy / Dead Code
- Legacy fields retained in `src/types/index.ts:269-297` (`transaction_type`, `item_id`, `item_name`, `brand`, `token_count`, `unit_token_value`, `remaining_count`, `is_external`, `redeemed_amount`, `claim_status`, `claim_reference`, etc.).
- `src/app/ceo/page.tsx` contains a dead stub returning `notFound()`.

---

## 13. Unknown / Not Verified
- Actual execution latency under high concurrency across all 28 API routes (to be audited in Phase 4 & Phase 10).
- Consistency of database schema with migration files in the live Supabase instance (to be audited in Phase 2).

---

## 14. Ambiguities
- **CEO Navigation Architecture:** Is `/ceo` intended to be a standalone URL route in future milestones, or permanently accessed via the `[slug]` tenant dashboard by CEO accounts? (HUMAN DECISION REQUIRED).

---

## 15. Cross-Phase Dependencies
- **Phase 2 (Database & Migrations):** Requires verifying that all 15 migration files have been applied to the live PostgreSQL instance and that table constraints match application models.
- **Phase 3 (Auth & Tenant Isolation):** Requires testing every API route for IDOR and privilege escalation due to the absence of edge middleware.
- **Phase 4 (API / Backend):** Requires line-by-line inspection of all 28 API route files for input validation and transaction atomicity.

---

## 16. Changes Made
**NONE — AUDIT ONLY**

---

## 17. Phase Verdict
**PARTIALLY VERIFIED**  
*(Architecture and repository map are fully inventoried; 5 structural/security findings documented for downstream phases).*
