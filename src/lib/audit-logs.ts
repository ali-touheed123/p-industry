import { supabaseAdmin } from './supabase';

export interface AuditEventParams {
  tenantId: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  actionType?: string | null;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any> | null;
}

/**
 * Standard utility to record audit entries to public.audit_logs.
 * Never throws — errors are caught and logged to console.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      user_name: params.userName || 'system',
      action: params.action,
      action_type: params.actionType || 'system',
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || null,
    });

    if (error) {
      console.error('Database error recording audit log:', error);
    }
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

