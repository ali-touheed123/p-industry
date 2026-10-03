# Post-Implementation Audit: Centralized AI Usage & Gemini Invoice Scanning Control System

**Audit Date:** October 3, 2026  
**Auditor:** Independent AI & Security Systems Auditor  
**System Evaluated:** Centralized AI Usage & Gemini Invoice Scanning Control System  
**Codebase Scope:** SQL Migrations, Central AI Gateway (`src/lib/ai-gateway.ts`), Invoice Scan Route (`src/app/api/ai-invoice-scan/route.ts`), Dev Panel AI Control Center (`src/app/api/dev/ai-control/route.ts`, `src/components/dev-panel/DevAiControlView.tsx`), Shop UI (`src/components/AiInvoiceScan.tsx`), and Verification Suite (`scripts/verify-ai-usage-system.ts`).

---

## 1. Executive Summary

An independent, rigorous code and database audit was conducted on the Centralized AI Usage & Gemini Invoice Scanning Control System.

### Audit Verdict: **PASSED (WITH NOTED ARCHITECTURAL BEHAVIORS)**
- **Core Requirements Audited:** 12 / 12 Verified
- **Direct Provider Bypass Leaks:** 0 (100% of AI requests route through `executeCentralAiGateway`)
- **Multi-Tenant Isolation:** Enforced at Database (RLS + Tenant ID), Gateway, and API layer
- **Concurrency Protection:** Atomic `FOR UPDATE` locking in PostgreSQL
- **Security & Authorization:** Role-based dev auth (`requireDevAuth`) & tenant auth (`requireTenantAuth`)

---

## 2. Requirement-by-Requirement Verification Matrix

| # | Requirement | Status | Implementation Details & Evidence |
| :--- | :--- | :---: | :--- |
| **1** | **Default Daily Quota (3 req/24h)** | **PASS** | `20261003_01_centralized_ai_usage_system.sql:28` (`daily_request_limit INT NOT NULL DEFAULT 3`), `ai-gateway.ts:98` |
| **2** | **Default Monthly Quota (90 req/30d)** | **PASS** | `20261003_01_centralized_ai_usage_system.sql:29` (`monthly_request_limit INT NOT NULL DEFAULT 90`), `ai-gateway.ts:98` |
| **3** | **Rolling 24h & 30d Windows** | **PASS** | `20261003_01_centralized_ai_usage_system.sql:90-91` (`v_now - INTERVAL '24 hours'`, `v_now - INTERVAL '30 days'`), `ai-gateway.ts:117-118` |
| **4** | **Dual Exhaustion Blocking** | **PASS** | Requests are rejected with `DAILY_QUOTA_EXCEEDED` or `MONTHLY_QUOTA_EXCEEDED` whenever either limit is met (`20261003_01_centralized_ai_usage_system.sql:163-195`) |
| **5** | **Immediate Limit Updates Without Reset** | **PASS** | Updating limits in `tenant_ai_settings` immediately adjusts available headroom against the immutable ledger (`/api/dev/ai-control/route.ts:190-205`) |
| **6** | **1 Request Initiated = 1 Usage Consumed** | **PASS** | Atomic reservation inserts ledger entry with `'reserved'` prior to Gemini dispatch (`20261003_01_centralized_ai_usage_system.sql:233-251`) |
| **7** | **Gemini Failure/Timeout Still Counts** | **PASS** | `ai-gateway.ts:474-506` updates status to `'failed'`. Both `reserve_ai_usage` and `getShopAiQuota` count `status IN ('reserved', 'success', 'failed')` |
| **8** | **Pre-Gemini Rejection = 0 Usage** | **PASS** | If authorization/quota/rate-limit fails, no reservation occurs and ledger count is untouched (`ai-gateway.ts:406-414`) |
| **9** | **Short-Term Rate Limiting (5 req/min/shop)** | **PASS** | Enforced strictly per `tenant_id` against `requested_at >= NOW() - INTERVAL '1 minute'` (`20261003_01_centralized_ai_usage_system.sql:144-155`) |
| **10** | **Global Request & Cost Protection Caps** | **PASS** | Global daily (1,000), monthly (20,000), and cost cap ($50.00) enforced in SQL RPC (`20261003_01_centralized_ai_usage_system.sql:197-230`) |
| **11** | **Global Emergency Kill Switch** | **PASS** | `global_ai_settings.ai_enabled = false` immediately blocks all gateway requests across all tenants with `GLOBAL_AI_DISABLED` |
| **12** | **Shop UI Real-Time Quota Display** | **PASS** | `AiInvoiceScan.tsx:598-611` displays live badge: `"{quota.remainingDaily} scans remaining today • {quota.remainingMonthly} remaining this period"` |

