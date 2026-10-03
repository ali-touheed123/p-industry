-- Migration: Centralized AI Usage & Gemini Control System
-- Date: 2026-10-03
-- Author: PyntFlow Architecture Team

BEGIN;

-- 1. Global AI Settings Table (Single row for platform-wide limits and kill switch)
CREATE TABLE IF NOT EXISTS public.global_ai_settings (
    id INT PRIMARY KEY DEFAULT 1 CONSTRAINT single_row_check CHECK (id = 1),
    ai_enabled BOOLEAN NOT NULL DEFAULT true,
    global_daily_request_cap INT NOT NULL DEFAULT 1000,
    global_monthly_request_cap INT NOT NULL DEFAULT 20000,
    global_monthly_cost_cap NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    short_term_rate_limit INT NOT NULL DEFAULT 5, -- requests per minute per shop
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial default global settings if not exists
INSERT INTO public.global_ai_settings (id, ai_enabled, global_daily_request_cap, global_monthly_request_cap, global_monthly_cost_cap, short_term_rate_limit)
VALUES (1, true, 1000, 20000, 50.00, 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Tenant AI Settings Table (Per-shop configurable limits)
CREATE TABLE IF NOT EXISTS public.tenant_ai_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    ai_enabled BOOLEAN NOT NULL DEFAULT true,
    daily_request_limit INT NOT NULL DEFAULT 3,
    monthly_request_limit INT NOT NULL DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_ai_settings_tenant_id ON public.tenant_ai_settings(tenant_id);

-- 3. Central AI Usage Ledger Table (Immutable record of every AI request)
CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    feature TEXT NOT NULL DEFAULT 'invoice_scanner',
    provider TEXT NOT NULL DEFAULT 'gemini',
    model TEXT NOT NULL DEFAULT 'gemini-3.5-flash-lite',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'reserved', -- 'reserved', 'success', 'failed'
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(10,6) NOT NULL DEFAULT 0.000000,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for rolling-window queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_tenant_requested ON public.ai_usage_ledger(tenant_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_tenant_status_requested ON public.ai_usage_ledger(tenant_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_global_requested ON public.ai_usage_ledger(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_global_status_requested ON public.ai_usage_ledger(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_request_id ON public.ai_usage_ledger(request_id);

-- RLS Policies for Security
ALTER TABLE public.global_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- Allow authenticated service role / backend full access
CREATE POLICY "Service role full access on global_ai_settings" ON public.global_ai_settings FOR ALL USING (true);
CREATE POLICY "Service role full access on tenant_ai_settings" ON public.tenant_ai_settings FOR ALL USING (true);
CREATE POLICY "Service role full access on ai_usage_ledger" ON public.ai_usage_ledger FOR ALL USING (true);


-- 4. Atomic AI Quota Reservation Function (Concurrency-safe)
-- Returns JSON: { "allowed": boolean, "code": text, "error": text, "ledger_id": uuid, "usage": object }
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
    p_tenant_id UUID,
    p_request_id TEXT,
    p_feature TEXT DEFAULT 'invoice_scanner',
    p_provider TEXT DEFAULT 'gemini',
    p_model TEXT DEFAULT 'gemini-3.5-flash-lite'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_global RECORD;
    v_tenant RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_24h_ago TIMESTAMPTZ := v_now - INTERVAL '24 hours';
    v_30d_ago TIMESTAMPTZ := v_now - INTERVAL '30 days';
    v_1m_ago TIMESTAMPTZ := v_now - INTERVAL '1 minute';
    
    v_tenant_1m_count INT := 0;
    v_tenant_24h_count INT := 0;
    v_tenant_30d_count INT := 0;
    
    v_global_24h_count INT := 0;
    v_global_30d_count INT := 0;
    v_global_30d_cost NUMERIC(10,6) := 0.000000;
    
    v_new_ledger_id UUID;
BEGIN
    -- 1. Lock and fetch Global AI Settings
    SELECT * INTO v_global
    FROM public.global_ai_settings
    WHERE id = 1
    FOR UPDATE;
    
    IF NOT FOUND THEN
        -- Seed default row if somehow missing
        INSERT INTO public.global_ai_settings (id, ai_enabled) VALUES (1, true) RETURNING * INTO v_global;
    END IF;
    
    IF NOT v_global.ai_enabled THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'GLOBAL_AI_DISABLED',
            'error', 'AI services are currently disabled globally by administrator.'
        );
    END IF;

    -- 2. Lock and fetch (or auto-create default) Tenant AI Settings
    SELECT * INTO v_tenant
    FROM public.tenant_ai_settings
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        INSERT INTO public.tenant_ai_settings (tenant_id, ai_enabled, daily_request_limit, monthly_request_limit)
        VALUES (p_tenant_id, true, 3, 90)
        RETURNING * INTO v_tenant;
    END IF;

    IF NOT v_tenant.ai_enabled THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'SHOP_AI_DISABLED',
            'error', 'AI scanning feature is disabled for this shop.'
        );
    END IF;

    -- 3. Calculate Tenant Rolling Usage Metrics
    SELECT COUNT(*) INTO v_tenant_1m_count
    FROM public.ai_usage_ledger
    WHERE tenant_id = p_tenant_id
      AND requested_at >= v_1m_ago;
      
    IF v_tenant_1m_count >= v_global.short_term_rate_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'RATE_LIMIT_EXCEEDED',
            'error', 'Too many requests in a short time. Please wait a minute before trying again.'
        );
    END IF;

    SELECT COUNT(*) INTO v_tenant_24h_count
    FROM public.ai_usage_ledger
    WHERE tenant_id = p_tenant_id
      AND status IN ('reserved', 'success', 'failed')
      AND requested_at >= v_24h_ago;
      
    IF v_tenant_24h_count >= v_tenant.daily_request_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'DAILY_QUOTA_EXCEEDED',
            'error', 'Daily AI scan limit reached (' || v_tenant_24h_count || '/' || v_tenant.daily_request_limit || ').',
            'usage', jsonb_build_object(
                'daily_used', v_tenant_24h_count,
                'daily_limit', v_tenant.daily_request_limit,
                'monthly_used', v_tenant_30d_count,
                'monthly_limit', v_tenant.monthly_request_limit
            )
        );
    END IF;

    SELECT COUNT(*) INTO v_tenant_30d_count
    FROM public.ai_usage_ledger
    WHERE tenant_id = p_tenant_id
      AND status IN ('reserved', 'success', 'failed')
      AND requested_at >= v_30d_ago;
      
    IF v_tenant_30d_count >= v_tenant.monthly_request_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'MONTHLY_QUOTA_EXCEEDED',
            'error', 'Monthly AI scan limit reached (' || v_tenant_30d_count || '/' || v_tenant.monthly_request_limit || ').',
            'usage', jsonb_build_object(
                'daily_used', v_tenant_24h_count,
                'daily_limit', v_tenant.daily_request_limit,
                'monthly_used', v_tenant_30d_count,
                'monthly_limit', v_tenant.monthly_request_limit
            )
        );
    END IF;

    -- 4. Calculate Global Rolling Caps Metrics
    SELECT COUNT(*) INTO v_global_24h_count
    FROM public.ai_usage_ledger
    WHERE status IN ('reserved', 'success', 'failed')
      AND requested_at >= v_24h_ago;
      
    IF v_global_24h_count >= v_global.global_daily_request_cap THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'GLOBAL_DAILY_CAP_EXCEEDED',
            'error', 'Platform global daily AI limit has been reached. Please contact support.'
        );
    END IF;

    SELECT COUNT(*), COALESCE(SUM(estimated_cost), 0) INTO v_global_30d_count, v_global_30d_cost
    FROM public.ai_usage_ledger
    WHERE status IN ('reserved', 'success', 'failed')
      AND requested_at >= v_30d_ago;
      
    IF v_global_30d_count >= v_global.global_monthly_request_cap THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'GLOBAL_MONTHLY_CAP_EXCEEDED',
            'error', 'Platform global monthly AI limit has been reached. Please contact support.'
        );
    END IF;

    IF v_global_30d_cost >= v_global.global_monthly_cost_cap THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'code', 'GLOBAL_MONTHLY_COST_CAP_EXCEEDED',
            'error', 'Platform global monthly AI cost cap has been reached. Please contact support.'
        );
    END IF;

    -- 5. All authorizations passed: ATOMICALLY RESERVE USAGE IN LEDGER
    INSERT INTO public.ai_usage_ledger (
        request_id,
        tenant_id,
        feature,
        provider,
        model,
        requested_at,
        status
    )
    VALUES (
        p_request_id,
        p_tenant_id,
        p_feature,
        p_provider,
        p_model,
        v_now,
        'reserved'
    )
    RETURNING id INTO v_new_ledger_id;

    RETURN jsonb_build_object(
        'allowed', true,
        'ledger_id', v_new_ledger_id,
        'usage', jsonb_build_object(
            'daily_used', v_tenant_24h_count + 1,
            'daily_limit', v_tenant.daily_request_limit,
            'monthly_used', v_tenant_30d_count + 1,
            'monthly_limit', v_tenant.monthly_request_limit
        )
    );
END;
$$;

COMMIT;
