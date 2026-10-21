# Database State Verification: Special Receipt Feature

**Product:** PyntFlow POS & Industrial ERP  
**Target Database:** Supabase PostgreSQL (`project_id: ignspvajzblmsbertmmv`, region: `ap-south-1`, PostgreSQL 17)  
**Execution Mode:** STRICTLY READ-ONLY (No DDL, DML, or migrations executed)  
**Verification Date:** 2026-10-21  
**Author:** Senior Full-Stack Engineer  

---

## Part 1: Discovery Findings

### 1.1 All Tables in `public` Schema & Estimated Row Counts

| Table Name | Kind | Estimated Rows | Purpose in PyntFlow |
| :--- | :--- | :--- | :--- |
| `ai_usage_ledger` | table | 0 | AI prompt/token billing ledger |
| `app_users` | table | 5 | Core system users (Developer, CEO, Staff/POS) |
| `audit_logs` | table | 6 | Append-only system audit log |
| `branch_order_items` | table | 0 | Inter-branch dispatch items |
| `branch_orders` | table | 0 | Inter-branch replenishment orders |
| `brand_series` | table | 0 | Product brand series categorization |
| `brands` | table | 0 | Brand master records (tenant-scoped) |
| `clients` | table | 1 | Customer / Khata ledger records |
| `custom_units` | table | 0 | Packaging unit definitions |
| `global_ai_settings` | table | 1 | Platform-wide AI credentials and limits |
| `held_invoices` | table | 0 | Parked POS sales drafts |
| `invoice_items` | table | 4 | Sales and return invoice line items |
| `invoices` | table | 4 | Sales and return invoice headers |
| `items` | table | 1 | Product catalog and current stock |
| `petty_expenses` | table | 0 | POS shift cash drawer petty expenses |
| `purchase_items` | table | 0 | Vendor purchase line items |
| `purchases` | table | 0 | Vendor purchase headers |
| `rate_limit_entries` | table | 0 | Atomic Redis/DB rate limit tracking |
| `receipt_templates` | table | 4 | Regular thermal/A4 receipt template definitions |
| `revoked_sessions` | table | 0 | JWT session revocation blocklist (`jti`) |
| `series_token_configs` | table | 0 | Token configuration per series & unit |
| `shifts` | table | 0 | Cashier shift sessions & drawer balances |
| `suppliers` | table | 0 | Vendor master accounts |
| `tenant_ai_settings` | table | 0 | Per-tenant AI toggles and limits |
| `tenant_receipt_template` | table | 0 | Tenant to receipt template assignment |
| `tenants` | table | 2 | Branches / shops multi-tenancy entity |
| `token_redemption_items` | table | 0 | Token claim slip redemption line items |
| `token_redemptions` | table | 0 | Customer token voucher redemptions |
| `token_transactions` | table | 0 | Token ledger (retained, issued, settled) |
| `vouchers` | table | 0 | Accounting payment & expense vouchers |

**Total Public Tables:** 30 tables found.

### 1.2 Views and Materialized Views
- `pg_views` where `schemaname = 'public'`: **0 views found (`[]`)**.
- `pg_matviews` where `schemaname = 'public'`: **0 materialized views found (`[]`)**.

### 1.3 Schema of Relevant Tables

| Table Name | Column Name | Data Type | Nullable | Default |
| :--- | :--- | :--- | :--- | :--- |
| **`app_users`** | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `username` | `text` | NO | *none* |
| | `password_hash` | `text` | NO | *none* |
| | `full_name` | `text` | NO | *none* |
| | `email` | `text` | YES | *none* |
| | `role` | `text` | NO | *none* (checks `'ceo'`, `'developer'`, `'staff'`) |
| | `tenant_id` | `uuid` | YES | *none* (FK `tenants.id`) |
| | `is_active` | `boolean` | YES | `true` |
| | `created_at` | `timestamptz` | YES | `now()` |
| **`invoices`** | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* (FK `tenants.id`) |
| | `invoice_no` | `text` | NO | *none* |
| | `client_id` | `uuid` | YES | *none* (FK `clients.id`) |
| | `client_name` | `text` | NO | `'Walk-in Customer'` |
| | `shift_id` | `uuid` | YES | *none* (FK `shifts.id`) |
| | `date` | `date` | NO | `CURRENT_DATE` |
| | `subtotal` | `numeric` | NO | `0` |
| | `discount` | `numeric` | NO | `0` |
| | `net_total` | `numeric` | NO | *none* |
| | `paid_amount` | `numeric` | NO | `0` |
| | `due_amount` | `numeric` | NO | `0` |
| | `payment_type` | `text` | NO | `'cash'` |
| | `status` | `text` | NO | `'completed'` |
| | `created_by` | `text` | YES | *none* |
| | `created_at` | `timestamptz` | YES | `now()` |
| | `delivery_charge` | `numeric` | NO | `0` |
| | `remarks` | `text` | YES | *none* |
| | `invoice_type` | `text` | NO | `'sales'` |
| | `cash_paid` | `numeric` | NO | `0` |
| | `card_paid` | `numeric` | NO | `0` |
| | `bank_paid` | `numeric` | NO | `0` |
| | `others_paid` | `numeric` | NO | `0` |
| **`invoice_items`** | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `invoice_id` | `uuid` | NO | *none* (FK `invoices.id` ON DELETE CASCADE) |
| | `item_id` | `uuid` | YES | *none* (FK `items.id` ON DELETE SET NULL) |
| | `item_code` | `text` | YES | *none* |
| | `item_name` | `text` | NO | *none* |
| | `unit` | `text` | YES | `'PCS'` |
| | `qty` | `numeric` | NO | `1` |
| | `unit_price` | `numeric` | NO | `0` |
| | `discount` | `numeric` | NO | `0` |
| | `total_price` | `numeric` | NO | *none* |
| | `shade_code` | `text` | YES | *none* |
| | `pack_size` | `text` | YES | *none* |
| | `discount_percent` | `numeric` | YES | `0` |
| **`receipt_templates`**| `id` | `uuid` | NO | `gen_random_uuid()` |
| | `name` | `text` | NO | *none* |
| | `description` | `text` | YES | *none* |
| | `paper_size` | `text` | NO | `'thermal_80'` |
| | `template_json` | `jsonb` | NO | `'{}'::jsonb` |
| | `is_default` | `boolean` | NO | `false` |
| | `is_deleted` | `boolean` | NO | `false` |
| | `created_at` | `timestamptz` | YES | `now()` |
| **`tenant_receipt_template`**| `tenant_id` | `uuid` | NO | *none* (PK, FK `tenants.id` ON DELETE CASCADE) |
| | `template_id` | `uuid` | NO | *none* (FK `receipt_templates.id` ON DELETE CASCADE) |
| | `assigned_at` | `timestamptz` | YES | `now()` |
| | `assigned_by` | `uuid` | YES | *none* |
| **`brands`** *(Verified via information_schema)* | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* |
| | `name` | `text` | NO | *none* |
| | `status` | `text` | NO | `'active'::text` |
| | `created_at` | `timestamptz` | NO | `now()` |
| | `updated_at` | `timestamptz` | NO | `now()` |
| **`brand_series`** *(Verified via information_schema)* | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* |
| | `brand_id` | `uuid` | NO | *none* |
| | `name` | `text` | NO | *none* |
| | `status` | `text` | NO | `'active'::text` |
| | `created_at` | `timestamptz` | NO | `now()` |
| | `updated_at` | `timestamptz` | NO | `now()` |
| **`series_token_configs`** *(Verified via information_schema)* | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* |
| | `series_id` | `uuid` | NO | *none* |
| | `unit_name` | `text` | NO | *none* |
| | `is_enabled` | `boolean` | NO | `false` |
| | `token_value` | `numeric` | NO | `0` |
| | `is_drum_auto` | `boolean` | NO | `true` |
| | `created_at` | `timestamptz` | NO | `now()` |
| | `updated_at` | `timestamptz` | NO | `now()` |
| **`clients`** *(Verified via information_schema)* | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* |
| | `code` | `text` | YES | *none* |
| | `name` | `text` | NO | *none* |
| | `phone` | `text` | YES | *none* |
| | `city` | `text` | YES | *none* |
| | `area` | `text` | YES | *none* |
| | `address` | `text` | YES | *none* |
| | `credit_limit` | `numeric` | YES | `0.00` |
| | `current_balance` | `numeric` | YES | `0.00` |
| | `created_at` | `timestamptz` | YES | `now()` |
| | `token_balance` | `numeric` | YES | `0` |
| **`shifts`** *(Verified via information_schema)* | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* |
| | `opened_by` | `text` | YES | *none* *(Note: NOT user_id)* |
| | `closed_by` | `text` | YES | *none* |
| | `start_time` | `timestamptz` | YES | `now()` |
| | `end_time` | `timestamptz` | YES | *none* |
| | `opening_cash` | `numeric` | NO | `0.00` |
| | `expected_cash` | `numeric` | YES | `0.00` |
| | `actual_cash` | `numeric` | YES | `0.00` |
| | `difference` | `numeric` | YES | `0.00` |
| | `notes` | `text` | YES | *none* |
| | `status` | `text` | YES | `'open'::text` |
| | `created_at` | `timestamptz` | YES | `now()` |
| | `previous_closing_cash` | `numeric` | YES | `0` |
| | `handover_variance` | `numeric` | YES | `0` |
| | `handover_notes` | `text` | YES | *none* |
| **`token_transactions`** *(Verified via information_schema)* | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* |
| | `type` | `text` | NO | *none* |
| | `invoice_id` | `uuid` | YES | *none* |
| | `redemption_id` | `uuid` | YES | *none* |
| | `client_id` | `uuid` | YES | *none* |
| | `client_name` | `text` | YES | *none* |
| | `brand_id` | `uuid` | YES | *none* |
| | `brand_name` | `text` | NO | *none* |
| | `series_id` | `uuid` | YES | *none* |
| | `series_name` | `text` | NO | *none* |
| | `unit_name` | `text` | NO | *none* |
| | `token_value` | `numeric` | NO | `0` |
| | `quantity` | `integer` | NO | `1` |
| | `remaining_quantity` | `integer` | NO | `0` |
| | `total_amount` | `numeric` | NO | `0` |
| | `usage_status` | `text` | NO | `'available'::text` |
| | `shift_id` | `uuid` | YES | *none* |
| | `notes` | `text` | YES | *none* |
| | `write_off_reason` | `text` | YES | *none* |
| | `settled_vendor_name` | `text` | YES | *none* |
| | `used_against_purchase_id` | `uuid` | YES | *none* |
| | `used_against_voucher_id` | `uuid` | YES | *none* |
| | `parent_transaction_id` | `uuid` | YES | *none* |
| | `created_by` | `text` | YES | *none* |
| | `created_at` | `timestamptz` | NO | `now()` |
| **`items`** | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `tenant_id` | `uuid` | NO | *none* (FK `tenants.id` ON DELETE CASCADE) |
| | `code` | `text` | NO | *none* |
| | `name` | `text` | NO | *none* |
| | `brand` | `text` | NO | `'General'` |
| | `brand_id` | `uuid` | YES | *none* (FK `brands.id` ON DELETE SET NULL) |
| | `series_id` | `uuid` | YES | *none* (FK `brand_series.id` ON DELETE SET NULL) |
| | `cost_price` | `numeric` | NO | `0` |
| | `retail_price` | `numeric` | NO | `0` |
| | `stock_qty` | `numeric` | NO | `0` |
| **`tenants`** | `id` | `uuid` | NO | `gen_random_uuid()` |
| | `slug` | `text` | NO | *none* |
| | `name` | `text` | NO | *none* |
| | `type` | `text` | NO | *none* |
| | `owner_name` | `text` | YES | *none* |
| | `phone` | `text` | YES | *none* |
| | `address` | `text` | YES | *none* |
| | `city` | `text` | YES | *none* |
| | `email` | `text` | YES | *none* |
| | `is_active` | `boolean` | YES | `true` |

