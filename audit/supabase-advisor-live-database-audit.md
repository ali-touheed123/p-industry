# LIVE SUPABASE DATABASE FORENSIC AUDIT

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Date:** October 9, 2026  
**Status:** **UNKNOWN — NOT VERIFIED** (System Catalog Read Access Unavailable)  

---

## 1. Database Connection Verification

Connection attempts to the live Supabase PostgreSQL instance (`https://ignspvajzblmsbertmmv.supabase.co`) were executed using `@supabase/supabase-js` (with `SUPABASE_SERVICE_ROLE_KEY`) and the Supabase CLI (`npx supabase`).

### Verification Test Results

| Connection Method | Target / Test Query | Result | Reason / Error |
|---|---|---|---|
| **Supabase PostgREST API** | `public.tenants` table query | **SUCCESS** (`count: 2`) | REST API endpoint is active and accessible via `service_role`. |
| **Supabase PostgREST API** | `pg_catalog.pg_tables` / `pg_proc` | **FAILED** (`PGRST205`) | PostgREST schema cache does not expose `pg_catalog` system tables over REST. |
| **Supabase CLI (`npx supabase`)** | `npx supabase db query --linked` | **FAILED** (`AccessTokenRequired`) | Requires active `SUPABASE_ACCESS_TOKEN` or interactive `supabase login`. |
| **Direct PostgreSQL Client (`pg`)** | TCP 5432/6543 connection | **FAILED** (Timeout/Auth) | Direct TCP access requires database password (`DATABASE_URL`), not JWT service role key. |
| **Custom SQL RPC Function** | `public.exec_sql()` / `public.query()` | **FAILED** (`PGRST205`) | No arbitrary SQL execution RPC function exists in the `public` schema. |

---

## 2. Live Database Identity

- **PostgreSQL Version:** UNKNOWN — NOT VERIFIED
- **Current Database:** UNKNOWN — NOT VERIFIED
- **Current User:** UNKNOWN — NOT VERIFIED
- **Current Role:** UNKNOWN — NOT VERIFIED
- **Current Schema:** UNKNOWN — NOT VERIFIED
- **Current `search_path`:** UNKNOWN — NOT VERIFIED
- **Environment Identity:** Supabase Cloud Project Reference `ignspvajzblmsbertmmv`

---

## 3. Comprehensive System Catalog Audits

Per explicit forensic rules, because direct SQL query execution against `pg_catalog` (system tables `pg_proc`, `pg_class`, `pg_policies`, `pg_roles`, `pg_indexes`, `pg_constraint`, `pg_trigger`) is unavailable via the exposed REST API and CLI access token is missing, the following sections CANNOT be live-verified from system catalogs and are strictly classified as:

**UNKNOWN — NOT VERIFIED**

- **Complete Schema Inventory:** UNKNOWN — NOT VERIFIED
- **Complete Table Inventory:** UNKNOWN — NOT VERIFIED
- **Complete RLS Inventory:** UNKNOWN — NOT VERIFIED
- **Complete Function / RPC Inventory:** UNKNOWN — NOT VERIFIED
- **SECURITY DEFINER Inventory:** UNKNOWN — NOT VERIFIED
- **Function Search Path Inventory:** UNKNOWN — NOT VERIFIED
- **Complete Grants / Privileges Inventory:** UNKNOWN — NOT VERIFIED
- **Complete Index Inventory:** UNKNOWN — NOT VERIFIED
- **Complete Constraint Inventory:** UNKNOWN — NOT VERIFIED
- **Complete Trigger Inventory:** UNKNOWN — NOT VERIFIED
- **View Inventory:** UNKNOWN — NOT VERIFIED
- **Sequence / Identity Inventory:** UNKNOWN — NOT VERIFIED
- **Extensions Inventory:** UNKNOWN — NOT VERIFIED
- **Aggregate Data Integrity Checks:** UNKNOWN — NOT VERIFIED

---

## 4. Advisor 59-Finding Reconciliation Status

- **Verified against Live Catalogs:** 0 / 59 (`UNKNOWN — NOT VERIFIED`)
- **Verified against Offline Source Exports (`supabase warnings.md`, `supabase info.md`):** 59 / 59 (42 WARN, 17 INFO)

---

## 5. Migration vs Live Database Drift

- **Database Drift Status:** UNKNOWN — NOT VERIFIED (Live database catalogs could not be diffed directly without direct PostgreSQL catalog access or `SUPABASE_ACCESS_TOKEN`).

---

## 6. Final Forensic Verdict

> **STOP / UNKNOWN — NOT VERIFIED**  
> Direct read-only system catalog access (`pg_catalog`) to the live PostgreSQL instance could not be established because PostgREST does not expose system tables over REST, direct PostgreSQL TCP connection requires database password credentials, and Supabase CLI requires a `SUPABASE_ACCESS_TOKEN`.  
>  
> To complete live database catalog verification, supply a `SUPABASE_ACCESS_TOKEN` for the Supabase CLI, or provide a direct PostgreSQL connection string (`DATABASE_URL`).
