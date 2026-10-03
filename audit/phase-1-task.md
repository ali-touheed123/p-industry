# PHASE 1 TASK BREAKDOWN — ARCHITECTURAL REINFORCEMENTS

**Status:** AWAITING HUMAN APPROVAL (PLANNING ONLY — DO NOT EXECUTE YET)  
**Phase:** Phase 1 — Repository & Architecture

---

### TASK-1.1: Unified Next.js Edge Middleware
- **Objective:** Create `src/middleware.ts` to provide edge-level session parsing, route-level security headers, and public/private path filtering.
- **Problem Being Solved:** Eliminates single-point-of-failure risks where an API route might omit manual authorization checks.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-001`
- **Exact Files:** `src/middleware.ts`
- **Exact Functions:** `export async function middleware(req: NextRequest)`
- **Database Changes:** None
- **API Changes:** None
- **Frontend Changes:** None
- **Security Requirements:** Whitelist `/api/auth/login`, `/api/auth/dev-pin`, and static assets; intercept all other `/api/*` routes.
- **Acceptance Criteria:** Unauthenticated HTTP calls to `/api/invoices`, `/api/tokens`, `/api/purchases` return HTTP 401 at the edge.

---

### TASK-1.2: Password Hashing Strict Mode & Migration Hook
- **Objective:** Deprecate plain-text fallback in `verifyPassword` and add automated hash upgrade on login.
- **Problem Being Solved:** Prevents authentication bypasses and ensures plain-text credentials are never valid in production.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-002`
- **Exact Files:** `src/lib/auth-passwords.ts`, `src/app/api/auth/login/route.ts`
- **Exact Functions:** `verifyPassword`, `POST /api/auth/login`
- **Database Changes:** None
- **API Changes:** When a plain-text password matches on login, immediately hash with bcrypt and update `app_users.password_hash`.
- **Frontend Changes:** None
- **Acceptance Criteria:** Zero plain-text comparisons permitted; database contains only `$2a$` / `$2b$` bcrypt hashes.

---

### TASK-1.3: Mandatory High-Entropy Secret Enforcement
- **Objective:** Ensure application throws startup fatal error if `SESSION_SECRET` or `DEV_ADMIN_SECRET` are not set, regardless of `NODE_ENV`.
- **Problem Being Solved:** Eliminates hardcoded dev strings in staging or pre-production deployments.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-003`
- **Exact Files:** `src/lib/session.ts`, `src/app/api/auth/dev-pin/route.ts`
- **Exact Functions:** `getJwtSecret()`, `getDevSecret()`
- **Database Changes:** None
- **API Changes:** None
- **Frontend Changes:** None
- **Acceptance Criteria:** Server fails fast with actionable log if JWT encryption secret length is under 32 characters.

---

### TASK-1.4: Next.js Permissions-Policy Camera Adjustment
- **Objective:** Update `Permissions-Policy` in `next.config.ts` from `camera=()` to `camera=(self)`.
- **Problem Being Solved:** Unblocks browser-based camera video streams for barcode and AI invoice scanning while maintaining strict cross-origin restrictions.
- **Evidence:** `audit/phase-1-audit-report.md#FINDING-ARCH-005`
- **Exact Files:** `next.config.ts`
- **Exact Functions:** `headers()` configuration
- **Database Changes:** None
- **API Changes:** None
- **Frontend Changes:** None
- **Acceptance Criteria:** `Permissions-Policy: camera=(self)` returned in HTTP response headers.
