# PHASE 10 FORENSIC AUDIT REPORT — ADVERSARIAL SECURITY

**Date:** October 3, 2026
**Auditor:** Master Forensic Auditor
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)
**Phase:** PHASE 10 — Adversarial Security
**Execution Rule Adherence:** AUDIT ONLY — NO CODE, SCHEMA, CONFIG, OR MIGRATION MODIFIED
**Human Gate Status:** NOT IMPLEMENTED — AWAITING EXPLICIT HUMAN APPROVAL

> **Note:** The collaborator's prior `phase-10-audit-report.md` covered only the AI Invoice Scanner.
> This file is the correct Phase 10 full adversarial security audit across ALL attack surfaces.

---

## 1. Audit Scope

| Attack Surface | Files Inspected |
|---|---|
| Authentication & session | `src/lib/session.ts`, `auth/login`, `auth/dev-pin`, `auth/logout` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Authorization coverage | All 24 API route directories |
| Input validation / injection | `invoices`, `clients`, `suppliers`, `purchases`, `branch-orders`, `tenants`, `vouchers`, `ledgers`, `tokens` |
| Tenant isolation (IDOR) | Cross-cutting review of `tenant_id` scoping in all DB queries |
| HTTP security headers | `next.config.ts` |
| Secrets / environment vars | `src/lib/supabase.ts`, `src/lib/session.ts`, `src/lib/ai-gateway.ts` |
| AI attack surface | `src/lib/ai-gateway.ts`, `ai-invoice-scan`, `dev/ai-control` |
| Branch order isolation | `src/app/api/branch-orders/route.ts` |
| Developer backdoor | `auth/dev-pin`, `src/lib/session.ts` |
| Global middleware | Project-wide scan |

---

## 2. Findings Summary

| ID | Severity | Title |
|---|---|---|
| SEC-001 | **CRITICAL** | No Next.js Edge Middleware — auth is route-level only, no global enforcement |
| SEC-002 | **CRITICAL** | Hardcoded Supabase project URL in source (information disclosure in bundle) |
| SEC-003 | **CRITICAL** | In-memory rate limiter resets on serverless cold-start — brute force viable |
| SEC-004 | **HIGH** | Dev PIN hardcoded to `dev2026` in source; grants super-admin in non-prod |
| SEC-005 | **HIGH** | `GET /api/tenants?slug=` — unauthenticated full tenant + staff record disclosure |
| SEC-006 | **HIGH** | `PATCH /api/branch-orders` — order fetched from DB before auth check |
| SEC-007 | **HIGH** | `ilike.%${search}%` — unescaped wildcard in PostgREST filter (injection risk) |
| SEC-008 | **HIGH** | `PATCH /api/invoices` (edit) — non-atomic: stock revert and re-apply are separate DB calls |
| SEC-009 | **HIGH** | `PATCH /api/clients` — pre-auth DB lookup via untrusted `id` (IDOR oracle) |
| SEC-010 | **MEDIUM** | Session JWT is 7 days with no server-side revocation mechanism |
| SEC-011 | **MEDIUM** | AI in-memory quota resets on cold start — quota bypass window |
| SEC-012 | **MEDIUM** | `POST /api/vouchers` — token validation → voucher insert → token mark-used: non-atomic race condition |
| SEC-013 | **MEDIUM** | No `Content-Security-Policy` (CSP) header configured |
| SEC-014 | **MEDIUM** | `SUPABASE_SERVICE_ROLE_KEY` falls back to placeholder string silently; no startup validation |
| SEC-015 | **LOW** | `X-XSS-Protection: 1; mode=block` is deprecated (no effect in modern browsers) |
| SEC-016 | **LOW** | Branch stock transfer: dispatch and receive stock operations are non-atomic |
| SEC-017 | **LOW** | 4-digit random suffixes on voucher/client/supplier codes — collision probability under load |

---

## 3. Detailed Findings

---

### FINDING-SEC-001 — No Global Edge Middleware (CRITICAL)

