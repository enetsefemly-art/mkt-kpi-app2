import { supabase } from "./supabaseClient";

export async function fetchKpiProgressData(workspaceId: string) {
  // 1. Fetch KPIs
  const { data: kpis, error: kpisError } = await supabase
    .from("kpis")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (kpisError) throw kpisError;

  // 2. Fetch KPI Items
  const kpiIds = kpis.map((k: any) => k.id);
  let kpiItems: any[] = [];
  if (kpiIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("kpi_items")
      .select("*")
      .in("kpi_id", kpiIds);
    if (itemsError) throw itemsError;
    kpiItems = items || [];
  }

  // 3. Fetch Products
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (productsError) throw productsError;

  // 4. Fetch Profiles
  const { data: workspaceUsers, error: wuError } = await supabase
    .from("workspace_users")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (wuError) throw wuError;

  let profiles: any[] = [];
  if (workspaceUsers && workspaceUsers.length > 0) {
    const userIds = workspaceUsers.map((wu: any) => wu.user_id);
    const { data: profs, error: profsError } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", userIds);
    if (profsError) throw profsError;
    profiles = profs || [];
  }

  return {
    kpis: kpis || [],
    kpiItems,
    products: products || [],
    profiles
  };
}
