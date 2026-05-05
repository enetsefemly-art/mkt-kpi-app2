import { supabase } from './supabaseClient';
import { formatError } from './errorUtils';
import { cleanUuid, shouldApplyUuidFilter } from './uuid';

export interface WorkspaceRole {
  workspaceId: string;
  roleCode: string;
}

export interface Profile {
  user_id: string;
  full_name: string;
  function: string;
  role?: string;
  department_id?: string;
  manager_id?: string;
  status?: string;
  avatar_url?: string;
  email?: string;
  workspace_id?: string | null;
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


export async function getCurrentWorkspaceId(
  profile?: Profile | null,
  selectedOwnerProfile?: Profile | null
): Promise<string | null> {
  // 1. profile.workspace_id
  if (profile?.workspace_id && profile.workspace_id !== 'default') {
    return profile.workspace_id;
  }
  
  // 2. selectedOwner.workspace_id
  if (selectedOwnerProfile?.workspace_id && selectedOwnerProfile.workspace_id !== 'default') {
    return selectedOwnerProfile.workspace_id;
  }

  // 3. defaultWorkspace.id từ public.workspaces
  const { data: wsData, error } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
  if (!error && wsData?.id) {
    return wsData.id;
  }

  // 4. Nếu vẫn không có
  return null;
}

export async function getAuthedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

export async function getMyProfile(): Promise<Profile> {
  const user = await getAuthedUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return {
      user_id: user.id,
      full_name: user?.email?.split('@')[0] || 'Unknown',
      function: '',
      role: 'director',
      email: user.email || ''
    };
  }
  
  if (!data) {
    return {
      user_id: user.id,
      full_name: user?.email?.split('@')[0] || 'Unknown',
      function: '',
      role: 'director',
      email: user.email || ''
    };
  }
  
  return data as Profile;
}

export async function getMyWorkspaceAndRole(): Promise<WorkspaceRole> {
  const user = await getAuthedUser();

  const { data, error } = await supabase
    .from('user_roles')
    .select('workspace_id, role_code')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      workspaceId: '',
      roleCode: 'member'
    };
  }

  if (!data) {
    return {
      workspaceId: '',
      roleCode: 'member'
    };
  }

  return {
    workspaceId: data.workspace_id,
    roleCode: data.role_code
  };
}

export interface Department {
  id: string;
  name: string;
}

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .order('name');
    
  if (error) {
    if (error.code === '42P01') {
      // Table doesn't exist yet, return empty
      return [];
    }
    throw new Error(formatError(error, 'Lỗi lấy danh sách phòng ban'));
  }
  return data || [];
}

export async function updateMyProfile(updates: Partial<Profile>): Promise<void> {
  const user = await getAuthedUser();
  const userQuery: any = {};
  if (shouldApplyUuidFilter(user.id)) userQuery.user_id = user.id;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .match(userQuery);
  
  if (error) {
    throw new Error(formatError(error, 'Lỗi cập nhật cấu hình tài khoản'));
  }
}

export async function updateUserProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  const userQuery: any = {};
  if (shouldApplyUuidFilter(userId)) userQuery.user_id = userId;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .match(userQuery)
    .select()
    .maybeSingle();
  
  if (error) {
    throw new Error(formatError(error, 'Lỗi cập nhật cấu hình tài khoản'));
  }
  if (!data) {
    throw new Error('Bạn không có quyền hoặc người dùng không tồn tại');
  }
}

export async function listProducts(workspaceId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('id, code, name')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .order('name');
  
  if (error) throw error;
  return data || [];
}

export async function listProfilesInWorkspace(workspaceId: string): Promise<Profile[]> {
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {});

  if (roleError) throw roleError;

  const userIds = roleData.map((r: any) => r.user_id);
  
  if (userIds.length === 0) return [];

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name, function, role, department_id, manager_id, status, avatar_url, email')
    .in('user_id', userIds);

  if (profileError) throw profileError;

  const profilesMap = new Map(profileData?.map((p: any) => [p.user_id, p]));
  
  return userIds.map((uid: string) => {
    const profile = profilesMap.get(uid);
    return {
      user_id: uid,
      full_name: profile?.full_name || '(no profile)',
      function: profile?.function || '',
      role: profile?.role,
      department_id: profile?.department_id,
      manager_id: profile?.manager_id,
      status: profile?.status,
      avatar_url: profile?.avatar_url,
      email: profile?.email
    };
  });
}

export async function listKpis(workspaceId: string): Promise<Kpi[]> {
  const { data: kpis, error: kpiError } = await supabase
    .from('kpis')
    .select('id, owner_id, title, kpi_type, unit, weight, created_at, month_key, kpi_score_method')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
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
      .select('user_id, full_name, function, department_id')
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
