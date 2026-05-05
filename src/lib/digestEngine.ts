import { supabase } from './supabaseClient';
import { cleanUuid, shouldApplyUuidFilter } from './uuid';
import { getWorkspaceAlerts } from './alertEngine';
import { getDashboardData } from './dashboardAccess';

export interface Digest {
  id: string;
  workspace_id: string;
  digest_type: 'daily' | 'weekly';
  title: string;
  summary: string;
  payload: any;
  created_by: string;
  created_at: string;
}

export async function buildDailyDigest(workspaceId: string) {
  const alerts = await getWorkspaceAlerts(workspaceId);

  let kpiUnderperformingCount = 0;
  let kpiNotUpdatedCount = 0;
  let overdueTasksCount = 0;
  let blockedTasksCount = 0;

  alerts.forEach(alert => {
    if (alert.type === 'KPI_UNDERPERFORMING') kpiUnderperformingCount++;
    if (alert.type === 'KPI_NOT_UPDATED') kpiNotUpdatedCount++;
    if (alert.type === 'TASK_OVERDUE') overdueTasksCount++;
    if (alert.type === 'TASK_BLOCKED') blockedTasksCount++;
  });

  // Fetch tasks for due soon
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('due_date, status')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .neq('status', 'done');

  if (tasksError) throw tasksError;

  let dueSoonTasksCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  tasks?.forEach(task => {
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate.getTime() === today.getTime() || dueDate.getTime() === tomorrow.getTime()) {
        dueSoonTasksCount++;
      }
    }
  });

  const totalIssues = kpiUnderperformingCount + kpiNotUpdatedCount + overdueTasksCount + blockedTasksCount;
  
  const title = `Daily Digest - ${new Date().toLocaleDateString()}`;
  const summary = totalIssues > 0 
    ? `You have ${totalIssues} active issues requiring attention today.` 
    : `All clear! No active issues today.`;

  return {
    title,
    summary,
    payload: {
      kpiUnderperformingCount,
      kpiNotUpdatedCount,
      overdueTasksCount,
      blockedTasksCount,
      dueSoonTasksCount
    }
  };
}

export async function buildWeeklyDigest(workspaceId: string) {
  const dashboardData = await getDashboardData(workspaceId);

  const totalKpiIssues = dashboardData.kpiIssuesCount;
  const totalTaskRisks = dashboardData.overdueTasksCount + dashboardData.blockedTasksCount;

  const top5KpiIssues = dashboardData.topKpiIssues;
  
  // Top 5 people at risk
  const top5People = [...dashboardData.peopleSummaries]
    .sort((a, b) => b.total_issue_count - a.total_issue_count)
    .slice(0, 5);

  // Top initiatives with risk
  const topInitiatives = [...dashboardData.taskRiskOverviews]
    .sort((a, b) => (b.overdue_count + b.blocked_count) - (a.overdue_count + a.blocked_count))
    .slice(0, 5);

  const totalIssues = totalKpiIssues + totalTaskRisks;

  const title = `Weekly Digest - Week of ${new Date().toLocaleDateString()}`;
  const summary = totalIssues > 0
    ? `This week: ${totalKpiIssues} KPI issues and ${totalTaskRisks} task risks identified.`
    : `Great week! No major KPI or task risks identified.`;

  return {
    title,
    summary,
    payload: {
      totalKpiIssues,
      totalTaskRisks,
      top5KpiIssues,
      top5People,
      topInitiatives
    }
  };
}

export async function saveDigest(workspaceId: string, digestType: 'daily' | 'weekly') {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) throw new Error("Not authenticated");

    const userId = session.user.id;

    let digestData;
    if (digestType === 'daily') {
      digestData = await buildDailyDigest(workspaceId);
    } else {
      digestData = await buildWeeklyDigest(workspaceId);
    }

    const { data, error } = await supabase
      .from('digests')
      .insert({
        workspace_id: cleanUuid(workspaceId),
        digest_type: digestType,
        title: digestData.title,
        summary: digestData.summary,
        payload: digestData.payload,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data as Digest;
  } catch (error) {
    console.error("saveDigest error", error);
    throw error;
  }
}

export async function listDigests(workspaceId: string): Promise<Digest[]> {
  try {
    const { data, error } = await supabase
      .from('digests')
      .select('*')
      .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return data as Digest[];
  } catch (error) {
    console.error("listDigests error", error);
    throw error;
  }
}

export async function getLatestDigest(workspaceId: string): Promise<Digest | null> {
  const { data, error } = await supabase
    .from('digests')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Digest | null;
}
