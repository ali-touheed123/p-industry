# PHASE 10 REPORT — AI INVOICE SCANNER & GATEWAY FORENSIC AUDIT

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 10 — AI Invoice Scanner & Token Usage Gateway Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

---

## 1. Scope

Comprehensive forensic audit of the Google Gemini Vision AI invoice scanning integration, central AI usage gateway, rate limiting & daily quota enforcement, token cost accounting, and supplier/item matching engine:
- Central AI Gateway Manager (`src/lib/ai-gateway.ts`)
- AI Invoice Scan API Route Handler (`src/app/api/ai-invoice-scan/route.ts`)
- AI Invoice Scanner Frontend Modal (`src/components/AiInvoiceScan.tsx`)

---

## 2. Files Inspected

- [src/lib/ai-gateway.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/lib/ai-gateway.ts) (565 lines) — Central AI gateway manager, Gemini pricing rates, quota verification, in-memory fallback state, token cost calculator
- [src/app/api/ai-invoice-scan/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/ai-invoice-scan/route.ts) (343 lines) — Base64 image payload processing, Gemini Vision prompt engineering, supplier fuzzy matching, item SKU similarity matching
- [src/components/AiInvoiceScan.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/AiInvoiceScan.tsx) (1,200 lines) — Scanner camera/upload UI modal, parsed invoice pre-fill preview

---

## 3. Database Objects Inspected

- `public.ai_usage_settings` (`id`, `ai_enabled`, `global_daily_request_cap`, `global_monthly_request_cap`)
- `public.ai_usage_ledger` (`id`, `request_id`, `tenant_id`, `feature`, `provider`, `model`, `status`, `input_tokens`, `output_tokens`, `estimated_cost`)
- Stored Procedure: `reserve_ai_usage`

---

## 4. AI Gateway Module Audit Matrix

| Component / Endpoint | Functionality | Tenant Scoping | Quota Enforcement | Pricing & Cost Accounting |
|---|---|---|---|---|
| `ai-gateway.ts` | Central Gateway Core | ✅ Bound via `tenantId` | ⚠️ **HIGH (In-memory fallback bypass)** | ⚠️ **MEDIUM (Model pricing key mismatch)** |
| `GET /api/ai-invoice-scan` | Quota Status Query | ✅ Bound via session | N/A (Read) | N/A |
| `POST /api/ai-invoice-scan` | Vision Scan & Parse | ✅ Bound via session | ✅ Enforced via Gateway | ⚠️ **MEDIUM (Unbounded image buffer size)** |

---

## 5. Verified Correct (AI Gateway Strengths)

1. **Centralized Provider Encapsulation:**
   - `@google/generative-ai` SDK is imported exclusively inside `src/lib/ai-gateway.ts`. Route handlers do not instantiate direct SDK clients or leak provider secrets.
2. **Robust Multi-Level Word Similarity Matching:**
   - `ai-invoice-scan/route.ts:35-54` implements word token overlap similarity (`calculateWordSimilarity`) to match raw AI-extracted Urdu/English paint shade names against database inventory items.
3. **Structured JSON Extraction Prompt:**
   - Prompt engineering in `ai-invoice-scan/route.ts:113-141` forces Gemini Vision to output raw, structured JSON matching a strict schema for subtotal, net total, supplier details, and item arrays.

---

## 6. Detailed Findings

### FINDING-AI-001
- **Severity:** HIGH
- **Category:** Quota Enforcement / In-Memory Rate Limit Bypass
- **Location:** [src/lib/ai-gateway.ts:59-100](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/lib/ai-gateway.ts#L59-L100)
- **Component:** `src/lib/ai-gateway.ts` (`memoryTenantSettings`)
- **Evidence:**
  `ai-gateway.ts` defines `memoryTenantSettings` as a Node.js `Map` object used when database ledger tables return errors or during fallback execution.
- **Actual Behavior:** In serverless or multi-instance environments (e.g., Vercel / Next.js serverless functions), in-memory rate-limiting state resets on every container restart or cold start, enabling users to bypass daily scan caps.
- **Expected Behavior:** Enforce daily AI request quotas strictly via database rows or Redis with atomic counter increments.
- **Impact:** Potential API quota abuse and unexpected Google Gemini billings.
- **Verification Status:** VERIFIED

---

### FINDING-AI-002
- **Severity:** MEDIUM
- **Category:** Configuration Drift / AI Pricing Model Mismatch
- **Location:** [src/lib/ai-gateway.ts:5-10](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/lib/ai-gateway.ts#L5-L10) & `ai-invoice-scan/route.ts:148`
- **Component:** `calculateGeminiCost` & `GEMINI_PRICING`
- **Evidence:**
  `ai-invoice-scan/route.ts` requests `preferredModel: 'gemini-3.5-flash-lite'`. However, `GEMINI_PRICING` uses static rates for `gemini-1.5-flash`, causing `calculateGeminiCost` to fall back to default pricing rates.
- **Actual Behavior:** Discrepancy between actual Google API cost rates and the estimated cost logged in `ai_usage_ledger`.
- **Expected Behavior:** Align `GEMINI_PRICING` model keys with exact Google Gemini API model strings.
- **Impact:** Inaccurate financial ledger tracking of AI API costs.
- **Verification Status:** VERIFIED

---

### FINDING-AI-003
- **Severity:** MEDIUM
- **Category:** Memory Allocation / Unbounded Base64 Image Upload
- **Location:** [src/app/api/ai-invoice-scan/route.ts:109-110](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/ai-invoice-scan/route.ts#L109-L110)
- **Component:** `POST /api/ai-invoice-scan`
- **Evidence:**
  ```typescript
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  ```
- **Actual Behavior:** Large image uploads (15MB+ camera photos) are read directly into Node.js memory buffers without maximum file size validation.
- **Expected Behavior:** Enforce a strict 5MB file size ceiling before allocating array buffers.
- **Impact:** Memory spike and potential process crashes during high-resolution image uploads.
- **Verification Status:** VERIFIED

---

## 7. Recommended Remediation Order

1. **P1 (HIGH):** Enforce daily AI scan limits strictly via database state in `ai-gateway.ts` (FINDING-AI-001).
2. **P2 (MEDIUM):** Align Gemini model pricing keys in `GEMINI_PRICING` (FINDING-AI-002).
3. **P2 (MEDIUM):** Add 5MB file size limit check in `ai-invoice-scan/route.ts:108` (FINDING-AI-003).
