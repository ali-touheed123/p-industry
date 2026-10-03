# Phase 10 — Security Remediation Tasks

> **Status**: IMPLEMENTATION-READY — NOT EXECUTED  
> **Phase**: 10 (Adversarial Security Audit)  
> **Constraint**: AUDIT ONLY. Zero code changes executed during audit.  
> **Source Plan**: `audit/phase-10-implementation-plan.md`  
> **Source Audit**: `audit/phase-10-security-audit-report.md`

---

## 1. 1:1 Reconciled Task Inventory (SEC-001 through SEC-017)

Every task strictly corresponds to the exact Finding ID and title defined in `audit/phase-10-security-audit-report.md`. No finding IDs have been reallocated or altered.

| Task ID | Finding Ref | Severity | Title in Audit Report | Status |
|---|---|---|---|---|
| **TASK-P10-01** | SEC-001 | CRITICAL (Cal: HIGH) | No Next.js Edge Middleware — auth is route-level only, no global enforcement | Implementation-Ready (Not Executed) |
| **TASK-P10-02** | SEC-002 | CRITICAL (Cal: MED) | Hardcoded Supabase project URL in source (information disclosure in bundle) | Implementation-Ready (Not Executed) |
| **TASK-P10-03** | SEC-003 | CRITICAL (Cal: HIGH) | In-memory rate limiter resets on serverless cold-start — brute force viable | Implementation-Ready (Not Executed) |
| **TASK-P10-04** | SEC-004 | HIGH (Cal: HIGH) | Dev PIN hardcoded to `dev2026` in source; grants super-admin in non-prod | Implementation-Ready (Not Executed) |
| **TASK-P10-05** | SEC-005 | HIGH (Cal: HIGH) | `GET /api/tenants?slug=` — unauthenticated full tenant + staff record disclosure | Implementation-Ready (Not Executed) |
| **TASK-P10-06** | SEC-006 | HIGH (Cal: MED) | `PATCH /api/branch-orders` — order fetched from DB before auth check | Implementation-Ready (Not Executed) |
| **TASK-P10-07** | SEC-007 | HIGH (Cal: MED) | `ilike.%${search}%` — unescaped wildcard in PostgREST filter (injection risk) | Implementation-Ready (Not Executed) |
| **TASK-P10-08** | SEC-008 | HIGH (Cal: HIGH) | `PATCH /api/invoices` (edit) — non-atomic: stock revert and re-apply are separate DB calls | Implementation-Ready (Not Executed) |
| **TASK-P10-09** | SEC-009 | HIGH (Cal: MED) | `PATCH /api/clients` — pre-auth DB lookup via untrusted `id` (IDOR oracle) | Implementation-Ready (Not Executed) |
| **TASK-P10-10** | SEC-010 | MEDIUM (Cal: MED) | Session JWT is 7 days with no server-side revocation mechanism | Implementation-Ready (Not Executed) |
| **TASK-P10-11** | SEC-011 | MEDIUM (Cal: LOW) | AI in-memory quota resets on cold start — quota bypass window | Non-Actionable (Operational Risk Accepted) |
| **TASK-P10-12** | SEC-012 | MEDIUM (Cal: MED) | `POST /api/vouchers` — token validation → voucher insert → token mark-used: non-atomic race condition | Implementation-Ready (Not Executed) |
| **TASK-P10-13** | SEC-013 | MEDIUM (Cal: MED) | No `Content-Security-Policy` (CSP) header configured | Implementation-Ready (Not Executed) |
| **TASK-P10-14** | SEC-014 | MEDIUM (Cal: LOW) | `SUPABASE_SERVICE_ROLE_KEY` falls back to placeholder string silently; no startup validation | Implementation-Ready (Doc / Config Only) |
| **TASK-P10-15** | SEC-015 | LOW (Cal: LOW) | `X-XSS-Protection: 1; mode=block` is deprecated (no effect in modern browsers) | Implementation-Ready (Not Executed) |
| **TASK-P10-16** | SEC-016 | LOW (Cal: MED) | Branch stock transfer: dispatch and receive stock operations are non-atomic | Implementation-Ready (Not Executed) |
| **TASK-P10-17** | SEC-017 | LOW (Cal: LOW) | 4-digit random suffixes on voucher/client/supplier codes — collision probability under load | Implementation-Ready (Client/Supplier Codes Only) |

