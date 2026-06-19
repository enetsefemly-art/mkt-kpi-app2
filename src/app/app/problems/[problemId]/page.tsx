import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabaseClient';
import {
  getMyProfile,
  getCurrentWorkspaceId,
  getWorkspacePasEnabled,
  listProfilesInWorkspace,
  Profile,
} from '../../../../lib/dataAccess';
import { getProblem, updateProblem } from '../../../../lib/pas/problemAccess';
import { listRootCauses, createRootCause, setPrimaryRootCause } from '../../../../lib/pas/rootCauseAccess';
import { listActions, createAction, updateActionStatus, cancelAction } from '../../../../lib/pas/actionAccess';
import { listRootCauseTypes } from '../../../../lib/pas/taxonomyAccess';
import { canResolveProblem } from '../../../../lib/permissions';
import { formatError } from '../../../../lib/errorUtils';
import type { Problem, RootCause, Action, RootCauseType, ActionStatus } from '../../../../lib/pas/types';
import SeverityBadge from '../../../../components/pas/SeverityBadge';
import ProblemStatusBadge from '../../../../components/pas/ProblemStatusBadge';

type Tab = 'overview' | 'root_causes' | 'actions' | 'activity';
const ACTION_STATUSES: ActionStatus[] = ['Pending', 'Todo', 'Doing', 'Done', 'Cancelled'];

