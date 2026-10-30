# PYNTFLOW POS — Offline Mode Operation & Manual Verification Guide

> **CRITICAL ENVIRONMENT DIRECTIVE:**  
> All testing must strictly be performed on testing branches:  
> - **Primary Test Shop:** `/example` (Tenant ID: `2a9dbd7e-0c33-462e-adbd-b25083674248`)  
> - **Secondary Sister Branch:** `/example-branch-2` (Tenant ID: `b8064358-b581-4221-ba75-ccdb056d5c00`)  
> ⚠️ **NEVER PERFORM ANY TEST OR WRITE DATA TO `tph` (The Paint House) — THIS IS THE LIVE PRODUCTION SHOP.**

---

## 1. Quick Operator Guide / فوری رہنمائی (Roman Urdu + English)

### 1.1 Internet Jaye To Kya Karein? (What to do during an internet outage)
- **POS chalta rahega:** Internet band ho jaye ya server se rabta toot jaye, counter par sale rukti nahi hai.
- **Header par status dekhein:** Top-right par `Offline Mode` ka red/amber banner show ho jayega.
- **Normal tareeqay se bill banayein:** Cash, Udhaar (Credit), aur Special Receipt sab normal bill ki tarah print honge.
- **Parchi (Receipt):** Customer ko normal receipt print ho kar milegi jisme terminal ka code (maslan `K7F2-0042`) likha hoga. Is par koi "Pending" ya "Kacha" lafz nahi hoga.

### 1.2 Sync Kaise Check Karein? (How to monitor and force sync)
- **Sync Pill:** Header par `☁️ Offline Queue` ka button nazar aayega jisme pending sales ki tadaad show hoti hai (maslan `3 Pending`).
- **Dobara Internet Aane Par:** Sync engine khud-bakhud background mein FIFO (pehlay aao, pehlay sync ho) ke teht database mein saari sales bhej deta hai.
- **Fori Sync (Manual):** `☁️ Offline Queue` par click karein aur **"Sync Now"** dabayein.

### 1.3 "Needs Attention" Kya Hota Hai? (Understanding Poison/Rejected Items)
- Agar koi aisi sale ho jo database ke qawaneen ke khilaf ho (maslan client credit limit exceed ho gayi ho, ya koi invalid data ho), to sync engine baki sales ko nahi rokta.
- Woh item **"Needs Attention"** tab mein chali jaati hai.
- **Istemal ka tareeqa:** Shop Owner / CEO apna password daal kar us sale ko inspect kar saktay hain, dobara retry kar saktay hain, ya online reh kar discard kar saktay hain.

### 1.4 24-Ghantay Ki Session Grace (24-Hour Security Policy)
- Cashier ka logged-in session baghair internet ke **24 ghantay** tak billing kar sakta hai.
- 24 ghantay baad security policy ke teht screen par lock modal aa jayega: *"Session Grace Expired / سیشن کی مدت ختم"*.
- Internet connect karke dobara login karein taake POS dobara unlock ho jaye.

---

## 2. In-Scope vs. Online-Only in Version 1

| Feature / Module | Offline Status in v1 | Explanation |
|---|---|---|
| **Normal Sales (Cash, Card, Bank)** | ✅ **Fully Supported** | Queued locally in IndexedDB, auto-syncs on reconnect |
| **Udhaar / Credit Sales** | ✅ **Fully Supported** | Customer balance updates atomically upon sync |
| **Special Receipts** | ✅ **Fully Supported** | Dedicated idempotency key & audit logs synced |
| **Local Receipt Print** | ✅ **Fully Supported** | Standard thermal layout with `<deviceShortCode>-<seq>` |
| **Shift Open (Register Open)** | ✅ **Fully Supported** | Stored as local shift marker; synced at head of queue |
| **Cart Auto-Save** | ✅ **Fully Supported** | Saved in localStorage; auto-restored after crash/refresh |
| **Hold Invoices** | ✅ **Fully Supported** | Saved locally by `local_hold_id`; auto-synced online |
| **Shift Close (Day Close)** | ❌ **Online-Only** | Server-side cash recomputation requires active DB access |
| **Invoice Edit (PATCH)** | ❌ **Online-Only** | Protected by Optimistic Concurrency Control (`version`) |
| **Purchases & Supplier Pay** | ❌ **Online-Only** | Multi-branch supplier ledger integrity |
| **Stock Manual Adjustment** | ❌ **Online-Only** | Physical audit requires authoritative server count |
| **Branch Orders / Dispatch** | ❌ **Online-Only** | Real-time cross-branch communication |