---

## Part 2: Structure and Relationships Findings

### 2.1 Foreign Keys
- `invoices.tenant_id` $\rightarrow$ `tenants(id)` ON DELETE CASCADE
- `invoices.client_id` $\rightarrow$ `clients(id)` ON DELETE SET NULL
- `invoices.shift_id` $\rightarrow$ `shifts(id)` ON DELETE SET NULL
- `invoice_items.invoice_id` $\rightarrow$ `invoices(id)` ON DELETE CASCADE
- `invoice_items.item_id` $\rightarrow$ `items(id)` ON DELETE SET NULL
- `app_users.tenant_id` $\rightarrow$ `tenants(id)` ON DELETE CASCADE
- `items.tenant_id` $\rightarrow$ `tenants(id)` ON DELETE CASCADE
- `items.brand_id` $\rightarrow$ `brands(id)` ON DELETE SET NULL
- `items.series_id` $\rightarrow$ `brand_series(id)` ON DELETE SET NULL
- `brands.tenant_id` $\rightarrow$ `tenants(id)` ON DELETE CASCADE
- `tenant_receipt_template.tenant_id` $\rightarrow$ `tenants(id)` ON DELETE CASCADE
- `tenant_receipt_template.template_id` $\rightarrow$ `receipt_templates(id)` ON DELETE CASCADE

### 2.2 Primary Keys, Unique Constraints & Check Constraints
- `uq_invoices_tenant_invoice_no`: UNIQUE (`tenant_id`, `invoice_no`)
- `uq_brands_tenant_name`: UNIQUE (`tenant_id`, `lower(name)`)
- `uq_items_tenant_code`: UNIQUE (`tenant_id`, `code`)
- `uq_items_tenant_name`: UNIQUE (`tenant_id`, `lower(name)`)
- `tenant_receipt_template_pkey`: PRIMARY KEY (`tenant_id`)
- `app_users_username_key`: UNIQUE (`username`)
- `check_app_users_role`: `CHECK (role = ANY (ARRAY['ceo'::text, 'developer'::text, 'staff'::text]))`
- `receipt_templates_pkey`: PRIMARY KEY (`id`)
- Partial Unique Index: `receipt_templates_single_default` on `receipt_templates(is_default)` WHERE `(is_default = true AND is_deleted = false)` (guarantees exactly one global default template).

### 2.3 Existing Indexes
- `idx_invoices_tenant_date` ON `invoices(tenant_id, date DESC)`
- `idx_invoices_tenant_invoice_no` ON `invoices(tenant_id, invoice_no)`
- `idx_invoices_shift` ON `invoices(shift_id)`
- `idx_invoice_items_invoice_id` ON `invoice_items(invoice_id)`
- `idx_invoice_items_item_id` ON `invoice_items(item_id)`
- `idx_items_tenant_code` ON `items(tenant_id, code)`
- `idx_items_tenant_brand` ON `items(tenant_id, brand)`
- `idx_items_tenant_brand_id` ON `items(tenant_id, brand_id)`
- `idx_items_tenant_series_id` ON `items(tenant_id, series_id)`

---

## Part 3: Security State Findings

### 3.1 Row Level Security (RLS) Status
- **All 30 tables in `public`** have `rls_enabled: true` and `rls_forced: false`.

### 3.2 Existing Policies (`pg_policies`)
- 29 of 30 tables have **ONLY a single policy**:
  `CREATE POLICY "<table_name>_service_role" ON public.<table_name> FOR ALL TO service_role USING (true) WITH CHECK (true);`
- The **ONLY** table with an authenticated user policy is:
  - `held_invoices`: policy `Tenant isolation for held_invoices` for role `{authenticated}` verifying `tenant_id = (jwt.claims ->> 'tenant_id')::uuid`.
- **CRITICAL IMPLICATION:**
  Neither `invoices`, `items`, `receipt_templates`, nor `app_users` permits direct access from role `authenticated` or `anon`.
  All application queries go through Next.js server-side API routes using `service_role` (via `getSupabaseAdmin()`).
  Therefore, policy creation for `special_receipt_templates`, `special_receipt_brands`, and `special_print_log` must supply the standard `service_role` policy. Direct `authenticated` policies are only evaluated if client-side Supabase PostgREST queries are enabled.

