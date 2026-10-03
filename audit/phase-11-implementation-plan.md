# PHASE 11 IMPLEMENTATION PLAN — THERMAL PRINTING REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 11 — Thermal Printing & Thermal Template Engine Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 3 default template reset atomicity, canvas image layout width, and iframe detachment race condition defects identified in the Phase 11 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 1: High Severity Atomicity Fixes

#### Task 11.1: Atomic Default Template Switching (FINDING-PRINT-001)
- **Target File:** `src/app/api/receipt-templates/route.ts`
- **Actions:**
  1. Wrap `is_default` resetting and template update/insert in a single atomic database query or stored procedure.

---

### Priority 2: Medium Severity Layout & Lifecycle Fixes

#### Task 11.2: Dynamic Canvas Paper Width Scaling (FINDING-PRINT-002)
- **Target File:** `src/utils/receiptCanvas.ts`
- **Actions:**
  1. Scale canvas width dynamically based on paper size parameter (576px for 80mm, 384px for 58mm).

#### Task 11.3: Extend Safety Timeout in Hidden Iframe Printer (FINDING-PRINT-003)
- **Target File:** `src/utils/iframePrint.ts`
- **Actions:**
  1. Extend safety cleanup timeout from 3 seconds to 30 seconds to support slow printer device selection in browser print dialog.
