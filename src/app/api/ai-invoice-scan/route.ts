import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for vision inference

interface ExtractedItem {
  product_name: string;
  product_code?: string | null;
  qty: number;
  unit?: string | null;
  unit_price?: number | null;
  total_price?: number | null;
  brand?: string | null;
}

interface GeminiExtractionResult {
  supplier_name?: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  items?: ExtractedItem[];
  subtotal?: number | null;
  discount?: number | null;
  net_total?: number | null;
}

// Helper: Normalize strings for token comparison
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Helper: Calculate word overlap similarity between two strings (0.0 to 1.0)
function calculateWordSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  const wordsA = new Set(normA.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) common++;
  });

  const smaller = Math.min(wordsA.size, wordsB.size);
  return smaller > 0 ? common / smaller : 0;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tenantId = formData.get('tenant_id') as string | null;
    const file = formData.get('image') as File | null;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'Invoice image is required' }, { status: 400 });
    }

    // 1. Authenticate user
    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // 2. Validate Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in .env.local or Vercel Environment Variables.',
        },
        { status: 500 }
      );
    }

    // 3. Read image as Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // 4. Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `You are an expert invoice parser for a paint and hardware store in Pakistan.
Carefully examine this invoice image and extract all header and line items.
Invoices may be printed, dot-matrix, handwritten, in Urdu, or English.
Resolve common paint trade abbreviations (e.g. "Berg" = Berger, "1G" = 1 Gallon, "Qtr" = Quarter, "Drm" = Drum, "Emul" = Emulsion, "Enam" = Enamel, "W/S" = Weather Sheet / Weather Shield).

CRITICAL INSTRUCTION FOR LINE ITEMS: If a single line in the invoice lists multiple distinct products, shades, or colors with individual quantities (e.g., "638 Health Violet /2, 647 Apricot White /2"), you MUST split them into separate, distinct items in the JSON "items" array. Do NOT group them into a single product name. Each separated item should have its own specific "product_name" (e.g., "638 Health Violet") and "qty" (e.g., 2), while inheriting the "unit_price", "total_price", "unit", and "brand" from the parent line if they share it.

Return ONLY valid JSON matching this schema:
{
  "supplier_name": string or null,
  "invoice_no": string or null,
  "invoice_date": string or null (in YYYY-MM-DD format if identifiable, or raw text),
  "items": [
    {
      "product_name": string,
      "product_code": string or null,
      "qty": number,
      "unit": string (e.g. Can, Drum, Gallon, Quarter, Kg, Litre, Box, Bag, PCS),
      "unit_price": number or null,
      "total_price": number or null,
      "brand": string or null
    }
  ],
  "subtotal": number or null,
  "discount": number or null,
  "net_total": number or null
}