### 3.3 Role Grants (`role_table_grants`)
- `anon`, `authenticated`, and `service_role` have SQL table grants (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`, `TRUNCATE`).
- However, because RLS is enabled on all tables, RLS default-deny blocks `anon` and `authenticated` whenever no permissive policy exists for them.

### 3.4 Helper Functions & `SECURITY DEFINER` Functions
- Found **21 public functions**, 19 of which are `SECURITY DEFINER`:
  - `adjust_item_stock`, `adjust_item_stock_by_code`
  - `create_invoice_atomic`, `update_invoice_atomic`, `cancel_invoice_atomic`
  - `create_purchase_atomic`, `cancel_purchase_atomic`
  - `create_voucher_atomic`
  - `redeem_tokens_atomic`, `settle_tokens_atomic`
  - `get_ceo_branches_kpi_summary`
  - `set_default_receipt_template`
  - `process_branch_dispatch_atomic`, `process_branch_receive_atomic`, `receive_goods_atomic`
  - `reserve_ai_usage`
  - `check_rate_limit_atomic`, `reset_rate_limit_atomic`
- All functions correctly set `search_path TO 'public', 'pg_temp'`, preventing schema-injection risks.

---

## Part 4: Logic Living in the Database

### 4.1 Triggers
- Query on `information_schema.triggers where trigger_schema = 'public'`: **0 triggers found (`[]`)**.
- No hidden database triggers mutate prices, invoices, or audit entries on write.

### 4.2 Functions/RPCs Touching Sales, Invoices, Stock & Reports
- **`create_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_tokens jsonb)`**:
  - Receives `p_items` JSON array.
  - Inserts directly into `invoice_items`:
    `unit_price = COALESCE((v_item->>'unit_price')::NUMERIC, 0)`
    `discount = COALESCE((v_item->>'discount')::NUMERIC, 0)`
    `total_price = COALESCE((v_item->>'total_price')::NUMERIC, 0)`
  - Reads `items` table **strictly for stock decrement**:
    `SELECT stock_qty, name INTO v_curr_stock, v_item_name FROM items WHERE id = v_item_id FOR UPDATE;`
    `UPDATE items SET stock_qty = v_curr_stock - v_item_qty WHERE id = v_item_id;`
  - **VERIFIED:** It does **NOT** read or re-apply `items.retail_price`.
- **`update_invoice_atomic(p_invoice_id, p_tenant_id, p_invoice_data, p_items)`**:
  - Reverts old line item quantities to `items.stock_qty`.
  - Re-inserts new line items using prices passed in `p_items` JSON.
  - Updates `invoices.net_total = (p_invoice_data->>'net_total')::NUMERIC`.
  - **VERIFIED:** Does not touch `items.retail_price`.
- **`cancel_invoice_atomic(p_tenant_id, p_invoice_id, p_reason, p_cancelled_by)`**:
  - Reverts `items.stock_qty = stock_qty + v_item.qty` using `invoice_items.qty`.
  - Sets `invoices.status = 'cancelled'`.
  - **VERIFIED:** Reverts customer balance according to `invoices.due_amount` and `invoices.paid_amount`.
- **`get_ceo_branches_kpi_summary(p_tenant_ids, p_today)`**:
  - Calculates sales directly from `invoices.net_total`:
    `COALESCE(SUM(CASE WHEN i.date = p_today THEN i.net_total ELSE 0 END), 0) AS today_sum`
  - **VERIFIED:** Does not recompute totals from `items.retail_price`.

### 4.3 Views Definitions
- **None exist.** No database views or materialized views calculate sales or profit. All analytics are computed in API routes or SQL queries reading `invoices.net_total` and `invoice_items.unit_price`.

---

## Part 5: Feature-Specific Checks

### 5.1 Existence of Proposed Names
- Column `app_users.can_use_special_receipt`: **DOES NOT EXIST (`NONE`)**.
- Tables `special_receipt_templates`, `special_receipt_brands`, `special_print_log`: **DO NOT EXIST (`NONE`)**.
- Column `invoices.printed_as`: **DOES NOT EXIST (`NONE`)**.

### 5.2 Regular Receipt Settings Storage
- Stored in `receipt_templates`:
  - Columns: `id` (UUID), `name` (TEXT), `description` (TEXT), `paper_size` (TEXT), `template_json` (JSONB), `is_default` (BOOLEAN), `is_deleted` (BOOLEAN), `created_at` (TIMESTAMPTZ).
  - *(Note: There are no `layout` or `css` columns. The complete styling and layout sections are stored in `template_json`).*
- Branch assignment is stored in `tenant_receipt_template`:
  - Columns: `tenant_id` (UUID PK), `template_id` (UUID), `assigned_at`, `assigned_by`.
- Global default: exactly one row in `receipt_templates` has `is_default = true` and `is_deleted = false` (current active default ID: `5b48311e-acaf-4ac0-92d7-b923e812dd6a`, name: `"Thermal Standard"`, `paper_size = 'thermal_80'`).

### 5.3 Product to Brand Relationship
- `public.items` has columns:
  - `brand` (`text NOT NULL DEFAULT 'General'`)
  - `brand_id` (`uuid REFERENCES brands(id) ON DELETE SET NULL`)
  - `series_id` (`uuid REFERENCES brand_series(id) ON DELETE SET NULL`)
- `public.brands` is **tenant-scoped** (`tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`).
- Brand is therefore **per-tenant (per-branch)**, not global.

### 5.4 Unit Price Snapshot in `invoice_items`
- **VERIFIED:** `invoice_items` stores `unit_price`, `discount`, `discount_percent`, and `total_price` as frozen snapshots at sale time.
- Neither `create_invoice_atomic` nor any view or trigger overwrites these with `items.retail_price`.
- **Conclusion:** Saving edited prices in the Special Receipt flow is **100% architecturally safe** and does not contaminate the master product catalog.

### 5.5 Roles & Multi-Tenancy Architecture
- `app_users.role` contains: `'ceo'`, `'developer'`, `'staff'` (POS user).
- POS cashier is tied to branch via `app_users.tenant_id REFERENCES tenants(id)`.
- Multi-tenancy in PyntFlow is represented by table **`tenants`** (`tenant_id`), where each shop/branch is a row in `tenants`.
- `shop_id` does not exist as a primary column in any live table.

### 5.6 Sample Structure (Masked, Non-Sensitive, Max 3 Rows)

#### `receipt_templates` (3 rows)
```json
[
  {
    "id": "5b48311e-acaf-4ac0-92d7-b923e812dd6a",
    "name": "Thermal Standard",
    "paper_size": "thermal_80",
    "is_default": true,
    "is_deleted": false,
    "template_json_keys": ["locks", "footer", "header", "layout", "totals", "itemsTable", "invoiceInfo"]
  },
  {
    "id": "ce99f053-eb1c-4d7c-9042-162a7814e900",
    "name": "Thermal Standard",
    "paper_size": "thermal_80",
    "is_default": false,
    "is_deleted": true,
    "template_json_keys": ["locks", "footer", "header", "layout", "totals", "itemsTable", "invoiceInfo", "tokenClaimSlip"]
  },
  {
    "id": "5c90b18b-9444-4585-beee-6b6010621b7f",
    "name": "Thermal Standard",
    "paper_size": "a4",
    "is_default": false,
    "is_deleted": true,
    "template_json_keys": ["locks", "footer", "header", "layout", "totals", "itemsTable", "invoiceInfo", "tokenClaimSlip"]
  }
]
```

#### `invoices` (3 rows, masked)
```json
[
  {
    "id": "0ae40153-d09f-4111-9b82-4f3ae47da5fb",
    "tenant_id": "47b435c9-95e1-4602-9420-847858f546be",
    "invoice_no": "INV-723657",
    "client_name_masked": "Client 31f1",
    "date": "2026-10-20",
    "subtotal": "2000.00",
    "discount": "0.00",
    "net_total": "2000.00",
    "paid_amount": "2000.00",
    "due_amount": "0.00",
    "payment_type": "cash",
    "status": "completed",
    "invoice_type": "sales"
  },
  {
    "id": "91ca4f27-1d3d-4f28-869a-82cc41b98f25",
    "tenant_id": "47b435c9-95e1-4602-9420-847858f546be",
    "invoice_no": "INV-985569",
    "client_name_masked": "Client 31f1",
    "date": "2026-10-20",
    "subtotal": "2000.00",
    "discount": "0.00",
    "net_total": "2000.00",
    "paid_amount": "2000.00",
    "due_amount": "0.00",
    "payment_type": "cash",
    "status": "completed",
    "invoice_type": "sales"
  },
  {
    "id": "62a22f62-2179-4940-8715-9fb78769e890",
    "tenant_id": "47b435c9-95e1-4602-9420-847858f546be",
    "invoice_no": "INV-442317",
    "client_name_masked": "Client 31f1",
    "date": "2026-10-20",
    "subtotal": "2000.00",
    "discount": "0.00",
    "net_total": "2000.00",
    "paid_amount": "2000.00",
    "due_amount": "0.00",
    "payment_type": "cash",
    "status": "completed",
    "invoice_type": "sales"
  }
]
```

#### `invoice_items` (3 rows, masked)
```json
[
  {
    "id": "aba613fc-f66b-42ed-aeff-eee04371026d",
    "invoice_id": "0ae40153-d09f-4111-9b82-4f3ae47da5fb",
    "item_code": "PNT-246",
    "item_name_masked": "Item 7b06",
    "unit": "20L Drum",
    "qty": "1.00",
    "unit_price": "2000.00",
    "discount": "0.00",
    "total_price": "2000.00",
    "shade_code": "Off-White 101",
    "pack_size": "20L Drum",
    "discount_percent": "0"
  },
  {
    "id": "6d91cb9a-6ae3-439b-ab81-8bd6175e4751",
    "invoice_id": "91ca4f27-1d3d-4f28-869a-82cc41b98f25",
    "item_code": "PNT-246",
    "item_name_masked": "Item 7b06",
    "unit": "20L Drum",
    "qty": "1.00",
    "unit_price": "2000.00",
    "discount": "0.00",
    "total_price": "2000.00",
    "shade_code": "Off-White 101",
    "pack_size": "20L Drum",
    "discount_percent": "0"
  },
  {
    "id": "a41918d4-8df8-458f-8512-46a96fff4e28",
    "invoice_id": "62a22f62-2179-4940-8715-9fb78769e890",
    "item_code": "PNT-246",
    "item_name_masked": "Item 7b06",
    "unit": "20L Drum",
    "qty": "1.00",
    "unit_price": "2000.00",
    "discount": "0.00",
    "total_price": "2000.00",
    "shade_code": "Off-White 101",
    "pack_size": "20L Drum",
    "discount_percent": "0"
  }
]
```

#### `app_users` (3 rows, masked)
```json
[
  {
    "id": "ad882480-07df-43af-99ce-eb68ed7c3811",
    "username_masked": "user_7dc2",
    "role": "ceo",
    "tenant_id": "36da36b6-c1d2-448c-b685-3d7f354fdfca",
    "is_active": true
  },
  {
    "id": "c7eb7461-ab4d-4011-bd40-06a008dfa14c",
    "username_masked": "user_0192",
    "role": "staff",
    "tenant_id": "36da36b6-c1d2-448c-b685-3d7f354fdfca",
    "is_active": true
  },
  {
    "id": "cdc40d0d-001e-478a-b8b7-99f006632c04",
    "username_masked": "user_5516",
    "role": "ceo",
    "tenant_id": "47b435c9-95e1-4602-9420-847858f546be",
    "is_active": true
  }
]
```

---

## Part 6: Comparison of Assumptions vs Real DB State

| Topic / Item | Assumption in Plan | Real DB State | Status |
| :--- | :--- | :--- | :--- |
| **User table name** | `public.app_users` (mapped from `pos_users`) | `public.app_users` | **MATCH** |
| **POS user role string** | `'staff'` | `'staff'` (allowed: `'ceo'`, `'developer'`, `'staff'`) | **MATCH** |
| **Branch / Shop representation** | `tenants` table with `tenant_id` foreign key | `tenants` table with `tenant_id` foreign key; no `shops` table exists | **MATCH** |
| **Receipt templates table** | `receipt_templates` with `paper_size`, `template_json` | `receipt_templates` with `paper_size`, `template_json`; NO separate `layout` or `css` column | **MATCH** (structure verified) |
| **Branch template assignment** | `tenant_receipt_template(tenant_id, template_id)` | `tenant_receipt_template(tenant_id PK, template_id)` | **MATCH** |
| **Item unit price snapshot** | `invoice_items` stores frozen `unit_price`, `discount`, `total_price` | Verified: `invoice_items` stores frozen numbers independent of `items.retail_price` | **MATCH** |
| **Stock deduction logic** | Deducts `qty` without reading `items.retail_price` | `create_invoice_atomic` updates `stock_qty = stock_qty - qty` and never touches price | **MATCH** |
| **Day Close cash logic** | Sums `invoices.cash_paid` | Cash drawer reconciliation uses `invoices.cash_paid` | **MATCH** |
| **Brand scoping** | `brands` is scoped per-branch (`tenant_id`) | `brands.tenant_id REFERENCES tenants(id)`, unique `(tenant_id, lower(name))` | **MATCH** |
| **Existing Special columns/tables** | `can_use_special_receipt`, `printed_as`, etc., not yet created | Verified: NONE exist yet | **MATCH** |
| **RLS implementation style** | Table policies for `service_role` + `authenticated` | In live DB, 29/30 tables use ONLY `service_role` policy. API routes use service role | **MISMATCH (Correction Needed)** |
| **PostgreSQL version** | Assumed PostgreSQL 15 | Live DB is running **PostgreSQL 17.6** (Supabase latest) | **MISMATCH (Minor / Non-breaking)** |

---

## Part 7: Required Corrections to `implementation_plan.md` and `task.md` [SUPERSEDED]

> [!WARNING]
> **SUPERSEDED BY REVISIONS 3–5 ARCHITECTURE (SEE PARTS 9, 10, AND 12):**
> 1. The earlier suggestion of adding direct `authenticated` role RLS policies with `CHECK (false)` or `FOR UPDATE USING (false)` was superseded in Revision 3. PyntFlow enforces multi-tenancy at the Next.js API layer with session verification, and talks to PostgreSQL using `service_role`. The database tables use standard service_role policies.
> 2. The earlier claim of "absolute immutability" via a simple `BEFORE UPDATE OR DELETE` trigger was superseded: `special_print_log` uses `pg_trigger_depth() = 1` so tenant cascade deletion in developer panel succeeds, while direct mutations from service_role and users are blocked. Furthermore, `REVOKE UPDATE, DELETE, TRUNCATE` is executed against `service_role`, `authenticated`, and `PUBLIC`.

### 1. RLS Architecture (Historical Note)
- **Superseded Note:** Database-level RLS policies on `special_print_log`, `special_receipt_templates`, and `special_receipt_brands` are granted to `service_role`. Strict authorization guards are implemented inside the API routes and PostgreSQL RPCs.

### 2. Migration PostgreSQL Target Version
- PostgreSQL 17 (live Supabase instance running PostgreSQL 17.6).

### 3. Special Receipt Templates Schema
- `special_receipt_templates` matches `receipt_templates`: `paper_size text not null default 'thermal_80'`, `template_json jsonb not null default '{}'::jsonb`.

---

## Part 8: New Risks Discovered & Mitigations [SUPERSEDED]

> [!WARNING]
> **SUPERSEDED BY REVISIONS 3–5 AUDIT:**
> The trigger definition below has been superseded by the `pg_trigger_depth() = 1` statement-level and row-level immutability triggers defined in `implementation_plan.md` Section 1.3, allowing tenant cascade deletion while strictly blocking manual updates, deletes, and truncates.

1. **Service Role Security Bypass Risk:**
   - Because PyntFlow uses `service_role` for API queries, database-level RLS policies do not restrict API route operations.
   - **Mitigation:** The Next.js API routes (`/api/special-print-log`, `/api/special-receipt-templates`, `/api/special-receipt-brands`) must explicitly validate:
     - POS operations: `user.can_use_special_receipt === true` and `user.tenant_id === req.tenant_id`.
     - CEO operations: `user.role === 'ceo'` and verified ownership of target tenant.
     - Hard block `PUT`, `PATCH`, `DELETE` on `/api/special-print-log` with `405 Method Not Allowed`.

2. **`check_app_users_role` Constraint:**
   - The check constraint `check_app_users_role` limits `role` strictly to `ARRAY['ceo', 'developer', 'staff']`.
   - **Mitigation:** The POS user role is `'staff'`. When configuring permissions in Developer Panel, only show the `can_use_special_receipt` toggle for users where `role === 'staff'`.

3. **Immutable Audit Guarantee (Superseded):**
   - The trigger definition below has been superseded by the `pg_trigger_depth() = 1` statement-level and row-level immutability triggers defined in `implementation_plan.md` Section 1.3, allowing tenant cascade deletion while strictly blocking manual updates, deletes, and truncates. Furthermore, `REVOKE UPDATE, DELETE, TRUNCATE` is executed against `service_role`, `authenticated`, and `PUBLIC`. The claim of "absolute immutability" is removed; see Section 1.3 for what is and is not protected.
   - Historical trigger draft below:
     ```sql
     CREATE OR REPLACE FUNCTION prevent_special_print_log_mutation()
     RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'special_print_log is an immutable audit trail. Updates and deletes are prohibited.';
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER trg_immutable_special_print_log
     BEFORE UPDATE OR DELETE ON public.special_print_log
     FOR EACH ROW EXECUTE FUNCTION prevent_special_print_log_mutation();
     ```
     This enforces absolute immutability even against service_role executions!

---

## Part 10: Revision 3 In-Depth Verification Findings (A1, A2, A3)

### A1. Deep RPC Analysis: `create_invoice_atomic`, `update_invoice_atomic`, `cancel_invoice_atomic`

1. **Exact JSON Return Shape of `create_invoice_atomic`:**
   - **On fresh insert:**
     ```json
     {
       "success": true,
       "invoice_id": "<uuid>",
       "invoice": { "id": "<uuid>", "invoice_no": "INV-...", "net_total": 1200, ... }
     }
     ```
   - **On duplicate `(tenant_id, invoice_no)` collision:**
     ```json
     {
       "success": true,
       "is_duplicate": true,
       "invoice": { "id": "<uuid>", "invoice_no": "INV-...", "net_total": 1200, ... }
     }
     ```
   - **Key Finding:** Top-level `invoice_id` is only present on fresh inserts; however, `result->'invoice'->>'id'` is **consistently present** on both fresh inserts and duplicates. Calling code must extract the invoice UUID via `COALESCE(result->>'invoice_id', result->'invoice'->>'id')`.

2. **Columns Inserted by `create_invoice_atomic`:**
   - Explicitly inserts: `tenant_id`, `invoice_no`, `client_id`, `client_name`, `shift_id`, `date`, `subtotal`, `discount`, `delivery_charge`, `remarks`, `invoice_type`, `net_total`, `paid_amount`, `due_amount`, `payment_type`, `cash_paid`, `card_paid`, `bank_paid`, `others_paid`, `status`, `created_by`.
   - **Key Finding:** It does **NOT** insert `printed_as`. Any invoice created through `create_invoice_atomic` receives the column default (`'regular'`). Therefore, our special print pipeline must explicitly execute:
     `UPDATE invoices SET printed_as = 'special' WHERE id = v_invoice_id;`

3. **Duplicate Handling:**
   - `create_invoice_atomic` has a two-tier idempotency check:
     - Tier 1 (Pre-insert check): `SELECT id INTO v_existing_id FROM invoices WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no;`
     - Tier 2 (Concurrency protection): `EXCEPTION WHEN unique_violation THEN ...` catching the PostgreSQL unique constraint `uq_invoices_tenant_invoice_no`.
   - Both tiers return `{ success: true, is_duplicate: true, invoice: <existing_invoice_json> }`.

4. **Sales Returns and Cancellations:**
   - There is **no separate function** for sales returns. Returns are executed through `create_invoice_atomic` by passing `invoice_type: 'return'`, which increases inventory (`stock_qty = stock_qty + v_item_qty`) and adjusts client store credit.
   - `cancel_invoice_atomic` handles both sales and returns, updating `invoices.status = 'cancelled'`. It does not modify `printed_as` or remove audit records.

---

### A2. Function EXECUTE Privileges (`pg_proc`)

Query executed against Supabase PostgreSQL:
```sql
select p.proname, p.prosecdef as security_definer, p.proacl,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' order by 1;
```

**Real Results:**
- **Zero SECURITY DEFINER functions are executable by `anon` or `authenticated`!**
- All 19 `SECURITY DEFINER` functions in `public` have `anon_exec = false` and `auth_exec = false`. Their ACL is strictly restricted to `{postgres=X/postgres, service_role=X/postgres}`.
- The **only** function executable by `anon` and `authenticated` is `match_unit_to_config` (which is a pure scalar string matcher, `security_definer: false`).
- **Standard to Maintain:** Our new atomic RPC `create_special_invoice_atomic` must explicitly follow this exact hardening:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.create_special_invoice_atomic FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.create_special_invoice_atomic TO service_role;
  ```

