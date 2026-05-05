import { supabase } from './supabaseClient';
import { shouldApplyUuidFilter } from './uuid';
import { getWorkspaceAlerts, Alert } from './alertEngine';
import { getMyNotifications, AppNotification } from './notificationEngine';
import { getLatestDigest, Digest } from './digestEngine';

export interface ProductSummary {
  product_id: string;
  product_name: string;
  total_items: number;
  underperforming_items: number;
  underperforming_rate: number;
}

export interface PeopleSummary {
  owner_id: string;
  owner_name: string;
  owner_function: string;
  total_issue_count: number;
  total_kpi_items_count: number;
}

export interface TaskRiskOverview {
  initiative_id: string;
  initiative_title: string;
  product_name: string;
  overdue_count: number;
  blocked_count: number;
  max_overdue_days: number;
}

export interface TopKpiIssue {
  id: string;
  kpi_id: string;
  kpi_title: string;
  item_title: string;
  owner_name: string;
  product_name: string;
  ratio: number;
  severity: 'critical' | 'warning' | 'healthy';
}

export interface DashboardData {
  totalKpiItems: number;
  kpiIssuesCount: number;
  overdueTasksCount: number;
  blockedTasksCount: number;
  productSummaries: ProductSummary[];
  peopleSummaries: PeopleSummary[];
  taskRiskOverviews: TaskRiskOverview[];
  topKpiIssues: TopKpiIssue[];
  alerts: Alert[];
  notifications: AppNotification[];
  latestDigest: Digest | null;
  debug: {
    kpisCount: number;
    kpiItemsCount: number;
    tasksCount: number;
    initiativesCount: number;
  };
}

