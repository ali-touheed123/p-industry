# PHASE 10 — FINAL DATABASE & DOCUMENTATION FORENSIC CROSS-VERIFICATION REPORT

**Target:** Phase 10 — AI Invoice Scanner & Central AI Gateway  
**Date:** October 6, 2026  
**Auditor Mode:** Independent Live Database & Documentation Forensic Audit (Read-Only)  
**Overall Verdict:** **VERIFIED RESOLVED (WITH DOCUMENTATION CONTRADICTION DOCUMENTED)**

---

## 1. Live Supabase Database Inspection (`ignspvajzblmsbertmmv`)

An inspection of the live PostgreSQL instance on Supabase project `ignspvajzblmsbertmmv` was conducted via direct schema and system catalog queries. No assumptions were made based on migration files or local scripts.

### 1.1 Object-by-Object Verification Matrix

| Database Object | Type | Live Status | RLS Status | Atomic Locking / Key Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `public.ai_usage_settings` | Table | **DOES NOT EXIST** | N/A | Split architecture used instead (see below) |
| `public.global_ai_settings` | Table | **EXISTS** | **ENABLED** (Service role full access) | Single row singleton (`id=1 PK`), row locked in RPC |
| `public.tenant_ai_settings` | Table | **EXISTS** | **ENABLED** (Service role full access) | `tenant_id PK` referencing `public.tenants(id) ON DELETE CASCADE` |
| `public.ai_usage_ledger` | Table | **EXISTS** | **ENABLED** (Service role full access) | `tenant_id FK` referencing `public.tenants(id)`, 5 btree indexes |
| `public.reserve_ai_usage` | Function (RPC) | **EXISTS** | Security Definer | **Confirmed Atomic Locking** (`FOR UPDATE` on global and tenant settings) |

---

### 1.2 Detailed Live Schema & Structure Breakdown

#### A. `public.ai_usage_settings`
* **Status:** **DOES NOT EXIST**
* **Finding:** The design intentionally split AI settings into platform-wide controls (`global_ai_settings`) and per-shop limits (`tenant_ai_settings`). There is no monolithic table named `ai_usage_settings`.

#### B. `public.global_ai_settings`
* **Status:** **EXISTS**
* **Columns:**
  - `id` (`integer`, NOT NULL, default `1`, PK)
  - `ai_enabled` (`boolean`, NOT NULL, default `true`)
  - `global_daily_request_cap` (`integer`, NOT NULL, default `1000`)
  - `global_monthly_request_cap` (`integer`, NOT NULL, default `20000`)
  - `global_monthly_cost_cap` (`numeric(10,2)`, NOT NULL, default `50.00`)
  - `short_term_rate_limit` (`integer`, NOT NULL, default `5`)
  - `created_at` / `updated_at` (`timestamptz`, NOT NULL, default `now()`)
* **Live Data:** Confirmed 1 active configuration row (`ai_enabled = true`, daily cap = 1,000, monthly cost cap = $50.00).

#### C. `public.tenant_ai_settings`
* **Status:** **EXISTS**
* **Columns:**
  - `tenant_id` (`uuid`, NOT NULL, PK, FK -> `tenants.id`)
  - `ai_enabled` (`boolean`, NOT NULL, default `true`)
  - `daily_request_limit` (`integer`, NOT NULL, default `3`)
  - `monthly_request_limit` (`integer`, NOT NULL, default `90`)
  - `created_at` / `updated_at` (`timestamptz`, NOT NULL, default `now()`)
* **Indexes:** `tenant_ai_settings_pkey` (`tenant_id`), `idx_tenant_ai_settings_tenant_id` (`tenant_id`).
* **Live Data:** Active tenant settings confirmed present.

#### D. `public.ai_usage_ledger`
* **Status:** **EXISTS**
* **Columns:**
  - `id` (`uuid`, NOT NULL, default `gen_random_uuid()`, PK)
  - `request_id` (`text`, NOT NULL)
  - `tenant_id` (`uuid`, NOT NULL, FK -> `tenants.id`)
  - `feature` (`text`, NOT NULL, default `'invoice_scanner'`)
  - `provider` (`text`, NOT NULL, default `'gemini'`)
  - `model` (`text`, NOT NULL, default `'gemini-3.5-flash-lite'`)
  - `requested_at` (`timestamptz`, NOT NULL, default `now()`)
  - `status` (`text`, NOT NULL, default `'reserved'`)
  - `input_tokens` (`integer`, NOT NULL, default `0`)
  - `output_tokens` (`integer`, NOT NULL, default `0`)
  - `total_tokens` (`integer`, NOT NULL, default `0`)
  - `estimated_cost` (`numeric(10,6)`, NOT NULL, default `0.000000`)
  - `metadata` (`jsonb`, NOT NULL, default `'{}'::jsonb`)
  - `created_at` (`timestamptz`, NOT NULL, default `now()`)
