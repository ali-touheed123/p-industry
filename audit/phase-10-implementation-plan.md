# Phase 10 — Security Implementation Plan (Adversarial Audit Remediations)

> **Document Status**: RECONCILED & READY FOR REVIEW  
> **Phase**: 10 (Adversarial Security Audit)  
> **Scope**: Implementation Plan 1:1 reconciled against `audit/phase-10-security-audit-report.md`  
> **Constraint**: AUDIT ONLY. Zero code changes executed during audit.

---

## 1. 1:1 Finding Reconciliation Matrix (SEC-001 through SEC-017)

Every ID strictly maps to the exact finding defined in `audit/phase-10-security-audit-report.md`. No IDs have been swapped or re-used.

| Finding ID | Title in Audit Report | Report Severity | Calibrated Severity | Verification Status | Rationale & Code Invariant |
|---|---|---|---|---|---|
| **SEC-001** | No Next.js Edge Middleware — auth is route-level only, no global enforcement | CRITICAL | HIGH | PARTIALLY VERIFIED | Routes currently use `requireTenantAuth` / `requireDevAuth`, but absence of global middleware means newly added endpoints lack default-deny edge protection. |
| **SEC-002** | Hardcoded Supabase project URL in source (information disclosure in bundle) | CRITICAL | MEDIUM | PARTIALLY VERIFIED | Supabase project URL in `src/lib/supabase.ts` is public by design (`NEXT_PUBLIC_`), but hardcoding fallback exposes project ref if environment variables are stripped. Primary risk is dependent on RLS coverage. |
| **SEC-003** | In-memory rate limiter resets on serverless cold-start — brute force viable | CRITICAL | HIGH | VERIFIED | `tracker = new Map()` in `src/lib/rate-limit.ts` is in-memory only. Resets on cold start in serverless environments, permitting distributed brute-force against auth. |
| **SEC-004** | Dev PIN hardcoded to `dev2026` in source; grants super-admin in non-prod | HIGH | HIGH | VERIFIED | `src/app/api/auth/dev-pin/route.ts:42` explicitly defaults to `'dev2026'` when `NODE_ENV !== 'production'`. Grants super-admin multi-tenant JWT. |
| **SEC-005** | `GET /api/tenants?slug=` — unauthenticated full tenant + staff record disclosure | HIGH | HIGH | VERIFIED | `src/app/api/tenants/route.ts:12-38` has no authentication check on slug lookup. Exposes owner contact details, staff usernames, and roles. |
| **SEC-006** | `PATCH /api/branch-orders` — order fetched from DB before auth check | HIGH | MEDIUM | VERIFIED | `src/app/api/branch-orders/route.ts:233-246` fetches order prior to checking caller session/ownership. Creates timing oracle & IDOR enumeration probe. |
| **SEC-007** | `ilike.%${search}%` — unescaped wildcard in PostgREST filter (injection risk) | HIGH | MEDIUM | PARTIALLY VERIFIED | `src/app/api/invoices/route.ts:75` interpolates unescaped user search input into PostgREST `.or(...)` filter string, allowing filter manipulation. |
| **SEC-008** | `PATCH /api/invoices` (edit) — non-atomic: stock revert and re-apply are separate DB calls | HIGH | HIGH | VERIFIED | `src/app/api/invoices/route.ts:456-581` runs stock revert, item deletion, item insertion, and stock re-application across 6 non-atomic DB queries. Same class as MF-001. |
| **SEC-009** | `PATCH /api/clients` — pre-auth DB lookup via untrusted `id` (IDOR oracle) | HIGH | MEDIUM | VERIFIED | `src/app/api/clients/route.ts:94-100` queries DB using caller-provided client `id` before enforcing auth if `tenant_id` is omitted in payload. |
| **SEC-010** | Session JWT is 7 days with no server-side revocation mechanism | MEDIUM | MEDIUM | VERIFIED | `src/lib/session.ts:43` sets 7-day expiration without revocation list or token identifier tracking. Compromised tokens cannot be revoked individually. |
| **SEC-011** | AI in-memory quota resets on cold start — quota bypass window | MEDIUM | LOW | PARTIALLY VERIFIED | `src/lib/ai-gateway.ts:85-86` in-memory fallback Maps reset on cold start when DB is down. Operational edge case during infrastructure outage. |
| **SEC-012** | `POST /api/vouchers` — token validation → voucher insert → token mark-used: non-atomic race condition | MEDIUM | MEDIUM | PARTIALLY VERIFIED | Non-atomic 3-step sequence in voucher token consumption. Risk of concurrent double-spend race condition. |
| **SEC-013** | No `Content-Security-Policy` (CSP) header configured | MEDIUM | MEDIUM | VERIFIED | `next.config.ts` configures HTTP security headers but completely omits `Content-Security-Policy`. |
| **SEC-014** | `SUPABASE_SERVICE_ROLE_KEY` falls back to placeholder string silently; no startup validation | MEDIUM | LOW | PARTIALLY VERIFIED | `src/lib/supabase.ts:5` falls back to `'service_key_placeholder'` without startup throw. Deployment configuration defect rather than exploitable vulnerability. |
| **SEC-015** | `X-XSS-Protection: 1; mode=block` is deprecated (no effect in modern browsers) | LOW | LOW | VERIFIED | `next.config.ts:21-24` includes obsolete header. Modern standard requires removing or replacing with robust CSP. |
| **SEC-016** | Branch stock transfer: dispatch and receive stock operations are non-atomic | LOW | MEDIUM | VERIFIED | `src/app/api/branch-orders/route.ts:298-381` mutates inventory per-item in loops without PostgreSQL transaction wrapping. |
| **SEC-017** | 4-digit random suffixes on voucher/client/supplier codes — collision probability under load | LOW | LOW | PARTIALLY VERIFIED / CONTRADICTED (Split) | Vouchers ALREADY enforce `uq_vouchers_tenant_voucher_no` at DB level (CONTRADICTED risk of duplicate voucher insert). However, `clients` and `suppliers` lack DB unique constraints for generated codes (VERIFIED). |