export async function getDashboardData(workspaceId: string, currentUserId?: string): Promise<DashboardData> {
  // 1. Fetch KPIs
  const { data: kpis, error: kpisError } = await supabase
    .from('kpis')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});
  if (kpisError) throw kpisError;

  const kpiIds = kpis?.map(k => k.id) || [];
  
  // 2. Fetch KPI Items
  let kpiItems: any[] = [];
  if (kpiIds.length > 0) {
    const { data, error } = await supabase
      .from('kpi_items')
      .select('*')
      .in('kpi_id', kpiIds);
    if (error) throw error;
    kpiItems = data || [];
  }

  // 3. Fetch Initiatives
  const { data: initiatives, error: initError } = await supabase
    .from('initiatives')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});
  if (initError) throw initError;

  // 4. Fetch Tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});
  if (tasksError) throw tasksError;

  // 5. Fetch Products
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});
  if (prodError) throw prodError;

  // 6. Collect unique Owner IDs
  const ownerIds = new Set<string>();
  kpis?.forEach(k => { if (k.owner_id) ownerIds.add(k.owner_id); });
  initiatives?.forEach(i => { if (i.owner_id) ownerIds.add(i.owner_id); });
  tasks?.forEach(t => { if (t.owner_id) ownerIds.add(t.owner_id); });

  // 7. Fetch Profiles
  const profilesMap = new Map<string, any>();
  if (ownerIds.size > 0) {
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('user_id, full_name, function')
      .in('user_id', Array.from(ownerIds));
    if (!profError && profiles) {
      profiles.forEach(p => profilesMap.set(p.user_id, p));
    }
  }

  const productsMap = new Map<string, any>();
  products?.forEach(p => productsMap.set(p.id, p));

  const kpiMap = new Map(kpis?.map(k => [k.id, k]));

  // --- Process KPI Underperforming ---
  let kpiIssuesCount = 0;
  
  // Maps for aggregations
  const productStats = new Map<string, { total: number; issues: number }>();
  products?.forEach(p => productStats.set(p.id, { total: 0, issues: 0 }));
  
  const peopleStats = new Map<string, { total: number; issues: number }>();
  const allKpiItemsWithRatio: TopKpiIssue[] = [];

  kpiItems.forEach(item => {
    const kpi = kpiMap.get(item.kpi_id);
    if (!kpi) return;

    let ratio: number | null = null;
    if (kpi.kpi_type === 'strategic') {
      ratio = item.manual_progress !== null ? item.manual_progress : 0;
    } else {
      if (item.target && item.target > 0) {
        const act = item.actual || 0;
        if (item.direction === 'lower_better') {
          ratio = act > 0 ? item.target / act : 1;
        } else {
          ratio = act / item.target;
        }
      }
    }

    const isIssue = ratio !== null && ratio < 0.7;
    if (isIssue) {
      kpiIssuesCount++;
    }

    if (ratio !== null) {
      let severity: 'critical' | 'warning' | 'healthy' = 'healthy';
      if (ratio < 0.4) severity = 'critical';
      else if (ratio < 0.7) severity = 'warning';

      const profile = profilesMap.get(kpi.owner_id);
      const product = item.product_id ? productsMap.get(item.product_id) : null;

      allKpiItemsWithRatio.push({
        id: item.id,
        kpi_id: kpi.id,
        kpi_title: kpi.title,
        item_title: item.item_title,
        owner_name: profile?.full_name || 'Unknown',
        product_name: product?.name || '-',
        ratio: ratio,
        severity
      });
    }

    // Product aggregation
    if (item.product_id) {
      const stats = productStats.get(item.product_id) || { total: 0, issues: 0 };
      stats.total++;
      if (isIssue) stats.issues++;
      productStats.set(item.product_id, stats);
    }

    // People aggregation
    if (kpi.owner_id) {
      const stats = peopleStats.get(kpi.owner_id) || { total: 0, issues: 0 };
      stats.total++;
      if (isIssue) stats.issues++;
      peopleStats.set(kpi.owner_id, stats);
    }
  });

  const productSummaries: ProductSummary[] = Array.from(productStats.entries()).map(([productId, stats]) => {
    const product = productsMap.get(productId);
    return {
      product_id: productId,
      product_name: product?.name || 'Unknown Product',
      total_items: stats.total,
      underperforming_items: stats.issues,
      underperforming_rate: stats.total > 0 ? (stats.issues / stats.total) * 100 : 0
    };
  }).sort((a, b) => b.underperforming_rate - a.underperforming_rate);

  const peopleSummaries: PeopleSummary[] = Array.from(peopleStats.entries()).map(([ownerId, stats]) => {
    const profile = profilesMap.get(ownerId);
    return {
      owner_id: ownerId,
      owner_name: profile?.full_name || 'Unknown',
      owner_function: profile?.function || '',
      total_issue_count: stats.issues,
      total_kpi_items_count: stats.total
    };
  }).sort((a, b) => b.total_issue_count - a.total_issue_count);

  // --- Process Tasks ---
  let overdueTasksCount = 0;
  let blockedTasksCount = 0;
  const initMap = new Map(initiatives?.map(i => [i.id, i]));
  const initRiskStats = new Map<string, { overdue: number; blocked: number; max_overdue_days: number }>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tasks?.forEach(task => {
    let isOverdue = false;
    let isBlocked = task.status === 'blocked';
    let overdueDays = 0;

    if (task.due_date && task.status !== 'done') {
      const dueDate = new Date(task.due_date);
      if (dueDate < today) {
        isOverdue = true;
        overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    if (isOverdue) overdueTasksCount++;
    if (isBlocked) blockedTasksCount++;

    if ((isOverdue || isBlocked) && task.initiative_id) {
      const stats = initRiskStats.get(task.initiative_id) || { overdue: 0, blocked: 0, max_overdue_days: 0 };
      if (isOverdue) {
        stats.overdue++;
        stats.max_overdue_days = Math.max(stats.max_overdue_days, overdueDays);
      }
      if (isBlocked) stats.blocked++;
      initRiskStats.set(task.initiative_id, stats);
    }
  });

  const taskRiskOverviews: TaskRiskOverview[] = Array.from(initRiskStats.entries()).map(([initId, stats]) => {
    const init = initMap.get(initId);
    const product = init?.product_id ? productsMap.get(init.product_id) : null;
    return {
      initiative_id: initId,
      initiative_title: init?.title || 'Unknown Initiative',
      product_name: product?.name || '-',
      overdue_count: stats.overdue,
      blocked_count: stats.blocked,
      max_overdue_days: stats.max_overdue_days
    };
  }).sort((a, b) => (b.overdue_count + b.blocked_count) - (a.overdue_count + a.blocked_count));

  const topKpiIssues = allKpiItemsWithRatio
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  const alerts = await getWorkspaceAlerts(workspaceId);
  const notifications = currentUserId ? await getMyNotifications(workspaceId, currentUserId) : [];
  const latestDigest = await getLatestDigest(workspaceId);

  return {
    totalKpiItems: kpiItems.length,
    kpiIssuesCount,
    overdueTasksCount,
    blockedTasksCount,
    productSummaries,
    peopleSummaries,
    taskRiskOverviews,
    topKpiIssues,
    alerts,
    notifications,
    latestDigest,
    debug: {
      kpisCount: kpis?.length || 0,
      kpiItemsCount: kpiItems.length,
      tasksCount: tasks?.length || 0,
      initiativesCount: initiatives?.length || 0
    }
  };
}
