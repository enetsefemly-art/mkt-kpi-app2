"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";
import { listDigests, saveDigest, Digest } from "../../../lib/digestEngine";
import { formatError } from "../../../lib/errorUtils";
import { deleteEntity } from "../../../lib/deleteActions";

const EmptyState = ({ message }: { message: string }) => (
  <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
    <p className="text-base font-medium">{message}</p>
  </div>
);

export default function DigestsPage() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);

  const [digests, setDigests] = useState<any[]>([]);
  const [latestDigest, setLatestDigest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastCreatedDigestId, setLastCreatedDigestId] = useState<string | null>(null);
  
  const [pendingDigestType, setPendingDigestType] = useState<"daily" | "weekly" | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDigests = async (wsId: string) => {
    try {
      const fetchedDigests = await listDigests(wsId);
      setDigests(fetchedDigests);
      if (fetchedDigests.length > 0) {
        setLatestDigest(fetchedDigests[0]);
      } else {
        setLatestDigest(null);
      }
    } catch (err) {
      console.error("loadDigests helper error", err);
      throw err;
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setLastError(null);

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Not authenticated");

        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        await loadDigests(wsId);

      } catch (err: any) {
        console.error("Digests load error:", err);
        setError(formatError(err));
        setLastError(formatError(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleGenerateDailyDigest = () => {
    console.log("clicked daily");
    setPendingDigestType("daily");
  };

  const handleGenerateWeeklyDigest = () => {
    console.log("clicked weekly");
    setPendingDigestType("weekly");
  };

  const handleConfirmGenerate = async () => {
    console.log("confirm generate clicked");
    if (!workspaceId || !pendingDigestType) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setLastError(null);
      setLastAction(`generate_${pendingDigestType}`);

      const created = await saveDigest(workspaceId, pendingDigestType);

      console.log("digest created", created);

      setLastCreatedDigestId(created.id);

      // update state ngay lập tức
      setDigests(prev => [created, ...prev]);
      setLatestDigest(created);
      setPendingDigestType(null);

    } catch (err: any) {
      console.error(err);
      setError(formatError(err));
      setLastError(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelGenerate = () => {
    setPendingDigestType(null);
  };

  const handleDeleteDigest = async (digestId: string) => {
    if (!workspaceId) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa bản tổng hợp này?")) return;

    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError(null);
      setLastError(null);
      await deleteEntity('digests', digestId, workspaceId, "Digest");
      
      setDigests(prev => prev.filter(d => d.id !== digestId));
      if (latestDigest?.id === digestId) {
        setLatestDigest(null); // Just set to null for simplicity if it was the latest, it will reload anyway if we reload, but here we just update state
      }

    } catch (err: any) {
      console.error(err);
      setError(formatError(err, "Xóa bản tổng hợp thất bại"));
      setLastError(formatError(err, "Xóa bản tổng hợp thất bại"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const stats = useMemo(() => {
    const total = digests.length;
    return {
      total,
      latestType: latestDigest?.digest_type || '-',
      latestDate: latestDigest?.created_at ? new Date(latestDigest.created_at).toLocaleString() : '-'
    };
  }, [digests, latestDigest]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const canGenerate = roleCode === 'admin' || roleCode === 'lead';

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Digests</h1>
        {canGenerate && (
          <div className="flex flex-col items-end space-y-1">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleGenerateDailyDigest}
                disabled={isSubmitting || pendingDigestType !== null}
                className="inline-flex justify-center items-center px-4 py-2 border border-indigo-200 text-sm font-medium rounded-md shadow-sm text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Daily Digest
              </button>
              <button
                type="button"
                onClick={handleGenerateWeeklyDigest}
                disabled={isSubmitting || pendingDigestType !== null}
                className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Weekly Digest
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingDigestType && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Confirm Generation
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Are you sure you want to generate a new {pendingDigestType} digest?
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleCancelGenerate}
                disabled={isSubmitting}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerate}
                disabled={isSubmitting}
                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? "Generating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Lỗi tạo bản tổng hợp</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng số lượng</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Loại Mới Nhất</p>
          </div>
          <p className="text-xl font-bold text-gray-900 capitalize">{stats.latestType === 'daily' ? 'Hàng ngày' : stats.latestType === 'weekly' ? 'Hàng tuần' : stats.latestType}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tạo lúc</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.latestDate}</p>
        </div>
      </div>

      {/* Digest List */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        {digests.length === 0 ? (
          <EmptyState message="Chưa có bản tổng hợp nào" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tạo lúc</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiêu đề</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tóm tắt</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {digests.map(digest => (
                  <React.Fragment key={digest.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(digest.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {digest.digest_type === 'daily' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Hàng ngày</span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Hàng tuần</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {digest.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {digest.summary}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => toggleExpand(digest.id)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                          >
                            {expandedId === digest.id ? 'Thu gọn' : 'Chi tiết'}
                          </button>
                          {roleCode === 'admin' && (
                            <button
                              onClick={() => handleDeleteDigest(digest.id)}
                              disabled={isSubmitting}
                              className="text-red-500 hover:text-red-700 font-medium text-xs bg-red-50 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === digest.id && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                          <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-900 mb-2">Dữ liệu chi tiết</h4>
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto bg-gray-100 p-3 rounded-md">
                              {JSON.stringify(digest.payload, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