* **Indexes Verified:**
  1. `ai_usage_ledger_pkey` (`id`)
  2. `idx_ai_usage_ledger_request_id` (`request_id`)
  3. `idx_ai_usage_ledger_tenant_requested` (`tenant_id, requested_at DESC`)
  4. `idx_ai_usage_ledger_tenant_status_requested` (`tenant_id, status, requested_at DESC`)
  5. `idx_ai_usage_ledger_global_requested` (`requested_at DESC`)
  6. `idx_ai_usage_ledger_global_status_requested` (`status, requested_at DESC`)

#### E. `public.reserve_ai_usage` (RPC Function)
* **Status:** **EXISTS**
* **Signature:**
  ```sql
  reserve_ai_usage(
    p_tenant_id uuid,
    p_request_id text,
    p_feature text DEFAULT 'invoice_scanner'::text,
    p_provider text DEFAULT 'gemini'::text,
    p_model text DEFAULT 'gemini-3.5-flash-lite'::text
  ) RETURNS jsonb
  ```
* **Real Body & Behavior Verified:**
  1. **Atomic Concurrency Control:** Executes `SELECT * INTO v_global FROM public.global_ai_settings WHERE id = 1 FOR UPDATE;` and `SELECT * INTO v_tenant FROM public.tenant_ai_settings WHERE tenant_id = p_tenant_id FOR UPDATE;` — guaranteeing strict row-level serializability and eliminating race conditions.
  2. **Short-Term Burst Guard:** Counts tenant transactions in the last 60 seconds (`requested_at >= NOW() - INTERVAL '1 minute'`). Returns `RATE_LIMIT_EXCEEDED` if requests >= `short_term_rate_limit` (5/min).
  3. **Daily Tenant Limit:** Counts tenant requests in the last 24 hours with statuses `('reserved', 'success', 'failed')`. Returns `DAILY_QUOTA_EXCEEDED` if requests >= `daily_request_limit` (3/day default).
  4. **Monthly Tenant Limit:** Counts tenant requests in the last 30 days. Returns `MONTHLY_QUOTA_EXCEEDED` if requests >= `monthly_request_limit` (90/month default).
  5. **Platform Kill Switches & Caps:** Evaluates global 24h count, global 30d count, and global 30d cumulative expenditure (`SUM(estimated_cost)` >= `global_monthly_cost_cap`).
  6. **Reservation Ledger Row:** Atomically inserts a new row into `ai_usage_ledger` with `status = 'reserved'` and returns `{ "allowed": true, "ledger_id": ..., "usage": ... }`.
* **Database Quota Assessment:** The current live database fully and directly supports the atomic multi-tenant quota enforcement claimed by Phase 10.

---

## 2. AI-001 / AI-002 Identifier Consistency Forensic Audit

A cross-document comparison was conducted across the 5 Phase 10 artifacts:

1. `audit/phase-10-audit-report.md` (Original Audit)
2. `audit/phase-10-implementation-plan.md` (Implementation Plan)
3. `audit/phase-10-task.md` (Remediation Tasks)
4. `audit/phase-10-implementation-report.md` (Implementation Report)
5. `audit/phase-10-post-implementation-verification.md` (Initial Post-Verification Report)

### 2.1 The Original Definitions (`phase-10-audit-report.md`)

* **FINDING-AI-001 (Severity: HIGH):**
  - **Title:** `Quota Enforcement / In-Memory Rate Limit Bypass`
  - **Location:** `src/lib/ai-gateway.ts:59-100` (`memoryTenantSettings`)
  - **Issue:** Serverless cold starts reset memory Maps, enabling unmetered quota bypass.
