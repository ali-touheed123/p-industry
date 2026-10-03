# PHASE 13 IMPLEMENTATION PLAN — MASTER CROSS-MODULE REMEDIATION ROADMAP

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 13 — Final Cross-Module Reconciliation Forensic Audit  

---

## 1. Overview

This document consolidates all 8 verified findings from Phases 1 through 12 into a single, prioritized Master Implementation Plan. Implementation is grouped into 3 structured execution waves based on risk, severity, and system dependency order.

---

## 2. Master Execution Waves

### WAVE 1: Critical Security & Transaction Isolation (P1 - Urgent)

#### Task 13.1: Atomic Supplier Purchase RPC (`create_purchase_atomic`)
- **Problem:** Purchase creation, stock increment, supplier balance update, and token status updates execute in non-atomic separate HTTP/DB calls (MF-001).
- **Target Files:** Supabase Migrations, `src/app/api/purchases/route.ts`
- **Solution:** Implement `create_purchase_atomic` PL/pgSQL function wrapping header insertion, item insertion, stock modification, and token status updates in one transaction.

#### Task 13.2: Record Ownership Filter Enforcement for Client/Supplier IDOR
- **Problem:** `PATCH /api/clients` and `PATCH /api/suppliers` verify caller tenant but do not verify that target record ID belongs to caller tenant (MF-002).
- **Target Files:** `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`
- **Solution:** Add `.eq('tenant_id', tenantId)` to all `PATCH` and `DELETE` queries in client and supplier routes.

#### Task 13.3: Atomic Token Redemption RPC (`redeem_tokens_atomic`)
- **Problem:** Non-atomic read-then-write sequence on token balance redemption allows double-redemption race conditions (MF-003).
- **Target Files:** Supabase Migrations, `src/app/api/token-redemptions/route.ts`
- **Solution:** Implement `redeem_tokens_atomic` RPC to atomically validate and deduct client token balance with `FOR UPDATE` lock.

---

### WAVE 2: Operational & Business Logic Integrity (P2 - High/Medium)

#### Task 13.4: Atomic Default Receipt Template Switching
- **Problem:** `is_default` reset occurs in un-isolated query prior to template update (MF-004).
- **Target Files:** `src/app/api/receipt-templates/route.ts`
- **Solution:** Wrap default template toggle in single atomic transaction or database procedure.

#### Task 13.5: Shift Scoping for Supplier Cash Purchases
- **Problem:** Shift reconciliation queries supplier purchases by timestamp range `.gte('created_at', startTime)` instead of explicit `shift_id` (MF-005).
- **Target Files:** Supabase Migrations, `src/app/api/purchases/route.ts`, `src/app/api/shifts/route.ts`
- **Solution:** Add `shift_id` column to `purchases` table and filter shift cash purchases by `shift_id`.

---

### WAVE 3: Thermal Printing & User Experience Polish (P3 - Low)

#### Task 13.6: Dynamic Canvas Paper Width Scaling for Thermal Receipts
- **Problem:** WhatsApp receipt canvas uses fixed 600px width causing bad wrapping on 58mm mobile slips (MF-006).
- **Target Files:** `src/utils/receiptCanvas.ts`
- **Solution:** Scale canvas width dynamically based on paper size parameter (576px for 80mm, 384px for 58mm).

#### Task 13.7: Extend Safety Timeout in Hidden Iframe Printer
- **Problem:** 3-second iframe cleanup timer detaches iframe mid-dialog if cashier is slow (MF-007).
- **Target Files:** `src/utils/iframePrint.ts`
- **Solution:** Extend safety cleanup timer from 3s to 30s.

#### Task 13.8: Walk-In Customer Token Claim Receipt Generation
- **Problem:** Walk-in customers retaining physical tokens receive no claim code or receipt slip (MF-008).
- **Target Files:** `src/components/PosBilling.tsx`
- **Solution:** Generate unique serial claim code and render token slip block on POS thermal receipt for walk-in token retention.
