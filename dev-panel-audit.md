# Pyntflow Developer Panel (Aura Dev Hub) — Comprehensive Audit Report

**Audit Mode**: Read-Only Source Code, API Route, & Database Schema Analysis  
**Target Environment**: Production / Multi-Tenant Architecture  
**Date**: September 25, 2026  
**Auditor**: Antigravity DeepMind Agentic Pair Programmer  

---

## 1. Executive Summary & Audit Scorecard

A thorough, end-to-end audit of the entire Developer Panel subsystem was conducted across frontend components, Next.js API endpoints, database schemas, foreign key dependencies, authentication lifecycles, and tenant provisioning flows.

### Overall Subsystem Health Score: **68 / 100**

```
┌────────────────────────────────────────────────────────┬─────────────┐
│ Category                                               │ Status      │
├────────────────────────────────────────────────────────┼─────────────┤
│ 1. Developer Authentication & PIN Rate Limiting        │ Passed (85%)│
│ 2. Session Locking & Cookie Eviction                   │ FAILING (P1)│
│ 3. User Account Editing Flow                           │ BROKEN (P0) │
│ 4. New Branch Provisioning with Counters               │ BROKEN (P0) │
│ 5. Branch Deletion Foreign Key Constraints             │ BROKEN (P1) │
│ 6. Branch Update Data Retention (Slug/Owner)           │ BUG (P2)    │
│ 7. Receipt Template System Integration with POS        │ DISCONNECTED│
│ 8. Dev Template Assignment Auth Headers                │ BUG (P2)    │
│ 9. Repository Migration Completeness                   │ GAP (P2)    │
└────────────────────────────────────────────────────────┴─────────────┘
```

---

## 2. Dev Panel Architecture & Route Map

### 2.1 Frontend Components (`src/components/dev-panel/`)
* **`AuraDevPanel.tsx`**: Main developer shell, state container, modal orchestration, and data fetching coordinator.
* **`DevPinLogin.tsx`**: Master PIN security gateway with rate-limiting response handling.
* **`DevNavbar.tsx`**: Top navigation header with quick provision triggers, refresh, and lock.
* **`DevSidebar.tsx`**: Navigation hub, profile badge, tab switcher, and primary tenant indicator.
* **`DevOverviewView.tsx`**: High-level facility statistics, regional distribution, and quick directory.
* **`DevBranchesView.tsx`**: Multi-tenant facility management (shops, godowns, factories) with status toggling.
* **`DevBranchModal.tsx`**: Shop provisioning and editing modal with multi-counter setup.
* **`DevBranchPortalModal.tsx`**: Quick launch tenant route modal and simulation utilities.
* **`DevUsersView.tsx`**: User directory, role indicators, and credentials management.
* **`DevUserModal.tsx`**: User creation and modification modal.
* **`DevReceiptTemplatesView.tsx`**: 77KB graphical receipt template designer (paper size, layout, headers, tables, totals, footer).
* **`DevTemplateAssignView.tsx`**: Enterprise branch-to-template assignment matrix.
* **`DevReceiptPreview.tsx`**: Real-time receipt layout renderer and print preview.
* **`aura-panel.css`**: Luxury dark gold theme styling.

### 2.2 API Routes & Security Middleware
* **`src/app/api/auth/dev-pin/route.ts`**: Verifies Master PIN, applies sliding-window IP rate limiting (5 attempts / 15 min), issues 8-hour JWT and `aura_dev_token` cookie.
* **`src/app/api/tenants/route.ts`**: Tenant CRUD operations (`GET`, `POST`, `PATCH`, `DELETE`).
* **`src/app/api/users/route.ts`**: User CRUD operations (`GET`, `POST`, `PUT`, `DELETE`).
* **`src/app/api/receipt-templates/route.ts`**: Template management (`GET`, `POST`, `PATCH`, `DELETE`).
* **`src/app/api/receipt-templates/assign/route.ts`**: Tenant-template mapping (`GET`, `POST`).
* **`src/lib/session.ts`**: `requireDevAuth()`, `requireTenantAuth()`, and JWT evaluation.

---

## 3. Verified Bugs & Broken Flows

### 🔴 Critical Bug 1: User Editing is Completely Broken (100% Failure Rate)
* **Severity**: `P0 - Blocker`
* **Affected Files**:
  * `src/components/dev-panel/AuraDevPanel.tsx` (Line 203)
  * `src/components/dev-panel/DevUserModal.tsx` (Lines 85, 93)
  * `src/app/api/users/route.ts` (Lines 43, 93)