---

## 3. Deep-Dive Audit: Model Fallback Chain Analysis

### Code Inspection (`src/lib/ai-gateway.ts:419-465`)
```typescript
const candidateModels = [preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(
  (m, idx, arr) => arr.indexOf(m) === idx
);

for (const modelName of candidateModels) {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: req.responseMimeType || 'application/json',
        temperature: req.temperature ?? 0.1,
      },
    });
    ...
    const result = await model.generateContent(contents);
    const response = await result.response;
    ...
    successModel = modelName;
    callSuccess = true;
    break;
  } catch (err: any) {
    lastError = err;
    if (err?.message?.includes('API_KEY_INVALID') || err?.status === 403) {
      break;
    }
  }
}
```

### Specific Audit Inquiries:
1. **Is automatic fallback actually implemented?**  
   **Yes.** The gateway defines a candidate array `[preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash']` and iterates through them sequentially if a prior model fails.
2. **Why/when does it trigger?**  
   It triggers on any exception thrown during model content generation (e.g. Google API 503 Overloaded, 429 Model Rate Limits, transient network socket timeouts). It aborts immediately if the API key itself is invalid.
3. **Can one user scan cause multiple requests?**  
   **Yes.** In transient failure scenarios, up to 3 outbound HTTP calls to Google's API may be attempted.
4. **Is each counted as 1 usage?**  
   **Yes (at the application/tenant ledger level).** Exactly 1 usage reservation is created for the scan request. When a fallback succeeds, the single ledger record is updated with the tokens and pricing of the model that succeeded.
5. **Does it bypass quotas or kill switches?**  
   **No.** Quota authorization, rate limiting, and kill switch evaluations occur **before** the model loop begins.
6. **Architectural Evaluation:**  
   In retail store POS environments, cashiers cannot afford scan failures during peak business hours due to upstream Gemini model outages. The fallback provides high availability. If the primary model succeeds, 0 fallback calls are made.

---

## 4. Security & Data Isolation Audit

1. **Provider Encapsulation:** Ripgrep search confirmed that `@google/generative-ai` is imported and used **strictly** within `src/lib/ai-gateway.ts`. No route or component has direct provider access.
2. **API Route Protection:**  
   - `/api/dev/ai-control` requires `requireDevAuth(req)`.
   - `/api/ai-invoice-scan` requires `requireTenantAuth(req, tenantId)`.
3. **Database Security:**  
   - `global_ai_settings`, `tenant_ai_settings`, and `ai_usage_ledger` have Row Level Security enabled.
   - `reserve_ai_usage` is declared `SECURITY DEFINER` and uses PostgreSQL row-level locks (`FOR UPDATE`).

---

## 5. Token & Cost Accounting Audit

- Rates accurately configured per 1M tokens:
  - `gemini-3.5-flash-lite`: $0.075 input / $0.30 output
  - `gemini-2.0-flash`: $0.10 input / $0.40 output
  - `gemini-1.5-flash`: $0.075 input / $0.30 output
- Cost calculation: `(inputTokens / 1,000,000 * inputPrice) + (outputTokens / 1,000,000 * outputPrice)`.
- Token counts are read directly from `response.usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`) and persisted to `ai_usage_ledger.estimated_cost`.

---

## 6. Audit Conclusion

The Centralized AI Usage & Gemini Invoice Scanning Control System is **thoroughly verified, robust, and compliant** with all specified technical and business constraints.