* **FINDING-AI-002 (Severity: MEDIUM):**
  - **Title:** `Configuration Drift / AI Pricing Model Mismatch`
  - **Location:** `src/lib/ai-gateway.ts:5-10` & `ai-invoice-scan/route.ts:148` (`calculateGeminiCost` & `GEMINI_PRICING`)
  - **Issue:** Code requested `gemini-3.5-flash-lite`, but `GEMINI_PRICING` used placeholder `gemini-1.5-flash` rates.
* **FINDING-AI-003 (Severity: MEDIUM):**
  - **Title:** `Memory Allocation / Unbounded Base64 Image Upload`
  - **Location:** `src/app/api/ai-invoice-scan/route.ts:109-110`
  - **Issue:** No maximum file size ceiling on uploaded images before reading into memory buffers.

### 2.2 Finding Cross-Reference Table

| Document | AI-001 Reference | AI-002 Reference | Consistent with Audit? |
| :--- | :--- | :--- | :--- |
| `phase-10-audit-report.md` | In-Memory Rate Limit Bypass (HIGH) | Pricing Model Drift (MEDIUM) | **BASELINE** |
| `phase-10-implementation-plan.md` | In-Memory Rate Limit Bypass (HIGH) | Gemini Model Pricing Mismatch (MEDIUM) | **YES** |
| `phase-10-task.md` | In-Memory Rate Limit Bypass (HIGH) | Pricing Mismatch & Model Card Sync (MEDIUM) | **YES** |
| `phase-10-implementation-report.md` | In-Memory Rate Limit Bypass (HIGH) | Pricing Model Synchronization (MEDIUM) | **YES** |
| `phase-10-post-implementation-verification.md` (v1) | **Model Version & Token Cost Alignment** | **In-Memory Quota Bypass** | ❌ **DOCUMENTATION CONTRADICTION (SWAPPED)** |

### 2.3 Identification of Documentation Contradictions

1. **Identifier Swap in Post-Implementation Verification Report:**
   The initial post-implementation verification report accidentally inverted the IDs:
   - It labeled AI-001 as "Model Version & Token Cost Alignment".
   - It labeled AI-002 as "In-Memory Quota Bypass / Fail-Open Vulnerability".
   *Correction:* In the authoritative audit and implementation plan, **AI-001 is In-Memory Quota Bypass** and **AI-002 is Model Pricing Alignment**.

2. **Model Version & Pricing Value Contradiction:**
   - The initial post-implementation report erroneously cited `gemini-2.5-flash-lite` at `$0.10 input / $0.40 output`.
   - Inspection of active source code (`src/lib/ai-gateway.ts:5-10`), database schema (`public.reserve_ai_usage` default argument `'gemini-3.5-flash-lite'`), and the implementation report confirms the real configuration is:
     - **Primary Model:** `gemini-3.5-flash-lite`
     - **Pricing:** `$0.30` input / `$2.50` output per 1 Million tokens.

---

## 3. Final Categorized Verdict

| Item / Finding | Final Status | Evidence / Notes |
| :--- | :--- | :--- |
| **FINDING-AI-001** (In-Memory Quota Bypass) | **VERIFIED RESOLVED** | Verified in `ai-gateway.ts:205-215`: in production, DB reservation failure throws `AI_GATEWAY_UNAVAILABLE` (fail-closed). Dev mode bounds memory ledger. |
| **FINDING-AI-002** (Model Pricing Mismatch) | **VERIFIED RESOLVED** | Verified in `ai-gateway.ts:5-10`: `GEMINI_PRICING` maps `gemini-3.5-flash-lite` at $0.30 / $2.50 per 1M tokens. Live DB RPC defaults to `gemini-3.5-flash-lite`. |
| **FINDING-AI-003** (Unbounded 5MB Upload) | **VERIFIED RESOLVED** | Verified in `route.ts:110-130` and `AiInvoiceScan.tsx:250-270`: 5MB hard limit enforced before memory buffer allocation. |
| **Live Database Verification** | **VERIFIED IN LIVE DATABASE** | All 4 required production objects (`global_ai_settings`, `tenant_ai_settings`, `ai_usage_ledger`, `reserve_ai_usage`) exist, have RLS enabled, and execute row-level `FOR UPDATE` locking. Monolithic `ai_usage_settings` correctly replaced by split table schema. |
| **Documentation Consistency** | **DOCUMENTATION CONTRADICTION** | Swap between AI-001 and AI-002 in initial post-implementation verification report has been forensically documented and corrected in this report. Baseline audit remains intact. |