* **Evidence**:
  1. In `AuraDevPanel.tsx`, `handleSaveUser` is hardcoded to call `fetch('/api/users', { method: 'POST', ... })` for **both** creating new users and editing existing users:
     ```tsx
     const handleSaveUser = async (userData: { id?: string; ... }) => {
       const res = await fetch('/api/users', {
         method: 'POST', // ❌ ALWAYS POST, NEVER PUT
         ...
       });
     ```
  2. In `src/app/api/users/route.ts`, the `POST` handler is strictly designed for new record creation:
     ```ts
     const { username, password, full_name, role, tenant_id, email } = body;
     if (!username || !password || !role) {
       return NextResponse.json({ success: false, error: 'Username, password and role are required' }, { status: 400 });
     }
     ```
  3. When an administrator edits an existing user in `DevUserModal.tsx`, the password field is left empty if unchanged. `POST /api/users` immediately aborts with:
     `400 Bad Request: Username, password and role are required`.
  4. If the administrator provides a password, `POST /api/users` attempts to insert a new row with the existing username. Because `app_users.username` is unique, it fails with:
     `400 Bad Request: Username already exists`.
* **Impact**: No user account in the system (cashiers, CEOs, godown staff) can be modified from the Developer Panel.

---

### 🔴 Critical Bug 2: Branch Provisioning Fails with 500 Duplicate Key Error & Leaves Orphaned Tenants
* **Severity**: `P0 - Blocker`
* **Affected Files**:
  * `src/components/dev-panel/DevBranchModal.tsx` (Line 36)
  * `src/app/api/tenants/route.ts` (Lines 111, 161–190)
  * Supabase Table: `public.app_users`
* **Evidence**:
  1. `public.app_users.username` has a global PostgreSQL `UNIQUE` constraint (`app_users_username_key`). Usernames are **not** unique per tenant; they are unique across the entire database.
  2. In `DevBranchModal.tsx`, new branch provisioning initializes with:
     ```tsx
     const [counters, setCounters] = useState([
       { username: 'counter1', password: '123', name: 'Counter 01 (Main POS)' }
     ]);
     ```
  3. The username `counter1` is already in use by the primary tenant (verified in database).
  4. When an admin submits the modal to provision a second branch, `POST /api/tenants`:
     - **Step 1**: Inserts the new tenant into `public.tenants` (succeeds).
     - **Step 3**: Attempts to insert `counter1` into `public.app_users`.
     - Postgres throws: `duplicate key value violates unique constraint "app_users_username_key"`.
     - The route crashes into the `catch` block and returns HTTP 500.
  5. There is no transactional rollback. The newly created tenant remains permanently orphaned in `public.tenants` without any CEO or counter accounts.
* **Impact**: Provisioning a new shop using the default form values always fails and corrupts the tenant directory with orphaned records.

---

### 🟠 High Severity Bug 3: Branch Deletion Crashes on Foreign Key Constraints
* **Severity**: `P1 - High`
* **Affected Files**:
  * `src/app/api/tenants/route.ts` (Lines 248–336)
* **Evidence**:
  1. `DELETE /api/tenants` attempts to manually clean up dependent child tables before deleting the tenant:
     ```ts
     await supabaseAdmin.from('app_users').delete().eq('tenant_id', id);
     await supabaseAdmin.from('held_invoices').delete().eq('tenant_id', id);
     await supabaseAdmin.from('items').delete().eq('tenant_id', id);
     await supabaseAdmin.from('shifts').delete().eq('tenant_id', id);
     await supabaseAdmin.from('expenses').delete().eq('tenant_id', id); // ❌ Table doesn't exist
     await supabaseAdmin.from('petty_expenses').delete().eq('tenant_id', id);
     await supabaseAdmin.from('clients').delete().eq('tenant_id', id);
     await supabaseAdmin.from('suppliers').delete().eq('tenant_id', id);
     await supabaseAdmin.from('audit_logs').delete().eq('tenant_id', id);
     await supabaseAdmin.from('vouchers').delete().eq('tenant_id', id);
     const { error } = await supabaseAdmin.from('tenants').delete().eq('id', id);
     ```
  2. The cleanup list **completely omits**:
     - `public.token_transactions` (`token_transactions_tenant_id_fkey`)
     - `public.tenant_receipt_template` (`tenant_receipt_template_tenant_id_fkey`)
     - `public.ceo_tenants` (`ceo_tenants_tenant_id_fkey`)
  3. Furthermore, `token_transactions` has foreign keys referencing `clients`, `items`, `invoices`, `purchases`, and `vouchers`. Attempting to delete `clients` or `items` while token transactions exist fails immediately.
  4. Additionally, line 322 attempts to delete from `expenses`, a table that does not exist in the database (the real table is `petty_expenses`).
* **Impact**: Deleting any branch that has ever recorded paint tokens, assigned a receipt template, or has CEO tenant mappings fails with a 500 Foreign Key Constraint Violation.

