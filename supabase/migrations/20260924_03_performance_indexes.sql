-- Migration: Covering Indexes for Foreign Keys & Analytical Filter Performance
-- Fixes DB-14 (26 unindexed foreign keys identified by Supabase database advisor)

-- 1. Invoices & Invoice Items
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shift_id ON public.invoices(shift_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date ON public.invoices(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON public.invoice_items(item_id);

-- 2. Purchases & Purchase Items
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_id ON public.purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_date ON public.purchases(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON public.purchase_items(item_id);

-- 3. Shifts & Petty Expenses
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_id ON public.shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_status ON public.shifts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_start_time ON public.shifts(tenant_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_petty_expenses_tenant_id ON public.petty_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_petty_expenses_shift_id ON public.petty_expenses(shift_id);

-- 4. Vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_id ON public.vouchers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_party ON public.vouchers(tenant_id, party_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_date ON public.vouchers(tenant_id, date DESC);

-- 5. Clients & Suppliers
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON public.suppliers(tenant_id);

-- 6. Branch Orders & Order Items
CREATE INDEX IF NOT EXISTS idx_branch_orders_from_tenant ON public.branch_orders(from_tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_orders_to_tenant ON public.branch_orders(to_tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_order_items_order_id ON public.branch_order_items(order_id);

-- 7. App Users & Audit Logs
CREATE INDEX IF NOT EXISTS idx_app_users_tenant_id ON public.app_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- 8. Held Invoices & Templates
CREATE INDEX IF NOT EXISTS idx_held_invoices_tenant_id ON public.held_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_held_invoices_client_id ON public.held_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_tenant_receipt_template_template_id ON public.tenant_receipt_template(template_id);

-- 9. Token Transactions Missing FK Indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_invoice_id ON public.token_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_item_id ON public.token_transactions(item_id);