---

## 2. Detailed Task Specifications

### TASK-P10-01: Global Edge Authorization Middleware
- **Finding Ref**: SEC-001
- **Objective**: Implement Next.js edge middleware enforcing default-deny on all `/api/*` routes.
- **Target Files**: `src/middleware.ts`
- **Required Behavior**: Validate session JWT at edge; block unauthenticated calls to protected routes; forward verified tenant claims.
- **Security Invariant**: No newly added API route is exposed publicly by omission of manual route-level guards.

### TASK-P10-02: Supabase Client Public URL Configuration
- **Finding Ref**: SEC-002
- **Objective**: Prevent hardcoding project fallbacks in compiled client bundles.
- **Target Files**: `src/lib/supabase.ts`
- **Required Behavior**: Require `process.env.NEXT_PUBLIC_SUPABASE_URL` without embedded fallback URLs; throw error on startup if missing.
- **Security Invariant**: Client bundle does not leak fallback project configurations.

### TASK-P10-03: Persistent Storage for Auth Rate Limiter
- **Finding Ref**: SEC-003
- **Objective**: Prevent rate limit bypass via serverless cold starts.
- **Target Files**: `src/lib/rate-limit.ts`
- **Required Behavior**: Connect sliding window tracker to persistent storage (Redis or DB counter table) for `/api/auth/login` and `/api/auth/dev-pin`.
- **Security Invariant**: Serverless instance recycling does not reset failed login attempt counters.

### TASK-P10-04: Remove Hardcoded Developer PIN
- **Finding Ref**: SEC-004
- **Objective**: Eliminate hardcoded master pin `'dev2026'` from repository.
- **Target Files**: `src/app/api/auth/dev-pin/route.ts`
- **Required Behavior**: Remove `'dev2026'` fallback string. Require `DEV_ADMIN_PIN` in environment; reject with 403/404 if not explicitly configured.
- **Security Invariant**: Zero default credentials embedded in source code.

### TASK-P10-05: Unauthenticated Tenant & Staff Disclosure Fix
- **Finding Ref**: SEC-005
- **Objective**: Prevent unauthenticated leak of tenant contact information and staff records.
- **Target Files**: `src/app/api/tenants/route.ts`
- **Required Behavior**: Return only non-sensitive public shop information for unauthenticated slug lookups; omit `owner_name`, `email`, `phone`, `city`, and all staff usernames/roles.
- **Security Invariant**: Unauthenticated requests cannot enumerate internal staff accounts or owner PII.

### TASK-P10-06: Post-Auth DB Lookup on Branch Orders
- **Finding Ref**: SEC-006
- **Objective**: Eliminate timing oracle and IDOR probing on branch orders.
- **Target Files**: `src/app/api/branch-orders/route.ts`
- **Required Behavior**: Require valid tenant session before querying database for branch order ID; scope query by `tenant_id`.
- **Security Invariant**: Unauthenticated or cross-tenant callers cannot probe whether an order UUID exists.

### TASK-P10-07: Escape Wildcards in PostgREST Query Filters
- **Finding Ref**: SEC-007
- **Objective**: Prevent injection and filter manipulation in search queries.
- **Target Files**: `src/app/api/invoices/route.ts`
- **Required Behavior**: Sanitize and escape user input before interpolating into PostgREST `.or(...)` filter strings.
- **Security Invariant**: User search inputs cannot escape their field scope or negate `tenant_id` constraints.

### TASK-P10-08: Atomic Invoice Edit & Stock Reconciliation
- **Finding Ref**: SEC-008
- **Objective**: Ensure invoice modification and stock adjustments happen atomically.
- **Target Files**: `src/app/api/invoices/route.ts`, `supabase/migrations/`
- **Required Behavior**: Wrap old item stock reversal, line-item changes, and new stock deductions into an atomic PostgreSQL RPC (`update_invoice_atomic`).
- **Security Invariant**: Partial server or network failure during invoice editing cannot leave stock in a desynchronized state.

### TASK-P10-09: Post-Auth DB Lookups for Clients
- **Finding Ref**: SEC-009
- **Objective**: Prevent IDOR oracle for tenant-to-client mapping.
- **Target Files**: `src/app/api/clients/route.ts`
- **Required Behavior**: Always obtain `tenant_id` from authenticated session; never perform DB lookup by client ID before auth check.
- **Security Invariant**: Caller cannot discover another tenant's ownership of a client record.