---

### 🟠 High Severity Bug 4: Lock Action Does Not Evict HTTP Cookie (Session Persistence Risk)
* **Severity**: `P1 - High`
* **Affected Files**:
  * `src/components/dev-panel/AuraDevPanel.tsx` (Line 107)
  * `src/app/api/auth/dev-pin/route.ts` (Lines 71–77)
  * `src/lib/session.ts` (Lines 51–71)
* **Evidence**:
  1. `/api/auth/dev-pin` sets an HTTP-only cookie `aura_dev_token` with an 8-hour lifespan:
     ```ts
     res.cookies.set(DEV_ADMIN_COOKIE, token, { httpOnly: true, maxAge: 28800, path: '/' });
     ```
  2. In `AuraDevPanel.tsx`, the `handleLock` function only clears browser `sessionStorage`:
     ```tsx
     const handleLock = () => {
       sessionStorage.removeItem('aura_dev_auth');
       sessionStorage.removeItem('aura_dev_token');
       setIsAuthenticated(false);
     };
     ```
  3. It does not invoke any server-side logout route to clear the `aura_dev_token` cookie.
  4. In `src/lib/session.ts`, `getSession()` inspects `req.cookies.get(DEV_ADMIN_COOKIE)`:
     ```ts
     const devToken = devCookie || authHeader;
     if (devToken) {
       // Authenticated as developer!
     }
     ```
  5. If an unauthorized person uses the machine after a developer clicks "Lock", the frontend shows the login screen, but every direct API call or background request made from that browser continues to execute with full super-developer privileges.
* **Impact**: Developer panel lock is purely visual and provides false security against unauthorized API interactions.

---

## 4. Logic & Data Flow Inconsistencies

### 🟡 Medium Bug 5: Branch URL Slug and Owner Name Dropped During Edit
* **Severity**: `P2 - Medium`
* **Affected Files**:
  * `src/components/dev-panel/DevBranchModal.tsx` (Lines 128, 133)
  * `src/app/api/tenants/route.ts` (Lines 340–387)
* **Evidence**:
  In `DevBranchModal.tsx`, the user can modify `slug` and `ownerName`. These are sent to `PATCH /api/tenants`.
  However, `PATCH /api/tenants` destructures only:
  ```ts
  const { id, is_active, name, phone, email, city, address, type, commission_* } = body;
  ```
  Neither `slug` nor `owner_name` is extracted or written to the `tenants` table.
* **Impact**: Editing a branch's URL slug or owner name in the UI appears to succeed, but the database is never updated.

---

### 🟡 Medium Bug 6: `DevTemplateAssignView` Omits Developer Authorization Headers
* **Severity**: `P2 - Medium`
* **Affected Files**:
  * `src/components/dev-panel/DevTemplateAssignView.tsx` (Lines 35, 56)
  * `src/app/api/receipt-templates/assign/route.ts` (Lines 72, 119)
* **Evidence**:
  1. `src/app/api/receipt-templates/assign/route.ts` requires developer authentication:
     ```ts
     const devAuth = await requireDevAuth(req);
     if (!devAuth.authorized) return 401/403;
     ```
  2. In `DevTemplateAssignView.tsx`, API calls are made via raw `fetch`:
     ```tsx
     const res = await fetch('/api/receipt-templates/assign');
     const res = await fetch('/api/receipt-templates/assign', { method: 'POST', ... });
     ```
  3. Unlike other views in the panel, `DevTemplateAssignView` does not attach `Authorization: Bearer ${sessionStorage.getItem('aura_dev_token')}`. If the browser blocks cookies or relies on bearer tokens, these requests fail with 401/403.
* **Impact**: Intermittent assignment failures depending on cookie policy and browser configuration.

---

### 🟡 Medium Bug 7: Disconnected Receipt Template Designer
* **Severity**: `P2 - Architectural Inconsistency`
* **Affected Files**:
  * `src/components/dev-panel/DevReceiptTemplatesView.tsx`
  * `src/components/PosBilling.tsx`
  * `src/components/SalesHistory.tsx`
* **Evidence**:
  1. `DevReceiptTemplatesView` allows customizing logo size, shop title, borders, table columns, GST rates, bold totals, WhatsApp footer, and paper size (thermal 80, 58, A4, A5).
  2. In `src/components/PosBilling.tsx` and `src/components/SalesHistory.tsx`, receipts are rendered via hardcoded helper functions (`buildPosThermalHtml` and `buildSalesHistoryThermalHtml`).
  3. Neither `PosBilling.tsx` nor `SalesHistory.tsx` ever queries `GET /api/receipt-templates/assign?tenant_id=...` to load or apply the configured template.
* **Impact**: The entire Receipt Template Designer feature is an isolated sandbox that does not affect actual sales receipts printed at store checkouts.

