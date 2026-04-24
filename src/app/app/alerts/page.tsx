"use client";

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";
import { getWorkspaceAlerts, Alert } from "../../../lib/alertEngine";
import { formatError } from "../../../lib/errorUtils";
import { uiText } from "../../../lib/uiText";

const SeverityBadge = ({ severity }: { severity: 'critical' | 'warning' | 'info' }) => {
  if (severity === 'critical') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Nghiêm trọng</span>;
  if (severity === 'warning') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Cảnh báo</span>;
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Thông tin</span>;
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
    <p className="text-base font-medium">{message}</p>
  </div>
);

export default function AlertsPage() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterOwner, setFilterOwner] = useState<string>('ALL');
  const [filterProduct, setFilterProduct] = useState<string>('ALL');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Not authenticated");

        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        const fetchedAlerts = await getWorkspaceAlerts(wsId);
        setAlerts(fetchedAlerts);

      } catch (err: any) {
        console.error("Alerts load error:", err);
        setError(formatError(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (filterType !== 'ALL' && a.type !== filterType) return false;
      if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
      if (filterOwner !== 'ALL' && a.owner_id !== filterOwner) return false;
      if (filterProduct !== 'ALL' && a.product_name !== filterProduct) return false;
      return true;
    });
  }, [alerts, filterType, filterSeverity, filterOwner, filterProduct]);

  const uniqueOwners = useMemo(() => {
    const owners = new Map<string, string>();
    alerts.forEach(a => {
      if (a.owner_id) owners.set(a.owner_id, a.owner_name);
    });
    return Array.from(owners.entries());
  }, [alerts]);

  const uniqueProducts = useMemo(() => {
    const products = new Set<string>();
    alerts.forEach(a => {
      if (a.product_name && a.product_name !== '-') products.add(a.product_name);
    });
    return Array.from(products);
  }, [alerts]);

  const stats = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    };
  }, [alerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Cảnh báo & Rủi ro</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng số</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Nghiêm trọng</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cần xử lý</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Cảnh báo</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Cần chú ý</span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{stats.warning}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Thông tin</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Cập nhật</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.info}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Loại:</label>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">Tất cả</option>
            <option value="KPI_UNDERPERFORMING">KPI chậm tiến độ</option>
            <option value="KPI_NOT_UPDATED">KPI chưa cập nhật</option>
            <option value="TASK_OVERDUE">Nhiệm vụ quá hạn</option>
            <option value="TASK_BLOCKED">Nhiệm vụ bị chặn</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Mức độ:</label>
          <select 
            value={filterSeverity} 
            onChange={e => setFilterSeverity(e.target.value)}
            className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">Tất cả</option>
            <option value="critical">Nghiêm trọng</option>
            <option value="warning">Cảnh báo</option>
            <option value="info">Thông tin</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Người phụ trách:</label>
          <select 
            value={filterOwner} 
            onChange={e => setFilterOwner(e.target.value)}
            className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-indigo-500 focus:border-indigo-500 max-w-[150px]"
          >
            <option value="ALL">Tất cả</option>
            {uniqueOwners.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Sản phẩm:</label>
          <select 
            value={filterProduct} 
            onChange={e => setFilterProduct(e.target.value)}
            className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-indigo-500 focus:border-indigo-500 max-w-[150px]"
          >
            <option value="ALL">Tất cả</option>
            {uniqueProducts.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        {filteredAlerts.length === 0 ? (
          <EmptyState message="Không có cảnh báo nào" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiêu đề / Nội dung</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAlerts.map(alert => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {alert.type === 'KPI_UNDERPERFORMING' ? 'KPI chậm tiến độ' : 
                       alert.type === 'KPI_NOT_UPDATED' ? 'KPI chưa cập nhật' : 
                       alert.type === 'TASK_OVERDUE' ? 'Nhiệm vụ quá hạn' : 
                       alert.type === 'TASK_BLOCKED' ? 'Nhiệm vụ bị chặn' : 
                       alert.type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{alert.title}</div>
                      <div className="text-gray-500">{alert.subtitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alert.owner_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {alert.route && (
                        <button
                          onClick={() => navigate(alert.route)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
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
    </div>
  );
}
