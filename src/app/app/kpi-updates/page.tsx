"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { Profile, getCurrentWorkspaceId } from "../../../lib/dataAccess";

export default function KpiUpdatesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [kpiItems, setKpiItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [kpiFilter, setKpiFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Local edits tracking
  const [edits, setEdits] = useState<Record<string, {actual: string, manual_progress: string, note: string}>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const [myProfileRes, deptsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userData.user?.id).maybeSingle(),
        supabase.from("departments").select("id, name")
      ]);
      const myProfileData = myProfileRes.data;
      
      const wsId = await getCurrentWorkspaceId(myProfileData, null);
      
      setRoleCode(myProfileData?.role || 'viewer');
      setWorkspaceId(wsId);
      setMyProfile(myProfileData);
      setDepartments(deptsRes.data || []);

      const kpiQuery = supabase.from("kpis").select("id, title, owner_id, department_id, month_key, workspace_id").order("created_at", { ascending: false });
      if (wsId && wsId !== 'default') {
        kpiQuery.eq('workspace_id', wsId);
      }
      
      const [kpisRes, profilesRes] = await Promise.all([
        kpiQuery,
        supabase.from("profiles").select("user_id, full_name, department_id, workspace_id")
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const kpisData = kpisRes.data || [];
      setProfiles(profilesRes.data || []);
      
      if (kpisData.length > 0) {
        const kpiIds = kpisData.map(k => k.id);
        const chunkSize = 200;
        let allItems: any[] = [];
        for (let i = 0; i < kpiIds.length; i += chunkSize) {
          const chunk = kpiIds.slice(i, i + chunkSize);
          const { data: itemData, error: itemError } = await supabase.from("kpi_items").select("*").in("kpi_id", chunk);
          if (itemError) throw itemError;
          if (itemData) allItems = [...allItems, ...itemData];
        }
        
        const merged = allItems.map(item => {
          const kpi = kpisData.find(k => k.id === item.kpi_id);
          return {
            ...item,
            kpi_title: kpi?.title,
            owner_id: kpi?.owner_id,
            department_id: kpi?.department_id,
            month_key: kpi?.month_key,
            workspace_id: kpi?.workspace_id,
          };
        });
        
        setKpiItems(merged);
        
        // Initialize edits state
        const initialEdits: Record<string, any> = {};
        merged.forEach(item => {
          initialEdits[item.id] = {
            actual: item.actual !== null ? String(item.actual) : "",
            manual_progress: item.manual_progress !== null ? String(item.manual_progress) : "",
            note: item.note || ""
          };
        });
        setEdits(initialEdits);
      } else {
        setKpiItems([]);
        setEdits({});
      }

    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEditChange = (itemId: string, field: string, value: string) => {
    setEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSave = async (item: any) => {
    if (!edits[item.id]) return;
    
    setSavingItemId(item.id);
    try {
      const editData = edits[item.id] || { actual: "", manual_progress: "", note: "" };
      const actualVal = typeof editData.actual === 'string' && editData.actual.trim() === "" ? null : Number(editData.actual);
      const manualProgressVal = typeof editData.manual_progress === 'string' && editData.manual_progress.trim() === "" ? null : Number(editData.manual_progress);
      
      const updates = {
        actual: isNaN(actualVal as number) ? null : actualVal,
        manual_progress: isNaN(manualProgressVal as number) ? null : manualProgressVal,
        note: editData.note || null
      };

      const { error } = await supabase.from("kpi_items").update(updates).eq("id", item.id);
      
      if (error) throw error;
      
      // Update local item
      setKpiItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i));
      alert("Đã cập nhật KPI");
    } catch (err: any) {
      alert("Lỗi khi lưu KPI: " + (err.message || "Bạn không có quyền thực hiện hoặc đã xảy ra sự cố."));
    } finally {
      setSavingItemId(null);
    }
  };

  // Determine role booleans
  const isDirectorRole = roleCode === 'director' || roleCode === 'admin';
  const isManagerRole = roleCode === 'manager' || roleCode === 'lead';
  const isViewer = roleCode === 'viewer';
  const isMember = roleCode === 'member' || (!isDirectorRole && !isManagerRole && !isViewer);

  // Default months
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(
    m => `2024-${m}` // Or we can extract unique months
  );
  
  // Extract unique months from actual data
  const uniqueMonths = Array.from(new Set(kpiItems.map(item => item.month_key).filter(Boolean))).sort().reverse();
  
  // Extract unique KPIs for filter based on current items
  const uniqueKpis = Array.from(new Map(kpiItems.map(item => [item.kpi_id, item.kpi_title])).entries());
  
  // Filter logic
  const filteredItems = kpiItems.filter(item => {
    // 1. Role based filter for members/managers
    if (isMember && item.owner_id !== myProfile?.user_id) {
      return false;
    }
    if (isManagerRole && item.department_id !== myProfile?.department_id) {
      return false;
    }
    
    // 2. UI Filters
    if (monthFilter !== "all" && item.month_key !== monthFilter) return false;
    if (ownerFilter !== "all" && item.owner_id !== ownerFilter) return false;
    if (deptFilter !== "all" && item.department_id !== deptFilter) return false;
    if (kpiFilter !== "all" && item.kpi_id !== kpiFilter) return false;
    
    if (statusFilter === "missing_actual" && item.actual !== null) return false;
    if (statusFilter === "has_actual" && item.actual === null) return false;
    
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cập nhật nhanh KPI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cập nhật đồng loạt Actual, Tiến độ và Ghi chú cho các hạng mục KPI
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-md mb-6 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">Tất cả</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Member doesn't need to see Owner filter (or can see only themselves if you want, but it's redundant) */}
        {!isMember && (
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nhân sự</label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="all">Tất cả</option>
              {profiles
                // If manager, only show users in their dept
                .filter(p => !isManagerRole || p.department_id === myProfile?.department_id)
                .map(p => (
                  <option key={p.user_id} value={p.user_id}>{p.full_name || p.user_id}</option>
              ))}
            </select>
          </div>
        )}

        {/* Only Director sees Department filter */}
        {isDirectorRole && (
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="all">Tất cả</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* KPI Filter */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">KPI</label>
          <select
            value={kpiFilter}
            onChange={(e) => setKpiFilter(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">Tất cả</option>
            {uniqueKpis.map(([id, title]) => (
              <option key={id} value={id}>{title || "-"}</option>
            ))}
          </select>
        </div>

        {/* Update status filter */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái cập nhật</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">Tất cả</option>
            <option value="missing_actual">Chưa cập nhật Actual</option>
            <option value="has_actual">Đã có Actual</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nhân sự / Tháng
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KPI
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hạng mục KPI
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Target
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actual
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Tiến độ (%)
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ghi chú
                </th>
                {!isViewer && (
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isViewer ? 7 : 8} className="px-4 py-8 text-center text-gray-500">
                    Không có hạng mục KPI nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const ownerName = profiles.find(p => p.user_id === item.owner_id)?.full_name || "(Không Rõ)";
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                        <div className="font-medium">{ownerName}</div>
                        <div className="text-gray-500 text-xs">{item.month_key}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100 max-w-xs truncate" title={item.kpi_title}>
                        {item.kpi_title || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100 max-w-xs truncate" title={item.item_title}>
                        {item.item_title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-100 font-medium">
                        {item.target !== null ? item.target.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                        {isViewer ? (
                          <span>{item.actual !== null ? item.actual.toLocaleString() : "-"}</span>
                        ) : (
                          <input
                            type="number"
                            className="w-full border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={edits[item.id]?.actual ?? ""}
                            onChange={(e) => handleEditChange(item.id, "actual", e.target.value)}
                            placeholder="Actual..."
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                        {isViewer ? (
                          <span>{item.manual_progress !== null ? item.manual_progress : "-"}</span>
                        ) : (
                          <input
                            type="number"
                            className="w-full border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={edits[item.id]?.manual_progress ?? ""}
                            onChange={(e) => handleEditChange(item.id, "manual_progress", e.target.value)}
                            placeholder="%"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                        {isViewer ? (
                          <div className="max-w-xs truncate" title={item.note}>{item.note || "-"}</div>
                        ) : (
                          <input
                            type="text"
                            className="w-full border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={edits[item.id]?.note ?? ""}
                            onChange={(e) => handleEditChange(item.id, "note", e.target.value)}
                            placeholder="Ghi chú thêm..."
                          />
                        )}
                      </td>
                      {!isViewer && (
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                          <button
                            onClick={() => handleSave(item)}
                            disabled={savingItemId === item.id}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {savingItemId === item.id ? "Đang lưu..." : "Lưu"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
