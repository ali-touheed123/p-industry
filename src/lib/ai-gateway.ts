import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase';

// Gemini Pricing Rates (Per 1 Million Tokens)
export const GEMINI_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gemini-3.5-flash-lite': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  default: { inputPer1M: 0.10, outputPer1M: 0.40 },
};

export function calculateGeminiCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING.default;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

export interface AiUsageRequest {
  tenantId: string;
  feature?: string;
  provider?: string;
  preferredModel?: string;
  prompt: string;
  mediaInlineData?: {
    data: string;
    mimeType: string;
  };
  responseMimeType?: string;
  temperature?: number;
}

export interface ShopQuotaInfo {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  remainingDaily: number;
  remainingMonthly: number;
  aiEnabled: boolean;
}

export interface AiUsageResult<T = any> {
  success: boolean;
  data?: T;
  rawResponseText?: string;
  error?: string;
  errorCode?: string;
  requestId?: string;
  usage?: ShopQuotaInfo;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

// In-Memory Fallback State (Ensures reliability if DB tables are provisioning)
interface LedgerRecord {
  id: string;
  request_id: string;
  tenant_id: string;
  feature: string;
  provider: string;
  model: string;
  requested_at: string;
  status: 'reserved' | 'success' | 'failed';
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  metadata: Record<string, any>;
}

const memoryGlobalSettings = {
  id: 1,
  ai_enabled: true,
  global_daily_request_cap: 1000,
  global_monthly_request_cap: 20000,
  global_monthly_cost_cap: 50.0,
  short_term_rate_limit: 5,
};

const memoryTenantSettings = new Map<string, { ai_enabled: boolean; daily_request_limit: number; monthly_request_limit: number }>();
const memoryLedger: LedgerRecord[] = [];

export function getMemoryGlobalSettings() {
  return memoryGlobalSettings;
}

export function updateMemoryGlobalSettings(updates: Partial<typeof memoryGlobalSettings>) {
  Object.assign(memoryGlobalSettings, updates);
}

export function getMemoryTenantSettings(tenantId: string) {
  if (!memoryTenantSettings.has(tenantId)) {
    memoryTenantSettings.set(tenantId, { ai_enabled: true, daily_request_limit: 3, monthly_request_limit: 90 });
  }
  return memoryTenantSettings.get(tenantId)!;
}

export function updateMemoryTenantSettings(tenantId: string, updates: Partial<{ ai_enabled: boolean; daily_request_limit: number; monthly_request_limit: number }>) {
  const current = getMemoryTenantSettings(tenantId);
  memoryTenantSettings.set(tenantId, { ...current, ...updates });
}

export function getMemoryLedger() {
  return memoryLedger;
}

/**
 * Fetch current remaining shop usage quota
 */
export async function getShopAiQuota(tenantId: string): Promise<ShopQuotaInfo> {
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Try DB first
  try {
    const { data: tenantSettings, error: tErr } = await supabaseAdmin
      .from('tenant_ai_settings')
      .select('ai_enabled, daily_request_limit, monthly_request_limit')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!tErr && tenantSettings) {
      const dailyLimit = tenantSettings.daily_request_limit ?? 3;
      const monthlyLimit = tenantSettings.monthly_request_limit ?? 90;
      const aiEnabled = tenantSettings.ai_enabled ?? true;

      const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
        supabaseAdmin
          .from('ai_usage_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['reserved', 'success', 'failed'])
          .gte('requested_at', ago24h),
        supabaseAdmin
          .from('ai_usage_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['reserved', 'success', 'failed'])
          .gte('requested_at', ago30d),
      ]);

      const dailyUsed = dailyCount || 0;
      const monthlyUsed = monthlyCount || 0;

      return {
        dailyUsed,
        dailyLimit,
        monthlyUsed,
        monthlyLimit,
        remainingDaily: Math.max(0, dailyLimit - dailyUsed),
        remainingMonthly: Math.max(0, monthlyLimit - monthlyUsed),
        aiEnabled,
      };
    }
  } catch (e) {
    // Fallthrough to memory
  }

