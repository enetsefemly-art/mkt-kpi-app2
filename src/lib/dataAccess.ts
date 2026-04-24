import { supabase } from './supabaseClient';
import { formatError } from './errorUtils';

export interface WorkspaceRole {
  workspaceId: string;
  roleCode: string;
}

export interface Profile {
  user_id: string;
  full_name: string;
  function: string;
}

export interface Kpi {
  id: string;
  owner_id: string;
  title: string;
  kpi_type: string;
  unit: string;
  weight: number;
  created_at: string;
  month_key?: string;
  kpi_score_method?: string;
  owner_name?: string;
  owner_function?: string;
  item_count?: number;
}

export async function getAuthedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  return user;
}

export async function getMyWorkspaceAndRole(): Promise<WorkspaceRole> {
  const user = await getAuthedUser();

  const { data, error } = await supabase
    .from('user_roles')
    .select('workspace_id, role_code')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching workspace role:', error);
    throw new Error(formatError(error, 'Failed to fetch workspace role'));
  }

  if (!data) {
    throw new Error('No workspace role found for this user');
  }

  return {
    workspaceId: data.workspace_id,
    roleCode: data.role_code
  };
}

export async function listProducts(workspaceId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('id, code, name')
    .eq('workspace_id', workspaceId)
    .order('name');
  
  if (error) throw error;
  return data || [];
}

export async function listProfilesInWorkspace(workspaceId: string): Promise<Profile[]> {
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('workspace_id', workspaceId);

  if (roleError) throw roleError;

  const userIds = roleData.map((r: any) => r.user_id);
  
  if (userIds.length === 0) return [];

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name, function')
    .in('user_id', userIds);

  if (profileError) throw profileError;

  const profilesMap = new Map(profileData?.map((p: any) => [p.user_id, p]));
  
  return userIds.map((uid: string) => {
    const profile = profilesMap.get(uid);
    return {
      user_id: uid,
      full_name: profile?.full_name || '(no profile)',
      function: profile?.function || ''
    };
  });
}

export async function listKpis(workspaceId: string): Promise<Kpi[]> {
  const { data: kpis, error: kpiError } = await supabase
    .from('kpis')
    .select('id, owner_id, title, kpi_type, unit, weight, created_at, month_key, kpi_score_method')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (kpiError) throw kpiError;
  if (!kpis || kpis.length === 0) return [];

  const kpiIds = kpis.map((k: any) => k.id);
  const ownerIds = [...new Set(kpis.map((k: any) => k.owner_id))];

  let profilesMap = new Map();
  if (ownerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, function')
      .in('user_id', ownerIds);
      
    if (!profileError && profiles) {
      profiles.forEach((p: any) => profilesMap.set(p.user_id, p));
    }
  }

  const { data: items, error: itemError } = await supabase
    .from('kpi_items')
    .select('kpi_id')
    .in('kpi_id', kpiIds);

  const countsMap = new Map();
  if (!itemError && items) {
    items.forEach((item: any) => {
      countsMap.set(item.kpi_id, (countsMap.get(item.kpi_id) || 0) + 1);
    });
  }

  return kpis.map((k: any) => {
    const profile = profilesMap.get(k.owner_id);
    return {
      ...k,
      owner_name: profile?.full_name || '(Unknown)',
      owner_function: profile?.function || '',
      item_count: countsMap.get(k.id) || 0
    };
  });
}

export async function getKpiDetail(kpiId: string) {
  const { data: kpi, error: kpiError } = await supabase
    .from('kpis')
    .select('*')
    .eq('id', kpiId)
    .single();

  if (kpiError) throw kpiError;

  const { data: items, error: itemsError } = await supabase
    .from('kpi_items')
    .select('*')
    .eq('kpi_id', kpiId)
    .order('created_at', { ascending: true });

  if (itemsError) throw itemsError;

  let ownerProfile = null;
  if (kpi.owner_id) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('user_id, full_name, function')
      .eq('user_id', kpi.owner_id)
      .maybeSingle();
    if (owner) ownerProfile = owner;
  }

  const productIds = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))];
  const productsMap = new Map();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, code, name')
      .in('id', productIds);
    if (products) {
      products.forEach((p: any) => productsMap.set(p.id, p));
    }
  }

  return {
    kpi,
    items: items || [],
    ownerProfile,
    productsMap
  };
}

export async function createKpi(kpiData: any) {
    const { data, error } = await supabase
        .from('kpis')
        .insert(kpiData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateKpi(kpiId: string, updates: any) {
    const { data, error } = await supabase
        .from('kpis')
        .update(updates)
        .eq('id', kpiId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createKpiItem(itemData: any) {
    const { data, error } = await supabase
        .from('kpi_items')
        .insert(itemData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateKpiItem(itemId: string, updates: any) {
    const { data, error } = await supabase
        .from('kpi_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();
    if (error) throw error;
    return data;
}
