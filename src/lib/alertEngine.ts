import { supabase } from './supabaseClient';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 'KPI_UNDERPERFORMING' | 'KPI_NOT_UPDATED' | 'TASK_OVERDUE' | 'TASK_BLOCKED';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  owner_id: string | null;
  owner_name: string;
  product_name: string;
  title: string;
  subtitle: string;
  entity_id: string;
  entity_type: 'kpi' | 'task';
  route: string;
  created_from: 'kpi' | 'task';
  meta: any;
}

export async function getWorkspaceAlerts(workspaceId: string): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // 1. Fetch KPIs
  const { data: kpis, error: kpisError } = await supabase
    .from('kpis')
    .select('*')
    .eq('workspace_id', workspaceId);
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
    .eq('workspace_id', workspaceId);
  if (initError) throw initError;

  // 4. Fetch Tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (tasksError) throw tasksError;

  // 5. Fetch Products
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId);
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
  const initMap = new Map(initiatives?.map(i => [i.id, i]));

  // --- Process KPI Alerts ---
  kpiItems.forEach(item => {
    const kpi = kpiMap.get(item.kpi_id);
    if (!kpi) return;

    const profile = profilesMap.get(kpi.owner_id);
    const product = item.product_id ? productsMap.get(item.product_id) : null;
    const ownerName = profile?.full_name || 'Unknown';
    const productName = product?.name || '-';

    let ratio: number | null = null;
    let isNotUpdated = false;

    if (kpi.kpi_type === 'strategic') {
      if (item.manual_progress === null || item.manual_progress === undefined) {
        isNotUpdated = true;
      } else {
        ratio = item.manual_progress;
      }
    } else {
      if (!item.target || item.target === 0) {
        // skip
      } else if (item.actual === null || item.actual === undefined) {
        isNotUpdated = true;
      } else {
        const act = item.actual || 0;
        if (item.direction === 'lower_better') {
          ratio = act > 0 ? item.target / act : 1;
        } else {
          ratio = act / item.target;
        }
      }
    }

    if (isNotUpdated) {
      alerts.push({
        id: `kpi-not-updated-${item.id}`,
        type: 'KPI_NOT_UPDATED',
        severity: 'info',
        owner_id: kpi.owner_id,
        owner_name: ownerName,
        product_name: productName,
        title: 'KPI Not Updated',
        subtitle: `${kpi.title} - ${item.item_title}`,
        entity_id: kpi.id,
        entity_type: 'kpi',
        route: `/app/kpis/${kpi.id}`,
        created_from: 'kpi',
        meta: { item_id: item.id }
      });
    } else if (ratio !== null && ratio < 0.7) {
      alerts.push({
        id: `kpi-underperforming-${item.id}`,
        type: 'KPI_UNDERPERFORMING',
        severity: ratio < 0.4 ? 'critical' : 'warning',
        owner_id: kpi.owner_id,
        owner_name: ownerName,
        product_name: productName,
        title: 'KPI Underperforming',
        subtitle: `${kpi.title} - ${item.item_title} (${(ratio * 100).toFixed(1)}%)`,
        entity_id: kpi.id,
        entity_type: 'kpi',
        route: `/app/kpis/${kpi.id}`,
        created_from: 'kpi',
        meta: { item_id: item.id, ratio }
      });
    }
  });

  // --- Process Task Alerts ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tasks?.forEach(task => {
    const init = task.initiative_id ? initMap.get(task.initiative_id) : null;
    const profile = profilesMap.get(task.owner_id);
    const product = init?.product_id ? productsMap.get(init.product_id) : null;
    
    const ownerName = profile?.full_name || 'Unknown';
    const productName = product?.name || '-';

    if (task.status === 'blocked') {
      alerts.push({
        id: `task-blocked-${task.id}`,
        type: 'TASK_BLOCKED',
        severity: 'warning',
        owner_id: task.owner_id,
        owner_name: ownerName,
        product_name: productName,
        title: 'Task Blocked',
        subtitle: task.title,
        entity_id: task.initiative_id || task.id,
        entity_type: 'task',
        route: task.initiative_id ? `/app/initiatives/${task.initiative_id}` : '',
        created_from: 'task',
        meta: { task_id: task.id }
      });
    }

    if (task.due_date && task.status !== 'done') {
      const dueDate = new Date(task.due_date);
      if (dueDate < today) {
        const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `task-overdue-${task.id}`,
          type: 'TASK_OVERDUE',
          severity: overdueDays > 3 ? 'critical' : 'warning',
          owner_id: task.owner_id,
          owner_name: ownerName,
          product_name: productName,
          title: 'Task Overdue',
          subtitle: `${task.title} (${overdueDays} days overdue)`,
          entity_id: task.initiative_id || task.id,
          entity_type: 'task',
          route: task.initiative_id ? `/app/initiatives/${task.initiative_id}` : '',
          created_from: 'task',
          meta: { task_id: task.id, overdueDays }
        });
      }
    }
  });

  // Sort alerts by severity: critical -> warning -> info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