---

### A3. How the CEO Panel Resolves Branches Today

Traced from frontend (`src/components/ceo-panel/CeoSuite.tsx:50-57`) and backend (`src/app/api/tenants/kpi/route.ts:25-45`):
1. **Frontend Mechanism (`CeoSuite.tsx`):**
   - Fetches all tenants from `GET /api/tenants`.
   - Filters client-side with:
     ```ts
     const matchingTenants = data.tenants.filter(
       (t: any) =>
         t.id === tenant.id ||
         (tenant.email && t.email === tenant.email) ||
         (tenant.owner_name && t.owner_name === tenant.owner_name)
     );
     ```
2. **Backend Mechanism (`/api/tenants/kpi`):**
   - Fetches `callerTenant` from `tenants` matching `auth.session.tenantId`.
   - Builds an `.or()` query:
     `branchQuery.or(id.eq.${auth.session.tenantId}, owner_name.eq.${callerTenant.owner_name}, email.eq.${callerTenant.email})`.
   - Filters the caller's requested `tenant_ids` against this set.

3. **Critical Architectural Assessment:**
   - **There is NO explicit foreign key, `owner_id`, `company_id`, or `group_id` on `tenants`.**
   - The current grouping is an **informal text heuristic** based on `owner_name` and `email`.
   - **Security Vulnerability:** This heuristic is **unsafe for audit log authorization**:
     - Two independent businesses may have the same owner name (e.g. "Muhammad Ali" or "Ahmed"), causing cross-tenant data leaks.
     - In Supabase PostgREST, `.eq('email', null)` or matching on nulls produces unpredictable query behavior.
   - **Architecture Decision:**
     - For the Special Receipt audit trail, we **MUST NOT** use the `owner_name`/`email` heuristic for access control.
     - Until an explicit `company_group_id` or `owner_user_id` foreign key is added to `tenants` (proposed as separate task `TASK-SR-01b`), CEO access to `special_print_log` is strictly scoped to `auth.session.tenantId`.

---

## Part 11: Revision 4 Read-Only Investigation Findings (A1, A2, A3)

### A1. Sales Returns: Refund Pricing and Original Invoice Linkage

