import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch items for a tenant / branch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, items: items || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add a new item / paint product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      code,
      name,
      category,
      item_type = 'finish_goods',
      unit = 'Can',
      cost_price = 0,
      retail_price = 0,
      wholesale_price = 0,
      trade_price = 0,
      stock_qty = 0,
      min_stock_alert = 5,
    } = body;

    if (!tenant_id || !name || !code) {
      return NextResponse.json({ success: false, error: 'Tenant ID, Name and Item Code are required' }, { status: 400 });
    }

    const { data: item, error } = await supabaseAdmin
      .from('items')
      .insert({
        tenant_id,
        code: code.trim().toUpperCase(),
        name,
        category: category || 'General',
        item_type,
        unit,
        cost_price: Number(cost_price) || 0,
        retail_price: Number(retail_price) || 0,
        wholesale_price: Number(wholesale_price) || 0,
        trade_price: Number(trade_price) || 0,
        stock_qty: Number(stock_qty) || 0,
        min_stock_alert: Number(min_stock_alert) || 5,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update item
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    const { data: item, error } = await supabaseAdmin
      .from('items')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove item
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('items').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
