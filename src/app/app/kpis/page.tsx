"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";

export default function KpisPage() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roleCode, setRoleCode] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    owner_id: "",
    title: "",
    kpi_type: "project",
    unit: "Điểm",
    weight: 100,
    month_key: "",
    kpi_score_method: "aggregate_ratio",
    description: ""
  });

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const roleResult = await getMyWorkspaceAndRole();
      setRoleCode(roleResult.roleCode);

      const [kpisRes, profilesRes] = await Promise.all([
        supabase.from("kpis").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name")
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setKpis(kpisRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateKpi = async (e: any) => {
    e.preventDefault();
    console.log("create KPI clicked");

    if (isSubmitting) return;

    if (!formData.owner_id) return setFormError("Vui lòng chọn nhân sự phụ trách");
    if (!formData.title.trim()) return setFormError("Vui lòng nhập tên KPI");
    if (formData.weight <= 0) return setFormError("Trọng số phải lớn hơn 0");
    if (!formData.month_key) return setFormError("Vui lòng chọn tháng");
    if (!formData.kpi_score_method) return setFormError("Vui lòng chọn cách tính điểm");

    try {
      setIsSubmitting(true);
      setFormError(null);

      const { error: insertError } = await supabase.from("kpis").insert({
        owner_id: formData.owner_id,
        title: formData.title,
        kpi_type: formData.kpi_type,
        unit: formData.unit,
        weight: formData.weight,
        month_key: formData.month_key,
        kpi_score_method: formData.kpi_score_method,
        description: formData.description
      });

      if (insertError) throw insertError;

      setFormData({
        owner_id: "",
        title: "",
        kpi_type: "project",
        unit: "Điểm",
        weight: 100,
        month_key: "",
        kpi_score_method: "aggregate_ratio",
        description: ""
      });
      setShowCreateForm(false);
      
      await load();
    } catch (err: any) {
      setFormError(err.message || "Đã xảy ra lỗi khi tạo KPI");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = roleCode === 'admin' || roleCode === 'lead';

  if (isLoading && kpis.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">Đang tải KPI...</div>
      </div>
    );
  }

  if (error && kpis.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50">
        <div className="bg-red-50 text-red-600 p-4 rounded-md">Đã xảy ra lỗi: {error}</div>
      </div>
    );
  }

  // Filter lists
  const availableMonths = Array.from(new Set((kpis || []).map(k => k.month_key).filter(Boolean))).sort().reverse();
  const validProfiles = (profiles || []).filter(p => p.full_name);

  // Apply filters
  let filteredKpis = (kpis || []).filter(kpi => {
    let match = true;
    if (ownerFilter !== "all" && kpi.owner_id !== ownerFilter) match = false;
    if (monthFilter !== "all" && kpi.month_key !== monthFilter) match = false;
    if (typeFilter !== "all" && kpi.kpi_type !== typeFilter) match = false;
    return match;
  });

  // Sort: created_at desc (nulls last)
  filteredKpis.sort((a, b) => {
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh sách KPI của đội ngũ</p>
        </div>
        
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 outline-none text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 transition"
          >
            {showCreateForm ? "Đóng form" : "Tạo KPI"}
          </button>
        )}
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nhân sự</label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            >
              <option value="all">Tất cả nhân sự</option>
              {validProfiles.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tháng</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            >
              <option value="all">Tất cả tháng</option>
              {availableMonths.map(m => (
                <option key={m as string} value={m as string}>{m as string}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loại KPI</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            >
              <option value="all">Tất cả loại KPI</option>
              <option value="revenue">Doanh thu (revenue)</option>
              <option value="lead">Khách hàng mới (lead)</option>
              <option value="rate">Tỷ lệ (rate)</option>
              <option value="cost">Chi phí (cost)</option>
              <option value="strategic">Chiến lược (strategic)</option>
              <option value="project">Dự án (project)</option>
              <option value="product">Sản phẩm (product)</option>
              <option value="team">Đội nhóm (team)</option>
              <option value="personal">Cá nhân (personal)</option>
            </select>
          </div>
        </div>
      </div>

      {showCreateForm && canCreate && (
        <div className="bg-white p-6 shadow-sm rounded-lg border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Tạo KPI Mới</h2>
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateKpi} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên KPI</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Ví dụ: Đạt doanh số Quý 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách</label>
                <select
                  required
                  value={formData.owner_id}
                  onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {profiles.map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.full_name || "Không xác định"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại KPI</label>
                <select
                  value={formData.kpi_type}
                  onChange={(e) => setFormData({ ...formData, kpi_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="project">Dự án</option>
                  <option value="product">Sản phẩm</option>
                  <option value="team">Đội nhóm</option>
                  <option value="personal">Cá nhân</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tháng (YYYY-MM)</label>
                <input
                  type="month"
                  required
                  value={formData.month_key}
                  onChange={(e) => setFormData({ ...formData, month_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trọng số (%)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị đo lường</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cách tính điểm</label>
                <select
                  value={formData.kpi_score_method}
                  onChange={(e) => setFormData({ ...formData, kpi_score_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="aggregate_ratio">Tổng Tỷ lệ (Mặc định)</option>
                  <option value="weighted_item_score">Trung bình trọng số</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả thêm (Tùy chọn)</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Mô tả chi tiết mục tiêu, yêu cầu..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none flex justify-center items-center disabled:opacity-50"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu KPI"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {filteredKpis.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {kpis.length === 0 ? "Chưa có KPI" : "Chưa có KPI phù hợp với bộ lọc hiện tại."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nhân sự</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên KPI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại KPI</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Trọng số</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tháng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cách tính điểm</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredKpis.map((kpi) => {
                  const ownerProfile = (profiles || []).find(p => p.user_id === kpi.owner_id);
                  const ownerName = ownerProfile?.full_name || "Không xác định";
                  
                  const displayType = kpi.kpi_type === "project" ? "Dự án" : 
                                      kpi.kpi_type === "product" ? "Sản phẩm" : 
                                      kpi.kpi_type === "team" ? "Đội nhóm" : 
                                      kpi.kpi_type === "personal" ? "Cá nhân" :
                                      kpi.kpi_type || "-";
                                      
                  const displayMethod = kpi.kpi_score_method === 'aggregate_ratio' ? 'Tổng Tỷ lệ' : 
                                        kpi.kpi_score_method === 'weighted_item_score' ? 'Trung bình trọng số' :
                                        kpi.kpi_score_method || "-";

                  return (
                    <tr key={kpi.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ownerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate" title={kpi.title}>{kpi.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{displayType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{kpi.weight ?? 0}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{kpi.month_key || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{displayMethod}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <button 
                          onClick={() => navigate(`/app/kpis/${kpi.id}`)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
                        >
                          Chi tiết KPI
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
