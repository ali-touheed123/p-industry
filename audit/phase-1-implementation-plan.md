# PHASE 1 IMPLEMENTATION PLAN — ARCHITECTURAL HARDENING

**Status:** AWAITING HUMAN APPROVAL (AUDIT ONLY — DO NOT IMPLEMENT YET)  
**Phase:** Phase 1 — Repository & Architecture  
**Dependencies:** Requires Phase 2 & Phase 3 verification before execution

---

## 1. Overview
This implementation plan addresses verified architectural risks identified during Phase 1 of the Master Forensic Audit.

---

## 2. Planned Changes

### PLAN-ARCH-001: Implement Centralized Edge Middleware
- **Problem:** Currently, 0 `middleware.ts` exists. Each API route implements manual authentication boilerplate, risking omission in new endpoints.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-001`
- **Root Cause:** Next.js Edge Middleware was never created.
- **Required Behavior:** Create `src/middleware.ts` to intercept `/api/*`, verify presence of session cookie/Authorization header, reject malformed requests early, and attach security headers.
- **Files Likely Affected:** `src/middleware.ts` (new file)
- **Database Objects Likely Affected:** None
- **API/RPCs Likely Affected:** All routes under `/api/*`
- **Frontend Areas Likely Affected:** None (transparent edge filter)
- **Risks / Regression:** Must ensure public endpoints (`/api/auth/login`, `/api/auth/dev-pin`, public landing APIs) are correctly whitelisted.
- **Verification Criteria:** Requests without credentials to protected `/api/*` endpoints are rejected at the edge with 401 before hitting Route Handlers.

---

### PLAN-ARCH-002: Remove Plain-Text Password Comparison & Enforce Bcrypt
- **Problem:** `src/lib/auth-passwords.ts:25-27` allows plain-text password authentication fallback.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-002`
- **Root Cause:** Temporary migration fallback remained in production codebase.
- **Required Behavior:** Require all passwords in `app_users.password_hash` to be valid bcrypt hashes. If a legacy password is encountered during login, verify, rehash, and update the database record to bcrypt immediately.
- **Files Likely Affected:** `src/lib/auth-passwords.ts`, `src/app/api/auth/login/route.ts`
- **Database Objects Likely Affected:** `app_users` table
- **API/RPCs Likely Affected:** `POST /api/auth/login`
- **Frontend Areas Likely Affected:** None
- **Risks / Regression:** If unhashed users exist, a transitional auto-rehash must execute on first login.
- **Verification Criteria:** Plain-text passwords cannot authenticate unless auto-rehashed, and non-bcrypt strings in `password_hash` cannot be exploited.

---

### PLAN-ARCH-003: Strict Environment Secret Validation
- **Problem:** Hardcoded fallback values exist for `DEV_ADMIN_SECRET` and `DEV_ADMIN_PIN` in development mode.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-003`
- **Root Cause:** Default developer strings used as fallbacks.
- **Required Behavior:** Ensure production and staging builds enforce mandatory environment variable declaration (`SESSION_SECRET`, `DEV_ADMIN_SECRET`, `DEV_ADMIN_PIN`). Throw explicit startup errors if secrets are missing.
- **Files Likely Affected:** `src/lib/session.ts`, `src/app/api/auth/dev-pin/route.ts`
- **Database Objects Likely Affected:** None
- **API/RPCs Likely Affected:** `/api/auth/dev-pin`, `/api/dev/*`
- **Frontend Areas Likely Affected:** None
- **Verification Criteria:** Application refuses to start in staging/production without explicitly supplied high-entropy secrets.

---

### PLAN-ARCH-004: Type Unification (CEO vs Core POS)
- **Problem:** Duality of snake_case (`src/types/index.ts`) vs camelCase (`src/types/ceo.ts`).
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-004`
- **Root Cause:** Separate models created for CEO Dashboard vs core POS.
- **Required Behavior:** Standardize on canonical database schemas or introduce explicit TypeScript transformer mappers.
- **Files Likely Affected:** `src/types/ceo.ts`, `src/components/ceo-panel/*.tsx`
- **Database Objects Likely Affected:** None
- **API/RPCs Likely Affected:** None
- **Frontend Areas Likely Affected:** CEO Panel UI
- **Verification Criteria:** Zero type ambiguity between POS models and Executive reports.

---

### PLAN-ARCH-005: Permissions-Policy Camera Access Refinement
- **Problem:** `next.config.ts:30` declares `camera=()`, disabling browser video capture.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-005`
- **Root Cause:** Overly strict default security headers in `next.config.ts`.
- **Required Behavior:** Change `camera=()` to `camera=(self)` to allow self-hosted camera capture for AI invoice and barcode scanning.
- **Files Likely Affected:** `next.config.ts`
- **Database Objects Likely Affected:** None
- **API/RPCs Likely Affected:** None
- **Frontend Areas Likely Affected:** Camera upload modal in `AiInvoiceScan.tsx`
- **Verification Criteria:** Browser allows camera device capture under same-origin HTTPS.