**Evidence:**
- Ripgrep search for `middleware` across all `.ts` files in `src/` returned **zero results**.
- No `src/middleware.ts` or `src/app/middleware.ts` exists.
- All 24 API routes rely on per-route `requireTenantAuth` or `requireDevAuth` calls.

**Risk:**
- If any route omits the auth guard, it is completely unprotected with no edge fallback.
- No global rate limiting at the edge. The in-memory rate limiter only covers `/api/auth/login` and `/api/auth/dev-pin`. All 22 other routes — including `invoices`, `purchases`, `vouchers`, `ledgers`, `clients`, `suppliers`, `branch-orders`, `tokens`, `items`, `shifts` — have **zero rate limiting**.

---

### FINDING-SEC-002 — Hardcoded Supabase Project URL in Source (CRITICAL)

**Evidence:**
- `src/lib/supabase.ts:3`:
  ```typescript
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ignspvajzblmsbertmmv.supabase.co';
  ```
- Because this is a `NEXT_PUBLIC_` variable, it is embedded in the client-side JavaScript bundle shipped to all browsers.
- The actual project URL `ignspvajzblmsbertmmv.supabase.co` is hardcoded as a fallback and will appear in compiled output regardless.

**Risk:** Attacker can directly enumerate PostgREST REST endpoints, probe for misconfigured RLS policies, and identify the Supabase project — enabling targeted attacks on the database layer.

---

### FINDING-SEC-003 — In-Memory Rate Limiter Resets on Serverless Cold Start (CRITICAL)

**Evidence:**
- `src/lib/rate-limit.ts:6`:
  ```typescript
  const tracker = new Map<string, RateLimitRecord>();
  ```
- This `Map` is module-scoped — process memory only. It does not survive serverless cold starts.

**Attack Vector:**
1. Attacker attempts 4 wrong passwords → rate limit count = 4.
2. Attacker waits ~30s for the serverless instance to expire (cold-start resets to 0).
3. Attacker gets 4 more attempts indefinitely.

**Risk:** Complete brute-force bypass against `/api/auth/login` and `/api/auth/dev-pin` in serverless deployments (Vercel, AWS Lambda).

---

### FINDING-SEC-004 — Developer PIN Hardcoded to `dev2026` in Source (HIGH)

**Evidence:**
- `src/app/api/auth/dev-pin/route.ts:42`:
  ```typescript
  const masterPin = (process.env.DEV_ADMIN_PIN || (process.env.NODE_ENV !== 'production' ? 'dev2026' : '')).trim();
  ```
- `dev2026` is committed in source and visible to anyone with code access.
- In any environment where `NODE_ENV !== 'production'` (dev, staging, misconfigured prod), this PIN grants a developer super-admin JWT with full multi-tenant access.

**Risk:** Any developer, contractor, or attacker who reads the repo can access the super-admin panel on any non-production deployment.

---

### FINDING-SEC-005 — Unauthenticated Tenant Disclosure via Slug (HIGH)

**Evidence:**
- `src/app/api/tenants/route.ts:12-38`: The `slug` branch has **no auth check**.
- Response includes full tenant record (`owner_name`, `email`, `phone`, `city`, `address`) plus all staff account usernames, full names, and roles.

**Attack Vector:**
```
GET /api/tenants?slug=any-known-shop   (no session required)
```

**Risk:** PII leakage (owner name, phone, email), staff user enumeration enabling targeted phishing or credential stuffing.

---

### FINDING-SEC-006 — Branch Order PATCH: Pre-Auth DB Fetch (HIGH)

**Evidence:**
- `src/app/api/branch-orders/route.ts:233-246`: The full order record is fetched from DB before `requireTenantAuth` is called.

**Risk:**
- Unauthenticated/invalid-session callers can probe order IDs via timing oracle: "order not found" vs. authorization error reveals whether an order UUID exists.
- Enables IDOR enumeration of branch order records.

---

### FINDING-SEC-007 — Unescaped Wildcard in PostgREST Filter (HIGH)

**Evidence:**
- `src/app/api/invoices/route.ts:75`:
  ```typescript
  query = query.or(`invoice_no.ilike.%${search}%,client_name.ilike.%${search}%`);
  ```
