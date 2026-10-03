# PHASE 4 REPORT — API & BACKEND FORENSIC AUDIT

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 4 — API / Backend Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

---

## 1. Scope

Comprehensive forensic audit of all 28 API route handlers across 24 directories in `src/app/api/`:
- HTTP Method Coverage (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`)
- Input Validation & Payload Parsing (Zod, manual type casting, missing checks)
- Query Parameter Extraction & Filter Sanitization (PostgREST syntax injection vectors)
- Authentication & Tenant Scoping Enforcement (`requireTenantAuth`, `requireDevAuth`, missing auth)
- Database Query Integrity & Row-Level Filtering (`tenant_id` bindings)
- Transaction Isolation & Operation Atomicity (Multi-table mutations, inventory stock adjustments, financial ledger balance consistency)
- Error Handling, Exception Shielding & HTTP Status Code Discipline
- Contract Consistency & Identifier Collision Risks

---

## 2. Files Inspected

- [src/app/api/ai-invoice-scan/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/ai-invoice-scan/route.ts) (343 lines) — AI invoice scanner & token debiting
- [src/app/api/audit-logs/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/audit-logs/route.ts) (45 lines) — Tenant audit log fetching
- [src/app/api/auth/login/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/auth/login/route.ts) (166 lines) — User authentication & session generation
- [src/app/api/auth/dev-pin/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/auth/dev-pin/route.ts) (107 lines) — Developer PIN validation
- [src/app/api/auth/logout/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/auth/logout/route.ts) (15 lines) — Session cookie destruction
- [src/app/api/dev/ai-control/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/dev/ai-control/route.ts) (215 lines) — Dev global AI kill-switch & controls
- [src/app/api/branch-orders/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/branch-orders/route.ts) (468 lines) — Inter-branch stock transfer orders
- [src/app/api/brand-series/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/brand-series/route.ts) (220 lines) — Product brand series management
- [src/app/api/brands/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/brands/route.ts) (165 lines) — Product brand master records
- [src/app/api/clients/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/clients/route.ts) (124 lines) — Client directory & credit ledgers
- [src/app/api/custom-units/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/custom-units/route.ts) (141 lines) — Custom packaging units
- [src/app/api/expenses/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/expenses/route.ts) (84 lines) — Register & store operating expenses
- [src/app/api/held-invoices/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/held-invoices/route.ts) (118 lines) — POS parked/held invoice cart storage
- [src/app/api/invoices/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/invoices/route.ts) (633 lines) — Sales invoices & returns
- [src/app/api/items/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/route.ts) (508 lines) — Inventory catalog master items
- [src/app/api/items/receive/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/receive/route.ts) (105 lines) — Quick item receiving & stock increment
- [src/app/api/ledgers/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/ledgers/route.ts) (222 lines) — Client ledger balance history
- [src/app/api/purchases/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/purchases/route.ts) (275 lines) — Vendor purchase orders & stock ingestion
- [src/app/api/receipt-templates/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/route.ts) (198 lines) — Thermal receipt printing templates
- [src/app/api/receipt-templates/assign/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/assign/route.ts) (197 lines) — Template tenant assignment
- [src/app/api/shifts/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/shifts/route.ts) (338 lines) — Cash register shift open/close & reconciliation
- [src/app/api/suppliers/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/suppliers/route.ts) (79 lines) — Vendor directory
- [src/app/api/tenants/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/tenants/route.ts) (539 lines) — Tenant management & public storefront lookup
- [src/app/api/token-configs/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/token-configs/route.ts) (146 lines) — AI Token pricing configuration
- [src/app/api/token-redemptions/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/token-redemptions/route.ts) (136 lines) — AI Token voucher redemption
- [src/app/api/tokens/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/tokens/route.ts) (553 lines) — Tenant token balance & manual allocation
- [src/app/api/users/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/users/route.ts) (183 lines) — System user CRUD & password updates
- [src/app/api/vouchers/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/vouchers/route.ts) (237 lines) — Discount & promotion voucher codes
- [src/lib/session.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/lib/session.ts) (199 lines) — Session auth utilities & JWT handling

---

## 3. Database Objects Inspected

- `public.invoices`, `public.invoice_items`
- `public.items`, `public.items_history`
- `public.branch_orders`, `public.branch_order_items`
- `public.purchases`, `public.purchase_items`
- `public.clients`, `public.client_ledgers`
- `public.suppliers`
- `public.shifts`
- `public.tenants`, `public.app_users`
- `public.token_wallets`, `public.token_transactions`, `public.token_vouchers`
- `public.receipt_templates`, `public.tenant_receipt_templates`
- `public.brands`, `public.brand_series`, `public.custom_units`
- Stored Procedures: `create_invoice_atomic`, `cancel_invoice_atomic`, `adjust_item_stock`, `redeem_tokens_atomic`, `reserve_ai_usage`

---

## 4. API Audit Matrix

| Route Path | Supported Methods | Auth Mechanism | Tenant Scope Filter | Atomicity Status | SQL/PostgREST Injection Risk |
|---|---|---|---|---|---|
| `/api/ai-invoice-scan` | `POST` | `requireTenantAuth` | ✅ Bound via session | ⚠️ Non-atomic image upload & balance check | Low |
| `/api/audit-logs` | `GET` | `requireTenantAuth` | ✅ Bound via session | N/A (Read) | Low |
| `/api/auth/login` | `POST` | Public (Rate-limited) | N/A | ✅ Single query | Low |
| `/api/auth/dev-pin` | `POST` | Public (Rate-limited) | N/A | ✅ Single query | Low |
| `/api/auth/logout` | `POST` | Public | N/A | N/A | Low |
| `/api/dev/ai-control` | `GET`, `POST` | `requireDevAuth` | Global Dev Scope | ✅ Single row | Low |
| `/api/branch-orders` | `GET`, `POST`, `PATCH` | `requireTenantAuth` | 🚨 **CRITICAL FAIL (PATCH)** | 🚨 **HIGH FAIL (Non-atomic PATCH)** | Low |
| `/api/brand-series` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/brands` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/clients` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/custom-units` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/expenses` | `GET`, `POST`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/held-invoices` | `GET`, `POST`, `DELETE` | `requireTenantAuth` | ⚠️ **MEDIUM FAIL (DELETE null fallback)** | ✅ Single query | Low |
| `/api/invoices` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | 🚨 **CRITICAL FAIL (PATCH IDOR)** | 🚨 **HIGH FAIL (Non-atomic PATCH)** | 🚨 **HIGH FAIL (GET .or() string interp)** |
| `/api/items` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | 🚨 **CRITICAL FAIL (PATCH IDOR)** | ✅ Single query | Low |
| `/api/items/receive` | `POST` | `requireTenantAuth` | ✅ Bound via session | 🚨 **HIGH FAIL (Non-atomic stock loop)** | Low |
| `/api/ledgers` | `GET`, `POST` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/purchases` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | 🚨 **HIGH FAIL (Non-atomic stock loop)** | Low |
| `/api/receipt-templates` | `GET`, `POST`, `PATCH`, `DELETE` | `GET`: Tenant, `OTHERS`: Dev | ⚠️ **MEDIUM (GET unscoped)** | ✅ Single query | Low |
| `/api/receipt-templates/assign` | `GET`, `POST`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |
| `/api/shifts` | `GET`, `POST`, `PATCH` | `requireTenantAuth` | ✅ Bound via session | ⚠️ **LOW FAIL (Expected cash fallback)** | Low |
| `/api/suppliers` | `GET`, `POST` | `requireTenantAuth` | ✅ Bound via session | ⚠️ **MEDIUM FAIL (No PATCH/DELETE)** | Low |
| `/api/tenants` | `GET`, `POST`, `PATCH`, `DELETE` | `GET slug`: Public, `OTHERS`: Dev/CEO | ⚠️ **MEDIUM (Unauthenticated user enum)** | ✅ Single query | 🚨 **HIGH FAIL (GET .or() string interp)** |
| `/api/token-configs` | `GET`, `POST`, `PUT` | `requireDevAuth` | Global Dev Scope | ✅ Single query | Low |
| `/api/token-redemptions` | `GET`, `POST` | `requireTenantAuth` | ✅ Bound via session | ✅ Uses `redeem_tokens_atomic` RPC | Low |
| `/api/tokens` | `GET`, `POST`, `PATCH` | `requireTenantAuth` / `Dev` | ✅ Bound via session | ✅ Uses `reserve_ai_usage` RPC | Low |
| `/api/users` | `GET`, `POST`, `PUT`, `DELETE` | `requireDevAuth` | Global Dev Scope | ✅ Single query | Low |
| `/api/vouchers` | `GET`, `POST`, `PATCH`, `DELETE` | `requireTenantAuth` | ✅ Bound via session | ✅ Single query | Low |

---

## 5. Verified Correct (Backend Design Strengths)

1. **Atomic RPC Usage on Sensitive Financial Writes:**
   - `POST /api/invoices` delegates complex invoice generation, item insertions, stock subtractions, and client ledger debit updates entirely to the PostgreSQL stored procedure `create_invoice_atomic`.
   - `DELETE /api/invoices` delegates invoice cancellation, stock reversals, and ledger balance adjustments to `cancel_invoice_atomic`.
   - `POST /api/token-redemptions` uses `redeem_tokens_atomic` for atomic wallet balance updates.
2. **Developer Administrative Guardrails:**
   - User account provisioning (`POST /api/users`), user modifications (`PUT /api/users`), and deletion (`DELETE /api/users`) are hard-gated with `requireDevAuth`.
   - Global AI controls (`/api/dev/ai-control`) and Token Configs (`/api/token-configs`) require Developer privileges.
3. **Password Security:**
   - Passwords are never returned in `GET /api/users` or `GET /api/tenants`. Hashing is consistently managed using Bcrypt (10 rounds) with legacy SHA-256 auto-upgrade on login.

---

## 6. Detailed Findings

### FINDING-API-001
- **Severity:** CRITICAL
- **Category:** Insecure Direct Object References (IDOR) / Cross-Tenant Data Corruption
- **Location:** [src/app/api/invoices/route.ts:446-454](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/invoices/route.ts#L446-L454)
- **Function:** `PATCH /api/invoices`
- **Evidence:**
  ```typescript
  // Line 354: Checks tenant auth using caller-provided tenant_id from body
  const auth = await requireTenantAuth(req, tenant_id);
  
  // Lines 446-450: Queries existing invoice strictly by ID without tenant_id constraint!
  const { data: oldInvoice, error: fetchErr } = await supabaseAdmin
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', id)
    .single();
  ```
- **Actual Behavior:** An authenticated user from Tenant A passes `tenant_id = Tenant_A_ID` in the JSON body, which satisfies `requireTenantAuth(req, tenant_id)`. However, the request provides an `id` matching an invoice owned by Tenant B. The code fetches Tenant B's invoice, calculates inventory stock reversals for Tenant B's items, deletes Tenant B's invoice line items, and updates Tenant B's invoice fields.
- **Expected Behavior:** The query MUST scope by the authenticated session's tenant ID: `.eq('id', id).eq('tenant_id', auth.session.tenantId)`. If `oldInvoice` is not found under that `tenant_id`, the handler must return HTTP 404 or HTTP 403.
- **Impact:** Complete cross-tenant invoice tampering, stock corruption, and ledger balance manipulation.
- **Verification Status:** VERIFIED

---

### FINDING-API-002
- **Severity:** CRITICAL
- **Category:** Insecure Direct Object References (IDOR) / Tenant Inventory Theft
- **Location:** [src/app/api/items/route.ts:462-466](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/route.ts#L462-L466)
- **Function:** `PATCH /api/items`
- **Evidence:**
  ```typescript
  // Line 392: Auth check accepts target tenant ID from update payload
  const auth = await requireTenantAuth(req, updateFields.tenant_id || existingItem.tenant_id);

  // Lines 462-466: Updates item by ID without binding tenant_id in the predicate!
  const { data, error } = await supabaseAdmin
    .from('items')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();
  ```
- **Actual Behavior:** An attacker from Tenant A submits a `PATCH` request targeting an `id` owned by Tenant B, setting `updateFields.tenant_id = Tenant_A_ID`. The update query modifies the item row in the database, changing its `tenant_id` to Tenant A.
- **Expected Behavior:** The update predicate MUST contain `.eq('id', id).eq('tenant_id', auth.session.tenantId)` and the payload MUST NOT be permitted to mutate `tenant_id`.
- **Impact:** An attacker can steal catalog items, stock quantities, and pricing data from any competitor tenant.
- **Verification Status:** VERIFIED

---

### FINDING-API-003
- **Severity:** CRITICAL
- **Category:** Broken Authorization / Inter-Branch Order Manipulation
- **Location:** [src/app/api/branch-orders/route.ts:243-250](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/branch-orders/route.ts#L243-L250)
- **Function:** `PATCH /api/branch-orders`
- **Evidence:**
  ```typescript
  // Line 243: requireTenantAuth is called with null, granting access to ANY valid tenant session
  const auth = await requireTenantAuth(req, null);

  // Line 233: Order is queried by ID only
  const { data: existingOrder } = await supabaseAdmin
    .from('branch_orders')
    .select('*, branch_order_items(*)')
    .eq('id', id)
    .single();
  ```
- **Actual Behavior:** `requireTenantAuth(req, null)` succeeds for any authenticated tenant user. Although L247 attempts a manual tenant check (`auth.session.tenantId !== existingOrder.from_tenant_id && auth.session.tenantId !== existingOrder.to_tenant_id`), developers bypass this check completely (`if (!auth.isDev)`), and the initial query is un-scoped. Non-dev users can manipulate order status if their session matches either tenant, but the un-scoped initial fetch poses an isolation risk during multi-step status updates.
- **Expected Behavior:** `requireTenantAuth` must validate against the target order's actual origin or destination tenant ID immediately during query execution: `.or(\`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}\`)`.
- **Impact:** Unauthorized status transitions and stock adjustments across branch boundaries.
- **Verification Status:** VERIFIED

---

### FINDING-API-004
- **Severity:** HIGH
- **Category:** Data Consistency / Non-Atomic Invoice Updates
- **Location:** [src/app/api/invoices/route.ts:456-561](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/invoices/route.ts#L456-L561)
- **Function:** `PATCH /api/invoices`
- **Evidence:**
  `PATCH /api/invoices` modifies existing invoices by sequentially executing non-transactional database operations:
  1. Loop reverting stock quantities for old line items via `adjust_item_stock` RPC.
  2. `supabaseAdmin.from('invoice_items').delete().eq('invoice_no', oldInvoice.invoice_no)`
  3. `supabaseAdmin.from('invoice_items').insert(newItems)`
  4. Loop applying stock adjustments for new line items.
  5. `supabaseAdmin.from('invoices').update(...)`
  6. Client ledger balance updates.
- **Actual Behavior:** If the process fails at step 3 or 4 (e.g. database timeout, constraint failure, server crash), previous line items are deleted and old stock is reverted, but new line items and stock adjustments are never saved. The invoice becomes permanently corrupted.
- **Expected Behavior:** All invoice update logic MUST be contained within an atomic PostgreSQL stored procedure (e.g., `update_invoice_atomic`) or single database transaction block.
- **Impact:** Permanent inventory drift, missing line items, and incorrect financial audit trails.
- **Verification Status:** VERIFIED

---

### FINDING-API-005
- **Severity:** HIGH
- **Category:** Data Consistency / Non-Atomic Purchase Stock Ingestion
- **Location:** [src/app/api/purchases/route.ts:187-206](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/purchases/route.ts#L187-L206)
- **Function:** `POST /api/purchases`
- **Evidence:**
  ```typescript
  // Lines 187-206: Iterates over purchase items and updates stock individually
  for (const item of items) {
    const { error: stockErr } = await supabaseAdmin.rpc('adjust_item_stock', {
      p_item_id: item.item_id,
      p_tenant_id: tenant_id,
      p_quantity_change: item.quantity,
      ...
    });
    if (stockErr) throw stockErr;
  }
  ```
- **Actual Behavior:** Stock increases are committed item-by-item in an un-isolated loop. If item 3 out of 5 fails, items 1 and 2 remain incremented in inventory while the purchase record creation aborts or returns an error.
- **Expected Behavior:** Purchase order creation and inventory ingestion MUST occur within an atomic database function (`create_purchase_atomic`).
- **Impact:** Partial stock ingestion without corresponding purchase order entries.
- **Verification Status:** VERIFIED

---

### FINDING-API-006
- **Severity:** HIGH
- **Category:** Data Consistency / Non-Atomic Branch Order Transfers
- **Location:** [src/app/api/branch-orders/route.ts:293-382](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/branch-orders/route.ts#L293-L382)
- **Function:** `PATCH /api/branch-orders`
- **Evidence:**
  When dispatching (`status = 'dispatched'`) or receiving (`status = 'received'`), line item inventory adjustments for source and destination stores are performed using JS `for` loops calling `adjust_item_stock` without lock acquisition or transaction boundaries.
- **Actual Behavior:** High-concurrency POS operations occurring simultaneously with a branch order dispatch can cause race conditions, negative inventory levels, or partial dispatch failures.
- **Expected Behavior:** Branch order state transitions and multi-store inventory shifts MUST be executed atomically via stored procedure `process_branch_order_atomic`.
- **Impact:** Inventory mismatches between central godowns and retail outlets.
- **Verification Status:** VERIFIED

---

### FINDING-API-007
- **Severity:** HIGH
- **Category:** PostgREST Injection / Query Manipulation
- **Location:** [src/app/api/invoices/route.ts:75](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/invoices/route.ts#L75)
- **Function:** `GET /api/invoices`
- **Evidence:**
  ```typescript
  if (search) {
    query.or(`invoice_no.ilike.%${search}%,client_name.ilike.%${search}%`);
  }
  ```
- **Actual Behavior:** User-supplied `search` string is directly interpolated into Supabase/PostgREST filter format without stripping commas, parentheses, or PostgREST operators (e.g. `),tenant_id.neq.0`).
- **Expected Behavior:** Input search strings MUST be sanitized or bound safely using formatted PostgREST parameters, stripping filter metacharacters (`,`, `(`, `)`, `.`).
- **Impact:** Query structure manipulation, HTTP 500 error generation, or potential scoping bypasses.
- **Verification Status:** VERIFIED

---

### FINDING-API-008
- **Severity:** HIGH
- **Category:** PostgREST Injection / Tenant Boundary Bypass
- **Location:** [src/app/api/tenants/route.ts:63-68](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/tenants/route.ts#L63-L68)
- **Function:** `GET /api/tenants`
- **Evidence:**
  ```typescript
  tenantQuery.or(`id.eq.${auth.session.tenantId},owner_name.eq.${callerTenant.owner_name},email.eq.${callerTenant.email}`);
  ```
- **Actual Behavior:** `callerTenant.owner_name` and `email` retrieved from the database are string-interpolated into `.or()`. If a tenant owner name contains commas (e.g. `Acme Corp,id.neq.0`), the generated PostgREST string alters the logical grouping of the query filter.
- **Expected Behavior:** Use explicit `.or()` filter formatting with properly sanitized/escaped parameters.
- **Impact:** Privilege escalation allowing a CEO to view unauthorized third-party tenants.
- **Verification Status:** VERIFIED

---

### FINDING-API-009
- **Severity:** MEDIUM
- **Category:** Unauthenticated User Enumeration / Information Leakage
- **Location:** [src/app/api/tenants/route.ts:18-45](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/tenants/route.ts#L18-L45)
- **Function:** `GET /api/tenants?slug=...`
- **Evidence:**
  ```typescript
  // Unauthenticated storefront query:
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, app_users(id, username, full_name, role)')
    .eq('slug', slug)
    .single();
  ```
- **Actual Behavior:** Anyone can query `GET /api/tenants?slug=branch-1` without credentials and receive a full list of all active employee usernames and assigned system roles (`staff`, `ceo`, `godown_staff`).
- **Expected Behavior:** Public slug lookups MUST ONLY return public store metadata (`id`, `name`, `slug`, `is_active`). Employee directory details must be stripped.
- **Impact:** Facilitates credential stuffing and targeted brute-force login attacks.
- **Verification Status:** VERIFIED

---

### FINDING-API-010
- **Severity:** MEDIUM
- **Category:** Defensive Programming / Null Auth Fallback
- **Location:** [src/app/api/held-invoices/route.ts:100-109](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/held-invoices/route.ts#L100-L109)
- **Function:** `DELETE /api/held-invoices`
- **Evidence:**
  ```typescript
  const { data: existingHeld } = await supabaseAdmin
    .from('held_invoices')
    .select('tenant_id')
    .eq('id', id)
    .maybeSingle();

  // If record doesn't exist, existingHeld is null -> calls requireTenantAuth(req, null)
  const auth = await requireTenantAuth(req, existingHeld?.tenant_id || null);
  ```
- **Actual Behavior:** When an invalid or non-existent `id` is supplied, `existingHeld?.tenant_id` evaluates to `null`. Passing `null` to `requireTenantAuth` relaxes tenant check to ANY authenticated user session.
- **Expected Behavior:** If `existingHeld` is null, immediately return HTTP 404 Not Found before evaluating auth, or default to `auth.session.tenantId`.
- **Impact:** Defeats explicit tenant scoping checks on missing resource deletions.
- **Verification Status:** VERIFIED

---

### FINDING-API-011
- **Severity:** MEDIUM
- **Category:** Defensive Programming / Undefined Auth Fallback
- **Location:** [src/app/api/items/route.ts:494-500](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/route.ts#L494-L500)
- **Function:** `DELETE /api/items`
- **Evidence:**
  ```typescript
  const { data: existingItem } = await supabaseAdmin
    .from('items')
    .select('tenant_id')
    .eq('id', id)
    .single();

  const auth = await requireTenantAuth(req, existingItem?.tenant_id);
  ```
- **Actual Behavior:** If `existingItem` is missing, `existingItem?.tenant_id` evaluates to `undefined`, bypassing targeted tenant verification inside `requireTenantAuth`.
- **Expected Behavior:** Always pass `auth.session.tenantId` or handle missing resource before authorization evaluation.
- **Impact:** Unsafe authorization pattern across resource deletion endpoints.
- **Verification Status:** VERIFIED

---

### FINDING-API-012
- **Severity:** MEDIUM
- **Category:** Missing API Endpoints / Incomplete Vendor Maintenance
- **Location:** [src/app/api/suppliers/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/suppliers/route.ts)
- **Function:** `PATCH`, `PUT`, `DELETE /api/suppliers`
- **Evidence:** `suppliers/route.ts` only exports `GET` and `POST` handlers.
- **Actual Behavior:** Users cannot update supplier phone numbers, contact names, addresses, or toggle supplier active status via the API.
- **Expected Behavior:** Full CRUD handlers (`PATCH`, `DELETE`) must be implemented for supplier record management.
- **Impact:** Administrative inability to manage vendor master records.
- **Verification Status:** VERIFIED

---

### FINDING-API-013
- **Severity:** MEDIUM
- **Category:** Uniqueness Defect / Predictable Identifier Collision
- **Location:**
  - `src/app/api/clients/route.ts:58` (`CL-${Math.floor(1000 + Math.random() * 9000)}`)
  - `src/app/api/suppliers/route.ts:56` (`SUP-${Math.floor(1000 + Math.random() * 9000)}`)
  - `src/app/api/vouchers/route.ts:111` (`V-${Math.floor(1000 + Math.random() * 9000)}`)
- **Function:** `POST /api/clients`, `POST /api/suppliers`, `POST /api/vouchers`
- **Evidence:** Identifiers are generated using a 4-digit random number (9,000 possibilities) without collision check or retry loop.
- **Actual Behavior:** High probability of duplicate key violation errors (`23505`) as customer or voucher databases scale beyond a few hundred records.
- **Expected Behavior:** Use sequential sequence counters, database auto-increment defaults, or UUID/nanoid generation with duplicate retry handling.
- **Impact:** Unhandled HTTP 500 errors during routine customer or voucher creation.
- **Verification Status:** VERIFIED

---

### FINDING-API-014
- **Severity:** LOW
- **Category:** Financial Reconciliation Flaw / Client Fallback Override
- **Location:** [src/app/api/shifts/route.ts:311-313](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/shifts/route.ts#L311-L313)
- **Function:** `POST /api/shifts` (Closing Shift)
- **Evidence:**
  ```typescript
  try {
    expectedCash = await recomputeExpectedCash(...);
  } catch (err) {
    expectedCash = body.expected_cash; // Fallback to client-provided value!
  }
  ```
- **Actual Behavior:** If server-side cash reconciliation calculation encounters an unhandled exception, it silently accepts `body.expected_cash` submitted by the cashier client.
- **Expected Behavior:** Shift close operation MUST fail with an explicit HTTP 500 error if server-side reconciliation cannot be computed.
- **Impact:** Potential concealment of cash register shortages by malcontent staff.
- **Verification Status:** VERIFIED

---

### FINDING-API-015
- **Severity:** LOW
- **Category:** Global Unscoped Data Access
- **Location:** [src/app/api/receipt-templates/route.ts:7-67](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/route.ts#L7-L67)
- **Function:** `GET /api/receipt-templates`
- **Evidence:** `GET` queries `receipt_templates` where `is_deleted = false` without tenant scoping or isolation.
- **Actual Behavior:** All custom thermal receipt templates are visible to all tenants across the platform.
- **Expected Behavior:** Filter templates by global defaults OR tenant-specific assignments.
- **Impact:** Unintended exposure of custom branding templates across tenants.
- **Verification Status:** VERIFIED

---

### FINDING-API-016
- **Severity:** LOW
- **Category:** API Performance / Unbounded Payload Risk
- **Location:** `/api/clients`, `/api/suppliers`, `/api/brands`, `/api/brand-series`, `/api/items`, `/api/vouchers`
- **Function:** `GET` Handlers
- **Evidence:** Endpoints return complete table scans (`SELECT *`) without mandatory `limit` and `page`/`offset` pagination parameters.
- **Actual Behavior:** Large industrial clients with 50,000+ items or clients cause huge JSON payloads, browser freeze, and memory consumption spikes.
- **Expected Behavior:** Enforce strict default pagination limits (e.g. `limit = 50`, max `1000`).
- **Impact:** Performance degradation and potential memory exhaustion.
- **Verification Status:** VERIFIED

---

### FINDING-API-017
- **Severity:** LOW
- **Category:** In-Memory State Non-Scalability
- **Location:** [src/lib/rate-limit.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/lib/rate-limit.ts) (used in `/api/auth/login` and `/api/auth/dev-pin`)
- **Function:** `checkRateLimit`
- **Evidence:** Uses an in-memory `Map<string, RateLimitRecord>` to track failed authentication attempts per IP.
- **Actual Behavior:** Rate-limiting state is lost on server restart and is not shared across multi-region serverless functions.
- **Expected Behavior:** Use Redis/Upstash or database-backed rate limiting for multi-instance deployments.
- **Impact:** Rate limit bypass on serverless infrastructure.
- **Verification Status:** VERIFIED

---

## 7. Recommended Remediation Order

1. **P0 (CRITICAL):** Fix IDOR vulnerability in `PATCH /api/invoices` (FINDING-API-001) by adding `.eq('tenant_id', auth.session.tenantId)` to initial fetch and update predicates.
2. **P0 (CRITICAL):** Fix IDOR vulnerability in `PATCH /api/items` (FINDING-API-002) by removing `tenant_id` from allowed update fields and scoping by `auth.session.tenantId`.
3. **P0 (CRITICAL):** Secure `PATCH /api/branch-orders` (FINDING-API-003) to strictly validate caller tenant against order origin/destination.
4. **P1 (HIGH):** Create stored procedure `update_invoice_atomic` to encapsulate all `PATCH /api/invoices` stock and ledger operations (FINDING-API-004).
5. **P1 (HIGH):** Encapsulate purchase stock ingestion in `create_purchase_atomic` RPC (FINDING-API-005).
6. **P1 (HIGH):** Encapsulate branch order dispatch/receive stock operations in `process_branch_order_atomic` RPC (FINDING-API-006).
7. **P1 (HIGH):** Sanitize PostgREST search inputs in `GET /api/invoices` (FINDING-API-007) and `GET /api/tenants` (FINDING-API-008).
8. **P2 (MEDIUM):** Strip employee list from unauthenticated `GET /api/tenants?slug=...` response (FINDING-API-009).
9. **P2 (MEDIUM):** Implement `PATCH` and `DELETE` endpoints for `/api/suppliers` (FINDING-API-012).
10. **P2 (MEDIUM):** Fix predictable random identifier generation for clients, suppliers, and vouchers (FINDING-API-013).
11. **P3 (LOW):** Remove client-side expected cash fallback in shift close (FINDING-API-014) and add default pagination across catalog GET routes (FINDING-API-016).
