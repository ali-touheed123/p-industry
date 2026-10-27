import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireDevAuth } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data: owners, error } = await supabaseAdmin
      .from('owners')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, owners: owners || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
