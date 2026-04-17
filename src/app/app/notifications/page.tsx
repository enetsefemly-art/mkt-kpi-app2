"use client";

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";
import { getMyNotifications, AppNotification } from "../../../lib/notificationEngine";
import { formatError } from "../../../lib/errorUtils";

const SeverityBadge = ({ severity }: { severity: 'critical' | 'warning' | 'info' }) => {
  if (severity === 'critical') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Critical</span>;
  if (severity === 'warning') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Warning</span>;
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Info</span>;
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
    <p className="text-base font-medium">{message}</p>
  </div>
);

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Not authenticated");

        const userId = session.user.id;
        setCurrentUserId(userId);

        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        const fetchedNotifications = await getMyNotifications(wsId, userId);
        setNotifications(fetchedNotifications);

      } catch (err: any) {
        console.error("Notifications load error:", err);
        setError(formatError(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (filterType !== 'ALL' && n.type !== filterType) return false;
      if (filterSeverity !== 'ALL' && n.severity !== filterSeverity) return false;
      return true;
    });
  }, [notifications, filterType, filterSeverity]);

  const stats = useMemo(() => {
    return {
      total: notifications.length,
      critical: notifications.filter(n => n.severity === 'critical').length,
      warning: notifications.filter(n => n.severity === 'warning').length,
      info: notifications.filter(n => n.severity === 'info').length,
    };
  }, [notifications]);

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
        <h1 className="text-2xl font-bold text-gray-900">My Reminders</h1>
      </div>

      {/* DEBUG PANEL */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-xs overflow-x-auto border border-gray-700 shadow-sm">
        <div className="font-bold text-white mb-2 border-b border-gray-700 pb-1">DEBUG PANEL</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>Workspace: <span className="text-white">{workspaceId || "..."}</span></div>
          <div>Role: <span className="text-white">{roleCode || "..."}</span></div>
          <div>User ID: <span className="text-white">{currentUserId || "..."}</span></div>
          <div>Reminders Count: <span className="text-white">{notifications.length}</span></div>
          {error && <div className="text-red-400 font-bold col-span-2">Error: {error}</div>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Critical</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Action Required</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Warning</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Needs Attention</span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{stats.warning}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Info</p>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Updates</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.info}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Type:</label>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">All Types</option>
            <option value="TASK_DUE_SOON">Task Due Soon</option>
            <option value="TASK_OVERDUE">Task Overdue</option>
            <option value="TASK_BLOCKED">Task Blocked</option>
            <option value="KPI_NOT_UPDATED">KPI Not Updated</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Severity:</label>
          <select 
            value={filterSeverity} 
            onChange={e => setFilterSeverity(e.target.value)}
            className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Notification List */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        {filteredNotifications.length === 0 ? (
          <EmptyState message="No reminders" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title / Subtitle</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredNotifications.map(notification => (
                  <tr key={notification.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <SeverityBadge severity={notification.severity} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {notification.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{notification.title}</div>
                      <div className="text-gray-500">{notification.subtitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {notification.route && (
                        <button
                          onClick={() => navigate(notification.route)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          Open
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