---

## 2. Non-Actionable / Accepted Operational Findings

- **SEC-011**: Operational risk accepted. Infrastructure monitoring is preferred over complex distributed caching for DB-down fallbacks.
- **SEC-014**: Documentation & environment configuration issue. Add validation check on app bootstrap or document in `.env.example`.
- **SEC-017 (Voucher Portion)**: Vouchers already have unique constraints in PostgreSQL (`20260924_02_business_constraints.sql`). No database change needed for vouchers.

---

## 3. Actionable Remediations & Technical Plans

### Priority 1: High Severity & Critical Access Controls

#### PLAN-SEC-001: Centralized Edge Authorization Middleware
- **Finding ID**: SEC-001
- **Files Affected**: `src/middleware.ts`
- **Objective**: Implement Next.js edge middleware enforcing default-deny on all `/api/*` endpoints except whitelisted public routes (`/api/auth/login`, `/api/auth/dev-pin`, `/api/tenants?slug=*` if public, `/api/webhooks/*`).
- **Remediation**:
  1. Inspect session JWT at edge.
  2. If missing/invalid, return `401 Unauthorized`.
  3. Forward validated tenant ID in request headers for downstream handlers.

#### PLAN-SEC-003: Redis / Persistent Backing for Rate Limiter
- **Finding ID**: SEC-003
- **Files Affected**: `src/lib/rate-limit.ts`
- **Objective**: Replace process-memory `Map` with persistent store (Upstash Redis or DB-backed atomic counter) for `/api/auth/*`.
- **Remediation**:
  1. Maintain persistent IP/account attempt counters across serverless cold starts.
  2. Fall back to fail-closed on rate limit backend failure.

#### PLAN-SEC-004: Hardcoded Dev PIN Elimination
- **Finding ID**: SEC-004
- **Files Affected**: `src/app/api/auth/dev-pin/route.ts`
- **Objective**: Remove `'dev2026'` fallback string from codebase completely.
- **Remediation**:
  1. Require `process.env.DEV_ADMIN_PIN` to be explicitly set.
  2. If unset, disable the dev-pin endpoint completely and return `403 Forbidden` / `404 Not Found`.

#### PLAN-SEC-005: Unauthenticated Tenant & Staff Disclosure Fix
- **Finding ID**: SEC-005
- **Files Affected**: `src/app/api/tenants/route.ts`
- **Objective**: Prevent unauthenticated leak of owner contact details and staff accounts.
- **Remediation**:
  1. Restrict `/api/tenants?slug=` to return ONLY public storefront metadata (e.g. shop name, public logo, theme).
  2. Strip `owner_name`, `email`, `phone`, `city`, and all staff usernames/roles from unauthenticated responses.

#### PLAN-SEC-008: Atomic Invoice Edit & Stock Mutations
- **Finding ID**: SEC-008
- **Files Affected**: `src/app/api/invoices/route.ts`, Supabase migrations
- **Objective**: Unify multi-step invoice edit and inventory restock into a single PostgreSQL RPC.
- **Remediation**:
  1. Create `update_invoice_atomic` stored procedure.
  2. Execute stock reversal, item updates, stock re-deduction, and ledger updates inside an atomic `BEGIN ... COMMIT` block.