If any value is unreadable or missing, set that specific field to null. Do NOT wrap output in markdown fences like \`\`\`json if possible; output raw JSON only.`;

    let extractedData: GeminiExtractionResult;

    // We try the requested model first: gemini-3.5-flash-lite. If the API returns a model not found error,
    // fallback gracefully to gemini-2.0-flash or gemini-1.5-flash so user isn't stuck.
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError: any = null;
    let modelSuccess = false;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ]);

        const responseText = result.response.text().trim();
        // Clean any accidental markdown backticks
        const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        extractedData = JSON.parse(cleanJson);
        modelSuccess = true;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI-INVOICE] Failed using model ${modelName}:`, err?.message || err);
        // If it's an API key error or network error, break immediately rather than trying other models
        if (err?.message?.includes('API_KEY_INVALID') || err?.status === 403) {
          break;
        }
      }
    }

    if (!modelSuccess || !extractedData!) {
      return NextResponse.json(
        {
          success: false,
          error: `Gemini AI scanning failed: ${lastError?.message || 'Unknown error'}. Please check your API key and image quality.`,
        },
        { status: 502 }
      );
    }

    // 5. Fetch DB items & suppliers for matching
    const [itemsRes, suppliersRes] = await Promise.all([
      supabaseAdmin
        .from('items')
        .select('id, code, name, category, brand, unit, pack_size, cost_price, retail_price, stock_qty, shade_code')
        .eq('tenant_id', tenantId),
      supabaseAdmin
        .from('suppliers')
        .select('id, code, name, phone, city, current_balance')
        .eq('tenant_id', tenantId),
    ]);

    const dbItems = itemsRes.data || [];
    const dbSuppliers = suppliersRes.data || [];

    // 6. Match Supplier
    let matchedSupplier = {
      id: null as string | null,
      name: extractedData.supplier_name || '',
      code: '' as string,
      current_balance: 0 as number,
      matched: false,
    };

    if (extractedData.supplier_name && dbSuppliers.length > 0) {
      const rawAiSupplier = extractedData.supplier_name.trim().toLowerCase();
      let bestSupplier: any = null;
      let highestSim = 0;

      for (const sup of dbSuppliers) {
        const supName = sup.name.trim().toLowerCase();
        if (rawAiSupplier === supName) {
          bestSupplier = sup;
          highestSim = 1;
          break;
        }
        const sim = calculateWordSimilarity(rawAiSupplier, supName);
        if (sim > highestSim && sim >= 0.5) {
          highestSim = sim;
          bestSupplier = sup;
        }
      }

      if (bestSupplier) {
        matchedSupplier = {
          id: bestSupplier.id,
          name: bestSupplier.name,
          code: bestSupplier.code || '',
          current_balance: Number(bestSupplier.current_balance) || 0,
          matched: true,
        };
      }
    }

    // 7. Match Items
    const rawItems = Array.isArray(extractedData.items) ? extractedData.items : [];
    const processedItems = rawItems.map((aiItem) => {
      const aiName = (aiItem.product_name || '').trim();
      const aiCode = (aiItem.product_code || '').trim();
      const qty = Number(aiItem.qty) || 1;
      const unitPrice = aiItem.unit_price !== null && aiItem.unit_price !== undefined ? Number(aiItem.unit_price) : null;
      const totalPrice = aiItem.total_price !== null && aiItem.total_price !== undefined
        ? Number(aiItem.total_price)
        : (unitPrice !== null ? unitPrice * qty : null);
      // Derive after-tax unit price: total already includes tax, so total/qty = true per-unit cost
      const afterTaxUnitPrice = (totalPrice !== null && qty > 0)
        ? totalPrice / qty
        : unitPrice;

      let matchStatus: 'matched' | 'partial' | 'new' = 'new';
      let matchedDbItem: any = null;

      // Check 1: Exact code match
      if (aiCode) {
        const byCode = dbItems.find(
          (db) => db.code && db.code.trim().toLowerCase() === aiCode.toLowerCase()
        );
        if (byCode) {
          matchStatus = 'matched';
          matchedDbItem = byCode;
        }
      }

      // Check 2: Exact name match
      if (!matchedDbItem && aiName) {
        const byExactName = dbItems.find(
          (db) => db.name && db.name.trim().toLowerCase() === aiName.toLowerCase()
        );
        if (byExactName) {
          matchStatus = 'matched';
          matchedDbItem = byExactName;
        }
      }

      // Check 3: Fuzzy name match
      if (!matchedDbItem && aiName && dbItems.length > 0) {
        let bestItem: any = null;
        let maxSim = 0;

        for (const item of dbItems) {
          const sim = calculateWordSimilarity(aiName, item.name);
          if (sim > maxSim && sim >= 0.5) {
            maxSim = sim;
            bestItem = item;
          }
        }

        if (bestItem) {
          matchStatus = maxSim >= 0.85 ? 'matched' : 'partial';
          matchedDbItem = bestItem;
        }
      }

      return {
        ai_name: aiName,
        ai_code: aiCode || null,
        brand: aiItem.brand || (matchedDbItem?.brand ?? null),
        unit: aiItem.unit || matchedDbItem?.unit || 'Can',
        qty: qty,
        unit_price: afterTaxUnitPrice ?? (matchedDbItem ? Number(matchedDbItem.cost_price) || 0 : 0),
        total_price: totalPrice ?? ((afterTaxUnitPrice ?? Number(matchedDbItem?.cost_price || 0)) * qty),
        retail_price: matchedDbItem ? Number(matchedDbItem.retail_price) || 0 : 0,
        match_status: matchStatus,
        matched_item: matchedDbItem
          ? {
              id: matchedDbItem.id,
              code: matchedDbItem.code,
              name: matchedDbItem.name,
              stock_qty: Number(matchedDbItem.stock_qty) || 0,
              cost_price: Number(matchedDbItem.cost_price) || 0,
              retail_price: Number(matchedDbItem.retail_price) || 0,
              unit: matchedDbItem.unit || 'Can',
              brand: matchedDbItem.brand || '',
            }
          : null,
      };
    });

    // Subtotal & Net Total defaults
    const computedSubtotal = processedItems.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
    const discount = Number(extractedData.discount) || 0;
    const netTotal = extractedData.net_total !== null && extractedData.net_total !== undefined
      ? Number(extractedData.net_total)
      : Math.max(0, computedSubtotal - discount);

    return NextResponse.json({
      success: true,
      supplier: matchedSupplier,
      all_suppliers: dbSuppliers.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        current_balance: Number(s.current_balance) || 0,
      })),
      invoice_no: extractedData.invoice_no || '',
      invoice_date: extractedData.invoice_date || new Date().toISOString().split('T')[0],
      items: processedItems,
      subtotal: extractedData.subtotal !== null && extractedData.subtotal !== undefined ? Number(extractedData.subtotal) : computedSubtotal,
      discount: discount,
      net_total: netTotal,
    });
  } catch (error: any) {
    console.error('[AI-INVOICE] Unexpected error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
