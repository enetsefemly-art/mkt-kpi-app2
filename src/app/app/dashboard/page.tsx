"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";
import { getDashboardData, DashboardData } from "../../../lib/dashboardAccess";
import AppLoadingState from "../../../components/app-state/AppLoadingState";
import AppErrorState from "../../../components/app-state/AppErrorState";
import AppEmptyState from "../../../components/app-state/AppEmptyState";
import { formatError } from "../../../lib/errorUtils";
import { uiText } from "../../../lib/uiText";

const SeverityBadge = ({ severity }: { severity: 'critical' | 'warning' | 'healthy' }) => {
  if (severity === 'critical') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{uiText.severity.critical}</span>;
  if (severity === 'warning') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{uiText.severity.warning}</span>;
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{uiText.severity.healthy}</span>;
};

const getProductSeverity = (rate: number) => {
  if (rate >= 50) return 'critical';
  if (rate >= 20) return 'warning';
  return 'healthy';
};

const getPeopleSeverity = (issues: number) => {
  if (issues >= 3) return 'critical';
  if (issues >= 1) return 'warning';
  return 'healthy';
};

const getTaskSeverity = (overdueDays: number) => {
  if (overdueDays > 3) return 'critical';
  if (overdueDays >= 1) return 'warning';
  return 'healthy';
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Not authenticated");

        const userId = session.user.id;

        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        const dashboardData = await getDashboardData(wsId, userId);
        setData(dashboardData);

      } catch (err: any) {
        console.error("Dashboard load error:", err);
        setError(formatError(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <AppLoadingState />;
  }

  if (error && !data) {
    return <AppErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{uiText.navigation.dashboard}</h1>
      </div>

      {/* Section: Latest Digest */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Bản tổng hợp mới nhất</h3>
          <button
            onClick={() => navigate('/app/digests')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
          >
            Xem Bản tổng hợp
          </button>
        </div>
        <div className="p-6">
          {!data?.latestDigest ? (
            <div className="text-center text-gray-500 py-4">Chưa có bản tổng hợp nào</div>
          ) : (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    data.latestDigest.digest_type === 'daily' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  } capitalize`}>
                    {data.latestDigest.digest_type === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(data.latestDigest.created_at).toLocaleString()}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-gray-900">{data.latestDigest.title}</h4>
                <p className="text-gray-600 mt-1">{data.latestDigest.summary}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng số hạng mục KPI</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Thông tin</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{data?.totalKpiItems || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Toàn bộ dự án</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Vấn đề KPI</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Nghiêm trọng</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{data?.kpiIssuesCount || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Hạng mục không đạt chuẩn</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Nhiệm vụ quá hạn</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Cảnh báo</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{data?.overdueTasksCount || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Quá hạn dự kiến</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Nhiệm vụ bị chặn</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Nghiêm trọng</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{data?.blockedTasksCount || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Cần được chú ý</p>
          </div>
        </div>
      </div>

      {/* Section: Active Alerts */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Cảnh báo đang hoạt động</h3>
          <button
            onClick={() => navigate('/app/alerts')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
          >
            Xem tất cả cảnh báo
          </button>
        </div>
        {!data?.alerts || data.alerts.length === 0 ? (
          <AppEmptyState message="Không có cảnh báo nào" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiêu đề / Mô tả</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.alerts.slice(0, 5).map(alert => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {alert.type === 'KPI_UNDERPERFORMING' ? 'KPI chậm tiến độ' : 
                       alert.type === 'KPI_NOT_UPDATED' ? 'KPI chưa cập nhật' : 
                       alert.type === 'TASK_OVERDUE' ? 'Nhiệm vụ quá hạn' : 
                       alert.type === 'TASK_BLOCKED' ? 'Nhiệm vụ bị chặn' : 
                       alert.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{alert.title}</div>
                      <div className="text-gray-500">{alert.subtitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alert.owner_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {alert.route && (
                        <button
                          onClick={() => navigate(alert.route!)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          Mở
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

      {/* Section: My Reminders */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Nhắc việc của tôi</h3>
          <button
            onClick={() => navigate('/app/notifications')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
          >
            Xem tất cả nhắc việc
          </button>
        </div>
        {!data?.notifications || data.notifications.length === 0 ? (
          <AppEmptyState message="Không có nhắc việc nào" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiêu đề / Mô tả</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.notifications.slice(0, 5).map(notification => (
                  <tr key={notification.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <SeverityBadge severity={notification.severity} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {notification.type === 'KPI_UNDERPERFORMING' ? 'KPI chậm tiến độ' : 
                       notification.type === 'KPI_NOT_UPDATED' ? 'KPI chưa cập nhật' : 
                       notification.type === 'TASK_OVERDUE' ? 'Nhiệm vụ quá hạn' : 
                       notification.type === 'TASK_BLOCKED' ? 'Nhiệm vụ bị chặn' : 
                       notification.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{notification.title}</div>
                      <div className="text-gray-500">{notification.subtitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {notification.route && (
                        <button
                          onClick={() => navigate(notification.route!)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          Mở
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section: KPI Risk by Product */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Rủi ro KPI theo Sản phẩm</h3>
          </div>
          {data?.productSummaries.length === 0 ? (
            <AppEmptyState message="Không có rủi ro sản phẩm" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tổng số Hạng mục</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Không đạt</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tỷ lệ rủi ro %</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.productSummaries.map(p => {
                    const sev = getProductSeverity(p.underperforming_rate);
                    return (
                      <tr key={p.product_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.product_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{p.total_items}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{p.underperforming_items}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                          <span className={sev === 'critical' ? 'text-red-600' : sev === 'warning' ? 'text-yellow-600' : 'text-green-600'}>
                            {p.underperforming_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <SeverityBadge severity={sev} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section: Top People with KPI Issues */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Cá nhân có vấn đề KPI</h3>
          </div>
          {data?.peopleSummaries.length === 0 ? (
            <AppEmptyState message="Không có vấn đề nhân sự" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vị trí</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Số lỗi KPI</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tổng số Hạng mục</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mức độ rủi ro</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.peopleSummaries.filter(p => p.total_issue_count > 0).slice(0, 5).map(p => {
                    const sev = getPeopleSeverity(p.total_issue_count);
                    return (
                      <tr key={p.owner_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.owner_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.owner_function}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">{p.total_issue_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{p.total_kpi_items_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <SeverityBadge severity={sev} />
                        </td>
                      </tr>
                    );
                  })}
                  {data?.peopleSummaries.filter(p => p.total_issue_count > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <AppEmptyState message="Không có vấn đề nhân sự" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section: Task Risk Overview */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Tổng quan Rủi ro Dự án</h3>
          </div>
          {data?.taskRiskOverviews.length === 0 ? (
            <AppEmptyState message="Không có rủi ro dự án" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dự án</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quá hạn</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bị chặn</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.taskRiskOverviews.map(t => {
                    const sev = getTaskSeverity(t.max_overdue_days);
                    return (
                      <tr key={t.initiative_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.initiative_title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.product_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">{t.overdue_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600 text-right">{t.blocked_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <SeverityBadge severity={sev} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          {(t.overdue_count > 0 || t.blocked_count > 0) && (
                            <button
                              onClick={() => navigate(`/app/initiatives/${t.initiative_id}`)}
                              className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                            >
                              {uiText.navigation.initiatives}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section: Top 5 KPI Issues */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Top 5 Vấn đề KPI</h3>
          </div>
          {data?.topKpiIssues.length === 0 ? (
            <AppEmptyState message="Không có vấn đề KPI nghiêm trọng" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">KPI / Hạng mục</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tỷ lệ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.topKpiIssues.map(issue => (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{issue.owner_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]">{issue.kpi_title}</div>
                        <div className="truncate max-w-[200px]">{issue.item_title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{issue.product_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                        <span className={issue.severity === 'critical' ? 'text-red-600' : issue.severity === 'warning' ? 'text-yellow-600' : 'text-green-600'}>
                          {(issue.ratio * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <SeverityBadge severity={issue.severity} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => navigate(`/app/kpis/${issue.kpi_id}`)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          {uiText.navigation.kpis}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Section: Quick Links */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Liên kết nhanh</h3>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={() => navigate('/app/kpis')}
              className="flex items-center justify-center p-4 border border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
            >
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">Quản lý KPI</span>
            </button>
            <button 
              onClick={() => navigate('/app/initiatives')}
              className="flex items-center justify-center p-4 border border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
            >
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">Quản lý Dự án</span>
            </button>
            <button 
              onClick={() => navigate('/app/review')}
              className="flex items-center justify-center p-4 border border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
            >
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">Rà soát tuần</span>
            </button>
            <button 
              onClick={() => navigate('/app/activity')}
              className="flex items-center justify-center p-4 border border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
            >
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">Lịch sử thao tác</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
