import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import {
  getMyProfile,
  getCurrentWorkspaceId,
  getWorkspacePasEnabled,
  listDepartments,
  listProfilesInWorkspace,
  Department,
  Profile,
} from '../../../lib/dataAccess';
import { listProblems } from '../../../lib/pas/problemAccess';
import { canCreateProblem } from '../../../lib/permissions';
import { formatError } from '../../../lib/errorUtils';
import type { Problem, ProblemStatus } from '../../../lib/pas/types';
import SeverityBadge from '../../../components/pas/SeverityBadge';
import ProblemStatusBadge from '../../../components/pas/ProblemStatusBadge';

const STATUS_OPTIONS: ProblemStatus[] = ['Open', 'In Progress', 'Pending', 'Resolved'];

export default function ProblemsListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, Profile>>(new Map());
  const [myProfile, setMyProfile] = useState<any>(null);

  const [statusFilter, setStatusFilter] = useState<ProblemStatus | ''>('');
  const [deptFilter, setDeptFilter] = useState<string>('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, deptFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/login'); return; }

      const profile = await getMyProfile();
      setMyProfile(profile);

      const workspaceId = await getCurrentWorkspaceId(profile);
      const pasOn = await getWorkspacePasEnabled(workspaceId);
      if (!pasOn) { navigate('/app/dashboard'); return; }

      const [depts, profiles, probs] = await Promise.all([
        listDepartments(),
        listProfilesInWorkspace(workspaceId || ''),
        listProblems(workspaceId || '', {
          status: statusFilter || undefined,
          departmentId: deptFilter || undefined,
        }),
      ]);

      setDepartments(depts);
      setProfilesMap(new Map(profiles.map((p) => [p.user_id, p])));
      setProblems(probs);
    } catch (err: any) {
      setError(formatError(err, 'Lỗi tải danh sách vấn đề'));
    } finally {
      setLoading(false);
    }
  };

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name || '—';
  const ownerName = (id: string) => profilesMap.get(id)?.full_name || '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Vấn đề (PAS)</h1>
          <p className="text-sm text-gray-500 mt-1">Vấn đề → Nguyên nhân → Hành động → Kết quả</p>
        </div>
        {canCreateProblem(myProfile?.role) && (
          <button
            onClick={() => navigate('/app/problems/new')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
          >
            + Tạo Vấn đề
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProblemStatus | '')}
            className="border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Tất cả</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phòng ban</label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Tất cả</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vấn đề</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mức độ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phụ trách</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phòng ban</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {problems.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/app/problems/${p.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.problem_title}</td>
                  <td className="px-6 py-4"><ProblemStatusBadge status={p.status} /></td>
                  <td className="px-6 py-4"><SeverityBadge severity={p.severity} /></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ownerName(p.problem_owner_id)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{deptName(p.department_id)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
              {problems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    Chưa có vấn đề nào. Bấm "Tạo Vấn đề" để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
