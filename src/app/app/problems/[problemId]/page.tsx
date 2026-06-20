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
import { listRootCauses, createRootCause, setPrimaryRootCause, updateRootCause } from '../../../../lib/pas/rootCauseAccess';
import { listActions, createAction, updateActionStatus, cancelAction, updateAction, changeDeadline } from '../../../../lib/pas/actionAccess';
import { listRootCauseTypes } from '../../../../lib/pas/taxonomyAccess';
import { findSimilarProblems } from '../../../../lib/pas/repeatedDetector';
import { getResult, upsertResult } from '../../../../lib/pas/resultAccess';
import { getEvaluation, createEvaluation } from '../../../../lib/pas/evaluationAccess';
import { canResolveProblem, canEditProblem, canEditAction, canEvaluateAction, canCreatePattern } from '../../../../lib/permissions';
import { formatError } from '../../../../lib/errorUtils';
import type { Problem, RootCause, Action, RootCauseType, ActionStatus, Severity, ActionResult, ActionEvaluation } from '../../../../lib/pas/types';
import SeverityBadge from '../../../../components/pas/SeverityBadge';
import ProblemStatusBadge from '../../../../components/pas/ProblemStatusBadge';

type Tab = 'overview' | 'root_causes' | 'actions';
const ACTION_STATUSES: ActionStatus[] = ['Pending', 'Todo', 'Doing', 'Done', 'Cancelled'];
const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export default function ProblemDetailPage() {
  const { problemId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const [problem, setProblem] = useState<Problem | null>(null);
  const [rootCauses, setRootCauses] = useState<RootCause[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [rcTypes, setRcTypes] = useState<RootCauseType[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, Profile>>(new Map());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');

  // edit problem
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ problem_title: '', problem_description: '', severity: 'Medium' as Severity, expected_resolve_date: '' });

  // add forms
  const [newRc, setNewRc] = useState({ root_cause_note: '', root_cause_type_id: '', is_primary: false, validated: false, evidence: '' });
  const [newAction, setNewAction] = useState({ action_title: '', action_owner_id: '', deadline: '', root_cause_id: '', action_description: '' });
  const [busy, setBusy] = useState(false);

  // edit existing root cause / action
  const [rcEditId, setRcEditId] = useState<string | null>(null);
  const [rcEditDraft, setRcEditDraft] = useState({ root_cause_note: '', root_cause_type_id: '', validated: false, evidence: '' });
  const [actEditId, setActEditId] = useState<string | null>(null);
  const [actEditDraft, setActEditDraft] = useState({ action_title: '', action_owner_id: '', deadline: '', root_cause_id: '', action_description: '' });

  // result / evaluation
  const [resultsMap, setResultsMap] = useState<Map<string, ActionResult>>(new Map());
  const [evalsMap, setEvalsMap] = useState<Map<string, ActionEvaluation>>(new Map());
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [resultDraft, setResultDraft] = useState({ result_note: '', primary_result_metric_name: '', before_value: '', after_value: '', unit: '' });
  const [similar, setSimilar] = useState<Problem[]>([]);

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
      setEditForm({
        problem_title: prob.problem_title,
        problem_description: prob.problem_description,
        severity: prob.severity,
        expected_resolve_date: prob.expected_resolve_date || '',
      });

      const [rcs, acts, types, profs] = await Promise.all([
        listRootCauses(prob.id),
        listActions(prob.id),
        listRootCauseTypes(wsId || ''),
        listProfilesInWorkspace(wsId || ''),
      ]);
      setRootCauses(rcs);
      setActions(acts);
      setRcTypes(types);
      setProfiles(profs);
      setProfilesMap(new Map(profs.map((p) => [p.user_id, p])));

      // Nạp kết quả + đánh giá cho từng hành động (volume nhỏ)
      const rMap = new Map<string, ActionResult>();
      const eMap = new Map<string, ActionEvaluation>();
      await Promise.all(acts.map(async (a) => {
        const [r, ev] = await Promise.all([getResult(a.id), getEvaluation(a.id)]);
        if (r) rMap.set(a.id, r);
        if (ev) eMap.set(a.id, ev);
      }));
      setResultsMap(rMap);
      setEvalsMap(eMap);

      // Gợi ý vấn đề lặp lại (cùng loại + phòng, trong 4 tuần)
      try { setSimilar(await findSimilarProblems(prob)); } catch { /* không chặn */ }
    } catch (err: any) {
      setError(formatError(err, 'Lỗi tải chi tiết vấn đề'));
    } finally {
      setLoading(false);
    }
  };

  const ownerName = (id?: string | null) => (id ? profilesMap.get(id)?.full_name || '—' : '—');
  const editable = problem ? canEditProblem(myProfile, problem) : false;

  const handleSaveEdit = async () => {
    if (!problem || busy) return;
    if (!editForm.problem_title.trim() || !editForm.problem_description.trim()) { setError('Tiêu đề và mô tả không được để trống'); return; }
    try {
      setBusy(true);
      await updateProblem(problem.id, workspaceId, {
        problem_title: editForm.problem_title.trim(),
        problem_description: editForm.problem_description.trim(),
        severity: editForm.severity,
        expected_resolve_date: editForm.expected_resolve_date || null,
      });
      setEditing(false);
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi lưu vấn đề')); }
    finally { setBusy(false); }
  };

  const handleResolve = async () => {
    if (!problem) return;
    if (!window.confirm('Đánh dấu vấn đề này là Đã đóng?')) return;
    try {
      setBusy(true);
      await updateProblem(problem.id, workspaceId, { status: 'Resolved', resolved_at: new Date().toISOString(), resolved_by: myProfile?.user_id });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi đóng vấn đề')); }
    finally { setBusy(false); }
  };

  const markRepeated = async () => {
    if (!problem || busy || similar.length === 0) return;
    try {
      setBusy(true);
      await updateProblem(problem.id, workspaceId, { is_repeated: true, linked_previous_problem_id: similar[0].id });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi đánh dấu lặp lại')); }
    finally { setBusy(false); }
  };

  const handleAddRc = async () => {
    if (!problem || busy) return;
    if (!newRc.root_cause_note.trim()) { setError('Nhập nội dung nguyên nhân'); return; }
    if (newRc.validated && !newRc.evidence.trim()) { setError('Nguyên nhân "Đã verify" cần có dẫn chứng'); return; }
    try {
      setBusy(true);
      await createRootCause({
        workspace_id: workspaceId,
        problem_id: problem.id,
        root_cause_note: newRc.root_cause_note.trim(),
        root_cause_type_id: newRc.root_cause_type_id || null,
        is_primary: newRc.is_primary,
        validated: newRc.validated,
        evidence: newRc.evidence.trim() || null,
      });
      setNewRc({ root_cause_note: '', root_cause_type_id: '', is_primary: false, validated: false, evidence: '' });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi thêm nguyên nhân')); }
    finally { setBusy(false); }
  };

  const startEditRc = (rc: RootCause) => {
    setRcEditId(rc.id);
    setRcEditDraft({
      root_cause_note: rc.root_cause_note,
      root_cause_type_id: rc.root_cause_type_id || '',
      validated: rc.validation_status === 'Validated',
      evidence: rc.evidence || '',
    });
  };

  const saveEditRc = async () => {
    if (!rcEditId || busy) return;
    if (!rcEditDraft.root_cause_note.trim()) { setError('Nhập nội dung nguyên nhân'); return; }
    if (rcEditDraft.validated && !rcEditDraft.evidence.trim()) { setError('Nguyên nhân "Đã verify" cần có dẫn chứng'); return; }
    try {
      setBusy(true);
      await updateRootCause(rcEditId, workspaceId, {
        root_cause_note: rcEditDraft.root_cause_note.trim(),
        root_cause_type_id: rcEditDraft.root_cause_type_id || null,
        validation_status: rcEditDraft.validated ? 'Validated' : 'Not Validated',
        evidence: rcEditDraft.validated ? (rcEditDraft.evidence.trim() || null) : null,
      });
      setRcEditId(null);
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi sửa nguyên nhân')); }
    finally { setBusy(false); }
  };

  const startEditAction = (a: Action) => {
    setActEditId(a.id);
    setActEditDraft({
      action_title: a.action_title,
      action_owner_id: a.action_owner_id,
      deadline: a.deadline,
      root_cause_id: a.root_cause_id || '',
      action_description: a.action_description || '',
    });
  };

  const saveEditAction = async () => {
    if (!actEditId || busy) return;
    if (!actEditDraft.action_title.trim()) { setError('Nhập tên hành động'); return; }
    if (!actEditDraft.root_cause_id) { setError('Bắt buộc gắn 1 nguyên nhân cho hành động'); return; }
    if (!actEditDraft.deadline) { setError('Chọn hạn chót'); return; }
    try {
      setBusy(true);
      const orig = actions.find((x) => x.id === actEditId);
      await updateAction(actEditId, workspaceId, {
        action_title: actEditDraft.action_title.trim(),
        action_owner_id: actEditDraft.action_owner_id,
        root_cause_id: actEditDraft.root_cause_id,
        action_description: actEditDraft.action_description || null,
      });
      if (orig && actEditDraft.deadline !== orig.deadline) {
        await changeDeadline(actEditId, workspaceId, actEditDraft.deadline, orig.deadline_changed_count);
      }
      setActEditId(null);
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi sửa hành động')); }
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
    if (!newAction.root_cause_id) { setError('Bắt buộc gắn 1 nguyên nhân cho hành động'); return; }
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
        root_cause_id: newAction.root_cause_id,
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

  const openResult = (a: Action) => {
    const r = resultsMap.get(a.id);
    setExpandedActionId(expandedActionId === a.id ? null : a.id);
    setResultDraft({
      result_note: r?.result_note || '',
      primary_result_metric_name: r?.primary_result_metric_name || '',
      before_value: r?.before_value != null ? String(r.before_value) : '',
      after_value: r?.after_value != null ? String(r.after_value) : '',
      unit: r?.unit || '',
    });
  };

  const saveResult = async (a: Action) => {
    if (busy) return;
    if (!resultDraft.result_note.trim()) { setError('Nhập ghi chú kết quả'); return; }
    try {
      setBusy(true);
      await upsertResult({
        workspace_id: workspaceId,
        action_id: a.id,
        result_note: resultDraft.result_note.trim(),
        primary_result_metric_name: resultDraft.primary_result_metric_name || null,
        before_value: resultDraft.before_value ? Number(resultDraft.before_value) : null,
        after_value: resultDraft.after_value ? Number(resultDraft.after_value) : null,
        unit: resultDraft.unit || null,
      });
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi lưu kết quả')); }
    finally { setBusy(false); }
  };

  const submitEvaluation = async (a: Action, evaluation: 'Pass' | 'Not Pass') => {
    if (busy) return;
    if (!window.confirm(`Xác nhận đánh giá "${evaluation}"? Kết quả sẽ bị khóa sau khi đánh giá.`)) return;
    try {
      setBusy(true);
      await createEvaluation(a.id, workspaceId, evaluation);
      await loadAll();
    } catch (err: any) { setError(formatError(err, 'Lỗi đánh giá')); }
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
          <div className="flex gap-2">
            {editable && !editing && (
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100 text-sm">Chỉnh sửa</button>
            )}
            {canResolveProblem(myProfile?.role) && problem.status !== 'Resolved' && (
              <button onClick={handleResolve} disabled={busy} className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50">Đánh dấu Đã đóng</button>
            )}
          </div>
        </div>
      </div>

      {!problem.is_repeated && similar.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 flex items-center justify-between gap-3">
          <span>Có thể đây là vấn đề lặp lại — tìm thấy {similar.length} vấn đề tương tự (cùng loại + phòng ban) trong 4 tuần gần đây.</span>
          {canResolveProblem(myProfile?.role) && <button onClick={markRepeated} disabled={busy} className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-xs disabled:opacity-50 shrink-0">Đánh dấu lặp lại</button>}
        </div>
      )}
      {problem.is_repeated && (
        <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm text-gray-600">Đã đánh dấu là vấn đề lặp lại.</div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        editing ? (
          <div className="bg-white p-6 rounded-xl border border-indigo-200 space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Chỉnh sửa vấn đề</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
              <input className="w-full border border-gray-300 rounded-md p-2" value={editForm.problem_title} onChange={(e) => setEditForm({ ...editForm, problem_title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả *</label>
              <textarea rows={4} className="w-full border border-gray-300 rounded-md p-2" value={editForm.problem_description} onChange={(e) => setEditForm({ ...editForm, problem_description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
                <select className="w-full border border-gray-300 rounded-md p-2" value={editForm.severity} onChange={(e) => setEditForm({ ...editForm, severity: e.target.value as Severity })}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày dự kiến xử lý xong</label>
                <input type="date" className="w-full border border-gray-300 rounded-md p-2" value={editForm.expected_resolve_date} onChange={(e) => setEditForm({ ...editForm, expected_resolve_date: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={handleSaveEdit} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">Lưu</button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-3 text-sm">
            <div><span className="font-medium text-gray-700">Mô tả:</span> <span className="text-gray-900 whitespace-pre-wrap">{problem.problem_description}</span></div>
            <div><span className="font-medium text-gray-700">Ngày tạo:</span> {new Date(problem.created_at).toLocaleString('vi-VN')}</div>
            {problem.expected_resolve_date && <div><span className="font-medium text-gray-700">Dự kiến xử lý xong:</span> {problem.expected_resolve_date}</div>}
            {problem.resolved_at && <div><span className="font-medium text-gray-700">Đã đóng lúc:</span> {new Date(problem.resolved_at).toLocaleString('vi-VN')}</div>}
          </div>
        )
      )}

      {/* Root Causes */}
      {tab === 'root_causes' && (
        <div className="space-y-4">
          {rootCauses.map((rc) => (
            <div key={rc.id} className="bg-white p-4 rounded-xl border border-gray-200">
              {rcEditId === rc.id ? (
                <div className="space-y-3">
                  <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={rcEditDraft.root_cause_type_id} onChange={(e) => setRcEditDraft({ ...rcEditDraft, root_cause_type_id: e.target.value })}>
                    <option value="">— Loại nguyên nhân (tùy chọn) —</option>
                    {rcTypes.map((t) => <option key={t.id} value={t.id}>{t.type_name}</option>)}
                  </select>
                  <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={2} value={rcEditDraft.root_cause_note} onChange={(e) => setRcEditDraft({ ...rcEditDraft, root_cause_note: e.target.value })} />
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 text-gray-700"><input type="radio" checked={!rcEditDraft.validated} onChange={() => setRcEditDraft({ ...rcEditDraft, validated: false })} /> Giả định</label>
                    <label className="flex items-center gap-2 text-gray-700"><input type="radio" checked={rcEditDraft.validated} onChange={() => setRcEditDraft({ ...rcEditDraft, validated: true })} /> Đã verify</label>
                  </div>
                  {rcEditDraft.validated && <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={2} placeholder="Dẫn chứng (bắt buộc)" value={rcEditDraft.evidence} onChange={(e) => setRcEditDraft({ ...rcEditDraft, evidence: e.target.value })} />}
                  <div className="flex gap-2">
                    <button onClick={saveEditRc} disabled={busy} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50">Lưu</button>
                    <button onClick={() => setRcEditId(null)} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm">Hủy</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {rc.is_primary && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">Chính</span>}
                      {rc.validation_status === 'Validated'
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Đã verify</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">Giả định</span>}
                    </div>
                    <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{rc.root_cause_note}</p>
                    {rc.evidence && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Dẫn chứng:</span> {rc.evidence}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {editable && <button onClick={() => startEditRc(rc)} className="text-xs text-indigo-600 hover:underline">Sửa</button>}
                    {!rc.is_primary && <button onClick={() => handleSetPrimary(rc.id)} disabled={busy} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Đặt làm chính</button>}
                  </div>
                </div>
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
            <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={2} placeholder="Nội dung nguyên nhân (bắt buộc)" value={newRc.root_cause_note} onChange={(e) => setNewRc({ ...newRc, root_cause_note: e.target.value })} />
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2 text-gray-700">
                <input type="radio" checked={!newRc.validated} onChange={() => setNewRc({ ...newRc, validated: false })} /> Giả định
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="radio" checked={newRc.validated} onChange={() => setNewRc({ ...newRc, validated: true })} /> Đã verify (có dẫn chứng)
              </label>
            </div>
            {newRc.validated && (
              <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={2} placeholder="Dẫn chứng (bắt buộc khi Đã verify)" value={newRc.evidence} onChange={(e) => setNewRc({ ...newRc, evidence: e.target.value })} />
            )}
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
              {actEditId === a.id ? (
                <div className="space-y-3">
                  <input className="w-full border border-gray-300 rounded-md p-2 text-sm" value={actEditDraft.action_title} onChange={(e) => setActEditDraft({ ...actEditDraft, action_title: e.target.value })} />
                  <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={actEditDraft.root_cause_id} onChange={(e) => setActEditDraft({ ...actEditDraft, root_cause_id: e.target.value })}>
                    <option value="">— Gắn nguyên nhân (BẮT BUỘC) —</option>
                    {rootCauses.map((rc) => <option key={rc.id} value={rc.id}>{rc.root_cause_note.slice(0, 50)}</option>)}
                  </select>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="border border-gray-300 rounded-md p-2 text-sm" value={actEditDraft.action_owner_id} onChange={(e) => setActEditDraft({ ...actEditDraft, action_owner_id: e.target.value })}>
                      <option value="">— Người phụ trách —</option>
                      {profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                    </select>
                    <input type="date" className="border border-gray-300 rounded-md p-2 text-sm" value={actEditDraft.deadline} onChange={(e) => setActEditDraft({ ...actEditDraft, deadline: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditAction} disabled={busy} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50">Lưu</button>
                    <button onClick={() => setActEditId(null)} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm">Hủy</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.action_title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Phụ trách: {ownerName(a.action_owner_id)} · Hạn: {a.deadline}
                        {evalsMap.get(a.id) && (
                          <span className={`ml-2 font-medium ${evalsMap.get(a.id)!.evaluation === 'Pass' ? 'text-green-700' : 'text-red-700'}`}>· {evalsMap.get(a.id)!.evaluation}</span>
                        )}
                      </p>
                      {a.cancel_reason && <p className="text-xs text-red-600 mt-1">Lý do hủy: {a.cancel_reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openResult(a)} className="text-xs text-indigo-600 hover:underline">Kết quả / Đánh giá</button>
                      {canEditAction(myProfile, a, problem) && <button onClick={() => startEditAction(a)} className="text-xs text-indigo-600 hover:underline">Sửa</button>}
                      <select value={a.status} onChange={(e) => handleActionStatus(a, e.target.value as ActionStatus)} disabled={busy} className="border border-gray-300 rounded-md p-1 text-xs">
                        {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {expandedActionId === a.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      {resultsMap.get(a.id)?.is_locked ? (
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">Kết quả (đã khóa):</span> {resultsMap.get(a.id)!.result_note}
                          {resultsMap.get(a.id)!.before_value != null && <span> · {resultsMap.get(a.id)!.before_value} → {resultsMap.get(a.id)!.after_value} {resultsMap.get(a.id)!.unit || ''}</span>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={2} placeholder="Ghi chú kết quả (bắt buộc)" value={resultDraft.result_note} onChange={(e) => setResultDraft({ ...resultDraft, result_note: e.target.value })} />
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <input className="border border-gray-300 rounded-md p-2 text-sm" placeholder="Chỉ số" value={resultDraft.primary_result_metric_name} onChange={(e) => setResultDraft({ ...resultDraft, primary_result_metric_name: e.target.value })} />
                            <input className="border border-gray-300 rounded-md p-2 text-sm" placeholder="Trước" value={resultDraft.before_value} onChange={(e) => setResultDraft({ ...resultDraft, before_value: e.target.value })} />
                            <input className="border border-gray-300 rounded-md p-2 text-sm" placeholder="Sau" value={resultDraft.after_value} onChange={(e) => setResultDraft({ ...resultDraft, after_value: e.target.value })} />
                            <input className="border border-gray-300 rounded-md p-2 text-sm" placeholder="Đơn vị" value={resultDraft.unit} onChange={(e) => setResultDraft({ ...resultDraft, unit: e.target.value })} />
                          </div>
                          <button onClick={() => saveResult(a)} disabled={busy} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50">Lưu kết quả</button>
                        </div>
                      )}

                      {resultsMap.get(a.id) && !evalsMap.get(a.id) && canEvaluateAction(myProfile?.role) && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">Đánh giá:</span>
                          <button onClick={() => submitEvaluation(a, 'Pass')} disabled={busy} className="px-3 py-1 bg-green-600 text-white rounded-md text-xs disabled:opacity-50">Pass</button>
                          <button onClick={() => submitEvaluation(a, 'Not Pass')} disabled={busy} className="px-3 py-1 bg-red-600 text-white rounded-md text-xs disabled:opacity-50">Not Pass</button>
                        </div>
                      )}

                      {evalsMap.get(a.id)?.evaluation === 'Pass' && canCreatePattern(myProfile?.role) && (
                        <button onClick={() => navigate(`/app/library/new?action_id=${a.id}`)} className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-sm">Tạo Solution Pattern</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {actions.length === 0 && <p className="text-sm text-gray-500">Chưa có hành động.</p>}

          {rootCauses.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800">
              Cần thêm ít nhất 1 nguyên nhân trước khi tạo hành động (hành động bắt buộc gắn nguyên nhân).
            </div>
          ) : (
            <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 space-y-3">
              <h3 className="text-sm font-medium text-gray-900">Thêm hành động</h3>
              <input className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="Tên hành động" value={newAction.action_title} onChange={(e) => setNewAction({ ...newAction, action_title: e.target.value })} />
              <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={newAction.root_cause_id} onChange={(e) => setNewAction({ ...newAction, root_cause_id: e.target.value })}>
                <option value="">— Gắn nguyên nhân (BẮT BUỘC) —</option>
                {rootCauses.map((rc) => <option key={rc.id} value={rc.id}>{rc.root_cause_note.slice(0, 50)}</option>)}
              </select>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className="border border-gray-300 rounded-md p-2 text-sm" value={newAction.action_owner_id} onChange={(e) => setNewAction({ ...newAction, action_owner_id: e.target.value })}>
                  <option value="">— Người phụ trách —</option>
                  {profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                </select>
                <input type="date" className="border border-gray-300 rounded-md p-2 text-sm" value={newAction.deadline} onChange={(e) => setNewAction({ ...newAction, deadline: e.target.value })} />
              </div>
              <button onClick={handleAddAction} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Thêm hành động</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