---

## 3. Step-by-Step Manual Test Verification Checklist

Execute these 7 steps on `http://localhost:3000/example`:

### Step 1: Offline Shift Opening
1. Disconnect WiFi or disable network in DevTools (*Network tab → Offline*).
2. Go to `/example`.
3. If shift is not open, click **Open Shift**, enter Rs. 5,000 opening cash, and submit.
4. **Expected:**
   - Shift opens immediately.
   - Amber banner appears: `⚡ Offline Shift Active: Register shift was opened offline`.
   - Register is ready for billing.

### Step 2: Bill 3 Sales Offline
1. Add 2 items to the cart, select Cash, click Checkout.
   - **Expected:** Sale completes, receipt prints with number like `DEV1-0001`, stock decrements on screen.
2. Add another item, select Customer "Walk-in Customer", choose Credit / Udhaar, click Checkout.
   - **Expected:** Sale completes, slip `DEV1-0002` created.
3. Add an item, toggle Special Receipt, click Checkout.
   - **Expected:** Special receipt printed, slip `DEV1-0003` created.
4. Check the Offline Queue Pill in header:
   - **Expected:** Shows `4 items pending` (1 shift_open + 3 sales).

### Step 3: Refresh / Crash Test
1. Press `F5` / reload the browser page while still offline.
2. **Expected:**
   - Register remains open with the offline shift.
   - Offline Queue Pill still displays `4 items pending`.
   - No data lost.

### Step 4: Reconnection & Auto-Sync
1. Re-enable WiFi or uncheck Offline in DevTools.
2. Click `Re-check Connection` or wait up to 30 seconds.
3. **Expected:**
   - Status changes to `Online`.
   - Sync pill transitions to `Syncing...` then `All Synced`.
   - Shift is created on server first (FIFO head).
   - All 3 sales receive official sequential invoice numbers.

### Step 5: Database & Sales History Verification
1. Open Sales History on `/example`.
2. Search for `DEV1-0001` or the customer name.
3. **Expected:**
   - All 3 sales appear with authentic timestamps and items.
   - Client ledger reflects the udhaar sale accurately.

### Step 6: Concurrency & Invoice Edit Version Conflict
1. Click **Edit** on any synced sale.
2. In another tab or window, edit the same sale and change the discount to Rs. 50. Save it (advances version from 1 to 2).
3. Now back in the first tab, change discount to Rs. 100 and click Save.
4. **Expected:**
   - First tab receives HTTP 409 Conflict alert: *"This invoice was modified elsewhere (Version conflict). Please reload the invoice from Sales History to view the latest changes."*
   - Neither change overwrites blindly.

### Step 7: Offline Shift Close Protection
1. Disconnect WiFi again so terminal is offline.
2. Open Shift Drawer and attempt to click **Close & Reconcile Shift**.
3. **Expected:**
   - Button is disabled with tooltip: *"Cannot close offline shift — reconnect to sync first"*.
   - Attempting to submit alerts: *"Cannot close an offline shift while offline. Please connect to internet and allow shift to sync first."*

---

## 4. Known Risks & Production Operational Advice

1. **Storage Eviction:**
   - Modern browsers rarely clear IndexedDB unless disk space is critically low (<5%). The app automatically requests `navigator.storage.persist()`.
   - *Advice:* Staff should not use "Private/Incognito" windows for counter billing, as incognito storage is discarded upon closing.
2. **Clock Tampering:**
   - If cashier manually sets PC clock backwards/forwards, `/api/health` probes continuously measure client-server skew and calibrate `clockOffsetMs`.
   - Sales with skewed local timestamps are calibrated before queuing to prevent `OFFLINE_TIME_FUTURE` rejections.
3. **Stuck Items (Poison Pills):**
   - If a business rule violation occurs, the item sits safely in `needs_attention`.
   - *Advice:* CEO should review the `Needs Attention` tab weekly to resolve any credit-limit or catalog mismatches.