- The `search` query parameter is interpolated directly into the PostgREST `or()` filter string without escaping.

**Attack Vector:**
```
GET /api/invoices?tenant_id=<valid>&search=x%25,invoice_no.gt.0,tenant_id.neq.<valid>
```
Depending on PostgREST parser behavior, this can override the outer `tenant_id` filter and return cross-tenant invoices.

**Risk:** Cross-tenant invoice data leakage. At minimum: unexpected query behavior and information disclosure.

---

### FINDING-SEC-008 — Invoice PATCH (Edit): Non-Atomic Stock Operations (HIGH)

**Evidence:**
- `src/app/api/invoices/route.ts:456-581` (PATCH edit flow): 6 separate, non-transactional DB calls — old item stock revert (loop), delete old items, insert new items, new stock apply (loop), client balance update, invoice update.

**Risk:**
- Partial failure between any two steps leaves stock in a corrupted state.
- Malicious partial failure (induced network cut mid-request) can corrupt stock without completing the edit.
- Same vulnerability class as MF-001 (non-atomic purchase mutations).

---

### FINDING-SEC-009 — Client PATCH: Pre-Auth DB Lookup via Untrusted ID (HIGH)

**Evidence:**
- `src/app/api/clients/route.ts:94-100`:
  ```typescript
  if (!targetTenantId) {
    const { data: existingClient } = await supabaseAdmin.from('clients').select('tenant_id').eq('id', id).maybeSingle();
    targetTenantId = existingClient?.tenant_id;
  }
  ```
- If `tenant_id` is omitted from the request body, the route performs a DB lookup via caller-supplied `id` **before auth**.

**Risk:** Unauthenticated actor can probe any client UUID to discover its `tenant_id` — an IDOR oracle for tenant-to-client relationship mapping.

---

### FINDING-SEC-010 — 7-Day Session JWT Without Revocation (MEDIUM)

**Evidence:**
- `src/lib/session.ts:43`: `.setExpirationTime('7d')`.
- No session revocation table, no `jti` claim, no refresh token mechanism.
- Logout only clears the client cookie; the JWT remains cryptographically valid for 7 days.

**Risk:** Stolen session tokens cannot be invalidated without rotating `SESSION_SECRET` (which destroys all active sessions system-wide).

---

### FINDING-SEC-011 — AI Quota In-Memory Fallback Resets on Cold Start (MEDIUM)

**Evidence:**
- `src/lib/ai-gateway.ts:85-86`: `memoryLedger` and `memoryTenantSettings` are module-scoped Maps.
- When the DB is unavailable, quota enforcement falls back to these Maps.
- Cold start resets both to empty.

**Risk:** A tenant that has exhausted their AI scan quota can bypass it by waiting for a cold start. Unlimited AI scan usage at the operator's Gemini API cost.

---

### FINDING-SEC-012 — Voucher Token Application: Non-Atomic Race Condition (MEDIUM)

**Evidence:**
- `src/app/api/vouchers/route.ts`: Token validation (step 1), voucher insert (step 2), token mark-used (step 3) are 3 separate, non-transactional calls.

**Attack Vector:** Two concurrent requests using the same `applied_token_ids` both pass step 1 simultaneously and both complete step 2, double-spending the token value.

**Risk:** Token double-spend → double balance reduction for supplier/client with only one actual token expenditure. Same class as MF-003.

---

### FINDING-SEC-013 — No Content-Security-Policy Header (MEDIUM)

**Evidence:**
- `next.config.ts`: 6 security headers are configured. **CSP is absent.**

**Risk:** Any XSS vulnerability allows unrestricted script execution. CSP is the primary defense-in-depth control against XSS. Its absence significantly increases exploitability of any future or existing XSS finding.

---

### FINDING-SEC-014 — Service Role Key Silent Fallback to Placeholder (MEDIUM)

**Evidence:**
- `src/lib/supabase.ts:5`:
  ```typescript
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service_key_placeholder';
  ```