### TASK-P10-10: Session Token Revocation Mechanism
- **Finding Ref**: SEC-010
- **Objective**: Provide server-side session invalidation capability.
- **Target Files**: `src/lib/session.ts`, `supabase/migrations/`
- **Required Behavior**: Include `jti` in JWT session tokens; verify against token revocation list or user `token_version` on each sensitive request.
- **Security Invariant**: Logging out or admin revocation invalidates existing session JWTs before expiration.

### TASK-P10-11: AI In-Memory Quota Operational Risk Handling
- **Finding Ref**: SEC-011
- **Objective**: Mitigate quota bypass risk during DB downtime.
- **Target Files**: `src/lib/ai-gateway.ts`
- **Required Behavior**: Document operational acceptance. If DB is unavailable, fail-closed for AI generation rather than falling back to in-memory counters.
- **Security Invariant**: Offline database state cannot result in unlimited unmetered LLM API usage.

### TASK-P10-12: Atomic Voucher Token Redemption
- **Finding Ref**: SEC-012
- **Objective**: Prevent concurrent token double-redemption.
- **Target Files**: `src/app/api/vouchers/route.ts`, `supabase/migrations/`
- **Required Behavior**: Execute token validation, voucher insertion, and token status update within an atomic database transaction with row locks on `tokens`.
- **Security Invariant**: No token can be redeemed more than once across concurrent requests.

### TASK-P10-13: Content Security Policy Configuration
- **Finding Ref**: SEC-013
- **Objective**: Implement robust CSP defense-in-depth against XSS.
- **Target Files**: `next.config.ts`
- **Required Behavior**: Define comprehensive `Content-Security-Policy` header in HTTP headers configuration.
- **Security Invariant**: Browser restricts unauthorized script execution and resource loading.

### TASK-P10-14: Supabase Service Role Key Startup Validation
- **Finding Ref**: SEC-014
- **Objective**: Prevent silent fallback to invalid placeholder keys.
- **Target Files**: `src/lib/supabase.ts`, `.env.example`
- **Required Behavior**: Remove silent placeholder fallback. Throw descriptive error on startup if `SUPABASE_SERVICE_ROLE_KEY` is not set.
- **Security Invariant**: Backend fails fast on initialization rather than failing cryptically during runtime operations.

### TASK-P10-15: Deprecated X-XSS-Protection Header Removal
- **Finding Ref**: SEC-015
- **Objective**: Align security headers with modern browser standards.
- **Target Files**: `next.config.ts`
- **Required Behavior**: Remove deprecated `X-XSS-Protection: 1; mode=block` header or set to `0`.
- **Security Invariant**: No obsolete security headers inducing legacy browser vulnerabilities.

### TASK-P10-16: Atomic Branch Stock Transfer Operations
- **Finding Ref**: SEC-016
- **Objective**: Ensure dispatch and receive stock operations execute atomically.
- **Target Files**: `src/app/api/branch-orders/route.ts`, `supabase/migrations/`
- **Required Behavior**: Implement PostgreSQL RPCs `dispatch_branch_order_atomic` and `receive_branch_order_atomic` wrapping multi-item updates in single transactions.
- **Security Invariant**: Branch stock transfers never leave inventory in a half-dispatched or half-received state.

### TASK-P10-17: Client & Supplier Code Generation & Unique Constraints
- **Finding Ref**: SEC-017
- **Objective**: Eliminate collision risk on auto-generated codes.
- **Target Files**: `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`, `supabase/migrations/`
- **Required Behavior**: Increase randomness/entropy of generated suffixes; add database unique constraints `UNIQUE (tenant_id, client_code)` and `UNIQUE (tenant_id, supplier_code)`. (Note: Vouchers already contain DB unique constraint).
- **Security Invariant**: Duplicate client or supplier codes cannot be created within a tenant.

---

## 3. Human Gate & Execution Policy

> [!IMPORTANT]
> **AUDIT ONLY RULE ENFORCED**
>
> All 17 tasks strictly correspond 1:1 with Findings SEC-001 through SEC-017 from `audit/phase-10-security-audit-report.md`.
> **Zero remediation tasks have been executed.**
> Execution of any task requires explicit human authorization.
