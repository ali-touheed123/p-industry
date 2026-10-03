# Post-Implementation Optimization Plan: AI Usage Control System

## 1. Overview
This plan outlines optional architectural enhancements identified during the post-implementation audit of the Centralized AI Usage & Gemini Invoice Scanning Control System.

## 2. Identified Enhancement Items

### Item 1: In-Memory Global Cap Check Symmetry
- **Current State:** The SQL RPC `reserve_ai_usage` enforces `global_daily_request_cap`, `global_monthly_request_cap`, and `global_monthly_cost_cap`. The in-memory fallback checks `ai_enabled` and per-tenant daily/monthly limits.
- **Enhancement:** Add rolling 24h count, 30d count, and 30d cost cap checks to the in-memory reservation path in `ai-gateway.ts` for parity when running in pure memory mode.

### Item 2: Configurable Model Fallback Flag
- **Current State:** Automatic fallback cycles through `[preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash']`.
- **Enhancement:** Allow passing `allowFallback: boolean` (default `true`) in `AiUsageRequest` so callers can optionally enforce strict single-model execution if desired.

## 3. Implementation Steps (When authorized)
1. Update `reserveQuota` in `src/lib/ai-gateway.ts` to compute global 24h/30d metrics across `memoryLedger` in fallback mode.
2. Add `allowFallback` property to `AiUsageRequest` interface.
3. Verify test suite.
