import { supabase } from './supabaseClient';
import { shouldApplyUuidFilter } from './uuid';

export interface ActivityLog {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  detail: Record<string, any>;
  created_at: string;
  actor_name: string;
}

export async function listActivityLogs(workspaceId: string): Promise<ActivityLog[]> {
  const { data: logs, error: logsError } = await supabase
    .from('activity_logs')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .order('created_at', { ascending: false })
    .limit(100);

  if (logsError) {
    throw logsError;
  }

  if (!logs || logs.length === 0) {
    return [];
  }

  const actorIds = new Set<string>();
  logs.forEach(log => {
    if (log.actor_id) {
      actorIds.add(log.actor_id);
    }
  });

  const profilesMap = new Map<string, string>();
  if (actorIds.size > 0) {
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', Array.from(actorIds));

    if (!profError && profiles) {
      profiles.forEach(p => profilesMap.set(p.user_id, p.full_name || 'Unknown User'));
    }
  }

  const mappedLogs: ActivityLog[] = logs.map(log => ({
    ...log,
    actor_name: log.actor_id ? (profilesMap.get(log.actor_id) || 'Unknown User') : 'System/Unknown'
  }));

  return mappedLogs;
}