1. **How the Return Flow Chooses Refund `unit_price` Today:**
   - **User Interface Flow (`src/components/PosBilling.tsx:123-124, 1307-1322`):**
     - In the POS screen, the cashier toggles `invoiceType` between `'sales'` and `'return'` via the `.pos-segment-toggle` component.
     - When `'return'` is active, the cashier adds items by typing in the search bar or scanning barcodes, exactly as in a normal sale.
   - **Rate Determination (`src/components/PosBilling.tsx:620-704`):**
     - Inside `handleAddItem(prod, overrideRate, skipCheck)`:
       `const itemRate = overrideRate !== undefined ? overrideRate : (prod.retail_price || 0);`
     - If the customer is a registered client and previously purchased the item, `pendingRateConfirm` can prompt for the last purchase price; otherwise, for walk-in customers or standard catalog selection, `itemRate` **defaults strictly to `prod.retail_price` from the catalog (`items` table)**.
     - In the POS cart table (`src/components/PosBilling.tsx:1820-1822`), the rate column is **read-only text** (`{item.rate.toLocaleString(...)}`). The cashier cannot manually type a refund rate into this column.
   - **Token Deduction on Return (`src/components/PosBilling.tsx:963-966, 1700-1728`):**
     - If the item has a token and `tokenReturnedWithBucket === false` (missing token), POS deducts the token value from the refund rate:
       `effectiveRate = Math.max(0, effectiveRate - (ci.tokenValue || 0));`
   - **Submission (`src/components/PosBilling.tsx:940-989` -> `src/app/api/invoices/route.ts:254-315`):**
     - `PosBilling.tsx` constructs `invoicePayload` with `invoice_type: 'return'` and each item's `unit_price: effectiveRate`.
     - `POST /api/invoices` forwards this payload to `create_invoice_atomic`.
     - `create_invoice_atomic` (`supabase/migrations/20261002_02_atomic_invoice_tokens.sql:252-256`) increments physical inventory (`stock_qty = stock_qty + v_item_qty`) and adjusts client ledger credit (`clients.current_balance = current_balance - v_store_credit`).

2. **Link to Original Invoice:**
   - **Result: ZERO LINK.**
   - There is **no database column**, foreign key, or relationship in `invoices` (`parent_invoice_id`, `original_invoice_id`, etc.) pointing to an original sale.
   - The API route (`src/app/api/invoices/route.ts`) and `create_invoice_atomic` do not accept or store an original invoice reference.
   - The only place an original invoice number could conceivably exist is if the cashier manually types it into the optional free-text `remarks` field (`PosBilling.tsx:140`).
   - In `src/components/SalesHistory.tsx`, there is no "Return this invoice" action button; return invoices are completely decoupled, standalone documents.

3. **Critical Special Receipt Implication:**
   - If a customer buys an item under a Special Receipt at Rs. 1,400 (where catalog `retail_price` is Rs. 1,700), and subsequently returns it through the standard return flow, POS will look up `items.retail_price` and refund **Rs. 1,700**! The shop would lose Rs. 300 on the return.
   - Furthermore, the generated return slip would print via the regular branded template, exposing shop branding. Section 7.3 must explicitly prevent this.

---

### A2. Token Transactions in Special Sales

1. **Rows Written During Checkout with `p_tokens`:**
   - When `create_invoice_atomic` executes with non-empty `p_tokens` (`supabase/migrations/20261002_02_atomic_invoice_tokens.sql:299-446`):
     - For each token where `token_action = 'remove'` (shop retains token to discount customer price):
       Inserts a row into `token_transactions`:
       - `type = 'shop_retained'`
       - `usage_status = 'available'`
       - `quantity = v_token_qty`
       - `remaining_quantity = v_token_qty`
       - `notes = 'Shop retained token at sale (Discount applied to sale price)'`
       - Physical token enters the shop safe/stockpile and is available for company settlement.
     - For each token where `token_action = 'keep'` (customer retains token to claim later):
       Inserts a row into `token_transactions`:
       - `type = 'issued'`
       - `usage_status = 'n_a'`
       - `quantity = v_token_qty`
       - `remaining_quantity = 0` (not in shop stockpile)
       - `notes = 'Customer kept physical token with purchase'`
       - Operates strictly as an activity log.

2. **Special Sale Behavior with `tokenClaimSlip` Disabled:**
   - On regular receipts, when a walk-in (anonymous) customer selects `token_action = 'keep'`, `PosBilling.tsx:1044-1057` generates a `token_claim_code` (`CLM-XXXXXX`), and the regular receipt template prints a separate `tokenClaimSlip` section so the walk-in customer has proof to claim their cash token later.
   - On Special Receipts, `tokenClaimSlip.enabled = false` (enforced to prevent brand exposure and keep paper receipts minimal).
   - **Customer-Visible Consequence:**
     - A walk-in customer who keeps their token receives **no printed claim slip or claim code** on their Special Receipt.
     - If that walk-in customer returns to the shop to redeem their token, they have no physical claim slip to prove eligibility.
     - For registered clients (`client_id` present), the issued token remains queryable under their customer ledger in `token_transactions` and can be redeemed normally.
   - **Documented Recommendation:** In special sales, staff should select "Remove Token" at checkout so the discount is credited immediately into the sale price, or require a registered customer account if the customer insists on retaining tokens for deferred redemption.

---

### A3. Pre-existing Exposure (Out of Scope for Special Receipt)

*Investigative audit of `src/app/api/tenants/route.ts` and `src/app/api/tenants/kpi/route.ts` (Report Only — No fixes applied):*

1. **Unauthenticated Public Exposure (`src/app/api/tenants/route.ts:9-32`):**
   - **Endpoint:** `GET /api/tenants?slug=<slug>`
   - **Authentication:** **None.** The slug branch runs *before* `requireTenantAuth` is invoked (L35).
   - **Returned Columns:** Executes `supabaseAdmin.from('tenants').select('*').eq('slug', slug).single()`.
   - **Data Exposed:** Any anonymous visitor who knows or enumerates a tenant slug receives the **entire tenant row**, including:
     - `owner_name`, `phone`, `email`, `city`, `address`
     - `commission_enabled`, `commission_rate`, `commission_split_lead`, `commission_split_staff`, `commission_split_reserve`
     - Internal tenant UUID and creation timestamps.
   - *(Note: L25-27 notes that `app_users` were previously removed from this endpoint, but the tenant record itself remains fully exposed without authentication).*

2. **Cross-Tenant Leakage for CEO Sessions via Name/Email Heuristic (`src/app/api/tenants/route.ts:48-85`):**
   - **Endpoint:** `GET /api/tenants` (authenticated as `role = 'ceo'`).
   - **Scoping Query:** Fetches `callerTenant` (`owner_name, email`) for `auth.session.tenantId`, then runs:
     `tenantQuery.or('id.eq.' + tenantId + ',owner_name.eq.' + safeOwner + ',email.eq.' + safeEmail)`
   - **Returned Columns:** `select('*')` on all matched tenants, plus:
     - Full employee roster summary: `usersCount`, `ceo: { username, name }`, `staffCount`.
   - **Vulnerability:**
     - Because `tenants` lacks a formal `company_id` or `group_id` foreign key, any two unrelated businesses whose owners share a common name (e.g., "Muhammad Ali", "Tariq Mahmood") or a shared email will have their branches merged into each other's CEO panel.
     - One CEO can view the other tenant's contact information, commission formulas, and employee counts.

3. **Staff Role Exposure (`src/app/api/tenants/route.ts:86-89`):**
   - **Endpoint:** `GET /api/tenants` (authenticated as `role = 'staff'`).
   - **Filtering:** Properly filters to their own assigned branch (`eq('id', auth.session.tenantId)`). Staff users do not receive other tenants.
   - **Returned Columns:** However, for their own branch, staff receives `select('*')`, exposing owner personal phone, email, and commission percentages that regular cashiers typically should not inspect.

4. **KPI Route Behavior (`src/app/api/tenants/kpi/route.ts:19-55`):**
   - **Endpoints:** `POST /api/tenants/kpi` and `GET /api/tenants/kpi?tenant_ids=...`
   - **Filtering:**
     - Developer: Any requested `tenant_ids`.
     - CEO: Scopes requested `tenant_ids` against branches matching the same `owner_name` / `email` heuristic.
     - Staff: Strictly filters `allowedTenantIds` to `[auth.session.tenantId]`.
   - **Returned Data:** Executes RPC `get_ceo_branches_kpi_summary`, returning aggregated financial metrics (gross sales, net profit, cash collections, customer receivables) for the authorized branches.

*Conclusion:* The Special Receipt permission system must strictly isolate its audit logs to `auth.session.tenantId` and avoid the `owner_name`/`email` heuristic entirely (Decision D3).

---

## Part 12: Revision 5 In-Depth Investigation Findings (A1 to A5)

### A1. PosBilling Financial Totals Computation (`PosBilling.tsx:573-596, 940-988`)
- **Code Path:** `src/components/PosBilling.tsx` (state calculation in lines 573–596; payload assembly in lines 940–988).
- **Subtotal Calculation:**
  ```ts
  // Line-level item calculation:
  lineGross = effectiveRate * qty;
  lineDiscount = (lineGross * discountPercent) / 100;
  lineTotal = lineGross - lineDiscount;
  itemSubtotal = items.reduce((sum, item) => sum + lineTotal, 0);
  ```
  - **Key Finding:** Invoices table column `subtotal` sent to the server (`invoicePayload.subtotal = itemSubtotal`) is **ALREADY NET of line discounts!** It is the sum of discounted item totals.
- **Invoice-level Discount:**
  ```ts
  netTotal = Math.max(0, itemSubtotal - invoiceDiscount + deliveryCharge);
  ```
  - `invoicePayload.discount = invoiceDiscount`: Stores **only the invoice-level extra discount**, NOT the sum of line discounts. Line discounts are stored exclusively on individual `invoice_items.discount` records.
- **Delivery Charge:**
  - `invoicePayload.delivery_charge = deliveryCharge`: Flat delivery fee added after subtotal minus discount.
