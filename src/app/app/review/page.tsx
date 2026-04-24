"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";
import { getReviewData, ReviewData } from "../../../lib/reviewAccess";
import { formatError } from "../../../lib/errorUtils";
import { uiText } from "../../../lib/uiText";

export default function WeeklyReviewPage() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productFilter, setProductFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Not authenticated");
        setCurrentUserId(session.user.id);

        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        const reviewData = await getReviewData(wsId);
        setData(reviewData);

      } catch (err: any) {
        console.error("Review load error:", err);
        setError(formatError(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtering logic
  const filteredKpis = data?.underperformingKpis.filter(k => {
    if (productFilter && k.product_id !== productFilter) return false;
    if (ownerFilter && k.owner_id !== ownerFilter) return false;
    return true;
  }) || [];

  const filteredOverdue = data?.overdueTasks.filter(t => {
    if (productFilter && t.product_id !== productFilter) return false;
    if (ownerFilter && t.owner_id !== ownerFilter) return false;
    return true;
  }) || [];

  const filteredBlocked = data?.blockedTasks.filter(t => {
    if (productFilter && t.product_id !== productFilter) return false;
    if (ownerFilter && t.owner_id !== ownerFilter) return false;
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">Error loading review data</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo Mức độ hoàn thành</h1>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Lọc theo Sản phẩm</label>
          <select
            className="block w-48 border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
          >
            <option value="">Tất cả sản phẩm</option>
            {data?.products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Lọc theo Người phụ trách</label>
          <select
            className="block w-48 border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
          >
            <option value="">Tất cả</option>
            {data?.owners.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase">KPI chậm tiến độ</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{filteredKpis.length}</p>
          </div>
          <div className="p-3 bg-orange-100 rounded-full">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase">Nhiệm vụ quá hạn</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{filteredOverdue.length}</p>
          </div>
          <div className="p-3 bg-red-100 rounded-full">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase">Nhiệm vụ bị chặn</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{filteredBlocked.length}</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
        </div>
      </div>

      {/* Section 1: KPI Underperforming */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">KPI chậm tiến độ</h3>
        </div>
        {filteredKpis.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">Không có KPI nào gặp vấn đề</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">KPI / Hạng mục</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mục tiêu</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thực đạt</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tỷ lệ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredKpis.map(kpi => (
                  <tr key={kpi.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{kpi.owner_name}</div>
                      <div className="text-xs text-gray-500">{kpi.owner_function}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{kpi.kpi_title}</div>
                      <div className="text-sm text-gray-500">{kpi.item_title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {kpi.product_name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {kpi.target !== null ? kpi.target : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {kpi.actual !== null ? kpi.actual : (kpi.manual_progress !== null ? kpi.manual_progress : "-")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                      {(kpi.ratio * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${kpi.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                        {kpi.severity === 'critical' ? 'Nghiêm trọng' : 'Cảnh báo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {(roleCode === 'admin' || roleCode === 'lead' || kpi.owner_id === currentUserId) && (
                        <button
                          onClick={() => navigate(`/app/kpis/${kpi.kpi_id}`)}
                          className="text-indigo-600 hover:text-indigo-900 hover:underline"
                        >
                          {uiText.common.view}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Overdue Tasks */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Nhiệm vụ quá hạn</h3>
        </div>
        {filteredOverdue.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">Không có nhiệm vụ nào quá hạn</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhiệm vụ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dự án</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hạn chót</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Số ngày quá hạn</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOverdue.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {task.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {task.initiative_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.owner_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.product_name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {task.due_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                      {task.days_overdue} ngày
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Blocked Tasks */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Nhiệm vụ bị chặn</h3>
        </div>
        {filteredBlocked.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">Không có nhiệm vụ nào bị chặn</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhiệm vụ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dự án</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hạn chót</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lý do bị chặn</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBlocked.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {task.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {task.initiative_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.owner_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.product_name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.due_date || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 font-medium italic">
                      {task.blocker_reason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