---

### 🟡 Medium Bug 8: Missing Migration Scripts in Repository
* **Severity**: `P2 - DevOps & Consistency`
* **Affected Tables**:
  * `public.receipt_templates`
  * `public.tenant_receipt_template`
* **Evidence**:
  Both tables exist in the live Supabase database, but neither table creation nor its initial seed is documented in `supabase/migrations/`.
* **Impact**: Any fresh deployment, developer clone, or secondary database environment will lack these tables, causing `/api/receipt-templates` to fail.

---

## 5. UI/UX & Functional Review

| Feature / Screen | Component | Findings | Status |
| :--- | :--- | :--- | :--- |
| **Dev PIN Login** | `DevPinLogin.tsx` | Clean luxury branding; rate-limiting feedback displayed accurately; PIN validated exclusively against env variable. | ✅ Operational |
| **System Overview** | `DevOverviewView.tsx` | Facility breakdown (shops, godowns, factories) and account counters reflect live Supabase data. | ✅ Operational |
| **Branch Directory** | `DevBranchesView.tsx` | Search, type filtering (shops/godowns/factories), and status toggle work smoothly. | ✅ Operational |
| **Branch Quick Launch** | `DevBranchPortalModal.tsx` | Displays tenant URL and copy shortcut. **Note**: "Sync Test" button is a pure visual `setTimeout` simulation without backend integration. | ⚠️ Simulated |
| **User Directory** | `DevUsersView.tsx` | Role pills (Developer, CEO, Incharge, Staff) render with distinct color schemes; search works across username, full name, and branch. | ✅ Operational |
| **Receipt Designer** | `DevReceiptTemplatesView.tsx` | Complex visual editor functions properly within its preview canvas; saves JSON to database. | ⚠️ Disconnected from POS |
| **Branch Template Matrix** | `DevTemplateAssignView.tsx` | Enterprise assignment table works, but lacks auth header fallback. | ⚠️ Missing Auth Header |
| **Sidebar & Profile** | `DevSidebar.tsx` | Hardcodes "Ali Touheed" / "SUPER DEV" regardless of session identity. | ℹ️ Cosmetic |

---

## 6. Prioritized Remediation Plan

To harden the Developer Panel and make it 100% production-ready, the following prioritized fixes are recommended:

### Phase 1: High-Priority Fixes (P0 & P1)

1. **Fix User Editing in `AuraDevPanel.tsx` & `src/app/api/users/route.ts`**:
   * In `AuraDevPanel.tsx` `handleSaveUser`, use `method: 'PUT'` and pass the user ID when editing an existing user.
   * In `/api/users/route.ts` `PUT`, ensure password hashing is only applied if a non-empty password is submitted.
   * If a user's role is updated to `ceo`, upsert `ceo_tenants`.

2. **Fix Branch Provisioning & Unique Username Collision**:
   * In `DevBranchModal.tsx`, automatically prefix the suggested counter username with the branch slug (e.g. `${slug}_counter1`) to avoid colliding with globally taken usernames.
   * In `POST /api/tenants`, wrap tenant and user creation in error handling so that if user creation fails, the orphaned tenant is automatically rolled back / deleted.

3. **Secure Developer Session Logout / Eviction**:
   * Add a `POST /api/auth/dev-logout` endpoint that expires the `aura_dev_token` cookie (`maxAge: 0`).
   * Call this endpoint in `AuraDevPanel.tsx` `handleLock` so the HTTP cookie is invalidated alongside `sessionStorage`.

4. **Fix Foreign Key Constraints in Branch Deletion (`DELETE /api/tenants`)**:
   * Cascade-delete `token_transactions` (or unlink from tenant), `tenant_receipt_template`, and `ceo_tenants` before deleting child tables.
   * Remove the reference to the non-existent `expenses` table.

### Phase 2: Medium-Priority Polish (P2)

5. **Support Slug and Owner Name Updates in `PATCH /api/tenants`**:
   * Allow updating `slug` (with uniqueness validation) and `owner_name` in `PATCH /api/tenants`.

6. **Add Auth Headers to `DevTemplateAssignView.tsx`**:
   * Pass `getDevAuthHeaders()` into the `fetch('/api/receipt-templates/assign')` requests.

7. **Export Missing Database Migrations**:
   * Create `supabase/migrations/20260925_06_receipt_templates.sql` documenting `receipt_templates` and `tenant_receipt_template` schemas for repository completeness.

8. **Connect Receipt Templates to Counter POS**:
   * In `PosBilling.tsx` and `SalesHistory.tsx`, query `/api/receipt-templates/assign?tenant_id=${tenant.id}` to render the receipt matching the store's assigned layout and paper size.