export default function ProblemDetailPage() {
  const { problemId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const [problem, setProblem] = useState<Problem | null>(null);
  const [rootCauses, setRootCauses] = useState<RootCause[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [rcTypes, setRcTypes] = useState<RootCauseType[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, Profile>>(new Map());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');

  // add-forms
  const [newRc, setNewRc] = useState({ root_cause_note: '', root_cause_type_id: '', is_primary: false });
  const [newAction, setNewAction] = useState({ action_title: '', action_owner_id: '', deadline: '', root_cause_id: '', action_description: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (problemId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/login'); return; }

      const profile = await getMyProfile();
      setMyProfile(profile);
      const wsId = await getCurrentWorkspaceId(profile);
      const pasOn = await getWorkspacePasEnabled(wsId);
      if (!pasOn) { navigate('/app/dashboard'); return; }
      setWorkspaceId(wsId || '');

      const prob = await getProblem(problemId!);
      if (!prob) { setError('Không tìm thấy vấn đề'); setLoading(false); return; }
      setProblem(prob);

      const [rcs, acts, types, profs, logs] = await Promise.all([
        listRootCauses(prob.id),
        listActions(prob.id),
        listRootCauseTypes(wsId || ''),
        listProfilesInWorkspace(wsId || ''),
        supabase.from('activity_logs').select('*').eq('entity_id', prob.id).order('created_at', { ascending: false }),
      ]);
      setRootCauses(rcs);
      setActions(acts);
      setRcTypes(types);
      setProfiles(profs);
      setProfilesMap(new Map(profs.map((p) => [p.user_id, p])));
      setActivity(logs.data || []);
    } catch (err: any) {
      setError(formatError(err, 'Lỗi tải chi tiết vấn đề'));
    } finally {
      setLoading(false);
    }
  };

  const ownerName = (id?: string | null) => (id ? profilesMap.get(id)?.full_name || '—' : '—');

  const handleResolve = async () => {
    if (!problem) return;
    if (!window.confirm('Đánh dấu vấn đề này là Đã đóng?')) return;
    try {
      setBusy(true);
      await updateProblem(problem.id, workspaceId, {
        status: 'Resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: myProfile?.user_id,
      });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi đóng vấn đề')); }
    finally { setBusy(false); }
  };

  const handleAddRc = async () => {
    if (!problem || busy) return;
    if (!newRc.root_cause_note.trim()) { setError('Nhập nội dung nguyên nhân'); return; }
    try {
      setBusy(true);
      await createRootCause({
        workspace_id: workspaceId,
        problem_id: problem.id,
        root_cause_note: newRc.root_cause_note.trim(),
        root_cause_type_id: newRc.root_cause_type_id || null,
        is_primary: newRc.is_primary,
      });
      setNewRc({ root_cause_note: '', root_cause_type_id: '', is_primary: false });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi thêm nguyên nhân')); }
    finally { setBusy(false); }
  };

  const handleSetPrimary = async (rcId: string) => {
    if (!problem || busy) return;
    try { setBusy(true); await setPrimaryRootCause(problem.id, rcId, workspaceId); await loadAll(); }
    catch (err: any) { setError(formatError(err, 'Lỗi đặt nguyên nhân chính')); }
    finally { setBusy(false); }
  };

  const handleAddAction = async () => {
    if (!problem || busy) return;
    if (!newAction.action_title.trim()) { setError('Nhập tên hành động'); return; }
    if (!newAction.action_owner_id) { setError('Chọn người phụ trách hành động'); return; }
    if (!newAction.deadline) { setError('Chọn hạn chót'); return; }
    try {
      setBusy(true);
      await createAction({
        workspace_id: workspaceId,
        problem_id: problem.id,
        action_title: newAction.action_title.trim(),
        action_owner_id: newAction.action_owner_id,
        deadline: newAction.deadline,
        root_cause_id: newAction.root_cause_id || null,
        action_description: newAction.action_description || null,
      });
      setNewAction({ action_title: '', action_owner_id: '', deadline: '', root_cause_id: '', action_description: '' });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi thêm hành động')); }
    finally { setBusy(false); }
  };

  const handleActionStatus = async (a: Action, status: ActionStatus) => {
    if (busy) return;
    try {
      setBusy(true);
      if (status === 'Cancelled') {
        const reason = window.prompt('Lý do hủy hành động:');
        if (!reason || !reason.trim()) { setBusy(false); return; }
        await cancelAction(a.id, workspaceId, reason.trim());
      } else {
        await updateActionStatus(a.id, workspaceId, status);
      }
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi cập nhật hành động')); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }
  if (!problem) {
    return <div className="p-8 text-center text-gray-500">{error || 'Không tìm thấy vấn đề.'}</div>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'root_causes', label: `Nguyên nhân (${rootCauses.length})` },
    { key: 'actions', label: `Hành động (${actions.length})` },
    { key: 'activity', label: 'Hoạt động' },
  ];

  return (
    <div className="space-y-6 pb-10">
      <button onClick={() => navigate('/app/problems')} className="text-indigo-600 hover:underline text-sm">← Quay lại danh sách</button>

      {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>}

      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{problem.problem_title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <ProblemStatusBadge status={problem.status} />
              <SeverityBadge severity={problem.severity} />
              <span className="text-sm text-gray-500">Phụ trách: {ownerName(problem.problem_owner_id)}</span>
            </div>
          </div>
          {canResolveProblem(myProfile?.role) && problem.status !== 'Resolved' && (
            <button onClick={handleResolve} disabled={busy} className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50">
              Đánh dấu Đã đóng
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-3 text-sm">
          <div><span className="font-medium text-gray-700">Mô tả:</span> <span className="text-gray-900 whitespace-pre-wrap">{problem.problem_description}</span></div>
          <div><span className="font-medium text-gray-700">Ngày tạo:</span> {new Date(problem.created_at).toLocaleString('vi-VN')}</div>
          {problem.expected_resolve_date && <div><span className="font-medium text-gray-700">Dự kiến xử lý xong:</span> {problem.expected_resolve_date}</div>}
          {problem.resolved_at && <div><span className="font-medium text-gray-700">Đã đóng lúc:</span> {new Date(problem.resolved_at).toLocaleString('vi-VN')}</div>}
        </div>
      )}

      {/* Root Causes */}
      {tab === 'root_causes' && (
        <div className="space-y-4">
          {rootCauses.map((rc) => (
            <div key={rc.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {rc.is_primary && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">Chính</span>}
                  <span className="text-xs text-gray-500">{rc.validation_status}</span>
                </div>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{rc.root_cause_note}</p>
              </div>
              {!rc.is_primary && (
                <button onClick={() => handleSetPrimary(rc.id)} disabled={busy} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Đặt làm chính</button>
              )}
            </div>
          ))}
          {rootCauses.length === 0 && <p className="text-sm text-gray-500">Chưa có nguyên nhân.</p>}

          <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Thêm nguyên nhân</h3>
            <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={newRc.root_cause_type_id} onChange={(e) => setNewRc({ ...newRc, root_cause_type_id: e.target.value })}>
              <option value="">— Loại nguyên nhân (tùy chọn) —</option>
              {rcTypes.map((t) => <option key={t.id} value={t.id}>{t.type_name}</option>)}
            </select>
            <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={2} placeholder="Nội dung / bằng chứng (bắt buộc)" value={newRc.root_cause_note} onChange={(e) => setNewRc({ ...newRc, root_cause_note: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={newRc.is_primary} onChange={(e) => setNewRc({ ...newRc, is_primary: e.target.checked })} /> Đặt làm nguyên nhân chính
            </label>
            <button onClick={handleAddRc} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Thêm nguyên nhân</button>
          </div>
        </div>
      )}

      {/* Actions */}
      {tab === 'actions' && (
        <div className="space-y-4">
          {actions.map((a) => (
            <div key={a.id} className="bg-white p-4 rounded-xl border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.action_title}</p>
                  <p className="text-xs text-gray-500 mt-1">Phụ trách: {ownerName(a.action_owner_id)} · Hạn: {a.deadline}{!a.root_cause_id && <span className="text-red-600 font-medium"> · ⚠ chưa gắn nguyên nhân</span>}</p>
                  {a.cancel_reason && <p className="text-xs text-red-600 mt-1">Lý do hủy: {a.cancel_reason}</p>}
                </div>
                <select value={a.status} onChange={(e) => handleActionStatus(a, e.target.value as ActionStatus)} disabled={busy} className="border border-gray-300 rounded-md p-1 text-xs">
                  {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
          {actions.length === 0 && <p className="text-sm text-gray-500">Chưa có hành động.</p>}

          <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Thêm hành động</h3>
            <input className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="Tên hành động" value={newAction.action_title} onChange={(e) => setNewAction({ ...newAction, action_title: e.target.value })} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border border-gray-300 rounded-md p-2 text-sm" value={newAction.action_owner_id} onChange={(e) => setNewAction({ ...newAction, action_owner_id: e.target.value })}>
                <option value="">— Người phụ trách —</option>
                {profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
              </select>
              <input type="date" className="border border-gray-300 rounded-md p-2 text-sm" value={newAction.deadline} onChange={(e) => setNewAction({ ...newAction, deadline: e.target.value })} />
              <select className="border border-gray-300 rounded-md p-2 text-sm md:col-span-2" value={newAction.root_cause_id} onChange={(e) => setNewAction({ ...newAction, root_cause_id: e.target.value })}>
                <option value="">— Gắn nguyên nhân (khuyến nghị) —</option>
                {rootCauses.map((rc) => <option key={rc.id} value={rc.id}>{rc.root_cause_note.slice(0, 50)}</option>)}
              </select>
            </div>
            <button onClick={handleAddAction} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Thêm hành động</button>
          </div>
        </div>
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có hoạt động.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((log) => (
                <li key={log.id} className="text-sm text-gray-700 border-b border-gray-100 pb-2">
                  <span className="font-medium">{log.action}</span> — {new Date(log.created_at).toLocaleString('vi-VN')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
