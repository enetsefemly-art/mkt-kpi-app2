import { supabase } from './supabaseClient';

export interface LogActivityParams {
  workspaceId: string;
  entityType: "kpi" | "kpi_item" | "initiative" | "task";
  entityId: string;
  action: "create" | "update" | "delete";
  detail?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams) {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error("logActivity auth error", authError);
    }

    const { error } = await supabase.from('activity_logs').insert({
      workspace_id: params.workspaceId,
      actor_id: session?.user?.id || null,
      entity_type: params.entityType,
      entity_id: params.entityId,
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
