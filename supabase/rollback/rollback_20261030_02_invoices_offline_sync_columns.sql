-- Rollback for 20261030_02_invoices_offline_sync_columns.sql

DROP INDEX IF EXISTS idx_invoices_local_receipt_search;
DROP INDEX IF EXISTS idx_invoices_offline_dedup;

ALTER TABLE invoices
  DROP COLUMN IF EXISTS is_offline,
  DROP COLUMN IF EXISTS created_at_local,
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS local_receipt_no,
  DROP COLUMN IF EXISTS synced_at,
  DROP COLUMN IF EXISTS offline_schema_version;

