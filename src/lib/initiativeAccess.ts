import { supabase } from './supabaseClient';

export interface Initiative {
  id: string;
  workspace_id: string;
  owner_id: string;
  product_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  month_key: string;
  created_at: string;
  // Mapped fields
  owner_name?: string;
  owner_function?: string;
  product_name?: string;
  product_code?: string;
  overdue_count?: number;
  blocked_count?: number;
}

export interface CreateInitiativePayload {
  workspace_id: string;
  owner_id: string;
  product_id: string | null;
  title: string;
  description: string;
  priority: string;
  month_key: string;
}

export async function listInitiatives(
  workspaceId: string,
  monthKey: string,
  productId?: string
): Promise<Initiative[]> {
  // 1. Query initiatives
  let query = supabase
    .from('initiatives')
    .select('id, workspace_id, owner_id, product_id, title, description, priority, month_key, created_at')
    .eq('workspace_id', workspaceId)
    .eq('month_key', monthKey)
    .order('created_at', { ascending: false });

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data: initiatives, error: initError } = await query;

  if (initError) throw initError;
  if (!initiatives || initiatives.length === 0) return [];

  // 2. Extract IDs for batch fetching
  const ownerIds = Array.from(new Set(initiatives.map((i) => i.owner_id).filter(Boolean)));
  const productIds = Array.from(new Set(initiatives.map((i) => i.product_id).filter(Boolean)));
  const initiativeIds = initiatives.map((i) => i.id);

  // 3. Fetch Profiles (Owners)
  const profilesMap = new Map<string, { full_name: string; function: string }>();
  if (ownerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, function')
      .in('user_id', ownerIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      // Don't throw, just continue with missing profile info
    } else if (profiles) {
      profiles.forEach((p) => {
        profilesMap.set(p.user_id, { full_name: p.full_name, function: p.function });
      });
    }
  }

  // 4. Fetch Products
  const productsMap = new Map<string, { code: string; name: string }>();
  if (productIds.length > 0) {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, code, name')
      .in('id', productIds);

    if (productError) {
      console.error('Error fetching products:', productError);
    } else if (products) {
      products.forEach((p) => {
        productsMap.set(p.id, { code: p.code, name: p.name });
      });
    }
  }

  // 5. Fetch Task Counts (Optional MVP)
  const taskCountsMap = new Map<string, { overdue: number; blocked: number }>();
  if (initiativeIds.length > 0) {
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('initiative_id, due_date, status')
      .in('initiative_id', initiativeIds);

    if (taskError) {
      console.error('Error fetching tasks for counts:', taskError);
    } else if (tasks) {
      const now = new Date();
      tasks.forEach((t) => {
        const counts = taskCountsMap.get(t.initiative_id) || { overdue: 0, blocked: 0 };
        
        // Check overdue
        if (t.due_date && new Date(t.due_date) < now && t.status !== 'done') {
          counts.overdue++;
        }
        // Check blocked
        if (t.status === 'blocked') {
          counts.blocked++;
        }
        
        taskCountsMap.set(t.initiative_id, counts);
      });
    }
  }

  // 6. Map Data
  return initiatives.map((init) => {
    const profile = profilesMap.get(init.owner_id);
    const product = init.product_id ? productsMap.get(init.product_id) : null;
    const counts = taskCountsMap.get(init.id) || { overdue: 0, blocked: 0 };

    return {
      ...init,
      owner_name: profile?.full_name || 'Unknown',
      owner_function: profile?.function || '',
      product_name: product?.name || '',
      product_code: product?.code || '',
      overdue_count: counts.overdue,
      blocked_count: counts.blocked,
    };
  });
}

export async function createInitiative(payload: CreateInitiativePayload) {
  const { data, error } = await supabase
    .from('initiatives')
    .insert({
      workspace_id: payload.workspace_id,
      owner_id: payload.owner_id,
      product_id: payload.product_id,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      month_key: payload.month_key,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