- **Net Total:**
  - `invoicePayload.net_total = Math.round(netTotal)`: Authoritative total charged to the customer.

---

### A2. Payment, Tender, and Due Amount Semantics (`PosBilling.tsx:900-960`, `/api/invoices/route.ts:161-163, 268-274`)
- **Tender Math:**
  ```ts
  totalPaid = cashPayment + cardPayment + bankPayment + othersPayment;
  finalPaid = Math.min(totalPaid, netTotal); // CAPPED at net_total
  finalDue = Math.max(0, netTotal - finalPaid);
  actualCashRetained = Math.max(0, netTotal - (cardPayment + bankPayment + othersPayment));
  cashChangeReturned = Math.max(0, cashPayment - actualCashRetained);
  ```
- **Storage Rules:**
  - `invoices.paid_amount` is **ALWAYS CAPPED at `net_total`** (never stores tendered amount with change).
  - `invoices.cash_paid` stores the **net cash retained** by the store (excluding cash change handed back to customer).
  - `invoices.due_amount` stores unpaid balance (`net_total - paid_amount`). Walk-in customers (`client_id = null`) must have `due_amount = 0`.
- **Worked Numeric Examples:**
  1. **Case 1: Exact Cash Sale**
     - Line Items: 2 × Rs. 500 = Rs. 1,000 subtotal. Discount = Rs. 0. Delivery = Rs. 0. `net_total = 1000`.
     - Tendered: Cash Rs. 1,000.
     - Stored Fields:
       * `subtotal = 1000.00`, `discount = 0.00`, `net_total = 1000.00`
       * `paid_amount = 1000.00`, `cash_paid = 1000.00`, `card_paid = 0.00`, `bank_paid = 0.00`, `others_paid = 0.00`
       * `due_amount = 0.00` (Change returned = Rs. 0).
  2. **Case 2: Over-Tendered Cash Sale**
     - Line Items: 1 × Rs. 1,200. Invoice Discount = Rs. 200. `subtotal = 1200`, `discount = 200`, `net_total = 1000`.
     - Tendered: Cash Rs. 5,000 (Customer hands 5,000 note; change is Rs. 4,000).
     - Stored Fields:
       * `subtotal = 1200.00`, `discount = 200.00`, `net_total = 1000.00`
       * `paid_amount = 1000.00` (Capped at net_total, NOT 5000!)
       * `cash_paid = 1000.00` (Net retained cash, NOT 5000!)
       * `card_paid = 0.00`, `bank_paid = 0.00`, `others_paid = 0.00`
       * `due_amount = 0.00` (Change returned = Rs. 4,000, not stored in DB, printed on slip only).
  3. **Case 3: Partial Credit Sale (Registered Account)**
     - Customer: "Al-Rehman Builders" (`client_id` present).
     - Line Items: 3 × Rs. 1,000 = Rs. 3,000 subtotal. Discount = Rs. 0. `net_total = 3000`.
     - Tendered: Cash Rs. 1,000. Balance on account: Rs. 2,000.
     - Stored Fields:
       * `subtotal = 3000.00`, `discount = 0.00`, `net_total = 3000.00`
       * `paid_amount = 1000.00`, `cash_paid = 1000.00`, `card_paid = 0.00`, `bank_paid = 0.00`, `others_paid = 0.00`
       * `due_amount = 2000.00`
       * Atomic RPC updates `clients.current_balance = current_balance + 2000.00`.

---

### A3. Full Receipt Token Audit (Decision D4)
Audit of every location across the codebase where tokens or claim codes could leak into receipt rendering:

| Component / File | Line Numbers | Token Content / Leak Vector | Action Required for D4 |
| :--- | :--- | :--- | :--- |
| `src/utils/receiptRenderCore.ts` | L23, L30, L352–366 | `TokenClaimSlipConfig` normalized from template JSON | Suppress/disable; template key must be ignored |
| `src/utils/receiptRenderCore.ts` | L636–638, L693, L712 | `${tokenNoteHtml}` rendered under item name | Suppress `tokenNoteHtml` generation entirely (`tokenNoteHtml = ''`) |
| `src/utils/receiptRenderCore.ts` | L889–912 | `tokenClaimSlipSection` generating `&#127915; Token Claim Slip`, claim code `CLM-...`, and instructions | Remove/disable block so `tokenClaimSlipSection = ''` unconditionally |
| `src/utils/receiptAdapters.ts` | L27–31, L44 | `tokenNote = 'Token removed — Rs. ... deducted'` | Set `tokenNote = undefined` |
| `src/utils/receiptAdapters.ts` | L73–74 | `tokenClaimCode: data.token_claim_code`, `tokenClaimDetails` | Set to `undefined` in receipt adapter |
| `src/utils/receiptCanvas.ts` | L22–27, L242 | Canvas summary row `' • Tokens/Other:'` | Update canvas summary label to `' • Other Payments:'` |
| `src/types/receipt.ts` | L105–111, L120, L241–248 | `TokenClaimSlipConfig` and default template slip text | Legacy schema retained; rendering engine ignores it |
| `src/components/PosBilling.tsx` | L1047–1057 | Generates `CLM-...` string on walk-in token keep | Unused by renderer; POS token business logic remains intact |
| `src/components/dev-panel/DevReceiptPreview.tsx` | L59, L92–93, L562–620 | Dev preview sample token claim slip | Update dev preview to reflect disabled slip |

- **One Approved Regular Receipt Change:** Disable `tokenClaimSlipSection` and `tokenNoteHtml` inside `src/utils/receiptRenderCore.ts`. All receipt types (regular, special, reprint, return) share this rendering core and will immediately produce token-free receipts.
- **Known Business Consequence:** Walk-in customers who retain tokens will no longer receive a printed paper claim slip. (Approved by owner Ali).

---

### A4. Code Paths Modifying Invoices/Invoice Items After Creation
We audited all API routes, database functions, and frontend components to identify every code path that mutates `invoices` or `invoice_items` rows:

1. **`PATCH /api/invoices` (`update_invoice_atomic` RPC):**
   - **File:** `src/app/api/invoices/route.ts:335–513`, migration `20261007_01_update_invoice_atomic.sql`.
   - **Capability:** Reopens an invoice, deletes items, inserts replacement items, recalculates subtotal/discount/net_total, adjusts stock and client balances.
   - **Special Receipt Rule (D1):** **MUST BE BLOCKED.** Both `update_invoice_atomic` and `PATCH /api/invoices` must reject if `invoices.printed_as = 'special'` with exception: `Special invoices cannot be edited. Cancel and issue a new sale.`
2. **`DELETE /api/invoices` / `PATCH status='cancelled'` (`cancel_invoice_atomic` RPC):**
   - **File:** `src/app/api/invoices/route.ts:372–385, 516–550`, migration `20261002_02_atomic_invoice_tokens.sql:350–430`.
   - **Capability:** Marks invoice `status = 'cancelled'`, reverts inventory back into stock, and reverses client balance or store credit.
   - **Special Receipt Rule:** Allowed. If a special sale was entered incorrectly, it must be cancelled here, and a new special sale issued. The `special_print_log` row is preserved for audit.
3. **Client Credit Recovery (`/api/ledgers`, `ClientCreditRecovery.tsx`):**
   - Creates ledger entries and updates `clients.current_balance`. Does **NOT** mutate `invoices` or `invoice_items` rows.
4. **Petty Expenses / Cash Vouchers (`/api/vouchers`):**
   - Creates `vouchers` rows. Does **NOT** mutate `invoices` or `invoice_items` rows.
5. **Shift Close / Day Close (`/api/shifts`):**
   - Closes shifts and records expected vs counted cash. Does **NOT** mutate existing `invoices` or `invoice_items` rows.

---

### A5. Return Handling in Detail: DB, Cash Reconciliation, and Reports
- **In `create_invoice_atomic` (`20261002_02_atomic_invoice_tokens.sql:252–297`):**
  - **Stock:** Increases stock (`UPDATE items SET stock_qty = stock_qty + v_item_qty`).
  - **Client Store Credit:** If `client_id` is present, `v_store_credit := GREATEST(0, v_net_total - v_cash_refunded)`. If `v_store_credit > 0`, decreases client debt: `UPDATE clients SET current_balance = current_balance - v_store_credit`.
  - **Sign of Fields:** In the `invoices` table, `subtotal`, `net_total`, `cash_paid`, and `paid_amount` are stored as **POSITIVE** numbers. The return nature is indicated strictly by `invoice_type = 'return'`.
- **In Day Close and Shift Drawer (`src/app/api/shifts/route.ts:255–278`):**
  - Cash reconciliation loops over shift invoices:
    ```ts
    const isReturn = (inv.invoice_type || 'sales') === 'return';
    if (isReturn) cashReturns += cashAmount;
    else cashIn += cashAmount;
    ```
  - Closing Cash Drawer Formula: `Expected Cash = Opening Cash + cashIn - cashReturns - supplierPurchases - pettyExpenses`.
  - Cash refunds reduce the cashier's expected drawer cash Rs-for-Rs.
- **In Reporting & Financial Math (`src/utils/salesMath.ts:80–103`, `get_ceo_branches_kpi_summary`):**
  - `Net Sales = Sum(forward.net_total) - Sum(return.net_total)`.
  - `get_ceo_branches_kpi_summary` explicitly filters `AND COALESCE(i.invoice_type, '') <> 'return'` to separate gross sales from returns.
- **Numeric Example of Return Impact:**
  - Forward Special Sale: Net Rs. 10,000 (Cash Rs. 10,000). Drawer cash = +Rs. 10,000.
  - Special Return: 1 item returned for Net Rs. 2,000 (Cash Refund Rs. 2,000). Drawer cash = -Rs. 2,000.
  - Shift Closing Expected Cash: Rs. 8,000.
  - Net Sales: Rs. 8,000.

---

### D5. Pre-Existing Issues Found (Out of Scope — Propose Minimal Fixes Separately)

