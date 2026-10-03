# PHASE 10 AUDIT TASK LIST — AI GATEWAY & SCANNER REMEDIATION

- [ ] **Task 10.1: Database-Backed AI Quota Enforcement** (FINDING-AI-001)
  - [ ] Enforce database-backed daily request cap verification in `src/lib/ai-gateway.ts`.
  - [ ] Fail closed on quota check failure to prevent in-memory rate limit bypass.

- [ ] **Task 10.2: Align Gemini Model Pricing Keys** (FINDING-AI-002)
  - [ ] Update `GEMINI_PRICING` model keys in `src/lib/ai-gateway.ts` to match active API model strings.

- [ ] **Task 10.3: Enforce Image Upload Size Ceiling** (FINDING-AI-003)
  - [ ] Add 5MB file size limit check in `src/app/api/ai-invoice-scan/route.ts`.
