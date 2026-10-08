[
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.process_branch_dispatch_atomic\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "process_branch_dispatch_atomic",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_process_branch_dispatch_atomic_96f5a24368283392cbcc471bde45b3df",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.process_branch_receive_atomic\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "process_branch_receive_atomic",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_process_branch_receive_atomic_2cc408103f395b50b1a3c420ef9ab050",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.get_ceo_branches_kpi_summary\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "get_ceo_branches_kpi_summary",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_get_ceo_branches_kpi_summary_4ade24c0573a6c2d26b0b751f60a0e88",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.set_default_receipt_template\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "set_default_receipt_template",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_set_default_receipt_template_a3fd45c20ecf7164c6c85a7dddee8e90",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.check_rate_limit_atomic\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "check_rate_limit_atomic",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_check_rate_limit_atomic_2177982e96a78ce35af0ebedfbab3a82",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.reset_rate_limit_atomic\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "reset_rate_limit_atomic",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_reset_rate_limit_atomic_589645387ab1f1177fdbc68264cdda48",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.adjust_item_stock(p_item_id uuid, p_qty_delta numeric)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/adjust_item_stock`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "adjust_item_stock",
      "language": "plpgsql",
      "arguments": "p_item_id uuid, p_qty_delta numeric",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_adjust_item_stock_p_item_id uuid, p_qty_delta numeric",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.adjust_item_stock_by_code(p_tenant_id uuid, p_item_code text, p_qty_delta numeric)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/adjust_item_stock_by_code`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "adjust_item_stock_by_code",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_item_code text, p_qty_delta numeric",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_adjust_item_stock_by_code_p_tenant_id uuid, p_item_code text, p_qty_delta numeric",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.cancel_invoice_atomic(p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_invoice_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "cancel_invoice_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_cancel_invoice_atomic_p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.cancel_purchase_atomic(p_tenant_id uuid, p_purchase_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_purchase_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "cancel_purchase_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_purchase_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_cancel_purchase_atomic_p_tenant_id uuid, p_purchase_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.check_rate_limit_atomic(p_key text, p_max_attempts integer, p_window_seconds integer)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/check_rate_limit_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "check_rate_limit_atomic",
      "language": "plpgsql",
      "arguments": "p_key text, p_max_attempts integer, p_window_seconds integer",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_check_rate_limit_atomic_p_key text, p_max_attempts integer, p_window_seconds integer",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.create_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_tokens jsonb)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_invoice_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "create_invoice_atomic",
      "language": "plpgsql",
      "arguments": "p_invoice_data jsonb, p_items jsonb, p_tokens jsonb",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_create_invoice_atomic_p_invoice_data jsonb, p_items jsonb, p_tokens jsonb",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.create_purchase_atomic(p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[])` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_purchase_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "create_purchase_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_create_purchase_atomic_p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[])` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_voucher_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "create_voucher_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[]",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_create_voucher_atomic_p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[]",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_ceo_branches_kpi_summary(p_tenant_ids uuid[], p_today date)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_ceo_branches_kpi_summary`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "get_ceo_branches_kpi_summary",
      "language": "plpgsql",
      "arguments": "p_tenant_ids uuid[], p_today date",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_ceo_branches_kpi_summary_p_tenant_ids uuid[], p_today date",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.process_branch_dispatch_atomic(p_order_id uuid, p_to_tenant_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/process_branch_dispatch_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "process_branch_dispatch_atomic",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_to_tenant_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_process_branch_dispatch_atomic_p_order_id uuid, p_to_tenant_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.process_branch_receive_atomic(p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/process_branch_receive_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "process_branch_receive_atomic",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_process_branch_receive_atomic_p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.receive_goods_atomic(p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/receive_goods_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "receive_goods_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_receive_goods_atomic_p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.redeem_tokens_atomic(p_redemption_data jsonb, p_lines jsonb)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/redeem_tokens_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "redeem_tokens_atomic",
      "language": "plpgsql",
      "arguments": "p_redemption_data jsonb, p_lines jsonb",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_redeem_tokens_atomic_p_redemption_data jsonb, p_lines jsonb",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.reserve_ai_usage(p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reserve_ai_usage`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "reserve_ai_usage",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_reserve_ai_usage_p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.reset_rate_limit_atomic(p_key text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reset_rate_limit_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "reset_rate_limit_atomic",
      "language": "plpgsql",
      "arguments": "p_key text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_reset_rate_limit_atomic_p_key text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.set_default_receipt_template(p_template_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/set_default_receipt_template`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "set_default_receipt_template",
      "language": "plpgsql",
      "arguments": "p_template_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_set_default_receipt_template_p_template_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.settle_tokens_atomic(p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/settle_tokens_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "settle_tokens_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_settle_tokens_atomic_p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.update_invoice_atomic(p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_invoice_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "update_invoice_atomic",
      "language": "plpgsql",
      "arguments": "p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_update_invoice_atomic_p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.adjust_item_stock(p_item_id uuid, p_qty_delta numeric)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/adjust_item_stock`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "adjust_item_stock",
      "language": "plpgsql",
      "arguments": "p_item_id uuid, p_qty_delta numeric",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_adjust_item_stock_p_item_id uuid, p_qty_delta numeric",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.adjust_item_stock_by_code(p_tenant_id uuid, p_item_code text, p_qty_delta numeric)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/adjust_item_stock_by_code`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "adjust_item_stock_by_code",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_item_code text, p_qty_delta numeric",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_adjust_item_stock_by_code_p_tenant_id uuid, p_item_code text, p_qty_delta numeric",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cancel_invoice_atomic(p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_invoice_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "cancel_invoice_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cancel_invoice_atomic_p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cancel_purchase_atomic(p_tenant_id uuid, p_purchase_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_purchase_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "cancel_purchase_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_purchase_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cancel_purchase_atomic_p_tenant_id uuid, p_purchase_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.check_rate_limit_atomic(p_key text, p_max_attempts integer, p_window_seconds integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/check_rate_limit_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "check_rate_limit_atomic",
      "language": "plpgsql",
      "arguments": "p_key text, p_max_attempts integer, p_window_seconds integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_check_rate_limit_atomic_p_key text, p_max_attempts integer, p_window_seconds integer",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_tokens jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_invoice_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "create_invoice_atomic",
      "language": "plpgsql",
      "arguments": "p_invoice_data jsonb, p_items jsonb, p_tokens jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_invoice_atomic_p_invoice_data jsonb, p_items jsonb, p_tokens jsonb",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_purchase_atomic(p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[])` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_purchase_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "create_purchase_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_purchase_atomic_p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[])` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_voucher_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "create_voucher_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[]",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_voucher_atomic_p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[]",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_ceo_branches_kpi_summary(p_tenant_ids uuid[], p_today date)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_ceo_branches_kpi_summary`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "get_ceo_branches_kpi_summary",
      "language": "plpgsql",
      "arguments": "p_tenant_ids uuid[], p_today date",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_ceo_branches_kpi_summary_p_tenant_ids uuid[], p_today date",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.process_branch_dispatch_atomic(p_order_id uuid, p_to_tenant_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/process_branch_dispatch_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "process_branch_dispatch_atomic",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_to_tenant_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_process_branch_dispatch_atomic_p_order_id uuid, p_to_tenant_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.process_branch_receive_atomic(p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/process_branch_receive_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "process_branch_receive_atomic",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_process_branch_receive_atomic_p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.receive_goods_atomic(p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/receive_goods_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "receive_goods_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_receive_goods_atomic_p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.redeem_tokens_atomic(p_redemption_data jsonb, p_lines jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/redeem_tokens_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "redeem_tokens_atomic",
      "language": "plpgsql",
      "arguments": "p_redemption_data jsonb, p_lines jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_redeem_tokens_atomic_p_redemption_data jsonb, p_lines jsonb",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reserve_ai_usage(p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reserve_ai_usage`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "reserve_ai_usage",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reserve_ai_usage_p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reset_rate_limit_atomic(p_key text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reset_rate_limit_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "reset_rate_limit_atomic",
      "language": "plpgsql",
      "arguments": "p_key text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reset_rate_limit_atomic_p_key text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.set_default_receipt_template(p_template_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/set_default_receipt_template`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "set_default_receipt_template",
      "language": "plpgsql",
      "arguments": "p_template_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_set_default_receipt_template_p_template_id uuid",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.settle_tokens_atomic(p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/settle_tokens_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "settle_tokens_atomic",
      "language": "plpgsql",
      "arguments": "p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_settle_tokens_atomic_p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text",
    "observed_at": "2026-10-08T19:34:03.415Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_invoice_atomic(p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_invoice_atomic`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "update_invoice_atomic",
      "language": "plpgsql",
      "arguments": "p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_invoice_atomic_p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb",
    "observed_at": "2026-10-08T19:34:03.415Z"
  }
]