# PHASE 10 IMPLEMENTATION PLAN — AI GATEWAY & SCANNER REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 10 — AI Invoice Scanner & Token Usage Gateway Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 3 AI gateway in-memory quota fallback, model pricing key mismatch, and un-capped image payload defects identified in the Phase 10 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 1: High Severity Quota & Cost Control Fixes

#### Task 10.1: Database-Backed AI Quota Enforcement (FINDING-AI-001)
- **Target File:** `src/lib/ai-gateway.ts`
- **Actions:**
  1. Require successful database quota verification from `ai_usage_ledger` or `ai_usage_settings` before dispatching requests to Gemini API.
  2. Fail closed (return 429 Too Many Requests) if quota verification query fails, eliminating in-memory state bypass.

---

### Priority 2: Medium Severity Pricing & Memory Fixes

#### Task 10.2: Align Gemini Model Pricing Keys (FINDING-AI-002)
- **Target File:** `src/lib/ai-gateway.ts`
- **Actions:**
  1. Synchronize `GEMINI_PRICING` dictionary keys with official Google Gemini API model identifier strings.

#### Task 10.3: Enforce Image Upload Size Ceiling (FINDING-AI-003)
- **Target File:** `src/app/api/ai-invoice-scan/route.ts`
- **Actions:**
  1. Validate image file size before invoking `file.arrayBuffer()`, rejecting uploads exceeding 5MB with HTTP 400 Bad Request.