1. **Issue 1: Public Exposure of Sensitive Tenant Info (`GET /api/tenants?slug=`)**
   - **Current State:** Returns `select('*')` including owner phone, email, address, commission settings without authentication.
   - **Proposed Minimal Fix (TASK-FIX-01, Approval-Required):**
     Change `src/app/api/tenants/route.ts:16` to project only public branding fields:
     `.select('id, name, slug, phone, city, address, receipt_footer, receipt_header')`.
2. **Issue 2: CEO Owner Name / Email Cross-Tenant Leakage**
   - **Current State:** `GET /api/tenants` matches on `owner_name` or `email`, accidentally grouping unrelated tenants if names collide.
   - **Proposed Minimal Fix (TASK-FIX-02, Approval-Required):**
     Add an optional `company_id UUID REFERENCES companies(id)` column to `tenants`, or scope strictly to `auth.session.tenantId` until explicit company grouping is designed.

---

### D6. Shift Ownership & Binding (Evidence for F5)
- **`src/app/api/shifts/route.ts` line 126:**
  ```ts
  activeShift: shifts?.find(s => s.status === 'open') || null,
  ```
  Shifts are queried per tenant (`where tenant_id = tenantId`). The API returns the first shift where `status = 'open'`.
- **`src/app/[slug]/page.tsx` line 179 & line 766:**
  ```tsx
  // Line 179:
  const shiftRes = await fetch(`/api/shifts?tenant_id=${targetTenantId}&status=open`);
  // Line 766:
  <PosBilling shiftId={activeShift?.id} ... />
  ```
- **`src/components/PosBilling.tsx` line 945:**
  ```ts
  const invoicePayload = {
    tenant_id: tenantId,
    invoice_no: invoiceNo,
    client_id: selectedClient?.id || null,
    client_name: customerDisplayName,
    shift_id: shiftId || null,
    ...
  ```
- **`src/app/api/invoices/route.ts` line 124 & line 260:**
  The API route receives `shift_id` in the request body and puts `shift_id: shift_id || null` into `invoiceData`, which is passed to `create_invoice_atomic`.
- **Finding:** Regular checkout binds `shift_id` from the client/session (the active open shift of the tenant). The database RPC does not guess or query shifts; it simply stores the passed `shift_id`. Both Special Sale and Special Return routes must mirror this exact mechanism: the API route accepts `shift_id` from the client or resolves the active open shift of the tenant, and passes it into the RPC.

---

### D7. Detailed Code Evidence for `salesMath` / `others_paid` (Evidence for F6)
1. **`src/utils/salesMath.ts` lines 141–153:**
   ```ts
   returns.forEach(inv => {
     const paid = Number(inv.paid_amount || 0);
     let invCash = Number(inv.cash_paid || 0);
     let invCard = Number(inv.card_paid || 0);
     let invBank = Number(inv.bank_paid || 0);

     if (invCash === 0 && invCard === 0 && invBank === 0 && paid > 0) {
       invCash = paid;
     }

     physicalCash -= invCash;
     digitalPaid -= (invCard + invBank);
   });
   ```
   **Observation:** If a return invoice has `paid_amount > 0` with `cash_paid = 0, card_paid = 0, bank_paid = 0` (for example, if a cashier recorded store credit into `others_paid = 5000` and `paid_amount = 5000`), the condition `invCash === 0 && invCard === 0 && invBank === 0 && paid > 0` evaluates to **true**! It falls back to `invCash = paid` and executes `physicalCash -= invCash`. Thus, in `salesMath.ts`, placing store credit into `others_paid` with a non-zero `paid_amount` **mistakenly subtracts cash from physical drawer cash**!
2. **`src/app/api/shifts/route.ts` lines 266–278:**
   ```ts
   shiftInvoices.forEach((inv: any) => {
     const isReturn = (inv.invoice_type || 'sales') === 'return';
     const cp = Number(inv.cash_paid || 0);
     const pt = (inv.payment_type || '').toLowerCase();
     const fallbackAmount = Number(inv.paid_amount || inv.net_total || 0);
     const cashAmount = cp > 0 ? cp : (!pt || pt === 'cash' || pt === 'refund' ? fallbackAmount : 0);

     if (isReturn) {
       cashReturns += cashAmount;
     } else {
       cashIn += cashAmount;
     }
   });
   ```
   **Observation:** In `shifts/route.ts`, if `cp = 0` and `payment_type = 'others'`, `cashAmount` is 0. But if `payment_type` is omitted or `'cash'` or `'refund'`, it subtracts `paid_amount || net_total`.
3. **`src/utils/cashReconciliation.ts` line 28:**
   ```ts
   return opening + sales - returns - exp - supplier - token;
   ```
   Authoritative formula takes `returns` as an input parameter (which comes from `cashReturns`).
4. **`src/components/ShiftDrawer.tsx` lines 234–241:**
   ```ts
   const cashReturns = returnInvoices.reduce((s, i) => {
     const cp = Number(i.cash_paid || 0);
     if (cp > 0) return s + cp;
     if (!i.payment_type || i.payment_type === 'cash') {
       return s + Number(i.paid_amount || i.grandTotal || i.net_total || 0);
     }
     return s;
   }, 0);
   ```
   **Observation:** `cashReturns` in `ShiftDrawer.tsx` only sums rows where `cash_paid > 0` or (`!payment_type || payment_type === 'cash'`).
5. **`get_ceo_branches_kpi_summary` (verified via `pg_get_functiondef`):**
   ```sql
   WHERE i.tenant_id = ANY(p_tenant_ids)
     AND COALESCE(i.status, '') <> 'cancelled'
     AND COALESCE(i.invoice_type, '') <> 'return'
   ```
   **Observation:** Returns are completely excluded from `inv_summary`, and `others_paid` is never inspected.
6. **Owner Decision & Rule Rewrite (Server Khata Offset & Drawer Safety):**
   Under the final owner decision, there is NO store credit and no client advance. Refunds are strictly cash, card, or cash+card (`mixed`).
   On credit-sale returns, the server computes:
   $\text{khata\_offset} = \max(0, \min(\text{return\_net}, \text{original.due\_amount} - \sum(\text{prior offsets}), \text{clients.current\_balance}))$
   where prior offsets are dynamically derived as `SUM(net_total - paid_amount)` over prior non-cancelled special returns of that original invoice.
   The remainder (`return_net - khata_offset`) is disbursed as cash and/or card (`cash_paid`, `card_paid`), with `paid_amount = cash_paid + card_paid`.
   If a return is 100% absorbed by debt reduction (`khata_offset = return_net`), then `cash_paid = 0, card_paid = 0, paid_amount = 0, payment_type = 'cash'`.
   Because `paid_amount = 0`, `src/utils/salesMath.ts:147–150` condition `invCash === 0 && invCard === 0 && invBank === 0 && paid > 0` evaluates to **false**, guaranteeing physical drawer cash is completely untouched!
   When cash is disbursed (`cash_paid > 0`), `physicalCash -= cash_paid` correctly deducts only the physical cash handed to the customer.
   When card is disbursed (`card_paid > 0`), `digitalPaid -= card_paid` correctly accounts for the card refund.

---

### D8. Card Refund Double-Refund Bug in Live `create_invoice_atomic` (Evidence for F2)
- **Live code in `create_invoice_atomic` lines 622–632:**
  ```sql
  IF v_is_return THEN
    v_cash_refunded := CASE
      WHEN v_cash_paid > 0 THEN v_cash_paid
      WHEN LOWER(v_payment_type) IN ('cash', 'refund') THEN v_paid_amount
      ELSE 0
    END;
    v_store_credit := GREATEST(0, v_net_total - v_cash_refunded);
    IF v_store_credit > 0 THEN
      UPDATE clients
         SET current_balance = current_balance - v_store_credit
       WHERE id = v_client_id;
    END IF;
  ```
- **Bug Analysis:**
  If a registered client does a return refunded to their CARD:
  The client POS sends `cash_paid = 0, card_paid = net_total, paid_amount = net_total, payment_type = 'card'`.
  Because `payment_type` is `'card'`, `LOWER(v_payment_type) IN ('cash', 'refund')` is **false**.
  `v_cash_paid` is 0.
  Therefore, `v_cash_refunded` is evaluated to **0**!
  Then `v_store_credit := GREATEST(0, v_net_total - 0) = v_net_total`.
  Then `UPDATE clients SET current_balance = current_balance - v_store_credit` executes!
  The client received the refund on their card, **AND** had their khata debt reduced by the refund amount! This is a severe double-refund bug in `create_invoice_atomic`.
- **Cancel Asymmetry in Live `cancel_invoice_atomic` lines 907–917:**
  ```sql
  v_cash_ref := CASE
    WHEN COALESCE(v_invoice.cash_paid, 0) > 0 THEN v_invoice.cash_paid
    WHEN LOWER(COALESCE(v_invoice.payment_type, '')) IN ('cash', 'refund') THEN v_invoice.paid_amount
    ELSE 0
  END;
  v_store_credit := GREATEST(0, v_invoice.net_total - v_cash_ref);
  IF v_store_credit > 0 THEN
    UPDATE clients
       SET current_balance = current_balance + v_store_credit
     WHERE id = v_invoice.client_id;
  END IF;
  ```
  `cancel_invoice_atomic` uses the identical flawed formula. If a card return had `cash_paid = 0`, cancelling it adds `v_store_credit` back to `clients.current_balance`!
- **Resolution for Special Returns:**
  `create_special_return_atomic` uses Option (a): it inserts the return invoice and items directly, bypassing `create_invoice_atomic`. It updates `clients.current_balance` **ONLY** when `payment_type = 'credit'` (store credit), guaranteeing that card refunds do not touch the client balance.

---

