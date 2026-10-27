import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth-passwords';
import { requireDevAuth, requireTenantAuth } from '@/lib/session';
import { sanitizePostgRESTLike } from '@/lib/utils';
import { validateAndAssembleAccounts } from '@/lib/tenant-provisioning-validation';

// GET all tenants or single tenant by slug
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (slug) {
      const { data: tenant, error: singleErr } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('slug', slug.trim().toLowerCase())
        .single();

      if (singleErr || !tenant) {
        return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
      }

      // FIX FINDING-API-009: Do NOT expose the employee directory on an unauthenticated
      // slug-based lookup. Any caller can query ?slug=<name> without credentials, so
      // returning users/counters would allow enumeration of all staff usernames and roles.
      return NextResponse.json({ 
        success: true, 
        tenant,
      });
    }

    // Full system tenant list requires authenticated session
    const auth = await requireTenantAuth(req, null);
    if (!auth.authorized || !auth.session) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    let tenantQuery = supabaseAdmin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    // Scope tenant listing based on session role
    if (auth.session.role === 'developer') {
      // Developer can see all tenants
    } else if (auth.session.role === 'ceo') {
      // CEO can see their own tenant and sister branches matching owner_id (or fallback owner_name or email)
      let callerOwnerId = auth.session.ownerId;
      let callerTenant: any = null;

      if (!callerOwnerId && auth.session.tenantId) {
        const { data: ct } = await supabaseAdmin
          .from('tenants')
          .select('owner_id, owner_name, email')
          .eq('id', auth.session.tenantId)
          .maybeSingle();
        callerTenant = ct;
        callerOwnerId = ct?.owner_id || undefined;
      }

      if (callerOwnerId) {
        tenantQuery = tenantQuery.or(`id.eq.${auth.session.tenantId},owner_id.eq.${callerOwnerId}`);
      } else {
        if (!callerTenant && auth.session.tenantId) {
          const { data: ct } = await supabaseAdmin
            .from('tenants')
            .select('owner_name, email')
            .eq('id', auth.session.tenantId)
            .maybeSingle();
          callerTenant = ct;
        }

        if (callerTenant?.owner_name && callerTenant?.email) {
          const safeOwner = sanitizePostgRESTLike(callerTenant.owner_name);
          const safeEmail = sanitizePostgRESTLike(callerTenant.email);
          if (safeOwner && safeEmail) {
            tenantQuery = tenantQuery.or(`id.eq.${auth.session.tenantId},owner_name.eq.${safeOwner},email.eq.${safeEmail}`);
          } else if (safeOwner) {
            tenantQuery = tenantQuery.or(`id.eq.${auth.session.tenantId},owner_name.eq.${safeOwner}`);
          } else if (safeEmail) {
            tenantQuery = tenantQuery.or(`id.eq.${auth.session.tenantId},email.eq.${safeEmail}`);
          } else {
            tenantQuery = tenantQuery.eq('id', auth.session.tenantId);
          }
        } else if (callerTenant?.owner_name) {
          const safeOwner = sanitizePostgRESTLike(callerTenant.owner_name);
          if (safeOwner) {
            tenantQuery = tenantQuery.or(`id.eq.${auth.session.tenantId},owner_name.eq.${safeOwner}`);
          } else {
            tenantQuery = tenantQuery.eq('id', auth.session.tenantId);
          }
        } else if (callerTenant?.email) {
          const safeEmail = sanitizePostgRESTLike(callerTenant.email);
          if (safeEmail) {
            tenantQuery = tenantQuery.or(`id.eq.${auth.session.tenantId},email.eq.${safeEmail}`);
          } else {
            tenantQuery = tenantQuery.eq('id', auth.session.tenantId);
          }
        } else {
          tenantQuery = tenantQuery.eq('id', auth.session.tenantId);
        }
      }
    } else {
      // Staff / other: only their assigned branch
      tenantQuery = tenantQuery.eq('id', auth.session.tenantId);
    }

    const { data: tenants, error: tenantErr } = await tenantQuery;
    if (tenantErr) throw tenantErr;

    // Fetch user counts for the scoped tenants
    const tenantIds = (tenants || []).map(t => t.id);
    const ownerIds = Array.from(new Set((tenants || []).map(t => t.owner_id).filter(Boolean)));

    let usersQuery = supabaseAdmin
      .from('app_users')
      .select('id, username, full_name, role, tenant_id, owner_id');

    if (tenantIds.length > 0 && ownerIds.length > 0) {
      usersQuery = usersQuery.or(`tenant_id.in.(${tenantIds.join(',')}),owner_id.in.(${ownerIds.join(',')})`);
    } else if (tenantIds.length > 0) {
      usersQuery = usersQuery.in('tenant_id', tenantIds);
    } else {
      usersQuery = usersQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { data: users, error: userErr } = await usersQuery;

    if (userErr) throw userErr;

    const tenantsWithDetails = (tenants || []).map(t => {
      const tenantUsers = (users || []).filter(u => u.tenant_id === t.id);
      let ceoUser = tenantUsers.find(u => u.role === 'ceo');
      // If no tenant-specific CEO user row, match CEO by owner_id
      if (!ceoUser && t.owner_id) {
        ceoUser = (users || []).find(u => u.role === 'ceo' && u.owner_id === t.owner_id);
      }
      const staffUsers = tenantUsers.filter(u => u.role === 'staff' || u.role === 'godown_staff');
      return {
        ...t,
        usersCount: tenantUsers.length,
        ceo: ceoUser ? { username: ceoUser.username, name: ceoUser.full_name } : null,
        staffCount: staffUsers.length,
      };
    });

    return NextResponse.json({ success: true, tenants: tenantsWithDetails });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create a new Shop / Godown / Factory with default CEO & Staff accounts
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const {
      name,
      slug,
      type = 'shop',
      owner_id,
      owner_name,
      phone,
      email,
      city,
      address,
      ceo_username,
      ceo_password,
      staff_username,
      staff_password,
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: 'Name and URL slug are required' }, { status: 400 });
    }

    // Clean slug
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    // 0. Resolve or validate Owner
    let targetOwnerId: string | null = null;
    let createdOwnerId: string | null = null;
    let resolvedOwnerName: string | null = owner_name?.trim() || null;
    let resolvedPhone: string | null = phone?.trim() || null;
    let resolvedEmail: string | null = email?.trim() || null;

    if (owner_id) {
      const { data: existingOwner, error: ownerLookupErr } = await supabaseAdmin
        .from('owners')
        .select('*')
        .eq('id', owner_id)
        .maybeSingle();

      if (ownerLookupErr) throw ownerLookupErr;
      if (!existingOwner) {
        return NextResponse.json({ success: false, error: 'Selected business owner not found' }, { status: 400 });
      }

      targetOwnerId = existingOwner.id;
      if (!resolvedOwnerName) resolvedOwnerName = existingOwner.name;
      if (!resolvedPhone) resolvedPhone = existingOwner.phone;
      if (!resolvedEmail) resolvedEmail = existingOwner.email;
    }

    // If an existing owner is chosen, do NOT create a CEO user (existing CEO has access).
    // If it's a new owner, create owner + CEO together.
    const effectiveBody = owner_id
      ? { ...body, ceo_username: undefined, ceo_password: undefined }
      : body;

    // 0a. Pre-Flight Unique Username Validation across all proposed user accounts (DEV-02)
    const valResult = validateAndAssembleAccounts(effectiveBody);
    if (!valResult.success) {
      return NextResponse.json({
        success: false,
        error: valResult.error
      }, { status: 400 });
    }

    const proposedAccounts = valResult.proposedAccounts || [];
    const uniqueUsernames = valResult.uniqueUsernames || [];

    // 0b. Pre-Flight Slug Uniqueness Check (DEV-03)
    {
      const { data: existingSlug, error: slugCheckErr } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (slugCheckErr) throw slugCheckErr;
      if (existingSlug) {
        return NextResponse.json({
          success: false,
          error: 'A shop or godown with this URL slug already exists!'
        }, { status: 400 });
      }
    }

    // Check global database uniqueness before creating tenant
    if (uniqueUsernames.length > 0) {
      const { data: existingUsers, error: checkErr } = await supabaseAdmin
        .from('app_users')
        .select('username')
        .in('username', uniqueUsernames);

      if (checkErr) throw checkErr;

      if (existingUsers && existingUsers.length > 0) {
        const takenList = existingUsers.map(u => u.username).join(', ');
        return NextResponse.json({
          success: false,
          error: `Username(s) already taken globally: ${takenList}. Please choose different usernames.`
        }, { status: 400 });
      }
    }

    // 1. Hash all account passwords BEFORE any database writes (DEV-03)
    interface HashedAccount {
      username: string;
      passwordHash: string;
      fullName: string;
      role: 'ceo' | 'staff' | 'godown_staff';
    }

    const hashedAccounts: HashedAccount[] = [];
    for (const account of proposedAccounts) {
      if (!account.password) continue;
      const hash = await hashPassword(account.password);
      hashedAccounts.push({
        username: account.username,
        passwordHash: hash,
        fullName: account.fullName,
        role: account.role,
      });
    }

    // 2. If new owner needed, create owners row
    if (!targetOwnerId) {
      const { data: newOwner, error: createOwnerErr } = await supabaseAdmin
        .from('owners')
        .insert({
          name: resolvedOwnerName || `${name.trim()} Owner`,
          email: resolvedEmail || null,
          phone: resolvedPhone || null,
        })
        .select()
        .single();

      if (createOwnerErr) throw createOwnerErr;
      targetOwnerId = newOwner.id;
      createdOwnerId = newOwner.id;
    }

    // 3. Insert Tenant
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        type,
        owner_id: targetOwnerId,
        owner_name: resolvedOwnerName || null,
        phone: resolvedPhone || null,
        email: resolvedEmail || null,
        city: city?.trim() || 'Karachi',
        address: address?.trim() || null,
      })
      .select()
      .single();

    if (tenantErr) {
      // Rollback created owner if tenant insertion failed
      if (createdOwnerId) {
        try {
          await supabaseAdmin.from('owners').delete().eq('id', createdOwnerId);
        } catch {}
      }
      if (tenantErr.code === '23505') {
        return NextResponse.json({ success: false, error: 'A shop or godown with this URL slug already exists!' }, { status: 400 });
      }
      throw tenantErr;
    }

    // Track exact records created by THIS request for scoped rollback.
    let createdTenantId: string | null = tenant.id;
    const createdUserIds: string[] = [];

    // Provision accounts and seed catalog wrapped in tracked rollback
    let provisioningError: Error | null = null;
    try {
      // 4. Create CEO user only if this is a newly created owner (NOT an existing owner)
      const ceoHashed = hashedAccounts.find(a => a.role === 'ceo');
      if (ceoHashed && !owner_id) {
        const { data: ceoRow, error: ceoErr } = await supabaseAdmin
          .from('app_users')
          .insert({
            username: ceoHashed.username,
            password_hash: ceoHashed.passwordHash,
            full_name: ceoHashed.fullName,
            email: resolvedEmail || `${ceoHashed.username}@pyntflow.com`,
            role: 'ceo',
            tenant_id: tenant.id,
            owner_id: targetOwnerId,
          })
          .select('id')
          .single();

        if (ceoErr) throw ceoErr;
        if (ceoRow?.id) createdUserIds.push(ceoRow.id);
      }

      // 5. Create Staff / Counter users from canonical hashed cashier accounts
      const cashierHashed = hashedAccounts.filter(a => a.role === 'staff' || a.role === 'godown_staff');
      for (const counter of cashierHashed) {
        const { data: counterRow, error: counterErr } = await supabaseAdmin
          .from('app_users')
          .insert({
            username: counter.username,
            password_hash: counter.passwordHash,
            full_name: counter.fullName,
            role: counter.role,
            tenant_id: tenant.id,
          })
          .select('id')
          .single();

        if (counterErr) throw counterErr;
        if (counterRow?.id) createdUserIds.push(counterRow.id);
      }

      // 6. Automatically seed existing catalog products into this new branch with stock_qty = 0
      try {
        let query = supabaseAdmin
          .from('tenants')
          .select('id')
          .neq('id', tenant.id)
          .eq('is_active', true);

        if (targetOwnerId) {
          query = query.eq('owner_id', targetOwnerId);
        } else if (resolvedOwnerName) {
          query = query.eq('owner_name', resolvedOwnerName);
        }

        const { data: sisterTenants } = await query;

        if (sisterTenants && sisterTenants.length > 0) {
          const sisterId = sisterTenants[0].id;
          const { data: existingItems } = await supabaseAdmin
            .from('items')
            .select('*')
            .eq('tenant_id', sisterId);

          if (existingItems && existingItems.length > 0) {
            const newBranchItems = existingItems.map((it: any) => ({
              tenant_id: tenant.id,
              code: it.code,
              name: it.name,
              category: it.category || 'General',
              item_type: it.item_type || 'finish_goods',
              unit: it.unit || 'Can',
              pack_size: it.pack_size || it.unit || 'Can',
              shade_code: it.shade_code || null,
              shade_hex: it.shade_hex || null,
              cost_price: it.cost_price || 0,
              retail_price: it.retail_price || 0,
              wholesale_price: it.wholesale_price || 0,
              trade_price: it.trade_price || 0,
              stock_qty: 0, // Fresh branch starts with 0 stock
              min_stock_alert: it.min_stock_alert || 5,
            }));

            await supabaseAdmin.from('items').insert(newBranchItems);
          }
        }
      } catch (seedErr) {
        console.error('Failed to seed catalog items to new branch (non-critical):', seedErr);
      }

    } catch (err: any) {
      provisioningError = err;
    }

    if (provisioningError) {
      console.error('Account provisioning failed, attempting scoped rollback:', {
        tenantId: createdTenantId,
        createdUserCount: createdUserIds.length,
        createdOwnerId,
        error: provisioningError.message,
      });

      // Step R1: Delete exact user records created by this request (by ID)
      if (createdUserIds.length > 0) {
        try {
          await supabaseAdmin.from('app_users').delete().in('id', createdUserIds);
        } catch (cleanupErr: any) {
          console.error('[ROLLBACK-R1] Failed to delete created user rows by ID:', {
            userIds: createdUserIds,
            error: cleanupErr?.message,
          });
        }
      }

      // Step R2: Delete tenant record created by this request (by exact ID)
      if (createdTenantId) {
        try {
          await supabaseAdmin.from('tenants').delete().eq('id', createdTenantId);
        } catch (cleanupErr: any) {
          console.error('[ROLLBACK-R2] Failed to delete created tenant row by ID:', {
            tenantId: createdTenantId,
            error: cleanupErr?.message,
          });
        }
      }

      // Step R3: Delete owner record created by this request if new owner was created
      if (createdOwnerId) {
        try {
          await supabaseAdmin.from('owners').delete().eq('id', createdOwnerId);
        } catch (cleanupErr: any) {
          console.error('[ROLLBACK-R3] Failed to delete created owner row by ID:', {
            ownerId: createdOwnerId,
            error: cleanupErr?.message,
          });
        }
      }

      return NextResponse.json({
        success: false,
        error: `Failed to provision branch accounts: ${provisioningError.message}. Tenant creation was rolled back.`
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, tenant });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


// DELETE: Remove tenant with full cascade cleanup
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    // 0. Handle CEO user reassignment before deleting anything
    const { data: tenantBeingDeleted } = await supabaseAdmin
      .from('tenants')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle();

    const ownerId = tenantBeingDeleted?.owner_id;
    let sisterTenantId: string | null = null;

    if (ownerId) {
      // Find ANY other tenant belonging to the same owner (not filtering by is_active)
      const { data: sister } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('owner_id', ownerId)
        .neq('id', id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (sister) {
        sisterTenantId = sister.id;
      }
    }

    // If CEO user(s) have tenant_id = id, reassign them to a sister branch
    const { data: ceoUsers } = await supabaseAdmin
      .from('app_users')
      .select('id, owner_id')
      .eq('tenant_id', id)
      .eq('role', 'ceo');

    if (ceoUsers && ceoUsers.length > 0) {
      for (const ceo of ceoUsers) {
        const effectiveOwner = ceo.owner_id || ownerId;
        let targetSisterId = sisterTenantId;

        if (!targetSisterId && effectiveOwner) {
          const { data: sister } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('owner_id', effectiveOwner)
            .neq('id', id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (sister) targetSisterId = sister.id;
        }

        if (targetSisterId) {
          // Reassign CEO to the sister branch BEFORE deleting child records/tenant
          await supabaseAdmin
            .from('app_users')
            .update({ tenant_id: targetSisterId })
            .eq('id', ceo.id);
        }
      }
    }

    // 1. Clean up branch orders & branch order items (as sender or receiver)
    try {
      const { data: relatedOrders } = await supabaseAdmin
        .from('branch_orders')
        .select('id')
        .or(`from_tenant_id.eq.${id},to_tenant_id.eq.${id}`);

      if (relatedOrders && relatedOrders.length > 0) {
        const orderIds = relatedOrders.map((o: any) => o.id);
        await supabaseAdmin.from('branch_order_items').delete().in('order_id', orderIds);
        await supabaseAdmin.from('branch_orders').delete().in('id', orderIds);
      }
    } catch (err) {
      console.error('Error cleaning branch orders on tenant delete:', err);
    }

    // 2. Clean up invoices & invoice items
    try {
      const { data: relatedInvoices } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('tenant_id', id);

      if (relatedInvoices && relatedInvoices.length > 0) {
        const invIds = relatedInvoices.map((i: any) => i.id);
        await supabaseAdmin.from('invoice_items').delete().in('invoice_id', invIds);
        await supabaseAdmin.from('invoices').delete().in('id', invIds);
      }
    } catch (err) {
      console.error('Error cleaning invoices on tenant delete:', err);
    }

    // 3. Clean up purchases & purchase items
    try {
      const { data: relatedPurchases } = await supabaseAdmin
        .from('purchases')
        .select('id')
        .eq('tenant_id', id);

      if (relatedPurchases && relatedPurchases.length > 0) {
        const pIds = relatedPurchases.map((p: any) => p.id);
        await supabaseAdmin.from('purchase_items').delete().in('purchase_id', pIds);
        await supabaseAdmin.from('purchases').delete().in('id', pIds);
      }
    } catch (err) {
      console.error('Error cleaning purchases on tenant delete:', err);
    }

    // 4. Clean up token transactions and receipt templates before child users
    try {
      await supabaseAdmin.from('token_transactions').delete().eq('tenant_id', id);
    } catch (err) {
      console.error('Error cleaning token transactions on tenant delete:', err);
    }

    try {
      await supabaseAdmin.from('tenant_receipt_template').delete().eq('tenant_id', id);
    } catch (err) {
      console.error('Error cleaning tenant receipt template on tenant delete:', err);
    }

    // Clean up branch orders and order items (as sender or receiver) to prevent FK violation
    try {
      const { data: relatedOrders } = await supabaseAdmin
        .from('branch_orders')
        .select('id')
        .or(`from_tenant_id.eq.${id},to_tenant_id.eq.${id}`);

      if (relatedOrders && relatedOrders.length > 0) {
        const orderIds = relatedOrders.map((o: any) => o.id);
        await supabaseAdmin.from('branch_order_items').delete().in('branch_order_id', orderIds);
        await supabaseAdmin.from('branch_orders').delete().in('id', orderIds);
      }
    } catch (err) {
      console.error('Error cleaning branch orders on tenant delete:', err);
    }

    // 5. Clean up other child tables
    // Delete non-CEO users (cashiers/staff) of the deleted tenant
    await supabaseAdmin
      .from('app_users')
      .delete()
      .eq('tenant_id', id)
      .neq('role', 'ceo');

    // If the owner has NO other branches left, delete the remaining CEO user too
    if (!sisterTenantId) {
      await supabaseAdmin
        .from('app_users')
        .delete()
        .eq('tenant_id', id);
    }

    await supabaseAdmin.from('held_invoices').delete().eq('tenant_id', id);
    await supabaseAdmin.from('items').delete().eq('tenant_id', id);
    await supabaseAdmin.from('shifts').delete().eq('tenant_id', id);
    await supabaseAdmin.from('petty_expenses').delete().eq('tenant_id', id);
    await supabaseAdmin.from('clients').delete().eq('tenant_id', id);
    await supabaseAdmin.from('suppliers').delete().eq('tenant_id', id);
    await supabaseAdmin.from('audit_logs').delete().eq('tenant_id', id);
    await supabaseAdmin.from('vouchers').delete().eq('tenant_id', id);

    // 6. Finally delete the tenant
    const { error } = await supabaseAdmin.from('tenants').delete().eq('id', id);
    if (error) throw error;

    // 7. If no other tenants have this owner_id, delete the owners row
    if (ownerId) {
      const { count: remainingTenantsCount } = await supabaseAdmin
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', ownerId);

      if (!remainingTenantsCount || remainingTenantsCount === 0) {
        await supabaseAdmin.from('owners').delete().eq('id', ownerId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Toggle status or update info
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      id, 
      is_active, 
      name, 
      slug,
      owner_name,
      phone, 
      email, 
      city, 
      address, 
      type,
      commission_enabled,
      commission_rate,
      commission_split_lead,
      commission_split_staff,
      commission_split_reserve,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (is_active !== undefined) updateData.is_active = is_active;
    if (name) updateData.name = name.trim();
    if (slug) {
      const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      // Verify slug uniqueness against other tenants
      const { data: existingSlug, error: slugErr } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', cleanSlug)
        .neq('id', id)
        .maybeSingle();

      if (slugErr) throw slugErr;
      if (existingSlug) {
        return NextResponse.json({ success: false, error: 'A branch with this URL slug already exists.' }, { status: 400 });
      }
      updateData.slug = cleanSlug;
    }
    if (owner_name !== undefined) updateData.owner_name = owner_name ? owner_name.trim() : null;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (type) updateData.type = type;
    if (commission_enabled !== undefined) updateData.commission_enabled = commission_enabled;
    if (commission_rate !== undefined) updateData.commission_rate = Number(commission_rate);
    if (commission_split_lead !== undefined) updateData.commission_split_lead = Number(commission_split_lead);
    if (commission_split_staff !== undefined) updateData.commission_split_staff = Number(commission_split_staff);
    if (commission_split_reserve !== undefined) updateData.commission_split_reserve = Number(commission_split_reserve);

    const { error } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