- No startup-time validation or throw for missing key in any environment.

**Risk:** Misconfigured deployment silently initializes `supabaseAdmin` with an invalid key. All admin DB operations fail at runtime with uninformative errors. No operator alert on startup.

---

### FINDING-SEC-015 — Deprecated `X-XSS-Protection` Header (LOW)

**Evidence:** `next.config.ts:21-24`: `X-XSS-Protection: 1; mode=block` has no effect in Chrome 78+, Firefox, or Safari. Can introduce vulnerabilities in legacy IE.

---

### FINDING-SEC-016 — Branch Transfer: Non-Atomic Stock Dispatch/Receive (LOW)

**Evidence:**
- `src/app/api/branch-orders/route.ts:298-313` (`dispatched`): stock deducted per-item in a loop.
- `src/app/api/branch-orders/route.ts:349-381` (`received`): stock added per-item in a loop.
- No transaction wrapping either loop.

**Risk:** Partial server failure during a loop leaves stock in a half-deducted/half-added state with no rollback.

---

### FINDING-SEC-017 — 4-Digit Random Number Collision on Codes (LOW)

**Evidence:**
- `vouchers/route.ts:111`: `RCP-${Math.floor(1000 + Math.random() * 9000)}` (9,000 possible values).
- `clients/route.ts:58`: `CL-${Math.floor(1000 + Math.random() * 9000)}`.
- `suppliers/route.ts:56`: `SUP-${Math.floor(1000 + Math.random() * 9000)}`.
- No uniqueness check before insert.

**Risk:** Under parallel POS load, collisions are probable. Duplicate voucher numbers cause reconciliation confusion; duplicate client/supplier codes break grouping queries.

---

## 4. Positive Security Controls Observed

| Control | Status |
|---|---|
| bcrypt at `SALT_ROUNDS = 12` | ✅ Correct |
| Auto-upgrade plaintext passwords on login | ✅ Correct |
| HTTPOnly + SameSite=Lax cookies | ✅ Correct |
| `requireTenantAuth` on all data routes (except slug path) | ✅ Correct |
| `requireDevAuth` on all developer routes | ✅ Correct |
| `poweredByHeader: false` | ✅ Correct |
| HSTS `max-age=63072000; includeSubDomains; preload` | ✅ Correct |
| `cancel_invoice_atomic` RPC (DB-level atomicity) | ✅ Correct |
| `create_invoice_atomic` RPC (DB-level atomicity) | ✅ Correct |
| All DB queries via parameterized Supabase client (no raw SQL interpolation) | ✅ Correct |

---

## 5. Severity Matrix

| ID | Severity | Exploitable Without Auth? |
|---|---|---|
| SEC-001 | CRITICAL | No (still needs route-level bypass) |
| SEC-002 | CRITICAL | **YES** |
| SEC-003 | CRITICAL | **YES** (cold start) |
| SEC-004 | HIGH | **YES** (non-prod) |
| SEC-005 | HIGH | **YES** |
| SEC-006 | HIGH | **YES** |
| SEC-007 | HIGH | No (tenant auth required) |
| SEC-008 | HIGH | No (session required) |
| SEC-009 | HIGH | **YES** |
| SEC-010 | MEDIUM | No (stolen token) |
| SEC-011 | MEDIUM | No (tenant auth required) |
| SEC-012 | MEDIUM | No (session required) |
| SEC-013 | MEDIUM | No (requires XSS) |
| SEC-014 | MEDIUM | No (deployment concern) |
| SEC-015 | LOW | No |
| SEC-016 | LOW | No (session required) |
| SEC-017 | LOW | No (load-dependent) |

---

## 6. Phase 10 Status

**PHASE 10 — ADVERSARIAL SECURITY AUDIT: COMPLETE**

- 17 findings documented (3 CRITICAL · 5 HIGH · 5 MEDIUM · 4 LOW).
- No source code, database, migration, configuration, or audit files modified.
- All findings based on direct inspection of actual codebase evidence.

**Awaiting human instruction:** Approve Phase 10 implementation plan, or proceed to Phase 11.