---

### Priority 2: Medium Severity Hardening

#### PLAN-SEC-002: Supabase Client Public URL Configuration
- **Finding ID**: SEC-002
- **Files Affected**: `src/lib/supabase.ts`
- **Objective**: Remove hardcoded fallback URL from source code bundle.
- **Remediation**:
  1. Throw error on client initialization if `NEXT_PUBLIC_SUPABASE_URL` is undefined.
  2. Verify RLS policies on all public-accessible Supabase tables.

#### PLAN-SEC-006: Post-Auth DB Lookups for Branch Orders
- **Finding ID**: SEC-006
- **Files Affected**: `src/app/api/branch-orders/route.ts`
- **Objective**: Reorder execution flow so caller authentication and tenant scoping occur before any database lookup.
- **Remediation**:
  1. Call `requireTenantAuth` before reading order ID or querying table.
  2. Scope query strictly: `.eq('id', orderId).eq('tenant_id', session.tenant_id)`.

#### PLAN-SEC-007: Escape Wildcards in PostgREST Query Filters
- **Finding ID**: SEC-007
- **Files Affected**: `src/app/api/invoices/route.ts`
- **Objective**: Sanitize and escape commas, wildcards, and special characters in user search inputs.
- **Remediation**:
  1. Sanitize search input to strip or escape PostgREST reserved tokens (`,`, `.`, `%`).
  2. Ensure `.eq('tenant_id', tenantId)` filter cannot be overridden by unescaped input.

#### PLAN-SEC-009: Post-Auth DB Lookups for Clients
- **Finding ID**: SEC-009
- **Files Affected**: `src/app/api/clients/route.ts`
- **Objective**: Prevent pre-auth database lookup on untrusted client `id`.
- **Remediation**:
  1. Always resolve `tenant_id` from the caller's session token.
  2. Never query the `clients` table before authentication is established.

#### PLAN-SEC-010: Session Revocation Mechanism
- **Finding ID**: SEC-010
- **Files Affected**: `src/lib/session.ts`, Supabase migrations
- **Objective**: Introduce session token revocation capability.
- **Remediation**:
  1. Add `jti` (unique token ID) claim to session JWTs.
  2. Check revoked token list or maintain a `token_version` on user/staff accounts.

#### PLAN-SEC-012: Atomic Voucher Token Redemption
- **Finding ID**: SEC-012
- **Files Affected**: `src/app/api/vouchers/route.ts`, Supabase migrations
- **Objective**: Prevent race-condition double-spending of tokens during voucher issuance.
- **Remediation**:
  1. Wrap voucher creation and token marking into an atomic RPC with row-level locks on `tokens`.

#### PLAN-SEC-013: Content Security Policy Configuration
- **Finding ID**: SEC-013
- **Files Affected**: `next.config.ts`
- **Objective**: Implement robust `Content-Security-Policy` header.
- **Remediation**:
  1. Add CSP header restricting script, style, image, and connect sources.

#### PLAN-SEC-016: Atomic Branch Stock Transfer
- **Finding ID**: SEC-016
- **Files Affected**: `src/app/api/branch-orders/route.ts`, Supabase migrations
- **Objective**: Wrap dispatch and receive stock operations in transactional database RPCs.
- **Remediation**:
  1. Implement `dispatch_branch_order_atomic` and `receive_branch_order_atomic` stored procedures.

---

### Priority 3: Low Severity Cleanup

#### PLAN-SEC-015: Deprecated Header Cleanup
- **Finding ID**: SEC-015
- **Files Affected**: `next.config.ts`
- **Remediation**: Remove `X-XSS-Protection` header or set to `0` per modern web security standards.

#### PLAN-SEC-017: Unique Constraints for Generated Client & Supplier Codes
- **Finding ID**: SEC-017
- **Files Affected**: `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`, Supabase migrations
- **Remediation**:
  1. Increase random suffix entropy (e.g., 6–8 characters or nanoid).
  2. Add database unique constraints: `UNIQUE (tenant_id, client_code)` and `UNIQUE (tenant_id, supplier_code)`.

---

## 4. Human Gate Requirement

> [!IMPORTANT]
> **AUDIT PHASE COMPLETE — HUMAN APPROVAL REQUIRED**
>
> All 17 findings are reconciled 1:1 against `audit/phase-10-security-audit-report.md`.
> **No code, database, migration, or config files have been modified.**
> Execution of any remediation requires explicit human sign-off.
