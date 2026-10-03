# PHASE 11 AUDIT TASK LIST — THERMAL PRINTING REMEDIATION

- [ ] **Task 11.1: Atomic Default Template Switching** (FINDING-PRINT-001)
  - [ ] Wrap `is_default` reset in single transaction block in `src/app/api/receipt-templates/route.ts`.

- [ ] **Task 11.2: Dynamic Canvas Paper Width Scaling** (FINDING-PRINT-002)
  - [ ] Support paper size dynamic scaling in `src/utils/receiptCanvas.ts`.

- [ ] **Task 11.3: Extend Safety Timeout in Hidden Iframe Printer** (FINDING-PRINT-003)
  - [ ] Extend iframe cleanup timer from 3s to 30s in `src/utils/iframePrint.ts`.
