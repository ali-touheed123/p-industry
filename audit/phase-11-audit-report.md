# PHASE 11 REPORT — THERMAL PRINTING & TEMPLATE ENGINE FORENSIC AUDIT

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 11 — Thermal Printing & Thermal Template Engine Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

---

## 1. Scope

Comprehensive forensic audit of the ESC/POS thermal receipt printing architecture, hidden iframe printing mechanics, thermal canvas statement generator, receipt template customization engine, and tenant template assignment API:
- Hidden Iframe Printer Utility (`src/utils/iframePrint.ts`)
- Thermal Receipt Canvas Generator (`src/utils/receiptCanvas.ts`)
- Receipt Template Master API (`src/app/api/receipt-templates/route.ts`)
- Template Tenant Assignment API (`src/app/api/receipt-templates/assign/route.ts`)
- Thermal HTML Building in POS (`src/components/PosBilling.tsx:109-195`)

---

## 2. Files Inspected

- [src/utils/iframePrint.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/utils/iframePrint.ts) (100 lines) — Non-modal hidden iframe creation, print dialog invocation, DOM cleanup handlers
- [src/utils/receiptCanvas.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/utils/receiptCanvas.ts) (210 lines) — Canvas 2D image generator for WhatsApp ledger statement sharing
- [src/app/api/receipt-templates/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/route.ts) (198 lines) — Template CRUD master API, default template seeding
- [src/app/api/receipt-templates/assign/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/assign/route.ts) (197 lines) — Template assignment to branches & tenants
- [src/types/receipt.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/types/receipt.ts) (95 lines) — Thermal receipt template JSON schema and defaults

---

## 3. Database Objects Inspected

- `public.receipt_templates` (`id`, `name`, `description`, `paper_size`, `template_json`, `is_default`, `is_deleted`)
- `public.tenant_receipt_templates` (`id`, `tenant_id`, `template_id`)

---

## 4. Thermal Printing Module Audit Matrix

| Component / Utility | Role / Functionality | Browser Compatibility | Concurrency & Atomicity | Paper Size Adaptation |
|---|---|---|---|---|
| `iframePrint.ts` | Hidden Iframe Renderer | ✅ Bypass popup blocker | N/A (DOM Sync) | ✅ 80mm ESC/POS CSS reset |
| `receiptCanvas.ts` | WhatsApp Canvas Generator | ✅ Cross-browser PNG blob | N/A (Client Canvas) | ⚠️ **MEDIUM (Fixed 600px width)** |
| `receipt-templates/route.ts` | Template CRUD | ✅ Authoritative JSON | 🚨 **HIGH (Non-atomic default reset)** | ✅ 80mm & 58mm schema support |
| `receipt-templates/assign` | Tenant Template Assignment | ✅ Tenant-scoped | ✅ Single insert/update | N/A |

---

## 5. Verified Correct (Thermal Printing Strengths)

1. **Popup-Blocker Bypass via Hidden Iframe (`printViaIframe`):**
   - `iframePrint.ts:13-66` creates a hidden DOM iframe (`position: fixed; top: -10000px`) and writes HTML content directly to `iframe.contentWindow.document`. Synchronous `print()` calls inside the iframe window context avoid browser popup block rules triggered by post-fetch async code during POS checkout.
2. **Flexible Thermal Template Customization Schema:**
   - `DEFAULT_TEMPLATE_JSON` in `src/types/receipt.ts` supports dynamic header logos, store titles, tax registration numbers, item code toggles, shade display options, split payment breakdowns, and custom WhatsApp footer notes.

---

## 6. Detailed Findings

### FINDING-PRINT-001
- **Severity:** HIGH
- **Category:** Transaction Isolation / Non-Atomic Default Template Reset
- **Location:** [src/app/api/receipt-templates/route.ts:86-91](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/route.ts#L86-L91) & [L133-L138](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/receipt-templates/route.ts#L133-L138)
- **Component:** `POST` & `PATCH /api/receipt-templates`
- **Evidence:**
  ```typescript
  if (is_default) {
    await supabaseAdmin
      .from('receipt_templates')
      .update({ is_default: false })
      .neq('id', id);
  }
  ```
- **Actual Behavior:** When setting a template as default, the code resets `is_default = false` on all other templates in an un-isolated initial query. If the subsequent insert/update fails, all templates remain marked `is_default = false`.
- **Expected Behavior:** Execute default template switching inside a single database transaction or procedure.
- **Impact:** System left with zero default receipt templates if template update fails.
- **Verification Status:** VERIFIED

---

### FINDING-PRINT-002
- **Severity:** MEDIUM
- **Category:** Layout Math / Fixed Width Canvas Assumption
- **Location:** [src/utils/receiptCanvas.ts:35-45](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/utils/receiptCanvas.ts#L35-L45)
- **Component:** `receiptCanvas.ts`
- **Evidence:** Canvas width is hardcoded to 600px (`canvas.width = 600`) without adapting for 58mm mobile thermal printers vs 80mm counter printers.
- **Actual Behavior:** Statement images generated for 58mm mobile handheld printers clip text or wrap lines unnaturally.
- **Expected Behavior:** Adapt canvas width dynamically based on target `paper_size` parameter.
- **Impact:** Text clipping on 58mm handheld receipt statement images.
- **Verification Status:** VERIFIED

---

### FINDING-PRINT-003
- **Severity:** LOW
- **Category:** Browser Lifecycle / Premature Iframe Detachment
- **Location:** [src/utils/iframePrint.ts:57-61](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/utils/iframePrint.ts#L57-L61)
- **Component:** `iframePrint.ts`
- **Evidence:** Safety cleanup timer detaches iframe after 3,000ms (`setTimeout(..., 3000)`).
- **Actual Behavior:** If a cashier takes longer than 3 seconds to select a printer in the browser print dialog, the iframe is removed from the DOM mid-dialog.
- **Expected Behavior:** Extend safety timeout to 30 seconds and clear timeout handle when `afterprint` fires.
- **Impact:** Print dialog cancellation if cashier is slow to respond.
- **Verification Status:** VERIFIED

---

## 7. Recommended Remediation Order

1. **P1 (HIGH):** Wrap default template resets in atomic database transaction (FINDING-PRINT-001).
2. **P2 (MEDIUM):** Add dynamic canvas width scaling for 58mm paper size in `receiptCanvas.ts` (FINDING-PRINT-002).
3. **P3 (LOW):** Extend safety timeout to 30s in `iframePrint.ts` (FINDING-PRINT-003).
