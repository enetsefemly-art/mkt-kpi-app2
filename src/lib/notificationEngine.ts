import { supabase } from './supabaseClient';
import { shouldApplyUuidFilter } from './uuid';

export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationType = 'TASK_DUE_SOON' | 'TASK_OVERDUE' | 'TASK_BLOCKED' | 'KPI_NOT_UPDATED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  subtitle: string;
  route: string;
  due_date?: string | null;
  product_name?: string;
  initiative_title?: string;
  meta: any;
}

export async function getMyNotifications(workspaceId: string, currentUserId: string): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];

  // 1. Fetch Tasks for current user
  const taskQuery: any = {};
  if (shouldApplyUuidFilter(workspaceId)) taskQuery.workspace_id = workspaceId;
  if (shouldApplyUuidFilter(currentUserId)) taskQuery.owner_id = currentUserId;

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .match(taskQuery);
  if (tasksError) throw tasksError;

  // 2. Fetch KPIs for current user
  const kpiQuery: any = {};
  if (shouldApplyUuidFilter(workspaceId)) kpiQuery.workspace_id = workspaceId;
  if (shouldApplyUuidFilter(currentUserId)) kpiQuery.owner_id = currentUserId;

  const { data: kpis, error: kpisError } = await supabase
    .from('kpis')
    .select('*')
    .match(kpiQuery);
  if (kpisError) throw kpisError;

  const kpiIds = kpis?.map(k => k.id) || [];

  // 3. Fetch KPI Items for those KPIs
  let kpiItems: any[] = [];
  if (kpiIds.length > 0) {
    const { data, error } = await supabase
      .from('kpi_items')
      .select('*')
      .in('kpi_id', kpiIds);
    if (error) throw error;
    kpiItems = data || [];
  }

  // 4. Fetch Initiatives
  const { data: initiatives, error: initError } = await supabase
    .from('initiatives')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});
  if (initError) throw initError;

  // 5. Fetch Products
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});
  if (prodError) throw prodError;

  const productsMap = new Map<string, any>();
  products?.forEach(p => productsMap.set(p.id, p));

  const initMap = new Map(initiatives?.map(i => [i.id, i]));
  const kpiMap = new Map(kpis?.map(k => [k.id, k]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // --- Process Tasks ---
  tasks?.forEach(task => {
    const init = task.initiative_id ? initMap.get(task.initiative_id) : null;
    const product = init?.product_id ? productsMap.get(init.product_id) : null;
    
    const productName = product?.name || '-';
    const initiativeTitle = init?.title || '-';
    const route = task.initiative_id ? `/app/initiatives/${task.initiative_id}` : '';

    if (task.status === 'blocked') {
      notifications.push({
        id: `task-blocked-${task.id}`,
        type: 'TASK_BLOCKED',
        severity: 'warning',
        title: 'Task Blocked',
        subtitle: task.title,
        route,
        due_date: task.due_date,
        product_name: productName,
        initiative_title: initiativeTitle,
        meta: { task_id: task.id }
      });
    }

    if (task.due_date && task.status !== 'done') {
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        notifications.push({
          id: `task-overdue-${task.id}`,
          type: 'TASK_OVERDUE',
          severity: overdueDays > 3 ? 'critical' : 'warning',
          title: 'Task Overdue',
          subtitle: `${task.title} (${overdueDays} days overdue)`,
          route,
          due_date: task.due_date,
          product_name: productName,
          initiative_title: initiativeTitle,
          meta: { task_id: task.id, overdueDays }
        });
      } else if (dueDate.getTime() === today.getTime() || dueDate.getTime() === tomorrow.getTime()) {
        const isToday = dueDate.getTime() === today.getTime();
        notifications.push({
          id: `task-due-soon-${task.id}`,
          type: 'TASK_DUE_SOON',
          severity: 'info',
          title: isToday ? 'Task Due Today' : 'Task Due Tomorrow',
          subtitle: task.title,
          route,
          due_date: task.due_date,
          product_name: productName,
          initiative_title: initiativeTitle,
          meta: { task_id: task.id }
        });
      }
    }
  });

  // --- Process KPI Items ---
  kpiItems.forEach(item => {
    const kpi = kpiMap.get(item.kpi_id);
    if (!kpi) return;

    const product = item.product_id ? productsMap.get(item.product_id) : null;
    const productName = product?.name || '-';

    let isNotUpdated = false;

    if (kpi.kpi_type === 'strategic') {
      if (item.manual_progress === null || item.manual_progress === undefined) {
        isNotUpdated = true;
      }
    } else {
      if (item.actual === null || item.actual === undefined) {
        isNotUpdated = true;
      }
    }

    if (isNotUpdated) {
      notifications.push({
        id: `kpi-not-updated-${item.id}`,
        type: 'KPI_NOT_UPDATED',
        severity: 'info',
        title: 'KPI Not Updated',
        subtitle: `${kpi.title} - ${item.item_title}`,
        route: `/app/kpis/${kpi.id}`,
        product_name: productName,
        meta: { item_id: item.id }
      });
    }
  });

  // Sort notifications by severity: critical -> warning -> info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return notifications;
}