  // In-Memory Quota Fallback
  const memSettings = getMemoryTenantSettings(tenantId);
  const dailyLimit = memSettings.daily_request_limit;
  const monthlyLimit = memSettings.monthly_request_limit;
  const aiEnabled = memSettings.ai_enabled;

  const dailyUsed = memoryLedger.filter(
    (r) => r.tenant_id === tenantId && ['reserved', 'success', 'failed'].includes(r.status) && r.requested_at >= ago24h
  ).length;

  const monthlyUsed = memoryLedger.filter(
    (r) => r.tenant_id === tenantId && ['reserved', 'success', 'failed'].includes(r.status) && r.requested_at >= ago30d
  ).length;

  return {
    dailyUsed,
    dailyLimit,
    monthlyUsed,
    monthlyLimit,
    remainingDaily: Math.max(0, dailyLimit - dailyUsed),
    remainingMonthly: Math.max(0, monthlyLimit - monthlyUsed),
    aiEnabled,
  };
}

/**
 * Reserve quota atomically
 */
async function reserveQuota(
  tenantId: string,
  requestId: string,
  feature: string,
  provider: string,
  model: string
): Promise<{ allowed: boolean; code?: string; error?: string; ledgerId?: string; usage?: ShopQuotaInfo }> {
  // 1. Try atomic DB function RPC first
  try {
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('reserve_ai_usage', {
      p_tenant_id: tenantId,
      p_request_id: requestId,
      p_feature: feature,
      p_provider: provider,
      p_model: model,
    });

    if (!rpcErr && rpcRes) {
      if (!rpcRes.allowed) {
        return {
          allowed: false,
          code: rpcRes.code,
          error: rpcRes.error,
        };
      }
      const quota = await getShopAiQuota(tenantId);
      return {
        allowed: true,
        ledgerId: rpcRes.ledger_id,
        usage: quota,
      };
    }
  } catch (e) {
    // Ignore RPC missing error
  }

  // 2. Try standard DB reservation
  try {
    const nowIso = new Date().toISOString();
    const ago1m = new Date(Date.now() - 60 * 1000).toISOString();
    const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const ago30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: globalSettings } = await supabaseAdmin
      .from('global_ai_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (globalSettings) {
      if (!globalSettings.ai_enabled) {
        return { allowed: false, code: 'GLOBAL_AI_DISABLED', error: 'AI services are currently disabled globally by administrator.' };
      }

      const { data: tenantSettings } = await supabaseAdmin
        .from('tenant_ai_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const shopEnabled = tenantSettings?.ai_enabled ?? true;
      const dailyLimit = tenantSettings?.daily_request_limit ?? 3;
      const monthlyLimit = tenantSettings?.monthly_request_limit ?? 90;

      if (!shopEnabled) {
        return { allowed: false, code: 'SHOP_AI_DISABLED', error: 'AI scanning feature is disabled for this shop.' };
      }

      // Check short term rate limit
      const { count: count1m } = await supabaseAdmin
        .from('ai_usage_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('requested_at', ago1m);

      if ((count1m || 0) >= (globalSettings.short_term_rate_limit ?? 5)) {
        return { allowed: false, code: 'RATE_LIMIT_EXCEEDED', error: 'Too many requests in a short time. Please wait a minute before trying again.' };
      }

      // Check tenant rolling quotas
      const [{ count: tenant24hCount }, { count: tenant30dCount }] = await Promise.all([
        supabaseAdmin
          .from('ai_usage_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['reserved', 'success', 'failed'])
          .gte('requested_at', ago24h),
        supabaseAdmin
          .from('ai_usage_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['reserved', 'success', 'failed'])
          .gte('requested_at', ago30d),
      ]);

      if ((tenant24hCount || 0) >= dailyLimit) {
        return { allowed: false, code: 'DAILY_QUOTA_EXCEEDED', error: `Daily AI scan limit reached (${tenant24hCount}/${dailyLimit}).` };
      }

      if ((tenant30dCount || 0) >= monthlyLimit) {
        return { allowed: false, code: 'MONTHLY_QUOTA_EXCEEDED', error: `Monthly AI scan limit reached (${tenant30dCount}/${monthlyLimit}).` };
      }

      // Reserve row in DB
      const { data: newLedger } = await supabaseAdmin
        .from('ai_usage_ledger')
        .insert({
          request_id: requestId,
          tenant_id: tenantId,
          feature,
          provider,
          model,
          status: 'reserved',
          requested_at: nowIso,
        })
        .select('id')
        .single();

      if (newLedger?.id) {
        const quota = await getShopAiQuota(tenantId);
        return { allowed: true, ledgerId: newLedger.id, usage: quota };
      }
    }
  } catch (e) {
    // Fallthrough to memory
  }

  // 3. Resilient In-Memory Reservation
  const nowIso = new Date().toISOString();
  const ago1m = new Date(Date.now() - 60 * 1000).toISOString();
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ago30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  if (!memoryGlobalSettings.ai_enabled) {
    return { allowed: false, code: 'GLOBAL_AI_DISABLED', error: 'AI services are currently disabled globally by administrator.' };
  }

  const memShop = getMemoryTenantSettings(tenantId);
  if (!memShop.ai_enabled) {
    return { allowed: false, code: 'SHOP_AI_DISABLED', error: 'AI scanning feature is disabled for this shop.' };
  }

  const count1m = memoryLedger.filter((r) => r.tenant_id === tenantId && r.requested_at >= ago1m).length;
  if (count1m >= memoryGlobalSettings.short_term_rate_limit) {
    return { allowed: false, code: 'RATE_LIMIT_EXCEEDED', error: 'Too many requests in a short time. Please wait a minute before trying again.' };
  }

  const tenant24hCount = memoryLedger.filter(
    (r) => r.tenant_id === tenantId && ['reserved', 'success', 'failed'].includes(r.status) && r.requested_at >= ago24h
  ).length;

  if (tenant24hCount >= memShop.daily_request_limit) {
    return { allowed: false, code: 'DAILY_QUOTA_EXCEEDED', error: `Daily AI scan limit reached (${tenant24hCount}/${memShop.daily_request_limit}).` };
  }

  const tenant30dCount = memoryLedger.filter(
    (r) => r.tenant_id === tenantId && ['reserved', 'success', 'failed'].includes(r.status) && r.requested_at >= ago30d
  ).length;

  if (tenant30dCount >= memShop.monthly_request_limit) {
    return { allowed: false, code: 'MONTHLY_QUOTA_EXCEEDED', error: `Monthly AI scan limit reached (${tenant30dCount}/${memShop.monthly_request_limit}).` };
  }

  const ledgerId = `ledger_mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  memoryLedger.unshift({
    id: ledgerId,
    request_id: requestId,
    tenant_id: tenantId,
    feature,
    provider,
    model,
    requested_at: nowIso,
    status: 'reserved',
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost: 0,
    metadata: {},
  });

  const updatedQuota = await getShopAiQuota(tenantId);
  return {
    allowed: true,
    ledgerId,
    usage: updatedQuota,
  };
}

/**
 * Execute Central AI Gateway Request
 */
export async function executeCentralAiGateway<T = any>(
  req: AiUsageRequest
): Promise<AiUsageResult<T>> {
  const requestId = `req_ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const feature = req.feature || 'invoice_scanner';
  const provider = req.provider || 'gemini';
  const preferredModel = req.preferredModel || 'gemini-3.5-flash-lite';

  // 1. Validate API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
      errorCode: 'API_KEY_MISSING',
      requestId,
    };
  }

  // 2. Authorize & Atomically Reserve Usage
  const authReservation = await reserveQuota(req.tenantId, requestId, feature, provider, preferredModel);

  if (!authReservation.allowed) {
    return {
      success: false,
      error: authReservation.error || 'AI request authorization denied.',
      errorCode: authReservation.code || 'AUTHORIZATION_DENIED',
      requestId,
      usage: authReservation.usage || (await getShopAiQuota(req.tenantId)),
    };
  }

  const ledgerId = authReservation.ledgerId;
  const genAI = new GoogleGenerativeAI(apiKey);

  // 3. Candidate model fallback chain
  const candidateModels = [preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  let lastError: any = null;
  let successModel = preferredModel;
  let rawResponseText = '';
  let usageMetadata: any = null;
  let callSuccess = false;

  // 4. Call Gemini Provider (Once initiated, usage is CONSUMED regardless of outcome!)
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: req.responseMimeType || 'application/json',
          temperature: req.temperature ?? 0.1,
        },
      });

      const contents: any[] = [req.prompt];
      if (req.mediaInlineData) {
        contents.push({
          inlineData: {
            data: req.mediaInlineData.data,
            mimeType: req.mediaInlineData.mimeType,
          },
        });
      }

      const result = await model.generateContent(contents);
      const response = await result.response;
      rawResponseText = response.text().trim();
      usageMetadata = response.usageMetadata || null;
      successModel = modelName;
      callSuccess = true;
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI-GATEWAY] Failed using model ${modelName}:`, err?.message || err);
      if (err?.message?.includes('API_KEY_INVALID') || err?.status === 403) {
        break;
      }
    }
  }

  // 5. Parse token usage & cost
  const inputTokens = usageMetadata?.promptTokenCount || 0;
  const outputTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || (inputTokens + outputTokens);
  const estimatedCost = calculateGeminiCost(successModel, inputTokens, outputTokens);

  // 6. Update usage ledger record
  if (ledgerId) {
    if (ledgerId.startsWith('ledger_mem_')) {
      const record = memoryLedger.find((r) => r.id === ledgerId);
      if (record) {
        record.model = successModel;
        record.status = callSuccess ? 'success' : 'failed';
        record.input_tokens = inputTokens;
        record.output_tokens = outputTokens;
        record.total_tokens = totalTokens;
        record.estimated_cost = estimatedCost;
        record.metadata = callSuccess ? { feature, requestId } : { feature, requestId, error: lastError?.message || 'Gemini call failed' };
      }
    } else {
      try {
        await supabaseAdmin
          .from('ai_usage_ledger')
          .update({
            model: successModel,
            status: callSuccess ? 'success' : 'failed',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            estimated_cost: estimatedCost,
            metadata: callSuccess
              ? { feature, requestId }
              : { feature, requestId, error: lastError?.message || 'Gemini call failed' },
          })
          .eq('id', ledgerId);
      } catch (e) {
        // Ignore DB update error if table absent
      }
    }
  }

  const shopQuota = await getShopAiQuota(req.tenantId);

  // 7. Handle Gemini Call Failure
  if (!callSuccess) {
    return {
      success: false,
      error: `Gemini AI call failed: ${lastError?.message || 'Unknown error'}.`,
      errorCode: 'GEMINI_CALL_FAILED',
      requestId,
      usage: shopQuota,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    };
  }

  // 8. Handle JSON Parsing if JSON expected
  let parsedData: T | undefined = undefined;
  if (req.responseMimeType === 'application/json' || req.responseMimeType === undefined) {
    try {
      const cleanJson = rawResponseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr: any) {
      return {
        success: false,
        rawResponseText,
        error: `Failed to parse Gemini response JSON: ${parseErr.message}`,
        errorCode: 'INVALID_GEMINI_RESPONSE',
        requestId,
        usage: shopQuota,
        tokenUsage: {
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost,
        },
      };
    }
  }

  return {
    success: true,
    data: parsedData,
    rawResponseText,
    requestId,
    usage: shopQuota,
    tokenUsage: {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
    },
  };
}
