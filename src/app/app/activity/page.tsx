"use client";

import { useEffect, useState } from "react";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";
import { listActivityLogs, ActivityLog } from "../../../lib/activityAccess";
import { formatError } from "../../../lib/errorUtils";

export default function ActivityPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLastError(null);

        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        if (wsId) {
          const activityLogs = await listActivityLogs(wsId);
          setLogs(activityLogs);
        }
      } catch (err: any) {
        console.error("Failed to load activity logs:", err);
        setLastError(formatError(err, "Failed to load activity logs"));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
      </div>

      {/* DEBUG PANEL */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-xs overflow-x-auto border border-gray-700 shadow-sm">
        <div className="font-bold text-white mb-2 border-b border-gray-700 pb-1">DEBUG PANEL</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>Workspace: <span className="text-white">{workspaceId || "..."}</span></div>
          <div>Role: <span className="text-white">{roleCode || "..."}</span></div>
          <div>Logs Count: <span className="text-white">{logs.length}</span></div>
        </div>
        {lastError && (
          <div className="mt-2 text-red-400 border-t border-gray-700 pt-1 font-bold">
            Last Error: {lastError}
          </div>
        )}
      </div>

      {/* Error Display */}
      {lastError && !logs.length && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">Error loading activity logs</p>
              <p className="text-sm text-red-600 mt-1">{lastError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        {logs.length === 0 && !lastError ? (
          <div className="p-8 text-center text-gray-500 italic">No activity logs yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.actor_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${log.action === 'create' ? 'bg-green-100 text-green-800' : 
                          log.action === 'update' ? 'bg-yellow-100 text-yellow-800' : 
                          log.action === 'delete' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-50 p-2 rounded border border-gray-100">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
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
