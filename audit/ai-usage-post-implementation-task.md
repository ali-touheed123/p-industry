# Task Checklist: AI Usage System Post-Audit Enhancements

- [/] **Audit Phase**
  - [x] Independent code and database audit completed
  - [x] Per-shop quotas verified (3 daily, 90 monthly, rolling windows)
  - [x] Usage accounting rules verified (1 request = 1 usage, failures count, pre-rejections 0)
  - [x] Server-side rate limiting verified (5 req/min/shop)
  - [x] Global protections and emergency kill switch verified
  - [x] Model fallback behavior investigated and documented
  - [x] Multi-tenant isolation and security verified
  - [x] UI exposure and error handling verified
  - [x] Generated `audit/ai-usage-post-implementation-audit.md`
  - [x] Generated `audit/ai-usage-post-implementation-plan.md`

- [ ] **Optional Enhancements Phase (Pending User Request)**
  - [ ] Add in-memory global 24h/30d cap calculations in `src/lib/ai-gateway.ts`
  - [ ] Add optional `allowFallback?: boolean` parameter to `AiUsageRequest`
  - [ ] Run full test suite to re-verify