### D9. Staging Project Verification Proof (Evidence for F10)
- **Supabase Management API Call:** `supabase-mcp-server:list_projects` executed on 2026-10-21.
- **Output Excerpt:**
  ```json
  {
    "id": "azzonbwaevtywisxlxej",
    "ref": "azzonbwaevtywisxlxej",
    "organization_id": "zkrcldciosywbpnsfabz",
    "name": "for staging",
    "region": "ap-northeast-2",
    "created_at": "2026-10-13T17:34:09.916308Z",
    "status": "ACTIVE_HEALTHY",
    "database": {
      "host": "db.azzonbwaevtywisxlxej.supabase.co",
      "version": "17.11.0.003",
      "postgres_engine": "17",
      "release_channel": "ga"
    }
  }
  ```
- **Finding:** Project ID `azzonbwaevtywisxlxej` is verified with 100% certainty as the official staging database project named "for staging", running PostgreSQL 17.11 in region `ap-northeast-2`.

---

### D10. Additional Schema Verification — This Round (F1/F7/F8/F9 Fix)

Executed via `information_schema.columns` on `ignspvajzblmsbertmmv` on 2026-10-21 (READ-ONLY).

#### `public.brands` (relevant to Test 7 insert)
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `tenant_id` | uuid | NO | *none* |
| `name` | text | NO | *none* |
| `status` | text | **NO** | **`'active'::text`** |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Impact:** `brands.status` is NOT NULL with default `'active'`. Existing test INSERT `(id, tenant_id, name)` omitting `status` is valid — default is applied. ✅ No test change needed.

#### `public.clients` (relevant to Test 9)
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `tenant_id` | uuid | NO | *none* |
| `code` | text | **YES** | *none* |
| `name` | text | NO | *none* |
| `credit_limit` | numeric | YES | `0.00` |
| `current_balance` | numeric | YES | `0.00` |
| `token_balance` | numeric | YES | `0` |

**Impact:** `clients.code` is nullable. `INSERT (id, tenant_id, name, current_balance)` in Test 9 is valid. ✅ No test change needed.

#### `public.items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `tenant_id` | uuid | NO | *none* |
| `code` | text | **NO** | *none* |
| `name` | text | NO | *none* |
| `unit` | text | YES | `'Unit'::text` |
| `cost_price` | numeric | YES | `0.00` |
| `retail_price` | numeric | YES | `0.00` |
| `stock_qty` | numeric | YES | `0.00` |
| `brand` | text | NO | `'General'::text` |
| `brand_id` | uuid | YES | *none* |
| `series_id` | uuid | YES | *none* |

**Impact:** `items.code` is NOT NULL with no default — all staging test INSERTs correctly supply `code`. ✅

#### `public.invoice_items` (needed for F1 Option (a) direct INSERT design)
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `invoice_id` | uuid | NO | *none* |
| `item_id` | uuid | **YES** | *none* |
| `item_code` | text | YES | *none* |
| `item_name` | text | NO | *none* |
| `unit` | text | YES | *none* |
| `qty` | numeric | NO | `1.00` |
| `unit_price` | numeric | NO | `0.00` |
| `discount` | numeric | YES | `0.00` |
| `discount_percent` | numeric | YES | `0` |
| `total_price` | numeric | NO | `0.00` |
| `shade_code` | text | YES | *none* |
| `pack_size` | text | YES | *none* |
| `original_invoice_item_id` | uuid | YES | *none* (added by migration) |

**Impact on F1 Option (a):** The direct INSERT in `create_special_return_atomic` supplies all NOT NULL columns without defaults (`invoice_id`, `item_name`). All other used columns (`item_id`, `item_code`, `unit`, `shade_code`, `pack_size`) are nullable. INSERT will succeed without errors. ✅

#### `public.invoices` (needed for F1 Option (a) direct header INSERT)
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `tenant_id` | uuid | NO | *none* |
| `invoice_no` | text | NO | *none* |
| `invoice_type` | text | YES | `'sales'::text` |
| `status` | text | YES | `'completed'::text` |
| `client_id` | uuid | YES | *none* |
| `client_name` | text | YES | *none* |
| `shift_id` | uuid | YES | *none* |
| `date` | date | YES | `CURRENT_DATE` |
| `subtotal` | numeric | YES | `0.00` |
| `discount` | numeric | YES | `0.00` |
| `delivery_charge` | numeric | YES | `0` |
| `net_total` | numeric | YES | `0.00` |
| `paid_amount` | numeric | YES | `0.00` |
| `due_amount` | numeric | YES | `0.00` |
| `cash_paid` | numeric | YES | `0` |
| `card_paid` | numeric | YES | `0` |
| `bank_paid` | numeric | YES | `0` |
| `others_paid` | numeric | YES | `0` |
| `payment_type` | text | YES | `'cash'::text` |
| `created_by` | text | YES | *none* |
| `remarks` | text | YES | *none* |

**Impact on F1 Option (a):** Only `tenant_id` and `invoice_no` are NOT NULL without defaults. Direct INSERT supplies all required columns explicitly. `printed_as` and `original_invoice_id` (added by migration) will be nullable with safe defaults. ✅

---

### 5.7 Mixed Tender Semantics & Live Cancel Asymmetry (R1c & R2)
- **Live Function Inspection (`cancel_invoice_atomic:907–917`):**
  ```sql
  v_cash_ref := CASE
    WHEN COALESCE(v_invoice.cash_paid, 0) > 0 THEN v_invoice.cash_paid
    WHEN LOWER(COALESCE(v_invoice.payment_type, '')) IN ('cash', 'refund') THEN v_invoice.paid_amount
    ELSE 0
  END;
  v_store_credit := GREATEST(0, v_invoice.net_total - v_cash_ref);
  IF v_store_credit > 0 THEN
    UPDATE clients SET current_balance = current_balance + v_store_credit WHERE id = v_invoice.client_id;
  END IF;
  ```
- **Incompatibility with Mixed Returns:**
  `cancel_invoice_atomic` has no awareness of `card_paid`. On a return with mixed tender (e.g. net 1,400, cash 500, card 500, store credit 400), `v_cash_ref` evaluates to 500. `v_store_credit` evaluates to `1400 - 500 = 900`. The function credits Rs. 900 to `clients.current_balance` instead of the original store credit Rs. 400, erroneously converting Rs. 500 of card refund into store credit and corrupting the client's ledger.
- **Real API Cancellation Endpoints:**
  Verified in `src/app/api/invoices/route.ts`:
  - `PATCH /api/invoices` (lines 371–385): Handles cancellation when `status === 'cancelled'` or `body.action === 'cancel'`.
  - `DELETE /api/invoices` (lines 535–546): Handles invoice deletion/cancellation with reason.
  - *Note:* No endpoint named `/api/invoices/cancel` exists in the repository.
- **Decision D5 & Residual Risk:**
  Decision D5 requires `PATCH /api/invoices` and `DELETE /api/invoices` to reject cancelling return invoices.
  *Residual Risk:* `cancel_invoice_atomic` is a `SECURITY DEFINER` RPC. If direct PostgREST RPC access is exposed to authenticated users, a direct RPC call could bypass Next.js API guards and trigger this asymmetry unless a database-level guard is added in a future refactor.

### 5.8 Downstream Systems Compatibility with `payment_type = 'mixed'`
- **`src/utils/salesMath.ts:141–153`:**
  ```ts
  returns.forEach(inv => {
    const paid = Number(inv.paid_amount || 0);
    let invCash = Number(inv.cash_paid || 0);
    let invCard = Number(inv.card_paid || 0);
    let invBank = Number(inv.bank_paid || 0);
    if (invCash === 0 && invCard === 0 && invBank === 0 && paid > 0) invCash = paid;
    physicalCash -= invCash;
    digitalPaid -= (invCard + invBank);
  });
  ```
  *Result:* Compatible. `physicalCash -= cash_paid`, `digitalPaid -= card_paid`. Store credit portion is not deducted from cash drawer or digital totals.
- **`src/components/ShiftDrawer.tsx:234–241`:**
  ```tsx
  const cashReturns = returnInvoices.reduce((s, i) => {
    const cp = Number(i.cash_paid || 0);
    if (cp > 0) return s + cp;
    if (!i.payment_type || i.payment_type === 'cash') {
      return s + Number(i.paid_amount || i.grandTotal || i.net_total || 0);
    }
    return s;
  }, 0);
  ```
  *Result:* Compatible. `cp > 0` returns `cash_paid`. When `cash_paid == 0`, `payment_type = 'mixed'` prevents fallback phantom cash deductions.
- **`src/app/api/shifts/route.ts:268–274`:**
  ```ts
  const cp = Number(inv.cash_paid || 0);
  const pt = (inv.payment_type || '').toLowerCase();
  const fallbackAmount = Number(inv.paid_amount || inv.net_total || 0);
  const cashAmount = cp > 0 ? cp : (!pt || pt === 'cash' || pt === 'refund' ? fallbackAmount : 0);
  if (isReturn) cashReturns += cashAmount;
  ```
  *Result:* Compatible. Correctly adds `cash_paid` to `cashReturns`.

---

## UNVERIFIED Items

The following items could not be verified against the live database in this round and are explicitly marked UNVERIFIED per the Honesty Rule:

| # | Item | Reason |
| :--- | :--- | :--- |
| U1 | Exact `create_invoice_atomic` internal line numbers for item INSERT ordering | The live function definition was verified in a prior round but the exact row insertion order for `invoice_items` within a transaction was not formally benchmarked. Confirmed as irrelevant to the plan because Option (a) does not use `create_invoice_atomic` for return item inserts. |
| U2 | Physical printer driver and OS font rendering on thermal hardware | Requires on-site hardware testing. Cannot be verified via DB queries or code inspection. |
| U3 | `invoice_items.original_invoice_item_id` data type and NOT NULL constraint | Column does not yet exist in live DB (added by migration). Planned as `UUID nullable` — consistent with similar plain UUID columns (`invoices.original_invoice_id`). |
| U4 | `invoices.printed_as` CHECK constraint exact syntax after migration apply | Column added by migration; constraint text in migration draft is the plan, not yet deployed. |
| U5 | Whether `create_invoice_atomic` already reads `original_invoice_item_id` from the items JSONB | Not verified; irrelevant since Option (a) does not use `create_invoice_atomic` for return item inserts. |
