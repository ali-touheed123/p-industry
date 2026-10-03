# Phase 1 — AI Usage Current-State Audit

**Project:** PyntFlow (Paint & Hardware ERP)  
**Date:** October 3, 2026  
**Document:** `ai-usage-current-state.md`  

---

## 1. Executive Summary

This audit assesses the current state of AI features, Gemini API integration, tenant authentication, database schema, rate limiting, and Dev Panel architecture within PyntFlow. 

Currently, Gemini API calls are made directly inside feature-specific API endpoints without a centralized gateway, quota enforcement, concurrency control, or usage logging. 

Phase 1 completes the initial audit requirement outlined in Section 28 of the PyntFlow Centralized AI Usage Specification.

---

## 2. Audit Findings

### 2.1 Gemini API Integration & Model Usage
- **Primary Endpoint:** `src/app/api/ai-invoice-scan/route.ts`
- **Library:** `@google/generative-ai` (`GoogleGenerativeAI` SDK v0.24+)
- **API Key Management:** Loaded server-side via `process.env.GEMINI_API_KEY`. Not exposed to browser or client code.
- **Model Fallback Chain:**
  1. `gemini-3.5-flash-lite` (attempted first)
  2. `gemini-2.0-flash` (fallback 1)
  3. `gemini-1.5-flash` (fallback 2)
- **Token & Cost Data:** Gemini API returns `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`), but the current endpoint ignores this data entirely. No token usage or cost metrics are currently logged or calculated.

### 2.2 Invoice Scanner Implementation
- **UI Components:** `src/components/AiInvoiceScan.tsx` embedded in `PurchasesView.tsx` and `StockInventory.tsx`.
- **Request Flow:** User uploads invoice image -> FormData sent to `POST /api/ai-invoice-scan` with `tenant_id` and image `File`.
- **UI State:** Displays extraction progress, matched suppliers, and matched items.
- **Missing Quota Feedback:** Does not inform the shop of daily/monthly remaining scans, nor does it handle quota rejection codes (`AI_SCAN_LIMIT_REACHED`).

### 2.3 AI-Related Routes
- Currently, `/api/ai-invoice-scan/route.ts` is the **only** AI endpoint in the application.
- No central routing, gateway wrapper, or middleware exists for AI operations.
- Direct model invocation is performed within the route handler.

### 2.4 Tenant Authentication & Resolution
- Endpoint uses `requireTenantAuth(req, tenantId)` from `src/lib/session.ts`.
- Validates user identity and tenant scope from JWT/Session cookies.
- Prevents unauthenticated requests, but does not enforce tenant-level AI quotas or feature flags.

### 2.5 Supabase Database Schema
- **Existing Tables:** `tenants`, `users`, `items`, `suppliers`, `invoices`, `held_invoices`, `receipt_templates`, `paint_token_configs`, `paint_token_ledgers`, `paint_token_claims`, `paint_vouchers`.
- **Missing AI Tables:**
  - No per-tenant AI config table (`tenant_ai_settings`).
  - No global AI config table (`global_ai_settings`).
  - No immutable AI usage ledger table (`ai_usage_ledger`).
  - No stored procedures / SQL functions for atomic usage reservation (`reserve_ai_usage`).

### 2.6 Rate Limiting & Concurrency Controls
- **Rate Limiting:** Non-existent. Any shop can send unlimited requests up to Vercel/Gemini API limits.
- **Quota Windows:** No rolling 24-hour or rolling 30-day usage calculation.
- **Concurrency Protection:** No atomic reservation or locks. Concurrent requests could freely oversubscribe if quotas existed.

### 2.7 Environment Configuration
- `.env.local` configured with:
  - `GEMINI_API_KEY` (Server-only)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Complies with security constraint: credentials remain strictly server-side.

### 2.8 Dev Panel Architecture
- **Route:** `/dev` (`src/app/dev/page.tsx`) -> `AuraDevPanel` (`src/components/dev-panel/AuraDevPanel.tsx`).
- **Security:** PIN authentication via `/api/auth/dev-pin` returning session cookie & token (`aura_dev_auth`).
- **Current Tabs (`DevActiveTab`):**
  - `overview` (`DevOverviewView.tsx`)
  - `branches` (`DevBranchesView.tsx`)
  - `users` (`DevUsersView.tsx`)
  - `receipt-templates` (`DevReceiptTemplatesView.tsx`)
- **Missing AI Control Center:** No UI or API routes exist in Dev Panel to manage global AI settings, tenant quotas, view usage analytics, or inspect request ledgers.

---

## 3. Current Architecture vs. Intended Architecture

```
[CURRENT ARCHITECTURE]
Invoice Scanner UI -> POST /api/ai-invoice-scan -> Direct Gemini API Call -> Return Response (No Logging/Quota)

[TARGET CENTRALIZED ARCHITECTURE]
Dev Panel (Global/Shop Controls & Analytics)
   │
   ▼
Central AI Gateway (Auth, Tenant, 5 req/min, 24h Quota, 30d Quota, Global Caps, Cost Protection, Atomic Reservation)
   │
   ├── Invoice Scanner (feature: "invoice_scanner")
   └── Future AI Features (feature: "ai_search", "ai_report", etc.)
   │
   ▼
Gemini API Provider (Execution + Token capture)
   │
   ▼
AI Usage Ledger (Immutable request records: tokens, costs, statuses)
```

---

## 4. Audit Conclusion & Next Steps

Phase 1 audit is complete. The system currently lacks AI usage enforcement, gateway abstractions, quota tracking, and developer controls. 

Following the implementation plan:
1. **Phase 2:** Design & execute Supabase database migration for global AI settings, tenant AI limits, usage ledger, and atomic quota reservation logic.
2. **Phase 3:** Build the Central AI Gateway (`src/lib/ai-gateway.ts` / API layer).
3. **Phase 4:** Refactor `src/app/api/ai-invoice-scan/route.ts` to use the Central AI Gateway.
4. **Phase 5:** Implement AI Control Center in Developer Panel (`/dev`).
5. **Phase 6:** Update Shop UI with customer-facing scan balances.
6. **Verification & Testing:** Execute end-to-end automated tests for quota, concurrency, failure, cost, and kill-switch scenarios.
