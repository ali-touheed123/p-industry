# Task Tracking: Sales Invoice & WhatsApp Enhancements

- [x] **Task 1: Customer Last Purchase Price Detection in POS Billing**
  - [x] Fetch and index previous purchase prices per product when a registered customer is selected
  - [x] Display "Last Purchased: Rs. X (Date)" indicator in the product autocomplete suggestions
  - [x] Display an informative notification/badge before adding product, showing last charged price vs current retail price
  - [x] Allow 1-click option to apply the customer's previous purchase rate

- [x] **Task 2: Keyboard Navigation (Arrow Keys + Enter) for Product & Customer Suggestions**
  - [x] Enable `ArrowUp` and `ArrowDown` navigation in product suggestions dropdown
  - [x] Support `Enter` key to select the highlighted product and add/populate
  - [x] Enable `ArrowUp` and `ArrowDown` navigation in customer search/directory list
  - [x] Support `Enter` key to select the highlighted customer, close modal, and auto-focus product search input
  - [x] Add visual highlight styling and automatic scroll-into-view for focused items

- [x] **Task 3: WhatsApp Receipt Sharing (Registered Customers Only + Image Format)**
  - [x] Restrict "Share on WhatsApp" action in Sales History to registered customers only (hide/disable for Walk-in)
  - [x] Restrict WhatsApp share in the Invoice Detail Modal to registered customers only
  - [x] Implement `src/utils/receiptCanvas.ts` for pixel-perfect thermal receipt image generation (PNG Blob)
  - [x] Provide 1-click WhatsApp Image sharing via Web Share API (mobile/compatible browsers) with fallback to clipboard copy (paste directly in WhatsApp Web chat) and image download
  - [x] Automatically route to registered customer's phone number on WhatsApp

- [x] **Task 4: Fix Token Balance Auto-Sync & Cash Payment Recalculation**
  - [x] Fix cash auto-sync so when customer Token Balance is applied, default Cash payment automatically reduces to `netTotal - appliedTokenAmount`
  - [x] Ensure toggling bucket token (`Keep` vs `Remove`) instantly recalculates `cashPayment` so `Cash + Token = Net Total`
  - [x] Clamp `appliedTokenAmount` to `Math.min(netTotal, tokenBalance)` so token application never exceeds net bill total
  - [x] Restoring or removing applied token re-expands Cash payment to full bill amount

- [x] **Task 5: Inline Editable Product Name, Shade & Code with Inventory Audit Preservation**
  - [x] Make Product Code, Product Name, and Shade directly editable inline in the POS line-items table
  - [x] Customer receipts (thermal print & WhatsApp image) print ONLY the edited details (clean, professional, no "edited" marks)
  - [x] Underlying `item_id` remains linked so warehouse stock deduction targets the correct catalog item
  - [x] Store original catalog code/name/shade in invoice items record for shop owner internal audit tracking

- [x] **Task 6: Prominent Shade & Code Display on Thermal Receipts, Invoices & WhatsApp Images**
  - [x] Include Shade code/name and Product Code prominently on POS thermal print slip
  - [x] Include Shade code/name and Product Code in Sales History thermal print modal and invoice detail preview
  - [x] Include Shade code/name and Product Code in WhatsApp receipt image rendering and text summary

- [x] **Task 7: Itemized Customer/Supplier Khata Breakdown & WhatsApp Statement Image**
  - [x] Add expandable drill-down `▼` on invoice rows in Financial Ledgers to view purchased items, shades, qty, and rates inline
  - [x] Implement canvas-based Account Statement Image generator (`generateLedgerStatementBlob`) with store branding, date-wise bills & items, payments, and net balance
  - [x] Restrict WhatsApp Statement sharing to registered parties with valid contact
  - [x] Dispatch statement as an image (native share / clipboard copy + WhatsApp Web chat with client's phone) with zero database storage overhead


