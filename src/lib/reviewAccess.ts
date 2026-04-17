import { supabase } from './supabaseClient';

export interface UnderperformingKpi {
  id: string;
  kpi_id: string;
  owner_id: string;
  owner_name: string;
  owner_function: string;
  kpi_title: string;
  item_title: string;
  product_id: string | null;
  product_name: string;
  target: number | null;
  actual: number | null;
  manual_progress: number | null;
  ratio: number;
  severity: 'critical' | 'warning';
}

export interface IssueTask {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  initiative_title: string;
  due_date: string | null;
  status: string;
  blocker_reason: string | null;
  product_id: string | null;
  product_name: string;
  days_overdue?: number;
}

export interface ReviewData {
  underperformingKpis: UnderperformingKpi[];
  overdueTasks: IssueTask[];
  blockedTasks: IssueTask[];
  products: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  debug: {
    kpisCount: number;
    kpiItemsCount: number;
    tasksCount: number;
    initiativesCount: number;
  };
}

export async function getReviewData(workspaceId: string): Promise<ReviewData> {
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

  // 5. Collect unique Owner IDs and Product IDs
  const ownerIds = new Set<string>();
  kpis?.forEach(k => { if (k.owner_id) ownerIds.add(k.owner_id); });
  initiatives?.forEach(i => { if (i.owner_id) ownerIds.add(i.owner_id); });
  tasks?.forEach(t => { if (t.owner_id) ownerIds.add(t.owner_id); });

  const productIds = new Set<string>();
  kpiItems.forEach(ki => { if (ki.product_id) productIds.add(ki.product_id); });
  initiatives?.forEach(i => { if (i.product_id) productIds.add(i.product_id); });

  // 6. Fetch Profiles
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

  // 7. Fetch Products
  const productsMap = new Map<string, any>();
  if (productIds.size > 0) {
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, code, name')
      .in('id', Array.from(productIds));
    if (!prodError && products) {
      products.forEach(p => productsMap.set(p.id, p));
    }
  }

  // --- Process KPI Underperforming ---
  const underperformingKpis: UnderperformingKpi[] = [];
  const kpiMap = new Map(kpis?.map(k => [k.id, k]));

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

    if (ratio !== null && ratio < 0.7) {
      const owner = profilesMap.get(kpi.owner_id);
      const product = item.product_id ? productsMap.get(item.product_id) : null;
      
      underperformingKpis.push({
        id: item.id,
        kpi_id: kpi.id,
        owner_id: kpi.owner_id,
        owner_name: owner?.full_name || 'Unknown',
        owner_function: owner?.function || '',
        kpi_title: kpi.title,
        item_title: item.item_title,
        product_id: item.product_id,
        product_name: product?.name || '',
        target: item.target,
        actual: item.actual,
        manual_progress: item.manual_progress,
        ratio: ratio,
        severity: ratio < 0.4 ? 'critical' : 'warning'
      });
    }
  });

  // --- Process Tasks ---
  const overdueTasks: IssueTask[] = [];
  const blockedTasks: IssueTask[] = [];
  const initMap = new Map(initiatives?.map(i => [i.id, i]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tasks?.forEach(task => {
    const init = initMap.get(task.initiative_id);
    const owner = profilesMap.get(task.owner_id);
    const product = init?.product_id ? productsMap.get(init.product_id) : null;

    const baseTask: IssueTask = {
      id: task.id,
      title: task.title,
      owner_id: task.owner_id,
      owner_name: owner?.full_name || 'Unknown',
      initiative_title: init?.title || 'Unknown Initiative',
      due_date: task.due_date,
      status: task.status,
      blocker_reason: task.blocker_reason,
      product_id: init?.product_id || null,
      product_name: product?.name || ''
    };

    // Check Overdue
    if (task.due_date && task.status !== 'done') {
      const dueDate = new Date(task.due_date);
      if (dueDate < today) {
        const diffTime = Math.abs(today.getTime() - dueDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        overdueTasks.push({ ...baseTask, days_overdue: diffDays });
      }
    }

    // Check Blocked
    if (task.status === 'blocked') {
      blockedTasks.push(baseTask);
    }
  });

  // Unique Products and Owners for filters
  const uniqueProducts = Array.from(productsMap.values()).map(p => ({ id: p.id, name: p.name }));
  const uniqueOwners = Array.from(profilesMap.values()).map(p => ({ id: p.user_id, name: p.full_name }));

  // Sort products and owners alphabetically
  uniqueProducts.sort((a, b) => a.name.localeCompare(b.name));
  uniqueOwners.sort((a, b) => a.name.localeCompare(b.name));

  return {
    underperformingKpis,
    overdueTasks,
    blockedTasks,
    products: uniqueProducts,
    owners: uniqueOwners,
    debug: {
      kpisCount: kpis?.length || 0,
      kpiItemsCount: kpiItems.length,
      tasksCount: tasks?.length || 0,
      initiativesCount: initiatives?.length || 0
    }
  };
}
