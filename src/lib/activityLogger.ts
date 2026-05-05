import { supabase } from './supabaseClient';
import { cleanUuid } from './uuid';

export interface LogActivityParams {
  workspaceId: string;
  entityType: string;
  entityId: string;
  action: string;
  detail?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams) {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error("logActivity auth error", authError);
    }

    const { error } = await supabase.from('activity_logs').insert({
      workspace_id: cleanUuid(params.workspaceId),
      actor_id: cleanUuid(session?.user?.id),
      entity_type: params.entityType,
      entity_id: cleanUuid(params.entityId),
      action: params.action,
      detail: params.detail ?? {}
    });

    if (error) {
      console.error("logActivity insert error", error);
    }
  } catch (error) {
    console.error("logActivity error", error);
  }
}
